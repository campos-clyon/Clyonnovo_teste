import {
  getSimulatorOrderById,
  negociacoesDoPedido,
  perfilDoProfissional,
  substituirTokenDoPedido,
  substituirTokenDaNegociacao,
  existeContaComEmail,
} from "./db";
import { gerarTokenDeAcesso } from "./pedido-acesso";
import { avisarClienteDaProposta, avisarProfissionalDaProposta } from "./email-proposta";
import { avisarClientePorPush } from "./avisar-por-push";

/**
 * Avisar o outro lado de que há uma proposta à espera.
 *
 * Chamado das três rotas que gravam propostas — o link do email, o painel do
 * profissional e a conta do cliente. Vive aqui e não em cada uma delas porque
 * já são três, e uma regra de aviso escrita três vezes acaba com três
 * comportamentos.
 *
 * NUNCA lança. A proposta já está gravada quando isto corre: um email que
 * falhe não pode transformar-se num erro para quem acabou de propor.
 */

type Lado = "cliente" | "profissional";

export async function avisarDaProposta(dados: {
  pedidoId: number;
  negociacaoId: number;
  /** Quem fez a proposta. Avisa-se o outro. */
  quemPropos: Lado;
  valor: number;
  baseUrl?: string;
}): Promise<void> {
  try {
    const pedido = await getSimulatorOrderById(dados.pedidoId);
    if (!pedido) return;

    const negociacoes = await negociacoesDoPedido(dados.pedidoId);
    const negociacao = negociacoes.find((n) => n.id === dados.negociacaoId);
    if (!negociacao) return;

    if (dados.quemPropos === "profissional") {
      const email = pedido.contactEmail;
      /*
       * SEM EMAIL, A PROPOSTA SEGUE PARA O WHATSAPP — com botões.
       *
       * Até aqui um cliente de telefone não recebia NADA quando um
       * profissional propunha: a proposta ficava no painel à espera de que o
       * Wanderson a escrevesse à mão no WhatsApp pessoal. Com a Cloud API
       * configurada, o site fala com o cliente directamente — fechar,
       * recusar ou contrapropor sem ninguém no meio. Sem configuração, o
       * envio devolve false em silêncio e tudo fica como estava.
       */
      if (!email) {
        if (pedido.contactPhone) {
          const { propostaParaOWhatsApp } = await import("@/lib/whatsapp-negociacao");
          await propostaParaOWhatsApp({
            telefone: pedido.contactPhone,
            pedidoId: dados.pedidoId,
            negociacaoId: dados.negociacaoId,
            profissionalNome: negociacao.profissionalNome,
            valor: dados.valor,
            // O regime de quem factura decide se o total leva IVA por cima.
            regimeIva: negociacao.regimeIva ?? null,
            servico: pedido.serviceType ?? null,
          });
        }
        return;
      }

      /*
       * Quem tem conta vai para /conta e o link que guardou continua válido.
       *
       * Quem não tem precisa de um token, e cada token novo mata o anterior —
       * por isso só se emite quando não há alternativa. Com duas propostas
       * seguidas, rodar sempre matava o link do primeiro aviso antes de a
       * pessoa lhe chegar.
       */
      let token: string;
      if (await existeContaComEmail(email)) {
        // Sem token: o email aponta para a conta. O linkDoPedido exige um, e
        // este valor nunca chega a ser usado nesse caso — mas o tipo pede-o.
        token = "";
      } else {
        const novo = gerarTokenDeAcesso();
        await substituirTokenDoPedido(dados.pedidoId, novo.hash, novo.expiraEm);
        token = novo.token;
      }

      await avisarClienteDaProposta({
        para: email,
        nomeDoCliente: pedido.contactName ?? null,
        pedidoId: dados.pedidoId,
        profissionalNome: negociacao.profissionalNome,
        valor: dados.valor,
        token,
        baseUrl: dados.baseUrl,
      });

      /*
       * E NO TELEMÓVEL, se ele tiver os avisos ligados.
       *
       * Depois do email e não em vez dele: o email é o registo e chega a toda
       * a gente; o push é a velocidade e só chega a quem o pediu. Uma proposta
       * que fica duas horas por ver já não é a primeira — e a primeira ganha
       * quase sempre.
       */
      await avisarClientePorPush({
        email,
        profissionalNome: negociacao.profissionalNome,
        valor: dados.valor,
        pedidoId: dados.pedidoId,
        token: token || null,
      });
      return;
    }

    // ── O cliente propôs: avisar o profissional ──────────────────────────
    const perfil = await perfilDoProfissional(negociacao.providerId);
    const email = typeof perfil?.email === "string" ? perfil.email : null;
    if (!email) return;

    // O token da negociação também só existe em hash. Aqui rodar é barato: o
    // link anterior dele já tinha servido para responder a esta mesma
    // negociação, e o painel continua a abri-la sem token nenhum.
    const novo = gerarTokenDeAcesso();
    await substituirTokenDaNegociacao(dados.negociacaoId, novo.hash, novo.expiraEm);

    await avisarProfissionalDaProposta({
      para: email,
      nomeDoProfissional: String(perfil?.name ?? ""),
      pedidoId: dados.pedidoId,
      valor: dados.valor,
      token: novo.token,
      baseUrl: dados.baseUrl,
    });
  } catch (err) {
    console.error("[avisar-da-proposta] falhou:", err);
  }
}
