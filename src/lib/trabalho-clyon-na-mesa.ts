/**
 * EM QUE BLOCO DA MESA FICA UM TRABALHO CLYON — 18-11-2026 (correcção da d55).
 *
 * *«Orçamentos novos» (era «Por decidir») = só o que ainda não foi a
 * ninguém.* Um Trabalho CLYON já foi oferecido a profissionais, por isso nunca
 * fica lá. Um cartão, um bloco:
 *
 *   · oferecido e ninguém aceitou ainda → «À espera de propostas» (n2);
 *   · há quem aceitou e falta escolher → «Precisa de si» (n1);
 *   · a proposta foi ao cliente e espera-se por ele → «A aguardar cliente»;
 *   · o cliente respondeu ao preço (aceitou, ou escreveu-nos depois) → volta a
 *     «Precisa de si», com a etiqueta «O cliente respondeu — escolher parceiro».
 *
 * Os outros blocos (feitos, com quem o faça, concluídos, arrumados) seguem o
 * bloco do próprio Trabalho CLYON (`blocoDoTrabalho`). Pura e sem imports.
 */

/** Os blocos do Trabalho CLYON (`Bloco` de TrabalhoClyon.tsx). */
export type BlocoDoTrabalhoClyon =
  | "feito"
  | "precisa"
  | "espera"
  | "atribuidos"
  | "concluidos"
  | "cancelados"
  | "arquivados";

/** Os blocos da Mesa onde um Trabalho CLYON pode cair — nunca o dos orçamentos novos. */
export type BlocoClyonNaMesa = "porConfirmar" | "n1" | "aguardaCliente" | "n2" | "n3" | "concluidos" | "cancelados";

export const BLOCO_DO_CLYON_NA_MESA: Record<BlocoDoTrabalhoClyon, Exclude<BlocoClyonNaMesa, "aguardaCliente">> = {
  feito: "porConfirmar",
  precisa: "n1",
  espera: "n2",
  atribuidos: "n3",
  concluidos: "concluidos",
  cancelados: "cancelados",
  arquivados: "cancelados",
};

export type TrabalhoClyonParaAMesa = {
  /** O pedido foi cancelado, arquivado ou rejeitado (`pedidoArrumado`). */
  arrumado: boolean;
  /** O bloco do próprio Trabalho CLYON (`blocoDoTrabalho`). */
  bloco: BlocoDoTrabalhoClyon | null;
  /** A fase da oferta (`resumo.fase`). */
  fase: string;
  propostaEnviadaEm?: string | null;
  precoAceiteEm?: string | null;
  /** O cliente respondeu mesmo ao preço — ver `clienteEscreveuDepoisDoPreco`. */
  clienteRespondeu?: boolean;
};

/** Falta escolher entre quem aceitou, e o cliente já respondeu: a etiqueta rosa. */
export function mostraOClienteRespondeu(t: TrabalhoClyonParaAMesa): boolean {
  return !t.arrumado && t.bloco === "precisa" && t.fase === "escolher" && !!(t.clienteRespondeu || t.precoAceiteEm);
}

export function blocoDoClyonNaMesa(t: TrabalhoClyonParaAMesa): BlocoClyonNaMesa | null {
  if (t.arrumado) return "cancelados";
  if (!t.bloco) return null;
  if (t.bloco === "precisa" && t.fase === "escolher") {
    if (mostraOClienteRespondeu(t)) return "n1";
    if (t.propostaEnviadaEm) return "aguardaCliente";
    return "n1";
  }
  return BLOCO_DO_CLYON_NA_MESA[t.bloco];
}
