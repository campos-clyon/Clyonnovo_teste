import {
  ENTULHO_ATE_10_SACOS,
  ENTULHO_POR_VOLUME,
  ESVAZIAMENTO_POR_TIPOLOGIA,
  MINIMO_DE_SACOS,
  NOME_DO_TAMANHO,
  PECAS_EM_TEXTO,
  PRECOS,
  PRECO_POR_ITEM,
  PRECO_POR_SACO,
  RECOLHA_MINIMA_DOS_MOVEIS,
  RECOLHA_POR_ANDAR_COM_ELEVADOR,
  RECOLHA_POR_ANDAR_SEM_ELEVADOR,
  celulaDaManutencao,
  eEsvaziamentoDeEspaco,
  estimativaDoEspaco,
  notaDosMateriais,
  precoDaPeca,
  type PecaDeReferencia,
} from "./precos-publicos";
import {
  comIva,
  comOSuplemento,
  contaDosSacosEmTexto,
  euros,
  linhasDosAndares,
  referenciaDoEntulho,
  suplementoDosAndares,
  type AcessoDoEntulho,
  type ReferenciaDoEntulho,
  type SuplementoDosAndares,
  type UnidadeDoEntulho,
  type Valor,
} from "./quanto-custa";
import {
  HORAS_A_MAIS_COM_DESMONTAGEM,
  HORAS_POR_TIPOLOGIA,
  MINIMO_DE_HORAS,
  PESSOAS_NA_EQUIPA,
  PRECO_POR_HORA,
  RAIO_INCLUIDO_KM,
  TIPOLOGIA_POR_EXTENSO,
  orcamentoDaMudanca,
  type OrcamentoDaMudanca,
  type PedidoDeMudanca,
} from "./tabela-das-mudancas";
import { PERGUNTAS_DO_ESPACO, acessoDificilDoEspaco } from "./perguntas-do-espaco";
import { precoPublicoConhecido, REFERENCIA_DA_MUDANCA, type PrecoPublicoDasMudancas } from "./preco-publico-das-mudancas";
import { horasDaMudanca } from "./lista-de-parceiros-da-mudanca";
import { referenciaEmTresLinhas, type PrecoEmTresLinhas } from "./preco-em-tres-linhas";
import { TAXA_IVA } from "./taxas-plataforma";
import { PESO_DO_SACO, SACOS_POR_CARGA, SACOS_POR_METRO_CUBICO, lerQuantidadeDeEntulho } from "./sacos-de-entulho";
import {
  CARGAS_DO_ENTULHO,
  QUANTO_TRABALHO,
  REPETICOES,
  TIPOS_DE_TRABALHO,
  ZONAS_EM_FRASE,
  inteiroDaResposta,
  lerAcesso,
  lerDesmontagem,
  lerEntulho,
  lerManutencao,
  lerRecheio,
  lerTipologiaDoEsvaziamento,
  localidadeServida,
  nomeDaOpcao,
  razoesDoAcessoDificil,
  type AcessoDoPedido,
  type EntulhoDoPedido,
  type EstadoDoEntulho,
  type MedidaDoEntulho,
  type Recheio,
  type RespostasDaManutencao,
} from "./respostas-do-simulador";

/**
 * O PREÇO DE REFERÊNCIA, IGUAL NO SITE E NA APP — 29-10-2026 (S13, P10 (a)).
 *
 * *«O simulador do site e o da app mostram o preço de referência de cada
 * serviço com o IVA ao lado, igual nos dois.»* — o dono, 29-10-2026.
 *
 * Puro (sem base, sem React): o simulador do site lê-o no browser, e a R12
 * (`POST /api/cliente/referencia`) devolve à app exactamente as mesmas frases.
 * Nenhum número se escreve aqui: saem de `precos-publicos.ts` e de
 * `tabela-das-mudancas.ts`. O sem IVA nunca vai sozinho.
 *
 * Nunca o motor (`/api/simulator/analyze`): a estimativa calculada para o
 * pedido deixou de se mostrar a 18-09 porque ancorava o preço antes das
 * propostas (P10 (b), não escolhida).
 */

/** «40 – 120 €» */
const faixa = (de: number, ate: number) => `${euros(de).replace(" €", "")} – ${euros(ate)}`;
/** «49,20 – 147,60 €» */
const faixaComIva = (de: number, ate: number) => `${euros(comIva(de)).replace(" €", "")} – ${euros(comIva(ate))}`;

/** «30 – 100 € + IVA (36,90 – 123 € com IVA)» */
export const faixaSemEComIva = (de: number, ate: number) => `${faixa(de, ate)} + IVA (${faixaComIva(de, ate)} com IVA)`;

/** «80 € + IVA (98,40 € com IVA)» */
export const valorSemEComIva = (v: number) => `${euros(v)} + IVA (${euros(comIva(v))} com IVA)`;

/*
 * O SEM IVA NUNCA SOZINHO, TAMBÉM NAS LISTAS — 31-10-2026 (ordem do CEO).
 *
 * O artigo do sofá listava as peças só com o sem IVA, e os cartões de
 * /contactos e as grelhas do esvaziamento mostravam o número nu por cima de
 * «Valores orientativos, sem IVA». Cada valor leva o com IVA ao lado.
 */

/** «peça grande, 50 € + IVA (61,50 € com IVA)» — o preço de uma peça de `PECAS_DE_REFERENCIA` (d7: pela tabela das peças). */
export const precoDaPecaComOIva = (p: PecaDeReferencia) => `${NOME_DO_TAMANHO[p.tamanho]}, ${valorSemEComIva(precoDaPeca(p))}`;

/** «Sofá de 2 a 3 lugares: peça grande, 50 € + IVA (61,50 € com IVA)» — as peças de `PECAS_DE_REFERENCIA`. */
export const pecaComOIvaAoLado = (p: PecaDeReferencia) => `${p.peca}: ${precoDaPecaComOIva(p)}`;

/** «260 – 350 € + IVA (319,80 – 430,50 € com IVA)», «desde 450 € + IVA (553,50 € com IVA)» — uma linha de `ESVAZIAMENTO_POR_TIPOLOGIA`. */
export function esvaziamentoComOIvaAoLado(chave: string): string {
  const t = ESVAZIAMENTO_POR_TIPOLOGIA.find((x) => x.chave === chave);
  if (!t) throw new Error(`Tipologia de esvaziamento desconhecida: ${chave}`);
  return t.maximo != null ? faixaSemEComIva(t.minimo, t.maximo) : `desde ${valorSemEComIva(t.minimo)}`;
}

/*
 * OS MÓVEIS POR PEÇA, NA FRASE — 03-11-2026 (decisão d6 v2). A recolha de
 * móveis deixou de ser «40 – 120 €» pelo trabalho: é peça a peça, com o com IVA
 * de cada uma ao lado.
 */
const PECAS_PELA_ORDEM = ["pequeno", "medio", "grande"] as const;
const NOMES_DAS_PECAS: Readonly<Record<(typeof PECAS_PELA_ORDEM)[number], string>> = { pequeno: "pequena", medio: "média", grande: "grande" };

/** «18,45 / 36,90 / 61,50 €» — o com IVA de cada peça (pequena, média, grande). */
export const PECAS_COM_IVA = `${PECAS_PELA_ORDEM.map((t) => euros(comIva(PRECO_POR_ITEM[t])).replace(" €", "")).join(" / ")} €`;

/** «40 € + IVA (49,20 € com IVA)» — a recolha mínima dos móveis (d7, 04-11-2026). */
export const RECOLHA_MINIMA_COM_IVA = valorSemEComIva(RECOLHA_MINIMA_DOS_MOVEIS);

/** «A recolha mínima, 40 € + IVA (49,20 € com IVA), já inclui o parceiro ir a casa, carregar e levar tudo ao destino certo.» */
export const O_QUE_INCLUI_A_RECOLHA_MINIMA = `A recolha mínima, ${RECOLHA_MINIMA_COM_IVA}, já inclui o parceiro ir a casa, carregar e levar tudo ao destino certo.`;

/**
 * «por peça: pequena 15 €, média 30 €, grande 50 € + IVA (18,45 / 36,90 / 61,50
 * € com IVA); recolha mínima 40 € + IVA (49,20 € com IVA)» — a frase pública dos
 * móveis (d6; a recolha mínima desde a d7).
 */
export const MOVEIS_POR_PECA = `por peça: ${PECAS_EM_TEXTO} + IVA (${PECAS_COM_IVA} com IVA); recolha mínima ${RECOLHA_MINIMA_COM_IVA}`;

/**
 * «por peça, 15 a 50 € + IVA (18,45 a 61,50 € com IVA), mínimo 40 € + IVA» —
 * onde a frase inteira não cabe (descrições, cartões).
 */
export const MOVEIS_POR_PECA_CURTO = `por peça, ${euros(PRECO_POR_ITEM.pequeno).replace(" €", "")} a ${euros(PRECO_POR_ITEM.grande)} + IVA (${euros(comIva(PRECO_POR_ITEM.pequeno)).replace(" €", "")} a ${euros(comIva(PRECO_POR_ITEM.grande))} com IVA), mínimo ${euros(RECOLHA_MINIMA_DOS_MOVEIS)} + IVA`;

/**
 * «Recolhem desde uma única peça. Cada peça conta pela tabela (pequena 15 €,
 * média 30 €, grande 50 € + IVA) e cada recolha tem um mínimo de 40 € + IVA
 * (49,20 € com IVA), que já inclui ir a sua casa, carregar e levar ao destino
 * certo.» — a resposta do /faq a «Recolhem apenas uma peça?» (d7, 04-11-2026; era
 * «Não há mínimo de volume»).
 */
export const DESDE_UMA_PECA =
  `Recolhem desde uma única peça. Cada peça conta pela tabela (${PECAS_EM_TEXTO} + IVA) e cada recolha tem um mínimo de ` +
  `${RECOLHA_MINIMA_COM_IVA}, que já inclui ir a sua casa, carregar e levar ao destino certo.`;

/** «50 € + IVA (61,50 € com IVA)» — uma peça grande (um sofá, um armário, uma cama de casal). */
export const PECA_GRANDE = `${euros(PRECO_POR_ITEM.grande)} + IVA (${euros(comIva(PRECO_POR_ITEM.grande))} com IVA)`;

/** «…, mais 5 € + IVA por andar com elevador e 15 € + IVA por andar sem elevador» — os andares dos móveis por peça (d6). */
export const ANDARES_DOS_MOVEIS = `mais ${euros(RECOLHA_POR_ANDAR_COM_ELEVADOR)} + IVA por andar com elevador e ${euros(RECOLHA_POR_ANDAR_SEM_ELEVADOR)} + IVA por andar sem elevador`;

/**
 * «por peça: … (… com IVA); recolha mínima 40 € + IVA (49,20 € com IVA); e,
 * depois do mínimo, mais 5 € + IVA por andar com elevador e 15 € + IVA por andar
 * sem elevador» — os andares somam-se DEPOIS do mínimo (d7).
 */
export const MOVEIS_POR_PECA_COM_OS_ANDARES = `${MOVEIS_POR_PECA}; e, depois do mínimo, ${ANDARES_DOS_MOVEIS}`;

/** «por peça: pequena 18,45 €, média 36,90 €, grande 61,50 € com IVA; recolha mínima 49,20 € com IVA» — a linha pequena de um cartão. */
export const MOVEIS_POR_PECA_COM_IVA =
  `por peça: ${PECAS_PELA_ORDEM.map((t) => `${NOMES_DAS_PECAS[t]} ${euros(comIva(PRECO_POR_ITEM[t]))}`).join(", ")} com IVA; ` +
  `recolha mínima ${euros(comIva(RECOLHA_MINIMA_DOS_MOVEIS))} com IVA`;

/**
 * Só o com IVA da etiqueta de um serviço — «49,20 – 147,60 € com IVA»,
 * «desde 307,50 € com IVA», «desde 147,60 €/m³ com IVA», «61,50 €/hora com
 * IVA» —, para a linha pequena por baixo de `maisIva(etiqueta)` num cartão
 * onde a frase inteira não cabe. `null` quando o serviço não publica preço.
 */
export function comIvaDaEtiqueta(servico: string): string | null {
  const p = PRECOS[servico];
  if (!p || p.minimo == null) return null;
  if (servico === "mudanca") {
    // Ao preço de cada parceiro (11-11-2026): o «desde» conhecido, ou a referência.
    const pp = precoPublicoConhecido();
    return pp.tipo === "parceiros" ? `desde ${euros(pp.desde.comIvaCent / 100)}/hora com IVA` : `${euros(comIva(PRECO_POR_HORA))}/hora com IVA`;
  }
  if (servico === "recolha_moveis") return MOVEIS_POR_PECA_COM_IVA;
  const u = p.unidade ? `/${p.unidade}` : "";
  if (p.maximo != null && !/^desde\b/.test(p.etiqueta)) return `${faixaComIva(p.minimo, p.maximo)}${u} com IVA`;
  return `desde ${euros(comIva(p.minimo))}${u} com IVA`;
}

/*
 * O ENTULHO NUMA FRASE — 04-11-2026 (decisão d7): por saco, e o m³ (ensacado
 * ou a granel) ao mesmo preço. Para as respostas das páginas de cidade e do
 * blog, onde dizia «desde 120 €/m³».
 */
const centimosDoSaco = (v: number) => v.toFixed(2).replace(".", ",");

/** «4,00 a 4,80 €» e «4,92 a 5,90 €» — o saco por extenso, sem e com IVA. */
const PRECO_POR_SACO_POR_EXTENSO = `${centimosDoSaco(PRECO_POR_SACO.minimo)} a ${centimosDoSaco(PRECO_POR_SACO.maximo)} €`;
const PRECO_POR_SACO_COM_IVA_POR_EXTENSO = `${centimosDoSaco(comIva(PRECO_POR_SACO.minimo))} a ${centimosDoSaco(comIva(PRECO_POR_SACO.maximo))} €`;

/** «4,00–4,80 € + IVA (4,92–5,90 € com IVA)» — um saco de obra. */
export const SACO_COM_IVA =
  `${centimosDoSaco(PRECO_POR_SACO.minimo)}–${centimosDoSaco(PRECO_POR_SACO.maximo)} € + IVA ` +
  `(${centimosDoSaco(comIva(PRECO_POR_SACO.minimo))}–${centimosDoSaco(comIva(PRECO_POR_SACO.maximo))} € com IVA)`;

/**
 * «por saco, 4,00–4,80 € + IVA (4,92–5,90 € com IVA), com o mínimo de 10 sacos;
 * 1 m³, uns 40 sacos, ensacado ou a granel, fica em 160 – 192 € + IVA (196,80 –
 * 236,16 € com IVA)».
 */
export const ENTULHO_EM_FRASE =
  `por saco, ${SACO_COM_IVA}, com o mínimo de ${MINIMO_DE_SACOS} sacos; ` +
  `${ENTULHO_POR_VOLUME[0].m3} m³, uns ${ENTULHO_POR_VOLUME[0].sacos} sacos, ensacado ou a granel, fica em ${faixaSemEComIva(ENTULHO_POR_VOLUME[0].de, ENTULHO_POR_VOLUME[0].ate)}`;

/**
 * A resposta do /faq a «Há custo de deslocação?» (d7, 04-11-2026): nos móveis
 * por peça e no entulho em sacos a deslocação já está no preço — a recolha
 * mínima dos móveis e o mínimo de 10 sacos do entulho. Nos outros, a proposta.
 */
export const A_DESLOCACAO_NO_PRECO =
  `Nos móveis por peça e no entulho em sacos, a deslocação já está no preço: a recolha mínima é de ${RECOLHA_MINIMA_COM_IVA} nos móveis, ` +
  `e de ${MINIMO_DE_SACOS} sacos, ${faixaSemEComIva(ENTULHO_ATE_10_SACOS.minimo, ENTULHO_ATE_10_SACOS.maximo)}, no entulho. ` +
  "Nos outros serviços, entra na proposta de cada parceiro.";

/**
 * A resposta da FAQ de /recolha-de-entulho a «Quanto custa?» (d7, 04-11-2026,
 * o texto do Apoio): o saco, o mínimo de 10, o granel ao mesmo preço e os
 * andares por recolha.
 */
export const ENTULHO_NA_FAQ =
  `Cada saco de ${PESO_DO_SACO} conta ${PRECO_POR_SACO_POR_EXTENSO} + IVA (${PRECO_POR_SACO_COM_IVA_POR_EXTENSO} com IVA), ` +
  `com um mínimo de ${MINIMO_DE_SACOS} sacos por recolha: ${euros(ENTULHO_ATE_10_SACOS.minimo).replace(" €", "")} a ${euros(ENTULHO_ATE_10_SACOS.maximo)} + IVA ` +
  `(${euros(comIva(ENTULHO_ATE_10_SACOS.minimo)).replace(" €", "")} a ${euros(comIva(ENTULHO_ATE_10_SACOS.maximo))} com IVA). ` +
  "Solto, a granel, conta-se pelo mesmo preço dos sacos. " +
  `Os andares somam por recolha: +${euros(RECOLHA_POR_ANDAR_COM_ELEVADOR)} + IVA por andar com elevador, +${euros(RECOLHA_POR_ANDAR_SEM_ELEVADOR)} + IVA sem elevador.`;

/** A nota que vai por baixo de qualquer preço de referência (G2). */
export const NOTA_DOS_PRECOS =
  "Valor de referência. O preço de cada trabalho é o da proposta do parceiro que escolher, e na proposta já vem com IVA incluído.";

/** O rótulo da linha do serviço (nas listas de preços; já não no simulador, desde a d6). */
export const ROTULO_DA_REFERENCIA = "Preço de referência";

/*
 * «ESTIMATIVA» — 03-11-2026 (decisão d6): *«Remova o Preço de referência de todo
 * o simulador»* — o dono. O bloco do simulador (site e app) mostra só a
 * estimativa do que o cliente escolheu, com a conta à vista no porquê; a linha
 * geral da faixa do serviço deixou de aparecer.
 */
export const ROTULO_DA_ESTIMATIVA = "Estimativa";

/**
 * O preço de referência de um serviço, já com o IVA ao lado, ou `null` quando
 * o serviço não publica preço («Outro serviço»).
 */
export function precoDeReferencia(servico: string | null | undefined): string | null {
  if (!servico) return null;
  if (servico === "recolha_moveis") return MOVEIS_POR_PECA;
  if (servico === "mudanca") {
    // Ao preço de cada parceiro (11-11-2026): o «desde» conhecido (equipa de 2), ou a referência.
    const pp = precoPublicoConhecido();
    if (pp.tipo === "parceiros") {
      return `desde ${euros(pp.desde.semIvaCent / 100)}/hora + IVA (${euros(pp.desde.comIvaCent / 100)}/hora com IVA), equipa de 2 — cada parceiro tem o seu preço`;
    }
    return REFERENCIA_DA_MUDANCA;
  }
  if (servico === "recolha_entulho") {
    // O m³ ao preço dos sacos, ensacado ou a granel (d7, 04-11-2026): era «desde 120 €/m³».
    const umMetro = ENTULHO_POR_VOLUME[0];
    return (
      `10 sacos ${faixaSemEComIva(ENTULHO_ATE_10_SACOS.minimo, ENTULHO_ATE_10_SACOS.maximo)}; ` +
      `${umMetro.m3} m³ (${umMetro.sacos} sacos, ou a granel) ${faixaSemEComIva(umMetro.de, umMetro.ate)}`
    );
  }
  const p = PRECOS[servico];
  if (!p || p.minimo == null) return null;
  // Garagem, sótão e cave (29-10-2026): «desde», e a faixa só com o volume escolhido.
  if (eEsvaziamentoDeEspaco(servico)) return `desde ${valorSemEComIva(p.minimo)}`;
  if (p.maximo != null) return faixaSemEComIva(p.minimo, p.maximo);
  return `desde ${valorSemEComIva(p.minimo)}`;
}

/** «Preço de referência: 40 – 120 € + IVA (49,20 – 147,60 € com IVA)» */
export function linhaDeReferencia(servico: string | null | undefined): string | null {
  const texto = precoDeReferencia(servico);
  return texto ? `${ROTULO_DA_REFERENCIA}: ${texto}` : null;
}

/* ── Móveis por item ─────────────────────────────────────────────────── */

export type ItensDosMoveis = { pequeno?: number; medio?: number; grande?: number };
export type TamanhoDoItem = keyof typeof PRECO_POR_ITEM;

const inteiro = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(99, Math.floor(n))) : 0);

/** «25 €/un + IVA (30,75 € com IVA)» — a etiqueta de cada tamanho. */
export function precoDoItem(tamanho: TamanhoDoItem): string {
  const v = PRECO_POR_ITEM[tamanho];
  return `${euros(v)}/un + IVA (${euros(comIva(v))} com IVA)`;
}

/**
 * A conta das peças, sem IVA: `soma` peça a peça e `total`, que nunca fica
 * abaixo da recolha mínima (d7, 04-11-2026: `RECOLHA_MINIMA_DOS_MOVEIS`, 40 €;
 * na d6 não havia mínimo, e antes era 80 €). `pelaRecolhaMinima` diz se o
 * mínimo subiu a soma. Sem peças, tudo a zero.
 */
export function contaDosItens(itens: ItensDosMoveis): {
  quantos: number;
  pequeno: number;
  medio: number;
  grande: number;
  soma: number;
  total: number;
  pelaRecolhaMinima: boolean;
} {
  const pequeno = inteiro(itens.pequeno);
  const medio = inteiro(itens.medio);
  const grande = inteiro(itens.grande);
  const quantos = pequeno + medio + grande;
  const soma = pequeno * PRECO_POR_ITEM.pequeno + medio * PRECO_POR_ITEM.medio + grande * PRECO_POR_ITEM.grande;
  const pelaRecolhaMinima = quantos > 0 && soma < RECOLHA_MINIMA_DOS_MOVEIS;
  return { quantos, pequeno, medio, grande, soma, total: pelaRecolhaMinima ? RECOLHA_MINIMA_DOS_MOVEIS : soma, pelaRecolhaMinima };
}

/** «Total estimado» — no seletor das peças e no resumo (d6: era «Total de referência»). */
export const ROTULO_DO_TOTAL_DOS_ITENS = "Total estimado";

/** «140 € + IVA (172,20 € com IVA).» — só as peças (já com a recolha mínima), sem os andares. `null` sem itens. */
export function totalDosItens(itens: ItensDosMoveis): string | null {
  const c = contaDosItens(itens);
  return c.quantos === 0 ? null : `${valorSemEComIva(c.total)}.`;
}

/* ── Mudança ─────────────────────────────────────────────────────────── */

export const ROTULO_DA_ESTIMATIVA_DA_MUDANCA = "Estimativa para a sua mudança";

/**
 * A estimativa de uma mudança, pelo preço público (11-11-2026):
 *   · com parceiros na lista — «cerca de 5,5 h com 2 pessoas — desde 220 € + IVA
 *     (270,60 € com IVA), ao preço por hora mais baixo da lista. …»;
 *   · sem eles — «cerca de 4 h — 200 € + IVA (246 € com IVA) na referência
 *     (equipa de 3). …».
 * `horasCom2` são as horas da mesma casa com 2 pessoas (`horasDaMudanca`).
 */
export function estimativaDaMudanca(
  conta: Pick<OrcamentoDaMudanca, "horas" | "totalSemIva">,
  preco: PrecoPublicoDasMudancas = precoPublicoConhecido(),
  horasCom2?: number,
): string {
  if (preco.tipo === "parceiros" && horasCom2 != null && horasCom2 > 0) {
    const total = Math.round(horasCom2 * preco.desde.semIvaCent) / 100;
    return (
      `cerca de ${String(horasCom2).replace(".", ",")} h com 2 pessoas — desde ${valorSemEComIva(total)}, ao preço por hora mais baixo da lista. ` +
      "Na lista vê a conta de cada parceiro, com os km e o material; o total sai do que confirma na folha do dia."
    );
  }
  const horas = String(conta.horas).replace(".", ",");
  return (
    `cerca de ${horas} h — ${valorSemEComIva(conta.totalSemIva)} na referência (equipa de ${PESSOAS_NA_EQUIPA}). ` +
    "Cada parceiro tem o seu preço por hora; o total sai das horas, dos km e do material que confirma na folha do dia."
  );
}

/** A estimativa em cêntimos para o «desde» com 2 pessoas, ou null sem parceiros. */
function totalDesdeComDuas(preco: PrecoPublicoDasMudancas, horasCom2: number): number | null {
  return preco.tipo === "parceiros" ? Math.round(horasCom2 * preco.desde.semIvaCent) / 100 : null;
}

/* ── Garagem, sótão e cave ───────────────────────────────────────────── */

export const ROTULO_DA_ESTIMATIVA_DO_ESPACO = ROTULO_DA_ESTIMATIVA;

/** Sem número para «não sei»: a proposta sai das fotografias. */
export const PROPOSTA_COM_FOTOGRAFIAS = "Proposta com fotografias.";

/**
 * «120 – 180 € + IVA (147,60 – 221,40 € com IVA)», e com acesso difícil «o topo
 * da faixa»; «Proposta com fotografias.» quando não sabe o volume.
 */
export function estimativaDoEspacoEmPalavras(servico: string, volume: string, acessoDificil = false): string {
  const e = estimativaDoEspaco(servico, volume, acessoDificil);
  if (!e) return PROPOSTA_COM_FOTOGRAFIAS;
  const faixa = faixaSemEComIva(e.de, e.ate);
  return acessoDificil ? `${valorSemEComIva(e.ate)}, o topo da faixa (${faixa}), pelo acesso difícil.` : `${faixa}.`;
}

/* ── O pedido inteiro (R12 e o simulador do site) ────────────────────── */

/*
 * A REFERÊNCIA QUE SE ADAPTA — 03-11-2026 (decisão d1, ordem do CEO com o sim
 * do dono).
 *
 * *«A referência nunca muda.»* — o dono, na app de cliente: ficava «10 sacos
 * 40–50 € + IVA» até ao fim, mesmo com 50 sacos. A R12 ignorava o entulho que a
 * app mandava, não lia o acesso nem a manutenção, e a conta do entulho era
 * sempre `null`.
 *
 * Agora a referência é a de AQUELE pedido: a categoria e as respostas dela
 * (`simulador-por-categoria.ts`), o andar, o elevador, o estacionamento e a
 * localidade mudam a direcção do valor — e cada mudança diz porquê, em linhas
 * curtas (`porque`). Desde a d4 e a d6 (03-11-2026) o entulho e os móveis
 * mostram a conta nessas linhas, com «+ IVA» em cada número: «50 sacos ×
 * 4,00–4,80 € = 200–240 € + IVA», «2 peças grandes × 50 € = 100 € + IVA»,
 * «2.º andar com elevador: +10 € + IVA».
 *
 * NENHUM NÚMERO NOVO. O entulho é a calculadora da página (`referenciaDoEntulho`,
 * a grelha lida ao contrário); o esvaziamento, a linha de
 * `ESVAZIAMENTO_POR_TIPOLOGIA`; o acesso difícil leva ao TOPO da faixa
 * publicada, nunca acima (a regra da garagem, `acessoDificilDoEspaco`); a
 * mudança é a tabela, que já conta os andares (não se conta duas vezes). Onde
 * não há regra publicada — a manutenção por tipo, um suplemento de zona —, não
 * se inventa: fica o «desde», e o porquê diz que entra na proposta.
 */

export type PedidoParaReferencia = {
  servico: string;
  /** Garagem, sótão e cave: a faixa do volume e se o acesso é difícil (29-10-2026). */
  volume?: string | null;
  acessoDificil?: boolean;
  /** Garagem, sótão e cave: a resposta de «Como se chega…?» (para o porquê). */
  acessoDoEspaco?: string | null;
  movelModo?: "carga" | "item";
  itens?: ItensDosMoveis;
  mudanca?: PedidoDeMudanca;
  /** O entulho, já lido (`lerEntulho`): o estado e como disse a quantidade (d1). */
  entulho?: EntulhoDoPedido | null;
  /** Esvaziamento de casa ou de apartamento: a chave de `ESVAZIAMENTO_POR_TIPOLOGIA` (d1). */
  tipologia?: string | null;
  recheio?: Recheio | null;
  manutencao?: RespostasDaManutencao;
  /** O andar, o elevador e o estacionamento (todos menos a mudança, que os tem em cada ponta). */
  acesso?: AcessoDoPedido;
  localidade?: string | null;
  /** A descrição e as fotografias: hoje não mexem no número; vão ao ajuste aprendido (Fase 2). */
  descricao?: string | null;
  fotografias?: number | null;
};

export type LinhaDeReferencia = { rotulo: string; texto: string };

export type ReferenciaDoPedido = {
  linhas: LinhaDeReferencia[];
  nota: string;
  conta: PrecoEmTresLinhas | null;
  /**
   * Porque é esta a estimativa — linhas curtas. No entulho e nos móveis, a conta
   * com «+ IVA» (d4, d6): «50 sacos × 4,00–4,80 € = 200–240 € + IVA».
   */
  porque: string[];
};

/** Uma estimativa, sempre a partir de números publicados. */
export type Estimativa =
  | { tipo: "faixa"; de: number; ate: number }
  | { tipo: "topo"; de: number; ate: number; motivo: string }
  | { tipo: "inicio"; de: number; ate: number; motivo: string }
  | { tipo: "desde"; de: number }
  | { tipo: "valor"; valor: number }
  | { tipo: "proposta" };

const tres = (de: number, ate: number | null, desde = false) => referenciaEmTresLinhas(de, ate, comIva, TAXA_IVA, desde);

/** A estimativa numa frase, com o IVA ao lado — as mesmas frases da garagem (29-10-2026). */
function escritaDaEstimativa(e: Estimativa): string {
  switch (e.tipo) {
    case "faixa":
      return `${faixaSemEComIva(e.de, e.ate)}.`;
    case "topo":
      return `${valorSemEComIva(e.ate)}, o topo da faixa (${faixaSemEComIva(e.de, e.ate)}), ${e.motivo}.`;
    case "inicio":
      return `desde ${valorSemEComIva(e.de)}, o início da faixa (${faixaSemEComIva(e.de, e.ate)}), ${e.motivo}.`;
    case "desde":
      return `desde ${valorSemEComIva(e.de)}.`;
    case "valor":
      return `${valorSemEComIva(e.valor)}.`;
    case "proposta":
      return PROPOSTA_COM_FOTOGRAFIAS;
  }
}

/** A mesma estimativa em três linhas (Serviço / IVA / Total). `null` sem número. */
function contaDaEstimativa(e: Estimativa): PrecoEmTresLinhas | null {
  switch (e.tipo) {
    case "faixa":
      return tres(e.de, e.ate);
    case "topo":
      return tres(e.ate, null);
    case "inicio":
    case "desde":
      return tres(e.de, null, true);
    case "valor":
      return tres(e.valor, null);
    case "proposta":
      return null;
  }
}

/* ── O ajuste aprendido (Fase 2, do I&D) ───────────────────────────────── */

export type AjusteAprendido = { fator: number; porque: string | null };

/** Neutro: fator 1, sem porquê. */
export const SEM_AJUSTE: AjusteAprendido = Object.freeze({ fator: 1, porque: null }) as AjusteAprendido;

/**
 * O PONTO ÚNICO DOS AJUSTES APRENDIDOS — 03-11-2026 (d1). Mais tarde, os valores
 * que o admin e os assistentes põem nos trabalhos ensinam a referência; o I&D
 * liga-o aqui na Fase 2. Hoje devolve neutro.
 *
 * Regra do CEO: o aprendido move a referência só DENTRO da faixa publicada
 * (`dentroDaFaixa`). Sair dela é uma decisão na página — um preço muda em todo
 * o lado, ou não muda.
 */
export function ajusteAprendido(_servico: string, _contexto: PedidoParaReferencia): AjusteAprendido {
  return SEM_AJUSTE;
}

/** Move as duas pontas de uma faixa pelo fator, sem nunca sair dela. Com o fator 1, a faixa fica. */
export function dentroDaFaixa(de: number, ate: number, fator: number): { de: number; ate: number } {
  if (!Number.isFinite(fator) || fator <= 0 || fator === 1) return { de, ate };
  const mover = (v: number) => Math.min(ate, Math.max(de, Math.round(v * fator)));
  return { de: mover(de), ate: mover(ate) };
}

function comAjuste(e: Estimativa, a: AjusteAprendido): Estimativa {
  if (e.tipo !== "faixa" || a.fator === 1) return e;
  const f = dentroDaFaixa(e.de, e.ate, a.fator);
  return f.de === f.ate ? { tipo: "valor", valor: f.de } : { tipo: "faixa", de: f.de, ate: f.ate };
}

/* ── A manutenção da casa: o ponto da grelha por tipo ───────────────────── */

/**
 * A GRELHA DA MANUTENÇÃO POR TIPO DE TRABALHO — o ponto único onde entra (d1).
 * Desde a v2 (03-11-2026, aprovada pelo dono) lê `MANUTENCAO_POR_TIPO` de
 * `precos-publicos.ts`: a faixa (ou o «desde») do tipo e do tamanho do
 * trabalho, ou `estimativa: null` quando é proposta com fotografias, e a nota
 * dos materiais. `null` enquanto não houver as duas respostas: fica o
 * «desde 57 € + IVA» do serviço.
 */
export function grelhaDaManutencao(
  r: RespostasDaManutencao,
): { estimativa: Estimativa | null; porDivisao: boolean; nota: string | null; trabalho: string } | null {
  const c = celulaDaManutencao(r.tipoDeTrabalho, r.quantoTrabalho);
  if (!c) return null;
  const cel = c.celula;
  const estimativa: Estimativa | null =
    cel.tipo === "faixa" ? { tipo: "faixa", de: cel.de, ate: cel.ate } : cel.tipo === "desde" ? { tipo: "desde", de: cel.de } : null;
  return {
    estimativa,
    porDivisao: cel.tipo === "desde" && cel.porDivisao === true,
    nota: estimativa ? notaDosMateriais(c.trabalho) : null,
    trabalho: c.trabalho,
  };
}

/* ── As linhas do porquê ───────────────────────────────────────────────── */

const ENTRA_NA_PROPOSTA = "o parceiro tem-no em conta na proposta";
const PELO_ACESSO = "pelo acesso difícil";
const m3EmTexto = (m3: number) => String(m3).replace(".", ",");
const sacosEmTexto = (n: number) => `${n} ${n === 1 ? "saco" : "sacos"}`;
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const minusculaDe = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const MAIOR_VOLUME_DO_ENTULHO = ENTULHO_POR_VOLUME[ENTULHO_POR_VOLUME.length - 1].m3;

/** O acesso difícil por palavras: o da garagem, do sótão e da cave, o andar sem elevador, o estacionamento. */
function razoesDoAcesso(p: PedidoParaReferencia): string[] {
  const r: string[] = [];
  if (eEsvaziamentoDeEspaco(p.servico) && p.acessoDoEspaco) {
    const o = PERGUNTAS_DO_ESPACO[p.servico]?.acesso.opcoes.find((x) => x.valor === p.acessoDoEspaco && x.dificil);
    if (o) r.push(o.texto);
  }
  r.push(...razoesDoAcessoDificil(p.acesso));
  if (r.length === 0 && p.acessoDificil) r.push("Acesso difícil");
  return r;
}

/* ── O entulho e os móveis: uma só conta para a R12, o site e o motor ───── */

export type QuantidadeDoEntulho = { quantidade: number; unidade: UnidadeDoEntulho };

/**
 * A quantidade do entulho na unidade da calculadora (`referenciaDoEntulho`): os
 * sacos e os big bags contam-se saco a saco; o volume a granel em m³; as cargas
 * («Enche uma carrinha») em sacos — menos no chão, onde são entulho solto e vão
 * a granel, em m³ (d4, 03-11-2026). Desde a d7 (04-11-2026) o m³ conta-se pelos
 * sacos que faz (40), ao mesmo preço: a unidade só muda o porquê.
 */
export function quantidadeDoEntulho(m: MedidaDoEntulho, estado?: EstadoDoEntulho | null): QuantidadeDoEntulho | null {
  switch (m.tipo) {
    case "sacos":
      return { quantidade: m.sacos, unidade: "sacos" };
    case "carga":
      return estado === "chao" ? { quantidade: m.sacos / SACOS_POR_METRO_CUBICO, unidade: "m3" } : { quantidade: m.sacos, unidade: "sacos" };
    case "bigbags":
      return { quantidade: m.bigBags, unidade: "bigbags" };
    case "volume":
      return { quantidade: m.m3, unidade: "m3" };
    case "misto":
      return { quantidade: m.ensacados + m.porEnsacar, unidade: "sacos" };
    case "acima":
      return null;
  }
}

export type ValorDoEntulho = { ref: ReferenciaDoEntulho; sup: SuplementoDosAndares; valor: Valor };

/**
 * O VALOR DO ENTULHO — 03-11-2026 (d4; e d6 v2: *«essas mudanças são para o
 * nosso motor de preços do app e do site»*). A mesma função para a R12, o
 * simulador do site e o motor (`pricing-helper.ts`): a quantidade pela grelha
 * (`referenciaDoEntulho` — os sacos um a um, e o granel pelos sacos que faz,
 * desde a d7) e os andares por trabalho (`suplementoDosAndares`). Acima da
 * grelha, proposta, sem andares.
 */
export function valorDoEntulho(q: QuantidadeDoEntulho | null, acesso: AcessoDoEntulho | null | undefined): ValorDoEntulho | null {
  const ref = q ? referenciaDoEntulho(q.quantidade, q.unidade) : null;
  if (!ref) return null;
  const sup = suplementoDosAndares(acesso);
  return { ref, sup, valor: ref.valor.tipo === "orcamento" ? ref.valor : comOSuplemento(ref.valor, sup.valor) };
}

/**
 * A quantidade do entulho de um pedido gravado, para o motor: a mesma leitura da
 * R12 (`lerEntulho` e `quantidadeDoEntulho`). Por cima, duas coisas que só o
 * pedido gravado tem: o texto livre com a unidade («4m3», «22 bigbags», do
 * WhatsApp e do backoffice), que ganha aos sacos lidos só pelo número; e, no
 * chão, a carga do simulador do site (`entulhoVolume`), que é a granel, como na
 * R12 — o site grava também os sacos dela em `entulhoQuantidade`.
 */
export function quantidadeDoEntulhoDoPedido(c: Record<string, unknown>): QuantidadeDoEntulho | null {
  const e = lerEntulho(c);
  const semQuantidadeDita = inteiroDaResposta(c.quantidade) == null;
  const carga = CARGAS_DO_ENTULHO.find((x) => x.id === c.entulhoVolume);
  if (e?.estado === "chao" && carga && semQuantidadeDita) {
    return quantidadeDoEntulho({ tipo: "carga", id: carga.id, sacos: SACOS_POR_CARGA[carga.id] }, "chao");
  }
  if (!e?.medida) return null;
  if (e.medida.tipo === "sacos" && semQuantidadeDita && typeof c.entulhoQuantidade === "string") {
    const lida = lerQuantidadeDeEntulho(c.entulhoQuantidade);
    if (lida.sacos && lida.unidade === "m3") return { quantidade: lida.sacos / SACOS_POR_METRO_CUBICO, unidade: "m3" };
    if (lida.sacos && lida.unidade === "bigbags") return { quantidade: lida.sacos, unidade: "sacos" };
  }
  return quantidadeDoEntulho(e.medida, e.estado);
}

export type ValorDosMoveis = { itens: ReturnType<typeof contaDosItens>; sup: SuplementoDosAndares; valor: number };

/**
 * O VALOR DOS MÓVEIS POR PEÇA — 03-11-2026 (d6 v2). Peça a peça
 * (`PRECO_POR_ITEM`), nunca abaixo da recolha mínima (d7, 04-11-2026: 40 €), e
 * os andares por trabalho somados DEPOIS do mínimo: um valor fixo. A mesma
 * função para a R12, o simulador do site e o motor. `null` sem peças.
 * Exemplos do dono: 1 peça pequena no rés-do-chão = 40 € + IVA; 1 média num 3.º
 * andar sem elevador = 40 + 45 = 85 € + IVA; 2 grandes + 1 média num 2.º andar
 * com elevador = 140 € + IVA.
 */
export function valorDosMoveis(itens: ItensDosMoveis, acesso: AcessoDoEntulho | null | undefined): ValorDosMoveis | null {
  const c = contaDosItens(itens);
  if (c.quantos === 0) return null;
  const sup = suplementoDosAndares(acesso);
  return { itens: c, sup, valor: Math.round((c.total + sup.valor) * 100) / 100 };
}

const NOMES_DOS_TAMANHOS = { pequeno: ["peça pequena", "peças pequenas"], medio: ["peça média", "peças médias"], grande: ["peça grande", "peças grandes"] } as const;
const TAMANHOS_DAS_GRANDES_PARA_AS_PEQUENAS = ["grande", "medio", "pequeno"] as const;

/**
 * «2 peças grandes × 50 € = 100 € + IVA» — uma linha por tamanho, só os que têm
 * peças, das grandes para as pequenas. Abaixo da recolha mínima, uma linha só
 * (d7): «1 peça pequena (15 €): conta a recolha mínima de 40 € + IVA».
 */
function porqueDosItens(c: ReturnType<typeof contaDosItens>): string[] {
  const comPecas = TAMANHOS_DAS_GRANDES_PARA_AS_PEQUENAS.filter((t) => c[t] > 0);
  if (c.pelaRecolhaMinima) {
    const pecas = comPecas.map((t) => `${c[t]} ${c[t] === 1 ? NOMES_DOS_TAMANHOS[t][0] : NOMES_DOS_TAMANHOS[t][1]}`).join(" e ");
    return [`${pecas} (${euros(c.soma)}): conta a recolha mínima de ${euros(RECOLHA_MINIMA_DOS_MOVEIS)} + IVA`];
  }
  return comPecas.map(
    (t) => `${c[t]} ${c[t] === 1 ? NOMES_DOS_TAMANHOS[t][0] : NOMES_DOS_TAMANHOS[t][1]} × ${euros(PRECO_POR_ITEM[t])} = ${euros(c[t] * PRECO_POR_ITEM[t])} + IVA`,
  );
}

/**
 * A conta do entulho à vista (d4): os sacos um a um («50 sacos × 4,00–4,80 € =
 * 200–240 € + IVA», «1 big bag = 38 sacos × …»). A granel, desde a d7
 * (04-11-2026), a mesma conta pelos sacos que faz: «Até 1 m³ a granel ≈ 40
 * sacos × 4,00–4,80 € = 160–192 € + IVA».
 */
function porqueDaQuantidade(m: MedidaDoEntulho, ref: ReferenciaDoEntulho | null, aGranel = false): string {
  if (m.tipo === "acima" || !ref) return `Mais de ${MAIOR_VOLUME_DO_ENTULHO} m³: o parceiro faz a proposta a partir das fotografias.`;
  const carga = m.tipo === "carga" ? (CARGAS_DO_ENTULHO.find((c) => c.id === m.id)?.nome ?? m.id) : null;
  if (ref.valor.tipo === "orcamento") return `${carga ? `${carga} ≈ ` : ""}${sacosEmTexto(ref.sacos)} ≈ ${m3EmTexto(ref.m3)} m³.`;
  switch (m.tipo) {
    case "bigbags":
      return contaDosSacosEmTexto(ref.sacos, `${m.bigBags} ${m.bigBags === 1 ? "big bag" : "big bags"}`);
    case "misto":
      return contaDosSacosEmTexto(ref.sacos, `${sacosEmTexto(m.ensacados)} cheios e cerca de ${m.porEnsacar} por ensacar`);
    case "volume":
      return contaDosSacosEmTexto(ref.sacos, `Até ${m3EmTexto(m.m3)} m³ a granel`, "≈");
    case "carga":
      return contaDosSacosEmTexto(ref.sacos, aGranel ? `${carga}, a granel` : (carga ?? undefined), "≈");
    default:
      return contaDosSacosEmTexto(ref.sacos);
  }
}

/** O porquê da estimativa da mudança, pela tabela: as horas, a desmontagem, os andares a pé, os km. */
function porqueDaMudanca(m: PedidoDeMudanca, o: OrcamentoDaMudanca): string[] {
  const l: string[] = [];
  if (m.tipologia) l.push(`${maiuscula(TIPOLOGIA_POR_EXTENSO[m.tipologia])}: cerca de ${HORAS_POR_TIPOLOGIA[m.tipologia]} h da equipa de ${PESSOAS_NA_EQUIPA}.`);
  if (m.desmontagem) l.push(`Desmontar e montar: mais cerca de ${HORAS_A_MAIS_COM_DESMONTAGEM} h.`);
  if (o.andares > 0) l.push(`${o.andares} ${o.andares === 1 ? "andar" : "andares"} a pé, sem elevador: a tabela conta cada um.`);
  if (o.deslocacao > 0) l.push(`${Number(m.kmPercurso).toFixed(0)} km de percurso: acima de ${RAIO_INCLUIDO_KM} km contam-se todos, ida e volta.`);
  return l;
}

/*
 * O ESVAZIAMENTO PELA TIPOLOGIA, UMA SÓ VEZ — 10-11-2026 (d22). A R12, o
 * simulador do site e o motor (`pricing-helper.ts`) lêem a mesma linha de
 * `ESVAZIAMENTO_POR_TIPOLOGIA` e põem-na no mesmo sítio da faixa: o topo com
 * acesso difícil ou muito cheia, o início com pouca coisa, a faixa inteira no
 * resto; a moradia só tem o «desde». `null` sem tipologia da grelha.
 */
export function estimativaDoEsvaziamento(
  servico: string,
  tipologia: string | null | undefined,
  recheio: Recheio | null | undefined,
  acessoDificil: boolean,
): { linha: (typeof ESVAZIAMENTO_POR_TIPOLOGIA)[number]; estimativa: Estimativa } | null {
  if (servico !== "esvaziamento_casa" && servico !== "esvaziamento_apartamento") return null;
  const t = ESVAZIAMENTO_POR_TIPOLOGIA.find((x) => x.chave === tipologia && (servico === "esvaziamento_casa" || x.maximo != null));
  if (!t) return null;
  let e: Estimativa;
  if (t.maximo == null) e = { tipo: "desde", de: t.minimo };
  else if (acessoDificil) e = { tipo: "topo", de: t.minimo, ate: t.maximo, motivo: PELO_ACESSO };
  else if (recheio === "muito") e = { tipo: "topo", de: t.minimo, ate: t.maximo, motivo: "por estar muito cheia" };
  else if (recheio === "pouco") e = { tipo: "inicio", de: t.minimo, ate: t.maximo, motivo: "por haver pouca coisa" };
  else e = { tipo: "faixa", de: t.minimo, ate: t.maximo };
  return { linha: t, estimativa: e };
}

/* ── O pedido inteiro ──────────────────────────────────────────────────── */

/** A estimativa escrita e em três linhas (`null` quando não cabe numa conta destas, como o «por divisão»). */
type Especifica = { texto: string; conta: PrecoEmTresLinhas | null };

/** A faixa publicada de um serviço (30 – 100), ou `null` quando é «desde», por unidade ou não tem. */
function faixaDoServico(servico: string): { de: number; ate: number } | null {
  const preco = PRECOS[servico];
  if (!preco || preco.minimo == null || preco.maximo == null || preco.unidade || /^desde\b/.test(preco.etiqueta)) return null;
  return { de: preco.minimo, ate: preco.maximo };
}

/** Os serviços sem conta pelas respostas: a estimativa é a faixa (ou o «desde») publicada. */
const SEM_CONTA_PELAS_RESPOSTAS: readonly string[] = ["recolha_monos", "montagem_moveis", "jardinagem"];

/**
 * A ESTIMATIVA DO QUE O CLIENTE ESCOLHEU — a do site e a da app (R12). Desde a
 * d6 (03-11-2026) é uma linha só, «Estimativa», e só quando há o que estimar:
 * os móveis peça a peça com os andares, o entulho pela quantidade com os
 * andares, a faixa do espaço, a mudança pela tipologia, o esvaziamento pela
 * tipologia, a manutenção pelo tipo, o topo da faixa pelo acesso — e, nos
 * serviços sem perguntas de preço (monos, montagem, jardinagem), a faixa
 * publicada. A linha geral do serviço («Preço de referência») saiu. A conta em
 * três linhas é a da estimativa. A nota, sempre. E o porquê.
 */
export function referenciaDoPedido(p: PedidoParaReferencia): ReferenciaDoPedido {
  const linhas: LinhaDeReferencia[] = [];
  const porque: string[] = [];

  const ajuste = ajusteAprendido(p.servico, p);
  const razoes = razoesDoAcesso(p);
  const daEstimativa = (e: Estimativa): Especifica => {
    const final = comAjuste(e, ajuste);
    return { texto: escritaDaEstimativa(final), conta: contaDaEstimativa(final) };
  };
  let especifica: Especifica | null = null;
  /** O acesso difícil moveu a referência para o topo da faixa? (senão, entra na proposta) */
  let acessoNoTopo = false;
  /** O entulho e os móveis por peça dizem o acesso à sua maneira (os andares na conta): as razões não se repetem. */
  let acessoDito = false;
  /** A mudança conta os andares na tabela; a manutenção e «Outro serviço» não têm faixa. */
  const acessoConta = !["mudanca", "manutencao_casa", "outro"].includes(p.servico);

  if (p.servico === "recolha_moveis" && p.movelModo === "item" && p.itens) {
    // Os móveis por peça (d6 v2): peça a peça, nunca abaixo da recolha mínima (d7), mais os andares por trabalho — um valor fixo.
    acessoDito = true;
    const v = valorDosMoveis(p.itens, p.acesso);
    if (v) {
      especifica = daEstimativa({ tipo: "valor", valor: v.valor });
      porque.push(...porqueDosItens(v.itens), ...linhasDosAndares(v.sup, p.acesso));
    } else {
      porque.push(...linhasDosAndares(suplementoDosAndares(p.acesso), p.acesso));
    }
  } else if (p.servico === "recolha_moveis") {
    // Por volume (o modo de sempre do simulador do site) não há conta (d6): a proposta sai das
    // fotografias, e a conta por peça fica dita, com a recolha mínima (d7).
    especifica = daEstimativa({ tipo: "proposta" });
    porque.push(
      `Por volume, o parceiro faz a proposta a partir das fotografias. Por peça: ${PECAS_EM_TEXTO} + IVA; recolha mínima ${euros(RECOLHA_MINIMA_DOS_MOVEIS)} + IVA.`,
    );
  } else if (eEsvaziamentoDeEspaco(p.servico) && p.volume) {
    // Garagem, sótão e cave (29-10-2026): a faixa do volume, e o topo com acesso difícil.
    const e = estimativaDoEspaco(p.servico, p.volume, razoes.length > 0);
    acessoNoTopo = !!e;
    especifica = daEstimativa(
      !e ? { tipo: "proposta" } : razoes.length > 0 ? { tipo: "topo", de: e.de, ate: e.ate, motivo: PELO_ACESSO } : { tipo: "faixa", de: e.de, ate: e.ate },
    );
    if (!e) porque.push("Sem saber quanto há, a proposta sai das fotografias.");
  } else if (p.servico === "mudanca" && p.mudanca?.tipologia) {
    // A mudança à hora (13-10-2026): a tabela, que já conta os andares e os km.
    // Desde 11-11-2026, o preço público: o «desde» dos parceiros com 2 pessoas, ou a referência.
    const o = orcamentoDaMudanca(p.mudanca);
    const pp = precoPublicoConhecido();
    const horasCom2 = horasDaMudanca(p.mudanca.tipologia ?? null, p.mudanca.desmontagem === true, 2);
    const desde = totalDesdeComDuas(pp, horasCom2);
    especifica = {
      texto: estimativaDaMudanca(o, pp, horasCom2),
      conta: desde != null ? tres(desde, null, true) : tres(o.totalSemIva, null),
    };
    porque.push(...porqueDaMudanca(p.mudanca, o));
  } else if (p.servico === "recolha_entulho" && (p.entulho || p.acesso)) {
    // O entulho (d4, 03-11-2026): os sacos um a um, o granel ao mesmo preço (d7), e os andares por trabalho.
    acessoDito = true;
    const estado = p.entulho?.estado ?? null;
    const medida = p.entulho?.medida ?? null;
    const q = medida ? quantidadeDoEntulho(medida, estado) : null;
    const v = medida ? valorDoEntulho(q, p.acesso) : null;
    if (medida && medida.tipo === "acima") {
      especifica = daEstimativa({ tipo: "proposta" });
      porque.push(porqueDaQuantidade(medida, null));
    } else if (medida && v) {
      const e: Estimativa =
        v.valor.tipo === "faixa" ? { tipo: "faixa", de: v.valor.de, ate: v.valor.ate } : v.valor.tipo === "desde" ? { tipo: "desde", de: v.valor.de } : { tipo: "proposta" };
      especifica = daEstimativa(e);
      porque.push(porqueDaQuantidade(medida, v.ref, q?.unidade === "m3"));
      if (v.ref.valor.tipo === "orcamento") porque.push(`Acima de ${MAIOR_VOLUME_DO_ENTULHO} m³, o parceiro faz a proposta a partir das fotografias.`);
      else porque.push(...linhasDosAndares(v.sup, p.acesso));
    } else {
      if (estado) porque.push("Sem a quantidade, a proposta sai das fotografias.");
      porque.push(...linhasDosAndares(suplementoDosAndares(p.acesso), p.acesso));
    }
    if (estado === "chao") porque.push("No chão, a granel: o tempo de carga entra na proposta.");
    if (estado === "misto") porque.push("O que está por ensacar: o tempo de carga entra na proposta.");
  } else if ((p.servico === "esvaziamento_casa" || p.servico === "esvaziamento_apartamento") && p.tipologia) {
    // O esvaziamento pela tipologia da grelha publicada; o recheio e o acesso posicionam-no na faixa.
    const r = estimativaDoEsvaziamento(p.servico, p.tipologia, p.recheio, razoes.length > 0);
    if (r) {
      const { linha: t, estimativa: e } = r;
      acessoNoTopo = t.maximo != null;
      especifica = daEstimativa(e);
      porque.push(`${t.tipo}: a linha da grelha do esvaziamento.`);
      if (e.tipo === "inicio") porque.push("Pouca coisa: o início da faixa.");
      if (p.recheio === "muito") porque.push(t.maximo != null ? "Muito cheia: o topo da faixa." : `Muito cheia: ${ENTRA_NA_PROPOSTA}.`);
    }
  } else if (p.servico === "manutencao_casa" && p.manutencao) {
    // Reparações e remodelações pela grelha por tipo (d1 v2, 03-11-2026, `MANUTENCAO_POR_TIPO`).
    const m = p.manutencao;
    const g = grelhaDaManutencao(m);
    const tipo = nomeDaOpcao(TIPOS_DE_TRABALHO, m.tipoDeTrabalho);
    const quanto = nomeDaOpcao(QUANTO_TRABALHO, m.quantoTrabalho);
    // «Remodelação, uma remodelação» diz-se uma vez.
    const oQue = m.tipoDeTrabalho === "remodelacao" && m.quantoTrabalho === "remodelacao" ? tipo : [tipo, quanto && tipo ? minusculaDe(quanto) : quanto].filter(Boolean).join(", ");
    if (g && g.estimativa) {
      // O «desde 57 €» de «Outro trabalho» é o mínimo do serviço: diz-se que a proposta sai da descrição.
      const doMinimo = g.estimativa.tipo === "desde" && !g.porDivisao && g.estimativa.de === PRECOS.manutencao_casa.minimo;
      const final = comAjuste(g.estimativa, ajuste);
      const texto = escritaDaEstimativa(final);
      especifica = g.porDivisao ? { texto: texto.replace(/\.$/, " por divisão."), conta: null } : { texto, conta: contaDaEstimativa(final) };
      if (oQue) porque.push(doMinimo ? `${oQue}: a proposta sai da descrição e das fotografias.` : `${oQue}: a linha da grelha da manutenção.`);
    } else if (g) {
      especifica = daEstimativa({ tipo: "proposta" });
      if (oQue) porque.push(`${oQue}: o parceiro faz a proposta a partir da descrição e das fotografias.`);
    } else if (oQue) {
      porque.push(`${oQue}: a proposta sai da descrição e das fotografias.`);
    }
    if (g?.nota) porque.push(g.nota);
    const rep = nomeDaOpcao(REPETICOES, m.repeticao);
    if (rep && m.repeticao !== "pontual") porque.push(`${rep}: ${ENTRA_NA_PROPOSTA}.`);
  }

  // Os outros serviços com faixa (os monos, o apartamento sem tipologia): o acesso leva ao topo.
  if (!especifica && razoes.length > 0 && acessoConta && !acessoDito && !eEsvaziamentoDeEspaco(p.servico)) {
    const f = faixaDoServico(p.servico);
    if (f) {
      especifica = daEstimativa({ tipo: "topo", de: f.de, ate: f.ate, motivo: PELO_ACESSO });
      acessoNoTopo = true;
    }
  }
  // Os serviços sem perguntas de preço (monos, montagem, jardinagem): a estimativa é a faixa (ou o «desde») publicada.
  if (!especifica && SEM_CONTA_PELAS_RESPOSTAS.includes(p.servico)) {
    const preco = PRECOS[p.servico];
    if (preco?.minimo != null) {
      especifica = daEstimativa(preco.maximo != null && !/^desde\b/.test(preco.etiqueta) ? { tipo: "faixa", de: preco.minimo, ate: preco.maximo } : { tipo: "desde", de: preco.minimo });
    }
  }
  if (acessoConta && !acessoDito) for (const r of razoes) porque.push(`${r}: ${acessoNoTopo ? "o topo da faixa" : ENTRA_NA_PROPOSTA}.`);

  // A localidade: só a regra publicada (a mudança conta os km acima de 50). Fora das zonas, a proposta depende da zona.
  if (p.localidade && localidadeServida(p.localidade) === false) {
    porque.push(`${p.localidade.trim()}: a proposta depende da zona (os parceiros trabalham em ${ZONAS_EM_FRASE}).`);
  }
  if (ajuste.porque) porque.push(ajuste.porque);

  if (especifica) linhas.push({ rotulo: ROTULO_DA_ESTIMATIVA, texto: especifica.texto });
  return { linhas, nota: NOTA_DOS_PRECOS, conta: especifica?.conta ?? null, porque };
}

/**
 * A REFERÊNCIA EM TRÊS LINHAS — «Serviço / IVA / Total» (02-11-2026, o resumo
 * do Pedir na app de cliente). Os mesmos números das linhas de cima: os do
 * pedido (os móveis por item, o espaço com o volume, a mudança com o tamanho da
 * casa, o entulho pela quantidade, o esvaziamento pela tipologia, o topo pelo
 * acesso) e, sem eles, a faixa (ou o «desde») do serviço. `null` quando o preço
 * não cabe numa conta destas (por hora sem tipologia, o entulho sem quantidade,
 * «Outro serviço»): aí ficam as linhas.
 */
export function contaDaReferencia(p: PedidoParaReferencia): PrecoEmTresLinhas | null {
  return referenciaDoPedido(p).conta;
}

/** Uma linha como se lê no ecrã: «Rótulo: texto». */
export const linhaEscrita = (l: LinhaDeReferencia) => `${l.rotulo}: ${l.texto}`;

/* ── O corpo da R12 ──────────────────────────────────────────────────── */

const ANDAR = (v: unknown) => (typeof v === "string" && v.length <= 20 ? v : typeof v === "number" && Number.isFinite(v) ? v : null);
const ELEVADOR = (v: unknown) => (typeof v === "string" && v.length <= 20 ? v : null);
const TIPOLOGIAS = ["itens", "T0", "T1", "T2", "T3", "T4+"] as const;

function ponta(v: unknown): { floor: string | number | null; hasElevator: string | null } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  return { floor: ANDAR(o.floor ?? o.andar), hasElevator: ELEVADOR(o.hasElevator ?? o.elevador) };
}

/**
 * Lê o corpo da R12 sem confiar em nada. `null` se o serviço não vier.
 *
 * O corpo de sempre (a app de hoje): `{ servico, movelModo?, itens?, volume?,
 * acessoDificil?, acessoDoEspaco?, estacionamento?, tipologia?, kmPercurso?,
 * origem?, destino?, desmontagem?, entulho?: { estado, modo, sacos, volume } }`.
 *
 * E o de 03-11-2026 (d1), com os ids das perguntas da R7
 * (`simulador-por-categoria.ts`): `entulho` (o estado), `tipoDeSaco`,
 * `quantidade`, `ensacados`, `porEnsacar`, `entulhoVolume`; `tipologia` e
 * `recheio` no esvaziamento; `tipoDeTrabalho`, `quantoTrabalho`, `materiais`,
 * `repeticao` na manutenção; `floor`, `hasElevator`, `parkingDistance`;
 * `localidade`; `descricao` e `fotografias` (para o ajuste aprendido).
 */
export function lerPedidoParaReferencia(corpo: unknown): PedidoParaReferencia | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  if (typeof c.servico !== "string" || !/^[a-z_]{2,40}$/.test(c.servico)) return null;
  const p: PedidoParaReferencia = { servico: c.servico };
  if (c.movelModo === "item" || c.movelModo === "carga") p.movelModo = c.movelModo;
  if (c.itens && typeof c.itens === "object") {
    const i = c.itens as Record<string, unknown>;
    p.itens = { pequeno: inteiro(i.pequeno), medio: inteiro(i.medio), grande: inteiro(i.grande) };
  }
  if (typeof c.volume === "string" && c.volume.length <= 20) p.volume = c.volume;
  // Garagem, sótão e cave (d5, 31-10-2026): a app manda a resposta do acesso e o
  // estacionamento, e o «acesso difícil» decide-se aqui, pela regra do simulador.
  const curto = (v: unknown) => (typeof v === "string" && v.length <= 40 ? v : null);
  if (c.acessoDificil === true || acessoDificilDoEspaco(c.servico, curto(c.acessoDoEspaco), curto(c.estacionamento ?? c.parkingDistance))) p.acessoDificil = true;
  if (eEsvaziamentoDeEspaco(c.servico) && curto(c.acessoDoEspaco)) p.acessoDoEspaco = curto(c.acessoDoEspaco);
  if (c.servico === "mudanca") {
    const tipologia = TIPOLOGIAS.find((t) => t === c.tipologia) ?? null;
    const km = typeof c.kmPercurso === "number" && Number.isFinite(c.kmPercurso) && c.kmPercurso >= 0 && c.kmPercurso < 5000 ? c.kmPercurso : null;
    p.mudanca = { tipologia, kmPercurso: km, desmontagem: lerDesmontagem(c.desmontagem) === true, origem: ponta(c.origem), destino: ponta(c.destino) };
  } else {
    // O andar, o elevador e o estacionamento (d1): levam a faixa ao topo.
    const acesso = lerAcesso({ floor: c.floor, hasElevator: c.hasElevator, parkingDistance: c.parkingDistance ?? c.estacionamento });
    if (acesso.floor || acesso.hasElevator || acesso.parkingDistance) p.acesso = acesso;
  }
  if (c.servico === "recolha_entulho") {
    const e = lerEntulho(c);
    if (e) p.entulho = e;
  }
  if (c.servico === "esvaziamento_casa" || c.servico === "esvaziamento_apartamento") {
    const t = lerTipologiaDoEsvaziamento(c.servico, c.tipologia);
    if (t) p.tipologia = t;
    const r = lerRecheio(c.recheio);
    if (r) p.recheio = r;
  }
  if (c.servico === "manutencao_casa") p.manutencao = lerManutencao(c);
  const localidade = curto(c.localidade);
  if (localidade && localidade.trim()) p.localidade = localidade.trim();
  if (typeof c.descricao === "string" && c.descricao.trim()) p.descricao = c.descricao.trim().slice(0, 2000);
  const fotografias = inteiroDaResposta(c.fotografias, 50);
  if (fotografias != null) p.fotografias = fotografias;
  return p;
}

/* ── O simulador do site, pelo mesmo caminho ───────────────────────────── */

/** O que o formulário do simulador do site sabe (`src/app/simulador/types.ts`). */
export type FormularioDoSimulador = {
  serviceType?: string;
  movelMode?: "carga" | "item";
  movelItemsPequeno?: number;
  movelItemsMedio?: number;
  movelItemsGrande?: number;
  volumeTier?: string;
  acessoDoEspaco?: string;
  entulhoState?: string;
  entulhoQuantidade?: string;
  entulhoQuantidadeEnsacados?: string;
  entulhoQuantidadePorEnsacar?: string;
  entulhoQuantidadeIncerta?: boolean;
  /** A carga escolhida («carrinha», «camiao_caixa», «camiao_lixo», «incerto»). */
  entulhoVolume?: string;
  floor?: string;
  hasElevator?: string;
  parkingDistance?: string;
  tipologia?: string;
  /** Esvaziamento: quão cheia está (`RECHEIOS`). */
  recheio?: string;
  originAccess?: { floor?: string; hasElevator?: string; difficultAccess?: boolean };
  destinationAccess?: { floor?: string; hasElevator?: string; difficultAccess?: boolean };
  movingDistance?: { distanceKm?: number };
  address?: { city?: string };
};

/**
 * O FORMULÁRIO DO SITE NO CORPO DA R12 — 03-11-2026 (d1, a orquestra). O
 * simulador do site lê a referência por `lerPedidoParaReferencia` e
 * `referenciaDoPedido`, como a R12: para o mesmo pedido, o site e a app dizem o
 * mesmo número e o mesmo porquê. O site conta o entulho em sacos (as cargas já
 * convertidas, `SACOS_POR_CARGA`) — menos a carga no chão, que vai a granel
 * (d4); a mudança, com a desmontagem do
 * «acesso difícil» de cada ponta, como a caixa da tabela.
 */
export function corpoDoSimuladorDoSite(f: FormularioDoSimulador): Record<string, unknown> | null {
  const s = f.serviceType;
  if (!s) return null;
  const corpo: Record<string, unknown> = { servico: s };
  if (s === "recolha_moveis") {
    corpo.movelModo = f.movelMode;
    if (f.movelMode === "item") corpo.itens = { pequeno: f.movelItemsPequeno ?? 0, medio: f.movelItemsMedio ?? 0, grande: f.movelItemsGrande ?? 0 };
  }
  if (eEsvaziamentoDeEspaco(s)) {
    corpo.volume = f.volumeTier;
    corpo.acessoDoEspaco = f.acessoDoEspaco;
  }
  if (s === "recolha_entulho") {
    corpo.entulho = f.entulhoState === "bigbags" ? "ensacado" : f.entulhoState;
    if (f.entulhoState === "misto") {
      corpo.ensacados = f.entulhoQuantidadeEnsacados;
      corpo.porEnsacar = f.entulhoQuantidadePorEnsacar;
    }
    const cargaNoChao = f.entulhoState === "chao" && CARGAS_DO_ENTULHO.some((c) => c.id === f.entulhoVolume);
    if (cargaNoChao) {
      // No chão, «Enche uma carrinha» é entulho solto: a granel, pela grelha por m³ (d4, 03-11-2026).
      corpo.entulhoVolume = f.entulhoVolume;
    } else if (!f.entulhoQuantidadeIncerta && f.entulhoQuantidade) {
      corpo.tipoDeSaco = "pequeno";
      corpo.quantidade = f.entulhoQuantidade;
    }
  }
  if (s === "esvaziamento_casa" || s === "esvaziamento_apartamento") {
    // A tipologia e o recheio do esvaziamento (d22, 10-11-2026), quando o formulário os tem.
    if (f.tipologia) corpo.tipologia = f.tipologia;
    if (f.recheio) corpo.recheio = f.recheio;
  }
  if (s === "mudanca") {
    corpo.tipologia = f.tipologia;
    corpo.kmPercurso = f.movingDistance?.distanceKm;
    corpo.desmontagem = f.originAccess?.difficultAccess === true || f.destinationAccess?.difficultAccess === true;
    corpo.origem = f.originAccess;
    corpo.destino = f.destinationAccess;
  } else {
    corpo.floor = f.floor;
    corpo.hasElevator = f.floor === "rés-do-chão" ? undefined : f.hasElevator;
    corpo.parkingDistance = f.parkingDistance;
  }
  corpo.localidade = f.address?.city;
  return corpo;
}

/** A referência do formulário do site — a mesma conta da R12. */
export function referenciaDoSimuladorDoSite(f: FormularioDoSimulador): ReferenciaDoPedido | null {
  const pedido = lerPedidoParaReferencia(corpoDoSimuladorDoSite(f));
  return pedido ? referenciaDoPedido(pedido) : null;
}
