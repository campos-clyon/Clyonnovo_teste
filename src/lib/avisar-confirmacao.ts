import { negociacoesDoPedido, perfilDoProfissional } from "@/lib/db";
import { avisarTrabalhoConfirmado } from "@/lib/email-proposta";
import { taxasDaNegociacao } from "@/lib/taxas-plataforma";
import { destinoDoValorConcluido } from "@/lib/carteira";
import { trabalhosDaCarteira } from "@/lib/carteira-do-profissional";
import { modeloDaNegociacao } from "@/lib/iva-incluido";
import { dividaDoProfissional, temDividaDoProfissional } from "@/lib/divida-do-profissional";
import { gerarReferenciaDaDivida } from "@/lib/cobrar-divida-do-profissional";

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

    /*
     * EM DINHEIRO COM IVA INCLUÍDO, A CONFIRMAÇÃO É TAMBÉM O NASCIMENTO DA
     * DÍVIDA — 01-10-2026. "Paga essa dívida por referência MB WAY/Multibanco,
     * gerada quando o trabalho em dinheiro é confirmado (pelo cliente ou pelo
     * prazo dos 7 dias)." Os quatro caminhos que confirmam passam todos por
     * aqui, e por isso é aqui que se gera — ANTES do email, para ele a levar.
     *
     * Gera-se mesmo sem email do profissional: a referência fica na carteira
     * dele. Se falhar (euPago em baixo, sem chave), fica registado e ele pode
     * pedi-la na carteira; o backoffice também.
     */
    const modelo = modeloDaNegociacao(n.createdAt);
    const temDivida = temDividaDoProfissional(n.formaDePagamento, modelo);
    const referencia = temDivida
      ? await gerarReferenciaDaDivida(dados.negociacaoId, {
          metodo: "multibanco",
          autor: { tipo: "sistema", nome: "confirmação do trabalho" },
        })
      : null;

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
      divida: temDivida
        ? {
            ...dividaDoProfissional(valor, taxasDaNegociacao(n)),
            referencia:
              referencia?.ok && referencia.pagamento.metodo === "multibanco"
                ? {
                    entidade: referencia.pagamento.entidade,
                    referencia: referencia.pagamento.referencia,
                    expiraEm: referencia.pagamento.expiraEm
                      ? new Date(referencia.pagamento.expiraEm)
                      : null,
                  }
                : null,
          }
        : null,
      baseUrl: dados.baseUrl,
    });
  } catch (err) {
    console.error("[avisar-confirmacao] falhou:", err);
  }
}
