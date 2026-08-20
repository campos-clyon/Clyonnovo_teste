/**
 * O dinheiro do cliente, do lado dele.
 *
 * O profissional tem uma carteira desde o princípio — vê o que está cativo, o
 * que já pode levantar e o que já recebeu. O cliente não tinha nada: via o
 * valor dentro de cada pedido, um a um, e para saber quanto tinha em jogo
 * tinha de os abrir todos e somar de cabeça.
 *
 * É a mesma informação, do outro lado da mesa, e conta a mesma história:
 *
 *   • RETIDO — trabalhos fechados que ainda não confirmou. O dinheiro está
 *     prometido e ainda não chegou a ninguém. É o que ele controla: enquanto
 *     não confirmar, não sai.
 *
 *   • PAGO — trabalhos que confirmou. Saiu, e não volta.
 *
 * A taxa da plataforma entra nos dois. O que se mostra é sempre o que ele
 * paga de facto, nunca o valor seco combinado com o profissional: um número
 * que não é o que sai da conta dele não lhe serve para nada.
 *
 * Aqui não há saldo. Um cliente não tem dinheiro guardado connosco — tem
 * trabalhos em curso. Chamar "saldo" a isto era inventar uma conta que não
 * existe.
 */

import { quantoOClientePaga } from "./taxas-plataforma";

export type TrabalhoDoCliente = {
  negociacaoId: number;
  pedidoId: number;
  estado: string;
  valorAcordado: number | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
  profissionalNome?: string | null;
  serviceType?: string | null;
};

export type LinhaDaCarteira = {
  negociacaoId: number;
  pedidoId: number;
  profissionalNome: string | null;
  serviceType: string | null;
  /** O que ele paga, já com a taxa. */
  total: number;
  fase: "retido" | "pago";
  /** Quando confirmou, para ordenar e mostrar. */
  quando: string | null;
};

export type CarteiraDoCliente = {
  retido: number;
  pago: number;
  /** Retido + pago: tudo o que passou por aqui. */
  total: number;
  linhas: LinhaDaCarteira[];
};

const aosCentimos = (n: number) => Math.round(n * 100) / 100;

function valor(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function quando(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function carteiraDoCliente(trabalhos: TrabalhoDoCliente[]): CarteiraDoCliente {
  let retido = 0;
  let pago = 0;
  const linhas: LinhaDaCarteira[] = [];

  for (const t of trabalhos ?? []) {
    // Só conta o que ficou fechado. Uma negociação aberta é uma conversa, não
    // é dinheiro — pô-la aqui dava um número que muda a cada contraproposta.
    if (t.estado !== "acordada") continue;

    const acordado = valor(t.valorAcordado);
    if (acordado == null) continue;

    const total = aosCentimos(quantoOClientePaga(acordado));
    const confirmado = quando(t.confirmadoEm) ?? quando(t.pagoEm);

    if (confirmado) pago += total;
    else retido += total;

    linhas.push({
      negociacaoId: t.negociacaoId,
      pedidoId: t.pedidoId,
      profissionalNome: t.profissionalNome ?? null,
      serviceType: t.serviceType ?? null,
      total,
      fase: confirmado ? "pago" : "retido",
      quando: confirmado,
    });
  }

  // O que está por resolver primeiro — é sobre isso que ele pode agir hoje.
  // Dentro de cada grupo, o mais recente à frente.
  linhas.sort((a, b) => {
    if (a.fase !== b.fase) return a.fase === "retido" ? -1 : 1;
    return (b.quando ?? "").localeCompare(a.quando ?? "");
  });

  return {
    retido: aosCentimos(retido),
    pago: aosCentimos(pago),
    total: aosCentimos(retido + pago),
    linhas,
  };
}
