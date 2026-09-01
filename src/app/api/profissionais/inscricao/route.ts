import { NextRequest, NextResponse } from "next/server";
import { validarInscricao } from "@/lib/inscricao-profissional";
import {
  criarProfissional,
  profissionalPorEmail,
  slugLivreParaProfissional,
  convitePorTokenHash,
  marcarConviteUsado,
  inscricoesPendentesNaUltimaHora,
} from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { geocodificarLocalidade } from "@/lib/geocodificar";
import { avisarCandidaturaNova } from "@/lib/email-candidatura";

export const runtime = "nodejs";

/**
 * Inscrição de um profissional — por duas portas, para a mesma fila.
 *
 * 1. COM CONVITE: o token que lhe enviámos por email. Preenche o nome e o
 *    email por ele, e gasta-se ao ser usado.
 * 2. SEM CONVITE: a candidatura espontânea, que vem do botão «Tornar-me
 *    parceiro» da homepage.
 *
 * Entre 19-08-2026 e hoje só existia a primeira, e o convite era a fronteira:
 * sem ele, 403. O que o substitui não é outro portão — é o ESTADO do que aqui
 * se escreve. Uma inscrição nasce `pendente`, e `pendente` não entra
 * (`../entrar/route.ts`, 401) nem define palavra-passe
 * (`../definir-senha/route.ts`, 403). Quem descobrir este endereço e o encher
 * de linhas falsas dá trabalho a quem analisa; não chega a ver um pedido de um
 * cliente, nem o nome de um.
 *
 * O convite passou a ser o ATALHO de quem já falou connosco — e continua a
 * valer, porque é o que diz a quem analisa que esta pessoa não apareceu do
 * nada.
 *
 * Ninguém entra aprovado, e a guia de transporte entra sempre por verificar,
 * mesmo declarada e com número. A verificação é de uma pessoa.
 */
/**
 * Uma só frase para o email repetido, dita nos DOIS sítios onde isso se
 * descobre — a verificação em JS e o índice UNIQUE da base. Duas explicações
 * diferentes para o mesmo facto, conforme quem chegou primeiro, é pior do que
 * qualquer uma delas.
 */
const MENSAGEM_EMAIL_REPETIDO =
  "Já recebemos uma candidatura com este email. Se ainda não teve resposta, não precisa de enviar outra — fale connosco se quiser alterar alguma coisa.";

/** Acima disto, alguma coisa está errada e alguém tem de ver. */
const TECTO_DE_CANDIDATURAS_POR_HORA = 20;

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "profissional-inscricao", 5, 600);
  if (limite.erro) return limite.erro;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  /*
   * ── O convite, quando existe ───────────────────────────────────────────
   *
   * Sem token não é erro: é a candidatura espontânea, e segue em frente. Com
   * token, ele tem de ser bom — um token inválido ou gasto NÃO cai em silêncio
   * para o caminho aberto. Quem clicou num link de convite tem de saber que o
   * link tem um problema, e não ficar a pensar que se inscreveu na mesma por
   * outra via qualquer.
   */
  const token = (corpo as Record<string, unknown>)?.convite;
  const temConvite = typeof token === "string" && token.length > 0;

  let convite: Awaited<ReturnType<typeof convitePorTokenHash>>;

  if (temConvite) {
    convite = await convitePorTokenHash(hashDeToken(token as string));
    const verificacao = verificarTokenDeAcesso(
      token as string,
      convite?.tokenHash ?? null,
      convite?.expiraEm ?? null,
    );

    if (!convite || !verificacao.valido) {
      return NextResponse.json(
        {
          ok: false,
          error:
            verificacao.valido === false && verificacao.motivo === "expirado"
              ? "Este convite expirou. Peça-nos outro, ou candidate-se em clyon.pt/profissionais/inscricao."
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
    /*
     * O QUE ESTA RESPOSTA REVELA, agora que a porta está aberta.
     *
     * O comentário anterior justificava-se assim: "quem se inscreve precisa de
     * saber que já o fez". Era verdade num mundo em que só chegava aqui quem
     * tinha sido convidado. Aberta a rota, isto passa a responder a QUALQUER
     * pessoa se um dado email tem candidatura na CLYON — email a email, é uma
     * lista de parceiros.
     *
     * Aceitou-se o custo, e a razão é que a alternativa é pior: gravar um
     * segundo registo em silêncio dá dois perfis para a mesma empresa, e hoje
     * duas carteiras. O que o desconhecido fica a saber é que este endereço já
     * se candidatou — não o nome, nem o telefone, nem se foi aprovado.
     *
     * A saída para quem for prejudicado por isto — alguém que use o email de
     * outro — é o admin poder apagar um candidato rejeitado, que passou a
     * existir.
     */
    const jaExiste = await profissionalPorEmail(d.email);
    if (jaExiste) {
      return NextResponse.json(
        {
          ok: false,
          error: MENSAGEM_EMAIL_REPETIDO,
        },
        { status: 409 },
      );
    }

    /*
     * O TECTO POR HORA, e o que ele é mesmo.
     *
     * O limite por IP acima conta num `Map` que morre com a instância
     * serverless — sem Redis configurado, não é a trava que parece. Este
     * conta na base, que está sempre lá.
     *
     * NÃO impede um registo em massa: reduz o estrago e dá sinal. E tem um
     * custo que é justo escrever — sendo global, quem inundar a rota atrasa
     * candidatos verdadeiros durante uma hora. É a troca certa (uma hora de
     * espera para um profissional real custa menos do que mil linhas falsas na
     * fila de quem analisa), mas é uma troca.
     */
    const recentes = await inscricoesPendentesNaUltimaHora();
    if (recentes > TECTO_DE_CANDIDATURAS_POR_HORA) {
      console.error(
        `[profissionais/inscricao] tecto atingido: ${recentes} candidaturas pendentes na última hora.`,
      );
      return NextResponse.json(
        { ok: false, error: "Estamos a receber muitas candidaturas neste momento. Tente daqui a pouco." },
        { status: 429 },
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

    // O convite gasta-se — quando houve convite. A condição está no UPDATE:
    // dois envios do formulário ao mesmo tempo, que é o duplo toque no botão,
    // só gravam o primeiro.
    if (convite) await marcarConviteUsado(convite.id, id);

    /*
     * O AVISO QUE SUBSTITUI O TOQUE DO WHATSAPP.
     *
     * Até aqui, o botão «Tornar-me parceiro» abria uma conversa e o telemóvel
     * de quem atende tocava. Agora uma candidatura é uma linha em `providers` e
     * mais nada: sem isto, quem se candidata fica à espera de uma resposta que
     * só acontece se alguém, por iniciativa própria, abrir o painel. Era tornar
     * o caminho novo pior do que o que ele substitui.
     *
     * Vai em `.catch` e sem `await`: o aviso é consequência da candidatura, não
     * condição dela. Um Resend em baixo não pode fazer o profissional perder o
     * que acabou de escrever.
     */
    avisarCandidaturaNova({
      nome: d.nome,
      cidade: d.cidade,
      email: d.email,
      telefone: d.telefone,
      categorias: d.categorias,
      declarouGuia: d.emiteGuiaTransporte,
      porConvite: Boolean(convite),
    }).catch((e) => console.error("[profissionais/inscricao] aviso:", e));

    return NextResponse.json({
      ok: true,
      id,
      // Dito aqui e não só na página, para o caso de alguém ligar esta rota a
      // outro ecrã: a expectativa certa é "ainda não recebes pedidos".
      estado: "pendente",
      precisaVerificacaoDeGuia: d.emiteGuiaTransporte,
    });
  } catch (err) {
    /*
     * O QUE O ÍNDICE UNIQUE APANHA, e a verificação em JS deixou passar.
     *
     * Entre o `profissionalPorEmail()` lá em cima e o `criarProfissional()`
     * corre uma chamada de rede ao geocodificador. Dois envios ao mesmo tempo
     * passam ambos pela verificação e só aqui é que o segundo bate no índice.
     *
     * A frase do email repetido é EXACTAMENTE a mesma da verificação em JS: ao
     * candidato, o facto é o mesmo, e dizer-lhe coisas diferentes conforme quem
     * chegou primeiro é confundi-lo por causa de um pormenor nosso.
     */
    const sql = String((err as { sqlMessage?: string })?.sqlMessage ?? "");

    if (sql.includes("providers_email_unique")) {
      return NextResponse.json({ ok: false, error: MENSAGEM_EMAIL_REPETIDO }, { status: 409 });
    }

    /*
     * O SLUG repetido é outra história, e não é culpa de quem se candidata:
     * dois «Transportes Silva» pedem o mesmo endereço de perfil.
     * `slugLivreParaProfissional` já devolve "transportes-silva-2" — só que foi
     * chamado antes da corrida. Repete-se UMA vez, com um slug pedido de novo.
     *
     * Sem isto, o candidato lia "Tente novamente", tentava, e à segunda levava
     * o 409 do email a dizer-lhe que já estava inscrito — ficando sem perceber
     * qual das duas coisas era verdade.
     */
    if (sql.includes("providers_slug_unique")) {
      try {
        const dados = validarInscricao(corpo);
        if (dados.ok) {
          const d2 = dados.dados;
          const id = await criarProfissional({
            name: d2.nome,
            slug: await slugLivreParaProfissional(d2.nome),
            email: d2.email,
            phone: d2.telefone,
            nif: d2.nif,
            city: d2.cidade,
            moradaFiscal: d2.moradaFiscal,
            codigoPostalFiscal: d2.codigoPostalFiscal,
            localidadeFiscal: d2.localidadeFiscal,
            tipoVeiculo: d2.tipoVeiculo,
            categorias: d2.categorias,
            zonas: d2.zonas,
            raioKm: d2.raioKm,
            emiteFatura: d2.emiteFatura,
            regimeIva: d2.regimeIva,
            emiteGuiaTransporte: d2.emiteGuiaTransporte,
            numeroTransportador: d2.numeroTransportador,
            baseLat: null,
            baseLng: null,
          });
          if (convite) await marcarConviteUsado(convite.id, id);
          avisarCandidaturaNova({
            nome: d2.nome,
            cidade: d2.cidade,
            email: d2.email,
            telefone: d2.telefone,
            categorias: d2.categorias,
            declarouGuia: d2.emiteGuiaTransporte,
            porConvite: Boolean(convite),
          }).catch((e) => console.error("[profissionais/inscricao] aviso:", e));
          return NextResponse.json({
            ok: true,
            id,
            estado: "pendente",
            precisaVerificacaoDeGuia: d2.emiteGuiaTransporte,
          });
        }
      } catch (e2) {
        console.error("[profissionais/inscricao] segunda tentativa falhou:", e2);
      }
    }

    // A mensagem crua do MySQL numa rota pública diz o nome da tabela, os
    // limites das colunas e, se a ligação falhar, o host da base. Fica no log.
    console.error("[profissionais/inscricao] erro ao gravar:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível registar a inscrição. Tente novamente." },
      { status: 500 },
    );
  }
}
