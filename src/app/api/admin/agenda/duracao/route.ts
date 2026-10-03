import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool } from "@/lib/db";
import { duracaoValida } from "@/lib/agenda-em-grelha";

export const runtime = "nodejs";

/**
 * QUANTO TEMPO LEVA O TRABALHO — a CLYON muda-o na agenda do backoffice.
 *
 * *«Deixe eu mudar o tempo estimado para realizar o trabalho, ex. o da Irene
 * eram 4 horas.»* — 03-10-2026. Puxa-se a borda de baixo do bloco, e isto grava
 * ao largar. O profissional muda o dele pela rota irmã, em
 * `/api/profissionais/agenda/duracao`.
 *
 * Um trabalho confirmado ou pago já não muda: aí a duração é o registo do que
 * aconteceu, como a data.
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown; minutos?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  const minutos = Number(corpo.minutos);
  if (!duracaoValida(minutos)) {
    return NextResponse.json(
      { error: "A duração vai de meia hora a doze horas, de quarto em quarto de hora." },
      { status: 400 },
    );
  }

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [linhas] = (await pool.execute(
      "SELECT estado, confirmadoEm, pagoEm FROM negociacoes WHERE id = ? LIMIT 1",
      [negociacaoId],
    )) as [Array<{ estado: string; confirmadoEm: Date | null; pagoEm: Date | null }>, unknown];
    const linha = linhas[0];
    if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    if (linha.estado !== "acordada") {
      return NextResponse.json(
        { error: "Só se muda a duração de um trabalho fechado." },
        { status: 409 },
      );
    }
    if (linha.confirmadoEm || linha.pagoEm) {
      return NextResponse.json(
        { error: "Este trabalho já está fechado — a duração já não se muda." },
        { status: 409 },
      );
    }

    await pool.execute("UPDATE negociacoes SET duracaoMinutos = ? WHERE id = ?", [
      minutos,
      negociacaoId,
    ]);
    return NextResponse.json({ ok: true, duracaoMinutos: minutos });
  } catch (e) {
    console.error("[admin/agenda/duracao]", e);
    return NextResponse.json({ error: "Não foi possível gravar a duração." }, { status: 500 });
  }
}
