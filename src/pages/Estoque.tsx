import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CarCard from "@/components/CarCard";
import WhatsAppButton from "@/components/WhatsAppButton";
import type { Car } from "@/lib/types";

const Estoque = () => {
  const [marcaFilter, setMarcaFilter] = useState("");
  const [anoFilter, setAnoFilter] = useState("");

  const { data: cars, isLoading } = useQuery({
    queryKey: ["cars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Car[];
    },
  });

  const marcas = useMemo(() => {
    if (!cars) return [];
    return [...new Set(cars.map((c) => c.marca))].sort();
  }, [cars]);

  const anos = useMemo(() => {
    if (!cars) return [];
    return [...new Set(cars.map((c) => c.ano_modelo))].sort((a, b) => b - a);
  }, [cars]);

  const filtered = useMemo(() => {
    if (!cars) return [];
    return cars.filter((c) => {
      if (marcaFilter && c.marca !== marcaFilter) return false;
      if (anoFilter && c.ano_modelo !== Number(anoFilter)) return false;
      return true;
    });
  }, [cars, marcaFilter, anoFilter]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 md:pt-24">
        <div className="container py-12 md:py-16">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Acervo Completo
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Nosso Estoque
          </h1>

          {/* Filtros */}
          <div className="mt-8 flex flex-wrap gap-4">
            <select
              value={marcaFilter}
              onChange={(e) => setMarcaFilter(e.target.value)}
              className="rounded-lg border border-foreground/10 bg-secondary px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todas as marcas</option>
              {marcas.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={anoFilter}
              onChange={(e) => setAnoFilter(e.target.value)}
              className="rounded-lg border border-foreground/10 bg-secondary px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos os anos</option>
              {anos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {(marcaFilter || anoFilter) && (
              <button
                onClick={() => { setMarcaFilter(""); setAnoFilter(""); }}
                className="rounded-lg border border-foreground/10 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-secondary">
                  <div className="aspect-[16/9] bg-muted rounded-t-xl" />
                  <div className="p-6 space-y-3">
                    <div className="h-3 w-16 rounded bg-muted" />
                    <div className="h-5 w-40 rounded bg-muted" />
                    <div className="h-px bg-foreground/5 mt-4" />
                    <div className="flex justify-between pt-2">
                      <div className="h-4 w-20 rounded bg-muted" />
                      <div className="h-4 w-20 rounded bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((car, i) => (
                <CarCard key={car.id} {...car} imagens={car.imagens || []} index={i} />
              ))}
            </div>
          ) : (
            <div className="mt-20 text-center">
              <p className="text-lg text-muted-foreground">
                {cars && cars.length === 0
                  ? "Nenhum veículo cadastrado no momento."
                  : "Nenhum veículo encontrado com os filtros selecionados."}
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Estoque;
