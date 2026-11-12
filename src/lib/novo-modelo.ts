/**
 * O MODELO DE 15-11-2026 — o cliente paga ao parceiro — d10 (CEO e dono,
 * 12-11-2026).
 *
 * O cliente paga o trabalho diretamente ao parceiro que contratou (transferência,
 * MB WAY ou dinheiro no local — escolhe o cliente). O parceiro passa à CLYON a
 * taxa da plataforma e o IVA dela, por referência Multibanco ou MB WAY do
 * euPago, uma por trabalho. Duas faturas por trabalho: a da taxa (emitida pela
 * empresa parceira da CLYON) e a do trabalho (emitida pelo parceiro).
 *
 * ESTE FICHEIRO É O SÍTIO ÚNICO DA DATA E DOS INTERRUPTORES. Nada do modelo novo
 * se decide noutro lado: as rotas, os ecrãs e as contas perguntam
 * `novoModeloEmVigor(agora)` e `eDoNovoModelo(negociacao, agora)`.
 *
 * ⚠️ ANTES DA DATA, NADA MUDA. Todas as funções daqui devolvem «modelo antigo»
 * enquanto `agora` for anterior a `NOVO_MODELO_DESDE`. É o que deixa o código
 * estar na main dias antes, inerte.
 *
 * Puro e sem importações de servidor: os ecrãs do cliente e do profissional
 * importam isto.
 */

/**
 * A ENTRADA EM VIGOR — 00:00 de 15-11-2026 em Lisboa. Em Novembro Lisboa está em
 * UTC (hora de Inverno), por isso «Z» é a meia-noite de Lisboa.
 */
export const NOVO_MODELO_DESDE = new Date("2026-11-15T00:00:00Z");

/** Como os Termos a dizem. Um teste confere que bate com a data de cima. */
export const NOVO_MODELO_DESDE_POR_EXTENSO = "15 de novembro de 2026";

/** O nome que os textos do Jurídico usam (exec-d10-juridico, §0). */
export const PAGAMENTO_AO_PARCEIRO_DESDE_POR_EXTENSO = NOVO_MODELO_DESDE_POR_EXTENSO;

/**
 * OS DIAS PARA PAGAR O VALOR EM ATRASO — decisão do dono (12-11-2026): 4 dias
 * sem pagar, e a conta fica em stand-by. Contam-se do fecho do trabalho (o mesmo
 * instante em que o valor nasce — `quandoLiberta` da carteira).
 */
export const DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO = 4;

/**
 * O FIM DO AVISO DO IBAN, DO MB WAY E DO REGIME DE IVA aos parceiros aprovados
 * antes de 15-11 — 7 dias de transição (dono, 12-11-2026). 23:59:59 de 22-11 em
 * Lisboa (= UTC em Novembro). Até lá avisa-se; depois, sem eles, não aceita
 * nem envia propostas. Os aprovados a partir de 15-11 precisam deles desde o
 * primeiro dia.
 */
export const IBAN_E_MBWAY_OBRIGATORIOS_ATE = new Date("2026-11-22T23:59:59Z");

/** Como os Termos o dizem. */
export const IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO = "22 de novembro de 2026";

/*
 * ── AS TRÊS PERGUNTAS AINDA SEM RESPOSTA DO DONO — interruptores ─────────────
 *
 * Postos como o CEO propôs (ordem d10, 12-11-2026). Mudar uma resposta é mudar
 * UMA linha daqui, e os testes de `novo-modelo.test.ts` provam os dois lados.
 */

/**
 * (1) O CORTE. Que trabalhos de antes de 15-11 seguem o modelo antigo?
 *
 *   · "ja_pago_a_clyon" (o do CEO) — só os que o cliente JÁ PAGOU à CLYON (a caução,
 *     ou o valor inteiro, pela plataforma). Contratados mas sem nada pago entram
 *     no modelo novo a 15-11.
 *   · "data_de_contratacao" (a variante A do Jurídico) — tudo o que foi
 *     contratado antes de 15-11 segue o antigo até ao fim.
 *
 * Nas duas, um trabalho que já FECHOU antes de 15-11 (o valor do profissional à
 * CLYON já nasceu) fica no antigo: ninguém vê mudar um número que já nasceu.
 */
export type CorteDoModelo = "ja_pago_a_clyon" | "data_de_contratacao";
export const CORTE_DO_MODELO: CorteDoModelo = "ja_pago_a_clyon";

/** (2) Os Trabalhos CLYON (valor fixo, a CLYON combina com o cliente) ficam no modelo antigo. */
export const TRABALHOS_CLYON_NO_MODELO_ANTIGO = true;

/**
 * (3) O regime de IVA é obrigatório no perfil, com a mesma transição do IBAN: sem
 * ele confirmado, até 22-11 o cliente vê «a confirmar» e a conta faz-se como com
 * IVA; depois, não aceita nem envia propostas.
 */
export const REGIME_DE_IVA_OBRIGATORIO = true;

/*
 * ── O RELÓGIO ───────────────────────────────────────────────────────────────
 *
 * As funções daqui recebem `agora` (os testes passam a data que querem). O
 * servidor passa `agoraDoModelo()` de `relogio-do-modelo.ts`, que aceita uma data
 * simulada fora da produção. Este ficheiro não lê o ambiente: a app CLYON Pro
 * partilha-o (só regras puras).
 */

/** O modelo novo já vale? */
export function novoModeloEmVigor(agora: Date = new Date()): boolean {
  return agora.getTime() >= NOVO_MODELO_DESDE.getTime();
}

function comoData(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** O que é preciso saber de uma negociação para dizer em que modelo está. */
export type NegociacaoParaOModelo = {
  /** Trabalho CLYON de valor fixo (`negociacoes.ofertaClyon`). */
  ofertaClyon?: unknown;
  /** Quando o cliente pagou à CLYON (a caução ou o total). `null` = nada pago. */
  clientePagouEm?: Date | string | null;
  /** Quando ficou contratada (o «acordada»). Para a variante "data_de_contratacao". */
  contratadaEm?: Date | string | null;
  /** Quando o trabalho fechou (o valor do profissional à CLYON nasce aqui). */
  fechadoEm?: Date | string | null;
};

function eTrabalhoClyon(v: unknown): boolean {
  return v != null && v !== "" && v !== 0 && v !== "0";
}

/**
 * ESTA NEGOCIAÇÃO SEGUE O MODELO NOVO?
 *
 * Antes da data, nunca. Depois, sim — menos: um Trabalho CLYON (pergunta 2);
 * um trabalho que o cliente já pagou à CLYON (pergunta 1, as duas variantes);
 * um contratado antes de 15-11 (só na variante "data_de_contratacao"); e um
 * trabalho que fechou antes de 15-11.
 */
export function eDoNovoModelo(n: NegociacaoParaOModelo, agora: Date = new Date()): boolean {
  if (!novoModeloEmVigor(agora)) return false;
  if (TRABALHOS_CLYON_NO_MODELO_ANTIGO && eTrabalhoClyon(n.ofertaClyon)) return false;
  if (comoData(n.clientePagouEm) != null) return false;
  const fechado = comoData(n.fechadoEm);
  if (fechado && fechado.getTime() < NOVO_MODELO_DESDE.getTime()) return false;
  if (CORTE_DO_MODELO === "data_de_contratacao") {
    const contratada = comoData(n.contratadaEm);
    if (contratada && contratada.getTime() < NOVO_MODELO_DESDE.getTime()) return false;
  }
  return true;
}

/**
 * UM PEDIDO NOVO (ainda sem negociação) — o simulador, as páginas, a Vitória.
 * Vale o modelo de hoje: o que dali nascer nasce agora.
 */
export function pedidoNovoNoNovoModelo(agora: Date = new Date()): boolean {
  return novoModeloEmVigor(agora);
}
