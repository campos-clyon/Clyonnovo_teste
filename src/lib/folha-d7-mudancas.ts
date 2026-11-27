/**
 * A FOLHA DA MEDIÇÃO DE 30 DIAS DA d7 — as mudanças (d14, 27-11-2026).
 *
 * UMA LINHA POR N.º DE PEDIDO DE MUDANÇA: «desde» (quando entrou, hora de
 * Lisboa), a referência (o que a tabela dava para as horas previstas, sem
 * IVA), o valor proposto ao cliente (sem IVA), se aceitou e, se o pedido fechou,
 * o motivo. Sem dados de pessoas: nem nome, nem telefone, nem morada.
 *
 * PURO. A leitura da base está em `folha-d7-mudancas-na-base.ts`, e a folha
 * lê-se em `/api/admin/mudancas/folha-d7` (JSON, ou CSV com `?formato=csv`).
 */

import { lerBase } from "./base-do-preco";
import { dataEHoraEmLisboa, instanteDaBase } from "./hora-de-lisboa";
import { textoDoMotivo, lerMotivoDoFecho } from "./motivo-do-fecho";
import { PRECO_POR_HORA } from "./tabela-das-mudancas";

/** A janela da medição. */
export const DIAS_DA_MEDICAO_D7 = 30;

export type AceiteNaFolha = "sim" | "nao" | "em_curso";

export type LinhaDaFolhaD7 = {
  pedidoId: number;
  /** «dd/mm/aaaa hh:mm» em Lisboa. */
  desde: string;
  base: "hora" | "carga" | "total";
  /** A referência da tabela para as horas previstas, em € sem IVA — só nas mudanças à hora. */
  referencia: number | null;
  /** O valor ao cliente, em € sem IVA (o valor único; senão o último valor proposto por um parceiro) — ou null. */
  valorProposto: number | null;
  aceite: AceiteNaFolha;
  /** O motivo de fecho, em palavras («Preço (queria pagar 150 €)»); vazio enquanto o pedido está aberto. */
  motivo: string;
};

export type PedidoParaAFolhaD7 = {
  id: number;
  createdAt: string | Date | null | undefined;
  baseDoPreco: string | null | undefined;
  status: string | null | undefined;
  /** As horas previstas (mínimo 3) — `horasPrevistasDaLinha`. */
  horasPrevistas: number;
  valorUnicoCliente: number | string | null | undefined;
  precoAceiteEm: string | Date | null | undefined;
  motivoDoFecho: string | null | undefined;
  quantoQueriaPagar: number | string | null | undefined;
  negociacoes: ReadonlyArray<{ estado: string; propostasJson: string | null; valorAcordado: number | string | null }>;
};

const ESTADOS_DE_ACEITE = ["acordada", "aguarda_contratacao"];

const numero = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/** O último valor proposto por um parceiro numa das negociações do pedido. */
function ultimoValorDeUmParceiro(negs: PedidoParaAFolhaD7["negociacoes"]): number | null {
  let valor: number | null = null;
  let quando = -Infinity;
  for (const n of negs) {
    let lista: unknown;
    try {
      lista = JSON.parse(n.propostasJson ?? "[]");
    } catch {
      continue;
    }
    if (!Array.isArray(lista)) continue;
    for (const x of lista as Array<{ por?: unknown; valor?: unknown; criadaEm?: unknown }>) {
      if (x?.por !== "profissional") continue;
      const v = numero(x.valor);
      const t = instanteDaBase(typeof x.criadaEm === "string" ? x.criadaEm : null)?.getTime() ?? 0;
      if (v != null && t >= quando) {
        valor = v;
        quando = t;
      }
    }
  }
  return valor;
}

/** Uma linha da folha. Pura. */
export function linhaDaFolhaD7(p: PedidoParaAFolhaD7): LinhaDaFolhaD7 {
  const base = lerBase(p.baseDoPreco);
  const desde = instanteDaBase(p.createdAt ?? null);
  const aceitou =
    instanteDaBase(p.precoAceiteEm ?? null) != null ||
    String(p.status ?? "") === "concluido" ||
    p.negociacoes.some((n) => ESTADOS_DE_ACEITE.includes(n.estado) || numero(n.valorAcordado) != null);
  const fechado = ["cancelado", "arquivado", "rejeitado"].includes(String(p.status ?? ""));
  const motivoChave = lerMotivoDoFecho(p.motivoDoFecho);
  const quanto = numero(p.quantoQueriaPagar);
  return {
    pedidoId: p.id,
    desde: desde ? dataEHoraEmLisboa(desde) : "",
    base,
    referencia: base === "hora" ? Math.round(PRECO_POR_HORA * Math.max(0, p.horasPrevistas) * 100) / 100 : null,
    valorProposto: numero(p.valorUnicoCliente) ?? ultimoValorDeUmParceiro(p.negociacoes),
    aceite: aceitou ? "sim" : fechado ? "nao" : "em_curso",
    motivo: motivoChave
      ? textoDoMotivo(motivoChave, quanto).replace(/^Motivo: /, "").replace(/\.$/, "")
      : fechado
        ? "sem motivo gravado"
        : "",
  };
}

/** A folha inteira, do pedido mais recente para o mais antigo. */
export function folhaD7(pedidos: readonly PedidoParaAFolhaD7[]): LinhaDaFolhaD7[] {
  return pedidos.map(linhaDaFolhaD7).sort((a, b) => b.pedidoId - a.pedidoId);
}

export const COLUNAS_DA_FOLHA_D7 = ["pedido", "desde", "base", "referencia", "valorProposto", "aceite", "motivo"] as const;

/** O CSV da folha (separado por «;», números com vírgula, para abrir no Excel em português). */
export function csvDaFolhaD7(linhas: readonly LinhaDaFolhaD7[]): string {
  const num = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
  const txt = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const corpo = linhas.map((l) =>
    [l.pedidoId, l.desde, l.base, num(l.referencia), num(l.valorProposto), l.aceite, txt(l.motivo)].join(";"),
  );
  return [COLUNAS_DA_FOLHA_D7.join(";"), ...corpo].join("\n");
}
