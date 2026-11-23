import { sendPushToUser } from "./webpush";
import { urlDeAccao } from "./url-do-site";

/**
 * O AVISO AO CLIENTE QUANDO A CLYON CONFIRMA OS DADOS DE PAGAMENTO DO PARCEIRO
 * — d5 (CEO e dono, 21-11-2026). O pedido dizia «avisamo-lo aqui» sem aviso por
 * trás. Ao «Confirmei com o parceiro» (Mesa), o cliente recebe uma frase curta:
 * push na app, senão um email. Nunca o IBAN nem o MB WAY: só diz onde estão.
 */
export const OS_DADOS_JA_ESTAO_NO_PEDIDO = "Os dados de pagamento do parceiro já estão no seu pedido.";

/** O que cada canal diz. Pura. */
export function textoDoAvisoDosDadosConfirmados(pedidoId: number): { titulo: string; corpo: string } {
  return { titulo: "Dados de pagamento confirmados", corpo: `Pedido #${pedidoId}: ${OS_DADOS_JA_ESTAO_NO_PEDIDO}` };
}

/**
 * Push na app de cliente; sem notificação entregue, email (a partir do mesmo
 * serviço dos outros emails). Nunca lança — a confirmação já está gravada.
 * Devolve por onde saiu.
 */
export async function avisarClienteDosDadosConfirmados(dados: {
  pedidoId: number;
  email: string | null | undefined;
}): Promise<"push" | "email" | "nenhum"> {
  const email = (dados.email ?? "").trim();
  if (!email) return "nenhum";
  const { titulo, corpo } = textoDoAvisoDosDadosConfirmados(dados.pedidoId);
  try {
    const entregues = await sendPushToUser(
      email,
      {
        title: titulo,
        body: corpo,
        url: new URL("/conta", urlDeAccao()).toString(),
        tag: `dados-confirmados-${dados.pedidoId}`,
        pedidoId: dados.pedidoId,
        tipo: "dados_de_pagamento",
      },
      "cliente",
    );
    if (entregues > 0) return "push";
  } catch (err) {
    console.error("[dados-confirmados] o push falhou:", err instanceof Error ? err.message : err);
  }
  try {
    const { enviarEmailDoSeguimento } = await import("./seguimento-da-app-envio");
    const saiu = await enviarEmailDoSeguimento({
      para: email,
      assunto: `Pedido #${dados.pedidoId}: dados de pagamento confirmados`,
      texto: `${OS_DADOS_JA_ESTAO_NO_PEDIDO}\n\nEquipa CLYON`,
    });
    return saiu ? "email" : "nenhum";
  } catch (err) {
    console.error("[dados-confirmados] o email falhou:", err instanceof Error ? err.message : err);
    return "nenhum";
  }
}
