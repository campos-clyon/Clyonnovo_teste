import { NextRequest, NextResponse } from "next/server";
import { validarInscricao } from "@/lib/inscricao-profissional";
import {
  criarProfissional,
  profissionalPorEmail,
  slugLivreParaProfissional,
  convitePorTokenHash,
  marcarConviteUsado,
} from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { geocodificarLocalidade } from "@/lib/geocodificar";

export const runtime = "nodejs";

/**
 * Inscrição de um profissional — só por convite.
 *
 * Deixou de ser aberta em 19-08-2026. Quem se inscreve tem de trazer o token do
 * convite que lhe enviámos por email, e o convite gasta-se ao ser usado.
 *
 * O que isso muda: o email do convite passa a ser prova de que falámos com esta
 * pessoa. Sem ele, esta rota era o único sítio do sistema onde um desconhecido
 * escrevia uma linha na tabela de profissionais — e alguém tinha de a apagar à
 * mão antes de aprovar seja quem for.
 *
 * Ninguém entra aprovado, e a guia de transporte entra sempre por verificar,
 * mesmo declarada e com número. A verificação é de uma pessoa.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "profissional-inscricao", 5, 600);
  if (limite.erro) return limite.erro;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  // ── O convite ────────────────────────────────────────────────────────────
  const token = (corpo as Record<string, unknown>)?.convite;
  if (typeof token !== "string" || !token) {
    return NextResponse.json(
      { ok: false, error: "A inscrição é por convite. Fale connosco para receber o link." },
      { status: 403 },
    );
  }

  const convite = await convitePorTokenHash(hashDeToken(token));
  const verificacao = verificarTokenDeAcesso(
    token,
    convite?.tokenHash ?? null,
    convite?.expiraEm ?? null,
  );

  if (!convite || !verificacao.valido) {
    return NextResponse.json(
      {
        ok: false,
        error:
          verificacao.valido === false && verificacao.motivo === "expirado"
            ? "Este convite expirou. Peça-nos outro."
            : "Convite inválido.",
      },
      { status: 403 },
    );
  }
  if (convite.usadoEm || convite.revogadoEm) {
    return NextResponse.json(
      { ok: false, error: "Este convite já foi usado." },
      { status: 409 },
    );
  }

  const validacao = validarInscricao(corpo);
  if (!validacao.ok) {
    return NextResponse.json(
      { ok: false, error: validacao.erros[0].mensagem, erros: validacao.erros },
      { status: 400 },
    );
  }

  const d = validacao.dados;

  try {
    // Dizer "já está inscrito" é dizer a quem pergunta que este email existe na
    // nossa base. Aqui é aceitável: quem se inscreve precisa de saber que já o
    // fez, e a alternativa — criar um segundo registo em silêncio — dava dois
    // perfis para a mesma empresa e pedidos duplicados.
    const jaExiste = await profissionalPorEmail(d.email);
    if (jaExiste) {
      return NextResponse.json(
        {
          ok: false,
          error: "Já existe uma inscrição com este email. Fale connosco se precisar de a alterar.",
        },
        { status: 409 },
      );
    }

    // Onde fica a base dele, para o raio que indicou poder ser medido. Falhar
    // aqui não impede a inscrição: sem coordenadas a elegibilidade cai nas
    // zonas, que continuam a funcionar. É degradação, não avaria.
    const base = await geocodificarLocalidade(d.cidade);
    if (!base) {
      console.warn(
        "[profissionais/inscricao] sem coordenadas para",
        d.cidade,
        "— elegibilidade por zonas.",
      );
    }

    const id = await criarProfissional({
      name: d.nome,
      slug: await slugLivreParaProfissional(d.nome),
      email: d.email,
      phone: d.telefone,
      nif: d.nif,
      city: d.cidade,
      moradaFiscal: d.moradaFiscal,
      codigoPostalFiscal: d.codigoPostalFiscal,
      localidadeFiscal: d.localidadeFiscal,
      tipoVeiculo: d.tipoVeiculo,
      categorias: d.categorias,
      zonas: d.zonas,
      raioKm: d.raioKm,
      emiteFatura: d.emiteFatura,
      regimeIva: d.regimeIva,
      emiteGuiaTransporte: d.emiteGuiaTransporte,
      numeroTransportador: d.numeroTransportador,
      baseLat: base?.lat ?? null,
      baseLng: base?.lng ?? null,
    });

    // O convite gasta-se. A condição está no UPDATE — dois envios do formulário
    // ao mesmo tempo, que é o duplo toque no botão, só gravam o primeiro.
    await marcarConviteUsado(convite.id, id);

    return NextResponse.json({
      ok: true,
      id,
      // Dito aqui e não só na página, para o caso de alguém ligar esta rota a
      // outro ecrã: a expectativa certa é "ainda não recebes pedidos".
      estado: "pendente",
      precisaVerificacaoDeGuia: d.emiteGuiaTransporte,
    });
  } catch (err) {
    // A mensagem crua do MySQL numa rota pública diz o nome da tabela, os
    // limites das colunas e, se a ligação falhar, o host da base. Fica no log.
    console.error("[profissionais/inscricao] erro ao gravar:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível registar a inscrição. Tente novamente." },
      { status: 500 },
    );
  }
}
