/**
 * A LINHA DA APP NO AVISO DE PROPOSTAS — 24-11-2026 (d106, secção 0 da v3 da
 * d107). Puro: o nome do interruptor e o HTML da linha. A base está em
 * `linha-da-app-nas-propostas-na-base.ts`; o texto em
 * `textos-do-seguimento-da-app.ts` (LINHA_DA_APP_NO_AVISO_DE_PROPOSTAS_EMAIL).
 */

import { escaparHtml } from "./escapar-html";
import { linkDaRecusa, TEXTO_DA_RECUSA } from "./email-da-app-de-cliente";
import { LINHA_DA_APP_NO_AVISO_DE_PROPOSTAS_EMAIL } from "./textos-do-seguimento-da-app";

export const CHAVE_DA_LINHA_DA_APP = "linhaDaAppNoAvisoDePropostas";
export const NOME_DO_INTERRUPTOR_DA_LINHA_DA_APP = "A app no aviso de propostas";

/** O HTML da linha, para o fim do email «Tem uma proposta» (sem píxel, links nossos). */
export function htmlDaLinhaDaApp(link: string): string {
  const a = escaparHtml(link);
  const linhas = LINHA_DA_APP_NO_AVISO_DE_PROPOSTAS_EMAIL.map((l) =>
    escaparHtml(l).replace("{ligacao}", `<a href="${a}" style="color:#0891b2;word-break:break-all;">${a}</a>`),
  );
  return `<div style="margin:20px 0 0;padding:14px 0 0;border-top:1px solid #e2e8f0;">
        ${linhas.map((l) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#475569;">${l}</p>`).join("\n        ")}
        <p style="margin:8px 0 0;font-size:12px;line-height:1.6;"><a href="${escaparHtml(linkDaRecusa(link))}" style="color:#94a3b8;">${escaparHtml(TEXTO_DA_RECUSA)}</a></p>
      </div>`;
}
