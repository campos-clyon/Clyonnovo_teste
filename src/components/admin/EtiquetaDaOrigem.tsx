"use client";

import { origemPeloSlug } from "@/lib/acesso";

/*
 * DE ONDE O PEDIDO ENTROU — com o mapa da casa, e não com um só desta mesa.
 *
 * *«Os pedidos novos deviam mostrar a origem, ex: Wpp, Formulário, contacto,
 * Simulador.»* — 29-09-2026.
 *
 * Havia aqui uma cópia própria do mapa, e faltava-lhe o WhatsApp: os pedidos
 * registados pelo assistente caíam no «?? "Simulador"» do fim e apareciam
 * etiquetados como vindos do simulador. A lista de Pedidos usava outro mapa
 * — `origemPeloSlug`, em `acesso.ts` — que já tinha o WhatsApp desde
 * 15-09-2026. Duas listas, duas respostas para o mesmo pedido. Passa a haver
 * uma: a de `acesso.ts`, com as mesmas palavras nos dois ecrãs.
 *
 * A cor é só para se ler de relance numa lista comprida; a palavra é que diz.
 *
 * Num ficheiro dele desde 19-10-2026: os Trabalhos CLYON mostram-na também.
 */
const COR_DA_ORIGEM: Record<string, string> = {
  whatsapp: "border-emerald-600/50 text-emerald-300",
  hero_quote_form: "border-sky-600/50 text-sky-300",
  formulario_site: "border-sky-600/50 text-sky-300",
  formulario_contactos: "border-cyan-600/50 text-cyan-300",
  simulador: "border-violet-600/50 text-violet-300",
  quero_contratar: "border-amber-600/50 text-amber-300",
  quero_contratar_header: "border-amber-600/50 text-amber-300",
  plataforma: "border-red-600/60 text-red-300",
};

export default function EtiquetaDaOrigem({ slug }: { slug: string | null | undefined }) {
  const o = origemPeloSlug(slug);
  return (
    <span
      title="De onde entrou o pedido"
      className={`shrink-0 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
        COR_DA_ORIGEM[o.slug] ?? "border-slate-700 text-slate-400"
      }`}
    >
      {o.label}
    </span>
  );
}
