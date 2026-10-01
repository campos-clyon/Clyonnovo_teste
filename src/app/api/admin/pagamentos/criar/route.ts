import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { registarSemFalhar } from "@/lib/db";
import { trabalhoVistoPeloBackoffice } from "@/lib/acesso-ao-pagamento";
import {
  DIAS_DE_PRAZO_DA_REFERENCIA,
  METODOS,
  MINUTOS_DO_MBWAY,
  NOME_DO_METODO,
  configuracaoDoEupago,
  podeCobrarPeloBackoffice,
  porqueNaoPodeCobrar,
  quantoSePedeNesteTrabalho,
  type MetodoDePagamento,
} from "@/lib/eupago";
import { mensagemDaReferencia } from "@/lib/mensagem-da-referencia";
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
 * O ADMIN GERA A REFERÊNCIA, PEDIDO A PEDIDO.
 *
 * *«Vamos colocar apenas para o admin gerar as referências e enviar
 * individualmente para cada pedido.»* — 18-09-2026.
 *
 * É uma decisão melhor do que o ecrã aberto que estava feito, e por uma razão
 * que não é técnica: numa cobrança nova, o que falta não é o botão — é a
 * confiança de que cada caso correu bem. Com uma pessoa a decidir pedido a
 * pedido, cada referência tem alguém a olhar para ela, e o primeiro erro custa
 * um cliente em vez de cem.
 *
 * A PORTA AQUI É OUTRA, e está explicada em `podeCobrarPeloBackoffice`: não se
 * exige o `A_PLATAFORMA_COBRA` porque não há nada de automático — há um
 * administrador autenticado, um pedido concreto, e uma mensagem que ele vai
 * escrever a seguir. O que se mantém é a exigência de configuração: sem chave
 * não se pede nada a ninguém.
 *
 * NÃO MANDA A MENSAGEM. Devolve-a escrita, para ele a mandar pelo canal em que
 * já está a falar com aquele cliente. Mandar por nós seria decidir o canal e o
 * momento por ele — e é dele a conversa.
 */

type Corpo = {
  negociacaoId?: unknown;
  metodo?: unknown;
  comFactura?: unknown;
  telemovel?: unknown;
};

/**
 * O QUE JÁ FOI PEDIDO A ESTE CLIENTE — e se ele pagou.
 *
 * Sem isto, gerar uma referência era um gesto sem memória: a seguir ao clique
 * via-se o resultado, e no dia seguinte o ecrã estava como se nada tivesse
 * acontecido. Quem abrisse o pedido não tinha como saber se já tinha sido
 * pedido dinheiro àquele cliente — e a saída era gerar outra referência, que é
 * exactamente o que faz alguém pagar duas vezes.
 *
 * Devolve a mensagem outra vez, montada aqui. É o que permite reenviá-la dois
 * dias depois sem ter de gerar nada de novo: a referência que o cliente tem na
 * mão continua a ser aquela.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const negociacaoId = Number(req.nextUrl.searchParams.get("negociacaoId"));
  const acesso = await trabalhoVistoPeloBackoffice(negociacaoId);
  if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.estado });

  try {
    const linhas = await pagamentosDaNegociacao(negociacaoId);
    const conf = configuracaoDoEupago(process.env);
    return NextResponse.json({
      /*
       * Dizer que não está configurado é diferente de dizer que não há
       * pagamentos. Sem isto, um euPago por ligar parecia um cliente que
       * ainda não tinha pago.
       */
      configurado: conf.ok,
      falta: conf.ok ? null : conf.falta,
      /*
       * ONDE É QUE ESTE BOTÃO VAI BUSCAR O DINHEIRO — 21-09-2026.
       *
       * Até hoje era sempre a sandbox, e por isso o ecrã não precisava de o
       * dizer: carregar não tirava um cêntimo a ninguém. A partir do momento
       * em que `EUPAGO_AMBIENTE` diz `producao`, o mesmo botão no mesmo sítio
       * passa a cobrar uma pessoa a sério — e nada no ecrã mudava.
       *
       * Um botão que muda de consequência sem mudar de aspecto é a definição
       * de uma armadilha. O ambiente sai daqui para o ecrã o poder dizer.
       */
      ambiente: conf.ok ? conf.config.ambiente : null,
      pagamentos: linhas.map((l) => paraOEcra(l, acesso.trabalho, l.comFactura)),
      /*
       * QUEM PAGA ESTE TRABALHO — 01-10-2026. Em dinheiro com IVA incluído é
       * o profissional (o IVA e a comissão); o cartão di-lo, sugere o
       * telemóvel dele no MB WAY, e não pergunta pela factura.
       */
      ...(() => {
        const t = acesso.trabalho;
        const p = quantoSePedeNesteTrabalho(t, false);
        return {
          quemPaga: p.quemPaga,
          ivaIncluido: t.modelo === "iva_incluido",
          valorAPedir: p.valor,
          valorAPedirComFactura: quantoSePedeNesteTrabalho(t, true).valor,
          telefoneSugerido:
            p.quemPaga === "profissional" ? t.telefoneDoProfissional : t.telefoneDoCliente,
        };
      })(),
    });
  } catch (e) {
    console.error("[admin/pagamentos/criar GET]", e);
    const porque = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Não foi possível ler os pagamentos deste pedido.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}

function metodoValido(v: unknown): MetodoDePagamento | null {
  return typeof v === "string" && (METODOS as string[]).includes(v)
    ? (v as MetodoDePagamento)
    : null;
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

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
    // Ao contrário do ecrã do cliente, aqui diz-se o que falta: quem lê é
    // quem pode ir pôr a variável.
    return NextResponse.json({ error: conf.falta }, { status: 503 });
  }
  const porta = podeCobrarPeloBackoffice(conf.config);
  if (!porta.pode) return NextResponse.json({ error: porta.porque }, { status: 503 });

  const acesso = await trabalhoVistoPeloBackoffice(Number(corpo.negociacaoId));
  if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.estado });
  const t = acesso.trabalho;

  /*
   * QUANTO, E A QUEM — numa função só (`quantoSePedeNesteTrabalho`).
   *
   * EM DINHEIRO COBRA-SE SÓ A PARTE DA CLYON — 21-09-2026. O serviço já foi
   * pago ao profissional, em mão. Gerar aqui o `semIva` inteiro era pedir
   * 126,00 € a quem acabou de dar 120,00 € em notas.
   *
   * E COM IVA INCLUÍDO (01-10-2026) quem paga é o PROFISSIONAL: o cliente
   * deu-lhe o preço inteiro, com IVA, e ele deve à CLYON o IVA e a comissão.
   * Há factura em todas as vendas — o `comFactura` grava-se ligado.
   */
  const comFactura = t.modelo === "iva_incluido" || corpo.comFactura === true;
  const { valor, quemPaga } = quantoSePedeNesteTrabalho(t, comFactura);
  const doProfissional = quemPaga === "profissional";
  // A dívida do profissional só nasce com o trabalho feito: antes disso o
  // cliente ainda não lhe pagou nada (ver `cobrar-divida-do-profissional.ts`).
  if (doProfissional && !t.libertado) {
    return NextResponse.json(
      { error: "O trabalho ainda não foi confirmado — o profissional ainda não deve nada à CLYON." },
      { status: 409 },
    );
  }
  const recusa = porqueNaoPodeCobrar(metodo, valor);
  if (recusa) return NextResponse.json({ error: recusa }, { status: 400 });

  const telemovel =
    metodo === "mbway"
      ? (typeof corpo.telemovel === "string" ? corpo.telemovel.trim() : "") ||
        (doProfissional ? t.telefoneDoProfissional : t.telefoneDoCliente)
      : null;

  try {
    const jaHa = await pagamentosDaNegociacao(t.negociacaoId);

    /*
     * JÁ ESTÁ PAGO. A garantia é o índice único da base; isto é a cortesia de
     * não deixar alguém gerar uma segunda referência para um trabalho pago e
     * mandá-la ao cliente sem reparar.
     */
    const pago = jaHa.find((l) => l.estado === "pago");
    if (pago) {
      return NextResponse.json(
        { error: `Este trabalho já foi pago em ${pago.metodo === "mbway" ? "MB WAY" : "Multibanco"}.` },
        { status: 409 },
      );
    }

    /*
     * UMA REFERÊNCIA MULTIBANCO VIVA CHEGA — não se emite outra.
     *
     * A que já foi mandada ao cliente continua válida no homebanking dele.
     * Emitir uma segunda para o mesmo trabalho é a forma mais directa de ele
     * pagar as duas, e nenhum banco lhe diz que já pagou a outra.
     *
     * O MB WAY é o contrário: são cinco minutos, e quem carrega outra vez é
     * quem fechou a notificação sem querer. Pede-se outro e fecha-se o
     * anterior.
     */
    const aberto = jaHa.find(
      (l) =>
        l.estado === "pendente" &&
        l.metodo === metodo &&
        l.valor === valor &&
        l.comFactura === comFactura,
    );
    if (aberto && metodo === "multibanco") {
      const vivo = !aberto.expiraEm || aberto.expiraEm.getTime() > Date.now();
      if (vivo) {
        return NextResponse.json({
          reaproveitada: true,
          pagamento: paraOEcra(aberto, t, comFactura),
        });
      }
    }
    for (const l of jaHa) {
      if (l.estado === "pendente" && l.metodo === "mbway" && metodo === "mbway") {
        await fecharSemPagar(l.id, "cancelado", { motivo: "Pedido outro MB WAY pelo backoffice." });
      }
    }

    const agora = Date.now();
    const expiraEm =
      metodo === "mbway"
        ? new Date(agora + MINUTOS_DO_MBWAY * 60_000)
        : new Date(agora + DIAS_DE_PRAZO_DA_REFERENCIA * 86_400_000);

    const pagamentoId = await abrirPagamento({
      negociacaoId: t.negociacaoId,
      pedidoId: t.pedidoId,
      providerId: t.providerId,
      metodo,
      ambiente: conf.config.ambiente,
      valor,
      comFactura,
      telemovel,
      expiraEm,
    });

    const r = await pedirPagamento(conf.config, metodo, {
      pagamentoId,
      valor,
      telemovel,
      prazo: metodo === "multibanco" ? expiraEm : null,
    });

    if (!r.ok) {
      await marcarFalhado(pagamentoId, r.recusa.paraNos);
      await registarSemFalhar({
        acontecimento: "pagamento_falhado",
        pedidoId: t.pedidoId,
        negociacaoId: t.negociacaoId,
        providerId: t.providerId,
        autorTipo: "clyon",
        autorNome: colab?.nome ?? "a CLYON",
        resumo: `${NOME_DO_METODO[metodo]} recusado: ${r.recusa.paraNos}`,
        detalhe: { pagamentoId, metodo, valor, codigo: r.recusa.codigo },
      });
      /*
       * Aqui vai a versão PARA NÓS, e não a do cliente. Quem lê isto é quem
       * pode resolver — e «não foi possível, tente outra vez» não diz a
       * ninguém que a chave é do ambiente errado.
       */
      return NextResponse.json({ error: r.recusa.paraNos }, { status: 502 });
    }

    await marcarPedido(pagamentoId, {
      referencia: r.referencia,
      entidade: r.entidade,
      transacaoId: r.trid,
    });

    await registarSemFalhar({
      acontecimento: "pagamento_pedido",
      pedidoId: t.pedidoId,
      negociacaoId: t.negociacaoId,
      providerId: t.providerId,
      autorTipo: "clyon",
      autorNome: colab?.nome ?? "a CLYON",
      resumo:
        doProfissional
          ? `${NOME_DO_METODO[metodo]}: gerados ${valor.toFixed(2).replace(".", ",")} € de IVA e ` +
            `comissão, a pagar pelo profissional (trabalho pago em dinheiro). Ainda não está pago.`
          : `${NOME_DO_METODO[metodo]}: gerados ${valor.toFixed(2).replace(".", ",")} € ` +
            `${comFactura ? "com" : "sem"} factura, para enviar ao cliente. Ainda não está pago.`,
      detalhe: { pagamentoId, metodo, valor, ambiente: conf.config.ambiente },
    });

    const linha = (await pagamentosDaNegociacao(t.negociacaoId)).find((l) => l.id === pagamentoId);
    return NextResponse.json({
      pagamento: linha
        ? paraOEcra(linha, t, comFactura)
        : {
            id: pagamentoId,
            metodo,
            estado: "pendente",
            valor,
            comFactura,
            entidade: r.entidade,
            referencia: r.referencia,
            expiraEm,
            telemovel,
            mensagem: mensagemDaReferencia({
              pedidoId: t.pedidoId,
              metodo,
              valor,
              entidade: r.entidade,
              referencia: r.referencia,
              telemovel,
              expiraEm,
              cliente: doProfissional ? t.profissionalNome : t.nomeDoCliente,
              comFactura,
              paraOProfissional: doProfissional,
            }),
          },
    });
  } catch (e) {
    console.error("[admin/pagamentos/criar]", e);
    const porque = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Não foi possível gerar a referência.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}

/**
 * A linha da base mais a mensagem já escrita.
 *
 * A mensagem constrói-se AQUI, no servidor, e não no ecrã: é ela que o cliente
 * vai ler, e leva lá dentro o valor. Uma segunda versão montada no navegador
 * era uma segunda verdade sobre quanto se está a cobrar.
 */
function paraOEcra(
  p: Awaited<ReturnType<typeof pagamentosDaNegociacao>>[number],
  t: Parameters<typeof quantoSePedeNesteTrabalho>[0] & {
    pedidoId: number;
    nomeDoCliente: string | null;
    profissionalNome: string;
  },
  comFactura: boolean,
) {
  // A mensagem fala com quem paga: o profissional, na dívida do dinheiro.
  const doProfissional = quantoSePedeNesteTrabalho(t, comFactura).quemPaga === "profissional";
  return {
    id: p.id,
    metodo: p.metodo,
    estado: p.estado,
    valor: p.valor,
    comFactura: p.comFactura,
    entidade: p.entidade,
    referencia: p.referencia,
    telemovel: p.telemovel,
    expiraEm: p.expiraEm,
    // Quando entrou, e quanto entrou mesmo — o que o euPago confirmou, não o
    // que nós pedimos. Se divergirem, é isso que se quer ver.
    pagoEm: p.pagoEm,
    valorPago: p.valorPago,
    criadoEm: p.criadoEm,
    mensagem: mensagemDaReferencia({
      pedidoId: t.pedidoId,
      metodo: p.metodo,
      valor: p.valor,
      entidade: p.entidade,
      referencia: p.referencia,
      telemovel: p.telemovel,
      expiraEm: p.expiraEm,
      cliente: doProfissional ? t.profissionalNome : t.nomeDoCliente,
      comFactura,
      paraOProfissional: doProfissional,
    }),
  };
}
