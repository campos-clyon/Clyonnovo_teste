import {
  assistentePode,
  getSimulatorOrderById,
  negociacoesDoPedido,
  perfilDoProfissional,
} from "./db";
import { avisarQueFoiContratado } from "./email-trabalho";
import { avisarProfissionalContratadoPorPush } from "./avisar-por-push";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "./taxas-plataforma";
import { tService } from "./translations";
import { enviarAvisoWhatsApp, telemovelParaWhatsApp } from "./whatsapp-cloud";
import { avisoDeEscolhaAoProfissional } from "./aviso-de-oferta-clyon";

/**
 * O TRABALHO CLYON FICOU DELE — dizê-lo como se diz a quem é contratado.
 *
 * O mesmo email e o mesmo aviso no telemóvel de quando um cliente contrata
 * (`avisarQueFoiContratado`): agora pode sair a morada e o contacto, e a frase
 * do dinheiro é a da plataforma — recebe da CLYON depois de confirmado.
 *
 * E UM WHATSAPP, quando foi a CLYON a escolher: ele aceitou há horas, talvez
 * dias, e não está a olhar para o ecrã. Vai pelo interruptor «Avisar o
 * profissional» e chega a todos, como o aviso da data — é o trabalho dele, e
 * não uma oferta nova. Numa oferta directa não há WhatsApp: quem aceitou
 * acabou de carregar no botão.
 *
 * NUNCA LANÇA. O trabalho já está atribuído quando isto corre.
 */
export async function avisarProfissionalEscolhido(a: {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  baseUrl: string;
  whatsapp?: boolean;
}): Promise<{ saiu: boolean; profissional: string; valor: number | null }> {
  try {
    const [perfil, pedido, negociacoes] = await Promise.all([
      perfilDoProfissional(a.providerId),
      getSimulatorOrderById(a.pedidoId),
      negociacoesDoPedido(a.pedidoId),
    ]);
    const linha = negociacoes.find((n) => Number(n.id) === a.negociacaoId);
    const valor =
      linha?.valorAcordado != null
        ? quantoOProfissionalRecebe(Number(linha.valorAcordado), taxasDaNegociacao(linha))
        : null;
    const nome = String(perfil?.name ?? linha?.profissionalNome ?? "");
    const email = typeof perfil?.email === "string" ? perfil.email : null;

    let saiu = false;
    if (email) {
      saiu = await avisarQueFoiContratado({
        paraEmail: email,
        paraNome: nome,
        pedidoId: a.pedidoId,
        serviceType: pedido?.serviceType ?? null,
        morada: pedido?.address ?? null,
        contactoNome: pedido?.contactName ?? null,
        contactoTelefone: pedido?.contactPhone ?? null,
        recebeLiquido: valor,
        formaDePagamento: linha?.formaDePagamento ?? null,
        criadaEm: linha?.createdAt ?? null,
        dividaEmDinheiro: null,
        baseUrl: a.baseUrl,
      });
      await avisarProfissionalContratadoPorPush({
        email,
        servico: tService(pedido?.serviceType) || "Trabalho",
        valorQueRecebe: valor ?? 0,
        pedidoId: a.pedidoId,
      });
    }

    if (a.whatsapp !== false && valor != null) {
      const telefone = telemovelParaWhatsApp(linha?.profissionalTelefone ?? null);
      if (telefone && (await assistentePode("avisar_profissional").catch(() => false))) {
        await enviarAvisoWhatsApp(
          telefone,
          avisoDeEscolhaAoProfissional(
            nome,
            {
              pedidoId: a.pedidoId,
              servico: pedido?.serviceType ?? null,
              localidade: pedido?.city ?? null,
              valor,
              link: `${a.baseUrl}/profissionais/painel`,
            },
            new Date(),
          ),
        ).catch(() => false);
      }
    }

    return { saiu, profissional: nome, valor };
  } catch (e) {
    console.error("[avisar-escolhido-da-oferta]", e);
    return { saiu: false, profissional: "", valor: null };
  }
}
