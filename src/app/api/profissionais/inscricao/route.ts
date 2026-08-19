import { NextRequest, NextResponse } from "next/server";
import { validarInscricao } from "@/lib/inscricao-profissional";
import {
  criarProfissional,
  profissionalPorEmail,
  slugLivreParaProfissional,
} from "@/lib/db";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { geocodificarLocalidade } from "@/lib/geocodificar";

export const runtime = "nodejs";

/**
 * Inscrição de um profissional.
 *
 * Rota pública por necessidade — quem se inscreve ainda não tem conta. Cada
 * chamada escreve uma linha na base, e por isso leva travão: sem ele, uma
 * pessoa enche a tabela de profissionais falsos e passa a ser preciso limpá-la
 * à mão antes de aprovar seja quem for.
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
