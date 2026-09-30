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
 *   • RETIDO — trabalhos fechados que ainda não confirmou. É o que ele
 *     controla: enquanto não confirmar, o trabalho não fecha.
 *
 *   • PAGO — trabalhos que confirmou.
 *
 * ⚠️ OS DOIS NOMES SÃO DE DENTRO, e não se mostram — 29-09-2026. O ecrã diz
 * «em curso» e «concluído». «Retido» só é verdade para quem pagou a referência
 * à CLYON, e esta carteira não sabe quem já a pagou nem junta só esses: a quem
 * vai pagar em notas ao profissional, «retido» dizia que a CLYON lhe guardava
 * um dinheiro que nunca vai passar por ela. Ver `pagamento-na-plataforma.ts`.
 *
 * A taxa da plataforma entra nos dois. O que se mostra é sempre o que ele
 * paga de facto, nunca o valor seco combinado com o profissional: um número
 * que não é o que sai da conta dele não lhe serve para nada.
 *
 * Aqui não há saldo. Um cliente não tem dinheiro guardado connosco — tem
 * trabalhos em curso. Chamar "saldo" a isto era inventar uma conta que não
 * existe.
 */

import { taxasDaNegociacao } from "./taxas-plataforma";
import { precoParaOCliente } from "./preco-do-cliente";

export type TrabalhoDoCliente = {
  negociacaoId: number;
  pedidoId: number;
  estado: string;
  valorAcordado: number | string | null;
  /*
   * A COMISSÃO DESTE TRABALHO, e não a de hoje — 29-09-2026.
   *
   * A carteira fazia a conta com as taxas de origem. Em dinheiro a taxa do
   * cliente é 11 % (leva a parte do profissional), e a carteira dizia-lhe 5 %:
   * outro número para o mesmo trabalho que o ecrã do pedido. Nulas valem as
   * de origem, como em todo o lado.
   */
  taxaCliente?: number | string | null;
  taxaProfissional?: number | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
  profissionalNome?: string | null;
  serviceType?: string | null;
  /**
   * O regime de IVA do profissional.
   *
   * JA NAO ENTRA EM CONTA NENHUMA desde 22-09-2026: quem factura ao cliente e
   * a CLYON, e o imposto de uma factura e o de quem a emite. Fica no tipo
   * porque a consulta o traz e porque continua a ser a verdade fiscal dele.
   */
  regimeIva?: string | null;
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

    // SEM IVA — o mesmo número que lhe foi dito em todo o lado. A carteira a
    // dizer 361,20 € sobre um trabalho anunciado a 294,00 € era a terceira
    // versão do mesmo preço; o imposto, quando ele pedir factura, acresce.
    // É o preço DELE, já com a taxa, feito pela mesma função que o diz nas
    // propostas (`preco-do-cliente.ts`) e com as taxas deste trabalho.
    const total = precoParaOCliente(acordado, taxasDaNegociacao(t));
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
