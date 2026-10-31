/**
 * OS MATERIAIS NA PROPOSTA — ordem do CEO com o sim do dono, 31-10-2026
 * (acrescento à ordem das horas).
 *
 * Numa mudança, «47 € por hora» não diz se as caixas, o filme e o cartão vêm
 * dentro. Ao propor, quem faz o trabalho diz uma de duas coisas:
 *
 *   · «Materiais incluídos» — o valor já os traz;
 *   · «Materiais à parte» — e o preço de cada um (caixa por unidade, cartão e
 *     filme por rolo, e outro que queira acrescentar).
 *
 * O cliente lê-o na proposta (link, /conta, app de cliente), a equipa nos
 * cartões do backoffice e na mensagem do orçamento, e no fim do trabalho as
 * quantidades usadas somam-se ao total (ver `horas-do-trabalho.ts`).
 *
 * OS NOMES E OS PREÇOS DE PARTIDA SÃO OS DA TABELA DAS MUDANÇAS
 * (`MATERIAIS` em tabela-das-mudancas.ts) — não há uma segunda lista. O preço
 * escrito é do mesmo lado do valor proposto (sem IVA, antes da taxa da
 * plataforma, como o valor por hora); o cliente lê-o já com a taxa e o IVA ao
 * lado (`materiaisParaOCliente`).
 *
 * Puro de propósito: a app Pro, a app de cliente e os testes importam-no.
 */

import { MATERIAIS } from "./tabela-das-mudancas";
import { precoDoCliente, type PrecoDoCliente } from "./preco-do-cliente";
import type { Taxas } from "./taxas-plataforma";
import type { ModeloDoPreco } from "./iva-incluido";

/** Um material à parte, com o preço por unidade. */
export type MaterialDaProposta = {
  /** O id da tabela das mudanças (`caixa`, `cartao_canelado`, `filme`…) ou `outro-N`. */
  id: string;
  nome: string;
  /** Sem IVA, do lado de quem propõe (como o valor por hora). */
  preco: number;
  /** «unidade», «rolo»… — diz-se a seguir ao preço. */
  unidade: string;
};

export type MateriaisDaProposta =
  | { incluidos: true }
  | { incluidos: false; itens: MaterialDaProposta[] };

/** Os três que a ordem pede, pelos nomes curtos e com o preço de partida da tabela. */
export const MATERIAIS_DE_PARTIDA: readonly MaterialDaProposta[] = (
  [
    ["caixa", "Caixa", "unidade"],
    ["cartao_canelado", "Cartão", "rolo"],
    ["filme", "Filme / plástico", "rolo"],
  ] as const
).map(([id, nome, unidade]) => ({
  id,
  nome,
  unidade,
  preco: MATERIAIS.find((m) => m.id === id)?.preco ?? 0,
}));

export const MAXIMO_DE_MATERIAIS = 8;
export const PRECO_MAXIMO_DE_UM_MATERIAL = 500;
export const NOME_MAXIMO_DE_UM_MATERIAL = 40;
export const QUANTIDADE_MAXIMA_DE_UM_MATERIAL = 999;

/** As frases curtas, iguais em todos os ecrãs. */
export const MATERIAIS_INCLUIDOS = "Materiais incluídos";
export const MATERIAIS_A_PARTE = "Materiais à parte";
/** A pergunta, no formulário da proposta. */
export const PERGUNTA_DOS_MATERIAIS =
  "O valor já inclui os materiais (filme/plástico, cartão, caixas)?";

const arred = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/**
 * O QUE VEIO DO FORMULÁRIO (ou da base), validado. `null` quando não diz nada
 * — uma proposta sem a pergunta respondida (uma app antiga, um pedido que não
 * é mudança). Um material sem nome ou com preço impossível sai da lista; uma
 * lista «à parte» que fique vazia não é resposta nenhuma.
 */
export function lerMateriaisDaProposta(v: unknown): MateriaisDaProposta | null {
  let cru: unknown = v;
  if (typeof v === "string") {
    try {
      cru = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!cru || typeof cru !== "object") return null;
  const o = cru as { incluidos?: unknown; itens?: unknown };
  if (o.incluidos === true) return { incluidos: true };
  if (o.incluidos !== false || !Array.isArray(o.itens)) return null;
  const vistos = new Set<string>();
  const itens: MaterialDaProposta[] = [];
  for (const [i, x] of o.itens.entries()) {
    if (!x || typeof x !== "object") continue;
    const m = x as Record<string, unknown>;
    const partida = MATERIAIS_DE_PARTIDA.find((p) => p.id === m.id);
    const nome = texto(m.nome, NOME_MAXIMO_DE_UM_MATERIAL) || partida?.nome || "";
    const preco = numero(m.preco);
    if (!nome || preco == null || preco <= 0 || preco > PRECO_MAXIMO_DE_UM_MATERIAL) continue;
    const id = partida ? partida.id : texto(m.id, 24) || `outro-${i + 1}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    itens.push({
      id,
      nome,
      preco: arred(preco),
      unidade: texto(m.unidade, 16) || partida?.unidade || "unidade",
    });
    if (itens.length >= MAXIMO_DE_MATERIAIS) break;
  }
  return itens.length > 0 ? { incluidos: false, itens } : null;
}

/** «Caixa 2,00 €/unidade · Filme / plástico 10,00 €/rolo» — do lado de quem propôs. */
export function materiaisParaOProfissional(m: MateriaisDaProposta | null): string | null {
  if (!m) return null;
  if (m.incluidos) return `${MATERIAIS_INCLUIDOS} no valor.`;
  return `${MATERIAIS_A_PARTE}: ${m.itens.map((i) => `${i.nome} ${eur(i.preco)}/${i.unidade}`).join(" · ")}.`;
}

/** O preço de um material para o cliente: com a taxa da plataforma e o IVA ao lado. */
export function precoDoMaterialParaOCliente(
  preco: number,
  taxas: Taxas | undefined,
  modelo: ModeloDoPreco,
): PrecoDoCliente {
  return precoDoCliente(preco, taxas, modelo);
}

/**
 * «Materiais à parte: caixa 2,00 € + IVA (2,46 € com IVA) por unidade · …» —
 * o que o cliente lê na proposta. O sem IVA nunca vai sozinho.
 */
export function materiaisParaOCliente(
  m: MateriaisDaProposta | null,
  taxas: Taxas | undefined,
  modelo: ModeloDoPreco,
): string | null {
  if (!m) return null;
  if (m.incluidos) return `${MATERIAIS_INCLUIDOS} no valor.`;
  const partes = m.itens.map((i) => {
    const p = precoDoMaterialParaOCliente(i.preco, taxas, modelo);
    const preco = p.ivaIncluido ? `${eur(p.semIva)} + IVA (${eur(p.total)} com IVA)` : `${eur(p.semIva)} + IVA`;
    return `${i.nome.toLowerCase()} ${preco} por ${i.unidade}`;
  });
  return `${MATERIAIS_A_PARTE}: ${partes.join(" · ")}.`;
}

/** As quantidades usadas no fim, por id do material — inteiros de 0 a 999, só dos que estão à parte. */
export function lerQuantidadesUsadas(
  v: unknown,
  m: MateriaisDaProposta | null,
): Record<string, number> {
  if (!m || m.incluidos) return {};
  let cru: unknown = v;
  if (typeof v === "string") {
    try {
      cru = JSON.parse(v);
    } catch {
      return {};
    }
  }
  if (!cru || typeof cru !== "object") return {};
  const fora: Record<string, number> = {};
  for (const i of m.itens) {
    const q = numero((cru as Record<string, unknown>)[i.id]);
    if (q == null) continue;
    const inteiro = Math.floor(q);
    if (inteiro > 0 && inteiro <= QUANTIDADE_MAXIMA_DE_UM_MATERIAL) fora[i.id] = inteiro;
  }
  return fora;
}

export type LinhaDeMaterial = { id: string; nome: string; quantidade: number; unidade: string; preco: number; total: number };

/** Os materiais usados, linha a linha, com o total do lado de quem propôs (sem IVA). */
export function materiaisUsados(
  m: MateriaisDaProposta | null,
  quantidades: Record<string, number>,
): { linhas: LinhaDeMaterial[]; total: number } {
  if (!m || m.incluidos) return { linhas: [], total: 0 };
  const linhas = m.itens
    .filter((i) => (quantidades[i.id] ?? 0) > 0)
    .map((i) => {
      const quantidade = quantidades[i.id];
      return { id: i.id, nome: i.nome, quantidade, unidade: i.unidade, preco: i.preco, total: arred(quantidade * i.preco) };
    });
  return { linhas, total: arred(linhas.reduce((s, l) => s + l.total, 0)) };
}

/** «2 × caixa, 1 × filme / plástico» — curto, para o resumo das horas. */
export function quantidadesEmPalavras(linhas: LinhaDeMaterial[]): string {
  return linhas.map((l) => `${l.quantidade} × ${l.nome.toLowerCase()}`).join(", ");
}
