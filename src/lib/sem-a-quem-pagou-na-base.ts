import { contaDaCarteiraDoProfissional } from "./conta-da-carteira-na-base";

/**
 * OS TRABALHOS FEITOS SEM «A QUEM O CLIENTE PAGOU» — 27-11-2026 (o #558, dono).
 *
 * Um trabalho feito e confirmado de que ninguém registou a quem o cliente pagou
 * (à CLYON ou ao profissional) aparecia ao parceiro «por receber», como se a
 * CLYON lhe devesse. A carteira passou a pô-lo «por confirmar o pagamento»
 * (`trabalhos-da-carteira.ts`, grupo `por_confirmar`); aqui junta-se a lista de
 * TODOS os parceiros, pelo n.º do pedido, para a Mesa a mostrar em «Precisa de
 * si» — «Falta dizer a quem o cliente pagou».
 *
 * A pergunta é a da carteira e não outra: lê-se a carteira de cada parceiro com
 * trabalhos confirmados por pagar (`contaDaCarteiraDoProfissional`, a mesma do
 * painel, da app Pro e das Carteiras) e ficam as linhas `por_confirmar`.
 *
 * Com 5 minutos de memória: o «Precisa de si» atualiza-se sozinho e esta conta
 * lê a carteira inteira de cada um. Se a leitura falhar, `null`.
 */
const MEMORIA_MS = 5 * 60 * 1000;
let guardado: { em: number; pedidos: number[] } | null = null;

export async function trabalhosSemAQuemPagou(agora: Date = new Date()): Promise<number[] | null> {
  if (guardado && agora.getTime() - guardado.em < MEMORIA_MS) return guardado.pedidos;
  try {
    const { getPool } = await import("./db");
    const pool = await getPool();
    if (!pool) return null;
    const [rows] = (await pool.execute(
      `SELECT DISTINCT providerId
         FROM negociacoes
        WHERE estado = 'acordada' AND confirmadoEm IS NOT NULL AND pagoEm IS NULL`,
    )) as unknown as [Array<{ providerId: number }>, unknown];
    const ids = (Array.isArray(rows) ? rows : []).map((r) => Number(r.providerId)).filter((n) => Number.isInteger(n) && n > 0);
    const pedidos = new Set<number>();
    for (const id of ids) {
      const conta = await contaDaCarteiraDoProfissional(id, agora);
      for (const l of conta.linhas) if (l.grupo === "por_confirmar") pedidos.add(Number(l.pedidoId ?? l.negociacaoId));
    }
    const lista = [...pedidos].sort((a, b) => b - a);
    guardado = { em: agora.getTime(), pedidos: lista };
    return lista;
  } catch (e) {
    console.error("[sem-a-quem-pagou]", e instanceof Error ? e.message : e);
    return null;
  }
}
