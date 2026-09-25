import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool, appendOrderHistory, registarSemFalhar } from "@/lib/db";
import { lerForma } from "@/lib/forma-de-pagamento";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "@/lib/taxas-plataforma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «JÁ PAGÁMOS AO PROFISSIONAL» — DITO NOS PAGAMENTOS, E SEM ESPERAR PELO CLIENTE.
 *
 * *«Tem trabalhos que já recebemos mas ainda não pagámos os pros, e tem pedidos
 * que ainda não pagaram mas já pagámos os pros.»* — 25-09-2026.
 *
 * O botão das Carteiras só marca como pago o que o cliente já CONFIRMOU — é a
 * regra certa para decidir QUANDO pagar. Mas este ecrã não decide nada: anota
 * o que já aconteceu. E aconteceu a CLYON adiantar o pagamento a um
 * profissional antes de o cliente pagar, ou antes de ele carregar no botão de
 * confirmar. Sem isto, esse trabalho ficava para sempre em «por pagar» e o
 * próximo a olhar para a lista pagava outra vez.
 *
 * POR ISSO NÃO SE EXIGE CONFIRMAÇÃO NEM PAGAMENTO DO CLIENTE — mas fica dito no
 * histórico quando foi adiantado, para quem fizer as contas depois saber que a
 * CLYON está a descoberto nesse trabalho.
 *
 * Os guardas estão no SQL: só um trabalho acordado e ainda sem `pagoEm`. Dois
 * cliques não pagam duas vezes.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [linhas] = (await pool.execute(
      `SELECT n.pedidoId, n.valorAcordado, n.taxaCliente, n.taxaProfissional,
              n.formaDePagamento, n.confirmadoEm,
              pr.name AS profissional,
              pg.pagoEm AS clientePagouEm
         FROM negociacoes n
         JOIN providers pr ON pr.id = n.providerId
         LEFT JOIN pagamentos pg ON pg.negociacaoPaga = n.id
        WHERE n.id = ? LIMIT 1`,
      [negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];

    const l = linhas[0];
    if (!l) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });

    // Em dinheiro o profissional recebeu do cliente, no local: não há nada a transferir.
    if (lerForma(l.formaDePagamento) === "dinheiro") {
      return NextResponse.json(
        { error: "Este trabalho é pago em mão ao profissional — a CLYON não lhe transfere nada." },
        { status: 409 },
      );
    }

    const [res] = (await pool.execute(
      `UPDATE negociacoes SET pagoEm = NOW()
        WHERE id = ? AND estado = 'acordada' AND pagoEm IS NULL`,
      [negociacaoId],
    )) as [{ affectedRows?: number }, unknown];

    if (Number(res?.affectedRows ?? 0) === 0) {
      return NextResponse.json(
        { error: "Não há nada para marcar: ou o trabalho não está fechado, ou já foi pago." },
        { status: 409 },
      );
    }

    const recebe =
      l.valorAcordado != null
        ? quantoOProfissionalRecebe(Number(l.valorAcordado), taxasDaNegociacao(l))
        : null;
    const quanto = recebe != null ? `${recebe.toFixed(2).replace(".", ",")} €` : "o valor acordado";
    const porQuem = colab?.nome ?? "a CLYON";

    const adiantado = [
      l.clientePagouEm == null ? "o cliente ainda não pagou" : null,
      l.confirmadoEm == null ? "o cliente ainda não confirmou o trabalho" : null,
    ].filter(Boolean);
    const nota = adiantado.length > 0 ? ` ADIANTADO: ${adiantado.join(" e ")}.` : "";

    const mensagem =
      `Pagamento a ${String(l.profissional)} marcado como feito por ${porQuem} — ${quanto}. ` +
      `Transferência feita fora da plataforma.${nota}`;

    await appendOrderHistory(Number(l.pedidoId), { type: "created", by: null, message: mensagem });

    await registarSemFalhar({
      acontecimento: "levantamento_pago",
      pedidoId: Number(l.pedidoId),
      negociacaoId,
      autorTipo: "clyon",
      autorNome: porQuem,
      valor: recebe,
      resumo: mensagem,
    });

    return NextResponse.json({ ok: true, pago: recebe, adiantado: adiantado.length > 0 });
  } catch (e) {
    console.error("[admin/pagamentos/pago-ao-profissional]", e);
    const porque = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Não foi possível marcar como pago.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}
