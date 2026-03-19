type AnyRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type AnyResponse = {
  status: (code: number) => AnyResponse;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (body: unknown) => void;
};

const isAllowedImageUrl = (raw: string) => {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;

    const allowedSuffixes = [".r2.dev", ".supabase.co", ".cloudflarestorage.com"];
    const bySuffix = allowedSuffixes.some((suffix) => url.hostname.endsWith(suffix));

    const r2Public = process.env.R2_PUBLIC_URL;
    if (!r2Public) return bySuffix;

    let samePublicHost = false;
    try {
      samePublicHost = url.hostname === new URL(r2Public).hostname;
    } catch {
      samePublicHost = false;
    }

    return bySuffix || samePublicHost;
  } catch {
    return false;
  }
};

const getQueryValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
};

export default async function handler(req: AnyRequest, res: AnyResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const encodedUrl = getQueryValue(req.query?.url);
  const decodedUrl = decodeURIComponent(encodedUrl);

  if (!decodedUrl || !isAllowedImageUrl(decodedUrl)) {
    res.status(400).json({ error: "URL de imagem inválida para proxy." });
    return;
  }

  try {
    const upstream = await fetch(decodedUrl);
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "Falha ao buscar imagem no servidor remoto." });
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(buffer);
  } catch (error) {
    console.error("Erro no image proxy:", error);
    res.status(500).json({ error: "Erro interno ao buscar imagem." });
  }
}
