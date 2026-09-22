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
 *
 * TROCADAS EM 07-09-2026. Estavam ao contrário — 6 % ao cliente e 5 % ao
 * profissional — e o dono do negócio corrigiu: "são 6% dos pros e 5% do
 * cliente". O total continua 11 %; o que muda é de que lado sai cada parte.
 * Como todos os ecrãs, emails e mensagens leem estas duas constantes, a troca
 * é aqui e só aqui; os testes em `taxas-plataforma.test.ts` têm os números.
 *
 * O IVA ENTRA — e desde 22-09-2026 é UM SÓ.
 *
 * Dizia aqui que "o IVA não entra nisto", e era verdade a meias. "O cliente
 * pagou 107,52 mas a factura é de apenas 103,32": os 4,20 € de taxa eram
 * somados a seco, sem imposto e sem documento nenhum, em todos os trabalhos
 * desde sempre.
 *
 * Houve depois uma fase de DUAS facturas — a do profissional pelo serviço,
 * com o imposto do regime dele, e a da CLYON pela taxa. Acabou quando uma
 * EMPRESA PARCEIRA passou a facturar tudo ao cliente (a CLYON está isenta
 * pelo artigo 53.º e não pode liquidar imposto — ver `ENTIDADE_QUE_FACTURA`
 * em `identificacao-legal.ts`):
 *
 *   parceira → cliente:   serviço + taxa, mais 23 % se ele quiser factura
 *   CLYON    → profissional: a comissão de `TAXA_PROFISSIONAL`
 *
 * Ver `contaDoCliente` em baixo.
 */

/**
 * AS TAXAS DE ORIGEM — e porque é que elas continuam a ser constantes.
 *
 * A partir de 15-09-2026 a taxa pode ser mudada no backoffice. Estas duas
 * deixaram de ser "a taxa" e passaram a ser outra coisa: o que valia ANTES de
 * alguém poder mudá-la.
 *
 * Toda a negociação guarda as suas (ver `taxasDaNegociacao`). Uma que não
 * guarde nada é anterior a esta mudança — e o que ela valia era isto. Por isso
 * estes números não podem voltar a mexer-se: mudá-los reescreveria o que já
 * foi facturado.
 */
export const TAXA_CLIENTE = 0.05;
export const TAXA_PROFISSIONAL = 0.06;

/** As duas juntas, como elas viajam pelo código. */
export type Taxas = {
  /** Somada ao valor acordado, no que o cliente paga. */
  cliente: number;
  /** Descontada ao valor acordado, no que o profissional recebe. */
  profissional: number;
};

export const TAXAS_DE_ORIGEM: Taxas = {
  cliente: TAXA_CLIENTE,
  profissional: TAXA_PROFISSIONAL,
};

/** Nenhuma taxa passa daqui. Uma gralha de 0,06 para 6 não pode chegar à conta. */
export const TAXA_MAXIMA = 0.5;

/**
 * Uma percentagem que se pode usar numa conta de dinheiro — ou nada.
 *
 * ⚠️ O TEXTO VAZIO TEM DE SAIR ANTES DA CONVERSÃO. `Number("")` é zero, e zero
 * é uma taxa legítima: uma coluna vazia virava uma comissão de 0 % em
 * silêncio, sem erro nenhum, e a CLYON deixava de ganhar no trabalho sem
 * ninguém perceber porquê. Foi um teste que o apanhou, não a leitura do
 * código.
 */
function taxaValida(v: unknown): number | null {
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 0 || n > TAXA_MAXIMA) return null;
  return n;
}

/**
 * AS TAXAS DE UMA NEGOCIAÇÃO — as que ELA guardou, e não as de hoje.
 *
 * Esta função é a razão de ser da mudança toda. Até 15-09-2026 não havia
 * coluna nenhuma de taxa: todos os números de dinheiro eram calculados ao vivo
 * a partir das constantes — a carteira do profissional, o total do cliente, e
 * até os trabalhos JÁ PAGOS. Mudar a percentagem reescrevia o passado inteiro:
 * o total ganho de cada profissional, o que cada cliente pagou, e os números
 * que já tinham ido em factura.
 *
 * A taxa fica presa quando a negociação NASCE — quando o pedido chega ao
 * profissional — e nunca mais muda. Assim nenhum número que alguém já viu pode
 * mudar: nem a proposta que o cliente recebeu no WhatsApp, nem a carteira, nem
 * uma factura. Uma taxa nova só se aplica a pedidos distribuídos a partir daí.
 *
 * Sem coluna gravada, são as de origem: a linha é anterior a isto existir.
 * Um valor fora do sítio também cai para as de origem — uma conta de dinheiro
 * nunca pode ser feita com um número que não se percebe.
 */
export function taxasDaNegociacao(
  linha: { taxaCliente?: unknown; taxaProfissional?: unknown } | null | undefined,
): Taxas {
  return {
    cliente: taxaValida(linha?.taxaCliente) ?? TAXA_CLIENTE,
    profissional: taxaValida(linha?.taxaProfissional) ?? TAXA_PROFISSIONAL,
  };
}

function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** O que a CLYON fica, sobre o valor acordado. */
export const TAXA_TOTAL = TAXA_CLIENTE + TAXA_PROFISSIONAL;

/**
 * IVA à taxa normal portuguesa.
 *
 * Aplica-se a todos os trabalhos, e desde 22-09-2026 sem ressalva nenhuma.
 *
 * Houve aqui um aviso longo e havia razão para ele: enquanto era o profissional
 * a facturar o serviço, o imposto era do regime DELE, e mostrar 23 % a quem
 * contratava um isento do artigo 53.º era anunciar-lhe um imposto que ninguém
 * podia entregar ao Estado. Chegou a corrigir-se por perfil, como o aviso
 * sugeria.
 *
 * Deixou de se pôr quando a facturação passou para uma empresa parceira no
 * regime normal: o imposto de uma factura é o de quem a emite, e quem a emite
 * é sempre a mesma. Ver `ENTIDADE_QUE_FACTURA`.
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
 * A FACTURA AO CLIENTE LEVA IVA — porque quem a emite está no regime normal.
 *
 * Chamava-se `CLYON_LIQUIDA_IVA`, e o nome era falso: a CLYON está na isenção
 * do artigo 53.º e não liquida imposto nenhum. Quem emite a factura, e por
 * isso quem liquida os 23 %, é a `ENTIDADE_QUE_FACTURA` de
 * `identificacao-legal.ts` — uma empresa parceira.
 *
 * "Esqueça isso: quem vai facturar será uma empresa parceira chamada
 * Miragem." — 22-09-2026.
 *
 * Constante e não um `true` escondido na conta: o regime de quem factura é
 * uma coisa do mundo, muda com a empresa e não com o código, e no dia em que
 * mudar há um sítio para o dizer. Ver `contaDoCliente`.
 */
export const A_FACTURA_LEVA_IVA = true;

export type ContaDoCliente = {
  /** O valor acordado com o profissional, sem imposto. */
  servico: number;
  /**
   * O IMPOSTO DA FACTURA: 23 % sobre o serviço mais a taxa.
   *
   * Uma linha só, porque é uma factura só. Era calculado em duas parcelas, por
   * vendedor, e a razão disso está na nota do `TAXA_IVA` aqui em cima.
   */
  iva: number;
  /** A taxa da CLYON ao cliente: `TAXA_CLIENTE` sobre o serviço. */
  taxa: number;
  /** O acréscimo fixo da CLYON (o «pagar depois»), em euros e sem IVA. Zero quase sempre. */
  acrescimo: number;
  /**
   * SÓ A PARTE DO IMPOSTO QUE CORRESPONDE À TAXA DA CLYON.
   *
   * Existe para o trabalho pago em dinheiro ao profissional, onde o serviço
   * não passa pela CLYON e ela só pode facturar o que é dela. Em tudo o resto
   * quem manda é o `iva`, que é o imposto da factura inteira.
   *
   * Não há `ivaDoServico`: essa separação servia duas facturas de duas
   * empresas, e desde 22-09-2026 a factura é uma só.
   */
  ivaDaTaxa: number;
  /**
   * O SERVIÇO MAIS A TAXA, SEM IMPOSTO — e é ESTE o número que se lhe diz.
   *
   * "Vamos apresentar os valores sempre sem IVA, caso o cliente deseje
   * factura são mais 23 %, deixamos isso claro apenas." — 17-09-2026.
   *
   * Veio de um caso concreto: um cliente que não queria factura leu uma conta
   * cheia de linhas, não percebeu qual era o número dele, e acabou a pagar ao
   * profissional os 280 € dele — sem os 14 € da nossa taxa. Uma conta com
   * quatro linhas e um total que ninguém pediu não é transparência: é ruído,
   * e o ruído sai caro a quem o escreve.
   *
   * NÃO SUBSTITUI `total`. O imposto continua calculado, por vendedor e como
   * sempre — só deixa de ser o número grande, e passa a ser a linha que diz o
   * que acresce a quem quiser factura.
   */
  semIva: number;
  /** O que sai da carteira dele COM FACTURA: serviço + taxa + imposto. */
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
export function contaDoCliente(
  acordado: number,
  /*
   * O REGIME DO PROFISSIONAL SAIU DAQUI — 22-09-2026, e saiu em vez de ficar
   * a ser ignorado.
   *
   * "A CLYON vai emitir as facturas a partir de agora, então vamos ignorar os
   * pros." Um parâmetro que se recebe e não se usa é pior do que parâmetro
   * nenhum: quem o passa acredita que ele conta, e mais cedo ou mais tarde
   * alguém o volta a ligar por o ver ali. Tirado, o compilador aponta os
   * vinte sítios que o passavam e obriga a olhar para cada um.
   *
   * A coluna `providers.regimeIva` FICA, e o profissional continua a
   * declará-la: é a verdade fiscal dele, e é dela que depende a factura que
   * ele passa à CLYON. O que deixou de haver é caminho dela até ao que o
   * cliente paga.
   */
  /*
   * As da negociação, quando quem chama as tem. Sem elas, as de origem — que
   * é o certo para uma linha anterior a haver taxas guardadas, e o que mantém
   * compiláveis os sítios onde não há negociação nenhuma (uma simulação, um
   * texto de ajuda).
   */
  taxas: Taxas = TAXAS_DE_ORIGEM,
  /**
   * UM ACRÉSCIMO FIXO DA CLYON, em euros e sem IVA — 21-09-2026.
   *
   * Nasceu para o «pagar depois da recolha» (+5 €) e é deliberadamente um
   * número em euros e não uma taxa: 5 € num trabalho de 30 € e 5 € num de
   * 900 € são os mesmos 5 €. Entra na base da CLYON — leva o IVA da CLYON por
   * cima, aparece na factura da CLYON — e NUNCA no valor acordado, onde o
   * profissional receberia 4,70 € de 5 € sem ninguém ter decidido isso.
   *
   * Por omissão zero, e com zero nenhum número desta função muda: é o que
   * mantém certos os quarenta totais escritos à mão nos testes. E é também o
   * perigo — um sítio que se esqueça de o passar não dá erro, dá outro número.
   * Ver `forma-de-pagamento.ts` e os testes que percorrem os chamadores.
   */
  acrescimo = 0,
): ContaDoCliente {
  const servico = aosCentimos(acordado);
  const taxa = aosCentimos(servico * taxas.cliente);
  const extra = aosCentimos(Number.isFinite(acrescimo) && acrescimo > 0 ? acrescimo : 0);

  /*
   * DOIS IMPOSTOS, DE DUAS EMPRESAS — 14-09-2026.
   *
   * "O cliente pagou 107,52 mas a factura é de apenas 103,32." Estava certo: a
   * taxa da CLYON era somada a seco, sem imposto e sem documento. O cliente
   * pagava 4,20 € que não apareciam em factura nenhuma, em todos os trabalhos
   * desde sempre.
   *
   * A CLYON passa a assumir as facturas, e a conta passa a ser valor + taxa +
   * IVA. O total dá o mesmo que somar tudo e aplicar 23 % no fim — o imposto é
   * proporcional — MAS NÃO SE PODE CALCULAR ASSIM:
   *
   * um profissional na isenção do artigo 53.º não liquida imposto nenhum. Com
   * uma conta feita no fim sobre a soma, ele levava 23 % sobre o serviço dele
   * — um imposto que não pode emitir e que ninguém pode entregar ao Estado.
   * Calcula-se por vendedor; só a APRESENTAÇÃO é que junta as duas linhas.
   */
  const semIva = aosCentimos(servico + taxa + extra);

  /*
   * UM IMPOSTO SÓ, SOBRE TUDO — 22-09-2026.
   *
   * "A CLYON vai emitir as facturas a partir de agora, então vamos ignorar os
   * pros: tudo deve ser a 23 % caso deseje factura." E, no mesmo dia: "quem
   * vai facturar será uma empresa parceira chamada Miragem."
   *
   * Não é uma simplificação do ecrã, é o modelo a mudar de mãos. Quem factura
   * ao cliente é a CLYON, em nome próprio, pelo serviço inteiro — e o imposto
   * de uma factura é o de QUEM A EMITE. O regime do profissional passa a ser
   * assunto entre ele e a CLYON, e deixa de tocar no que o cliente paga.
   *
   * Era por isso que esta conta se fazia por vendedor: enquanto o profissional
   * facturava o serviço ao cliente, um profissional na isenção do artigo 53.º
   * não podia liquidar imposto nenhum, e pôr-lhe 23 % era cobrar ao cliente um
   * imposto que ninguém entregaria ao Estado. Com uma factura só, essa razão
   * desaparece — e o seu contrário passa a ser verdade: isentar parte de uma
   * factura dela seria não liquidar imposto que É devido.
   */
  const iva = A_FACTURA_LEVA_IVA ? aosCentimos(semIva * TAXA_IVA) : 0;

  /*
   * A PARTE DO IMPOSTO QUE É DA TAXA, e não do serviço.
   *
   * Sobrevive para um caso só: o trabalho pago em dinheiro ao profissional. Aí
   * o serviço não passa por nós e não se pode facturar — cobra-se a taxa e o
   * imposto dela. Ver `quantoACLYONCobra` em `eupago.ts`.
   *
   * Em tudo o resto quem manda é o `iva` de cima. Não há `ivaDoServico`: a
   * separação existia para duas facturas de duas empresas, e agora é uma.
   */
  const ivaDaTaxa = A_FACTURA_LEVA_IVA ? aosCentimos((taxa + extra) * TAXA_IVA) : 0;

  return {
    servico,
    iva,
    taxa,
    acrescimo: extra,
    ivaDaTaxa,
    semIva,
    total: aosCentimos(semIva + iva),
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
export function servicoMaisTaxa(acordado: number, taxas: Taxas = TAXAS_DE_ORIGEM): number {
  return aosCentimos(acordado * (1 + taxas.cliente));
}

/**
 * O que o profissional recebe: acordado − `TAXA_PROFISSIONAL`.
 *
 * É este o número que se lhe mostra em todo o lado, incluindo no saldo cativo.
 * Nunca o bruto: mostrar 200 retidos e 188 disponíveis levantava a pergunta
 * "onde foram os 12 €", e a resposta certa é que nunca foram dele.
 *
 * SEM IVA, sempre. O imposto que ele liquida, quando liquida, é dele e vai
 * na factura dele ao cliente; não passa por esta conta.
 */
export function quantoOProfissionalRecebe(
  acordado: number,
  taxas: Taxas = TAXAS_DE_ORIGEM,
): number {
  return aosCentimos(acordado * (1 - taxas.profissional));
}

/** O que fica para a CLYON sobre um trabalho fechado. */
export function comissaoDaClyon(acordado: number, taxas: Taxas = TAXAS_DE_ORIGEM): number {
  return aosCentimos(servicoMaisTaxa(acordado, taxas) - quantoOProfissionalRecebe(acordado, taxas));
}
