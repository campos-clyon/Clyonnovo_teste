import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { abrirSessaoDeConvidado, getSimulatorOrderByAcessoTokenHash, getSimulatorOrderById } from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { mascararEmail } from "@/lib/mascarar-email";
import { nomeDoServico } from "@/lib/service-categories";
import { diaCurtoEmLisboa } from "@/lib/pedido-para-a-app";
import { pareceUmCodigoDoAparelho, provaDoCodigo } from "@/lib/entrada-na-app";
import { novaChaveDeConvidado, validarConvidado } from "@/lib/sessao-de-convidado";
import { juntarPedidoSemEmail } from "@/lib/juntar-a-conta";

export const runtime = "nodejs";

/**
 * R10 — O LINK DE UM PEDIDO, NA APP DE CLIENTE (d8 fase 2, S6, 28-10-2026;
 * v3 a 29-10-2026: S16 e a regra R13 da Segurança).
 *
 * SEM SESSÃO DE CLIENTE — `{ token, codigoDoAparelho }` (S16):
 *   · pedido de uma conta → `temConta` + o email mascarado;
 *   · pedido sem conta → `convidado` + a sessão de convidado (`sessaoDoPedido`,
 *     opaca, presa a este telemóvel; ver `sessao-de-convidado.ts`);
 *   · mais de 3 telemóveis → 409 `muitosAparelhos`, sem nenhum dado do pedido.
 *
 * COM SESSÃO DE CLIENTE — `{ token }` ou `{ convidado, codigoDoAparelho }`,
 * mais `juntar` e, se vier, `codigo`:
 *   · do email da sessão → `seu` + id;
 *   · sem email → `semEmail` + um resumo de uma linha; com `juntar`, a junção
 *     confirma-se pelo telefone do pedido ou pela Mesa (`juntar-a-conta.ts`);
 *   · de outro email → `outroEmail`, sem dados do pedido.
 *
 * O token do link nunca roda nem se guarda. Desconhecido → 404; expirado → 410.
 * Travões por endereço, por conta e por pedido (R20). Nada de tokens nos registos.
 */

const NAO_ABRE = "Este link já não abre nenhum pedido.";
const EXPIROU = "Este link expirou. Os links de acesso duram 30 dias.";
const JA_LIGADO = "Este pedido já está ligado a uma conta.";
const MUITOS_APARELHOS = "Este link já foi aberto noutros telemóveis. Para o abrir aqui, peça ajuda à CLYON pelo WhatsApp.";
const PEDIDO_INVALIDO = "Pedido inválido.";

type Pedido = NonNullable<Awaited<ReturnType<typeof getSimulatorOrderById>>>;

async function pedidoDoToken(token: unknown): Promise<{ pedido: Pedido; expiraEm: Date } | { erro: NextResponse }> {
  const t = typeof token === "string" ? token : "";
  if (!t || t.length > 200 || !/^[A-Za-z0-9_-]+$/.test(t)) {
    return { erro: NextResponse.json({ ok: false, error: NAO_ABRE }, { status: 404 }) };
  }
  const pedido = await getSimulatorOrderByAcessoTokenHash(hashDeToken(t));
  const r = verificarTokenDeAcesso(t, pedido?.acessoTokenHash ?? null, pedido?.acessoTokenExpiraEm ?? null);
  if (!pedido || (!r.valido && r.motivo !== "expirado")) {
    return { erro: NextResponse.json({ ok: false, error: NAO_ABRE }, { status: 404 }) };
  }
  if (!r.valido) return { erro: NextResponse.json({ ok: false, error: EXPIROU }, { status: 410 }) };
  return { pedido: pedido as Pedido, expiraEm: new Date(pedido.acessoTokenExpiraEm as Date | string) };
}

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-pedido-do-link", 30, 300);
  if (limite.erro) return limite.erro;

  let corpo: { token?: unknown; juntar?: unknown; codigoDoAparelho?: unknown; convidado?: unknown; codigo?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ ok: false, error: PEDIDO_INVALIDO }, { status: 400 });
  }
  if (!corpo || typeof corpo !== "object") return NextResponse.json({ ok: false, error: PEDIDO_INVALIDO }, { status: 400 });

  const email = await emailDoCliente(req);

  try {
    // ── Sem conta: trocar o link por uma sessão de convidado (S16) ─────────
    if (!email) {
      if (corpo.token === undefined || corpo.codigoDoAparelho === undefined) {
        return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
      }
      if (!pareceUmCodigoDoAparelho(corpo.codigoDoAparelho)) {
        return NextResponse.json({ ok: false, error: PEDIDO_INVALIDO }, { status: 400 });
      }
      const porEndereco = await limitarRotaPublica(req, "cliente-pedido-do-link-convidado", 10, 3600);
      if (porEndereco.erro) return porEndereco.erro;
      const p = await pedidoDoToken(corpo.token);
      if ("erro" in p) return p.erro;
      const porPedido = await limitarPorConta("cliente-pedido-do-link-pedido", `pedido:${p.pedido.id}`, 10, 3600);
      if (porPedido.erro) return porPedido.erro;

      const doPedido = (p.pedido.contactEmail ?? "").trim();
      if (doPedido) return NextResponse.json({ ok: true, estado: "temConta", emailMascarado: mascararEmail(doPedido) });

      const { chave, hash } = novaChaveDeConvidado();
      const r = await abrirSessaoDeConvidado({
        pedidoId: p.pedido.id,
        prova: provaDoCodigo(corpo.codigoDoAparelho),
        sessaoHash: hash,
        expiraEm: p.expiraEm,
      });
      if (r === "muitosAparelhos") {
        return NextResponse.json({ ok: false, estado: "muitosAparelhos", error: MUITOS_APARELHOS }, { status: 409 });
      }
      if (r === "temConta") {
        const atual = await getSimulatorOrderById(p.pedido.id);
        return NextResponse.json({ ok: true, estado: "temConta", emailMascarado: mascararEmail(atual?.contactEmail ?? "") });
      }
      if (r === "naoExiste") return NextResponse.json({ ok: false, error: NAO_ABRE }, { status: 404 });
      return NextResponse.json({
        ok: true,
        estado: "convidado",
        id: p.pedido.id,
        sessaoDoPedido: chave,
        expiraEm: p.expiraEm.toISOString(),
      });
    }

    // ── Com conta ──────────────────────────────────────────────────────────
    const porConta = await limitarPorConta("cliente-pedido-do-link-conta", email, 30, 300);
    if (porConta.erro) return porConta.erro;

    let pedido: Pedido | undefined;
    if (corpo.convidado !== undefined) {
      // Juntar com a sessão de convidado em vez do link (D5).
      const c = await validarConvidado(corpo.convidado, corpo.codigoDoAparelho);
      if (!c) return NextResponse.json({ ok: false, error: NAO_ABRE }, { status: 404 });
      pedido = (await getSimulatorOrderById(c.pedidoId)) as Pedido | undefined;
      if (!pedido) return NextResponse.json({ ok: false, error: NAO_ABRE }, { status: 404 });
    } else {
      const p = await pedidoDoToken(corpo.token);
      if ("erro" in p) return p.erro;
      pedido = p.pedido;
    }

    const doPedido = (pedido.contactEmail ?? "").trim().toLowerCase();
    if (doPedido === email) return NextResponse.json({ ok: true, estado: "seu", id: pedido.id });
    // De outra conta: nada do pedido sai daqui.
    if (doPedido) return NextResponse.json({ ok: true, estado: "outroEmail" });

    if (corpo.juntar !== true) {
      return NextResponse.json({
        ok: true,
        estado: "semEmail",
        id: pedido.id,
        servico: nomeDoServico(pedido.serviceType),
        cidade: pedido.city ?? null,
        criadoEmTexto: diaCurtoEmLisboa(pedido.createdAt),
      });
    }

    // Juntar: pelo telefone do pedido, ou pela Mesa (R13).
    const r = await juntarPedidoSemEmail({
      pedido: pedido as Pedido & { juntarAContaPedidoPor?: string | null },
      email,
      codigo: corpo.codigo,
      porOnde: req.headers.get("authorization") ? "app" : "site",
    });
    if (r.estado === "juntado") return NextResponse.json({ ok: true, estado: "seu", id: pedido.id, juntado: true });
    if (r.estado === "jaLigado") return NextResponse.json({ ok: false, error: JA_LIGADO }, { status: 409 });
    const status = r.estado === "errado" ? 422 : r.estado === "expirado" ? 410 : r.estado === "muitos" ? 429 : 409;
    return NextResponse.json({ ok: false, estado: r.estado, id: pedido.id, error: r.mensagem }, { status });
  } catch (err) {
    console.error("[cliente/pedido-do-link]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível abrir o link agora." }, { status: 500 });
  }
}
