import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { fichaDoGoogleDoProfissional, proporFichaDoGoogle } from "@/lib/db";
import { fichaNoGoogle, lerPlaceId } from "@/lib/ficha-no-google";
import { estadoDaFicha, TEXTOS_DA_FICHA_NO_GOOGLE } from "@/lib/estado-da-ficha-no-google";
import { limitarPorConta } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A FICHA DO PROFISSIONAL NO GOOGLE — 11-11-2026.
 *
 * GET: o estado (sem ficha / à espera / confirmada) e as fichas (nome, morada,
 * link do Maps), pedidas ao Google no momento — na base só há o place_id.
 * PUT `{ placeId }`: propõe uma ficha; fica à espera da confirmação de um
 * administrador no backoffice. A confirmada, se houver, continua a contar.
 *
 * O `providerId` sai SEMPRE da sessão: nunca do corpo.
 */

async function resposta(providerId: number) {
  const f = await fichaDoGoogleDoProfissional(providerId);
  const [confirmada, proposta] = await Promise.all([
    f?.placeId ? fichaNoGoogle(f.placeId) : Promise.resolve(null),
    f?.proposto ? fichaNoGoogle(f.proposto) : Promise.resolve(null),
  ]);
  const estado = estadoDaFicha(f);
  return {
    estado,
    texto: TEXTOS_DA_FICHA_NO_GOOGLE.estados[estado],
    confirmada: f?.placeId
      ? {
          nome: confirmada?.nome ?? null,
          morada: confirmada?.morada ?? null,
          mapsUri: confirmada?.mapsUri ?? null,
          em: f.confirmadoEm ? new Date(f.confirmadoEm).toISOString() : null,
        }
      : null,
    proposta: f?.proposto
      ? { nome: proposta?.nome ?? null, morada: proposta?.morada ?? null, mapsUri: proposta?.mapsUri ?? null }
      : null,
    textos: TEXTOS_DA_FICHA_NO_GOOGLE,
  };
}

export async function GET(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    return NextResponse.json(await resposta(sessao.providerId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[ficha-google] GET", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler a sua ficha no Google." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const limite = await limitarPorConta("ficha-google-propor", `pro:${sessao.providerId}`, 10, 3600);
  if (limite.erro) return limite.erro;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const placeId = lerPlaceId((corpo as { placeId?: unknown } | null)?.placeId);
  if (!placeId) return NextResponse.json({ error: "Escolha uma ficha da lista." }, { status: 400 });

  try {
    // A ficha tem de existir no Google (e é a que o administrador vai ver).
    const ficha = await fichaNoGoogle(placeId);
    if (!ficha) {
      return NextResponse.json(
        { error: "O Google não confirmou esta ficha agora. Tente outra vez daqui a pouco." },
        { status: 502 },
      );
    }
    await proporFichaDoGoogle(sessao.providerId, placeId);
    return NextResponse.json({ ok: true, ...(await resposta(sessao.providerId)) });
  } catch (e) {
    console.error("[ficha-google] PUT", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível guardar a ficha." }, { status: 500 });
  }
}
