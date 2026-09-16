import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  ajudaPorId,
  ajudasParaAdmin,
  leiturasDoSuporte,
  marcarSuporteLido,
  appendOrderHistory,
  pedidosComConversa,
  responderPedidoDeAjuda,
} from "@/lib/db";
import {
  chaveDaConversa,
  conversaDoHistorico,
  lerChave,
  ordenarConversas,
  porResponder,
  type ConversaDeSuporte,
  type MensagemDaConversa,
} from "@/lib/conversas-de-suporte";
import { rotuloServico } from "@/lib/mensagem-whatsapp";
import { rotuloDoAssunto } from "@/lib/ajuda-plataforma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A CAIXA DE ENTRADA DO SUPORTE — tudo o que alguém nos escreveu.
 *
 * "Abra um chat directo para o suporte falar com os clientes e pros por aqui.
 * Hoje recebi uma mensagem vinda de uma cliente com dúvida no seu pedido, mas
 * ela ficou presa ao pedido e agora não sei qual era. Faça com que todas as
 * mensagens venham parar aqui, devidamente separadas como no WhatsApp."
 * — 13-09-2026.
 *
 * O problema era que uma pergunta escrita DENTRO de um pedido não aparecia em
 * lista nenhuma: para a ler era preciso abrir o pedido certo, e para saber
 * qual era o pedido certo era preciso já a ter lido.
 *
 * A RESPOSTA SAI POR ONDE A MENSAGEM ENTROU, e isso é metade do valor disto.
 * Uma pessoa que perguntou dentro do pedido dela espera a resposta no pedido
 * dela; responder-lhe por outro canal é fazê-la procurar. É a `chave` que
 * guarda essa informação — `pedido:283`, `plataforma:12` — e é por isso que
 * ela não é um número solto.
 *
 * ⚠️ O WHATSAPP NÃO ESTÁ AQUI, e é a correcção de 15-09-2026: "esse é o
 * Suporte, não é para ser o WhatsApp; pedi para ele ser ORGANIZADO como o
 * WhatsApp, mas não para trazer as suas conversas". O «como no wpp» era sobre
 * a FORMA — fio de balões em vez de tabela de estados. O WhatsApp tem o ecrã
 * dele, com a mesa e os separadores; trazê-lo para cá dava dois sítios para a
 * mesma coisa e enterrava o que só existe aqui.
 *
 * A resposta a um ticket da app é a única que NÃO sai daqui: o painel manda-a
 * para `/api/admin/suporte/[id]/mensagens`, que já existe e já sabe passar o
 * ticket a «em curso». Escrever aqui uma segunda cópia dessa gravação era
 * garantir que um dia as duas deixavam de fazer o mesmo.
 */

function primeiroNome(nome: string | null | undefined, alternativa: string): string {
  const limpo = (nome ?? "").trim();
  return limpo || alternativa;
}

/** Uma resposta da ajuda, no formato em que o painel da Ajuda já as grava. */
type RespostaDaAjuda = { texto: string; em: string; por: string };

/**
 * As respostas guardadas num pedido de ajuda.
 *
 * Um JSON meio escrito não pode esconder a pergunta: se não se conseguir ler,
 * mostra-se a pergunta sem as respostas em vez de deixar a conversa cair da
 * lista — que é exactamente a avaria que este ecrã veio remediar.
 */
function respostasDaAjuda(respostaJson: string | null): RespostaDaAjuda[] {
  if (!respostaJson) return [];
  try {
    const lido = JSON.parse(respostaJson);
    if (!Array.isArray(lido)) return [];
    return lido.map((r) => ({
      texto: typeof r === "string" ? r : String(r?.texto ?? ""),
      em: typeof r === "string" ? "" : String(r?.em ?? ""),
      por: typeof r === "string" ? "" : String(r?.por ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const conversas: ConversaDeSuporte[] = [];

  /* ── 1. As que ficaram presas dentro de um pedido ──────────────────────── */
  try {
    for (const p of await pedidosComConversa()) {
      const mensagens = conversaDoHistorico(p.historyJson);
      if (mensagens.length === 0) continue;
      conversas.push({
        chave: chaveDaConversa("pedido", p.id),
        origem: "pedido",
        quem: primeiroNome(p.contactName, `Pedido #${p.id}`),
        contacto: p.contactEmail ?? p.contactPhone ?? null,
        pedidoId: p.id,
        assunto: rotuloServico(p.serviceType),
        mensagens,
      });
    }
  } catch (e) {
    console.error("[suporte/conversas] pedidos:", e instanceof Error ? e.message : e);
  }

  /* ── 2. A ajuda escrita na plataforma ──────────────────────────────────── */
  try {
    for (const a of await ajudasParaAdmin()) {
      const mensagens: MensagemDaConversa[] = [
        {
          de: "eles",
          texto: a.mensagem,
          quando: String(a.createdAt),
          autor: a.nome ?? null,
        },
      ];
      /*
       * As respostas já eram gravadas como `{ texto, em, por }` pelo painel da
       * Ajuda. Lê-se e escreve-se NESSE formato, e não num novo: as duas telas
       * mostram o mesmo fio, e um campo com outro nome fazia uma delas mostrar
       * «Invalid Date» por baixo de cada resposta escrita na outra.
       */
      for (const r of respostasDaAjuda(a.respostaJson)) {
        if (!r.texto.trim()) continue;
        mensagens.push({
          de: "clyon",
          texto: r.texto,
          quando: r.em || String(a.updatedAt),
          autor: r.por || a.tratadoPor || null,
        });
      }
      conversas.push({
        chave: chaveDaConversa("plataforma", a.id),
        origem: "plataforma",
        quem: primeiroNome(a.nome, a.email ?? "Sem nome"),
        contacto: a.email ?? null,
        pedidoId: null,
        assunto: rotuloDoAssunto(a.assunto),
        mensagens,
      });
    }
  } catch (e) {
    console.error("[suporte/conversas] plataforma:", e instanceof Error ? e.message : e);
  }

  /*
   * O WHATSAPP SAIU DAQUI — 15-09-2026.
   *
   * "Esse é o Suporte, não é para ser o WhatsApp. Eu pedi para ele ser
   * ORGANIZADO como o WhatsApp, mas não para trazer as suas conversas."
   *
   * Eu li o pedido a mais. "Como no wpp" era sobre a FORMA — fio de balões em
   * vez de tabela de estados — e eu trouxe também o conteúdo. O WhatsApp tem
   * o ecrã dele, com a mesa, os separadores, o assumir e o bloquear; repetir
   * as mesmas conversas aqui dava dois sítios para a mesma coisa e enterrava
   * o que só existe aqui.
   *
   * O que fica é o que NÃO tem outro sítio: a pergunta presa dentro de um
   * pedido — a que deu origem a tudo isto — a ajuda escrita na plataforma, e
   * os tickets da app.
   */

  /* ── 3. O centro de ajuda da app ───────────────────────────────────────── */
  try {
    const sb = getSupabaseAdmin();
    const { data: tickets } = await sb
      .from("support_tickets")
      .select("id, user_id, subject, description, status, created_at")
      .order("created_at", { ascending: false })
      .limit(80);

    const linhas = tickets ?? [];
    if (linhas.length > 0) {
      // Um uuid não diz nada a ninguém: o nome vem de `profiles`, como em todas
      // as outras secções do painel.
      const nomes: Record<string, string> = {};
      const ids = [...new Set(linhas.map((t) => t.user_id).filter(Boolean))] as string[];
      if (ids.length > 0) {
        const { data: perfis } = await sb.from("profiles").select("id, full_name, email").in("id", ids);
        for (const p of perfis ?? []) {
          nomes[String(p.id)] = String(p.full_name ?? p.email ?? "");
        }
      }

      const { data: msgs } = await sb
        .from("support_ticket_messages")
        .select("ticket_id, author_role, author_label, body, created_at")
        .in("ticket_id", linhas.map((t) => t.id))
        .order("created_at", { ascending: true });

      const porTicket = new Map<string, MensagemDaConversa[]>();
      for (const m of msgs ?? []) {
        const chave = String(m.ticket_id);
        const fio = porTicket.get(chave) ?? [];
        fio.push({
          de: m.author_role === "admin" ? "clyon" : "eles",
          texto: String(m.body ?? ""),
          quando: String(m.created_at),
          autor: (m.author_label as string) ?? null,
        });
        porTicket.set(chave, fio);
      }

      for (const t of linhas) {
        const quem = nomes[String(t.user_id)] || "Utilizador da app";
        conversas.push({
          chave: chaveDaConversa("app", String(t.id)),
          origem: "app",
          quem,
          contacto: null,
          /*
           * SEM LIGAÇÃO AO PEDIDO, de propósito. O ticket tem um `request_id`,
           * mas é um pedido do lado do Supabase e não o `simulatorOrders.id`
           * deste painel — abrir um pelo outro mostrava a quem atende a morada
           * e o valor de OUTRO cliente.
           */
          pedidoId: null,
          assunto: String(t.subject ?? "") || null,
          mensagens: (
            [
              // O que ele escreveu ao abrir o ticket é a primeira mensagem da
              // conversa, e não um campo do cabeçalho: é a pergunta.
              {
                de: "eles",
                texto: String(t.description ?? ""),
                quando: String(t.created_at),
                autor: quem,
              },
              ...(porTicket.get(String(t.id)) ?? []),
            ] as MensagemDaConversa[]
          ).filter((m) => m.texto.trim()),
        });
      }
    }
  } catch (e) {
    console.error("[suporte/conversas] app:", e instanceof Error ? e.message : e);
  }

  const aEsperar = conversas.filter(porResponder).length;

  /*
   * SÓ A CONTAGEM, quando é para o selo do menu.
   *
   * "enviei uma mensagem como teste mas não recebi notificação no admin"
   * — 16-09-2026. O selo do Suporte contava `support_tickets`, e uma pergunta
   * escrita DENTRO de um pedido não é um ticket: é uma conversa, e ficava sem
   * aviso nenhum. Agora o menu também conta estas — mas não tem de arrastar a
   * lista inteira, com todas as mensagens de todas as conversas, de dois em
   * dois minutos só para saber um número.
   */
  if (new URL(req.url).searchParams.get("so") === "contagem") {
    return NextResponse.json({ aEsperar });
  }

  /*
   * ATÉ QUANDO É QUE ESTE COLABORADOR JÁ LEU CADA CONVERSA.
   *
   * Sai daqui, com as conversas, e não numa chamada à parte: o contador de
   * não-lidas é feito da diferença entre as duas coisas, e pedi-las em dois
   * momentos deixava o ecrã a piscar um número errado entre uma e outra.
   */
  const lidas = colab ? await leiturasDoSuporte(colab.id) : {};

  return NextResponse.json({ conversas: ordenarConversas(conversas), aEsperar, lidas });
}

/**
 * Responder — e a resposta sai pelo canal de onde veio a pergunta.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { chave?: unknown; texto?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const texto = typeof corpo.texto === "string" ? corpo.texto.trim() : "";
  const alvo = lerChave(typeof corpo.chave === "string" ? corpo.chave : "");
  if (!texto) return NextResponse.json({ error: "Escreva a mensagem." }, { status: 400 });
  if (!alvo) return NextResponse.json({ error: "Conversa desconhecida." }, { status: 400 });

  const quem = colab?.nome ?? "a equipa";

  try {
    if (alvo.origem === "pedido") {
      const pedidoId = Number(alvo.id);
      if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
      }
      /*
       * `message_to_client` e não `info_requested`: a segunda muda o estado do
       * pedido para «precisa info» e é uma decisão de operação. Daqui sai uma
       * RESPOSTA — o cliente perguntou, respondeu-se — e responder não pode
       * empurrar um pedido para trás na fila.
       */
      await appendOrderHistory(pedidoId, {
        type: "message_to_client",
        by: { id: colab?.id ?? 0, nome: quem, role: colab?.papel ?? "admin" },
        message: texto,
      });
      return NextResponse.json({ ok: true });
    }

    if (alvo.origem === "plataforma") {
      const id = Number(alvo.id);
      const ajuda = await ajudaPorId(id);
      if (!ajuda) return NextResponse.json({ error: "Esse pedido de ajuda já não existe." }, { status: 404 });
      /*
       * As respostas ACUMULAM-SE, e no MESMO formato do painel da Ajuda — é a
       * mesma linha da mesma tabela, escrita agora por duas telas.
       */
      const anteriores = respostasDaAjuda(ajuda.respostaJson);
      anteriores.push({ texto: texto.slice(0, 4000), em: new Date().toISOString(), por: quem });
      await responderPedidoDeAjuda(id, {
        respostaJson: JSON.stringify(anteriores),
        // Respondeu-se; fica à espera de quem perguntou, e não fechado — fechar
        // é uma decisão de quem lê a resposta, não de quem a escreve.
        estado: "waiting_customer",
        tratadoPor: quem,
      });
      return NextResponse.json({ ok: true });
    }


    /*
     * Só sobra a app, e essa o painel manda para a rota que já existe. Se
     * chegar aqui, é porque alguém chamou esta rota à mão — e o silêncio seria
     * pior do que o não.
     */
    return NextResponse.json(
      { error: "As respostas aos pedidos da app saem por /api/admin/suporte/[id]/mensagens." },
      { status: 400 },
    );
  } catch (e) {
    console.error("[suporte/conversas POST]", e);
    return NextResponse.json({ error: "Não foi possível enviar." }, { status: 500 });
  }
}

/**
 * MARCAR UMA CONVERSA COMO LIDA.
 *
 * "Já abri as 3 mensagens novas mas os pontos verdes ainda estão presentes."
 *
 * O ponto verde nunca quis dizer «por ler» — dizia «à espera de resposta», e
 * essa não se apaga por se abrir a conversa: apaga-se por se responder. O que
 * faltava era a outra marca, a do WhatsApp, e é esta.
 *
 * PATCH e não POST: o POST desta rota envia uma resposta ao cliente, e são
 * duas coisas de gravidade muito diferente para partilharem verbo.
 */
export async function PATCH(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  if (!colab) return NextResponse.json({ error: "Sem sessão." }, { status: 401 });

  let corpo: { chave?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const chave = typeof corpo.chave === "string" ? corpo.chave.trim() : "";
  // A chave tem de ser uma das nossas. Sem isto, a tabela enchia-se do que
  // quer que alguém mandasse no corpo.
  if (!chave || !lerChave(chave)) {
    return NextResponse.json({ error: "Conversa desconhecida." }, { status: 400 });
  }

  try {
    await marcarSuporteLido(colab.id, chave);
    return NextResponse.json({ ok: true });
  } catch (e) {
    /*
     * Falhar a marcar como lida não é notícia para quem está a ler: a conversa
     * abriu, o texto está no ecrã, e o contador volta a aparecer na próxima
     * passagem. Fica nos registos e mais nada.
     */
    console.error("[suporte/conversas PATCH]", e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
