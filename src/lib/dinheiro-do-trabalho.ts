import { lerForma } from "./forma-de-pagamento";

/**
 * O DINHEIRO DE UM TRABALHO, DO PRINCÍPIO AO FIM.
 *
 * *«Estamos com problema para gerir os pagamentos. Cria uma ferramenta ou
 * melhora uma para podermos gerir quem pagou, como pagou, e se já pagámos os
 * profissionais.»* — 24-09-2026.
 *
 * São três perguntas sobre o MESMO trabalho, e estavam em quatro ecrãs
 * diferentes: as Carteiras dizem quem tem a receber (por profissional), os
 * Levantamentos dizem quem pediu, o Livro diz o que se moveu, e os Pagamentos
 * diziam o que o euPago aceitou. Nenhum deles responde à pergunta como ela é
 * feita — que é por TRABALHO:
 *
 *     #346 · Estefanía · 42,00 € entraram por Multibanco a 22/09
 *            TRSul tem 37,60 € a receber, e ainda não recebeu.
 *
 * Este ficheiro é a regra que lê essa linha. É puro e tem testes: é a única
 * parte disto que não se pode dar ao luxo de estar quase certa.
 *
 * ⚠️ DUAS DATAS COM NOMES PARECIDOS, e trocá-las é o erro caro:
 *   · `clientePagouEm` — o CLIENTE pagou à CLYON. O princípio.
 *   · `pagoEm`         — a CLYON pagou ao PROFISSIONAL. O fim.
 */

/**
 * POR ONDE ENTROU O DINHEIRO.
 *
 * Os dois primeiros são o euPago e sabem-se sozinhos. Os três últimos são
 * alguém a dizer o que aconteceu — e existem porque acontecem: um cliente que
 * transfere para a conta da CLYON, um que paga em numerário no escritório, e o
 * caso mais comum de todos, o que paga directamente ao profissional.
 */
export type ComoEntrou =
  | "multibanco"
  | "mbway"
  | "transferencia"
  | "numerario"
  | "ao_profissional";

/** As que uma pessoa regista à mão. O euPago não sabe delas. */
export const RECEBIMENTOS_A_MAO: ComoEntrou[] = [
  "transferencia",
  "numerario",
  "ao_profissional",
];

const NOMES: Record<ComoEntrou, string> = {
  multibanco: "Multibanco",
  mbway: "MB WAY",
  transferencia: "Transferência",
  numerario: "Numerário",
  ao_profissional: "Pago ao profissional",
};

/**
 * Como se lhe chama num ecrã — e nunca devolve vazio.
 *
 * Tolerante de propósito: isto lê uma coluna de texto que já tem linhas
 * antigas lá dentro, e um método que não se reconheça mostra-se como está em
 * vez de aparecer «undefined» ao lado de um valor em euros.
 */
export function nomeDoRecebimento(metodo: string | null | undefined): string {
  const m = (metodo ?? "").trim();
  if (!m) return "—";
  return NOMES[m as ComoEntrou] ?? m;
}

export function eRecebimentoAMao(metodo: string | null | undefined): boolean {
  return RECEBIMENTOS_A_MAO.includes((metodo ?? "").trim() as ComoEntrou);
}

/**
 * EM QUE PÉ ESTÁ O DINHEIRO DESTE TRABALHO.
 *
 *   · `a_receber`  — ninguém nos pagou. É dinheiro nosso que está lá fora, e
 *                    é a única fase que representa uma perda possível;
 *   · `a_decorrer` — o trabalho ainda não está confirmado pelo cliente. Não há
 *                    nada a fazer senão esperar;
 *   · `a_pagar`    — recebemos e devemos ao profissional. É a fila de saída;
 *   · `fechado`    — os dois lados feitos.
 */
export type FaseDoDinheiro = "a_receber" | "a_decorrer" | "a_pagar" | "fechado";

export type TrabalhoParaGerir = {
  /** `dinheiro` quer dizer que o cliente paga ao profissional, no local. */
  formaDePagamento?: string | null;
  /** Há um pagamento dado por pago? A data, ou nulo. */
  clientePagouEm?: Date | string | null;
  /** Por onde, quando se sabe. */
  comoEntrou?: string | null;
  /** O cliente confirmou que o trabalho está feito. */
  confirmadoEm?: Date | string | null;
  /** A CLYON já pagou ao profissional. */
  pagoEm?: Date | string | null;
};

/** O cliente entregou o valor ao profissional, em mão. Nada passa pela CLYON. */
export function pagouAoProfissional(t: TrabalhoParaGerir): boolean {
  return lerForma(t.formaDePagamento) === "dinheiro" || t.comoEntrou === "ao_profissional";
}

export function faseDoDinheiro(t: TrabalhoParaGerir): FaseDoDinheiro {
  /*
   * O DINHEIRO EM MÃO DECIDE-SE PRIMEIRO, antes de perguntar se o cliente
   * pagou à CLYON — porque a pergunta não faz sentido: ele pagou ao
   * profissional. Não há nada a receber nem nada a pagar; só falta o trabalho
   * ficar confirmado. É a mesma ordem de `carteiraDe`, e tem de ser: dois
   * ecrãs a responder de maneira diferente sobre o mesmo trabalho é pior do
   * que um ecrã a menos.
   */
  if (pagouAoProfissional(t)) return t.confirmadoEm ? "fechado" : "a_decorrer";

  if (t.clientePagouEm == null) return "a_receber";
  if (t.confirmadoEm == null) return "a_decorrer";
  return t.pagoEm != null ? "fechado" : "a_pagar";
}

export const ROTULO_DA_FASE: Record<FaseDoDinheiro, string> = {
  a_receber: "Por receber do cliente",
  a_decorrer: "A decorrer",
  a_pagar: "Por pagar ao profissional",
  fechado: "Fechado",
};

/**
 * A ORDEM POR QUE SE OLHA PARA ISTO.
 *
 * Primeiro o que pode ser perdido — dinheiro que devíamos ter e não temos —,
 * depois o que devemos, depois o que só precisa de tempo, e por fim o que já
 * não precisa de ninguém. Não é a ordem cronológica: é a ordem da atenção.
 */
export const FASES_POR_ORDEM: FaseDoDinheiro[] = [
  "a_receber",
  "a_pagar",
  "a_decorrer",
  "fechado",
];

/**
 * AS DUAS PONTAS, CADA UMA COM A SUA PERGUNTA — 25-09-2026.
 *
 * *«Temos que separar os pagamentos entre os já recebidos, por receber, pagos
 * ao pro e por pagar aos pros.»*
 *
 * A fase junta as duas pontas numa só resposta, e isso esconde metade: um
 * trabalho «por receber» também está por pagar ao profissional, e não aparecia
 * nessa lista. Quem tem o extracto do banco aberto faz UMA pergunta de cada
 * vez — «o que entrou?», ou «o que saiu?» —, e cada trabalho responde às duas.
 *
 * O DINHEIRO EM MÃO CONTA COMO FEITO dos dois lados, pela razão de sempre: o
 * cliente pagou ao profissional, e nenhuma das pontas passa pela CLYON. Fica
 * nas listas de feitos, dito como é, em vez de inchar as de pendentes com
 * dinheiro que nunca devia ter passado por cá.
 */
export type LadoDoCliente = "por_receber" | "recebido";
export type LadoDoProfissional = "por_pagar" | "pago";

export function ladoDoCliente(t: TrabalhoParaGerir): LadoDoCliente {
  if (pagouAoProfissional(t)) return "recebido";
  return t.clientePagouEm != null ? "recebido" : "por_receber";
}

export function ladoDoProfissional(t: TrabalhoParaGerir): LadoDoProfissional {
  if (pagouAoProfissional(t)) return "pago";
  return t.pagoEm != null ? "pago" : "por_pagar";
}

/**
 * Pode-se transferir JÁ? Recebemos, e o cliente confirmou o trabalho.
 *
 * Um trabalho por pagar nem sempre está pronto a pagar — e pagar antes de o
 * dinheiro entrar é adiantar dinheiro da CLYON. É a mesma regra da fase.
 */
export function prontoAPagar(t: TrabalhoParaGerir): boolean {
  return faseDoDinheiro(t) === "a_pagar";
}
