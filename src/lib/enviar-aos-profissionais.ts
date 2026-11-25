import { lerBase } from "@/lib/base-do-preco";
import { avisarCliente } from "@/lib/avisos-do-backoffice";
import { lerForma } from "@/lib/forma-de-pagamento";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import { getSimulatorOrderById, promoverPedidoAPlataforma, appendOrderHistory } from "@/lib/db";
import { distribuirPedido, resumoDaDistribuicao, type ResultadoDaDistribuicao } from "@/lib/distribuir-pedido";
import { negociacoesDoPedido } from "@/lib/db";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { enviarLinkDoPedido } from "@/lib/email-pedido";
import { validarValorDesejado } from "@/lib/pedido-valores";
import { coordenadasDoPedido } from "@/lib/coordenadas-do-pedido";
import { pedidoArrumado, PEDIDO_ARRUMADO_NAO_SE_ENVIA } from "@/lib/pedido-arrumado";
import { getActivePricingMap } from "@/lib/pricing-helper";
import type { PapelDoPainel } from "@/lib/papel-do-painel";
import {
  parametrosDoMapa,
  pedidoParaSugestaoDaLinha,
  sugerirParaOProfissional,
} from "@/lib/sugestao-para-o-profissional";

/**
 * ENVIAR UM PEDIDO AOS PROFISSIONAIS — o «Enviar aos profissionais» da Mesa.
 *
 * Era o corpo da rota `POST /api/admin/negociacoes/promover`, e passou para
 * aqui tal e qual a 22-11-2026 (decisão d87): o envio automático dos pedidos
 * que a Vitória deixa completos usa ESTA função, e não outra. A rota da Mesa
 * só lê o pedido HTTP e chama-a; o envio automático chama-a com `pelaVitoria`.
 * Uma distribuição só, com as mesmas guardas, o mesmo valor de partida, o mesmo
 * email do link ao cliente, os mesmos avisos aos parceiros (email, telemóvel,
 * WhatsApp pela fila) e o mesmo registo no histórico.
 *
 * Passar um pedido do simulador para a plataforma.
 *
 * O formulário público recolhe um pedido de orçamento: tem estimativa, não tem
 * valor pedido pelo cliente, e nunca foi distribuído a ninguém. Um profissional
 * não o vê, e não o poderia negociar mesmo que o visse — não há valor de
 * partida nem forma de o cliente responder.
 *
 * Promover resolve as três coisas de uma vez: fixa o valor de partida, emite o
 * link de acesso do cliente e distribui aos profissionais elegíveis.
 *
 * O VALOR DE PARTIDA É A CONTA DA CLYON, E NÃO UM NÚMERO ESCRITO À MÃO.
 *
 * Havia uma caixa na mesa para escrever o valor, e sem nada escrito valia a
 * estimativa — que está gravada COM IVA, num sítio onde tudo é sem IVA. Ele
 * pediu para a CLYON dar uma sugestão em vez de um valor a aceitar, e disse
 * que sim a usar a mesma conta aqui (09-09-2026): custos com os quilómetros
 * da base da CLYON, pessoal, fixos e a margem, sem IVA — a mesma fórmula que
 * cada profissional vê no link, só que com os quilómetros dele.
 *
 * É uma acção de uma pessoa, pedido a pedido — com UMA excepção desde
 * 22-11-2026 (d87, CEO e dono): o pedido que a Vitória deixa completo pelo
 * WhatsApp, com todas as condições de `envio-automatico-aos-parceiros.ts`,
 * segue sozinho. E desde 23-11-2026 (d88) todo o pedido completo dos «Orçamentos
 * novos», de qualquer origem, pela rotina de 15 em 15 minutos — com as mesmas
 * condições e as que o deixam sempre com uma pessoa. O valor de partida é o do
 * botão «Negociação» da Mesa com a caixa vazia: a conta da CLYON.
 */

export type ResultadoDoEnvioAosProfissionais =
  | { ok: false; status: number; error: string }
  | ({
      ok: true;
      chegouAAlguem: boolean;
      valor: number;
      emailSaiu: boolean;
      link: string | null;
    } & ResultadoDaDistribuicao);

export async function enviarAosProfissionais(
  pedidoId: number,
  {
    valor: valorEscrito,
    soPara,
    baseUrl,
    colab,
    pelaVitoria = false,
    automaticamente = false,
  }: {
    /** O valor escrito na caixa da Mesa (vazio = a conta da CLYON). */
    valor?: unknown;
    /** Escolhidos à mão (29-09-2026). Sem lista, é a regra que decide. */
    soPara?: number[];
    /** O endereço para os links dos emails. */
    baseUrl: string;
    /** Quem carregou no botão — um assistente fica com o pedido sem responsável. */
    colab?: { id: number; nome: string; papel: PapelDoPainel } | null;
    /** O envio automático da d87: o histórico diz que foi a Vitória, sozinha. */
    pelaVitoria?: boolean;
    /** O envio automático da d88 (os «Orçamentos novos» de todas as origens): o histórico diz que foi sozinho. */
    automaticamente?: boolean;
  },
): Promise<ResultadoDoEnvioAosProfissionais> {
  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return { ok: false, status: 404, error: "Pedido não encontrado." };
  /*
   * UM PEDIDO CANCELADO FICA CANCELADO — 10-11-2026 (d27). A lista do «Por
   * enviar» já não os mostra, mas a rota não lia o estado: um ecrã aberto
   * antes do cancelamento (ou um segundo separador) ainda o enviava aos
   * parceiros, com email ao cliente. Recusa-se antes de qualquer escrita —
   * por isso o «assumir» passou para depois desta leitura.
   */
  if (pedidoArrumado(pedido.status)) {
    return { ok: false, status: 409, error: PEDIDO_ARRUMADO_NAO_SE_ENVIA };
  }
  /*
   * FORA DA ZONA NÃO VAI AOS PARCEIROS — d128 (25-11-2026). A morada (ou a
   * origem da mudança) acima do limite das Configs: uma pessoa confirma-a com
   * o cliente primeiro. Corrigida para dentro, a marca sai e o pedido segue.
   */
  {
    const { foraDaZonaDoPedido } = await import("./fora-da-zona-na-base");
    const fora = await foraDaZonaDoPedido(pedido);
    if (fora) {
      const { recusaForaDaZona } = await import("./fora-da-zona");
      return { ok: false, status: 409, error: recusaForaDaZona(fora) };
    }
  }
  // Um assistente que envia um pedido sem responsável aos profissionais fica com ele.
  await assumirPedidoSeLivre(pedidoId, colab);
  /*
   * Está na plataforma quem CHEGOU a alguém, não quem tem um número.
   *
   * Esta guarda olhava para `valorDesejadoCliente != null`. A lista ao lado
   * usa outro critério — não ter negociações — e as duas discordavam:
   *
   *   1. o admin carrega em "Enviar aos profissionais";
   *   2. o valor fica gravado, mas a distribuição não chega a ninguém;
   *   3. o pedido continua na lista, porque continua sem negociações;
   *   4. carregar outra vez responde "Este pedido já está na plataforma".
   *
   * O pedido ficava preso: visível, por enviar, e impossível de enviar. Foi o
   * que aconteceu ao #202. O critério passa a ser o mesmo dos dois lados.
   */
  /*
   * SÓ AS VIVAS — 20-10-2026. Um Trabalho CLYON que passou a negociação
   * (`prepararAMudancaDeTipo`) fica com as ofertas mortas, e vem para aqui
   * como os outros: a distribuição reabre-as como negociação.
   */
  const jaTemNegociacoes = (await negociacoesDoPedido(pedidoId)).some((n) =>
    ["aberta", "aguarda_contratacao", "acordada"].includes(n.estado),
  );
  if (jaTemNegociacoes) {
    return { ok: false, status: 409, error: "Este pedido já foi enviado aos profissionais." };
  }

  /*
   * UM TRABALHO CLYON QUE NÃO CHEGOU A NINGUÉM — 06-10-2026.
   *
   * Oferecido a valor fixo sem ninguém a quem chegar, o pedido continua sem
   * negociações e por isso no «Por enviar» — mas já marcado como Trabalho
   * CLYON. Enviá-lo daqui punha-o a negociar com o valor fixo gravado: saía da
   * mesa das Negociações, que não mostra os Trabalhos CLYON, e entrava nos
   * Trabalhos CLYON com negociações que não são ofertas. Oferece-se outra vez,
   * escolhendo a quem.
   */
  if ((pedido as { valorFixoClyon?: unknown }).valorFixoClyon != null) {
    return {
      ok: false,
      status: 409,
      error:
        "Este pedido já é um Trabalho CLYON de valor fixo. Ofereça-o outra vez em «Trabalho CLYON», escolhendo a quem.",
    };
  }

  /*
   * A conta da CLYON, com os quilómetros da base da CLYON (`distanceKm`).
   *
   * Sem distância a conta sai sem combustível — e aí vale mais a estimativa
   * gravada, tirando-lhe o IVA que ela traz dentro, do que uma conta que não
   * contou a viagem.
   *
   * QUEM ESTÁ NA MESA PODE PASSAR À FRENTE DELA, e isso voltou a pedido do
   * dono (10-09-2026). Houve um tempo em que o valor escrito era ignorado, e
   * a razão era boa: um número inventado à mão valia para todos os
   * profissionais, viessem de Amora ou de Setúbal. Mas há um caso que a conta
   * não conhece — o que já foi combinado ao telefone. Nesse, quem atendeu
   * sabe mais do que a fórmula.
   *
   * A regra fica simples de dizer: caixa vazia, manda a conta da CLYON;
   * caixa preenchida, manda o que lá está. E o que cada profissional vê
   * continua a ser a conta feita com os custos e os quilómetros DELE — este
   * valor é só o ponto de partida da mesa.
   */
  const escrito =
    valorEscrito !== undefined && valorEscrito !== null && valorEscrito !== ""
      ? validarValorDesejado(valorEscrito)
      : null;
  if (escrito && !escrito.ok) {
    return { ok: false, status: 400, error: escrito.erros[0].mensagem };
  }
  const mapa = await getActivePricingMap();
  const distanciaDaClyon = Number(pedido.distanceKm);
  const conta = sugerirParaOProfissional(
    pedidoParaSugestaoDaLinha(pedido as unknown as Record<string, unknown>),
    Number.isFinite(distanciaDaClyon) && distanciaDaClyon > 0 ? distanciaDaClyon : null,
    parametrosDoMapa(mapa),
  );
  const estimativaGravada = Number(pedido.estimateTotal ?? pedido.estimateMax);
  const estimativaSemIva =
    Number.isFinite(estimativaGravada) && estimativaGravada > 0
      ? Math.round((estimativaGravada / 1.23) * 100) / 100
      : null;
  const daConta = conta.semDistancia && estimativaSemIva != null ? estimativaSemIva : conta.precoSugerido;
  const bruto = escrito?.ok ? escrito.valores.valorDesejadoCliente : daConta;

  const validacao = validarValorDesejado(bruto);
  if (!validacao.ok) {
    return { ok: false, status: 400, error: `Sem valor de partida: ${validacao.erros[0].mensagem}` };
  }
  const valor = validacao.valores.valorDesejadoCliente;

  // As coordenadas do trabalho vivem no JSON do formulário, não em colunas.
  /*
   * As coordenadas, indo buscá-las se ainda não existirem.
   *
   * Era uma leitura crua do rawOrderJson: se lá não estivessem, seguia com
   * nulos e a regra caía na lista de zonas de cada profissional. O #205 —
   * uma recolha na Avenida Mouzinho de Albuquerque, em Lisboa — foi enviado
   * três vezes e as três não chegaram a ninguém, comparado contra "palmela,
   * montijo, seixal, amora, setubal", quando a 35 km havia um profissional
   * com raio de 125 km.
   *
   * Geocodificar só na criação não chegava: há mais de cem pedidos na base
   * criados antes disso, e esses não voltam a ser criados. Agora a busca
   * acontece aqui, e o resultado fica gravado — da segunda vez já não há
   * chamada nenhuma ao Google.
   */
  const geo = await coordenadasDoPedido(pedido);
  const lat = geo.lat;
  const lng = geo.lng;
  let fotos = 0;
  try {
    const cru = JSON.parse(pedido.rawOrderJson ?? "{}");
    fotos = Array.isArray(cru?.files) ? cru.files.length : 0;
  } catch {
    /* sem fotos */
  }

  try {
    const acesso = gerarTokenDeAcesso();
    const promovido = await promoverPedidoAPlataforma(
      pedidoId,
      valor,
      acesso.hash,
      acesso.expiraEm,
    );
    if (!promovido) {
      return { ok: false, status: 409, error: "Este pedido já tinha sido promovido." };
    }

    // O link primeiro: sem ele o cliente recebe propostas e não tem onde
    // responder, e a negociação morre ao fim das 48 horas sem ninguém saber
    // porquê. Se o email falhar, o token fica na resposta para envio à mão.
    const emailSaiu = await enviarLinkDoPedido({
      para: pedido.contactEmail ?? "",
      nomeDoCliente: pedido.contactName ?? null,
      pedidoId,
      serviceType: pedido.serviceType ?? null,
      token: acesso.token,
      /*
       * AQUI NÃO VAI NÚMERO NENHUM.
       *
       * O email diz «Disse que quer pagar a partir de X». Neste caminho o X
       * nunca é dele: ou é o que o assistente escreveu, ou é a conta da
       * CLYON. Punha na boca do cliente um número nosso, em todos os emails
       * de promoção — que é justamente o caminho por onde a negociação
       * começa a sério.
       */
      valorDesejadoCliente: null,
      baseUrl,
    });
    // S19 (BO8): na app, o pedido foi aos profissionais.
    await avisarCliente(pedidoId, "enviado");

    const r = await distribuirPedido({
      id: pedidoId,
      serviceType: pedido.serviceType ?? null,
      description: pedido.description ?? null,
      city: pedido.city ?? null,
      urgency: pedido.urgency ?? null,
      quantidadeDeFotos: fotos,
      valorDesejadoCliente: valor,
      precisaFatura: Boolean(pedido.precisaFatura),
      precisaGuiaTransporte: Boolean(pedido.precisaGuiaTransporte),
      baseDoPreco: lerBase(pedido.baseDoPreco),
      formaDePagamento: lerForma(pedido.formaDePagamento),
      lat,
      lng,
      baseUrl,
    }, { soPara });

    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message:
        // Pela Vitória (d87): a primeira frase diz que foi sozinho, e a quantos.
        (pelaVitoria && r.receberam > 0
          ? `Enviado aos parceiros automaticamente (${r.receberam} ${r.receberam === 1 ? "parceiro" : "parceiros"}) — pela Vitória. `
          : automaticamente && r.receberam > 0
            ? `Enviado aos parceiros automaticamente (${r.receberam} ${r.receberam === 1 ? "parceiro" : "parceiros"}). `
            : "") +
        // Fica escrito DE ONDE veio o número: quem ler isto daqui a um mês
        // tem de saber se foi a fórmula ou se foi alguém que escreveu.
        `Promovido a pedido de plataforma por ${valor} € ` +
        (escrito?.ok
          ? `(escrito na mesa; a conta CLYON dava ${daConta} €). `
          : "(conta CLYON: " +
            (conta.semDistancia
              ? "estimativa sem IVA, sem distância da base"
              : `${conta.kmDeCarro} km ida e volta, ${conta.horas} h, margem ${Math.round(conta.margem * 100)} %`) +
            "). ") +
        (soPara ? `Enviado só a ${soPara.length} profissional(is) escolhido(s) à mão. ` : "") +
        resumoDaDistribuicao(r) +
        (emailSaiu ? "" : " O email da ligação ao cliente NÃO saiu."),
    });

    /*
     * Zero profissionais não é sucesso.
     *
     * O ecrã mostrava "enviado" e a lista mantinha o pedido lá — sem dizer
     * porquê. Quem estava do outro lado concluía que o botão não fazia nada.
     * Os motivos já eram contados pela regra; faltava alguém mostrá-los.
     */
    return {
      ok: true,
      chegouAAlguem: r.receberam > 0,
      valor,
      emailSaiu,
      ...r,
      link: emailSaiu ? null : `${baseUrl}/pedido/${acesso.token}`,
    };
  } catch (error) {
    console.error("[enviarAosProfissionais]", error);
    return { ok: false, status: 500, error: "Não foi possível promover" };
  }
}
