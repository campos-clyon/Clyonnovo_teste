import { NextRequest, NextResponse } from "next/server";
import { clienteDaSessao } from "@/lib/cliente-auth";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { validarInscricao } from "@/lib/programa-da-app";
import {
  idDaContaDoCliente,
  inscreverNoPrograma,
  inscricaoDaConta,
  sairDoPrograma,
} from "@/lib/programa-da-app-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O PROGRAMA DE ACESSO ANTECIPADO DA APP, PELA CONTA DO CLIENTE — 11-11-2026.
 *
 *   · GET    → `{ estado, email, emailDaConta }` (estado `null` = nunca respondeu);
 *   · POST   `{ email, consentimento: true, origem }` → inscreve (idempotente);
 *   · DELETE → sai do programa.
 *
 * Só com sessão de cliente (o cookie do site ou o Bearer da app), e com uma
 * conta que existe: o email do convite vai para a Play, e só o dono da conta
 * o pode lá pôr.
 */
export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "conta-programa-da-app", 60, 300);
  if (limite.erro) return limite.erro;
  const s = await clienteDaSessao(req);
  if (!s) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  try {
    const userId = await idDaContaDoCliente(s.email);
    const i = await inscricaoDaConta(userId, s.email);
    return NextResponse.json(
      { ok: true, estado: i?.estado ?? null, email: i?.email ?? null, emailDaConta: s.email },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[conta/programa-da-app] GET:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível ler agora." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "conta-programa-da-app", 60, 300);
  if (limite.erro) return limite.erro;
  const s = await clienteDaSessao(req);
  if (!s) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  const porConta = await limitarPorConta("conta-programa-da-app-gravar", s.email, 10, 900);
  if (porConta.erro) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas seguidas. Espere alguns minutos e tente outra vez." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  let corpo: { email?: unknown; consentimento?: unknown; origem?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const v = validarInscricao({ email: corpo?.email, consentimento: corpo?.consentimento, origem: corpo?.origem });
  if (!v.ok) return NextResponse.json({ ok: false, error: v.erro }, { status: 400 });

  try {
    const userId = await idDaContaDoCliente(s.email);
    if (userId == null) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    const r = await inscreverNoPrograma({ email: v.email, userId, origem: v.origem });
    return NextResponse.json({ ok: true, estado: r.estado, email: v.email });
  } catch (err) {
    console.error("[conta/programa-da-app] POST:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível gravar agora. Tente outra vez." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "conta-programa-da-app", 60, 300);
  if (limite.erro) return limite.erro;
  const s = await clienteDaSessao(req);
  if (!s) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  try {
    const userId = await idDaContaDoCliente(s.email);
    await sairDoPrograma(userId, s.email);
    return NextResponse.json({ ok: true, estado: "saiu" });
  } catch (err) {
    console.error("[conta/programa-da-app] DELETE:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível gravar agora. Tente outra vez." }, { status: 500 });
  }
}
