import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  listarCandidaturas,
  candidaturaPorId,
  marcarCandidatura,
} from "@/lib/candidaturas";
import {
  criarProfissional,
  profissionalPorEmail,
  slugLivreParaProfissional,
  guardarTokenDePalavraPasse,
  consumirConvitesDoEmail,
} from "@/lib/db";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { enviarEmailDeAprovacao } from "@/lib/email-aprovacao-profissional";
import { DIAS_DO_LINK_DE_SENHA } from "@/lib/convite-profissional";
import { geocodificarLocalidade } from "@/lib/geocodificar";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { comChave } from "@/lib/acesso-mvp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * As candidaturas que chegam pelo site, e o que se faz com elas.
 *
 * APROVAR CRIA A CONTA. Não manda um segundo formulário.
 *
 * Até 11-09-2026 esta rota criava um CONVITE: o candidato — que já tinha
 * escrito o nome, o email, o telemóvel, a cidade, a viatura e os serviços —
 * recebia um link para preencher um formulário de dez campos onde metade era
 * a repetição do que acabara de escrever. O dono viu o painel e perguntou o
 * óbvio: «porque é que pede para enviar convite, se ele já preencheu tudo?
 * Esses pedidos deviam ir direto para a aprovação, onde após o admin verificar
 * os dados envia o link para definir palavra-passe».
 *
 * Tinha razão sobre a repetição. O que a candidatura não traz — NIF, morada
 * fiscal, IBAN, raio, regime de IVA — deixou de ser pedido à porta e passou a
 * ser pedido lá dentro, pelo cartão do perfil por completar, com o triângulo
 * em cada campo que falta. É a mesma informação, recolhida a quem já disse que
 * sim em vez de a quem ainda está a decidir.
 *
 * O QUE APROVAR FAZ, E O QUE NÃO FAZ. Cria o profissional em `pendente` e
 * manda-lhe o link para definir a palavra-passe. `pendente` abre o painel e
 * não abre a fila: quem decide que ele começa a receber pedidos continua a ser
 * uma pessoa, no ecrã dos profissionais, com a ficha dele à frente. São duas
 * decisões diferentes e é de propósito que estão separadas — a primeira é
 * «este existe e é quem diz ser», a segunda é «este pode ir a casa de um
 * cliente».
 *
 * O convite antigo não desapareceu: continua a servir quem a CLYON convida sem
 * candidatura, no formulário logo abaixo no mesmo ecrã.
 */

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

  // "convidar" continua a ser aceite: é o nome que o painel usava antes desta
  // mudança, e um ecrã por recarregar não deve dar erro.
  if (accao !== "aprovar" && accao !== "convidar") {
    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  }

  // Já cá dentro: não se cria uma segunda conta com o mesmo email.
  const jaExiste = await profissionalPorEmail(candidatura.email);
  if (jaExiste) {
    // E o convite dele, se ficou algum aberto, fecha-se com a candidatura.
    // Um convite "à espera de resposta" de quem já é profissional é uma linha
    // que só serve para alguém lhe mandar um convite a mais.
    await consumirConvitesDoEmail(candidatura.email, jaExiste.id).catch(() => 0);
    await marcarCandidatura(id, "aprovada", quem, null, "Já era profissional.");
    return NextResponse.json({ ok: true, feito: "já é profissional — candidatura arrumada" });
  }

  try {
    const base = urlDeAccaoDoPedido(req.headers);

    /*
     * As coordenadas da base, para o raio dele poder ser medido.
     *
     * Falhar aqui não impede nada: sem coordenadas a elegibilidade cai nas
     * zonas, que continuam a funcionar. É degradação, não avaria — a mesma
     * decisão que a inscrição por convite já tomava.
     */
    const geo = candidatura.cidade ? await geocodificarLocalidade(candidatura.cidade) : null;
    if (candidatura.cidade && !geo) {
      console.warn("[admin/candidaturas] sem coordenadas para", candidatura.cidade);
    }

    const providerId = await criarProfissional({
      name: candidatura.nome,
      slug: await slugLivreParaProfissional(candidatura.nome),
      email: candidatura.email,
      phone: candidatura.telefone,
      city: candidatura.cidade,
      tipoVeiculo: candidatura.tipoVeiculo,
      categorias: candidatura.servicos,
      // O que a candidatura não pergunta fica por preencher, e é o cartão do
      // perfil por completar que lho vai pedir — com o triângulo ao lado de
      // cada campo e a razão por baixo. Ver `perfil-por-completar.ts`.
      nif: null,
      moradaFiscal: null,
      codigoPostalFiscal: null,
      localidadeFiscal: null,
      zonas: [],
      raioKm: null,
      emiteFatura: false,
      regimeIva: "",
      emiteGuiaTransporte: false,
      numeroTransportador: null,
      baseLat: geo?.lat ?? null,
      baseLng: geo?.lng ?? null,
    });

    /*
     * O CONVITE FECHA-SE COM A CONTA.
     *
     * Esta é a segunda porta para alguém se tornar profissional, e durante
     * meses não fechava a porta atrás de si: o convite que tinha sido enviado
     * a partir desta mesma candidatura ficava "por usar" para sempre. O ecrã
     * dizia "4 convites à espera de resposta" sobre gente que estava inscrita e
     * aprovada na lista logo abaixo, com um botão de "Reenviar" ao lado.
     *
     * Não impede nada se falhar: a conta já está criada, e um convite por
     * fechar é um ecrã confuso, não uma avaria.
     */
    const convitesFechados = await consumirConvitesDoEmail(candidatura.email, providerId).catch(
      () => 0,
    );

    const acesso = gerarTokenDeAcesso();
    await guardarTokenDePalavraPasse(
      providerId,
      acesso.hash,
      new Date(Date.now() + DIAS_DO_LINK_DE_SENHA * 24 * 3600_000),
    );

    const enviado = await enviarEmailDeAprovacao({
      para: candidatura.email,
      nome: candidatura.nome,
      token: acesso.token,
      baseUrl: base,
      diasDeValidade: DIAS_DO_LINK_DE_SENHA,
    });

    await marcarCandidatura(id, "aprovada", quem, providerId, nota);

    return NextResponse.json({
      ok: true,
      enviado,
      providerId,
      convitesFechados,
      feito:
        (enviado ? "conta criada e link da palavra-passe enviado" : "conta criada, email NÃO saiu") +
        (convitesFechados > 0 ? ` — ${convitesFechados} convite(s) por usar arrumado(s)` : ""),
      // Sem email, o link vai para a mão de quem está no painel — é o que
      // permite mandá-lo por WhatsApp em vez de perder a candidatura.
      link: enviado
        ? null
        : comChave(`${base}/profissionais/definir-senha/${acesso.token}`),
    });
  } catch (e) {
    console.error("[admin/candidaturas POST]", e);
    return NextResponse.json({ error: "Não foi possível criar a conta." }, { status: 500 });
  }
}
