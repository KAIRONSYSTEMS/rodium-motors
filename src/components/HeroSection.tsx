import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import heroCar from "@/assets/hero-car.jpg";

const HeroSection = () => {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroCar}
          alt="Veículo premium em showroom"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="container relative z-10 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
          className="max-w-2xl"
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Compra · Venda · Intermediação · Consignação
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-foreground md:text-6xl lg:text-7xl text-balance">
            A curadoria definitiva para quem exige{" "}
            <span className="gold-text">performance</span> e{" "}
            <span className="gold-text">segurança</span>.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground text-pretty">
            Consultoria especializada em veículos esportivos, premium e blindados. 
            Cada veículo do nosso acervo é selecionado com rigor e precisão.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              to="/estoque"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-sm font-medium text-primary-foreground transition-all hover:brightness-110"
            >
              Explorar Acervo
              <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://wa.me/5511999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-8 py-4 text-sm font-medium text-foreground transition-all hover:bg-foreground/10"
            >
              Solicitar Atendimento
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
