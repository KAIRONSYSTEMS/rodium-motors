import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import type { Car } from "@/lib/types";
import { resolveImageUrl, uploadImageToR2 } from "@/lib/storage";

interface CarForm {
  id: string;
  marca: string;
  modelo: string;
  versao: string;
  ano_fabricacao: string;
  ano_modelo: string;
  quilometragem: string;
  cor: string;
  blindado: boolean;
  descricao: string;
  preco: string;
  created_at: string;
}

interface CoverCrop {
  focusX: number;
  focusY: number;
  zoom: number;
}

const MAX_IMAGES = 30;
const COVER_OUTPUT_WIDTH = 1200;
const COVER_OUTPUT_HEIGHT = 900;
const DEFAULT_COVER_CROP: CoverCrop = {
  focusX: 50,
  focusY: 50,
  zoom: 1,
};

const initialForm: CarForm = {
  id: "",
  marca: "",
  modelo: "",
  versao: "",
  ano_fabricacao: "",
  ano_modelo: "",
  quilometragem: "",
  cor: "",
  blindado: false,
  descricao: "",
  preco: "",
  created_at: "",
};

const toLocalDatetimeInput = (isoDate: string) => {
  const dt = new Date(isoDate);
  if (Number.isNaN(dt.getTime())) return "";

  const pad = (v: number) => String(v).padStart(2, "0");
  const yyyy = dt.getFullYear();
  const mm = pad(dt.getMonth() + 1);
  const dd = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mi = pad(dt.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const toIsoOrUndefined = (value: string) => {
  if (!value) return undefined;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toISOString();
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const extractSupabaseErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      maybeError.message,
      maybeError.details,
      maybeError.hint,
      maybeError.code ? `(code: ${maybeError.code})` : undefined,
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(" | ");
  }

  return "Erro inesperado";
};

const parseMissingColumnFromPgrst = (error: unknown) => {
  if (!error || typeof error !== "object") return null;

  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code !== "PGRST204" || !maybeError.message) return null;

  const match = maybeError.message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] || null;
};

const mutateWithSchemaFallback = async (
  basePayload: Record<string, unknown>,
  runMutation: (payload: Record<string, unknown>) => Promise<{ error: unknown }>
) => {
  const payload = { ...basePayload };

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await runMutation(payload);
    if (!error) return;

    const missingColumn = parseMissingColumnFromPgrst(error);
    if (!missingColumn || !(missingColumn in payload)) {
      throw error;
    }

    delete payload[missingColumn];
  }

  throw new Error("Não foi possível salvar: muitas colunas não existem no schema atual.");
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
};

const toPtBrDateTime = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toPtBrCurrency = (value: number | null) => {
  if (value == null) return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const imageUrlToDataUrl = async (url: string) => {
  const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;

  let response = await fetch(proxyUrl);
  if (!response.ok) {
    // Fallback for environments where proxy is unavailable.
    response = await fetch(url);
  }

  if (!response.ok) throw new Error(`Falha ao baixar imagem (${response.status})`);

  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro ao converter imagem para PDF."));
    reader.readAsDataURL(blob);
  });
};

const loadImageFromFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler a imagem para ajustar a capa."));
    };

    img.src = objectUrl;
  });

const createCroppedCoverFile = async (file: File, crop: CoverCrop) => {
  const img = await loadImageFromFile(file);
  const imageAspect = img.width / img.height;
  const targetAspect = COVER_OUTPUT_WIDTH / COVER_OUTPUT_HEIGHT;

  let baseCropWidth = img.width;
  let baseCropHeight = img.height;

  if (imageAspect > targetAspect) {
    baseCropWidth = img.height * targetAspect;
  } else {
    baseCropHeight = img.width / targetAspect;
  }

  const zoom = clamp(crop.zoom, 1, 2);
  const cropWidth = baseCropWidth / zoom;
  const cropHeight = baseCropHeight / zoom;

  const rawCenterX = (crop.focusX / 100) * img.width;
  const rawCenterY = (crop.focusY / 100) * img.height;
  const centerX = clamp(rawCenterX, cropWidth / 2, img.width - cropWidth / 2);
  const centerY = clamp(rawCenterY, cropHeight / 2, img.height - cropHeight / 2);

  const sx = centerX - cropWidth / 2;
  const sy = centerY - cropHeight / 2;

  const canvas = document.createElement("canvas");
  canvas.width = COVER_OUTPUT_WIDTH;
  canvas.height = COVER_OUTPUT_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível preparar a edição de capa.");
  }

  ctx.drawImage(
    img,
    sx,
    sy,
    cropWidth,
    cropHeight,
    0,
    0,
    COVER_OUTPUT_WIDTH,
    COVER_OUTPUT_HEIGHT
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (generatedBlob) => {
        if (!generatedBlob) {
          reject(new Error("Não foi possível gerar a imagem de capa."));
          return;
        }
        resolve(generatedBlob);
      },
      "image/jpeg",
      0.92
    );
  });

  const safeName = file.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "-");
  return new File([blob], `${safeName}-capa.jpg`, { type: "image/jpeg" });
};

const Cadastro = () => {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<CarForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [coverCrop, setCoverCrop] = useState<CoverCrop>(DEFAULT_COVER_CROP);
  const [submitting, setSubmitting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: cars, isLoading } = useQuery({
    queryKey: ["cars-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Car[];
    },
  });

  const totalImages = existingImages.length + newImages.length;

  const canSubmit = useMemo(() => {
    return (
      !!form.marca &&
      !!form.modelo &&
      !!form.ano_fabricacao &&
      !!form.ano_modelo &&
      totalImages <= MAX_IMAGES
    );
  }, [form, totalImages]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setExistingImages([]);
    setNewImages([]);
    setNewPreviews([]);
    setCoverCrop(DEFAULT_COVER_CROP);
  };

  const refreshCars = () => {
    queryClient.invalidateQueries({ queryKey: ["cars"] });
    queryClient.invalidateQueries({ queryKey: ["cars-featured"] });
    queryClient.invalidateQueries({ queryKey: ["cars-admin"] });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    const remainingSlots = MAX_IMAGES - (existingImages.length + newImages.length);
    if (remainingSlots <= 0) {
      toast.error(`Limite de ${MAX_IMAGES} imagens por anúncio.`);
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);
    if (selectedFiles.length < files.length) {
      toast.warning(`Somente ${remainingSlots} imagens foram adicionadas para respeitar o limite de ${MAX_IMAGES}.`);
    }

    if (existingImages.length === 0 && newImages.length === 0 && selectedFiles.length > 0) {
      setCoverCrop(DEFAULT_COVER_CROP);
    }

    setNewImages((prev) => [...prev, ...selectedFiles]);
    selectedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setNewPreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    e.currentTarget.value = "";
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setNewPreviews((prev) => prev.filter((_, i) => i !== index));

    if (index === 0) {
      setCoverCrop(DEFAULT_COVER_CROP);
    }
  };

  const loadCarToEdit = (car: Car) => {
    setEditingId(car.id);
    setForm({
      id: car.id,
      marca: car.marca,
      modelo: car.modelo,
      versao: car.versao || "",
      ano_fabricacao: String(car.ano_fabricacao),
      ano_modelo: String(car.ano_modelo),
      quilometragem: String(car.quilometragem),
      cor: car.cor || "",
      blindado: car.blindado,
      descricao: car.descricao || "",
      preco: car.preco != null ? String(car.preco) : "",
      created_at: toLocalDatetimeInput(car.created_at),
    });
    setExistingImages(car.imagens || []);
    setNewImages([]);
    setNewPreviews([]);
    setCoverCrop(DEFAULT_COVER_CROP);
  };

  const uploadNewImages = async () => {
    const filesToUpload = [...newImages];

    // If there are no existing images, the first selected image becomes the ad cover.
    if (existingImages.length === 0 && filesToUpload.length > 0) {
      filesToUpload[0] = await createCroppedCoverFile(filesToUpload[0], coverCrop);
    }

    const uploadedUrls: string[] = [];
    for (const file of filesToUpload) {
      const uploadedValue = await uploadImageToR2(file);
      uploadedUrls.push(resolveImageUrl(uploadedValue));
    }
    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      toast.error("Preencha os campos obrigatórios e valide o limite de imagens.");
      return;
    }

    if (totalImages > MAX_IMAGES) {
      toast.error(`O anúncio pode ter no máximo ${MAX_IMAGES} imagens.`);
      return;
    }

    setSubmitting(true);

    try {
      const trimmedId = form.id.trim();
      if (trimmedId && !isUuid(trimmedId)) {
        throw new Error("ID inválido. Informe um UUID válido ou deixe o campo ID em branco.");
      }

      const anoFabricacao = parseInt(form.ano_fabricacao, 10);
      const anoModelo = parseInt(form.ano_modelo, 10);
      const quilometragem = parseInt(form.quilometragem || "0", 10);
      const preco = form.preco ? parseFloat(form.preco) : null;

      if (Number.isNaN(anoFabricacao) || Number.isNaN(anoModelo)) {
        throw new Error("Ano de fabricação e ano modelo precisam ser números válidos.");
      }

      if (Number.isNaN(quilometragem)) {
        throw new Error("Quilometragem inválida.");
      }

      if (form.preco && (preco == null || Number.isNaN(preco))) {
        throw new Error("Preço inválido.");
      }

      const uploadedUrls = await uploadNewImages();
      const finalImages = [...existingImages, ...uploadedUrls];

      const payload: Record<string, unknown> = {
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        versao: form.versao.trim() || null,
        ano_fabricacao: anoFabricacao,
        ano_modelo: anoModelo,
        quilometragem,
        cor: form.cor.trim() || null,
        blindado: form.blindado,
        descricao: form.descricao.trim() || null,
        imagens: finalImages,
        preco,
      };

      if (trimmedId) {
        payload.id = trimmedId;
      }

      const createdAtIso = toIsoOrUndefined(form.created_at);
      if (createdAtIso) {
        payload.created_at = createdAtIso;
      }

      if (editingId) {
        await mutateWithSchemaFallback(payload, async (safePayload) =>
          supabase
            .from("cars")
            .update(safePayload as never)
            .eq("id", editingId)
        );
        toast.success("Anúncio atualizado com sucesso!");
      } else {
        await mutateWithSchemaFallback(payload, async (safePayload) =>
          supabase.from("cars").insert(safePayload as never)
        );
        toast.success("Anúncio criado com sucesso!");
      }

      resetForm();
      refreshCars();
    } catch (error) {
      const message = extractSupabaseErrorMessage(error);
      toast.error(`Erro ao salvar anúncio: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (carId: string) => {
    const ok = window.confirm("Deseja realmente excluir este anúncio?");
    if (!ok) return;

    setDeletingId(carId);
    try {
      const { error } = await supabase.from("cars").delete().eq("id", carId);
      if (error) throw error;

      if (editingId === carId) {
        resetForm();
      }

      refreshCars();
      toast.success("Anúncio excluído com sucesso!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado";
      toast.error(`Erro ao excluir anúncio: ${message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportAds = () => {
    if (!cars || cars.length === 0) {
      toast.error("Não há anúncios para exportar.");
      return;
    }

    // No schema atual não existe flag de ativo; exportamos todos os anúncios cadastrados.
    const activeAds = cars;

    const headers = [
      "id",
      "marca",
      "modelo",
      "versao",
      "ano_fabricacao",
      "ano_modelo",
      "quilometragem",
      "cor",
      "blindado",
      "descricao",
      "preco",
      "created_at",
      "imagens",
    ];

    const rows = activeAds.map((car) => [
      car.id,
      car.marca,
      car.modelo,
      car.versao || "",
      car.ano_fabricacao,
      car.ano_modelo,
      car.quilometragem,
      car.cor || "",
      car.blindado,
      car.descricao || "",
      car.preco ?? "",
      car.created_at,
      (car.imagens || []).join(" | "),
    ]);

    const csvContent = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    const csvWithBom = `\uFEFF${csvContent}`;
    const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const fileStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
    const fileName = `rodium-cars-anuncios-ativos-${fileStamp}.csv`;

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    toast.success(`Arquivo exportado com ${activeAds.length} anúncio(s).`);
  };

  const handleExportPdf = async () => {
    if (!cars || cars.length === 0) {
      toast.error("Não há anúncios para gerar PDF.");
      return;
    }

    setGeneratingPdf(true);

    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      for (let i = 0; i < cars.length; i += 1) {
        const car = cars[i];
        if (i > 0) doc.addPage();

        // Header strip
        doc.setFillColor(17, 24, 39);
        doc.rect(0, 0, pageWidth, 24, "F");

        doc.setTextColor(248, 250, 252);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text("RODIUM CARS", 14, 10);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Relatório de Anúncios", 14, 16);

        doc.text(`Registro ${i + 1} de ${cars.length}`, pageWidth - 14, 16, { align: "right" });

        // Body card
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(10, 30, pageWidth - 20, pageHeight - 45, 3, 3, "F");
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(10, 30, pageWidth - 20, pageHeight - 45, 3, 3, "S");

        const imageX = pageWidth - 82;
        const imageY = 40;
        const imageW = 62;
        const imageH = 46;

        const primaryImage = car.imagens && car.imagens.length > 0 ? resolveImageUrl(car.imagens[0]) : "";
        if (primaryImage) {
          try {
            const imgData = await imageUrlToDataUrl(primaryImage);
            doc.addImage(imgData, "JPEG", imageX, imageY, imageW, imageH);
            doc.setDrawColor(203, 213, 225);
            doc.rect(imageX, imageY, imageW, imageH);
          } catch {
            doc.setDrawColor(148, 163, 184);
            doc.rect(imageX, imageY, imageW, imageH);
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(9);
            doc.text("Imagem indisponível", imageX + imageW / 2, imageY + imageH / 2, { align: "center" });
          }
        } else {
          doc.setDrawColor(148, 163, 184);
          doc.rect(imageX, imageY, imageW, imageH);
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(9);
          doc.text("Sem imagem", imageX + imageW / 2, imageY + imageH / 2, { align: "center" });
        }

        doc.setTextColor(17, 24, 39);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`${car.marca} ${car.modelo}`, 16, 42);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        if (car.versao) {
          doc.text(`Versão: ${car.versao}`, 16, 49);
        }

        const details: Array<[string, string]> = [
          ["ID", car.id],
          ["Ano", `${car.ano_fabricacao}/${car.ano_modelo}`],
          ["Quilometragem", `${car.quilometragem.toLocaleString("pt-BR")} km`],
          ["Cor", car.cor || "-"],
          ["Blindado", car.blindado ? "Sim" : "Não"],
          ["Preço", toPtBrCurrency(car.preco)],
          ["Criado em", toPtBrDateTime(car.created_at)],
          ["Qtd. de imagens", String(car.imagens?.length || 0)],
        ];

        let lineY = 60;
        for (const [label, value] of details) {
          doc.setFont("helvetica", "bold");
          doc.text(`${label}:`, 16, lineY);
          doc.setFont("helvetica", "normal");
          doc.text(value, 48, lineY);
          lineY += 8;
        }

        if (car.descricao) {
          doc.setFont("helvetica", "bold");
          doc.text("Descrição:", 16, lineY + 4);
          doc.setFont("helvetica", "normal");

          const wrappedDesc = doc.splitTextToSize(car.descricao, pageWidth - 32);
          doc.text(wrappedDesc, 16, lineY + 10);
        }

        const imageLinks = (car.imagens || []).map((img) => resolveImageUrl(img)).join(" | ");
        const wrappedImages = doc.splitTextToSize(`Imagens: ${imageLinks || "-"}`, pageWidth - 32);
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(wrappedImages, 16, pageHeight - 14);
      }

      const now = new Date();
      const fileStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
      doc.save(`rodium-cars-anuncios-${fileStamp}.pdf`);
      toast.success(`PDF gerado com ${cars.length} anúncio(s).`);
    } catch (error) {
      const message = extractSupabaseErrorMessage(error);
      toast.error(`Erro ao gerar PDF: ${message}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-foreground/10 bg-secondary px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary";

  const showCoverCropControls = existingImages.length === 0 && newPreviews.length > 0;
  const firstCoverPreview = newPreviews[0] || "";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 md:pt-24">
        <div className="container py-10 md:py-14">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Painel de Cadastro
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Criar, editar e excluir anúncios
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Formulário completo com todos os campos da tabela cars e upload direto para R2 (até {MAX_IMAGES} fotos por anúncio).
          </p>
          <div className="mt-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportAds}
                className="inline-flex items-center gap-2 rounded-lg border border-foreground/10 bg-secondary px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-foreground transition-colors hover:bg-secondary/70"
              >
                <Download size={15} /> Exportar anúncios ativos (.csv)
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={generatingPdf}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Carregando PDF...
                  </>
                ) : (
                  <>
                    <Download size={15} /> Gerar PDF profissional
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-xl border border-foreground/10 bg-secondary/30 p-5 md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {editingId ? "Editar anúncio" : "Novo anúncio"}
                </h2>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-foreground/10 px-3 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Cancelar edição
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      ID
                    </label>
                    <input
                      name="id"
                      value={form.id}
                      onChange={handleChange}
                      placeholder="UUID (opcional)"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Data de criação
                    </label>
                    <input
                      name="created_at"
                      value={form.created_at}
                      onChange={handleChange}
                      type="datetime-local"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Marca *
                    </label>
                    <input name="marca" value={form.marca} onChange={handleChange} placeholder="Porsche" className={inputClass} required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Modelo *
                    </label>
                    <input name="modelo" value={form.modelo} onChange={handleChange} placeholder="911 Carrera" className={inputClass} required />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Versão
                  </label>
                  <input name="versao" value={form.versao} onChange={handleChange} placeholder="3.0 Turbo" className={inputClass} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Ano Fabricação *
                    </label>
                    <input name="ano_fabricacao" value={form.ano_fabricacao} onChange={handleChange} type="number" placeholder="2023" className={inputClass} required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Ano Modelo *
                    </label>
                    <input name="ano_modelo" value={form.ano_modelo} onChange={handleChange} type="number" placeholder="2024" className={inputClass} required />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Quilometragem
                    </label>
                    <input name="quilometragem" value={form.quilometragem} onChange={handleChange} type="number" placeholder="4500" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Cor
                    </label>
                    <input name="cor" value={form.cor} onChange={handleChange} placeholder="Preto" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Preço (R$)
                    </label>
                    <input name="preco" value={form.preco} onChange={handleChange} type="number" placeholder="850000" className={inputClass} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      name="blindado"
                      checked={form.blindado}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-foreground/20 bg-secondary accent-primary"
                    />
                    <span className="text-sm text-foreground">Blindado</span>
                  </label>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Descrição
                  </label>
                  <textarea
                    name="descricao"
                    value={form.descricao}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Descreva o veículo..."
                    className={inputClass + " resize-none"}
                  />
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Imagens ({totalImages}/{MAX_IMAGES})
                    </label>
                    <span className="text-xs text-muted-foreground">Upload direto para R2 via endpoint seguro</span>
                  </div>

                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/10 bg-secondary/50 px-6 py-8 transition-colors hover:border-primary/30">
                    <Upload size={20} strokeWidth={1.5} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Adicionar fotos</span>
                    <input type="file" accept="image/*" multiple onChange={handleNewImages} className="hidden" />
                  </label>

                  {showCoverCropControls && (
                    <div className="mt-4 rounded-lg border border-foreground/10 bg-background/50 p-4">
                      <p className="text-xs font-medium uppercase tracking-widest text-primary">Ajuste da capa (1a foto)</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Defina enquadramento para a foto de capa da pré-visualização no acervo.
                      </p>

                      <div className="mt-3 overflow-hidden rounded-lg border border-foreground/10 bg-muted aspect-[4/3]">
                        <img
                          src={firstCoverPreview}
                          alt="Prévia da capa"
                          className="h-full w-full object-cover"
                          style={{
                            objectPosition: `${coverCrop.focusX}% ${coverCrop.focusY}%`,
                            transform: `scale(${coverCrop.zoom})`,
                            transformOrigin: "center",
                          }}
                        />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <label className="text-xs text-muted-foreground">
                          Horizontal
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={coverCrop.focusX}
                            onChange={(e) =>
                              setCoverCrop((prev) => ({ ...prev, focusX: Number(e.target.value) }))
                            }
                            className="mt-1 w-full"
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          Vertical
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={coverCrop.focusY}
                            onChange={(e) =>
                              setCoverCrop((prev) => ({ ...prev, focusY: Number(e.target.value) }))
                            }
                            className="mt-1 w-full"
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          Zoom
                          <input
                            type="range"
                            min={1}
                            max={2}
                            step={0.01}
                            value={coverCrop.zoom}
                            onChange={(e) =>
                              setCoverCrop((prev) => ({ ...prev, zoom: Number(e.target.value) }))
                            }
                            className="mt-1 w-full"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {existingImages.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Fotos atuais</p>
                      <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
                        {existingImages.map((img, i) => (
                          <div key={`${img}-${i}`} className="group relative aspect-[4/3] overflow-hidden rounded-lg">
                            <img src={resolveImageUrl(img)} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeExistingImage(i)}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X size={14} className="text-foreground" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {newPreviews.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Novas fotos (ainda não salvas)</p>
                      <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
                        {newPreviews.map((src, i) => (
                          <div key={`${src.slice(0, 30)}-${i}`} className="group relative aspect-[4/3] overflow-hidden rounded-lg">
                            <img src={src} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeNewImage(i)}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X size={14} className="text-foreground" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <Check size={18} strokeWidth={1.5} /> {editingId ? "Salvar alterações" : "Criar anúncio"}
                    </>
                  )}
                </button>
              </form>
            </section>

            <section className="rounded-xl border border-foreground/10 bg-secondary/30 p-5 md:p-7">
              <h2 className="text-lg font-semibold text-foreground">Anúncios criados</h2>
              <p className="mt-1 text-sm text-muted-foreground">Selecione um anúncio para editar todos os campos ou excluir.</p>

              <div className="mt-6 space-y-3">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="animate-pulse rounded-lg border border-foreground/10 p-4">
                        <div className="h-4 w-32 rounded bg-muted" />
                        <div className="mt-2 h-3 w-52 rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : cars && cars.length > 0 ? (
                  cars.map((car) => (
                    <article key={car.id} className="rounded-lg border border-foreground/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            {car.marca} {car.modelo}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            ID: {car.id}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {car.ano_fabricacao}/{car.ano_modelo} • {car.quilometragem.toLocaleString("pt-BR")} km • {car.imagens?.length || 0} fotos
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => loadCarToEdit(car)}
                            className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                          >
                            <Pencil size={14} /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(car.id)}
                            disabled={deletingId === car.id}
                            className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2.5 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                          >
                            {deletingId === car.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Excluir
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-lg border border-foreground/10 p-6 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum anúncio cadastrado.</p>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                    >
                      <Plus size={14} /> Criar primeiro anúncio
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Cadastro;
