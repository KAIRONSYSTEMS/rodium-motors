import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const Header = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/", label: "Início" },
    { href: "/estoque", label: "Acervo" },
    { href: "/cadastro", label: "Cadastro" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-foreground/5 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between md:h-20">
        <Link to="/" className="text-xl font-semibold tracking-tight">
          <span className="text-foreground">RODIUM</span>
          <span className="text-primary ml-1">CARS</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`text-sm font-medium uppercase tracking-widest transition-colors hover:text-primary ${
                location.pathname === link.href
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:brightness-110"
          >
            Fale Conosco
          </a>
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-foreground md:hidden"
        >
          {menuOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav className="border-t border-foreground/5 bg-background px-6 pb-6 pt-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block py-3 text-sm font-medium uppercase tracking-widest ${
                location.pathname === link.href
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block rounded-md bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground"
          >
            Fale Conosco
          </a>
        </nav>
      )}
    </header>
  );
};

export default Header;
