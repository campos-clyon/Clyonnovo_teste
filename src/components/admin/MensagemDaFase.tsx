"use client";

import { MessageCircle } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { abrirWhatsAppNaLingua } from "@/lib/abrir-whatsapp-na-lingua";
import { linkDeWhatsApp } from "@/lib/link-de-whatsapp";

/**
 * UM BOTÃO QUE ABRE O WHATSAPP COM A MENSAGEM DA FASE — d55 (17-11-2026).
 *
 * Não manda nada: abre a conversa com o cliente, no WhatsApp de quem está ao
 * backoffice, com o texto já escrito e na língua dele (`abrirWhatsAppNaLingua`).
 * Quem envia é a equipa. Sem telemóvel que abra no WhatsApp, não aparece.
 * As mensagens vivem em `mensagens-das-fases.ts`.
 */
export default function MensagemDaFase({
  telefone,
  texto,
  rotulo,
  titulo,
  classe = "flex items-center gap-1.5 rounded-lg border border-emerald-600/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10",
}: {
  telefone: string | null | undefined;
  texto: string;
  rotulo: string;
  titulo?: string;
  classe?: string;
}) {
  const { token } = useAdminAuth();
  const link = linkDeWhatsApp(telefone, texto);
  if (!link) return null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      title={titulo ?? "Abre o WhatsApp com a mensagem escrita. Não sai sozinha: fica à sua frente para enviar."}
      onClick={(e) => {
        e.preventDefault();
        void abrirWhatsAppNaLingua(telefone, texto, token);
      }}
      className={classe}
    >
      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {rotulo}
    </a>
  );
}
