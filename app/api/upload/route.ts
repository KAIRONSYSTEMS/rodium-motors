import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_URL,
} = process.env;

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    // Read multipart/form-data from the request body.
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Arquivo "file" nao enviado.' },
        { status: 400 }
      );
    }

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) {
      return NextResponse.json(
        { error: "Variaveis de ambiente do R2 nao configuradas." },
        { status: 500 }
      );
    }

    // Convert browser File to Node.js Buffer for S3-compatible upload.
    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    // Build object key: cars/{timestamp}-{originalName}
    const originalName = file.name.replace(/\s+/g, "-");
    const key = `cars/${Date.now()}-${originalName}`;

    // Upload object to Cloudflare R2.
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: file.type || "application/octet-stream",
      })
    );

    // Return public URL based on configured public bucket domain.
    const publicBase = R2_PUBLIC_URL.replace(/\/+$/, "");
    const url = `${publicBase}/${key}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Erro no upload para R2:", error);
    return NextResponse.json(
      { error: "Erro interno ao fazer upload da imagem." },
      { status: 500 }
    );
  }
}
