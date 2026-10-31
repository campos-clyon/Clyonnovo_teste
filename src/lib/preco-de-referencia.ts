import {
  ENTULHO_ATE_10_SACOS,
  ESVAZIAMENTO_POR_TIPOLOGIA,
  MINIMO_DOS_ITENS,
  PRECOS,
  PRECO_POR_ITEM,
  eEsvaziamentoDeEspaco,
  estimativaDoEspaco,
} from "./precos-publicos";
import { comIva, euros } from "./quanto-custa";
import {
  MINIMO_DE_HORAS,
  PRECO_POR_HORA,
  orcamentoDaMudanca,
  type OrcamentoDaMudanca,
  type PedidoDeMudanca,
} from "./tabela-das-mudancas";

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

export type PedidoParaReferencia = {
  servico: string;
  /** Garagem, sótão e cave: a faixa do volume e se o acesso é difícil (29-10-2026). */
  volume?: string | null;
  acessoDificil?: boolean;
  movelModo?: "carga" | "item";
  itens?: ItensDosMoveis;
  mudanca?: PedidoDeMudanca;
};

export type LinhaDeReferencia = { rotulo: string; texto: string };

/**
 * As linhas que o simulador mostra para o que já está escolhido: o preço de
 * referência do serviço, o total dos móveis por item e a estimativa da
 * mudança (só com o tamanho da casa). E a nota, sempre.
 */
export function referenciaDoPedido(p: PedidoParaReferencia): { linhas: LinhaDeReferencia[]; nota: string } {
  const linhas: LinhaDeReferencia[] = [];
  const ref = precoDeReferencia(p.servico);
  if (ref) linhas.push({ rotulo: ROTULO_DA_REFERENCIA, texto: ref });
  if (p.servico === "recolha_moveis" && p.movelModo === "item" && p.itens) {
    const total = totalDosItens(p.itens);
    if (total) linhas.push({ rotulo: ROTULO_DO_TOTAL_DOS_ITENS, texto: total });
  }
  if (eEsvaziamentoDeEspaco(p.servico) && p.volume) {
    linhas.push({ rotulo: ROTULO_DA_ESTIMATIVA_DO_ESPACO, texto: estimativaDoEspacoEmPalavras(p.servico, p.volume, p.acessoDificil) });
  }
  if (p.servico === "mudanca" && p.mudanca?.tipologia) {
    linhas.push({ rotulo: ROTULO_DA_ESTIMATIVA_DA_MUDANCA, texto: estimativaDaMudanca(orcamentoDaMudanca(p.mudanca)) });
  }
  return { linhas, nota: NOTA_DOS_PRECOS };
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
 * Lê o corpo da R12 sem confiar em nada: `{ servico, movelModo?, itens?,
 * tipologia?, kmPercurso?, origem?, destino?, desmontagem? }`. `null` se o
 * serviço não vier.
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
  if (c.acessoDificil === true) p.acessoDificil = true;
  if (c.servico === "mudanca") {
    const tipologia = TIPOLOGIAS.find((t) => t === c.tipologia) ?? null;
    const km = typeof c.kmPercurso === "number" && Number.isFinite(c.kmPercurso) && c.kmPercurso >= 0 && c.kmPercurso < 5000 ? c.kmPercurso : null;
    p.mudanca = { tipologia, kmPercurso: km, desmontagem: c.desmontagem === true, origem: ponta(c.origem), destino: ponta(c.destino) };
  }
  return p;
}
