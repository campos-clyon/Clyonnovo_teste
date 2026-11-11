/**
 * «CONFIRMO: FAÇO POR X/H + IVA», NA APP — 11-11-2026 (d6).
 *
 * Numa mudança em que o cliente o escolheu, a primeira resposta é um toque: a
 * hora dele, que ficou guardada no pedido, vai como proposta num só pedido à
 * rota da negociação — SEM valor (o servidor lê a hora congelada). Ao lado,
 * «Propor um valor mais baixo»; por baixo, «Não estou interessado». A partir
 * da segunda proposta volta o ecrã da negociação de sempre.
 *
 * A APP NÃO ESCREVE FRASES: os botões e as regras vêm de
 * `mudancaEscolhida.primeiraResposta` (rota `meus-pedidos`), a frase de depois
 * vem da resposta da rota (`texto`), e a de quando não há resposta nenhuma é a
 * da lib do site (`ERROS_DO_ESCOLHIDO.rede`) — as mesmas do painel
 * (`ConfirmarAHora.tsx`).
 *
 * Puro (sem React Native): o ecrã entrega-lhe o `pedir`, e os testes do site
 * um servidor de mentira que cumpre o contrato.
 */
import type { MudancaEscolhida } from "../../../src/lib/mudanca-escolhida-pelo-cliente";
import { ERROS_DO_ESCOLHIDO } from "../../../src/lib/escolhidos-sem-resposta";

export const ROTA_DA_NEGOCIACAO = "/api/profissionais/negociacao";

export type TextosDaPrimeiraResposta = NonNullable<MudancaEscolhida["primeiraResposta"]>;

/** A forma do `pedir` da app (`api.ts`), só com o que isto usa. */
export type PedirDaApp = <T>(caminho: string, opcoes?: { metodo?: "POST"; corpo?: unknown }) => Promise<T>;

/**
 * Os textos da primeira resposta, ou null quando o ecrã é o da negociação de
 * sempre: já respondeu (a rota manda null), a negociação já não está aberta,
 * ou não é uma mudança em que o cliente o escolheu.
 */
export function primeiraRespostaDe(t: { estado: string; mudancaEscolhida?: MudancaEscolhida | null }): TextosDaPrimeiraResposta | null {
  if (t.estado !== "aberta") return null;
  const p = t.mudancaEscolhida?.primeiraResposta ?? null;
  return p && typeof p.accao === "string" && p.accao && typeof p.confirmar === "string" && p.confirmar ? p : null;
}

/** O que ele ia fazer: confirmar a hora, propor um valor mais baixo, ou sair. */
export type RespostaDoEscolhido = { tipo: "confirmar" } | { tipo: "propor"; valor: number } | { tipo: "desistir" };

/** O corpo do pedido à rota. Confirmar NUNCA leva valor: é o servidor que lê a hora guardada. */
export function corpoDaResposta(
  negociacaoId: number,
  textos: Pick<TextosDaPrimeiraResposta, "accao">,
  r: RespostaDoEscolhido,
  avisosAceites = false,
): Record<string, unknown> {
  if (r.tipo === "confirmar") return { negociacaoId, accao: textos.accao, avisosAceites };
  if (r.tipo === "propor") return { negociacaoId, accao: "propor", valor: r.valor, avisosAceites };
  return { negociacaoId, accao: "desistir", avisosAceites };
}

export type ResultadoDaResposta =
  /** Correu bem: a frase que fica no lugar dos botões (a da rota), ou null se a rota não a mandou. */
  | { ok: true; texto: string | null; confirmou: boolean; depoisDoPrazo: boolean }
  /** O servidor quer que ele leia os avisos antes de se comprometer (409 com `avisos`). */
  | { ok: false; avisos: string[] }
  /** Recusou: a frase da rota (ou a de sem rede) e se os botões saem do ecrã. */
  | { ok: false; avisos?: undefined; erro: string; semBotoes: boolean };

/** O erro da API da app, lido pela forma (este ficheiro não importa o `api.ts`, que traz a Expo). */
function erroDaApi(e: unknown): { message: string; estado: number; corpo: Record<string, unknown> } | null {
  const x = e as { message?: unknown; estado?: unknown; corpo?: unknown } | null;
  if (!x || typeof x !== "object" || typeof x.estado !== "number") return null;
  return {
    message: typeof x.message === "string" ? x.message : "",
    estado: x.estado,
    corpo: x.corpo && typeof x.corpo === "object" ? (x.corpo as Record<string, unknown>) : {},
  };
}

/** A recusa da rota, como o ecrã a mostra. */
export function lerRecusa(e: unknown): Exclude<ResultadoDaResposta, { ok: true }> {
  const api = erroDaApi(e);
  if (!api) return { ok: false, erro: ERROS_DO_ESCOLHIDO.rede, semBotoes: false };
  const avisos = api.corpo.avisos;
  if (api.estado === 409 && Array.isArray(avisos) && avisos.length > 0) {
    return { ok: false, avisos: avisos.filter((a): a is string => typeof a === "string") };
  }
  return {
    ok: false,
    erro: api.message || ERROS_DO_ESCOLHIDO.rede,
    // Contratado a outro, cancelado ou fechado: já não há nada a responder aqui.
    semBotoes: api.corpo.semBotoes === true || api.corpo.jaDecidido === true,
  };
}

/** UM PEDIDO SÓ: a resposta dele vai à rota, e volta a frase (ou a recusa). Nunca lança. */
export async function responderComoEscolhido(
  pedir: PedirDaApp,
  negociacaoId: number,
  textos: Pick<TextosDaPrimeiraResposta, "accao">,
  r: RespostaDoEscolhido,
  avisosAceites = false,
): Promise<ResultadoDaResposta> {
  try {
    const dados = await pedir<Record<string, unknown>>(ROTA_DA_NEGOCIACAO, {
      metodo: "POST",
      corpo: corpoDaResposta(negociacaoId, textos, r, avisosAceites),
    });
    return {
      ok: true,
      texto: typeof dados?.texto === "string" && dados.texto ? dados.texto : null,
      confirmou: dados?.confirmou === true,
      depoisDoPrazo: dados?.depoisDoPrazo === true,
    };
  } catch (e) {
    return lerRecusa(e);
  }
}

/** O valor mais baixo cabe na hora dele? (A guarda é do servidor; isto só decide se se mostra o que recebe.) */
export function cabeNaHora(valor: number | null, hora: number): valor is number {
  return valor != null && Number.isFinite(valor) && valor > 0 && Math.round(valor * 100) <= Math.round(hora * 100);
}
