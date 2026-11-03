import {
  ENTULHO_ATE_10_SACOS,
  ENTULHO_POR_VOLUME,
  ESVAZIAMENTO_POR_TIPOLOGIA,
  MINIMO_DOS_ITENS,
  PRECOS,
  PRECO_POR_ITEM,
  eEsvaziamentoDeEspaco,
  estimativaDoEspaco,
} from "./precos-publicos";
import { comIva, euros, referenciaDoEntulho, type UnidadeDoEntulho } from "./quanto-custa";
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
import { referenciaEmTresLinhas, type PrecoEmTresLinhas } from "./preco-em-tres-linhas";
import { TAXA_IVA } from "./taxas-plataforma";
import { SACOS_POR_BIG_BAG } from "./sacos-de-entulho";
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

/** «Sofá de 2 a 3 lugares: 40 – 70 € + IVA (49,20 – 86,10 € com IVA)» — as peças de `PECAS_DE_REFERENCIA`. */
export const pecaComOIvaAoLado = (p: { peca: string; minimo: number; maximo: number }) =>
  `${p.peca}: ${faixaSemEComIva(p.minimo, p.maximo)}`;

/** «260 – 350 € + IVA (319,80 – 430,50 € com IVA)», «desde 450 € + IVA (553,50 € com IVA)» — uma linha de `ESVAZIAMENTO_POR_TIPOLOGIA`. */
export function esvaziamentoComOIvaAoLado(chave: string): string {
  const t = ESVAZIAMENTO_POR_TIPOLOGIA.find((x) => x.chave === chave);
  if (!t) throw new Error(`Tipologia de esvaziamento desconhecida: ${chave}`);
  return t.maximo != null ? faixaSemEComIva(t.minimo, t.maximo) : `desde ${valorSemEComIva(t.minimo)}`;
}

/**
 * Só o com IVA da etiqueta de um serviço — «49,20 – 147,60 € com IVA»,
 * «desde 307,50 € com IVA», «desde 147,60 €/m³ com IVA», «61,50 €/hora com
 * IVA» —, para a linha pequena por baixo de `maisIva(etiqueta)` num cartão
 * onde a frase inteira não cabe. `null` quando o serviço não publica preço.
 */
export function comIvaDaEtiqueta(servico: string): string | null {
  const p = PRECOS[servico];
  if (!p || p.minimo == null) return null;
  if (servico === "mudanca") return `${euros(comIva(PRECO_POR_HORA))}/hora com IVA`;
  const u = p.unidade ? `/${p.unidade}` : "";
  if (p.maximo != null && !/^desde\b/.test(p.etiqueta)) return `${faixaComIva(p.minimo, p.maximo)}${u} com IVA`;
  return `desde ${euros(comIva(p.minimo))}${u} com IVA`;
}

/** A nota que vai por baixo de qualquer preço de referência (G2). */
export const NOTA_DOS_PRECOS =
  "Valor de referência. O preço de cada trabalho é o da proposta do parceiro que escolher, e na proposta já vem com IVA incluído.";

/** O rótulo da linha do serviço. */
export const ROTULO_DA_REFERENCIA = "Preço de referência";

/**
 * O preço de referência de um serviço, já com o IVA ao lado, ou `null` quando
 * o serviço não publica preço («Outro serviço»).
 */
export function precoDeReferencia(servico: string | null | undefined): string | null {
  if (!servico) return null;
  if (servico === "mudanca") {
    return `${euros(PRECO_POR_HORA)}/hora + IVA (${euros(comIva(PRECO_POR_HORA))}/hora com IVA), mínimo ${MINIMO_DE_HORAS} horas`;
  }
  if (servico === "recolha_entulho") {
    const m3 = PRECOS.recolha_entulho.minimo!;
    return (
      `10 sacos ${faixaSemEComIva(ENTULHO_ATE_10_SACOS.minimo, ENTULHO_ATE_10_SACOS.maximo)}; ` +
      `desde ${euros(m3)}/m³ + IVA (${euros(comIva(m3))}/m³ com IVA)`
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

/** A soma dos itens, sem IVA, e se fica abaixo do mínimo. */
export function contaDosItens(itens: ItensDosMoveis): { quantos: number; soma: number; total: number; abaixoDoMinimo: boolean } {
  const p = inteiro(itens.pequeno);
  const m = inteiro(itens.medio);
  const g = inteiro(itens.grande);
  const soma = p * PRECO_POR_ITEM.pequeno + m * PRECO_POR_ITEM.medio + g * PRECO_POR_ITEM.grande;
  const abaixoDoMinimo = soma > 0 && soma < MINIMO_DOS_ITENS;
  return { quantos: p + m + g, soma, total: abaixoDoMinimo ? MINIMO_DOS_ITENS : soma, abaixoDoMinimo };
}

export const ROTULO_DO_TOTAL_DOS_ITENS = "Total de referência";

/*
 * O MÍNIMO POR PEDIDO, AO LADO DA FAIXA DO SOFÁ — 31-10-2026 (decisão d8). A
 * página e o guia do sofá diziam «40 – 70 € + IVA» e o simulador, com um sofá
 * só, mostra o mínimo da recolha por item (80 € + IVA = 98,40 €). Nenhum preço
 * muda: diz-se o mínimo que o simulador aplica, com o IVA ao lado.
 */
export const MINIMO_POR_PEDIDO_DOS_ITENS =
  `No simulador, uma recolha por peça tem um mínimo de ${valorSemEComIva(MINIMO_DOS_ITENS)} por pedido, mesmo que seja só um sofá.`;

/** «80 € + IVA (98,40 € com IVA).» ou, abaixo do mínimo, a frase que o diz. `null` sem itens. */
export function totalDosItens(itens: ItensDosMoveis): string | null {
  const c = contaDosItens(itens);
  if (c.quantos === 0) return null;
  return c.abaixoDoMinimo
    ? `${valorSemEComIva(c.total)}, o mínimo de uma recolha por item.`
    : `${valorSemEComIva(c.total)}.`;
}

/* ── Mudança ─────────────────────────────────────────────────────────── */

export const ROTULO_DA_ESTIMATIVA_DA_MUDANCA = "Estimativa para a sua mudança";

/** «cerca de 4 h — 200 € + IVA (246 € com IVA). O total sai das horas feitas no dia.» */
export function estimativaDaMudanca(conta: Pick<OrcamentoDaMudanca, "horas" | "totalSemIva">): string {
  const horas = String(conta.horas).replace(".", ",");
  return `cerca de ${horas} h — ${valorSemEComIva(conta.totalSemIva)}. O total sai das horas feitas no dia.`;
}

/* ── Garagem, sótão e cave ───────────────────────────────────────────── */

export const ROTULO_DA_ESTIMATIVA_DO_ESPACO = "Para o que escolheu";

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
 * curtas (`porque`), sem euros (o sem IVA nunca vai sozinho).
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
  /** Porque é esta a referência — linhas curtas, sem euros: «50 sacos ≈ 1,25 m³.» */
  porque: string[];
};

/** Uma estimativa, sempre a partir de números publicados. */
type Estimativa =
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
 * As Finanças estão a prepará-la; até o dono a aprovar, não há, e a referência
 * fica «desde 57 € + IVA» (`PRECOS.manutencao_casa`). Quando houver, devolve a
 * faixa do tipo e do tamanho do trabalho (sem IVA, de `precos-publicos.ts`), e
 * o resto da conta não muda.
 */
export function grelhaDaManutencao(_r: RespostasDaManutencao): { de: number; ate: number | null } | null {
  return null;
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

/** A quantidade do entulho na unidade da calculadora (`referenciaDoEntulho`). */
function quantidadeDoEntulho(m: MedidaDoEntulho): { quantidade: number; unidade: UnidadeDoEntulho } | null {
  switch (m.tipo) {
    case "sacos":
    case "carga":
      return { quantidade: m.sacos, unidade: "sacos" };
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

/** «50 sacos ≈ 1,25 m³.», «2 big bags ≈ 76 sacos (38 por big bag) ≈ 1,9 m³.» */
function porqueDaQuantidade(m: MedidaDoEntulho, sacos: number, m3: number): string {
  const aproximado = sacos <= 10 ? `: até 10 sacos é a primeira linha da grelha.` : ` ≈ ${m3EmTexto(m3)} m³.`;
  switch (m.tipo) {
    case "sacos":
      return `${sacosEmTexto(sacos)}${aproximado}`;
    case "bigbags":
      return `${m.bigBags} ${m.bigBags === 1 ? "big bag" : "big bags"} ≈ ${sacos} sacos (${SACOS_POR_BIG_BAG} por big bag) ≈ ${m3EmTexto(m3)} m³.`;
    case "volume":
      return `Até ${m3EmTexto(m.m3)} m³ a granel ≈ ${sacos} sacos.`;
    case "carga":
      return `${CARGAS_DO_ENTULHO.find((c) => c.id === m.id)?.nome ?? m.id} ≈ ${sacos} sacos ≈ ${m3EmTexto(m3)} m³.`;
    case "misto":
      return `${sacosEmTexto(m.ensacados)} cheios e cerca de ${m.porEnsacar} por ensacar ≈ ${sacosEmTexto(sacos)}${sacos <= 10 ? "." : ` ≈ ${m3EmTexto(m3)} m³.`}`;
    case "acima":
      return `Mais de ${m.m3} m³: o parceiro faz a proposta a partir das fotografias.`;
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

/* ── O pedido inteiro ──────────────────────────────────────────────────── */

type Especifica = { rotulo: string; texto: string; conta: PrecoEmTresLinhas | null };

/** A conta do serviço sem mais nada: a faixa, ou o «desde». `null` à hora, no entulho e sem preço. */
function contaDoServico(p: PedidoParaReferencia): PrecoEmTresLinhas | null {
  if (p.servico === "mudanca" || p.servico === "recolha_entulho") return null;
  const preco = PRECOS[p.servico];
  if (!preco || preco.minimo == null || preco.unidade) return null;
  if (eEsvaziamentoDeEspaco(p.servico) || preco.maximo == null || /^desde\b/.test(preco.etiqueta)) return tres(preco.minimo, null, true);
  return tres(preco.minimo, preco.maximo);
}

/** A faixa publicada de um serviço (40 – 120), ou `null` quando é «desde» ou não tem. */
function faixaDoServico(servico: string): { de: number; ate: number } | null {
  const preco = PRECOS[servico];
  if (!preco || preco.minimo == null || preco.maximo == null || preco.unidade || /^desde\b/.test(preco.etiqueta)) return null;
  return { de: preco.minimo, ate: preco.maximo };
}

/**
 * As linhas que o simulador mostra para o que já está escolhido: o preço de
 * referência do serviço e, por baixo, o deste pedido — o total dos móveis por
 * item, a faixa do espaço, a estimativa da mudança, a linha do entulho pela
 * quantidade, a do esvaziamento pela tipologia, o topo da faixa pelo acesso.
 * A conta em três linhas é a do pedido, ou a do serviço. A nota, sempre. E o
 * porquê.
 */
export function referenciaDoPedido(p: PedidoParaReferencia): ReferenciaDoPedido {
  const linhas: LinhaDeReferencia[] = [];
  const porque: string[] = [];
  const ref = precoDeReferencia(p.servico);
  if (ref) linhas.push({ rotulo: ROTULO_DA_REFERENCIA, texto: ref });

  const ajuste = ajusteAprendido(p.servico, p);
  const razoes = razoesDoAcesso(p);
  const daEstimativa = (rotulo: string, e: Estimativa): Especifica => {
    const final = comAjuste(e, ajuste);
    return { rotulo, texto: escritaDaEstimativa(final), conta: contaDaEstimativa(final) };
  };
  let especifica: Especifica | null = null;
  /** O acesso difícil moveu a referência para o topo da faixa? (senão, entra na proposta) */
  let acessoNoTopo = false;
  /** A mudança conta os andares na tabela; a manutenção e «Outro serviço» não têm faixa. */
  const acessoConta = !["mudanca", "manutencao_casa", "outro"].includes(p.servico);

  if (p.servico === "recolha_moveis" && p.movelModo === "item" && p.itens) {
    // Os móveis por item: o total dos tamanhos, ou o mínimo por pedido.
    const c = contaDosItens(p.itens);
    if (c.quantos > 0) {
      especifica = { rotulo: ROTULO_DO_TOTAL_DOS_ITENS, texto: totalDosItens(p.itens) as string, conta: tres(c.total, null) };
      porque.push(`${c.quantos} ${c.quantos === 1 ? "peça" : "peças"}, cada uma ao preço do seu tamanho.`);
      if (c.abaixoDoMinimo) porque.push("Abaixo do mínimo de uma recolha por peça, conta o mínimo.");
    }
  } else if (eEsvaziamentoDeEspaco(p.servico) && p.volume) {
    // Garagem, sótão e cave (29-10-2026): a faixa do volume, e o topo com acesso difícil.
    const e = estimativaDoEspaco(p.servico, p.volume, razoes.length > 0);
    acessoNoTopo = !!e;
    especifica = daEstimativa(
      ROTULO_DA_ESTIMATIVA_DO_ESPACO,
      !e ? { tipo: "proposta" } : razoes.length > 0 ? { tipo: "topo", de: e.de, ate: e.ate, motivo: PELO_ACESSO } : { tipo: "faixa", de: e.de, ate: e.ate },
    );
    if (!e) porque.push("Sem saber quanto há, a proposta sai das fotografias.");
  } else if (p.servico === "mudanca" && p.mudanca?.tipologia) {
    // A mudança à hora (13-10-2026): a tabela, que já conta os andares e os km.
    const o = orcamentoDaMudanca(p.mudanca);
    especifica = { rotulo: ROTULO_DA_ESTIMATIVA_DA_MUDANCA, texto: estimativaDaMudanca(o), conta: tres(o.totalSemIva, null) };
    porque.push(...porqueDaMudanca(p.mudanca, o));
  } else if (p.servico === "recolha_entulho" && p.entulho) {
    // O entulho pela quantidade: a calculadora da página (17-10-2026), sacos, big bags ou m³.
    const { estado, medida } = p.entulho;
    const q = medida ? quantidadeDoEntulho(medida) : null;
    const r = q ? referenciaDoEntulho(q.quantidade, q.unidade) : null;
    if (medida && medida.tipo === "acima") {
      especifica = daEstimativa(ROTULO_DA_ESTIMATIVA_DO_ESPACO, { tipo: "proposta" });
      porque.push(porqueDaQuantidade(medida, 0, 0));
    } else if (medida && r) {
      const v = r.valor;
      const e: Estimativa =
        v.tipo === "faixa"
          ? razoes.length > 0
            ? { tipo: "topo", de: v.de, ate: v.ate, motivo: PELO_ACESSO }
            : { tipo: "faixa", de: v.de, ate: v.ate }
          : v.tipo === "desde"
            ? { tipo: "desde", de: v.de }
            : { tipo: "proposta" };
      acessoNoTopo = v.tipo === "faixa";
      especifica = daEstimativa(ROTULO_DA_ESTIMATIVA_DO_ESPACO, e);
      porque.push(porqueDaQuantidade(medida, r.sacos, r.m3));
      if (v.tipo === "orcamento") porque.push(`Acima de ${MAIOR_VOLUME_DO_ENTULHO} m³, o parceiro faz a proposta a partir das fotografias.`);
    } else if (estado) {
      porque.push("Sem a quantidade, fica a grelha; o parceiro confirma-a pelas fotografias.");
    }
    if (estado === "chao") porque.push("No chão, a granel: o tempo de carga entra na proposta.");
    if (estado === "misto") porque.push("O que está por ensacar: o tempo de carga entra na proposta.");
  } else if ((p.servico === "esvaziamento_casa" || p.servico === "esvaziamento_apartamento") && p.tipologia) {
    // O esvaziamento pela tipologia da grelha publicada; o recheio e o acesso posicionam-no na faixa.
    const t = ESVAZIAMENTO_POR_TIPOLOGIA.find((x) => x.chave === p.tipologia && (p.servico === "esvaziamento_casa" || x.maximo != null));
    if (t) {
      let e: Estimativa;
      if (t.maximo == null) e = { tipo: "desde", de: t.minimo };
      else if (razoes.length > 0) e = { tipo: "topo", de: t.minimo, ate: t.maximo, motivo: PELO_ACESSO };
      else if (p.recheio === "muito") e = { tipo: "topo", de: t.minimo, ate: t.maximo, motivo: "por estar muito cheia" };
      else if (p.recheio === "pouco") e = { tipo: "inicio", de: t.minimo, ate: t.maximo, motivo: "por haver pouca coisa" };
      else e = { tipo: "faixa", de: t.minimo, ate: t.maximo };
      acessoNoTopo = t.maximo != null;
      especifica = daEstimativa(ROTULO_DA_ESTIMATIVA_DO_ESPACO, e);
      porque.push(`${t.tipo}: a linha da grelha do esvaziamento.`);
      if (e.tipo === "inicio") porque.push("Pouca coisa: o início da faixa.");
      if (p.recheio === "muito") porque.push(t.maximo != null ? "Muito cheia: o topo da faixa." : `Muito cheia: ${ENTRA_NA_PROPOSTA}.`);
    }
  } else if (p.servico === "manutencao_casa" && p.manutencao) {
    // Reparações e remodelações: «desde», até haver a grelha por tipo (`grelhaDaManutencao`).
    const m = p.manutencao;
    const g = grelhaDaManutencao(m);
    if (g) especifica = daEstimativa(ROTULO_DA_ESTIMATIVA_DO_ESPACO, g.ate != null ? { tipo: "faixa", de: g.de, ate: g.ate } : { tipo: "desde", de: g.de });
    const tipo = nomeDaOpcao(TIPOS_DE_TRABALHO, m.tipoDeTrabalho);
    const quanto = nomeDaOpcao(QUANTO_TRABALHO, m.quantoTrabalho);
    if (tipo || quanto) {
      const oQue = [tipo, quanto && tipo ? minusculaDe(quanto) : quanto].filter(Boolean).join(", ");
      porque.push(`${oQue}: a proposta sai da descrição e das fotografias.`);
    }
    if (m.materiais === "tenho") porque.push("Já tem os materiais: ficam fora da proposta.");
    if (m.materiais === "parceiro") porque.push("Os materiais pelo parceiro: entram na proposta.");
    if (m.materiais === "nao_sei") porque.push("Os materiais combinam-se com o parceiro, na proposta.");
    const rep = nomeDaOpcao(REPETICOES, m.repeticao);
    if (rep && m.repeticao !== "pontual") porque.push(`${rep}: ${ENTRA_NA_PROPOSTA}.`);
  }

  // Os outros serviços com faixa (móveis por carga, monos, apartamento sem tipologia): o acesso leva ao topo.
  if (!especifica && razoes.length > 0 && acessoConta && !eEsvaziamentoDeEspaco(p.servico)) {
    const f = faixaDoServico(p.servico);
    if (f) {
      especifica = daEstimativa(ROTULO_DA_ESTIMATIVA_DO_ESPACO, { tipo: "topo", de: f.de, ate: f.ate, motivo: PELO_ACESSO });
      acessoNoTopo = true;
    }
  }
  if (acessoConta) for (const r of razoes) porque.push(`${r}: ${acessoNoTopo ? "o topo da faixa" : ENTRA_NA_PROPOSTA}.`);

  // A localidade: só a regra publicada (a mudança conta os km acima de 50). Fora das zonas, a proposta depende da zona.
  if (p.localidade && localidadeServida(p.localidade) === false) {
    porque.push(`${p.localidade.trim()}: a proposta depende da zona (os parceiros trabalham em ${ZONAS_EM_FRASE}).`);
  }
  if (ajuste.porque) porque.push(ajuste.porque);

  if (especifica) linhas.push({ rotulo: especifica.rotulo, texto: especifica.texto });
  return { linhas, nota: NOTA_DOS_PRECOS, conta: especifica?.conta ?? contaDoServico(p), porque };
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
  floor?: string;
  hasElevator?: string;
  parkingDistance?: string;
  tipologia?: string;
  originAccess?: { floor?: string; hasElevator?: string; difficultAccess?: boolean };
  destinationAccess?: { floor?: string; hasElevator?: string; difficultAccess?: boolean };
  movingDistance?: { distanceKm?: number };
  address?: { city?: string };
};

/**
 * O FORMULÁRIO DO SITE NO CORPO DA R12 — 03-11-2026 (d1, a orquestra). O
 * simulador do site lê a referência por `lerPedidoParaReferencia` e
 * `referenciaDoPedido`, como a R12: para o mesmo pedido, o site e a app dizem o
 * mesmo número e o mesmo porquê. O site conta o entulho sempre em sacos (as
 * cargas já convertidas, `SACOS_POR_CARGA`); a mudança, com a desmontagem do
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
    if (!f.entulhoQuantidadeIncerta && f.entulhoQuantidade) {
      corpo.tipoDeSaco = "pequeno";
      corpo.quantidade = f.entulhoQuantidade;
    }
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
