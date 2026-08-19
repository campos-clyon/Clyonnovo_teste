import { quantoOProfissionalRecebe } from "./taxas-plataforma";
import { estaLibertado, faseDoTrabalho, type Trabalho } from "./trabalho";

/**
 * A carteira do profissional.
 *
 * Três números, e a diferença entre eles é a promessa toda da plataforma:
 *
 *   · CATIVO — o trabalho está fechado e o cliente já pagou à CLYON, mas ainda
 *     não confirmou que está feito. É a garantia dele. Para o profissional é a
 *     certeza de que o dinheiro existe e está do lado de cá — que é exactamente
 *     o que ele não tem quando combina por fora;
 *   · DISPONÍVEL — confirmado, e ainda não pedido;
 *   · A CAMINHO — pedido, e ainda não transferido.
 *
 * Todos os valores são LÍQUIDOS. O bruto não aparece em sítio nenhum do lado do
 * profissional: ver a decisão em taxas-plataforma.ts.
 */

export type TrabalhoNaCarteira = Trabalho & {
  negociacaoId: number;
  valorAcordado: number | null;
};

export type Levantamento = {
  id: number;
  valor: number;
  /** "pedido", "pago" ou "recusado". */
  estado: string;
};

export type Carteira = {
  /** Fechado e pago pelo cliente, à espera da confirmação. */
  cativo: number;
  /** Confirmado, menos o que já pediu ou levantou. */
  disponivel: number;
  /** Pedido e ainda por transferir. */
  aCaminho: number;
  /** Já transferido. */
  levantado: number;
  /** Tudo o que já ganhou, líquido — cativo incluído. */
  totalGanho: number;
};

/**
 * Mínimo por transferência.
 *
 * Não é para segurar dinheiro de ninguém: cada transferência tem um custo fixo,
 * e um pedido de dois euros gasta mais a processar do que vale.
 */
export const MINIMO_PARA_LEVANTAR = 10;

function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function liquido(valorAcordado: number | null): number {
  if (valorAcordado == null || !Number.isFinite(valorAcordado)) return 0;
  return quantoOProfissionalRecebe(valorAcordado);
}

export function carteiraDe(
  trabalhos: TrabalhoNaCarteira[],
  levantamentos: Levantamento[],
  agora: Date,
): Carteira {
  let cativo = 0;
  let ganhoLibertado = 0;

  for (const t of trabalhos) {
    if (faseDoTrabalho(t) === "a_negociar") continue;
    const valor = liquido(t.valorAcordado);
    // A libertação por prazo conta como confirmada mesmo antes de alguém correr
    // o processo que grava a data — senão o profissional via o prazo passar e o
    // dinheiro continuar preso, que é a única coisa que não lhe podemos fazer.
    if (estaLibertado(t, agora)) ganhoLibertado += valor;
    else cativo += valor;
  }

  let aCaminho = 0;
  let levantado = 0;
  for (const l of levantamentos) {
    if (l.estado === "pedido") aCaminho += l.valor;
    else if (l.estado === "pago") levantado += l.valor;
    // "recusado" não desconta nada: o dinheiro voltou a estar disponível.
  }

  const disponivel = Math.max(0, aosCentimos(ganhoLibertado - aCaminho - levantado));

  return {
    cativo: aosCentimos(cativo),
    disponivel,
    aCaminho: aosCentimos(aCaminho),
    levantado: aosCentimos(levantado),
    totalGanho: aosCentimos(cativo + ganhoLibertado),
  };
}

export type RecusaDeLevantamento =
  | "sem_iban"
  | "abaixo_do_minimo"
  | "saldo_insuficiente"
  | "valor_invalido"
  | "ja_tem_pedido";

/**
 * Porque é que este pedido de transferência não pode ser feito — ou null.
 *
 * Devolve o motivo em vez de um booleano porque o ecrã precisa de dizer o que
 * falta. "Não pode" sem porquê é o que faz as pessoas escreverem para o apoio.
 */
export function recusaDoLevantamento(
  valor: number,
  carteira: Carteira,
  temIban: boolean,
  temPedidoPendente: boolean,
): RecusaDeLevantamento | null {
  if (!temIban) return "sem_iban";
  if (temPedidoPendente) return "ja_tem_pedido";
  if (!Number.isFinite(valor) || valor <= 0) return "valor_invalido";
  if (valor < MINIMO_PARA_LEVANTAR) return "abaixo_do_minimo";
  if (aosCentimos(valor) > carteira.disponivel) return "saldo_insuficiente";
  return null;
}

export const EXPLICACAO_DA_RECUSA: Record<RecusaDeLevantamento, string> = {
  sem_iban: "Falta indicar o IBAN onde quer receber. Está no separador Perfil.",
  abaixo_do_minimo: "O mínimo por transferência é de " + MINIMO_PARA_LEVANTAR + " euros.",
  saldo_insuficiente: "Não tem esse valor disponível.",
  valor_invalido: "Indique um valor.",
  ja_tem_pedido: "Já tem um pedido de transferência a ser processado.",
};
