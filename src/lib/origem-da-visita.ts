import { lerConsentimentoGuardado } from "@/lib/cookie-consent";

/*
 * DE ONDE VEIO QUEM FEZ O PEDIDO — 14-10-2026.
 *
 * As UTM e o gclid só se guardavam na página dos anúncios, e nenhum pedido os
 * levava: o backoffice não sabia se um pedido vinha do Google, de um anúncio,
 * do Facebook ou de quem já conhecia o site. Os eventos de clique liam as UTM
 * do endereço da página onde se clicava — que, duas páginas depois da
 * entrada, já não as tem.
 *
 * Guarda-se a origem da última visita que trouxe uma (campanha, gclid, ou um
 * site de fora a mandar), durante 90 dias — a validade do gclid no Google
 * Ads —, e junta-se a cada pedido e a cada evento de contacto.
 *
 * O gclid identifica um clique num anúncio: só sai daqui com o consentimento
 * de marketing. As UTM dizem o nome de uma campanha, não de uma pessoa.
 */

export type OrigemDaVisita = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  /** A primeira página vista nessa visita. */
  entrada?: string;
  /** O site que a mandou, quando foi um site de fora. */
  referrer?: string;
  /** Quando se guardou, em ISO. */
  quando: string;
};

export const CHAVE_DA_ORIGEM = "clyon_origem";
export const VALIDADE_DA_ORIGEM_DIAS = 90;

const CAMPOS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"] as const;

/** Os motores de busca, para chamar «organic» a quem veio deles sem campanha. */
const MOTORES = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|brave)\./i;

function hostDe(endereco: string): string | null {
  try {
    return new URL(endereco).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * A origem que uma entrada traz, ou null se não traz nenhuma.
 *
 * Campanha ou gclid no endereço ganham sempre. Sem eles, um site de fora a
 * mandar conta como origem (motor de busca = «organic», o resto =
 * «referral»). Vir do próprio site, ou de lado nenhum, não é origem.
 */
export function origemDaEntrada(
  search: string,
  referrer: string,
  caminho: string,
  agora: Date,
  nossoHost = "clyon.pt",
): OrigemDaVisita | null {
  const params = new URLSearchParams(search);
  const daCampanha: Partial<OrigemDaVisita> = {};
  for (const c of CAMPOS) {
    const v = params.get(c);
    if (v) daCampanha[c] = v.slice(0, 200);
  }
  const host = referrer ? hostDe(referrer) : null;
  const deFora = host && host !== nossoHost && !host.endsWith(`.${nossoHost}`) ? host : null;

  if (Object.keys(daCampanha).length > 0) {
    return { ...daCampanha, entrada: caminho, ...(deFora ? { referrer: deFora } : {}), quando: agora.toISOString() };
  }
  if (deFora) {
    return {
      utm_source: deFora.replace(/^www\./, ""),
      utm_medium: MOTORES.test(deFora) ? "organic" : "referral",
      entrada: caminho,
      referrer: deFora,
      quando: agora.toISOString(),
    };
  }
  return null;
}

/** A guardada, se ainda valer. */
export function origemAindaValida(guardada: OrigemDaVisita | null, agora: Date): OrigemDaVisita | null {
  if (!guardada?.quando) return null;
  const idade = agora.getTime() - new Date(guardada.quando).getTime();
  if (!Number.isFinite(idade) || idade < 0) return null;
  return idade <= VALIDADE_DA_ORIGEM_DIAS * 24 * 60 * 60 * 1000 ? guardada : null;
}

function lerGuardada(): OrigemDaVisita | null {
  try {
    const cru = window.localStorage.getItem(CHAVE_DA_ORIGEM);
    return cru ? (JSON.parse(cru) as OrigemDaVisita) : null;
  } catch {
    return null;
  }
}

/** Chamar uma vez por entrada no site. Uma campanha nova substitui a antiga. */
export function guardarOrigemDaVisita(): void {
  if (typeof window === "undefined") return;
  const agora = new Date();
  const nova = origemDaEntrada(window.location.search, document.referrer, window.location.pathname, agora, window.location.hostname.replace(/^www\./, ""));
  if (!nova) return;
  // Um site de fora não apaga uma campanha que ainda vale: quem clicou num
  // anúncio e voltou pelo Google continua a ser do anúncio.
  const temCampanha = Boolean(nova.utm_campaign || nova.gclid || (nova.utm_medium && !["organic", "referral"].includes(nova.utm_medium)));
  const antiga = origemAindaValida(lerGuardada(), agora);
  if (!temCampanha && antiga) return;
  try {
    window.localStorage.setItem(CHAVE_DA_ORIGEM, JSON.stringify(nova));
  } catch {
    /* sem armazenamento: o pedido vai sem origem */
  }
}

/**
 * A origem para juntar a um pedido ou a um evento — sem o gclid, a quem não
 * deu consentimento de marketing.
 */
export function origemDaVisita(): OrigemDaVisita | null {
  if (typeof window === "undefined") return null;
  const valida = origemAindaValida(lerGuardada(), new Date());
  if (!valida) return null;
  if (valida.gclid && !lerConsentimentoGuardado().marketing) {
    const semGclid: OrigemDaVisita = { ...valida };
    delete semGclid.gclid;
    return semGclid;
  }
  return valida;
}
