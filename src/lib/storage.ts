const R2_PUBLIC_BASE_URL = (import.meta.env.VITE_R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const R2_UPLOAD_ENDPOINT = import.meta.env.VITE_R2_UPLOAD_ENDPOINT || "";

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

export const resolveImageUrl = (value: string): string => {
  if (!value) return value;
  if (isAbsoluteUrl(value)) return value;

  const normalizedPath = value.replace(/^\/+/, "");
  if (!R2_PUBLIC_BASE_URL) return normalizedPath;

  return `${R2_PUBLIC_BASE_URL}/${normalizedPath}`;
};

export const uploadImageToR2 = async (file: File): Promise<string> => {
  if (!R2_UPLOAD_ENDPOINT) {
    throw new Error("Defina VITE_R2_UPLOAD_ENDPOINT para enviar imagens ao Cloudflare R2.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(R2_UPLOAD_ENDPOINT, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Endpoint de upload não encontrado em ${R2_UPLOAD_ENDPOINT}. Verifique se o backend Next.js está rodando e se a rota /api/upload existe.`
      );
    }

    let details = "";
    try {
      details = await response.text();
    } catch {
      details = "";
    }

    const errorSuffix = details ? ` ${details}` : "";
    throw new Error(`Falha no upload para o R2 (${response.status}).${errorSuffix}`);
  }

  const payload = (await response.json()) as { url?: string; key?: string };

  if (payload.url) return payload.url;
  if (payload.key) return payload.key;

  throw new Error("Resposta inválida do endpoint de upload R2. Esperado: { url } ou { key }.");
};
