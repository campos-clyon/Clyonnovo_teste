import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  listarConvites,
  criarConvite,
  convitePorEmail,
  revogarConvite,
  renovarConvite,
  marcarConviteEnviado,
  profissionalPorEmail,
} from "@/lib/db";
import { validarConvite, DIAS_DE_VALIDADE_DO_CONVITE } from "@/lib/convite-profissional";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { enviarConviteAoProfissional } from "@/lib/email-convite-profissional";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { comChave } from "@/lib/acesso-mvp";

export const runtime = "nodejs";

/**
 * Os convites a profissionais.
 *
 * A inscrição deixou de ser aberta: o profissional fala connosco, alguém toma
 * nota do nome e do email, e o sistema envia-lhe o link. Isto é esse "alguém
 * toma nota".
 *
 * Quando o email não sai — chave em falta, endereço recusado — o token em claro
 * volta na resposta. É a única forma de lá chegar: na base só existe o hash, e
 * sem isto o convite ficava criado e inalcançável.
 */
function validade(): Date {
  return new Date(Date.now() + DIAS_DE_VALIDADE_DO_CONVITE * 24 * 3600_000);
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const linhas = await listarConvites();
    const agora = Date.now();
    return NextResponse.json({
      // O endereço por onde um profissional entra na conta dele. Vai com a
      // chave lá dentro porque, enquanto o MVP estiver fechado, sem ela dá 404
      // — e quem o partilha não tem de se lembrar de a colar à mão.
      linkDeEntrada: comChave(`${urlDeAccaoDoPedido(req.headers)}/profissionais/entrar`),
      convites: linhas.map((c) => ({
        id: c.id,
        nome: c.nome,
        email: c.email,
        telefone: c.telefone,
        tipoVeiculo: c.tipoVeiculo,
        nota: c.nota,
        // O estado é derivado das datas, e não de uma coluna que pode discordar
        // delas — a mesma regra que usamos na fase do trabalho.
        estado: c.usadoEm
          ? "usado"
          : c.revogadoEm
            ? "revogado"
            : new Date(c.expiraEm).getTime() < agora
              ? "expirado"
              : "por usar",
        emailEnviado: Number(c.emailEnviado) === 1,
        expiraEm: c.expiraEm,
        usadoEm: c.usadoEm,
        providerId: c.providerId,
        criadoPor: c.criadoPor,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("[admin/convites GET]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const quem = String(colab?.nome ?? "admin");
  const base = urlDeAccaoDoPedido(req.headers);

  // ── Revogar ──────────────────────────────────────────────────────────────
  if (corpo.accao === "revogar") {
    const id = Number(corpo.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Convite inválido." }, { status: 400 });
    }
    await revogarConvite(id);
    return NextResponse.json({ ok: true, feito: "revogado" });
  }

  // ── Reenviar: token novo, o anterior deixa de servir ─────────────────────
  if (corpo.accao === "reenviar") {
    const id = Number(corpo.id);
    const linhas = await listarConvites();
    const convite = linhas.find((c) => c.id === id);
    if (!convite || convite.usadoEm) {
      return NextResponse.json(
        { error: "Convite não encontrado ou já usado." },
        { status: 404 },
      );
    }

    const acesso = gerarTokenDeAcesso();
    await renovarConvite(id, acesso.hash, validade());
    const enviado = await enviarConviteAoProfissional({
      para: convite.email,
      nome: convite.nome,
      token: acesso.token,
      diasDeValidade: DIAS_DE_VALIDADE_DO_CONVITE,
      deQuem: quem,
      baseUrl: base,
    });
    await marcarConviteEnviado(id, enviado);

    return NextResponse.json({
      ok: true,
      feito: enviado ? "reenviado" : "token renovado, email NÃO saiu",
      enviado,
      link: enviado ? null : comChave(`${base}/profissionais/inscricao/${acesso.token}`),
    });
  }

  // ── Criar ────────────────────────────────────────────────────────────────
  const validacao = validarConvite(corpo);
  if (!validacao.ok) {
    return NextResponse.json(
      { error: validacao.erros[0].mensagem, erros: validacao.erros },
      { status: 400 },
    );
  }
  const d = validacao.dados;

  try {
    // Convidar quem já está inscrito não faz nada de mal, mas confunde: ele
    // recebe um link que lhe vai dizer "já existe uma inscrição com este email".
    if (await profissionalPorEmail(d.email)) {
      return NextResponse.json(
        { error: "Já existe um profissional inscrito com este email." },
        { status: 409 },
      );
    }
    if (await convitePorEmail(d.email)) {
      return NextResponse.json(
        { error: "Já há um convite por usar para este email. Reenvie esse." },
        { status: 409 },
      );
    }

    const acesso = gerarTokenDeAcesso();
    const id = await criarConvite({
      nome: d.nome,
      email: d.email,
      telefone: d.telefone,
      tipoVeiculo: d.tipoVeiculo,
      nota: d.nota,
      tokenHash: acesso.hash,
      expiraEm: validade(),
      criadoPor: quem,
    });

    const enviado = await enviarConviteAoProfissional({
      para: d.email,
      nome: d.nome,
      token: acesso.token,
      diasDeValidade: DIAS_DE_VALIDADE_DO_CONVITE,
      deQuem: quem,
      baseUrl: base,
    });
    await marcarConviteEnviado(id, enviado);

    return NextResponse.json({
      ok: true,
      id,
      enviado,
      feito: enviado ? "convite enviado" : "convite criado, email NÃO saiu",
      link: enviado ? null : comChave(`${base}/profissionais/inscricao/${acesso.token}`),
    });
  } catch (error) {
    console.error("[admin/convites POST]", error);
    return NextResponse.json({ error: "Não foi possível convidar" }, { status: 500 });
  }
}
