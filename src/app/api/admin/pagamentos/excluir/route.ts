import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { excluirTrabalho, TrabalhoComDinheiro } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «EXCLUIR TRABALHO» — para o que nunca foi a sério.
 *
 * *«Esse trabalho 200 foi um teste, quero excluir.»* — 01-10-2026.
 *
 * Só o administrador, como o apagar de um pedido: um assistente anota
 * pagamentos, não tira trabalhos da base. E com motivo, sempre — fica no
 * arquivo dos apagados, no registo, e na linha que o profissional vê.
 *
 * A guarda a sério está em `excluirTrabalho`, do lado da base: se algum
 * dinheiro se moveu, recusa e diz porquê. O ecrã esconde o botão nesses casos,
 * mas não é ele que protege.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown; motivo?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  const motivo = typeof corpo.motivo === "string" ? corpo.motivo.trim().slice(0, 120) : "";
  if (motivo.length < 3) {
    return NextResponse.json(
      { error: "Diga porque é que se exclui — ex.: «era um pedido de teste»." },
      { status: 400 },
    );
  }

  try {
    const r = await excluirTrabalho(negociacaoId, { motivo, autorNome: colab?.nome ?? null });
    if (!r) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    return NextResponse.json({
      ok: true,
      pedidoId: r.pedidoId,
      negociacoes: r.negociacoes,
      // O evento que não saiu da agenda já está no registo; diz-se também aqui,
      // a quem acabou de carregar no botão.
      eventoNaAgenda: r.eventoNaAgenda,
    });
  } catch (e) {
    if (e instanceof TrabalhoComDinheiro) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[admin/pagamentos/excluir]", negociacaoId, e);
    const porque = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Não foi possível excluir o trabalho.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}
