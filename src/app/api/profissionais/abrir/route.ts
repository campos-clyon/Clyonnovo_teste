import { NextRequest, NextResponse } from "next/server";
import { marcarTrabalhoComoAberto } from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";

export const runtime = "nodejs";

/**
 * «Já vi este.»
 *
 * O painel dizia «novo» em todos os cartões, para sempre. Não era um erro de
 * cálculo: «novo» queria dizer «está no separador dos novos», e um trabalho
 * fica lá até ele responder. Ele reparou — "os pedidos estão todos a mostrar
 * novo, mas novo deve ser apenas os 5 recentes ainda não abertos".
 *
 * Um aviso que nunca se apaga deixa de ser um aviso: passa a fazer parte do
 * fundo, e a coisa que ele devia destacar — o que chegou desde a última vez —
 * deixa de se ver.
 *
 * Esta rota grava a PRIMEIRA abertura, e só ela: o que interessa é quando ele
 * viu, não quando reviu.
 *
 * Falha em silêncio de propósito. Se isto não gravar, o pior que acontece é o
 * cartão continuar a dizer «novo» mais um bocado — e isso não pode ser motivo
 * para o trabalho não abrir.
 */
export async function POST(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

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

  try {
    const marcou = await marcarTrabalhoComoAberto(negociacaoId, sessao.providerId);
    return NextResponse.json({ ok: true, marcou });
  } catch (e) {
    console.error("[profissionais/abrir]", e);
    return NextResponse.json({ ok: true, marcou: false });
  }
}
