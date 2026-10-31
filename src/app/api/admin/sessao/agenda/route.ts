import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth-helper";
import { lerMarcacao } from "@/lib/agenda-das-assistentes";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";
import { agendaDe, alterarMarcacao, apagarMarcacao, criarMarcacao } from "@/lib/presenca-na-base";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A MINHA AGENDA — 31-10-2026 (ordem do CEO e do dono).
 *
 * GET  — as ausências da assistente que chama, e só as dela.
 * POST — `{ accao: "criar" | "alterar" | "apagar", id?, tipo, deDia, ateDia?, deHora?, ateHora?, nota? }`.
 *
 * Quem é sai SEMPRE do token: o corpo nunca diz de quem é a agenda, e alterar
 * ou apagar só toca numa marcação com o id dela (`AND colaboradorId = ?`).
 * Apagar vai por POST porque nenhum DELETE passa a um assistente
 * (papel-do-painel.ts) — e aqui a marcação é dela.
 *
 * Fica debaixo de /api/admin/sessao, que qualquer assistente chama sem
 * precisar de secção. O administrador vê as agendas de todas em
 * /api/admin/presenca; esta rota não é para ele.
 */
function soAssistente(papel: string) {
  return papel === "assistente"
    ? null
    : NextResponse.json({ error: "A agenda pessoal é das contas de assistente." }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const recusa = soAssistente(colab.papel);
  if (recusa) return recusa;
  try {
    return NextResponse.json({ marcacoes: await agendaDe(colab.id) });
  } catch (error) {
    console.error("[admin/sessao/agenda GET]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível ler a agenda." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const recusa = soAssistente(colab.papel);
  if (recusa) return recusa;

  const travao = await checkRateLimit(`agenda-pessoal:${colab.id}`, 30, 60);
  if (!travao.allowed) {
    return NextResponse.json({ error: "Demasiadas alterações seguidas. Espere um minuto." }, { status: 429 });
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const accao = corpo?.accao;
  const id = Number(corpo?.id);

  try {
    if (accao === "apagar") {
      if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Marcação inválida." }, { status: 400 });
      const apagada = await apagarMarcacao(colab.id, id);
      if (!apagada) return NextResponse.json({ error: "Marcação não encontrada." }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (accao !== "criar" && accao !== "alterar") {
      return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
    }
    const lida = lerMarcacao(corpo, diaEmLisboa(new Date()));
    if (!lida.ok) return NextResponse.json({ error: lida.erro }, { status: 400 });

    if (accao === "criar") {
      const novo = await criarMarcacao(colab.id, lida.marcacao);
      return NextResponse.json({ ok: true, id: novo });
    }
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Marcação inválida." }, { status: 400 });
    const alterada = await alterarMarcacao(colab.id, id, lida.marcacao);
    if (!alterada) return NextResponse.json({ error: "Marcação não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/sessao/agenda POST]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível gravar a agenda." }, { status: 500 });
  }
}
