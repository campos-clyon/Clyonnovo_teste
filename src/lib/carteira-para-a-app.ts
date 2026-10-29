import { ensureSimulatorOrdersTable, getPool } from "./db";
import { carteiraDoCliente, type TrabalhoDoCliente } from "./carteira-do-cliente";
import { negociacoesDaContaNoEcra, porPedido, sqlDasNegociacoesDaConta } from "./pedidos-da-conta";
import { PROMESSA } from "./pagamento-na-plataforma";
import { nomeDoServico } from "./service-categories";
import { diaCurtoEmLisboa } from "./pedido-para-a-app";

/**
 * A CARTEIRA DO CLIENTE NA APP — 29-10-2026 (S22, E11 v3).
 *
 * A mesma conta da carteira da `/conta` (`carteiraDoCliente`), com as
 * negociações pela mesma porta (`negociacoesDaContaNoEcra`: só o preço DELE,
 * nunca o do profissional), e tudo já em texto para a app.
 */
const emEuros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export async function carteiraDoClienteParaAApp(email: string, agora: Date = new Date()) {
  const e = email.trim().toLowerCase();
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("[carteira-para-a-app] base de dados indisponível");
  const [pedidos] = (await pool.execute(
    `SELECT o.id, o.serviceType, o.baseDoPreco, (o.valorFixoClyon IS NOT NULL) AS trabalhoClyon
       FROM simulatorOrders o
      WHERE LOWER(TRIM(o.contactEmail)) = ?
      ORDER BY o.createdAt DESC
      LIMIT 200`,
    [e],
  )) as [Array<Record<string, unknown>>, unknown];
  const ids = pedidos.map((p) => Number(p.id)).filter((n) => Number.isInteger(n));
  let linhasPorPedido = new Map<number, Array<Record<string, unknown> & { estado: string }>>();
  if (ids.length > 0) {
    const [negs] = (await pool.execute(sqlDasNegociacoesDaConta(ids.length), ids)) as [
      Array<Record<string, unknown> & { estado: string }>,
      unknown,
    ];
    linhasPorPedido = porPedido(negs);
  }
  const trabalhos: TrabalhoDoCliente[] = pedidos.flatMap((p) =>
    negociacoesDaContaNoEcra(p as { id: unknown }, linhasPorPedido.get(Number(p.id)), agora).map((n) => ({
      negociacaoId: n.id,
      pedidoId: Number(p.id),
      estado: n.estado,
      precoDoCliente: n.valores?.aPagar ?? null,
      confirmadoEm: n.confirmadoEm ?? null,
      pagoEm: n.pagoEm ?? null,
      profissionalNome: n.profissional?.nome ?? null,
      serviceType: (p.serviceType as string | null) ?? null,
    })) as TrabalhoDoCliente[],
  );
  const c = carteiraDoCliente(trabalhos);
  return {
    ok: true as const,
    rotuloDoTotal: PROMESSA.clienteRotuloDoTotal,
    emCursoTexto: emEuros(c.retido),
    explicacao: c.retido > 0 ? PROMESSA.clienteTotalComValor : PROMESSA.clienteTotalVazio,
    concluidoTexto: emEuros(c.pago),
    linhas: c.linhas.map((l) => ({
      pedidoId: l.pedidoId,
      servico: nomeDoServico(l.serviceType),
      profissional: l.profissionalNome,
      totalTexto: emEuros(l.total),
      fase: l.fase === "retido" ? "em curso" : "concluído",
      quandoTexto: diaCurtoEmLisboa(l.quando),
    })),
    nota: { titulo: PROMESSA.clienteTitulo, texto: PROMESSA.clienteCorpo },
  };
}
