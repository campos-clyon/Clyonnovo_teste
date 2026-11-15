import { lerARespostaDirecta, normalizar } from "./ler-a-resposta";

/*
 * O VALOR ÚNICO, PELO WHATSAPP — 15-11-2026 (d39, a parte da Vitória).
 *
 * Com o valor único enviado (a Mesa, «Enviar valor único ao cliente»), o
 * cliente responde à CLYON e é a CLYON quem escolhe o parceiro e aceita a
 * proposta DELE. A mensagem do valor único diz «Responda SIM para aceitar», e
 * a app de cliente abre o WhatsApp com «SIM, aceito o orçamento do pedido
 * #N.» (`app-cliente/src/lib/valor-unico.ts`).
 *
 * A Vitória lê isso — o «SIM» com o número, ou um «sim», «aceito», «pode ser»
 * quando há um só pedido com valor único por decidir — como a aceitação do
 * valor único DESSE pedido e passa a conversa à equipa: «O cliente aceitou o
 * valor único do pedido #N — escolher o parceiro». Nunca aceita uma proposta
 * de parceiro sozinha, e nunca diz nomes nem valores de propostas.
 *
 * Tudo o resto que ele responda a um valor único (um não, um valor, um nome)
 * também vai para a equipa: o caminho das propostas, que aceitava pelo SIM a
 * proposta de um parceiro, não é para estes pedidos.
 *
 * Puro: o cérebro (`whatsapp-negociacao.ts`) dá-lhe os pedidos com valor
 * único por decidir (`valor-unico-no-whatsapp-na-base.ts`), e os testes também.
 */

/** O que a Vitória diz a quem aceitou. Tem tradução fixa (traducoes-fixas-da-vitoria.json). */
export const VALOR_UNICO_ACEITE =
  "Obrigada pela confirmação! Passo já aos meus colegas, que escolhem o parceiro e lhe dizem tudo por aqui.";

/** A linha da Mesa das conversas — o motivo da passagem a uma pessoa. */
export function motivoDoValorUnicoAceite(pedidoId: number): string {
  return `O cliente aceitou o valor único do pedido #${pedidoId} — escolher o parceiro`;
}

export function motivoDaRespostaAoValorUnico(pedidoId: number): string {
  return `O cliente respondeu ao valor único do pedido #${pedidoId} sem o aceitar — falar com ele`;
}

/** «SIM, aceito o orçamento do pedido #812.» — o número do pedido, ou null. */
export function pedidoDaAceitacaoEscrita(texto: string | null | undefined): number | null {
  const t = normalizar(texto ?? "");
  const m = /\baceit\w*\s+(?:o\s+|a\s+)?(?:orcamento|valor(?:\s+unico)?|proposta|preco)\s+(?:do\s+|para\s+o\s+)?pedido\s*(?:n\.?\s*[oº]?\s*)?#?\s*(\d{1,7})\b/.exec(t);
  return m ? Number(m[1]) : null;
}

/** «sim», «aceito», «pode ser», «yes» — um sim sem valor nem nome. */
export function eUmSimAoValorUnico(texto: string | null | undefined): boolean {
  const t = normalizar(texto ?? "").replace(/[.!,]+$/, "").trim();
  if (!t) return false;
  if (/^(sim|s|yes|y|oui|si|ok|okay|aceito|aceitamos|aceite|pode ser|pode avancar|pode fechar|avancem?|esta bem|ta bem|combinado|de acordo|fechado|vamos a isso)(\s*[,!.]?\s*(aceito|aceitamos|pode ser|por favor|pode avancar|avancem?|esta bem|combinado|claro))*$/.test(t)) {
    return true;
  }
  const lida = lerARespostaDirecta(t);
  return lida?.tipo === "sim" && lida.valor == null;
}

export type DecisaoDoValorUnico =
  | { tipo: "aceite"; pedidoId: number }
  | { tipo: "pessoa"; motivo: string }
  | null;

/**
 * O QUE FAZER COM A MENSAGEM. `pendentes`: os pedidos deste número com valor
 * único enviado e por decidir. `null`: a mensagem não é com o valor único, e
 * segue como sempre.
 */
export function decidirOValorUnico(texto: string, pendentes: readonly number[]): DecisaoDoValorUnico {
  const escrito = pedidoDaAceitacaoEscrita(texto);
  if (escrito != null) {
    return pendentes.includes(escrito)
      ? { tipo: "aceite", pedidoId: escrito }
      : { tipo: "pessoa", motivo: `Disse que aceita o orçamento do pedido #${escrito}, sem valor único por decidir nesse pedido — confirmar` };
  }
  if (pendentes.length === 0) return null;
  if (eUmSimAoValorUnico(texto)) {
    return pendentes.length === 1
      ? { tipo: "aceite", pedidoId: pendentes[0] }
      : {
          tipo: "pessoa",
          motivo: `O cliente aceitou um valor único, e tem ${pendentes.length} pedidos com valor único (${pendentes.map((p) => `#${p}`).join(", ")}) — confirmar qual e escolher o parceiro`,
        };
  }
  // Um não, um valor ou um nome: era o caminho das propostas, e não é para estes pedidos.
  const lida = lerARespostaDirecta(normalizar(texto).replace(/[.!,]+$/, "").trim());
  if (lida) return { tipo: "pessoa", motivo: motivoDaRespostaAoValorUnico(pendentes[0]) };
  return null;
}
