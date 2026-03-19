import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps {
  message?: string;
}

const WhatsAppButton = ({ message = "Olá! Gostaria de mais informações." }: WhatsAppButtonProps) => {
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/5511999999999?text=${encoded}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-110"
      aria-label="Contato via WhatsApp"
    >
      <MessageCircle size={28} strokeWidth={1.5} className="text-foreground" />
    </a>
  );
};

export default WhatsAppButton;
