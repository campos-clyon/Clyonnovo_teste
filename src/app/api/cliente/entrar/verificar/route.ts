import { NextRequest, NextResponse } from "next/server";
import { contarVerificacaoDaLigacao } from "@/lib/db";
import { MENSAGEM, pareceUmToken } from "@/lib/entrada-por-link";
import { hashDaLigacao } from "@/lib/entrada-por-link-segredo";
import { MAXIMO_DE_VERIFICACOES, pareceUmCodigoDoAparelho, verificarLinkDaApp } from "@/lib/entrada-na-app";
import { mascararEmail } from "@/lib/mascarar-email";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * R1a — DE QUEM É ESTE LINK, SEM O GASTAR (d8 fase 2, S1, 28-10-2026).
 *
 * O ecrã E1a da app de cliente abre pelo link do email e, antes de entrar,
 * mostra a conta («Vai entrar como j•••@gmail.com») e espera pelo toque em
 * «Entrar». Para isso pergunta aqui de quem é o link, com o código do aparelho.
 *
 * As mesmas verificações da R1 (\`verificarLinkDaApp\`) e as mesmas recusas,
 * com \`motivo\`. O email inteiro só sai com o código certo — isto é, só para o
 * telemóvel que o escreveu ao pedir o link (a app compara-o com o da sessão
 * aberta).
 *
 * NÃO LÊ SESSÃO, NÃO GASTA O LINK, NÃO CRIA CONTA. Travão por endereço próprio
 * e no máximo 10 verificações por link.
 */

const MUITAS_TENTATIVAS = "Muitas tentativas seguidas. Espere um minuto e tente outra vez.";
const PEDIDO_INVALIDO = "Pedido inválido.";

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-entrar-verificar-ip", 20, 900);
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
  if (!corpo || typeof corpo !== "object" || !pareceUmCodigoDoAparelho(corpo.codigoDoAparelho)) {
    return NextResponse.json({ ok: false, error: PEDIDO_INVALIDO }, { status: 400 });
  }

  const t = corpo.linkToken;
  if (!pareceUmToken(t)) {
    return NextResponse.json(
      { ok: false, error: MENSAGEM.malformado, motivo: "malformado" },
      { status: 401 },
    );
  }

  try {
    // No máximo 10 perguntas por link — e um link que não existe não conta nada.
    const contou = await contarVerificacaoDaLigacao(hashDaLigacao(t), MAXIMO_DE_VERIFICACOES);
    const v = await verificarLinkDaApp(t, corpo.codigoDoAparelho);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: MENSAGEM[v.motivo], motivo: v.motivo }, { status: 401 });
    }
    if (!contou) {
      return NextResponse.json(
        { ok: false, error: MUITAS_TENTATIVAS },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    return NextResponse.json({ ok: true, email: v.email, emailMascarado: mascararEmail(v.email) });
  } catch (err) {
    console.error("[cliente/entrar/verificar] falhou:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível verificar o link agora. Tente outra vez." },
      { status: 500 },
    );
  }
}
