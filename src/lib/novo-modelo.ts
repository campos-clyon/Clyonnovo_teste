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
import { inicioDoDiaEmLisboa, instanteDaBase } from "./hora-de-lisboa";

/**
 * A ENTRADA EM VIGOR — 00:00 de 15-11-2026 em Lisboa. Em Novembro Lisboa está em
 * UTC (hora de Inverno), por isso «Z» é a meia-noite de Lisboa.
 */
export const NOVO_MODELO_DESDE = new Date("2026-11-15T00:00:00Z");

/** Como os Termos a dizem. Um teste confere que bate com a data de cima. */
export const NOVO_MODELO_DESDE_POR_EXTENSO = "15 de novembro de 2026";

/**
 * A VERSÃO DOS TERMOS E DA PRIVACIDADE DO MODELO NOVO — d20 (CEO e dono,
 * 13-11-2026). Nasce da data única do modelo: a página mostra-a no topo, a caixa
 * de aceitação di-la, e é ela que se grava quando o parceiro aceita. Um teste
 * confere que as três são a mesma.
 *
 * d6 (CEO e dono, 23-11-2026): é uma constante PRÓPRIA, separada de
 * `NOVO_MODELO_DESDE` (que manda nas regras de 15-11). Quando o texto novo dos
 * Termos for publicado, muda-se aqui, com a data real da publicação, e todos
 * os parceiros voltam a aceitar; `NOVO_MODELO_DESDE` não se toca.
 */
export const VERSAO_DOS_TERMOS_ATUAL = "2026-11-15";

/** O nome de sempre: é a versão em vigor (d6, 23-11-2026: já não nasce de `NOVO_MODELO_DESDE`). */
export const VERSAO_DOS_TERMOS = VERSAO_DOS_TERMOS_ATUAL;

/** Como a página e a caixa a dizem. */
export const VERSAO_DOS_TERMOS_POR_EXTENSO = NOVO_MODELO_DESDE_POR_EXTENSO;

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

/**
 * O QUE FICA E O QUE PASSA — d4 (CEO e dono, 18-11-2026). Uma só frase para o
 * valor que o parceiro vê no modelo de 15-11: a /profissionais, o email da
 * contraproposta, o painel e o que a app CLYON Pro lê pela rota diziam só
 * «a taxa», e o que passa à CLYON é a taxa da plataforma E o IVA dela. O teste
 * da orquestra chumba «passa(m) à CLYON» sem «IVA» no que o parceiro lê.
 */
export const FICA_CONSIGO = "fica consigo";
export const A_TAXA_E_O_IVA_DELA_PASSAM_A_CLYON = "a taxa da plataforma e o IVA dela passam à CLYON";
export const FICA_CONSIGO_E_PASSA_A_CLYON = `${FICA_CONSIGO}; ${A_TAXA_E_O_IVA_DELA_PASSAM_A_CLYON}`;

/** A mesma frase, a começar uma linha. */
export const FICA_CONSIGO_E_PASSA_A_CLYON_NO_INICIO =
  FICA_CONSIGO_E_PASSA_A_CLYON.charAt(0).toUpperCase() + FICA_CONSIGO_E_PASSA_A_CLYON.slice(1);

/*
 * ── OS DOIS PRAZOS — d1 (CEO e dono, 18-11-2026) ─────────────────────────────
 *
 * Até aqui faltar qualquer um dos quatro (IBAN, titular, MB WAY, regime de IVA)
 * impedia a 23-11. Passam a ser dois prazos, cada um com a sua regra:
 *
 *   · O MEIO DE RECEBER — basta UM: o IBAN com o titular, OU o número MB WAY.
 *     Aos aprovados antes de 15-11, só aviso até `IBAN_E_MBWAY_OBRIGATORIOS_ATE`
 *     (22-11, 23:59:59 em Lisboa); a partir de 23-11, sem nenhum dos dois, não
 *     aceita nem envia propostas. Os aprovados depois de 15-11, desde o início.
 *   · O REGIME DE IVA — só aviso, para todos, até `REGIME_DE_IVA_EM_AVISO_ATE`
 *     (30-11, 23:59:59 em Lisboa); a partir de 01-12, sem ele confirmado, não
 *     aceita nem envia propostas.
 *
 * As datas fazem-se em hora de Lisboa (`inicioDoDiaEmLisboa`), nunca no fuso de
 * quem corre o código.
 */

/** 00:00 de 23-11-2026 em Lisboa: a partir daqui, sem nenhum meio de receber, impede. */
export const MEIO_DE_RECEBER_OBRIGATORIO_DESDE = inicioDoDiaEmLisboa("2026-11-23");

/** 00:00 de 01-12-2026 em Lisboa: a partir daqui, sem o regime de IVA confirmado, impede. */
export const REGIME_DE_IVA_OBRIGATORIO_DESDE = inicioDoDiaEmLisboa("2026-12-01");

/** O último instante do aviso do regime para quem JÁ aceitou os Termos: 23:59:59 de 30-11-2026 em Lisboa. */
export const REGIME_DE_IVA_EM_AVISO_ATE = new Date(REGIME_DE_IVA_OBRIGATORIO_DESDE.getTime() - 1000);

/**
 * O PRAZO DO REGIME DE IVA É POR PARCEIRO — d6 (CEO e dono, 23-11-2026).
 *
 * O P2B (Regulamento 2019/1150) pede 15 dias de aviso a quem não aceitou a
 * alteração. Por isso o bloqueio vale, para cada parceiro:
 *
 *   · já aceitou a versão em vigor dos Termos → a partir de 01-12
 *     (`REGIME_DE_IVA_OBRIGATORIO_DESDE`);
 *   · não aceitou → a partir do aviso real + 15 dias (e nunca antes de 01-12).
 *     Enquanto o aviso não saiu (`AVISO_DO_REGIME_DE_IVA_ENVIADO_EM` a `null`),
 *     não há data e NÃO se bloqueia: só se mostra o aviso e continua a propor.
 *
 * Até lá o preço continua a descer sozinho a quem é isento (d2 de 19-11).
 */
export const DIAS_DE_AVISO_DO_REGIME_DE_IVA = 15;

/**
 * O INSTANTE em que o aviso real foi enviado aos parceiros. `null` até sair.
 * No dia do envio escreve-se aqui o instante exacto (ISO, com o fuso), p. ex.
 * `new Date("2026-11-24T10:00:00Z")`.
 */
export const AVISO_DO_REGIME_DE_IVA_ENVIADO_EM: Date | null = null;

/** A partir de quando o regime de IVA em falta impede este parceiro, ou `null` (ainda não impede nunca). */
export function regimeDeIvaImpedeDesde(
  aceitouOsTermosAtuais: boolean,
  avisoEnviadoEm: Date | null = AVISO_DO_REGIME_DE_IVA_ENVIADO_EM,
): Date | null {
  if (aceitouOsTermosAtuais) return REGIME_DE_IVA_OBRIGATORIO_DESDE;
  if (!avisoEnviadoEm) return null;
  const depoisDosDias = avisoEnviadoEm.getTime() + DIAS_DE_AVISO_DO_REGIME_DE_IVA * 24 * 3600 * 1000;
  return new Date(Math.max(REGIME_DE_IVA_OBRIGATORIO_DESDE.getTime(), depoisDosDias));
}

/** Como o aviso o diz. Um teste confere que bate com a data de cima. */
export const REGIME_DE_IVA_EM_AVISO_ATE_POR_EXTENSO = "30 de novembro de 2026";

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

/**
 * (2) Os Trabalhos CLYON (valor fixo, a CLYON combina com o cliente) ficam no modelo antigo.
 *
 * d33 (CEO e dono, 15-11-2026, proposta A) e d54 (17-11-2026): os criados a partir de
 * `TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE` passam ao modelo de 15-11; os de antes
 * seguem no antigo até ao fim. A regra é uma só — `trabalhoClyonDoModeloAntigo`
 * (em baixo), pela criação do pedido — e já a perguntam o portão do modelo
 * (`eDoNovoModelo` e as funções do servidor, que lêem a data da base), os
 * Pagamentos, as Carteiras, a carteira do profissional, o fecho, o acesso ao
 * pagamento, a vista da negociação, o aviso da proposta, a Vitória e a retenção.
 *
 * DESLIGADO desde 17-11-2026 (d54, CEO e dono): os Trabalhos CLYON criados a
 * partir de 15-11-2026 seguem o modelo novo — o cliente paga ao parceiro, e o
 * parceiro passa à CLYON a taxa (a referência nasce na confirmação). A página do
 * pedido mostra-lhes o bloco «Pagar a …» (`PagarAoParceiro`, que pergunta ao
 * servidor), as mensagens dizem «Paga ao parceiro», e o backoffice não gera
 * referências ao cliente. Os criados antes continuam no antigo, até ao fim.
 */
export const TRABALHOS_CLYON_NO_MODELO_ANTIGO = false;

/*
 * O interruptor como os testes o querem ver — d33. Os testes provam os dois
 * lados do corte com o interruptor desligado sem mudar a linha de cima
 * (`interruptorDosTrabalhosClyonParaOsTestes(false)`, e `null` no fim). Nada
 * fora dos testes o chama: em produção vale sempre a constante.
 */
let interruptorDosTestes: boolean | null = null;

/** Só para os testes: `false` simula o interruptor desligado; `null` volta à constante. */
export function interruptorDosTrabalhosClyonParaOsTestes(v: boolean | null): void {
  interruptorDosTestes = v;
}

/** Todos os Trabalhos CLYON ficam no antigo (o interruptor ligado)? */
export function trabalhosClyonTodosNoModeloAntigo(): boolean {
  return interruptorDosTestes ?? TRABALHOS_CLYON_NO_MODELO_ANTIGO;
}

/**
 * A CRIAÇÃO QUE PASSA UM TRABALHO CLYON AO MODELO DE 15-11 — d54 (17-11-2026):
 * 00:00 de 15-11-2026 em Lisboa (= UTC em Novembro, hora de Inverno), o mesmo
 * instante do modelo. Era 16-11 (d33).
 */
export const TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE = NOVO_MODELO_DESDE;

/** Como os Termos a dizem: «a partir de …». Um teste confere que bate com a data. */
export const TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE_POR_EXTENSO = "15 de novembro de 2026";

/** O último dia dos Trabalhos CLYON do modelo antigo, como os Termos o dizem: «registados até …». */
export const TRABALHOS_CLYON_NO_MODELO_ANTIGO_ATE_POR_EXTENSO = "14 de novembro de 2026";

/**
 * (3) O regime de IVA é obrigatório no perfil. Desde a d1 (18-11-2026) tem o seu
 * prazo: sem ele confirmado, até 30-11 (`REGIME_DE_IVA_EM_AVISO_ATE`) avisa-se,
 * o cliente vê «a confirmar» e a conta faz-se como com IVA; a partir de 01-12,
 * não aceita nem envia propostas.
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
  /**
   * d33 — quando nasceu o PEDIDO (`simulatorOrders.createdAt`). Só conta num
   * Trabalho CLYON, e só com o interruptor desligado (`trabalhoClyonDoModeloAntigo`).
   */
  pedidoCriadoEm?: Date | string | null;
  /** Quando o cliente pagou à CLYON (a caução ou o total). `null` = nada pago. */
  clientePagouEm?: Date | string | null;
  /**
   * d58 — num Trabalho CLYON, quando o CLIENTE pagou à CLYON, SEJA QUAL FOR A DATA
   * (`clientePagouOTrabalhoClyon` de `taxa-a-passar-a-clyon.ts`). Com ela, o
   * Trabalho CLYON fica no antigo (`trabalhoClyonDoModeloAntigo`).
   */
  clientePagouAClyonEm?: Date | string | null;
  /** Quando ficou contratada (o «acordada»). Para a variante "data_de_contratacao". */
  contratadaEm?: Date | string | null;
  /** Quando o trabalho fechou (o valor do profissional à CLYON nasce aqui). */
  fechadoEm?: Date | string | null;
};

function eTrabalhoClyon(v: unknown): boolean {
  return v != null && v !== "" && v !== 0 && v !== "0";
}

/**
 * UM TRABALHO CLYON SEGUE O MODELO DE 15-11? — d33 (CEO e dono, 15-11-2026).
 *
 * Pela CRIAÇÃO do pedido do Trabalho CLYON (`simulatorOrders.createdAt`): criado
 * a partir de `TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE` → modelo novo (o cliente
 * paga ao parceiro; a CLYON fatura a taxa do escalão); criado antes → modelo
 * antigo, até ao fim. É a data do PEDIDO, e não a de cada negociação: uma
 * negociação nova num Trabalho CLYON antigo (outro parceiro, o mesmo pedido)
 * não muda o que o cliente já aceitou.
 *
 * A data vem da base: um `Date` ou o texto sem fuso (`instanteDaBase`, lido em
 * UTC). Sem data, fica no ANTIGO — nunca se passa um trabalho ao modelo novo
 * por não se saber quando nasceu.
 */
export function trabalhoClyonNoNovoModelo(criadoEm: Date | string | null | undefined, agora: Date): boolean {
  if (!novoModeloEmVigor(agora)) return false;
  const criado = instanteDaBase(criadoEm ?? null);
  if (!criado) return false;
  return criado.getTime() >= TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE.getTime();
}

/**
 * É UM TRABALHO CLYON DO MODELO ANTIGO (a CLYON recebe do cliente e paga ao
 * profissional)? — d33. A PERGUNTA ÚNICA de todos os sítios que antes decidiam
 * só por `ofertaClyon` (ou pelo `valorFixoClyon` do pedido): as contas do
 * backoffice, a carteira, o fecho, a vista do cliente, as mensagens e a Vitória.
 *
 * Não é Trabalho CLYON → `false`. Com o interruptor ligado, todo o Trabalho
 * CLYON é do antigo (como sempre foi). Desligado, só os criados antes do corte.
 */
export function trabalhoClyonDoModeloAntigo(
  n: {
    ofertaClyon?: unknown;
    valorFixoClyon?: unknown;
    pedidoCriadoEm?: Date | string | null;
    /**
     * d58 (CEO e dono, 17-11-2026): o cliente já pagou à CLYON (euPago, ou
     * transferência/numerário anotados como pagos à CLYON — nunca o que o
     * profissional pagou). O dinheiro está com a CLYON e é a CLYON que paga ao
     * profissional: fica no antigo, seja qual for a data. O #623 (criado a 15-11,
     * pago pelo cliente por MB WAY a 17-11) mostrava a conta do modelo novo.
     */
    clientePagouAClyonEm?: Date | string | null;
  },
  agora: Date = new Date(),
): boolean {
  const clyon = eTrabalhoClyon(n.ofertaClyon) || (n.valorFixoClyon != null && n.valorFixoClyon !== "");
  if (!clyon) return false;
  if (trabalhosClyonTodosNoModeloAntigo()) return true;
  if (comoData(n.clientePagouAClyonEm) != null) return true;
  return !trabalhoClyonNoNovoModelo(n.pedidoCriadoEm, agora);
}

/**
 * UM TRABALHO CLYON QUE SEGUE O MODELO DE 15-11, PELO PEDIDO — d54. Para o que
 * ainda não tem pagamentos para ler (a proposta ao cliente, a lista dos Trabalhos
 * CLYON): Trabalho CLYON, o modelo em vigor e criado a partir do corte. Onde há
 * uma negociação contratada, quem decide é o servidor com os pagamentos lidos
 * (`negociacaoNoNovoModelo`): um pago à CLYON antes de mudar fica no antigo.
 */
export function trabalhoClyonDoNovoModelo(
  n: {
    ofertaClyon?: unknown;
    valorFixoClyon?: unknown;
    pedidoCriadoEm?: Date | string | null;
    /** d58: o cliente pagou à CLYON — fica no antigo (`trabalhoClyonDoModeloAntigo`). */
    clientePagouAClyonEm?: Date | string | null;
  },
  agora: Date = new Date(),
): boolean {
  const clyon = eTrabalhoClyon(n.ofertaClyon) || (n.valorFixoClyon != null && n.valorFixoClyon !== "");
  if (!clyon || !novoModeloEmVigor(agora)) return false;
  return !trabalhoClyonDoModeloAntigo(n, agora);
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
  if (
    trabalhoClyonDoModeloAntigo(
      { ofertaClyon: n.ofertaClyon, pedidoCriadoEm: n.pedidoCriadoEm, clientePagouAClyonEm: n.clientePagouAClyonEm },
      agora,
    )
  )
    return false;
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
