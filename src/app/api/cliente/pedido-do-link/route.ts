import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { appendOrderHistory, getSimulatorOrderByAcessoTokenHash, pedirJuncaoAConta } from "@/lib/db";
import { A_ESPERA_DA_MESA, avisarContactoDoPedido, avisoDeJuncao } from "@/lib/avisar-contacto-do-pedido";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { mascararEmail } from "@/lib/mascarar-email";
import { nomeDoServico } from "@/lib/service-categories";
import { diaCurtoEmLisboa } from "@/lib/pedido-para-a-app";

export const runtime = "nodejs";

/**
 * R10 — O LINK DE UM PEDIDO, NA APP DE CLIENTE (d8 fase 2, S6, 28-10-2026; P1
 * do dono: os pedidos do WhatsApp juntam-se à conta).
 *
 * `{ token, juntar?: true }`, com a sessão da app. O token do pedido serve SÓ
 * para saber que pedido é e, se for o caso, juntá-lo à conta: nunca abre o
 * pedido (isso é a R5, com sessão), nunca roda, nunca se guarda.
 *
 *   · do email da sessão → `seu` + id (a app abre o pedido);
 *   · sem email (feito pelo WhatsApp) → `semEmail` + um resumo de uma linha;
 *     com `juntar`, NÃO grava nada no email do pedido: fica à espera da Mesa
 *     (409 `aEsperaDaMesa`), a Mesa regista-o, e o contacto do pedido é
 *     avisado. Ver abaixo (Segurança, R13, 29-10-2026);
 *   · de outro email → `outroEmail`, sem dados do pedido;
 *   · desconhecido ou mal formado → 404; expirado → 410.
 *
 * Travão por endereço e por conta (regra 3 da Segurança).
 */

const NAO_ABRE = "Este link já não abre nenhum pedido.";
const EXPIROU = "Este link expirou. Os links de acesso duram 30 dias.";
const JA_LIGADO = "Este pedido já está ligado a uma conta.";
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-pedido-do-link", 30, 300);
  if (limite.erro) return limite.erro;

  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const porConta = await limitarPorConta("cliente-pedido-do-link-conta", email, 30, 300);
  if (porConta.erro) return porConta.erro;

  let corpo: { token?: unknown; juntar?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const token = typeof corpo?.token === "string" ? corpo.token : "";
  if (!token || token.length > 200 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return NextResponse.json({ ok: false, error: NAO_ABRE }, { status: 404 });
  }

  try {
    const pedido = await getSimulatorOrderByAcessoTokenHash(hashDeToken(token));
    const r = verificarTokenDeAcesso(token, pedido?.acessoTokenHash ?? null, pedido?.acessoTokenExpiraEm ?? null);
    if (!pedido || (!r.valido && r.motivo !== "expirado")) {
      return NextResponse.json({ ok: false, error: NAO_ABRE }, { status: 404 });
    }
    if (!r.valido) return NextResponse.json({ ok: false, error: EXPIROU }, { status: 410 });

    const doPedido = (pedido.contactEmail ?? "").trim().toLowerCase();
    if (doPedido === email) return NextResponse.json({ ok: true, estado: "seu", id: pedido.id });
    // De outra conta: nada do pedido sai daqui.
    if (doPedido) return NextResponse.json({ ok: true, estado: "outroEmail" });

    // Sem email — feito pelo WhatsApp. Ver o pedido pelo link é como no site.
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

    /*
     * JUNTAR SÓ COM A MESA — 29-10-2026 (achado alto da Segurança, R13).
     *
     * Juntar dava a quem tivesse o link a morada completa e o controlo do
     * pedido — e o link pode ter sido reencaminhado ou fotografado. Até haver
     * confirmação pelo telefone do pedido, a junção fica à espera da equipa:
     * só se grava o email que a pediu, numa coluna à parte, e o email do
     * pedido continua vazio. O contacto do pedido é avisado.
     */
    const jaPedidaPorEsta = String((pedido as { juntarAContaPedidoPor?: string | null }).juntarAContaPedidoPor ?? "")
      .trim()
      .toLowerCase() === email;
    if (!(await pedirJuncaoAConta(pedido.id, email))) {
      return NextResponse.json({ ok: false, error: JA_LIGADO }, { status: 409 });
    }
    if (!jaPedidaPorEsta) {
      await appendOrderHistory(pedido.id, {
        type: "created",
        by: null,
        message: `Pedido para juntar à conta ${mascararEmail(email)} pela app de cliente: confirme ou recuse na Mesa.`,
      });
      await avisarContactoDoPedido(pedido, avisoDeJuncao(pedido.id, mascararEmail(email)));
    }
    return NextResponse.json(
      { ok: false, estado: "aEsperaDaMesa", id: pedido.id, error: A_ESPERA_DA_MESA },
      { status: 409 },
    );
  } catch (err) {
    console.error("[cliente/pedido-do-link]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível abrir o link agora." }, { status: 500 });
  }
}
