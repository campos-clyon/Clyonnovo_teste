import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  confirmarFichaDoGoogle,
  fichaDoGoogleDoProfissional,
  recusarFichaDoGoogle,
  retirarFichaDoGoogle,
} from "@/lib/db";
import { fichaNoGoogle, lerPlaceId } from "@/lib/ficha-no-google";
import { estadoDaFicha } from "@/lib/estado-da-ficha-no-google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A FICHA DO GOOGLE DE UM PROFISSIONAL, NO BACKOFFICE — 11-11-2026.
 *
 * GET (quem vê a ficha do profissional): a confirmada e a proposta, com o
 * nome, a morada e o link do Maps pedidos ao Google agora (na base só há o
 * place_id).
 * POST `{ accao: "confirmar" | "recusar", placeId }` e `{ accao: "retirar" }`:
 * SÓ O ADMINISTRADOR. Confirmar regista quem e quando; vale só para a ficha
 * que ele viu (`placeId`): se o profissional entretanto propôs outra, nada muda.
 */

function lerId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function resposta(providerId: number) {
  const f = await fichaDoGoogleDoProfissional(providerId);
  if (!f) return null;
  const [confirmada, proposta] = await Promise.all([
    f.placeId ? fichaNoGoogle(f.placeId) : Promise.resolve(null),
    f.proposto ? fichaNoGoogle(f.proposto) : Promise.resolve(null),
  ]);
  return {
    estado: estadoDaFicha(f),
    confirmada: f.placeId
      ? {
          placeId: f.placeId,
          nome: confirmada?.nome ?? null,
          morada: confirmada?.morada ?? null,
          mapsUri: confirmada?.mapsUri ?? null,
          em: f.confirmadoEm ? new Date(f.confirmadoEm).toISOString() : null,
          por: f.confirmadoPor,
        }
      : null,
    proposta: f.proposto
      ? { placeId: f.proposto, nome: proposta?.nome ?? null, morada: proposta?.morada ?? null, mapsUri: proposta?.mapsUri ?? null }
      : null,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const providerId = lerId((await params).id);
  if (!providerId) return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  try {
    const r = await resposta(providerId);
    if (!r) return NextResponse.json({ error: `O profissional #${providerId} não foi encontrado.` }, { status: 404 });
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/ficha-google] GET", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler a ficha do Google." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  const providerId = lerId((await params).id);
  if (!providerId) return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const accao = corpo?.accao;
  const placeId = lerPlaceId(corpo?.placeId);

  try {
    let mudou = false;
    if (accao === "confirmar" || accao === "recusar") {
      if (!placeId) return NextResponse.json({ error: "Falta a ficha." }, { status: 400 });
      mudou =
        accao === "confirmar"
          ? await confirmarFichaDoGoogle(providerId, placeId, colab.nome)
          : await recusarFichaDoGoogle(providerId, placeId);
      if (!mudou) {
        return NextResponse.json(
          { error: "A ficha proposta mudou entretanto. Volte a abrir a ficha e veja a nova." },
          { status: 409 },
        );
      }
    } else if (accao === "retirar") {
      mudou = await retirarFichaDoGoogle(providerId);
    } else {
      return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
    }
    console.info(`[admin/ficha-google] #${providerId}: ${String(accao)} por ${colab.nome}`);
    return NextResponse.json({ ok: true, mudou, ...(await resposta(providerId)) });
  } catch (e) {
    console.error("[admin/ficha-google] POST", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}
