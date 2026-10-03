import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO_PROFISSIONAL } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { getPool } from "@/lib/db";
import { duracaoValida } from "@/lib/agenda-em-grelha";

export const runtime = "nodejs";

/**
 * QUANTO TEMPO LEVA O TRABALHO — o profissional muda-o na agenda dele.
 *
 * *«Deixe eu mudar o tempo estimado para realizar o trabalho, ex. o da Irene
 * eram 4 horas.»* — 03-10-2026. Puxa-se a borda de baixo do bloco, e isto grava
 * ao largar.
 *
 * As regras são as de mudar o dia (`../route.ts`): a negociação tem de ser
 * DELE (o `providerId` sai da sessão e entra no WHERE), tem de estar fechada
 * com ele, e não pode estar confirmada nem paga — aí já é o registo do que
 * aconteceu.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

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
      `SELECT estado, confirmadoEm, pagoEm FROM negociacoes
        WHERE id = ? AND providerId = ? LIMIT 1`,
      [negociacaoId, sessao.providerId],
    )) as [Array<{ estado: string; confirmadoEm: Date | null; pagoEm: Date | null }>, unknown];
    const linha = linhas[0];
    if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    if (linha.estado !== "acordada") {
      return NextResponse.json(
        { error: "Só se muda a duração de um trabalho que já é seu." },
        { status: 409 },
      );
    }
    if (linha.confirmadoEm || linha.pagoEm) {
      return NextResponse.json(
        { error: "Este trabalho já está fechado — a duração já não se muda." },
        { status: 409 },
      );
    }

    await pool.execute(
      "UPDATE negociacoes SET duracaoMinutos = ? WHERE id = ? AND providerId = ?",
      [minutos, negociacaoId, sessao.providerId],
    );
    return NextResponse.json({ ok: true, duracaoMinutos: minutos });
  } catch (e) {
    console.error("[profissionais/agenda/duracao]", e);
    return NextResponse.json({ error: "Não foi possível gravar a duração." }, { status: 500 });
  }
}
