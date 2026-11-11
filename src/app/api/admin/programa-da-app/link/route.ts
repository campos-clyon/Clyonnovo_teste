import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { linkDeAdesaoValido } from "@/lib/convite-app-cliente";
import { guardarLinkDeAdesao, linkDeAdesaoGuardado } from "@/lib/convite-app-cliente-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CONFIGS → «LINK DO PROGRAMA DA APP» — 11-11-2026.
 *
 * O link de adesão ao teste fechado da app de cliente na Google Play. É o
 * MESMO valor que o convite de 01-11 já guardava (`linkDeAdesaoDaAppDeCliente`
 * em `plataformaConfiguracoes`): um link, um sítio. Só o administrador o vê e
 * muda; sem ele, «Enviar convite» explica o que falta.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    return NextResponse.json({ link: await linkDeAdesaoGuardado() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin/programa-da-app/link GET]", error);
    return NextResponse.json({ error: "Não foi possível ler o link." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { link?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const link = linkDeAdesaoValido(corpo.link);
  if (!link) {
    return NextResponse.json({ error: "O link tem de ser da Google Play (https://play.google.com/…)." }, { status: 400 });
  }
  try {
    await guardarLinkDeAdesao(link, colab?.nome ?? "a CLYON");
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    console.error("[admin/programa-da-app/link PUT]", error);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
