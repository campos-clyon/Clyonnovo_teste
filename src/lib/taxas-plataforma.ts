/**
 * As comissões da CLYON, num sítio só.
 *
 * Estavam prestes a ficar espalhadas por três ficheiros — o email ao
 * profissional, a página dele e o cálculo do pagamento — e três cópias de uma
 * percentagem é a forma mais rápida de um dia o cliente ver 6 % e a fatura
 * dizer outra coisa.
 *
 * Decidido em 16-08-2026. Não confundir com as da app, que são outras (5 % de
 * reserva ao cliente e 10 % de aceitação ao profissional, com o preço fechado
 * pela CLYON). A divergência é deliberada: testa-se o modelo novo no site
 * antes de lhe tocar na app.
 */

/** Somada ao valor acordado, no que o cliente paga. */
export const TAXA_CLIENTE = 0.06;

/** Descontada ao valor acordado, no que o profissional recebe. */
export const TAXA_PROFISSIONAL = 0.05;

function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** O que a CLYON fica, sobre o valor acordado. */
export const TAXA_TOTAL = TAXA_CLIENTE + TAXA_PROFISSIONAL;

/**
 * IVA à taxa normal portuguesa.
 *
 * ⚠️ Aplica-se a TODOS os trabalhos, por decisão de 18-08-2026, e isso merece
 * ficar escrito com o alerta que lhe corresponde.
 *
 * Quem presta o serviço é o profissional, e o IVA é do regime DELE: um
 * profissional em isenção (art. 53.º do CIVA) não liquida IVA nenhum. Mostrar
 * 23 % a um cliente que contrata um isento é mostrar-lhe um imposto que ele não
 * deve — e que ninguém pode entregar ao Estado. O risco foi levantado e a
 * decisão foi tomada na mesma.
 *
 * Se um dia se quiser corrigir, o caminho é perguntar o regime na inscrição do
 * profissional e decidir por perfil; a decomposição abaixo continua a servir.
 */
export const TAXA_IVA = 0.23;

/**
 * TODOS OS VALORES NEGOCIADOS SÃO SEM IVA. O imposto SOMA-SE.
 *
 * "Temos de deixar claro que todos os valores praticados são sem IVA,
 * principalmente para os clientes." — decisão de 29-08-2026.
 *
 * Até aqui era ao contrário: os 350 € acordados eram tratados como já
 * incluindo imposto e decompunham-se em 284,55 + 65,45. Agora 350 € são a
 * base, e o IVA acresce.
 *
 * ISTO MUDA O QUE O CLIENTE PAGA, e não é pouco: sobre 350 € acordados com um
 * profissional no regime normal, o total sobe de 371,00 € para 451,50 €. A
 * mudança foi pedida sabendo disso.
 *
 * ⚠️ FICA UM PONTO POR RESOLVER, e é melhor estar escrito do que esquecido: a
 * lei portuguesa (DL 138/90) obriga a mostrar ao CONSUMIDOR o preço final, com
 * imposto incluído. "Sem IVA" é a convenção entre empresas. O que o código faz
 * — e é o que o torna defensável — é mostrar sempre o TOTAL ao cliente, com a
 * decomposição por baixo: ele nunca vê só a base.
 */
export type RegimeIva = "isento" | "normal";

export function regimeDeIva(v: unknown): RegimeIva {
  return v === "normal" ? "normal" : "isento";
}

/**
 * O IVA sobre uma base, segundo o regime de QUEM FACTURA.
 *
 * Quem presta o serviço é o profissional, e o imposto é do regime dele: um
 * profissional na isenção do artigo 53.º não liquida IVA nenhum, e mostrar
 * 23 % a quem o contrata seria mostrar-lhe um imposto que não deve — e que
 * ninguém pode entregar ao Estado.
 */
export function ivaSobre(base: number, regime: RegimeIva): number {
  return regime === "normal" ? aosCentimos(base * TAXA_IVA) : 0;
}

export type ContaDoCliente = {
  /** O valor acordado com o profissional, sem imposto. */
  servico: number;
  /** O IVA do serviço — zero quando o profissional está isento. */
  iva: number;
  /** A taxa da CLYON: 6 % sobre o serviço. */
  taxa: number;
  /** O que sai da carteira dele. É este o número grande. */
  total: number;
  /** Se há linha de imposto para mostrar. */
  temIva: boolean;
};

/**
 * A conta inteira do cliente, num sítio só.
 *
 * Existe para que ninguém volte a somar isto à mão. Havia três sítios a
 * multiplicar por 1,06 e um quarto a decompor o IVA ao contrário — e quatro
 * cópias de uma conta de dinheiro são quatro números diferentes à espera de
 * acontecer.
 */
export function contaDoCliente(acordado: number, regime: RegimeIva): ContaDoCliente {
  const servico = aosCentimos(acordado);
  const iva = ivaSobre(servico, regime);
  const taxa = aosCentimos(servico * TAXA_CLIENTE);
  return {
    servico,
    iva,
    taxa,
    total: aosCentimos(servico + iva + taxa),
    temIva: iva > 0,
  };
}

/**
 * O serviço mais a taxa da CLYON, SEM IVA.
 *
 * Chamava-se `quantoOClientePaga`, e deixou de poder chamar-se: a partir do
 * momento em que o imposto acresce, esta conta já não é o que o cliente paga —
 * é a parte dela que não depende do regime do profissional. Um nome que mente
 * sobre dinheiro acaba numa factura errada, e por isso mudou.
 *
 * Para o que o cliente paga a sério, use `contaDoCliente`.
 */
export function servicoMaisTaxa(acordado: number): number {
  return aosCentimos(acordado * (1 + TAXA_CLIENTE));
}

/**
 * O que o profissional recebe: acordado − 5 %.
 *
 * É este o número que se lhe mostra em todo o lado, incluindo no saldo cativo.
 * Nunca o bruto: mostrar 200 retidos e 190 disponíveis levantava a pergunta
 * "onde foram os 10 €", e a resposta certa é que nunca foram dele.
 */
export function quantoOProfissionalRecebe(acordado: number): number {
  return aosCentimos(acordado * (1 - TAXA_PROFISSIONAL));
}

/** O que fica para a CLYON sobre um trabalho fechado. */
export function comissaoDaClyon(acordado: number): number {
  return aosCentimos(servicoMaisTaxa(acordado) - quantoOProfissionalRecebe(acordado));
}
