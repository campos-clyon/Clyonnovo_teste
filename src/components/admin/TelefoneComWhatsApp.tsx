"use client";

import type { ReactNode } from "react";
import { numeroParaWhatsApp } from "@/lib/link-de-whatsapp";
import { telefoneLegivel } from "@/lib/telefone-legivel";

/**
 * O TELEMÓVEL ABRE O WHATSAPP — 21-10-2026. *«Coloque o link no número dos
 * clientes; ao clicar vai direto para o WhatsApp deles.»* E no mesmo dia:
 * *«coloque o link do WhatsApp também nos profissionais.»* — o dono.
 *
 * Abre a conversa (`wa.me`, sem texto) noutro separador. O número vai pela
 * regra de sempre (`numeroParaWhatsApp`): um que não dá para lá chegar — um
 * fixo, um estrangeiro sem indicativo — continua a ligar (`tel:`), em vez de
 * abrir a conversa de um estranho. O clique fica no número: não abre nem fecha
 * o cartão por baixo dele.
 *
 * `icone` vai à frente; `children` troca o número por outro texto (na Agenda
 * o botão diz o primeiro nome).
 */
export default function TelefoneComWhatsApp({
  telefone,
  className = "",
  icone,
  children,
}: {
  telefone: string | null | undefined;
  className?: string;
  icone?: ReactNode;
  children?: ReactNode;
}) {
  const escrito = telefoneLegivel(telefone) || (telefone ?? "").trim();
  if (!escrito) return null;
  const numero = numeroParaWhatsApp(telefone);
  const conteudo = (
    <>
      {icone}
      {children ?? escrito}
    </>
  );
  // A cor ao passar o rato é a de quem chama, quando a traz.
  const passar = /\bhover:text-/.test(className) ? "" : " hover:text-emerald-300";
  const sublinhado = children ? "" : " underline decoration-dotted underline-offset-2";
  if (!numero) {
    return (
      <a
        href={`tel:${(telefone ?? "").replace(/\s/g, "")}`}
        onClick={(e) => e.stopPropagation()}
        title="Ligar — este número não abre no WhatsApp"
        className={`${className}${passar}`}
      >
        {conteudo}
      </a>
    );
  }
  return (
    <a
      href={`https://wa.me/${numero}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Abrir a conversa no WhatsApp"
      className={`${className}${sublinhado}${passar}`}
    >
      {conteudo}
    </a>
  );
}
