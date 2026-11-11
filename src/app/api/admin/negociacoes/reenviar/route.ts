import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  getSimulatorOrderById,
  negociacoesDoPedido,
  substituirTokenDoPedido,
  substituirTokenDaNegociacao,
  appendOrderHistory,
  getPool,
  assistentePode,
  reporAvisoAoProfissional,
  tarifaCongeladaDaNegociacao,
} from "@/lib/db";
import { telemovelParaWhatsApp } from "@/lib/whatsapp-cloud";
import { avisoDePedidoAoProfissional } from "@/lib/aviso-de-pedido-ao-profissional";
import { lerBase } from "@/lib/base-do-preco";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { horaCongeladaEmEuros } from "@/lib/mudanca-escolhida-pelo-cliente";
import { enviarLinkDoPedido } from "@/lib/email-pedido";
import { avisarProfissional } from "@/lib/email-profissional";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "@/lib/taxas-plataforma";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";

export const runtime = "nodejs";

/**
 * Reenviar um link de acesso.
 *
 * Guardamos só o hash do token, e por isso não há como reenviar o mesmo link:
 * emite-se um novo, que invalida o anterior. Isso é uma vantagem além do
 * óbvio — serve para revogar um link que tenha sido reencaminhado por engano.
 *
 * Existe porque sem ele um email que caia no spam deixava a pessoa sem acesso
 * ao próprio pedido, para sempre. Era uma falha do desenho e não um caso raro.
 *
 * A resposta devolve o link em claro quando o email não chega a sair. Isso é
 * deliberado e limitado a esta rota, que exige sessão de administrador: em
 * testes, ou com a Resend em baixo, é a única forma de chegar ao token — e a
 * alternativa era não haver forma nenhuma.
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: {
    pedidoId?: unknown;
    negociacaoId?: unknown;
    para?: unknown;
    paraCopiar?: unknown;
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  const acesso = gerarTokenDeAcesso();
  const baseUrl = urlDeAccaoDoPedido(req.headers);

  try {
    // ── O link do cliente ───────────────────────────────────────────────────
    if (corpo.para === "cliente") {
      await substituirTokenDoPedido(pedidoId, acesso.hash, acesso.expiraEm);

      /*
       * SÓ GERAR, PARA ELE MANDAR À MÃO.
       *
       * "Sempre que clico em VER COMO CLIENTE ele abre para mim e deixa o link
       * visível. Eu copio e envio ao cliente, porém já não serve, pois ele
       * abriu para mim automaticamente. Dê-me a opção apenas de gerar link
       * para enviar ao cliente."
       *
       * E havia uma segunda razão, que apanhou a D. Albertina do #234: quando o
       * email SAI, esta rota devolvia `undefined` em vez do token — a ideia
       * era não deixar o link em claro sem necessidade. Só que ela escreveu
       * "não tenho o link no meu email, podem enviar por aqui?", e a resposta
       * do sistema era esconder-lho de quem lho queria mandar.
       *
       * Com `paraCopiar`, o email NÃO sai e o token volta. É um pedido
       * explícito de quem vai mandar a mensagem com as próprias mãos, e
       * mandar o email por cima seria mandar o mesmo link duas vezes por dois
       * caminhos — sendo que só um deles é o que a pessoa pediu.
       */
      const soGerar = corpo.paraCopiar === true;
      if (soGerar) {
        await appendOrderHistory(pedidoId, {
          type: "created",
          by: null,
          message:
            "Link de acesso do cliente gerado para envio à mão (WhatsApp ou SMS). " +
            "O anterior deixou de funcionar.",
        });
        /*
         * `expiraEm` volta com o token, e é a marca de versão dele.
         *
         * O ecrã guarda-a ao lado do texto do link. Quando alguma coisa rodar
         * o token noutro sítio — um aviso de proposta, por exemplo — a data na
         * base passa a ser outra, e a caixa sabe que o que tem na mão morreu.
         */
        return NextResponse.json({
          ok: true,
          enviado: false,
          token: acesso.token,
          expiraEm: acesso.expiraEm,
        });
      }

      const enviado = await enviarLinkDoPedido({
        para: pedido.contactEmail ?? "",
        nomeDoCliente: pedido.contactName ?? null,
        pedidoId,
        serviceType: pedido.serviceType ?? null,
        token: acesso.token,
        baseUrl,
        /*
         * TAMBÉM NÃO — e aqui por uma razão diferente: já não se sabe.
         *
         * A coluna `valorDesejadoCliente` guarda três coisas indistinguíveis:
         * o que o cliente escreveu, a nossa estimativa, e a conta da CLYON de
         * uma promoção. Quem reenvia o link não tem como saber qual delas
         * tem à frente, e a frase «Disse que quer pagar a partir de X» só é
         * verdade numa das três.
         *
         * Entre calar um número que era dele e afirmar-lhe um que não era,
         * cala-se. Ver a mesma decisão em `promover`.
         */
        valorDesejadoCliente: null,
      });

      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message: enviado
          ? "Link de acesso do cliente reenviado. O anterior deixou de funcionar."
          : "Link de acesso do cliente regenerado, mas o email NÃO saiu.",
      });

      return NextResponse.json({
        ok: true,
        enviado,
        token: enviado ? undefined : acesso.token,
        expiraEm: acesso.expiraEm,
      });
    }

    // ── O link de um profissional ───────────────────────────────────────────
    const negociacaoId = Number(corpo.negociacaoId);
    const negociacoes = await negociacoesDoPedido(pedidoId);
    const alvo = negociacoes.find((n) => n.id === negociacaoId);
    if (!alvo) {
      return NextResponse.json({ error: "Negociação não encontrada" }, { status: 404 });
    }

    await substituirTokenDaNegociacao(alvo.id, acesso.hash, acesso.expiraEm);

    const pool = await getPool();
    const [linhas] = pool
      ? ((await pool.execute("SELECT name, email, phone, whatsappAvisos FROM providers WHERE id = ? LIMIT 1", [
          alvo.providerId,
        ])) as any[])
      : [[]];
    const profissional = (
      linhas as Array<{ name: string; email: string | null; phone: string | null; whatsappAvisos: number | null }>
    )[0];

    /*
     * NUMA MUDANÇA ESCOLHIDA PELO CLIENTE, A HORA DELE — d7, 11-11-2026. O
     * primeiro aviso disse-lhe a hora da tarifa congelada (distribuir-pedido.ts);
     * o reenvio dizia o valor de partida do pedido, que nessa negociação não é
     * o preço de nada. Lê-se a tarifa congelada desta negociação; se a leitura
     * falhar, não se diz valor nenhum (o link leva-o ao pedido).
     */
    let horaCongelada: number | null = null;
    let eDaLista = false;
    try {
      const congelada = await tarifaCongeladaDaNegociacao(alvo.id, alvo.providerId);
      eDaLista = congelada != null;
      horaCongelada = horaCongeladaEmEuros(congelada?.tarifaCongeladaJson, congelada?.pessoasEscolhidas);
    } catch (e) {
      console.error("[reenviar] não li a tarifa congelada da negociação", alvo.id, e instanceof Error ? e.message : e);
      eDaLista = true;
    }
    const minimo = eDaLista
      ? horaCongelada
      : pedido.valorDesejadoCliente != null
        ? Number(pedido.valorDesejadoCliente)
        : null;

    const enviado = await avisarProfissional({
      paraEmail: profissional?.email ?? "",
      paraNome: profissional?.name ?? "",
      pedidoId,
      token: acesso.token,
      baseUrl,
      serviceType: pedido.serviceType ?? null,
      zona: pedido.city ?? null,
      urgencia: pedido.urgency ?? null,
      descricao: pedido.description ?? null,
      quantidadeDeFotos: 0,
      valorDesejadoCliente: minimo,
      // Com as taxas DESTA negociação: com a comissão mudada no backoffice, as
      // de origem prometiam-lhe por email um líquido que não é o dele.
      recebeLiquido: minimo != null ? quantoOProfissionalRecebe(minimo, taxasDaNegociacao(alvo)) : null,
      distanciaKm: null,
      // Sem a factura: desde 22-09-2026 é da parceira, não do profissional.
      precisaGuiaTransporte: Boolean(pedido.precisaGuiaTransporte),
    });

    /*
     * E NO WHATSAPP — 10-11-2026. *«Os profissionais pedem trabalho»* e os
     * pedidos tinham 0 propostas: o aviso «Pedido novo» só nasce na
     * distribuição, e com o interruptor desligado nesse momento nunca nasceu
     * (e um aviso caduca em 24 h). Reenviar ao profissional repõe também o
     * aviso no WhatsApp, com o link novo — com as mesmas fechaduras da
     * distribuição: o interruptor «Avisar o profissional», a vontade dele e um
     * telemóvel. Só numa negociação ainda aberta.
     */
    let porWhatsApp = false;
    const telemovel =
      Number(profissional?.whatsappAvisos) === 1 ? telemovelParaWhatsApp(profissional?.phone ?? null) : null;
    if (
      alvo.estado === "aberta" &&
      telemovel &&
      (await assistentePode("avisar_profissional").catch(() => false))
    ) {
      porWhatsApp = await reporAvisoAoProfissional({
        pedidoId,
        providerId: alvo.providerId,
        telefone: telemovel,
        texto: avisoDePedidoAoProfissional(
          profissional?.name ?? null,
          {
            pedidoId,
            localidade: pedido.city ?? null,
            servico: pedido.serviceType ?? null,
            descricao: pedido.description ?? null,
            urgencia: pedido.urgency ?? null,
            valorDesejadoCliente: minimo,
            baseDoPreco: lerBase(pedido.baseDoPreco),
            taxas: taxasDaNegociacao(alvo),
            distanciaKm: null,
            link: `${baseUrl}/profissionais/pedidos/${acesso.token}`,
          },
          new Date(),
        ),
      });
    }

    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message: enviado
        ? `Link reenviado ao profissional #${alvo.providerId}${porWhatsApp ? " (email e WhatsApp)" : ""}. O anterior deixou de funcionar.`
        : `Link do profissional #${alvo.providerId} regenerado, mas o email NÃO saiu.`,
    });

    return NextResponse.json({ ok: true, enviado, porWhatsApp, token: enviado ? undefined : acesso.token });
  } catch (error) {
    console.error("[api/admin/negociacoes/reenviar]", error);
    return NextResponse.json({ error: "Não foi possível reenviar" }, { status: 500 });
  }
}
