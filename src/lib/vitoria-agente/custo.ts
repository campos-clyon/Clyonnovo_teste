/**
 * O CUSTO DA VITÓRIA AGENTE — d85, fase 0 (22-11-2026). PURO.
 *
 * O modelo que conversa e age é o Claude Sonnet 5.5 (decisão do CEO e do dono
 * a 22-11-2026); o Gemini fica nas fotografias, no áudio, no tradutor e na
 * leitura. Aqui: os preços por milhão de tokens (em dólares, como a Anthropic
 * os cobra), a conta de uma chamada e o tecto diário. Passado o tecto, o
 * agente desliga-se até ao dia seguinte (de Lisboa) e tudo volta às regras.
 */

/** O modelo, exactamente como a API o quer (sem data). */
export const MODELO_DA_VITORIA_AGENTE = "claude-sonnet-5-5";

/** A beta da recolha pelo servidor quando o modelo recusa (`fallbacks: "default"`). */
export const BETA_DA_RECOLHA = "server-side-fallback-2026-07-01";

/**
 * O esforço por omissão. Era «low» (d85); desde a d92 (23-11-2026) «medium»: o
 * dono quer qualidade («podemos pagar mais qualidade»; ~0,6 cêntimos por
 * chamada em «low»), e as voltas da fase 4 têm várias ferramentas seguidas
 * (ler as propostas, identificar, propor o fecho). Os scripts de medição e de
 * avaliação comparam «low» e «medium» para o CEO confirmar pela qualidade.
 */
export const ESFORCO_POR_OMISSAO = "medium" as const;
export type EsforcoDoAgente = "low" | "medium";

/** Dólares por milhão de tokens — Claude Sonnet 5.5 (a cache de 5 minutos). */
export const PRECO_POR_MILHAO_USD = Object.freeze({
  entrada: 2,
  saida: 10,
  cacheLido: 0.1,
  cacheEscrito: 2.5,
});

/** O tecto por omissão, em dólares por dia de Lisboa. Muda-se nas Configs. */
export const TECTO_DIARIO_POR_OMISSAO_USD = 10;
/** Nunca mais do que isto por dia, nem com um engano nas Configs. */
export const TECTO_DIARIO_MAXIMO_USD = 100;

/** O uso de uma chamada, como a API o devolve (os campos que contam para a conta). */
export type UsoDaChamada = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export type UsoSomado = {
  entrada: number;
  saida: number;
  cacheLidos: number;
  cacheEscritos: number;
};

export const USO_VAZIO: UsoSomado = Object.freeze({ entrada: 0, saida: 0, cacheLidos: 0, cacheEscritos: 0 });

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** O uso de uma chamada nos nossos nomes. */
export function usoDe(u: UsoDaChamada | null | undefined): UsoSomado {
  return {
    entrada: n(u?.input_tokens),
    saida: n(u?.output_tokens),
    cacheLidos: n(u?.cache_read_input_tokens),
    cacheEscritos: n(u?.cache_creation_input_tokens),
  };
}

export function somarUsos(a: UsoSomado, b: UsoSomado): UsoSomado {
  return {
    entrada: a.entrada + b.entrada,
    saida: a.saida + b.saida,
    cacheLidos: a.cacheLidos + b.cacheLidos,
    cacheEscritos: a.cacheEscritos + b.cacheEscritos,
  };
}

/** Quanto custou, em dólares (arredondado ao milionésimo). */
export function custoEmUsd(u: UsoSomado): number {
  const p = PRECO_POR_MILHAO_USD;
  const usd =
    (u.entrada * p.entrada + u.saida * p.saida + u.cacheLidos * p.cacheLido + u.cacheEscritos * p.cacheEscrito) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/**
 * Um tecto escrito nas Configs: um número de dólares entre 0 e o máximo.
 * Inválido = null — e NADA escrito (sem linha, null, «» ou só espaços) também
 * é null: `Number("")` é 0, e um 0 que ninguém escreveu travava o agente para
 * sempre. Um «0» escrito de propósito continua a valer (= desligado).
 */
export function tectoValido(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== "number" && String(v).trim() === "") return null;
  const t = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
  if (!Number.isFinite(t) || t < 0 || t > TECTO_DIARIO_MAXIMO_USD) return null;
  return Math.round(t * 100) / 100;
}

/** O tecto que vale, a partir do que está nas Configs: sem nada escrito ou inválido, o de omissão. */
export function tectoDasConfigs(valorEscrito: unknown): number {
  return tectoValido(valorEscrito) ?? TECTO_DIARIO_POR_OMISSAO_USD;
}

/** Ainda se pode gastar hoje? Pura: o gasto do dia contra o tecto. */
export function dentroDoTecto(gastoDeHojeUsd: number, tectoUsd: number): boolean {
  return Number.isFinite(gastoDeHojeUsd) && gastoDeHojeUsd < tectoUsd;
}

/** O custo do mês projectado: a média por conversa vezes as conversas do mês. */
export function custoMensalProjectado(custosPorConversa: readonly number[], conversasPorMes: number): number {
  const validos = custosPorConversa.filter((c) => Number.isFinite(c) && c >= 0);
  if (validos.length === 0 || !(conversasPorMes > 0)) return 0;
  const media = validos.reduce((s, c) => s + c, 0) / validos.length;
  return Math.round(media * conversasPorMes * 100) / 100;
}
