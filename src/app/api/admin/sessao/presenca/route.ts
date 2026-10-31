import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth-helper";
import { LIMITE_DE_INACTIVIDADE_MS } from "@/lib/presenca-do-backoffice";
import { registarSinalDePresenca } from "@/lib/presenca-na-base";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sinais por minuto que uma pessoa pode mandar (um por minuto por separador, com folga). */
const SINAIS_POR_MINUTO = 12;

/**
 * POST /api/admin/sessao/presenca — 31-10-2026 (ordem do CEO e do dono).
 *
 * O sinal de presença de uma assistente: «estou activa, a última interacção
 * foi há N ms». Só da própria — quem é sai do token, e o corpo não traz id
 * nenhum. Fica debaixo de /api/admin/sessao, que qualquer assistente chama.
 *
 * O administrador (o dono) não é contado: a rota responde sem gravar nada. E
 * a resposta nunca traz horas — a assistente não vê a presença dela; só o
 * administrador a vê, em /api/admin/presenca.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  if (colab.papel !== "assistente") return NextResponse.json({ ok: true, conta: false });

  // O travão: por pessoa, não por endereço — vários separadores contam juntos.
  const travao = await checkRateLimit(`presenca:${colab.id}`, SINAIS_POR_MINUTO, 60);
  if (!travao.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  let corpo: { msDesdeInteraccao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const ms = Number(corpo.msDesdeInteraccao);
  if (!Number.isFinite(ms) || ms < 0 || ms > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Sinal inválido." }, { status: 400 });
  }
  // Sem interacção há 15 minutos o navegador já não devia ter enviado: não conta.
  if (ms >= LIMITE_DE_INACTIVIDADE_MS) return NextResponse.json({ ok: true });

  try {
    await registarSinalDePresenca(colab.id, ms);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Um sinal perdido não é notícia: o seguinte tenta outra vez.
    console.error("[admin/sessao/presenca]", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
