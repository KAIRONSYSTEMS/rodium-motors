import { Link } from "react-router-dom";

const BRAND_LOGO = "/logo%20cru.png";

const Footer = () => {
  return (
    <footer className="border-t border-foreground/5 bg-background">
      <div className="container py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <Link to="/" className="flex w-fit items-center gap-3">
              <img
                src={BRAND_LOGO}
                alt="Rodium Cars"
                className="h-9 w-auto"
              />
              <span className="text-sm font-semibold tracking-[0.2em] text-foreground">RODIUM CARS</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
              Venda de veículos esportivos, premium e blindados com atendimento consultivo e serviço técnico de pré-compra.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-widest text-primary">
              Navegação
            </h4>
            <nav className="mt-4 flex flex-col gap-3">
              <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Início
              </Link>
              <Link to="/estoque" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Acervo
              </Link>
              <Link to="/cadastro" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Cadastro
              </Link>
            </nav>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-widest text-primary">
              Contato
            </h4>
            <div className="mt-4 flex flex-col gap-3">
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                WhatsApp
              </a>
              <a
                href="https://instagram.com/rodiumcars"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Instagram
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-foreground/5 pt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Rodium Cars. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
