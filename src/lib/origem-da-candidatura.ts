import type { OrigemDaVisita } from "./origem-da-visita";
import { CANAIS, PAGINAS, letraDoCanal, numeroDaPagina, type LetraDoCanal } from "./codigo-de-origem";
import { caminhoDoSite } from "./pagina-anterior";

/*
 * DE ONDE VEIO QUEM SE CANDIDATA — 31-10-2026 (d6 de 28-10, aprovada pelo
 * dono e pelo CEO).
 *
 * A candidatura não guardava a origem: nenhum canal de recrutamento (grupos,
 * Instagram, anúncios, o Google) se conseguia medir. Agora leva o mesmo que um
 * pedido (a campanha e o site que mandou, de `origem-da-visita.ts`) e um código
 * como o «(A1)» do WhatsApp (`codigo-de-origem.ts`): a LETRA diz por onde a
 * pessoa chegou ao site, o NÚMERO diz a página de onde veio para a candidatura
 * (0 quando entrou direto nela, por exemplo pelo link de um post).
 *
 * Sem o gclid: identifica um clique, e a candidatura não precisa dele. Nada
 * aqui identifica a pessoa.
 */

export type OrigemDaCandidatura = {
  /** «F0», «G2»… — letra do canal + número da página (legenda em codigo-de-origem.ts). */
  codigo: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** O site de fora que mandou a visita. */
  referrer?: string;
  /** A primeira página dessa visita. */
  entrada?: string;
  /** A página do site de onde veio para a candidatura. */
  vindoDe?: string;
};

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const CODIGO = /^[AGFIOD]\d$/;

function texto(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 120);
  return t === "" ? undefined : t;
}

/** No browser: a origem da visita e a página anterior, no molde da candidatura. */
export function origemParaACandidatura(visita: OrigemDaVisita | null, anterior: string | null): OrigemDaCandidatura {
  const vindoDe = caminhoDoSite(anterior) ?? undefined;
  const entrada = caminhoDoSite(visita?.entrada) ?? undefined;
  const o: OrigemDaCandidatura = {
    codigo: `${letraDoCanal(visita)}${vindoDe ? numeroDaPagina(vindoDe) : 0}`,
  };
  for (const c of UTM) {
    const v = texto(visita?.[c]);
    if (v) o[c] = v;
  }
  const referrer = texto(visita?.referrer);
  if (referrer) o.referrer = referrer;
  if (entrada) o.entrada = entrada;
  if (vindoDe) o.vindoDe = vindoDe;
  return o;
}

/**
 * No servidor: o que chegou no corpo, só com o que se conhece e do tamanho
 * certo. Um código que não é código deita fora a origem toda — melhor nenhuma
 * do que uma inventada.
 */
export function limparOrigemDaCandidatura(v: unknown): OrigemDaCandidatura | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const f = v as Record<string, unknown>;
  const codigo = typeof f.codigo === "string" ? f.codigo.trim().toUpperCase() : "";
  if (!CODIGO.test(codigo)) return null;
  const o: OrigemDaCandidatura = { codigo };
  for (const c of UTM) {
    const t = texto(f[c]);
    if (t) o[c] = t;
  }
  const referrer = texto(f.referrer);
  if (referrer) o.referrer = referrer;
  const entrada = caminhoDoSite(f.entrada);
  if (entrada) o.entrada = entrada;
  const vindoDe = caminhoDoSite(f.vindoDe);
  if (vindoDe) o.vindoDe = vindoDe;
  return o;
}

/** A origem guardada na base (JSON), ou null. */
export function origemGuardada(json: unknown): OrigemDaCandidatura | null {
  if (typeof json !== "string" || json.trim() === "") return null;
  try {
    return limparOrigemDaCandidatura(JSON.parse(json));
  } catch {
    return null;
  }
}

/**
 * Para o backoffice: «Facebook · campanha recrutamento (grupo) · veio da
 * Página inicial · F2». Sem origem, null.
 */
export function lerOrigemDaCandidatura(o: OrigemDaCandidatura | null): string | null {
  if (!o) return null;
  const letra = o.codigo[0] as LetraDoCanal;
  const partes: string[] = [CANAIS[letra] ?? o.codigo];
  const meio = o.utm_medium && !["organic", "referral"].includes(o.utm_medium) ? o.utm_medium : null;
  if (o.utm_campaign) partes.push(`campanha ${o.utm_campaign}${meio ? ` (${meio})` : ""}`);
  else if (meio) partes.push(meio);
  // «Outro site» diz qual; nos outros canais o nome já o diz.
  if (letra === "O") {
    const quem = o.referrer ?? o.utm_source;
    if (quem) partes.push(`por ${quem}`);
  }
  partes.push(o.vindoDe ? `veio de: ${PAGINAS[numeroDaPagina(o.vindoDe)]} (${o.vindoDe})` : "entrou direto na página da candidatura");
  partes.push(o.codigo);
  return partes.join(" · ");
}
