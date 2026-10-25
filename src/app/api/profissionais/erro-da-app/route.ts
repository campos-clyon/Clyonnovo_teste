import { NextRequest, NextResponse } from "next/server";
import { registarErroDaApp } from "@/lib/db";
import { lerErroDaApp } from "@/lib/erros-da-app";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/** Um erro é uma linha: mais do que isto não é um erro, é outra coisa. */
const MAXIMO_DO_CORPO = 4096;

/**
 * A APP CLYON PRO DIZ QUE UM ECRÃ REBENTOU — 25-10-2026.
 *
 * Corpo: `{ "versao": "1.0.11", "ecra": "trabalhos/[id]", "mensagem": "…",
 * "quando": "<ISO>" }`. Responde `{ ok: true }` e grava na tabela
 * `errosDaApp`, que o backoffice conta na secção Profissionais.
 *
 * SEM SESSÃO, de propósito: a app também rebenta antes de ele entrar (no
 * ecrã de entrada, a definir a palavra-passe), e esses são dos erros que mais
 * importa ver. Por isso não se guarda nada de quem mandou — nem a conta, nem o
 * endereço — e há um limite de pedidos por endereço. A mensagem é limpa de
 * emails, telefones e tokens antes de gravar (`erros-da-app.ts`).
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "app-pro-erro", 20, 600);
  if (limite.erro) return limite.erro;

  let texto = "";
  try {
    texto = await req.text();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (texto.length > MAXIMO_DO_CORPO) {
    return NextResponse.json({ error: "Erro demasiado comprido." }, { status: 413 });
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const erro = lerErroDaApp(corpo);
  if (!erro) return NextResponse.json({ error: "Falta a mensagem do erro." }, { status: 400 });

  try {
    await registarErroDaApp({ ...erro, app: "pro" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[profissionais/erro-da-app]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui guardar o erro." }, { status: 500 });
  }
}
