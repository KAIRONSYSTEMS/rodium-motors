import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Car, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import CarCard from "@/components/CarCard";
import WhatsAppButton from "@/components/WhatsAppButton";
import type { Car as CarType } from "@/lib/types";

const Index = () => {
  const { data: destaques } = useQuery({
    queryKey: ["cars-featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("destaque", true)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error?.code === "PGRST204") {
        const fallback = await supabase
          .from("cars")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6);

        if (fallback.error) throw fallback.error;
        return fallback.data as CarType[];
      }

      if (error) throw error;
      return data as CarType[];
    },
  });

  const services = [
    { icon: Car, title: "Venda de Veículos", desc: "Acervo premium com seleção criteriosa, histórico e procedência para uma compra segura." },
    { icon: ShieldCheck, title: "Serviço de Pré-Compra", desc: "Inspeção técnica e avaliação completa antes de fechar negócio, com olhar especialista." },
    { icon: Handshake, title: "Negociação Assistida", desc: "Acompanhamento na negociação e documentação para reduzir risco e ganhar eficiência." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />

      {/* Destaques */}
      {destaques && destaques.length > 0 && (
        <section className="py-20 md:py-28">
          <div className="container">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                  Destaques
                </span>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  Seleção Especial
                </h2>
              </div>
              <Link
                to="/estoque"
                className="hidden items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80 md:flex"
              >
                Ver todo o acervo
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {destaques.map((car, i) => (
                <CarCard key={car.id} {...car} imagens={car.imagens || []} index={i} />
              ))}
            </div>
            <Link
              to="/estoque"
              className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-primary md:hidden"
            >
              Ver todo o acervo
              <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </div>
        </section>
      )}

      {/* Serviços */}
      <section className="border-t border-foreground/5 py-20 md:py-28">
        <div className="container">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Nossos Serviços
          </span>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Excelência em cada etapa
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {services.map((service, i) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.2, 0, 0, 1] }}
                className="rounded-xl bg-secondary p-8"
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05)" }}
              >
                <service.icon size={28} strokeWidth={1.5} className="text-primary" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {service.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section className="border-t border-foreground/5 py-20 md:py-28">
        <div className="container max-w-3xl text-center">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Sobre a Rodium Cars
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl text-balance">
            Tradição e precisão no mercado automotivo de alto padrão
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground text-pretty">
            A Rodium Cars é referência em consultoria automotiva para veículos esportivos, premium e blindados. 
            Atuamos com compra, venda, intermediação, consignação e serviços de pré-compra, 
            oferecendo a nossos clientes uma experiência diferenciada, pautada pela transparência, 
            discrição e excelência técnica.
          </p>
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-sm font-medium text-primary-foreground transition-all hover:brightness-110"
          >
            Solicitar Atendimento
            <ArrowRight size={16} strokeWidth={1.5} />
          </a>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Index;
