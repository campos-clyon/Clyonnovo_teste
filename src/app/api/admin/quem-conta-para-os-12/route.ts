import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { eAppDoTeste, montarQuadro } from "@/lib/quem-conta-para-os-12";
import {
  guardarListaDaPlay,
  listaDaPlayGuardada,
  pessoasDaAppDeCliente,
  pessoasDaAppPro,
} from "@/lib/quem-conta-para-os-12-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * «QUEM CONTA PARA OS 12» — 17-11-2026 (d60). Só o administrador
 * (`requireAdminGeral`): nomes, emails e telefones de quem está no teste.
 *
 * GET  ?app=pro|cliente            → o quadro (cada pessoa e o estado) e a última lista colada
 * POST { app, lista }              → guarda a lista da Play colada (vazia = apaga) e devolve o quadro
 */

const MAXIMO_DO_TEXTO = 200_000;

async function quadro(app: "pro" | "cliente") {
  const [pessoas, lista] = await Promise.all([
    app === "pro" ? pessoasDaAppPro() : pessoasDaAppDeCliente(),
    listaDaPlayGuardada(app),
  ]);
  return {
    ok: true,
    app,
    ...montarQuadro(pessoas, lista.emails.length ? lista.emails : null, new Date()),
    lista: { emails: lista.emails, coladaEm: lista.coladaEm, porQuem: lista.porQuem },
  };
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  const app = req.nextUrl.searchParams.get("app");
  if (!eAppDoTeste(app)) return NextResponse.json({ error: "App inválida." }, { status: 400 });
  try {
    return NextResponse.json(await quadro(app), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/quem-conta-para-os-12 GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui ler o quadro." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { app?: unknown; lista?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!eAppDoTeste(corpo?.app)) return NextResponse.json({ error: "App inválida." }, { status: 400 });
  const lista = typeof corpo.lista === "string" ? corpo.lista : "";
  if (lista.length > MAXIMO_DO_TEXTO) {
    return NextResponse.json({ error: "A lista é demasiado grande." }, { status: 400 });
  }
  try {
    await guardarListaDaPlay(corpo.app, lista, String(colab?.nome ?? "admin"));
    return NextResponse.json(await quadro(corpo.app));
  } catch (e) {
    console.error("[admin/quem-conta-para-os-12 POST]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui guardar a lista." }, { status: 500 });
  }
}
