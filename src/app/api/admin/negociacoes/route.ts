import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  appendOrderHistory,
  comOsChoquesDaAgenda,
  getSimulatorOrderById,
  marcarConcluidoComoVisto,
  marcarOrcamentoEnviado,
  numeroBloqueadoWhatsApp,
  pedidosComNegociacoes,
  retomarNumeroWhatsApp,
} from "@/lib/db";
import { enviarTextoManualWhatsApp } from "@/lib/whatsapp-cloud";
import { confiancaDasNegociacoes, type ConfiancaDaNegociacao } from "@/lib/confianca-na-mesa";
import { escolhidosDeJson, estadoNaMesa } from "@/lib/escolhidos-sem-resposta";
import { registarQueOClientePediu } from "@/lib/escolhidos-sem-resposta-no-servidor";
import { pedidoFechado } from "@/lib/pedido-arrumado";
import { eDoNovoModelo, novoModeloEmVigor } from "@/lib/novo-modelo";
import { segueONovoModelo } from "@/lib/novo-modelo-no-servidor";
import { agoraDoModelo } from "@/lib/relogio-do-modelo";

export const runtime = "nodejs";

/**
 * AS NEGOCIAÇÕES DO MODELO DE 15-11-2026 — d10. Antes da data, nenhuma, sem ir à
 * base. Depois: as fechadas perguntam ao servidor (`segueONovoModelo`: um
 * pagamento à CLYON antes da data deixa-as no antigo); as que ainda não fecharam
 * não têm nada pago — seguem o novo, menos os Trabalhos CLYON.
 */
async function modeloDasNegociacoes(
  negociacoes: Array<{ id: unknown; estado?: unknown; ofertaClyon?: unknown }>,
): Promise<Set<number>> {
  const agora = agoraDoModelo();
  const ids = new Set<number>();
  if (!novoModeloEmVigor(agora)) return ids;
  await Promise.all(
    negociacoes.map(async (n) => {
      const sim =
        n.estado === "acordada"
          ? await segueONovoModelo(n as Parameters<typeof segueONovoModelo>[0], agora).catch(() => true)
          : eDoNovoModelo({ ofertaClyon: n.ofertaClyon }, agora);
      if (sim) ids.add(Number(n.id));
    }),
  );
  return ids;
}

/** Pedidos da plataforma e as negociações de cada um, para o painel. */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  /*
   * A MESA TRAZ OS RECENTES; A BUSCA TRAZ TUDO.
   *
   * "A pesquisa deve procurar por número de telefone, endereço, número do
   * pedido, nome do cliente e localidade, até mesmo através do profissional."
   * — 18-09-2026. Procurava por tudo isso e já procurava bem: o que ela não
   * podia era encontrar um pedido que nunca chegou ao browser. A busca filtra
   * a lista carregada, e a lista carregada eram os trinta mais recentes.
   *
   * Com `?tudo=1` vem a mesa inteira, e é o painel — com a mesma função de
   * sempre, `combinaComABusca`, já coberta por testes — que filtra. Escrever
   * a busca outra vez em SQL dava duas regras para a mesma pergunta, e a
   * segunda a divergir seria sempre esta, que ninguém vê a funcionar.
   *
   * O ecrã normal continua leve: só pede tudo quando alguém escreve na caixa.
   */
  const tudo = new URL(req.url).searchParams.get("tudo") === "1";

  try {
    // Quem já tem outro trabalho a essa hora fica a vermelho ao escolher (21-10-2026).
    const pedidos = await comOsChoquesDaAgenda(await pedidosComNegociacoes(tudo ? 500 : 60));
    /*
     * A CONFIANÇA — 04-11-2026 (d10.1, d10.3): a guia por verificar trava o
     * aceitar e o contratar, e o cliente e o parceiro com o mesmo contacto dão
     * alerta. Se a leitura falhar, a Mesa sai na mesma, sem isto.
     */
    const confianca = await confiancaDasNegociacoes(
      pedidos.flatMap((p) => p.negociacoes.map((n) => Number(n.id))),
    ).catch((e) => {
      console.error("[api/admin/negociacoes GET] confiança:", e);
      return new Map<number, ConfiancaDaNegociacao>();
    });
    // Os escolhidos sem resposta (d6): o selo, a linha e os botões saem escritos daqui, pela regra de todos.
    const agora = new Date();
    // d10: o modelo de 15-11 de cada negociação, para a mensagem do orçamento (`mensagemDasPropostas`).
    const doNovoModelo = await modeloDasNegociacoes(pedidos.flatMap((p) => p.negociacoes));
    return NextResponse.json({
      pedidos: pedidos.map((p) => ({
        ...p,
        escolhidosNaMesa: estadoNaMesa(
          JSON.parse(JSON.stringify(p.negociacoes)),
          escolhidosDeJson(p.escolhidosJson),
          agora,
          pedidoFechado(p.status),
        ),
        negociacoes: p.negociacoes.map((n) => ({
          ...n,
          ...(confianca.get(Number(n.id)) ?? {}),
          ...(doNovoModelo.has(Number(n.id)) ? { noNovoModelo: true } : {}),
        })),
      })),
    });
  } catch (error) {
    console.error("[api/admin/negociacoes GET]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}

/**
 * O carimbo de "já vi": um pedido concluído fica em destaque na mesa até o
 * admin o ABRIR — abrir é ver, e é o ecrã que o diz, não um botão à parte.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { accao?: unknown; pedidoId?: unknown; texto?: unknown; marcarEnviado?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  // «O cliente pediu que procurássemos» (d6): o pedido feito por telefone ou WhatsApp, registado por quem o ouviu.
  if (corpo.accao === "cliente_pediu_mais_parceiros" && Number.isInteger(Number(corpo.pedidoId)) && Number(corpo.pedidoId) > 0) {
    const r = await registarQueOClientePediu(Number(corpo.pedidoId), colab?.nome ?? "a CLYON");
    return NextResponse.json(r.corpo, { status: r.status });
  }
  if (
    !["concluido_visto", "orcamento_enviado", "enviar_pela_clyon"].includes(String(corpo.accao)) ||
    !Number.isInteger(Number(corpo.pedidoId))
  ) {
    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  }
  /*
   * O ORÇAMENTO FOI AO CLIENTE — 21-10-2026. «Enviar orçamento» abriu o
   * WhatsApp com as propostas, ou «Já enviei» (seguiu por outro canal): o
   * pedido passa a «A aguardar cliente», e fica no histórico quem foi.
   */
  if (corpo.accao === "orcamento_enviado") {
    const pedidoId = Number(corpo.pedidoId);
    await marcarOrcamentoEnviado(pedidoId);
    await appendOrderHistory(pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message: `Orçamento enviado ao cliente, por ${colab?.nome ?? "a CLYON"} — à espera da resposta dele.`,
    });
    return NextResponse.json({ ok: true });
  }
  /*
   * «ENVIAR PELA CLYON» — 23-10-2026. *«As negociações, as mesmas opções de
   * enviar mensagem no WhatsApp para o cliente — enviar a proposta, enviar
   * pela CLYON…»* — o dono. O orçamento sai do número da plataforma, como o
   * dos Trabalhos CLYON (`accao: "proposta"` na rota deles), e a conversa
   * fica com a CLYON. O texto é o do ecrã (`mensagemDasPropostas`); o
   * número é o do pedido, lido aqui — nunca um que venha do browser.
   */
  if (corpo.accao === "enviar_pela_clyon") {
    const pedidoId = Number(corpo.pedidoId);
    const texto = typeof corpo.texto === "string" ? corpo.texto.trim() : "";
    if (!texto || texto.length > 4000) {
      return NextResponse.json({ error: "A mensagem está vazia, ou é longa demais." }, { status: 400 });
    }
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    const telefone = String(pedido.contactPhone ?? "");
    if (telefone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "O pedido não tem telemóvel." }, { status: 400 });
    }
    if (await numeroBloqueadoWhatsApp(telefone)) {
      return NextResponse.json(
        { error: "Este número está bloqueado. Desbloqueie-o primeiro, no ecrã do WhatsApp." },
        { status: 409 },
      );
    }
    const saiu = await enviarTextoManualWhatsApp(telefone, texto);
    if (!saiu) {
      return NextResponse.json(
        {
          error:
            "Não saiu. Ou não há canal configurado, ou a janela de 24 horas desde a última mensagem dele já fechou — use «Enviar orçamento», do seu WhatsApp.",
        },
        { status: 400 },
      );
    }
    await retomarNumeroWhatsApp(telefone);
    if (corpo.marcarEnviado === true) await marcarOrcamentoEnviado(pedidoId);
    const resumo = `Orçamento enviado ao cliente pelo WhatsApp da CLYON, por ${colab?.nome ?? "a CLYON"}.`;
    await appendOrderHistory(pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message: resumo,
    });
    return NextResponse.json({
      ok: true,
      feito: `#${pedidoId}: ${resumo.charAt(0).toLowerCase()}${resumo.slice(1)}${corpo.marcarEnviado === true ? " Fica em «A aguardar cliente»." : ""}`,
    });
  }
  await marcarConcluidoComoVisto(Number(corpo.pedidoId));
  return NextResponse.json({ ok: true });
}
