import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { registarSemFalhar } from "@/lib/db";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { trabalhoQueSePodePagar } from "@/lib/acesso-ao-pagamento";
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
import { A_PLATAFORMA_COBRA } from "@/lib/pagamento-na-plataforma";
import { pedirPagamento } from "@/lib/pedir-ao-eupago";
import {
  abrirPagamento,
  fecharSemPagar,
  marcarFalhado,
  marcarPedido,
  pagamentosDaNegociacao,
  type Pagamento,
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
 * A PORTA ESTÁ FECHADA EM PRODUÇÃO enquanto `A_PLATAFORMA_COBRA` for falso.
 * Todos os ecrãs dizem hoje ao cliente que paga ao profissional no fim do
 * trabalho; cobrá-lo neste estado era ficar-lhe com o dinheiro depois de lhe
 * termos escrito que não ficávamos. Na sandbox não há dinheiro e a porta abre.
 */

type Corpo = {
  pedidoId?: unknown;
  negociacaoId?: unknown;
  metodo?: unknown;
  comFactura?: unknown;
  telemovel?: unknown;
  token?: unknown;
};

/** O que o cliente vê de um pagamento. Nunca a linha inteira. */
function paraOCliente(p: Pagamento) {
  return {
    id: p.id,
    metodo: p.metodo,
    estado: p.estado,
    valor: p.valor,
    comFactura: p.comFactura,
    referencia: p.referencia,
    entidade: p.entidade,
    expiraEm: p.expiraEm,
    pagoEm: p.pagoEm,
    criadoEm: p.criadoEm,
  };
}

function metodoValido(v: unknown): MetodoDePagamento | null {
  return typeof v === "string" && (METODOS as string[]).includes(v)
    ? (v as MetodoDePagamento)
    : null;
}

async function quemEstaAPagar(req: NextRequest) {
  const sessao = await getServerSession(authOptions);
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
    const linhas = await pagamentosDaNegociacao(acesso.trabalho.negociacaoId);
    /*
     * `disponivel` EXISTE PARA O ECRÃ NÃO APARECER QUANDO NÃO SERVE.
     *
     * Se a porta estiver fechada, o cliente não pode ver uma caixa de
     * pagamento que responde 503 quando ele carrega. E o navegador não tem
     * como saber se estamos em sandbox ou em produção — isso é uma variável do
     * servidor. Por isso a resposta di-lo, e o ecrã decide-se com ela.
     */
    const conf = configuracaoDoEupago(process.env);
    const disponivel =
      conf.ok &&
      podeCobrar(conf.config, A_PLATAFORMA_COBRA, {
        email: acesso.trabalho.emailDoCliente,
        // O valor mais alto dos dois: se o tecto de teste travar o com
        // factura, é melhor o ecrã não aparecer do que aparecer e falhar
        // quando ele escolher a factura.
        valor: quantoOClientePaga(
          acesso.trabalho.acordado,
          acesso.trabalho.regime,
          acesso.trabalho.taxas,
          true,
        ),
      }).pode;

    return NextResponse.json({
      disponivel,
      pagamentos: linhas.map(paraOCliente),
      pago: linhas.some((l) => l.estado === "pago"),
      /*
       * Os dois números, calculados no SERVIDOR e enviados juntos.
       *
       * O ecrã já os sabe calcular — mas se os calculasse outra vez para o
       * botão, passavam a existir duas contas para o mesmo pagamento, e o dia
       * em que discordassem era o dia em que o cliente via um valor e o banco
       * lhe pedia outro.
       */
      valores: {
        semFactura: quantoOClientePaga(
          acesso.trabalho.acordado,
          acesso.trabalho.regime,
          acesso.trabalho.taxas,
          false,
        ),
        comFactura: quantoOClientePaga(
          acesso.trabalho.acordado,
          acesso.trabalho.regime,
          acesso.trabalho.taxas,
          true,
        ),
      },
    });
  } catch (e) {
    console.error("[pagamentos GET]", e);
    return NextResponse.json({ error: "Não foi possível ler os pagamentos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

  const comFactura = corpo.comFactura === true;
  const valor = quantoOClientePaga(t.acordado, t.regime, t.taxas, comFactura);

  // ── A porta ──────────────────────────────────────────────────────────────
  const porta = podeCobrar(conf.config, A_PLATAFORMA_COBRA, {
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
        `${comFactura ? "com" : "sem"} factura. Ainda não está pago.`,
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
