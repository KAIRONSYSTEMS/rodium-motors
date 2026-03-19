import { readFile, unlink } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import formidable, { type File as FormidableFile } from "formidable";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Plugin } from "vite";

type EnvMap = Record<string, string | undefined>;

const json = (res: ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const sanitizeFilename = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

const pickFile = (fileValue: FormidableFile | FormidableFile[] | undefined) => {
  if (!fileValue) return null;
  return Array.isArray(fileValue) ? fileValue[0] : fileValue;
};

const parseForm = (req: IncomingMessage) =>
  new Promise<{ file: FormidableFile | null }>((resolve, reject) => {
    const form = formidable({
      multiples: false,
      maxFiles: 1,
      keepExtensions: true,
    });

    form.parse(req, (err, _fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({ file: pickFile(files.file) });
    });
  });

const requiredEnv = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

const missingEnv = (env: EnvMap) =>
  requiredEnv.filter((key) => !env[key]);

export const createR2UploadDevPlugin = (env: EnvMap): Plugin => {
  const missing = missingEnv(env);

  const client =
    missing.length === 0
      ? new S3Client({
          region: "auto",
          endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID as string,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
          },
        })
      : null;

  return {
    name: "r2-upload-dev-endpoint",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/upload")) {
          next();
          return;
        }

        if (req.method !== "POST") {
          json(res, 405, { error: "Metodo nao permitido." });
          return;
        }

        if (missing.length > 0 || !client) {
          json(res, 500, {
            error: `Variaveis de ambiente ausentes para R2: ${missing.join(", ")}`,
          });
          return;
        }

        let uploadedFile: FormidableFile | null = null;

        try {
          const parsed = await parseForm(req);
          uploadedFile = parsed.file;

          if (!uploadedFile) {
            json(res, 400, { error: 'Arquivo "file" nao enviado.' });
            return;
          }

          const body = await readFile(uploadedFile.filepath);
          const safeName = sanitizeFilename(uploadedFile.originalFilename || "upload.bin") || "upload.bin";
          const key = `cars/${Date.now()}-${safeName}`;

          await client.send(
            new PutObjectCommand({
              Bucket: env.R2_BUCKET,
              Key: key,
              Body: body,
              ContentType: uploadedFile.mimetype || "application/octet-stream",
            })
          );

          const publicBase = (env.R2_PUBLIC_URL as string).replace(/\/+$/, "");
          json(res, 200, { url: `${publicBase}/${key}` });
        } catch (error) {
          console.error("Erro no upload para R2 (Vite dev middleware):", error);
          json(res, 500, { error: "Erro interno ao fazer upload da imagem." });
        } finally {
          if (uploadedFile?.filepath) {
            await unlink(uploadedFile.filepath).catch(() => undefined);
          }
        }
      });
    },
  };
};
