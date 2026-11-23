import { diaMesEmLisboa } from "./hora-de-lisboa";
import { totalAoClienteDaNegociacao, type LinhaParaOTotal } from "./total-ao-cliente";
import {
  AINDA_NAO_RECEBI,
  O_CLIENTE_JA_ME_PAGOU,
  SIM_RECEBI,
  estadoDoRegisto,
  lerFormaDita,
  perguntaAoParceiro,
  registoDoPagamento,
  type LinhaDoRegisto,
  type RegistoDoPagamento,
} from "./pagamento-registado";

/**
 * O QUE O PARCEIRO LÊ DO PAGAMENTO — d3 (23-11-2026). A mesma frase e os mesmos
 * botões no painel e na app CLYON Pro (que a lêem desta resposta):
 *
 *   · o cliente disse que pagou → «O cliente diz que lhe pagou {total} por {forma}.
 *     Recebeu?» com «Sim, recebi» / «Ainda não recebi»;
 *   · ainda ninguém disse nada → «O cliente já me pagou» (marca ele primeiro);
 *   · «Ainda não recebi» já dito → a frase fica, só «Sim, recebi»;
 *   · «Pago a {parceiro} · dd/mm» depois do «Recebi».
 */
export type PagamentoParaOParceiro = {
  registo: RegistoDoPagamento;
  /** A frase que ele lê: a pergunta, ou «Pago · dd/mm», ou nada ainda. */
  texto: string | null;
  /** Os botões que pode carregar agora, com o que cada um envia (`accao`). */
  botoes: Array<{ accao: "recebi" | "nao_recebi"; texto: string }>;
};

export function pagamentoRegistadoParaOParceiro(
  l: LinhaParaOTotal & LinhaDoRegisto,
  acordado: number | null,
  reservaCent = 0,
): PagamentoParaOParceiro {
  const registo = registoDoPagamento(l);
  const total = totalAoClienteDaNegociacao({ ...l, reservaCent: reservaCent || l.reservaCent }, acordado)?.total ?? null;
  const estado = estadoDoRegisto(l);
  if (estado === "pago") {
    const quando = registo.parceiroConfirmouEm ? " · " + diaMesEmLisboa(new Date(registo.parceiroConfirmouEm)) : "";
    return { registo, texto: "Pago" + quando, botoes: [] };
  }
  if (estado === "cliente_disse") {
    return {
      registo,
      texto: perguntaAoParceiro(total, lerFormaDita(l.formaDita)),
      botoes: [
        { accao: "recebi", texto: SIM_RECEBI },
        { accao: "nao_recebi", texto: AINDA_NAO_RECEBI },
      ],
    };
  }
  if (estado === "em_duvida") {
    return {
      registo,
      texto: `Disse que ainda não recebeu. ${perguntaAoParceiro(total, lerFormaDita(l.formaDita))}`,
      botoes: [{ accao: "recebi", texto: SIM_RECEBI }],
    };
  }
  return { registo, texto: null, botoes: [{ accao: "recebi", texto: O_CLIENTE_JA_ME_PAGOU }] };
}
