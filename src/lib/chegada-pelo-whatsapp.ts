import { normalizar, SIM_EXACTO, NAO_EXACTO } from "./ler-a-resposta";
import { clientePodeConfirmarChegada, viagemComConfirmacao, type Viagem } from "./viagem-ate-ao-cliente";

/**
 * A CHEGADA CONFIRMA-SE PELO WHATSAPP — ordem do CEO com o sim do dono,
 * 31-10-2026 (d3).
 *
 * Desde 30-10-2026 uma viagem marcada pela app Pro só se conclui depois de o
 * cliente confirmar a chegada (`viagem-ate-ao-cliente.ts`). O cliente do
 * WhatsApp recebia só «X chegou à sua morada», sem lhe pedirem nada, e a
 * Vitória não gravava nada: o trabalho ficava preso antes do «Está feito».
 *
 * Agora a mensagem do «Cheguei» acaba com `PECA_A_CONFIRMACAO_DA_CHEGADA`, e
 * nas `HORAS_PARA_CONFIRMAR_A_CHEGADA` seguintes um «SIM» (ou «já chegou»,
 * «está cá») grava a confirmação DESSE trabalho — o que tem o «Cheguei» por
 * confirmar no número dele, nunca outro pedido do mesmo número — e a Vitória
 * responde `CHEGADA_CONFIRMADA`. Dois trabalhos à espera ao mesmo tempo, ou
 * um «ainda não chegou», passam a uma pessoa.
 *
 * Puro de propósito: o teste «a conversa do cheguei» lê-o sem base.
 */

export const HORAS_PARA_CONFIRMAR_A_CHEGADA = 6;

/** A última linha do WhatsApp do «Cheguei». Tem tradução fixa (traducoes-fixas-da-vitoria.json). */
export const PECA_A_CONFIRMACAO_DA_CHEGADA = "Quando o vir, responda SIM para confirmar que chegou.";

/** A resposta da Vitória ao «SIM». Tem tradução fixa. */
export const CHEGADA_CONFIRMADA = "Obrigada! Fica confirmado — o parceiro já pode avançar.";

/** O que a Mesa lê quando o cliente diz que ele ainda não chegou. */
export function motivoDoAindaNaoChegou(pedidoId: number): string {
  return `O cliente diz que o parceiro ainda não chegou (pedido #${pedidoId})`;
}

/** O que a Mesa lê quando há duas chegadas por confirmar no mesmo número. */
export function motivoDeVariasChegadas(pedidos: number[]): string {
  return `Chegada por confirmar em ${pedidos.map((p) => `#${p}`).join(" e ")} — perguntar ao cliente qual`;
}

export type LeituraDaChegada = "confirma" | "ainda_nao" | null;

/*
 * As formas de dizer que ele chegou, escritas uma a uma (a mesma regra de
 * `ler-a-resposta.ts`: cada linha grava uma confirmação, e uma expressão que
 * cresce apanha por engano o contrário). Leem-se sem o «sim» da frente e sem o
 * «obrigado» do fim.
 */
const JA_CHEGOU = new Set([
  "chegou",
  "ja chegou",
  "ele chegou",
  "ele ja chegou",
  "o parceiro chegou",
  "o parceiro ja chegou",
  "chegaram",
  "ja chegaram",
  "esta ca",
  "ja esta ca",
  "ele esta ca",
  "ele ja esta ca",
  "ja ca esta",
  "esta aqui",
  "ja esta aqui",
  "ele esta aqui",
  "ele ja esta aqui",
  "estao ca",
  "ja estao ca",
  "estao aqui",
  "ja estao aqui",
  "confirmo",
  "confirmado",
  "confirmo que chegou",
  "ja o vi",
  "ja os vi",
  "ja vi",
  "esta confirmado",
]);

function limpar(texto: string): string {
  return normalizar(texto)
    .replace(/[\p{Extended_Pictographic}\p{Cf}]/gu, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lê a resposta ao «responda SIM para confirmar que chegou». Null = não é sobre a chegada. */
export function lerAChegada(texto: string): LeituraDaChegada {
  const t = limpar(texto);
  if (!t || t.length > 60) return null;
  if (NAO_EXACTO.has(t) || /^(ainda nao|nao chegou|ainda nao chegou|ninguem chegou|nao esta ca|nao esta aqui|nao vejo ninguem|nao o vejo|ainda nao o vi|ainda nao vi ninguem|nao nao chegou)( ninguem)?$/.test(t)) {
    return "ainda_nao";
  }
  // «Sim obrigada», «sim, já chegou, obrigado».
  const semFim = t.replace(/\s+(obrigad[oa]s?|obg|muito obrigad[oa])$/, "").trim();
  if (SIM_EXACTO.has(semFim)) return "confirma";
  const semSim = semFim.replace(/^(sim|yes|oui|si)\s+/, "").trim();
  if (JA_CHEGOU.has(semSim)) return "confirma";
  return null;
}

export type ChegadaPorConfirmar = Viagem & {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  ofertaClyon: string | null;
  valorFixoClyon: string | number | null;
};

/**
 * DE QUE TRABALHO É O «SIM». Só os que pedem a confirmação (viagem pela app,
 * depois do corte, fora dos Trabalhos CLYON) e que ainda a não têm. Um só →
 * esse; dois ou mais → ninguém adivinha, passa a uma pessoa; nenhum → o «SIM»
 * não é sobre a chegada e segue o caminho de sempre.
 */
export function escolherAChegada(
  candidatos: ChegadaPorConfirmar[],
): { tipo: "um"; chegada: ChegadaPorConfirmar } | { tipo: "varios"; pedidos: number[] } | null {
  const vivos = candidatos.filter(
    (c) => viagemComConfirmacao(c, c.ofertaClyon != null || c.valorFixoClyon != null) && clientePodeConfirmarChegada(c),
  );
  if (vivos.length === 0) return null;
  if (vivos.length === 1) return { tipo: "um", chegada: vivos[0] };
  return { tipo: "varios", pedidos: [...new Set(vivos.map((c) => c.pedidoId))] };
}
