import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";

interface CarCardProps {
  id: string;
  marca: string;
  modelo: string;
  versao?: string;
  ano_fabricacao: number;
  ano_modelo: number;
  quilometragem: number;
  blindado: boolean;
  imagens: string[];
  index?: number;
}

const CarCard = ({
  id,
  marca,
  modelo,
  versao,
  ano_fabricacao,
  ano_modelo,
  quilometragem,
  blindado,
  imagens,
  index = 0,
}: CarCardProps) => {
  const formatKm = (km: number) =>
    km.toLocaleString("pt-BR") + " km";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.2, 0, 0, 1] }}
    >
      <Link to={`/car/${id}`} className="group block">
        <div className="relative overflow-hidden rounded-xl bg-secondary transition-all duration-500 hover:-translate-y-1"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 10px 30px -10px rgba(0,0,0,0.5)" }}
        >
          <div className="aspect-[16/9] overflow-hidden">
            {imagens.length > 0 ? (
              <img
                src={imagens[0]}
                alt={`${marca} ${modelo}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                style={{ outline: "1px solid rgba(255,255,255,0.1)", outlineOffset: "-1px" }}
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <span className="text-sm text-muted-foreground">Sem imagem</span>
              </div>
            )}
            {blindado && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md bg-background/80 px-2.5 py-1 backdrop-blur-sm">
                <Shield size={14} strokeWidth={1.5} className="text-primary" />
                <span className="text-xs font-medium text-primary">Blindado</span>
              </div>
            )}
          </div>

          <div className="p-5 md:p-6">
            <span className="text-xs font-medium uppercase tracking-widest text-primary">
              {marca}
            </span>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {modelo} {versao && <span className="text-muted-foreground font-normal text-base">{versao}</span>}
            </h3>
            <div className="mt-4 flex justify-between border-t border-foreground/5 pt-4 text-sm tabular-nums text-muted-foreground">
              <span>{ano_fabricacao}/{ano_modelo}</span>
              <span>{formatKm(quilometragem)}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default CarCard;
