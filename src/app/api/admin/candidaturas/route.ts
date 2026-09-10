import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  listarCandidaturas,
  candidaturaPorId,
  marcarCandidatura,
} from "@/lib/candidaturas";
import {
  criarConvite,
  convitePorEmail,
  marcarConviteEnviado,
  profissionalPorEmail,
} from "@/lib/db";
import { DIAS_DE_VALIDADE_DO_CONVITE } from "@/lib/convite-profissional";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { enviarConviteAoProfissional } from "@/lib/email-convite-profissional";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { comChave } from "@/lib/acesso-mvp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * As candidaturas que chegam pelo site, e o que se faz com elas.
 *
 * Aprovar não inscreve ninguém: cria o CONVITE de sempre, com o mesmo email e
 * o mesmo link de 14 dias. A porta continua a ser a mesma — o que mudou é que
 * quem bate a ela deixa de se perder numa caixa de WhatsApp.
 */

function validade(): Date {
  return new Date(Date.now() + DIAS_DE_VALIDADE_DO_CONVITE * 24 * 60 * 60 * 1000);
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json({ candidaturas: await listarCandidaturas() });
  } catch (e) {
    console.error("[admin/candidaturas GET]", e);
    return NextResponse.json({ candidaturas: [] });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { id?: unknown; accao?: unknown; nota?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const id = Number(corpo.id);
  const accao = typeof corpo.accao === "string" ? corpo.accao : "";
  const nota = typeof corpo.nota === "string" ? corpo.nota.slice(0, 500) : null;
  const quem = colab?.nome ?? "a equipa";

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Candidatura inválida." }, { status: 400 });
  }

  const candidatura = await candidaturaPorId(id);
  if (!candidatura) {
    return NextResponse.json({ error: "Essa candidatura já não existe." }, { status: 404 });
  }

  if (accao === "recusar") {
    await marcarCandidatura(id, "recusada", quem, null, nota);
    return NextResponse.json({ ok: true, feito: "candidatura arrumada" });
  }

  if (accao !== "convidar") {
    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  }

  // Já cá dentro, ou já convidado: não se cria um segundo convite.
  if (await profissionalPorEmail(candidatura.email)) {
    await marcarCandidatura(id, "convidada", quem, null, "Já era profissional.");
    return NextResponse.json({ ok: true, feito: "já é profissional — candidatura arrumada" });
  }
  if (await convitePorEmail(candidatura.email)) {
    await marcarCandidatura(id, "convidada", quem, null, "Já tinha convite por usar.");
    return NextResponse.json({
      ok: true,
      feito: "já havia convite por usar — candidatura arrumada",
    });
  }

  try {
    const base = urlDeAccaoDoPedido(req.headers);
    const acesso = gerarTokenDeAcesso();
    const conviteId = await criarConvite({
      nome: candidatura.nome,
      email: candidatura.email,
      telefone: candidatura.telefone,
      tipoVeiculo: candidatura.tipoVeiculo,
      // O que ele escreveu fica na nota do convite: quem o ler depois sabe de
      // onde veio sem ter de ir procurar a candidatura.
      nota: [
        `Candidatura pelo site (#${candidatura.id})`,
        candidatura.cidade ? `base em ${candidatura.cidade}` : null,
        candidatura.servicos.length ? candidatura.servicos.join(", ") : null,
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 500),
      tokenHash: acesso.hash,
      expiraEm: validade(),
      criadoPor: quem,
    });

    const enviado = await enviarConviteAoProfissional({
      para: candidatura.email,
      nome: candidatura.nome,
      token: acesso.token,
      diasDeValidade: DIAS_DE_VALIDADE_DO_CONVITE,
      deQuem: quem,
      baseUrl: base,
    });
    await marcarConviteEnviado(conviteId, enviado);
    await marcarCandidatura(id, "convidada", quem, conviteId, nota);

    return NextResponse.json({
      ok: true,
      enviado,
      feito: enviado ? "convite enviado" : "convite criado, email NÃO saiu",
      // Sem email, o link vai para a mão de quem está no painel — é o que
      // permite mandá-lo por WhatsApp em vez de perder a candidatura.
      link: enviado ? null : comChave(`${base}/profissionais/inscricao/${acesso.token}`),
    });
  } catch (e) {
    console.error("[admin/candidaturas POST]", e);
    return NextResponse.json({ error: "Não foi possível criar o convite." }, { status: 500 });
  }
}
