import { negociacoesDoPedido, perfilDoProfissional } from "@/lib/db";
import { avisarTrabalhoConfirmado } from "@/lib/email-proposta";
import { taxasDaNegociacao } from "@/lib/taxas-plataforma";
import { destinoDoValorConcluido } from "@/lib/carteira";
import { trabalhosDaCarteira } from "@/lib/carteira-do-profissional";

/**
 * Avisa o profissional de que o trabalho dele foi confirmado.
 *
 * UMA função para os TRÊS caminhos que confirmam — o cliente pelo link, o
 * cliente pela conta, e a CLYON em nome de quem não tem como. Se cada rota
 * montasse o próprio email, o dia em que uma mudasse era o dia em que o
 * profissional passava a ser avisado de maneiras diferentes conforme QUEM
 * confirmou — uma diferença que não lhe diz respeito nenhum.
 *
 * Nunca lança: o aviso é consequência da confirmação, não condição dela. A
 * confirmação já está gravada quando isto corre — um email que falhe não pode
 * desfazê-la, e o dinheiro aparece na carteira na mesma.
 */
export async function avisarProfissionalTrabalhoConfirmado(dados: {
  pedidoId: number;
  negociacaoId: number;
  baseUrl?: string;
}): Promise<void> {
  try {
    const negociacoes = await negociacoesDoPedido(dados.pedidoId);
    const n = negociacoes.find((x) => Number(x.id) === dados.negociacaoId);
    if (!n) return;

    const valor = n.valorAcordado != null ? Number(n.valorAcordado) : null;
    if (valor == null || !Number.isFinite(valor)) return;

    const perfil = await perfilDoProfissional(n.providerId);
    const email = typeof perfil?.email === "string" ? perfil.email : null;
    if (!email) return;

    /*
     * ONDE FICOU O VALOR — perguntado como a carteira pergunta. 29-09-2026.
     *
     * O email dizia sempre «ficaram disponíveis, pode pedir a transferência».
     * O trabalho passa pela MESMA conversão que a carteira usa
     * (`trabalhosDaCarteira`, que só pergunta à base pelos pagamentos quando a
     * carteira também pergunta) e pela mesma regra (`destinoDoValorConcluido`):
     * o email não pode dizer «disponível» de um valor que o painel mostra por
     * cobrar, nem mandar à carteira quem recebeu em notas.
     */
    const [trabalho] = await trabalhosDaCarteira([n]);

    await avisarTrabalhoConfirmado({
      para: email,
      nomeDoProfissional: String(perfil?.name ?? ""),
      pedidoId: dados.pedidoId,
      valorAcordado: valor,
      taxas: taxasDaNegociacao(n),
      destino: destinoDoValorConcluido(trabalho),
      baseUrl: dados.baseUrl,
    });
  } catch (err) {
    console.error("[avisar-confirmacao] falhou:", err);
  }
}
