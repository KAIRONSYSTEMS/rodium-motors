import { readFile, unlink } from "node:fs/promises";
import formidable, { type File as FormidableFile } from "formidable";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type AnyRequest = {
  method?: string;
};

type AnyResponse = {
  status: (code: number) => AnyResponse;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const requiredEnv = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

const getMissingEnv = () => requiredEnv.filter((key) => !process.env[key]);

const sanitizeFilename = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

const parseMultipartFile = (req: AnyRequest) =>
  new Promise<FormidableFile | null>((resolve, reject) => {
    const form = formidable({
      multiples: false,
      maxFiles: 1,
      keepExtensions: true,
    });

    form.parse(req as never, (err, _fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      const fileValue = files.file;
      if (!fileValue) {
        resolve(null);
        return;
      }

      resolve(Array.isArray(fileValue) ? fileValue[0] : fileValue);
    });
  });

export default async function handler(req: AnyRequest, res: AnyResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const missing = getMissingEnv();
  if (missing.length > 0) {
    res.status(500).json({
      error: `Variaveis de ambiente ausentes no backend: ${missing.join(", ")}`,
    });
    return;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });

  let uploadedFile: FormidableFile | null = null;

  try {
    uploadedFile = await parseMultipartFile(req);

    if (!uploadedFile) {
      res.status(400).json({ error: 'Arquivo "file" nao enviado.' });
      return;
    }

    const body = await readFile(uploadedFile.filepath);
    const safeName = sanitizeFilename(uploadedFile.originalFilename || "upload.bin") || "upload.bin";
    const key = `cars/${Date.now()}-${safeName}`;

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: uploadedFile.mimetype || "application/octet-stream",
      })
    );

    const publicBase = (process.env.R2_PUBLIC_URL as string).replace(/\/+$/, "");
    res.status(200).json({ url: `${publicBase}/${key}` });
  } catch (error) {
    console.error("Erro no upload para R2 (Vercel API):", error);
    res.status(500).json({ error: "Erro interno ao fazer upload da imagem." });
  } finally {
    if (uploadedFile?.filepath) {
      await unlink(uploadedFile.filepath).catch(() => undefined);
    }
  }
}
