"use client";

import { numeroParaWhatsApp } from "@/lib/link-de-whatsapp";
import { telefoneLegivel } from "@/lib/telefone-legivel";

/**
 * O TELEMÓVEL DO CLIENTE ABRE O WHATSAPP DELE — 21-10-2026. *«Coloque o link
 * no número dos clientes; ao clicar vai direto para o WhatsApp deles.»* — o dono.
 *
 * Abre a conversa (`wa.me`, sem texto) noutro separador. O número vai pela
 * regra de sempre (`numeroParaWhatsApp`): um que não dá para lá chegar fica só
 * escrito, em vez de abrir a conversa de um estranho. O clique fica no número —
 * não abre nem fecha o cartão por baixo dele.
 */
export default function TelefoneComWhatsApp({
  telefone,
  className = "",
}: {
  telefone: string | null | undefined;
  className?: string;
}) {
  const escrito = telefoneLegivel(telefone) || (telefone ?? "").trim();
  if (!escrito) return null;
  const numero = numeroParaWhatsApp(telefone);
  if (!numero) return <span className={className}>{escrito}</span>;
  return (
    <a
      href={`https://wa.me/${numero}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Abrir a conversa no WhatsApp"
      className={`${className} underline decoration-dotted underline-offset-2 hover:text-emerald-300`}
    >
      {escrito}
    </a>
  );
}
