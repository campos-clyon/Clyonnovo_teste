import { A_PLATAFORMA_COBRA } from "./pagamento-na-plataforma";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "./taxas-plataforma";
import { estaLibertado, faseDoTrabalho, type Trabalho } from "./trabalho";

/**
 * A carteira do profissional.
 *
 * Quatro números, e a diferença entre eles é a promessa toda da plataforma:
 *
 *   · POR COBRAR — o trabalho está feito e o cliente AINDA NÃO PAGOU. Não é
 *     dinheiro de ninguém: não está cá, não está lá, não há nada a libertar;
 *   · CATIVO — o cliente pagou à CLYON e ainda não confirmou que está feito. É
 *     a garantia dele. Para o profissional é a certeza de que o dinheiro
 *     existe e está do lado de cá — que é exactamente o que ele não tem quando
 *     combina por fora;
 *   · DISPONÍVEL — confirmado, e ainda não pedido;
 *   · A CAMINHO — pedido, e ainda não transferido.
 *
 * ⚠️ «CATIVO» TEM DE QUERER DIZER «TEMOS O DINHEIRO» — 17-09-2026.
 *
 * *«Os pagamentos recebidos vão para a conta usando o euPago; não fica nada no
 * euPago cativo, apenas o site diz isso — e não liberta o levantamento sem que
 * o cliente confirme o trabalho realizado.»*
 *
 * Como o dinheiro fica numa conta da CLYON e não numa caução do euPago, é o
 * SITE que segura a promessa. E uma promessa dita por software só vale se o
 * software se recusar a dizê-la quando não é verdade: um trabalho por pagar a
 * aparecer como «cativo» seria exactamente a mentira que
 * `pagamento-na-plataforma.ts` existe para não se repetir — um saldo cativo que
 * ninguém cativou.
 *
 * Por isso o pagamento MANDA SOBRE A FASE. Um trabalho confirmado pelo cliente
 * mas não pago não vai para «disponível»: fica em «por cobrar». Senão, a CLYON
 * transferia a um profissional dinheiro que nunca recebeu.
 *
 * Enquanto `A_PLATAFORMA_COBRA` for falso nada disto se aplica — não há
 * pagamentos para verificar, e a carteira é exactamente a de sempre.
 *
 * Todos os valores são LÍQUIDOS. O bruto não aparece em sítio nenhum do lado do
 * profissional: ver a decisão em taxas-plataforma.ts.
 */

export type TrabalhoNaCarteira = Trabalho & {
  negociacaoId: number;
  valorAcordado: number | null;
  /*
   * A COMISSÃO QUE ESTE TRABALHO TEVE, e não a de hoje.
   *
   * A taxa passou a poder mudar no backoffice (15-09-2026). Sem estas duas, a
   * carteira era recalculada à taxa actual sempre que alguém a abria — e
   * mudar a percentagem mexia no total ganho de trabalhos feitos e pagos há
   * meses. Vêm da linha da negociação; nulas querem dizer "anterior a isto" e
   * valem as de origem.
   */
  taxaProfissional?: number | string | null;
  taxaCliente?: number | string | null;
  /**
   * COMO O CLIENTE PAGOU — 21-09-2026. Nulo = na plataforma.
   *
   * Em «dinheiro» o valor foi entregue ao profissional em mão e NUNCA passou
   * pela CLYON. Não é por cobrar (já foi pago), não é cativo (não o temos), e
   * não pode ser disponível (não há de onde o transferir). É outro cesto —
   * `recebidoEmMao` — e é decidido ANTES de se perguntar se o cliente pagou.
   */
  formaDePagamento?: string | null;
  /**
   * QUANDO O CLIENTE PAGOU ESTE TRABALHO À CLYON. `null` = ainda não pagou.
   *
   * Vem da tabela `pagamentos` (ver `negociacoesPagas`), e não da negociação:
   * um pagamento é um facto do banco, não um estado do acordo.
   *
   * Só conta com `A_PLATAFORMA_COBRA` ligado. Antes disso é sempre nulo — não
   * há pagamentos nenhuns — e a carteira comporta-se como sempre se comportou.
   */
  clientePagouEm?: Date | string | null;
};

/** Opções de leitura da carteira. Existem para os testes poderem ver os dois mundos. */
export type ComoLerACarteira = {
  /**
   * A plataforma já cobra o cliente?
   *
   * Vem de `A_PLATAFORMA_COBRA` por omissão. É um parâmetro e não uma leitura
   * directa da constante para que os testes possam provar os DOIS
   * comportamentos — o de hoje e o do dia em que o interruptor mudar — sem ter
   * de mexer num ficheiro do produto para os correr.
   */
  aPlataformaCobra?: boolean;
};

export type Levantamento = {
  id: number;
  valor: number;
  /** "pedido", "pago" ou "recusado". */
  estado: string;
};

export type Carteira = {
  /**
   * Trabalho feito que o cliente ainda não pagou.
   *
   * Não é dinheiro de ninguém e não se levanta. Zero enquanto a plataforma não
   * cobrar — nesse mundo não há pagamentos por onde esperar.
   */
  porCobrar: number;
  /** Fechado e pago pelo cliente, à espera da confirmação. */
  cativo: number;
  /** Confirmado, menos o que já pediu ou levantou. */
  disponivel: number;
  /** Pedido e ainda por transferir. */
  aCaminho: number;
  /** Já transferido. */
  levantado: number;
  /**
   * RECEBIDO EM MÃO — trabalho pago em dinheiro, no local, já feito.
   *
   * Conta no total ganho e em mais lado nenhum: não se transfere, porque
   * nunca esteve cá. Um profissional que recebeu 120 € em notas e viu 112,80 €
   * «disponíveis» na CLYON podia pedi-los — e o único travão era uma pessoa no
   * backoffice a olhar para um número. Foi o defeito que este cesto fecha.
   */
  recebidoEmMao: number;
  /** Tudo o que já ganhou, líquido — cativo e recebido em mão incluídos. */
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

function liquido(t: TrabalhoNaCarteira): number {
  const v = t.valorAcordado;
  if (v == null || !Number.isFinite(v)) return 0;
  return quantoOProfissionalRecebe(v, taxasDaNegociacao(t));
}

/** O serviço foi pago ao profissional em mão, no local? */
export function foiPagoEmMao(t: Pick<TrabalhoNaCarteira, "formaDePagamento">): boolean {
  return t.formaDePagamento === "dinheiro";
}

/**
 * Quanto é que este profissional já recebeu em dinheiro, no local.
 *
 * Só o que já está FEITO — confirmado, ou libertado pelo prazo. Um trabalho
 * em dinheiro ainda por fazer não é dinheiro recebido; é um trabalho por
 * fazer, e vê-se na lista de trabalhos, não na carteira.
 *
 * Exportada pela mesma razão de `porCobrarDe`: o livro não tem movimento para
 * isto (nada se moveu pela CLYON) e recebe-o de fora, da mesma função.
 */
export function recebidoEmMaoDe(trabalhos: TrabalhoNaCarteira[], agora: Date): number {
  let total = 0;
  for (const t of trabalhos) {
    if (!foiPagoEmMao(t)) continue;
    if (faseDoTrabalho(t) === "a_negociar") continue;
    if (estaLibertado(t, agora)) total += liquido(t);
  }
  return aosCentimos(total);
}

/**
 * O CLIENTE JÁ PAGOU ESTE TRABALHO?
 *
 * Com a plataforma a não cobrar, a resposta é sempre «sim» — e tem de ser: não
 * existem pagamentos, e responder «não» punha a carteira inteira de todos os
 * profissionais em «por cobrar» no dia em que este ficheiro mudasse.
 */
export function oClientePagou(
  t: TrabalhoNaCarteira,
  opcoes: ComoLerACarteira = {},
): boolean {
  if (!(opcoes.aPlataformaCobra ?? A_PLATAFORMA_COBRA)) return true;
  return t.clientePagouEm != null;
}

/**
 * Quanto é que este profissional tem em trabalho feito e por pagar.
 *
 * Existe como função própria — e exportada — porque é usada de dois sítios: da
 * carteira calculada e do livro de movimentos. O livro NÃO tem uma linha para
 * isto, e não deve ter: um movimento é dinheiro que se moveu, e aqui não se
 * moveu nada ainda. Escrever nele um trabalho por pagar era voltar a pôr no
 * livro uma coisa que não aconteceu.
 */
export function porCobrarDe(
  trabalhos: TrabalhoNaCarteira[],
  opcoes: ComoLerACarteira = {},
): number {
  let total = 0;
  for (const t of trabalhos) {
    if (faseDoTrabalho(t) === "a_negociar") continue;
    // Pago em mão não é por cobrar: já foi cobrado, ao profissional, no local.
    if (foiPagoEmMao(t)) continue;
    if (!oClientePagou(t, opcoes)) total += liquido(t);
  }
  return aosCentimos(total);
}

export function carteiraDe(
  trabalhos: TrabalhoNaCarteira[],
  levantamentos: Levantamento[],
  agora: Date,
  opcoes: ComoLerACarteira = {},
): Carteira {
  let porCobrar = 0;
  let cativo = 0;
  let ganhoLibertado = 0;
  let recebidoEmMao = 0;

  for (const t of trabalhos) {
    if (faseDoTrabalho(t) === "a_negociar") continue;
    const valor = liquido(t);

    /*
     * O DINHEIRO EM MÃO DECIDE-SE PRIMEIRO — antes de perguntar se o cliente
     * pagou à CLYON, porque a pergunta não faz sentido: pagou ao profissional.
     * Só conta depois de feito; antes disso não é dinheiro de ninguém ainda.
     */
    if (foiPagoEmMao(t)) {
      if (estaLibertado(t, agora)) recebidoEmMao += valor;
      continue;
    }

    /*
     * O PAGAMENTO MANDA SOBRE A FASE, e a ordem destas duas linhas é a regra
     * toda. Um trabalho confirmado pelo cliente mas NÃO PAGO não pode ir para
     * «disponível»: seria a CLYON a transferir dinheiro que nunca recebeu.
     */
    if (!oClientePagou(t, opcoes)) {
      porCobrar += valor;
      continue;
    }

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
    porCobrar: aosCentimos(porCobrar),
    cativo: aosCentimos(cativo),
    disponivel,
    aCaminho: aosCentimos(aCaminho),
    levantado: aosCentimos(levantado),
    recebidoEmMao: aosCentimos(recebidoEmMao),
    // Inclui o por cobrar e o recebido em mão: «tudo o que já ganhou» é sobre
    // o trabalho feito, e é assim que este número sempre se comportou. Onde
    // está cada parte dizem-no os outros cinco.
    totalGanho: aosCentimos(porCobrar + cativo + ganhoLibertado + recebidoEmMao),
  };
}

export type RecusaDeLevantamento =
  | "sem_iban"
  | "abaixo_do_minimo"
  | "saldo_insuficiente"
  /** Tem o trabalho feito, mas o cliente ainda não pagou. */
  | "a_espera_do_cliente"
  /** O que recebeu foi em dinheiro, no local — já está com ele e não se transfere. */
  | "pago_em_mao"
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
  if (aosCentimos(valor) > carteira.disponivel) {
    /*
     * PORQUE É QUE NÃO CHEGA — e não só que não chega.
     *
     * «Não tem esse valor disponível» a quem tem três trabalhos feitos e por
     * cobrar é uma frase que não explica nada e manda a pessoa escrever para o
     * apoio. Se o que falta está à espera do cliente, é isso que se lhe diz.
     */
    if (carteira.porCobrar > 0) return "a_espera_do_cliente";
    // «Não tem esse valor disponível» a quem tem 120 € recebidos em notas é
    // uma frase que manda a pessoa escrever para o apoio. Diz-se o que é.
    if (carteira.recebidoEmMao > 0) return "pago_em_mao";
    return "saldo_insuficiente";
  }
  return null;
}

export const EXPLICACAO_DA_RECUSA: Record<RecusaDeLevantamento, string> = {
  sem_iban: "Falta indicar o IBAN onde quer receber. Está no separador Perfil.",
  abaixo_do_minimo: "O mínimo por transferência é de " + MINIMO_PARA_LEVANTAR + " euros.",
  saldo_insuficiente: "Não tem esse valor disponível.",
  a_espera_do_cliente:
    "Esse valor ainda está por cobrar — o cliente não pagou. Assim que o pagamento entrar e ele confirmar o trabalho, fica disponível.",
  pago_em_mao:
    "Esse valor foi-lhe pago em dinheiro, no local. Já está consigo — não passou pela CLYON e não há nada para transferir.",
  valor_invalido: "Indique um valor.",
  ja_tem_pedido: "Já tem um pedido de transferência a ser processado.",
};
