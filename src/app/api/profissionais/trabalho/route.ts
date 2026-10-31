import { NextRequest, NextResponse } from "next/server";
import { podeMostrarConcluir } from "@/lib/viagem-ate-ao-cliente";
import {
  registarExecucao,
  negociacoesDoProfissional,
  appendOrderHistory,
  getSimulatorOrderById,
  substituirTokenDoPedido,
} from "@/lib/db";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { podeEnviarProva, DIAS_ATE_LIBERTAR_SOZINHO, mensagemDepoisDeFeito } from "@/lib/trabalho";
import { ajustesDe, ajustePendente } from "@/lib/ajuste-no-local";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { pedirConfirmacaoAoCliente } from "@/lib/email-trabalho";
import { avisarClienteDoTrabalhoFeitoPorPush } from "@/lib/avisar-por-push";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { lerBase } from "@/lib/base-do-preco";
import { MARQUE_AS_HORAS_PRIMEIRO, podeDarPorFeitoComAsHoras } from "@/lib/horas-do-trabalho";

export const runtime = "nodejs";

/**
 * "Está feito" — com fotografias, se as tiver.
 *
 * A fotografia é o que o cliente vê antes de confirmar, é o que decide uma
 * reclamação, e é o que permite libertar o dinheiro ao fim de sete dias sem
 * ninguém dizer nada: sem prova, o silêncio do cliente não pode valer como
 * aceitação.
 *
 * DEIXOU DE SER OBRIGATÓRIA — 26-10-2026 (d22). Havia profissionais que não
 * conseguiam pôr fotografias e ficavam sem poder dar o trabalho por feito.
 * Sem elas, o trabalho fica «Por confirmar com o cliente»: o cliente não
 * recebe o pedido de confirmação com prazo, o cron não o confirma sozinho
 * (ver `prazoCorre` em trabalho.ts), e é um colega da CLYON que fala com o
 * cliente e confirma na Mesa. Com elas, tudo como antes.
 *
 * SEM FOTOGRAFIAS DE TODO — 30-10-2026 (dono). O profissional carrega em «Está
 * feito» (nota opcional) e o cliente confirma «Sim, ficou feito»; se não disser
 * nada, fica confirmado ${DIAS_ATE_LIBERTAR_SOZINHO} dias depois do «Está feito».
 * A CLYON pode confirmar antes pelo backoffice. Num Trabalho CLYON confirma a
 * CLYON. As fotografias ainda se aceitam de uma app antiga, mas não mudam nada.
 *
 * A resposta traz a frase para o painel e para a app (`mensagem`), quantas
 * fotografias ficaram, e os dias até à confirmação automática — `null` quando
 * não há prazo a correr.
 *
 * A FRASE É A DO CAMINHO CERTO — 28-10-2026 (d4). Dizia sempre «um colega da
 * CLYON vai confirmar», também a quem juntou fotografias, e logo por baixo o
 * painel dizia «À espera do cliente… 7 dias». Agora: com fotografias, é o
 * cliente que confirma (ou o prazo); num Trabalho CLYON, a CLYON (ou o prazo);
 * sem fotografias, um colega da CLYON com o cliente. Ver `mensagemDepoisDeFeito`.
 *
 * As fotos já estão no armazenamento — chegam aqui como URLs, não como
 * ficheiros. É o mesmo caminho do pedido do cliente, e é o que impede um corpo
 * grande de bater no limite do Vercel.
 */

const MAX_FOTOS = 8;

export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: { negociacaoId?: unknown; fotos?: unknown; nota?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  // Só URLs do nosso armazenamento. Sem isto, a "prova" podia apontar para
  // qualquer sítio da internet — e o cliente confirmava a partir de uma imagem
  // que nós não guardamos e que pode desaparecer amanhã.
  const fotos = Array.isArray(corpo.fotos)
    ? corpo.fotos
        .filter((f): f is string => typeof f === "string")
        .filter((u) => /^https:\/\/[a-z0-9.-]*\.(?:public\.)?blob\.vercel-storage\.com\//i.test(u))
        .slice(0, MAX_FOTOS)
    : [];
  // Já não se pedem (30-10-2026): o profissional carrega em «Está feito» e o
  // cliente confirma. Fica a aceitar as que uma app antiga ainda mande.
  const comFotografias = fotos.length > 0;

  try {
    // O trabalho tem de ser dele e estar na fase certa. A condição repete-se no
    // UPDATE — esta é para dar uma mensagem, aquela é para garantir o facto.
    const linhas = await negociacoesDoProfissional(sessao.providerId);
    const trabalho = linhas.find((l) => l.id === negociacaoId);
    if (!trabalho) {
      return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    }
    if (!podeEnviarProva(trabalho as never)) {
      return NextResponse.json(
        { error: "Este trabalho não está à espera de prova." },
        { status: 409 },
      );
    }
    /*
     * O CONCLUIR SÓ DEPOIS DAS DUAS CONFIRMAÇÕES — 30-10-2026. Numa viagem
     * marcada pela app (a caminho → próximo → cheguei), o cliente confirma que
     * ele chegou antes de o trabalho se dar por feito. Trabalho CLYON e quem
     * nunca marcou a viagem ficam como estavam (`podeMostrarConcluir`).
     */
    const trabalhoClyon = trabalho.ofertaClyon != null || trabalho.valorFixoClyon != null;
    if (!podeMostrarConcluir(trabalho, trabalhoClyon)) {
      return NextResponse.json(
        {
          error: trabalho.chegouEm
            ? "O cliente ainda não confirmou que chegou. Peça-lhe que confirme no pedido."
            : "Marque primeiro que chegou, e espere que o cliente o confirme.",
        },
        { status: 409 },
      );
    }
    /*
     * NUM TRABALHO POR HORA, AS HORAS PRIMEIRO — 31-10-2026. O «Está feito»
     * só depois de ele marcar o início e o fim (e carregar em OK): é com elas
     * que o cliente confirma e que o total se conta. A prova leva-as.
     */
    const porHora = lerBase(trabalho.baseDoPreco) === "hora";
    if (!podeDarPorFeitoComAsHoras(porHora, trabalho)) {
      return NextResponse.json({ error: MARQUE_AS_HORAS_PRIMEIRO, faltamAsHoras: true }, { status: 409 });
    }
    /*
     * COM UM AJUSTE À ESPERA DO CLIENTE, O VALOR AINDA NÃO ESTÁ DECIDIDO —
     * 18-10-2026. Dar o trabalho por feito deixava o cliente a responder a
     * uma pergunta que já não conta (depois da prova o valor não muda). Fica
     * aqui e não no UPDATE: um pedido que expirou continua escrito «pendente»
     * na base até alguém o reescrever, e só `ajustePendente` sabe do prazo.
     */
    if (ajustePendente(ajustesDe(trabalho.ajustesJson), new Date())) {
      return NextResponse.json(
        {
          error:
            "Tem um pedido de ajuste do valor à espera do cliente. Espere pela resposta, ou retire o pedido, antes de dar o trabalho por feito.",
        },
        { status: 409 },
      );
    }

    const nota = typeof corpo.nota === "string" ? corpo.nota.trim().slice(0, 500) : "";
    const gravou = await registarExecucao(
      negociacaoId,
      sessao.providerId,
      JSON.stringify({
        fotos,
        nota,
        em: new Date().toISOString(),
        // As horas marcadas, como estavam no «Está feito» (31-10-2026).
        ...(porHora
          ? {
              horas: {
                inicioEm: trabalho.horasInicioEm,
                fimEm: trabalho.horasFimEm,
                horasFaturadas: trabalho.horasFaturadas != null ? Number(trabalho.horasFaturadas) : null,
                valorDasHoras: trabalho.valorDasHoras != null ? Number(trabalho.valorDasHoras) : null,
              },
            }
          : {}),
      }),
    );
    if (!gravou) {
      return NextResponse.json({ error: "A prova já tinha sido enviada." }, { status: 409 });
    }

    await appendOrderHistory(trabalho.pedidoId, {
      type: "created",
      by: null,
      message: comFotografias
        ? `${sessao.nome} marcou o trabalho como feito (${fotos.length} fotografia(s)).`
        : `${sessao.nome} marcou o trabalho como feito — por confirmar pelo cliente.`,
    });

    // O cliente tem de saber que o prazo começou a correr. Sem este email, os
    // sete dias passavam sem ele saber que existiam — e a libertação automática
    // deixava de ser um prazo para ser uma surpresa.
    //
    // O link vai novo porque o antigo não é recuperável: guardamos o hash, não
    // o token. O email diz que substitui o anterior.
    //
    // COM OU SEM FOTOGRAFIAS (30-10-2026): o cliente confirma, e o prazo corre
    // desde o «Está feito». Sem o pedido lido, nada sai.
    try {
      const doPedido = await getSimulatorOrderById(trabalho.pedidoId);
      /*
       * NUM TRABALHO CLYON QUEM CONFIRMA É A CLYON — 02-10-2026. O cliente
       * destes trabalhos não recebe mensagens automáticas, e quem paga ao
       * profissional é a CLYON: o pedido de confirmação não sai, e o trabalho
       * aparece na página dos Trabalhos CLYON como «Feito — confirmar».
       */
      const eOfertaClyon = (doPedido as { valorFixoClyon?: unknown } | undefined)?.valorFixoClyon != null;
      if (doPedido?.contactEmail && !eOfertaClyon) {
        const novo = gerarTokenDeAcesso();
        await substituirTokenDoPedido(trabalho.pedidoId, novo.hash, novo.expiraEm);
        await pedirConfirmacaoAoCliente({
          paraEmail: doPedido.contactEmail,
          paraNome: doPedido.contactName ?? null,
          pedidoId: trabalho.pedidoId,
          profissionalNome: sessao.nome,
          token: novo.token,
          quantasFotos: fotos.length,
          diasParaConfirmar: DIAS_ATE_LIBERTAR_SOZINHO,
          // Quem paga em notas lê «confirme antes de lhe pagar»; quem pagou
          // pela plataforma lê que é a confirmação que liberta o profissional.
          formaDePagamento: trabalho.formaDePagamento ?? null,
          criadaEm: trabalho.createdAt ?? null,
          baseUrl: urlDeAccaoDoPedido(req.headers),
        });
        // E no telemóvel, se ele tiver os avisos ligados: o prazo começou a
        // correr, e sete dias passam depressa a quem não sabe que existem.
        await avisarClienteDoTrabalhoFeitoPorPush({
          email: doPedido.contactEmail,
          profissionalNome: sessao.nome,
          pedidoId: trabalho.pedidoId,
          token: novo.token,
        });
      }
    } catch (err) {
      console.error("[profissionais/trabalho] pedido de confirmação não saiu:", err);
    }

    return NextResponse.json({
      ok: true,
      // Num Trabalho CLYON confirma a CLYON — o mesmo critério do email acima.
      mensagem: mensagemDepoisDeFeito({
        comFotografias,
        ofertaClyon: (trabalho as { valorFixoClyon?: unknown }).valorFixoClyon != null,
      }),
      fotografias: fotos.length,
      confirmacaoAutomaticaEmDias: DIAS_ATE_LIBERTAR_SOZINHO,
    });
  } catch (error) {
    console.error("[profissionais/trabalho]", error);
    return NextResponse.json({ error: "Não foi possível registar" }, { status: 500 });
  }
}
