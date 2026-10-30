import { NextRequest, NextResponse } from "next/server";
import { chaveDoPedidoHttp } from "@/lib/sessao-de-convidado";
import { sessaoDoCliente } from "@/lib/cliente-auth";
import { registarSemFalhar } from "@/lib/db";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { trabalhoQueSePodePagar } from "@/lib/acesso-ao-pagamento";
import {
  estadoDoPagamentoParaOCliente,
  // O que o cliente vê de um pagamento. Nunca a linha inteira.
  pagamentoVistoPeloCliente as paraOCliente,
} from "@/lib/pagamento-para-o-cliente";
import {
  DIAS_DE_PRAZO_DA_REFERENCIA,
  MINUTOS_DO_MBWAY,
  METODOS,
  NOME_DO_METODO,
  configuracaoDoEupago,
  podeCobrar,
  porqueNaoPodeCobrar,
  quantoOClientePaga,
  type MetodoDePagamento,
} from "@/lib/eupago";
import { O_CLIENTE_PAGA_SOZINHO } from "@/lib/pagamento-na-plataforma";
import { temDividaDoProfissional } from "@/lib/divida-do-profissional";
import { pedirPagamento } from "@/lib/pedir-ao-eupago";
import {
  abrirPagamento,
  fecharSemPagar,
  marcarFalhado,
  marcarPedido,
  pagamentosDaNegociacao,
} from "@/lib/pagamentos-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O CLIENTE PAGA NO SITE — MB WAY e Multibanco.
 *
 * Fase 2 do `docs/plano-pagamentos-eupago.md`. Esta rota pede a referência ao
 * euPago; quem diz que ela foi paga é o webhook, e mais ninguém. Uma referência
 * criada NÃO é um pagamento, e este ficheiro nunca dá nada por pago.
 *
 * A PORTA ABRIU A 30-10-2026 (`O_CLIENTE_PAGA_SOZINHO`). Até lá estava fechada:
 * «fica só o backoffice», decisão do dono a 21-09-2026 — as referências
 * geram-se lá, pedido a pedido. (Até 29-09-2026 a razão escrita aqui era que
 * os ecrãs diziam ao cliente que pagava ao profissional no fim; deixaram de o
 * dizer a quem paga pela plataforma.) Na sandbox não há dinheiro e a porta abre.
 */

type Corpo = {
  pedidoId?: unknown;
  negociacaoId?: unknown;
  metodo?: unknown;
  comFactura?: unknown;
  telemovel?: unknown;
  token?: unknown;
};

function metodoValido(v: unknown): MetodoDePagamento | null {
  return typeof v === "string" && (METODOS as string[]).includes(v)
    ? (v as MetodoDePagamento)
    : null;
}

async function quemEstaAPagar(req: NextRequest) {
  const sessao = await sessaoDoCliente(req);
  return sessao?.user?.email ?? null;
}

/**
 * O estado dos pagamentos de um trabalho.
 *
 * É o que o ecrã do cliente consulta enquanto espera: o MB WAY resolve-se em
 * segundos e o webhook chega sozinho, mas só o servidor sabe quando chegou.
 */
export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "pagamentos-ver", 120, 300);
  if (limite.erro) return limite.erro;

  const p = req.nextUrl.searchParams;
  const acesso = await trabalhoQueSePodePagar(
    Number(p.get("pedidoId")),
    Number(p.get("negociacaoId")),
    { token: p.get("token") ?? undefined, email: await quemEstaAPagar(req) },
  );
  if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.estado });

  try {
    /*
     * O ESTADO VEM DA FUNÇÃO QUE A APP DE CLIENTE TAMBÉM LÊ — 28-10-2026 (d8,
     * R5): `disponivel`, os pagamentos, os dois valores, o modelo do IVA e se
     * o pagamento é do cliente. Ver `pagamento-para-o-cliente.ts`.
     */
    return NextResponse.json(await estadoDoPagamentoParaOCliente(acesso.trabalho));
  } catch (e) {
    console.error("[pagamentos GET]", e);
    return NextResponse.json({ error: "Não foi possível ler os pagamentos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Com a sessão de convidado (o link aberto na app sem conta) não se paga (S16, R15).
  if (chaveDoPedidoHttp(req)) {
    return NextResponse.json({ ok: false, error: "Para pagar, crie a conta." }, { status: 403 });
  }
  /*
   * Um travão apertado, e é de propósito: cada passagem por aqui é uma
   * chamada ao euPago e — no MB WAY — uma notificação no telemóvel de alguém.
   * Ninguém precisa de pedir dez pagamentos em cinco minutos.
   */
  const limite = await limitarRotaPublica(req, "pagamentos-criar", 10, 300);
  if (limite.erro) return limite.erro;

  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const metodo = metodoValido(corpo.metodo);
  if (!metodo) {
    return NextResponse.json({ error: "Escolha MB WAY ou Multibanco." }, { status: 400 });
  }

  const conf = configuracaoDoEupago(process.env);
  if (!conf.ok) {
    console.error("[pagamentos] sem configuração:", conf.falta);
    return NextResponse.json(
      { error: "Os pagamentos no site ainda não estão disponíveis." },
      { status: 503 },
    );
  }

  /*
   * O ACESSO VEM ANTES DA PORTA, e a ordem mudou de propósito (17-09-2026).
   *
   * Desde que existe o portão de testador, a porta já não responde a uma
   * pergunta geral — responde sobre ESTA pessoa e ESTE valor. Só se sabe quem
   * está a pagar depois de confirmar que o trabalho é dela.
   */
  const acesso = await trabalhoQueSePodePagar(Number(corpo.pedidoId), Number(corpo.negociacaoId), {
    token: corpo.token,
    email: await quemEstaAPagar(req),
  });
  if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.estado });
  const t = acesso.trabalho;
  /*
   * E POR CONTA, além de por endereço (Segurança, 28-10-2026): pelo cliente do
   * pedido, ou pelo próprio pedido quando ele não deu email — seja pelo link,
   * pela conta ou pela app, cada pedido de pagamento conta para o mesmo lado.
   */
  const porConta = await limitarPorConta(
    "pagamentos-criar-conta",
    t.emailDoCliente ?? `pedido:${t.pedidoId}`,
    10,
    300,
  );
  if (porConta.erro) return porConta.erro;

  // Com IVA incluído há factura em todas as vendas: grava-se como tal.
  const comFactura = t.modelo === "iva_incluido" || corpo.comFactura === true;
  if (temDividaDoProfissional(t.formaDePagamento, t.modelo)) {
    // Em dinheiro com IVA incluído o cliente não deve nada à CLYON — ver o GET.
    return NextResponse.json(
      { error: "Este trabalho paga-se ao parceiro, em dinheiro, no local." },
      { status: 409 },
    );
  }
  const valor = quantoOClientePaga(t.acordado, t.taxas, t.modelo, comFactura);

  // ── A porta ──────────────────────────────────────────────────────────────
  const porta = podeCobrar(conf.config, O_CLIENTE_PAGA_SOZINHO, {
    email: t.emailDoCliente,
    valor,
  });
  if (!porta.pode) {
    console.warn("[pagamentos] porta fechada:", porta.porque);
    return NextResponse.json(
      { error: "Os pagamentos no site ainda não estão disponíveis." },
      { status: 503 },
    );
  }

  const recusa = porqueNaoPodeCobrar(metodo, valor);
  if (recusa) return NextResponse.json({ error: recusa }, { status: 400 });

  try {
    const jaHa = await pagamentosDaNegociacao(t.negociacaoId);

    /*
     * JÁ ESTÁ PAGO — e não se cobra duas vezes o mesmo trabalho.
     *
     * Isto é a cortesia; a garantia é o índice único da base. Um `if` aqui não
     * chega: entre esta leitura e a escrita cabe outro pedido, e é exactamente
     * por isso que a coluna `negociacaoPaga` existe.
     */
    const pago = jaHa.find((l) => l.estado === "pago");
    if (pago) {
      return NextResponse.json(
        { error: "Este trabalho já está pago.", pagamento: paraOCliente(pago) },
        { status: 409 },
      );
    }

    const aberto = jaHa.find(
      (l) =>
        l.estado === "pendente" &&
        l.metodo === metodo &&
        l.valor === valor &&
        l.comFactura === comFactura,
    );

    /*
     * MULTIBANCO REAPROVEITA-SE, MB WAY NÃO — e a assimetria não é preguiça.
     *
     * Uma referência Multibanco vive dias e já foi dada ao cliente. Emitir uma
     * segunda para o mesmo trabalho é a forma mais directa de ele pagar as
     * duas: as duas são válidas, e nenhum banco lhe diz que já pagou a outra.
     *
     * O MB WAY é o contrário: são cinco minutos e uma notificação no telemóvel.
     * Quem carrega outra vez é quem a fechou sem querer, ou quem estava na
     * outra divisão — e devolver-lhe a mesma referência em silêncio deixa-o a
     * olhar para um ecrã que não faz nada. Pede-se outro, e o anterior fecha.
     */
    if (aberto && metodo === "multibanco") {
      const vivo = !aberto.expiraEm || aberto.expiraEm.getTime() > Date.now();
      if (vivo) return NextResponse.json({ pagamento: paraOCliente(aberto), reaproveitada: true });
    }
    for (const l of jaHa) {
      if (l.estado === "pendente" && l.metodo === "mbway" && metodo === "mbway") {
        await fecharSemPagar(l.id, "cancelado", { motivo: "O cliente pediu outro MB WAY." });
      }
    }

    // ── A partir daqui há uma linha na base, e é ela que o euPago vai citar ──
    const agora = Date.now();
    const expiraEm =
      metodo === "mbway"
        ? new Date(agora + MINUTOS_DO_MBWAY * 60_000)
        : new Date(agora + DIAS_DE_PRAZO_DA_REFERENCIA * 86_400_000);

    const telemovel =
      metodo === "mbway"
        ? (typeof corpo.telemovel === "string" ? corpo.telemovel : "") || t.telefoneDoCliente
        : null;

    const pagamentoId = await abrirPagamento({
      negociacaoId: t.negociacaoId,
      pedidoId: t.pedidoId,
      providerId: t.providerId,
      metodo,
      ambiente: conf.config.ambiente,
      valor,
      comFactura,
      // Dinheiro a sério, mas para provar a integração. Fica marcado para que
      // daqui a três meses se saiba de onde vieram estes euros.
      deTeste: porta.modo === "teste",
      telemovel,
      expiraEm,
    });

    const resposta = await pedirPagamento(conf.config, metodo, {
      pagamentoId,
      valor,
      telemovel,
      prazo: metodo === "multibanco" ? expiraEm : null,
    });

    if (!resposta.ok) {
      await marcarFalhado(pagamentoId, resposta.recusa.paraNos);
      console.error("[pagamentos] o euPago recusou:", resposta.recusa.paraNos);
      await registarSemFalhar({
        acontecimento: "pagamento_falhado",
        pedidoId: t.pedidoId,
        negociacaoId: t.negociacaoId,
        providerId: t.providerId,
        autorTipo: "cliente",
        resumo: `${NOME_DO_METODO[metodo]} recusado: ${resposta.recusa.paraNos}`,
        detalhe: { pagamentoId, metodo, valor, codigo: resposta.recusa.codigo },
      });
      return NextResponse.json(
        {
          error: resposta.recusa.paraOCliente,
          sugereOutroMetodo: resposta.recusa.sugereOutroMetodo,
        },
        { status: 502 },
      );
    }

    await marcarPedido(pagamentoId, {
      referencia: resposta.referencia,
      entidade: resposta.entidade,
      transacaoId: resposta.trid,
    });

    await registarSemFalhar({
      acontecimento: "pagamento_pedido",
      pedidoId: t.pedidoId,
      negociacaoId: t.negociacaoId,
      providerId: t.providerId,
      autorTipo: "cliente",
      resumo:
        `${NOME_DO_METODO[metodo]}: pedidos ${valor.toFixed(2).replace(".", ",")} € ` +
        `${comFactura ? "com" : "sem"} fatura. Ainda não está pago.`,
      detalhe: { pagamentoId, metodo, valor, ambiente: conf.config.ambiente },
    });

    const linha = (await pagamentosDaNegociacao(t.negociacaoId)).find((l) => l.id === pagamentoId);
    return NextResponse.json({
      pagamento: linha
        ? paraOCliente(linha)
        : {
            id: pagamentoId,
            metodo,
            estado: "pendente",
            valor,
            comFactura,
            referencia: resposta.referencia,
            entidade: resposta.entidade,
            expiraEm,
          },
    });
  } catch (e) {
    console.error("[pagamentos POST]", e);
    return NextResponse.json({ error: "Não foi possível iniciar o pagamento." }, { status: 500 });
  }
}
