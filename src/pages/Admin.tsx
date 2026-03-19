import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrl, uploadImageToR2 } from "@/lib/storage";
import { toast } from "sonner";
import { Upload, X, Loader2, Check } from "lucide-react";
import Header from "@/components/Header";

interface CarForm {
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
  destaque: boolean;
}

const initialForm: CarForm = {
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
  destaque: false,
};

const Admin = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CarForm>(initialForm);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((f) => ({ ...f, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.marca || !form.modelo || !form.ano_fabricacao || !form.ano_modelo) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }

    setSubmitting(true);

    try {
      // Upload images
      const imageUrls: string[] = [];
      for (const file of images) {
        const uploadedUrl = await uploadImageToR2(file);
        imageUrls.push(resolveImageUrl(uploadedUrl));
      }

      // Insert car
      const { error } = await supabase.from("cars").insert({
        marca: form.marca,
        modelo: form.modelo,
        versao: form.versao || null,
        ano_fabricacao: parseInt(form.ano_fabricacao),
        ano_modelo: parseInt(form.ano_modelo),
        quilometragem: parseInt(form.quilometragem) || 0,
        cor: form.cor || null,
        blindado: form.blindado,
        descricao: form.descricao || null,
        imagens: imageUrls,
        preco: form.preco ? parseFloat(form.preco) : null,
        destaque: form.destaque,
      });

      if (error) throw error;

      toast.success("Veículo cadastrado com sucesso!");
      setForm(initialForm);
      setImages([]);
      setPreviews([]);
      queryClient.invalidateQueries({ queryKey: ["cars"] });
      queryClient.invalidateQueries({ queryKey: ["cars-featured"] });
    } catch (err: any) {
      toast.error("Erro ao cadastrar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-foreground/10 bg-secondary px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 md:pt-24">
        <div className="container max-w-2xl py-12">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Painel Administrativo
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Cadastrar Veículo
          </h1>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
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
                <input name="modelo" value={form.modelo} onChange={handleChange} placeholder="911 Carrera S" className={inputClass} required />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Versão
              </label>
              <input name="versao" value={form.versao} onChange={handleChange} placeholder="3.0 Turbo PDK" className={inputClass} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Ano Fabricação *
                </label>
                <input name="ano_fabricacao" value={form.ano_fabricacao} onChange={handleChange} placeholder="2023" type="number" className={inputClass} required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Ano Modelo *
                </label>
                <input name="ano_modelo" value={form.ano_modelo} onChange={handleChange} placeholder="2024" type="number" className={inputClass} required />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Quilometragem
                </label>
                <input name="quilometragem" value={form.quilometragem} onChange={handleChange} placeholder="4500" type="number" className={inputClass} />
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
                <input name="preco" value={form.preco} onChange={handleChange} placeholder="850000" type="number" className={inputClass} />
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="blindado" checked={form.blindado} onChange={handleChange} className="h-4 w-4 rounded border-foreground/20 bg-secondary accent-primary" />
                <span className="text-sm text-foreground">Blindado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="destaque" checked={form.destaque} onChange={handleChange} className="h-4 w-4 rounded border-foreground/20 bg-secondary accent-primary" />
                <span className="text-sm text-foreground">Destaque na Home</span>
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
                placeholder="Descreva o veículo, incluindo opcionais, estado de conservação, etc."
                rows={4}
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Upload de imagens */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Imagens
              </label>
              <p className="text-xs text-muted-foreground">
                O envio usa Cloudflare R2 via endpoint seguro definido em VITE_R2_UPLOAD_ENDPOINT.
              </p>
              <div className="mt-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/10 bg-secondary/50 px-6 py-8 transition-colors hover:border-primary/30">
                  <Upload size={20} strokeWidth={1.5} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para selecionar imagens</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImages}
                    className="hidden"
                  />
                </label>
              </div>
              {previews.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-4">
                  {previews.map((src, i) => (
                    <div key={i} className="group relative aspect-[4/3] overflow-hidden rounded-lg">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X size={14} className="text-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Cadastrando...
                </>
              ) : (
                <>
                  <Check size={18} strokeWidth={1.5} /> Cadastrar Veículo
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Admin;
