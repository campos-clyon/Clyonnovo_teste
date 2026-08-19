/**
 * O trabalho depois de fechado.
 *
 * A negociação acaba quando o cliente contrata, e é aí que começa a parte que
 * mexe com dinheiro: alguém tem de ir fazer o trabalho, provar que o fez, e o
 * cliente tem de confirmar antes de o valor sair da CLYON.
 *
 * Esta fase NÃO entra no motor de negociação. `negociacao.ts` decide quem pode
 * propor e quem pode aceitar, e tem testes que descrevem exactamente isso;
 * enfiar-lhe estados de execução tornava-o responsável por duas coisas sem
 * relação — e a segunda muda muito mais do que a primeira.
 *
 * O estado deriva de datas, não de uma coluna de texto. Uma coluna a dizer
 * "confirmado" pode discordar da data em que foi confirmado; duas fontes para o
 * mesmo facto acabam sempre por divergir, e depois não se sabe qual manda.
 */

export type FaseDoTrabalho =
  | "a_negociar"
  | "a_executar"
  | "a_confirmar"
  | "confirmado"
  | "pago";

export type Trabalho = {
  /** O estado da negociação: só "acordada" chegou a trabalho. */
  estado: string;
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
};

/**
 * Quantos dias o cliente tem para confirmar antes de o valor ser libertado
 * sozinho.
 *
 * Sem isto, um cliente que simplesmente não volta ao site prendia o dinheiro do
 * profissional para sempre — e o profissional não tem forma nenhuma de o
 * obrigar a clicar. O prazo é a alternativa a esse refém.
 */
export const DIAS_ATE_LIBERTAR_SOZINHO = 7;

function data(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function faseDoTrabalho(t: Trabalho): FaseDoTrabalho {
  if (t.estado !== "acordada") return "a_negociar";
  if (data(t.pagoEm)) return "pago";
  if (data(t.confirmadoEm)) return "confirmado";
  if (data(t.execucaoEnviadaEm)) return "a_confirmar";
  return "a_executar";
}

/** O profissional só envia a prova de um trabalho que é dele e ainda não provou. */
export function podeEnviarProva(t: Trabalho): boolean {
  return faseDoTrabalho(t) === "a_executar";
}

/** O cliente confirma o que já foi provado. */
export function podeConfirmar(t: Trabalho): boolean {
  return faseDoTrabalho(t) === "a_confirmar";
}

/**
 * Passou o prazo e o cliente não disse nada — o valor liberta-se.
 *
 * Conta-se a partir da prova, e não do fecho: o prazo é para o cliente reagir
 * ao que foi feito, e antes da prova não há nada a que reagir.
 */
export function libertaSozinho(t: Trabalho, agora: Date): boolean {
  if (faseDoTrabalho(t) !== "a_confirmar") return false;
  const enviada = data(t.execucaoEnviadaEm);
  if (!enviada) return false;
  const dias = (agora.getTime() - enviada.getTime()) / 86_400_000;
  return dias >= DIAS_ATE_LIBERTAR_SOZINHO;
}

/** Quantos dias faltam para a libertação automática. Negativo nunca. */
export function diasAteLibertar(t: Trabalho, agora: Date): number | null {
  const enviada = data(t.execucaoEnviadaEm);
  if (faseDoTrabalho(t) !== "a_confirmar" || !enviada) return null;
  const passados = (agora.getTime() - enviada.getTime()) / 86_400_000;
  return Math.max(0, DIAS_ATE_LIBERTAR_SOZINHO - passados);
}

/** O dinheiro deste trabalho já não está preso. */
export function estaLibertado(t: Trabalho, agora: Date): boolean {
  const fase = faseDoTrabalho(t);
  return fase === "confirmado" || fase === "pago" || libertaSozinho(t, agora);
}
