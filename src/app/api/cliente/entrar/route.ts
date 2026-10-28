import { NextRequest, NextResponse } from "next/server";
import { consumirLigacaoDeEntradaDaApp } from "@/lib/db";
import { MENSAGEM, type MotivoDeRecusa } from "@/lib/entrada-por-link";
import { pareceUmCodigoDoAparelho, verificarLinkDaApp } from "@/lib/entrada-na-app";
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
      /*
       * R1 v2 — 28-10-2026 (S1). O link da app está preso ao telemóvel que o
       * pediu: vem com o código do aparelho, e só se gasta se o SHA-256 dele
       * for a prova guardada com o link. Um link do site (`doSite`) ou de
       * outro telemóvel (`outroAparelho`) NÃO se gasta. Ver `entrada-na-app.ts`.
       */
      const codigo = corpo.codigoDoAparelho;
      if (!pareceUmCodigoDoAparelho(codigo)) {
        return NextResponse.json({ ok: false, error: PEDIDO_INVALIDO }, { status: 400 });
      }
      const recusa = (motivo: MotivoDeRecusa) =>
        NextResponse.json({ ok: false, error: MENSAGEM[motivo], motivo }, { status: 401 });
      const v = await verificarLinkDaApp(corpo.linkToken, codigo);
      if (!v.ok) return recusa(v.motivo);
      // Uma só escrita, com a condição da prova: dois toques não o gastam duas vezes.
      if (!(await consumirLigacaoDeEntradaDaApp(v.hash, v.prova))) {
        const deNovo = await verificarLinkDaApp(corpo.linkToken, codigo);
        return recusa(deNovo.ok ? "usado" : deNovo.motivo);
      }
      email = v.email;
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
