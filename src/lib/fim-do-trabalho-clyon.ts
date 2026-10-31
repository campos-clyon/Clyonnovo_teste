import { faseParaOCliente } from "./trabalho";
import { isoOuNulo, quandoEmLisboa } from "./pedido-para-a-app";
import { sePagaPelaNegociacao } from "./trabalho-clyon-paga-se";

/**
 * O FIM DE UM TRABALHO CLYON, PARA O CLIENTE — d6, 31-10-2026.
 *
 * Num Trabalho CLYON, a app e o link do pedido ficavam calados depois de
 * «O trabalho é feito por …»:
 * o cliente não via o dia, não pagava nem avaliava. Agora, pela ordem de uma
 * negociação: o dia combinado (o da Agenda), o pagamento (a referência que o
 * backoffice gerou, ou pagar sozinho), «A CLYON confirma consigo quando o
 * trabalho estiver feito» e, depois de confirmado, «Como correu com {nome}?».
 *
 * SÓ A PARTE DO CLIENTE. A negociação de um Trabalho CLYON é o que a CLYON
 * paga ao profissional: daqui não sai o valor dele, a taxa, nem o telefone.
 * Sai o id dela (é por ela que se paga e se avalia), a fase, as datas e os
 * textos — uma lista fechada de campos, escrita aqui. O dinheiro vem à parte,
 * do mesmo estado do pagamento das outras portas (o preço ao cliente, com
 * IVA), e só no modelo com taxa: nos antigos o valor da negociação era o do
 * profissional, e esses continuam a pagar-se pela referência que a CLYON envia.
 */

export const A_CLYON_CONFIRMA = "A CLYON confirma consigo quando o trabalho estiver feito.";
export const quemFazOTrabalhoClyon = (nome: string) => `O trabalho é feito por ${nome}, parceiro verificado na CLYON.`;
export const perguntaDaAvaliacao = (nome: string) => `Como correu com ${nome}?`;
export const O_PARCEIRO_COMBINA_O_DIA = "A CLYON combina o dia consigo e diz-lho aqui.";

/** O que se lê de uma linha crua de `negociacoes` (a de quem ficou com o trabalho). */
export type LinhaDoTrabalhoClyon = {
  id: number;
  estado: string;
  /** Só para conferir que é o preço ao cliente (nunca sai). */
  valorAcordado?: unknown;
  profissionalNome?: unknown;
  dataCombinada?: Date | string | null;
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
  estrelas?: unknown;
  avaliadoEm?: Date | string | null;
  avaliacaoOrigem?: unknown;
  ofertaClyon?: unknown;
};

export type FimDoTrabalhoClyon = {
  negociacaoId: number;
  profissional: string;
  fase: string;
  dataCombinada: string | null;
  dataCombinadaTexto: string | null;
  confirmadoEm: string | null;
  confirmadoEmTexto: string | null;
  /** Pode pagar pela app ou pelo link (o modelo com taxa: o valor da negociação é o preço dele). */
  podePagar: boolean;
  /** A nota que ELE deu, quando deu (as da equipa não contam como dele). */
  estrelas: number | null;
  podeAvaliar: boolean;
  textos: { quemFaz: string; dia: string; aClyonConfirma: string | null; pergunta: string };
};

/** Uma avaliação da equipa: marcada como tal, ou de antes de 31-10 num trabalho que nasceu de uma oferta. */
function daEquipa(l: LinhaDoTrabalhoClyon): boolean {
  if (l.avaliacaoOrigem === "equipa") return true;
  return (l.avaliacaoOrigem == null || l.avaliacaoOrigem === "") && typeof l.ofertaClyon === "string" && l.ofertaClyon.trim() !== "";
}

export function fimDoTrabalhoClyonParaOCliente(
  pedido: { valorFixoClyon?: unknown; taxaClyon?: unknown },
  cruas: readonly LinhaDoTrabalhoClyon[],
): FimDoTrabalhoClyon | null {
  if (pedido.valorFixoClyon == null) return null;
  const a = cruas.find((n) => n.estado === "acordada");
  if (!a) return null;
  const nome = String(a.profissionalNome ?? "").trim() || "o parceiro";
  const fase = faseParaOCliente({ estado: a.estado, execucaoEnviadaEm: a.execucaoEnviadaEm, confirmadoEm: a.confirmadoEm, pagoEm: a.pagoEm });
  const confirmado = fase === "confirmado" || fase === "pago";
  const avaliadoPeloCliente = a.avaliadoEm != null && !daEquipa(a);
  const dataCombinadaTexto = quandoEmLisboa(a.dataCombinada ?? null);
  return {
    negociacaoId: Number(a.id),
    profissional: nome,
    fase,
    dataCombinada: isoOuNulo(a.dataCombinada ?? null),
    dataCombinadaTexto,
    confirmadoEm: isoOuNulo(a.confirmadoEm ?? null),
    confirmadoEmTexto: quandoEmLisboa(a.confirmadoEm ?? null),
    podePagar: sePagaPelaNegociacao(pedido, a),
    estrelas: avaliadoPeloCliente && Number.isFinite(Number(a.estrelas)) ? Number(a.estrelas) : null,
    podeAvaliar: confirmado && !avaliadoPeloCliente,
    textos: {
      quemFaz: quemFazOTrabalhoClyon(nome),
      dia: dataCombinadaTexto ? `Dia combinado: ${dataCombinadaTexto}` : O_PARCEIRO_COMBINA_O_DIA,
      aClyonConfirma: confirmado ? null : A_CLYON_CONFIRMA,
      pergunta: perguntaDaAvaliacao(nome),
    },
  };
}

/** Os campos que saem — e nenhum outro (o teste de segurança lê esta lista). */
export const CAMPOS_DO_FIM_CLYON = [
  "negociacaoId",
  "profissional",
  "fase",
  "dataCombinada",
  "dataCombinadaTexto",
  "confirmadoEm",
  "confirmadoEmTexto",
  "podePagar",
  "estrelas",
  "podeAvaliar",
  "textos",
] as const;
