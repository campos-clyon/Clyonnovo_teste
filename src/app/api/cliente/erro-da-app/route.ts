import { NextRequest, NextResponse } from "next/server";
import { registarErroDaApp } from "@/lib/db";
import { lerErroDaApp } from "@/lib/erros-da-app";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/** Um erro é uma linha: mais do que isto não é um erro, é outra coisa. */
const MAXIMO_DO_CORPO = 4096;

/**
 * A APP DE CLIENTE DIZ QUE UM ECRÃ REBENTOU — 28-10-2026 (d8 fase 2, S3;
 * regra 7 da Segurança). Irmã de `/api/profissionais/erro-da-app`.
 *
 * Corpo: `{ "versao": "1.0.0", "idDoUpdate": "<id do EAS Update>", "ecra":
 * "pedidos/[id]", "mensagem": "…", "quando": "<ISO>" }` → `{ ok: true }`.
 *
 * SEM SESSÃO, de propósito: a app também rebenta antes de entrar. Não se
 * guarda nada de quem mandou — nem a conta, nem o endereço — e a mensagem
 * passa pela mesma limpeza da Pro (`erros-da-app.ts`: sem emails, telefones,
 * tokens). Travão por endereço. As linhas com mais de 30 dias saem na purga
 * da noite (`purgarErrosDaApp`), como as da Pro. Sem CORS.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "app-cliente-erro", 20, 600);
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
    await registarErroDaApp({ ...erro, app: "cliente" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[cliente/erro-da-app]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui guardar o erro." }, { status: 500 });
  }
}
