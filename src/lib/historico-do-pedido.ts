import { instanteDaBase } from "./hora-de-lisboa";

/**
 * O HISTÓRICO DE UM TRABALHO, PARA OS PAGAMENTOS — 26-10-2026 (d25).
 *
 * *«Mesmo após finalizar tudo, esses pedidos que estão como pagos nós
 * deveríamos poder abrir para ver do que se trata — ao clicar, deveria ter a
 * opção de abrir o histórico.»* — o dono.
 *
 * Duas fontes, cada uma com a sua pergunta:
 *
 *   · o REGISTO PERMANENTE responde a «quem marcou o quê e quando» no
 *     dinheiro: o pagamento que chegou pelo euPago (que não escreve no
 *     histórico do pedido), o recebimento anotado à mão, a transferência ao
 *     profissional, o valor corrigido — cada linha com o autor e a hora;
 *   · o HISTÓRICO DO PEDIDO (`historyJson`) é o que a ficha do pedido mostra
 *     no separador «Histórico», do primeiro dia ao último.
 *
 * Puro, para se poder interrogar sem base de dados.
 */

/** Os acontecimentos do registo que são dinheiro deste trabalho. */
export const ACONTECIMENTOS_DO_DINHEIRO = [
  "negociacao_fechada",
  "execucao_confirmada",
  "pagamento_declarado",
  "pagamento_pedido",
  "pagamento_recebido",
  "pagamento_falhado",
  "pagamento_em_duplicado",
  "divida_abatida",
  "valor_corrigido",
  "levantamento_pago",
] as const;

const NOME_DO_ACONTECIMENTO: Record<string, string> = {
  negociacao_fechada: "Trabalho fechado com o profissional",
  execucao_confirmada: "Trabalho confirmado",
  pagamento_declarado: "Pagamento declarado ao dar o trabalho por feito",
  pagamento_pedido: "Referência de pagamento gerada",
  pagamento_recebido: "Pagamento do cliente recebido",
  pagamento_falhado: "Pagamento falhado",
  pagamento_em_duplicado: "Pagamento em duplicado",
  divida_abatida: "Dívida abatida no saldo do profissional",
  valor_corrigido: "Valor corrigido",
  levantamento_pago: "Pago ao profissional",
};

const NOME_DO_AUTOR: Record<string, string> = {
  clyon: "a CLYON",
  assistente: "um assistente",
  cliente: "o cliente",
  profissional: "o profissional",
  sistema: "automático",
};

export type MarcaDoDinheiro = {
  /** ISO, ou nulo se a data não se ler. */
  quando: string | null;
  quem: string;
  oQue: string;
  acontecimento: string;
};

export type EntradaDoHistorico = {
  quando: string | null;
  quem: string | null;
  tipo: string;
  mensagem: string;
  /** Fala de dinheiro — o ecrã realça-a. */
  dinheiro: boolean;
};

/** Uma linha do registo, como a base a devolve (só as colunas que aqui se lêem). */
export type LinhaDoRegisto = {
  acontecimento?: unknown;
  ocorridoEm?: unknown;
  autorTipo?: unknown;
  autorNome?: unknown;
  resumo?: unknown;
  negociacaoId?: unknown;
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

function iso(v: unknown): string | null {
  const d = instanteDaBase(v as string | Date | null | undefined);
  return d ? d.toISOString() : null;
}

function porOrdem<T extends { quando: string | null }>(linhas: T[], maisRecentePrimeiro: boolean): T[] {
  const ms = (x: T) => (x.quando ? Date.parse(x.quando) : Number.NaN);
  return linhas
    .map((x, i) => ({ x, i }))
    .sort((a, b) => {
      const ma = ms(a.x);
      const mb = ms(b.x);
      // Sem data ficam no fim, pela ordem em que vieram.
      if (Number.isNaN(ma) || Number.isNaN(mb)) {
        if (Number.isNaN(ma) && Number.isNaN(mb)) return a.i - b.i;
        return Number.isNaN(ma) ? 1 : -1;
      }
      if (ma !== mb) return maisRecentePrimeiro ? mb - ma : ma - mb;
      return a.i - b.i;
    })
    .map(({ x }) => x);
}

/**
 * QUEM MARCOU O QUÊ E QUANDO, do mais antigo para o mais recente — é a ordem
 * em que o dinheiro andou. Uma linha de outra negociação do mesmo pedido (um
 * profissional trocado) fica de fora quando se sabe qual é a deste trabalho.
 */
export function marcasDoDinheiro(linhas: readonly LinhaDoRegisto[], negociacaoId?: number | null): MarcaDoDinheiro[] {
  const doDinheiro = new Set<string>(ACONTECIMENTOS_DO_DINHEIRO);
  const saida: MarcaDoDinheiro[] = [];
  for (const l of linhas) {
    const acontecimento = texto(l.acontecimento);
    if (!doDinheiro.has(acontecimento)) continue;
    const daLinha = l.negociacaoId == null ? null : Number(l.negociacaoId);
    if (negociacaoId != null && daLinha != null && Number.isFinite(daLinha) && daLinha !== negociacaoId) continue;
    const autorNome = texto(l.autorNome);
    const autorTipo = texto(l.autorTipo);
    saida.push({
      quando: iso(l.ocorridoEm),
      quem: autorNome || NOME_DO_AUTOR[autorTipo] || autorTipo || "—",
      oQue: texto(l.resumo) || NOME_DO_ACONTECIMENTO[acontecimento] || acontecimento,
      acontecimento,
    });
  }
  return porOrdem(saida, false);
}

/** Palavras que dizem que uma entrada do histórico é sobre dinheiro. */
const DO_DINHEIRO = /€|\bpag|transfer|factur|fatur|reembols|levantament|comiss|\bIVA\b/i;

/**
 * O HISTÓRICO DO PEDIDO, do mais recente para trás — como a ficha o mostra.
 * Tolerante: um `historyJson` partido ou uma entrada sem mensagem não rebentam
 * o ecrã do dinheiro, ficam de fora.
 */
export function entradasDoHistorico(json: unknown): EntradaDoHistorico[] {
  let lista: unknown;
  try {
    lista = typeof json === "string" && json.trim() ? JSON.parse(json) : [];
  } catch {
    return [];
  }
  if (!Array.isArray(lista)) return [];
  const saida: EntradaDoHistorico[] = [];
  for (const e of lista) {
    if (!e || typeof e !== "object") continue;
    const o = e as { type?: unknown; by?: unknown; message?: unknown; createdAt?: unknown };
    const mensagem = texto(o.message);
    if (!mensagem) continue;
    const por = o.by && typeof o.by === "object" ? texto((o.by as { nome?: unknown }).nome) : "";
    saida.push({
      quando: iso(o.createdAt),
      quem: por || null,
      tipo: texto(o.type) || "nota",
      mensagem,
      dinheiro: DO_DINHEIRO.test(mensagem),
    });
  }
  return porOrdem(saida, true);
}
