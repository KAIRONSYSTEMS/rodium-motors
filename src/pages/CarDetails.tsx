import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shield, Calendar, Gauge, Palette, MessageCircle } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import type { Car } from "@/lib/types";

const CarDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedImage, setSelectedImage] = useState(0);

  const { data: car, isLoading } = useQuery({
    queryKey: ["car", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Car;
    },
    enabled: !!id,
  });

  const formatKm = (km: number) => km.toLocaleString("pt-BR") + " km";
  const formatPrice = (price: number) =>
    price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container pt-28 pb-20">
          <div className="animate-pulse space-y-6">
            <div className="h-6 w-32 rounded bg-muted" />
            <div className="aspect-[16/9] rounded-xl bg-muted" />
            <div className="h-8 w-64 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container flex min-h-[60vh] items-center justify-center pt-20">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">Veículo não encontrado</h1>
            <Link to="/estoque" className="mt-4 inline-flex items-center gap-2 text-sm text-primary">
              <ArrowLeft size={16} strokeWidth={1.5} /> Voltar ao acervo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const imagens = car.imagens || [];
  const whatsappMsg = `Olá! Tenho interesse no ${car.marca} ${car.modelo} ${car.versao || ""} ${car.ano_fabricacao}/${car.ano_modelo}. Gostaria de mais informações.`;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 md:pt-24">
        <div className="container py-8 md:py-12">
          <Link to="/estoque" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft size={16} strokeWidth={1.5} /> Voltar ao acervo
          </Link>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* Galeria */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
            >
              {imagens.length > 0 ? (
                <>
                  <div className="aspect-[16/9] overflow-hidden rounded-xl"
                    style={{ outline: "1px solid rgba(255,255,255,0.1)", outlineOffset: "-1px" }}
                  >
                    <img
                      src={imagens[selectedImage]}
                      alt={`${car.marca} ${car.modelo}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {imagens.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                      {imagens.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedImage(i)}
                          className={`flex-shrink-0 overflow-hidden rounded-lg transition-all ${
                            i === selectedImage
                              ? "ring-2 ring-primary"
                              : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img src={img} alt="" className="h-16 w-24 object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-secondary">
                  <span className="text-muted-foreground">Sem imagens disponíveis</span>
                </div>
              )}
            </motion.div>

            {/* Informações */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.2, 0, 0, 1] }}
              className="space-y-6"
            >
              <div>
                <span className="text-xs font-medium uppercase tracking-widest text-primary">{car.marca}</span>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  {car.modelo}
                </h1>
                {car.versao && (
                  <p className="mt-1 text-lg text-muted-foreground">{car.versao}</p>
                )}
              </div>

              {car.preco && (
                <p className="text-2xl font-semibold tabular-nums text-primary">
                  {formatPrice(car.preco)}
                </p>
              )}

              {/* Especificações */}
              <div className="rounded-xl bg-secondary p-6 space-y-4"
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05)" }}
              >
                <h3 className="text-xs font-medium uppercase tracking-widest text-primary">
                  Especificações
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar size={18} strokeWidth={1.5} className="text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Ano</p>
                      <p className="text-sm font-medium tabular-nums text-foreground">{car.ano_fabricacao}/{car.ano_modelo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Gauge size={18} strokeWidth={1.5} className="text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Quilometragem</p>
                      <p className="text-sm font-medium tabular-nums text-foreground">{formatKm(car.quilometragem)}</p>
                    </div>
                  </div>
                  {car.cor && (
                    <div className="flex items-center gap-3">
                      <Palette size={18} strokeWidth={1.5} className="text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Cor</p>
                        <p className="text-sm font-medium text-foreground">{car.cor}</p>
                      </div>
                    </div>
                  )}
                  {car.blindado && (
                    <div className="flex items-center gap-3">
                      <Shield size={18} strokeWidth={1.5} className="text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Blindagem</p>
                        <p className="text-sm font-medium text-primary">Blindado</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Descrição */}
              {car.descricao && (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-widest text-primary">
                    Descrição
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {car.descricao}
                  </p>
                </div>
              )}

              {/* CTA */}
              <a
                href={`https://wa.me/5511999999999?text=${encodeURIComponent(whatsappMsg)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-sm font-medium text-primary-foreground transition-all hover:brightness-110"
              >
                <MessageCircle size={18} strokeWidth={1.5} />
                Consultar Especialista
              </a>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
      <WhatsAppButton message={whatsappMsg} />
    </div>
  );
};

export default CarDetails;
