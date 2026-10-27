import { NextRequest, NextResponse } from "next/server";
import { consumirLigacaoDeEntrada } from "@/lib/db";
import { MENSAGEM, pareceUmToken } from "@/lib/entrada-por-link";
import { hashDaLigacao } from "@/lib/entrada-por-link-segredo";
import { registarCliente } from "@/lib/conta-server";
import { assinarSessaoDoCliente, type EntradaDoCliente } from "@/lib/cliente-auth";
import { googleNaAppLigado, verificarIdTokenDoGoogle } from "@/lib/google-id-token";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * A APP DE CLIENTE ENTRA — 27-10-2026 (decisão d8, R1).
 *
 * Troca uma prova de identidade por uma sessão da app (30 dias, Bearer). As
 * provas são as duas do site:
 *   · `{ linkToken }` — o `t` do link de entrada por email (15 minutos, uso
 *     único), consumido pela MESMA função do provedor `link-de-entrada` do
 *     NextAuth: o link serve uma vez, venha a vez do site ou da app;
 *   · `{ google }` — o idToken do Google do telemóvel, verificado aqui junto
 *     do Google (`google-id-token.ts`).
 *
 * A ROTA NÃO LÊ SESSÃO NENHUMA — nem cookie, nem Bearer. Só a prova do corpo.
 * Um profissional ou alguém da equipa com o mesmo email recebe uma sessão de
 * CLIENTE, que só abre o lado do cliente.
 *
 * Entrar cria a conta se não existir (`registarCliente`), como no site.
 */

const MUITAS_TENTATIVAS = "Muitas tentativas seguidas. Espere um minuto e tente outra vez.";
const PEDIDO_INVALIDO = "Pedido inválido.";
const GOOGLE_RECUSADO = "Não foi possível entrar com o Google.";
const GOOGLE_AINDA_NAO =
  "A entrada com o Google na app ainda não está disponível. Entre com o link por email.";

/** A app pergunta se mostra o botão do Google. */
export async function GET() {
  return NextResponse.json({ ok: true, google: googleNaAppLigado(), link: true });
}

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-entrar-ip", 8, 900);
  if (limite.erro) {
    return NextResponse.json(
      { ok: false, error: MUITAS_TENTATIVAS },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: PEDIDO_INVALIDO }, { status: 400 });
  }
  if (!corpo || typeof corpo !== "object") {
    return NextResponse.json({ ok: false, error: PEDIDO_INVALIDO }, { status: 400 });
  }

  const temLink = corpo.linkToken !== undefined;
  const temGoogle = corpo.google !== undefined;
  // Uma das duas, e só uma.
  if (temLink === temGoogle) {
    return NextResponse.json({ ok: false, error: PEDIDO_INVALIDO }, { status: 400 });
  }

  let email: string;
  let nome: string | null = null;
  let entrada: EntradaDoCliente;

  try {
    if (temLink) {
      const t = corpo.linkToken;
      // A forma verifica-se antes de ir à base, como no provedor do site.
      if (!pareceUmToken(t)) {
        return NextResponse.json({ ok: false, error: MENSAGEM.malformado }, { status: 401 });
      }
      const r = await consumirLigacaoDeEntrada(hashDaLigacao(t));
      if (!r.ok) {
        return NextResponse.json({ ok: false, error: MENSAGEM[r.motivo] }, { status: 401 });
      }
      email = r.email;
      entrada = "link";
    } else {
      if (!googleNaAppLigado()) {
        return NextResponse.json(
          { ok: false, error: GOOGLE_AINDA_NAO, google: false },
          { status: 503 },
        );
      }
      const quem = await verificarIdTokenDoGoogle(corpo.google);
      if (!quem) {
        return NextResponse.json({ ok: false, error: GOOGLE_RECUSADO }, { status: 401 });
      }
      email = quem.email;
      nome = quem.nome;
      entrada = "google";
    }

    email = email.trim().toLowerCase();
    await registarCliente(email, nome);
    const { token, expiraEm } = await assinarSessaoDoCliente(email, entrada);
    return NextResponse.json({ ok: true, token, expiraEm: expiraEm.toISOString(), email, entrada });
  } catch (err) {
    console.error("[cliente/entrar] falhou:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível entrar agora. Tente outra vez." },
      { status: 500 },
    );
  }
}
