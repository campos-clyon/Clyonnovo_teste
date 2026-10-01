import { negociacoesPagas } from "./pagamentos-na-base";
import { verificaOPagamento, type TrabalhoNaCarteira } from "./carteira";
import { modeloDaNegociacao } from "./iva-incluido";
import { temDividaDoProfissional } from "./divida-do-profissional";

/**
 * QUAIS DESTES O CLIENTE JÁ PAGOU — perguntado só pelos que a carteira verifica.
 *
 * Até 01-10-2026 era «tudo ou nada» com `A_PLATAFORMA_COBRA`. Desde a decisão
 * do dono desse dia (*«Ligar, só para trabalhos novos»*) pergunta-se pelos
 * trabalhos em que `verificaOPagamento` diz que sim: com o interruptor
 * desligado, os das negociações abertas a partir de `VERIFICAR_PAGAMENTO_DESDE`.
 * Nenhum desses, nenhuma viagem ao MySQL.
 *
 * Exportada porque a lista dos trabalhos do profissional (`meus-pedidos`) e o
 * livro da carteira (db.ts) fazem a mesma pergunta — e tem de ser a mesma.
 */
export async function pagamentosAVerificar(
  linhas: Array<{ id: number; createdAt?: Date | string | null; formaDePagamento?: unknown }>,
): Promise<Map<number, Date>> {
  const ids = linhas
    .filter(
      (l) =>
        verificaOPagamento({ negociacaoCriadaEm: l.createdAt ?? null }) ||
        // A dívida do dinheiro com IVA incluído (01-10-2026) também se lê
        // daqui, seja qual for a data de corte da verificação.
        temDividaDoProfissional(l.formaDePagamento, modeloDaNegociacao(l.createdAt)),
    )
    .map((l) => Number(l.id));
  return ids.length > 0 ? negociacoesPagas(ids) : new Map<number, Date>();
}

/**
 * AS NEGOCIAÇÕES COMO A CARTEIRA AS QUER — com o pagamento do cliente lá dentro.
 *
 * Existe porque esta conversão estava escrita DUAS VEZES, palavra por palavra:
 * na rota que mostra a carteira e na que pede a transferência. Duas cópias de
 * uma regra de dinheiro são duas regras de dinheiro, e a que se esquecer de
 * actualizar é a que decide se alguém recebe.
 *
 * E a diferença entre as duas seria a pior possível: a rota da carteira a
 * mostrar «por cobrar» e a do levantamento a deixar levantar — ou ao contrário.
 */
export async function trabalhosDaCarteira(
  linhas: Array<{
    id: number;
    estado: string;
    valorAcordado?: unknown;
    taxaCliente?: unknown;
    taxaProfissional?: unknown;
    formaDePagamento?: unknown;
    execucaoEnviadaEm?: Date | string | null;
    confirmadoEm?: Date | string | null;
    pagoEm?: Date | string | null;
    /** A abertura da negociação — o marco do corte de 01-10-2026. */
    createdAt?: Date | string | null;
  }>,
): Promise<TrabalhoNaCarteira[]> {
  /*
   * SÓ SE PERGUNTA À BASE PELOS QUE A CARTEIRA VERIFICA.
   *
   * Os trabalhos anteriores ao corte (01-10-2026) não têm pagamentos por onde
   * perguntar, e uma consulta que se sabe de antemão inútil é uma viagem ao
   * MySQL por cada abertura do painel de cada profissional.
   */
  const pagos = await pagamentosAVerificar(linhas);

  return linhas.map((l) => ({
    negociacaoId: l.id,
    estado: l.estado,
    valorAcordado: l.valorAcordado != null ? Number(l.valorAcordado) : null,
    // A comissão DESTE trabalho, e não a de hoje: a taxa pode mudar no
    // backoffice, e a carteira não pode mudar com ela.
    taxaCliente: l.taxaCliente as number | string | null | undefined,
    taxaProfissional: l.taxaProfissional as number | string | null | undefined,
    // Em dinheiro, o valor vai para outro cesto e nunca para «disponível».
    formaDePagamento: typeof l.formaDePagamento === "string" ? l.formaDePagamento : null,
    execucaoEnviadaEm: l.execucaoEnviadaEm,
    confirmadoEm: l.confirmadoEm,
    pagoEm: l.pagoEm,
    /*
     * ⚠️ NÃO CONFUNDIR COM `pagoEm`, e o nome parecido é um convite ao engano.
     *
     * `pagoEm` é a data em que a CLYON pagou AO PROFISSIONAL — o fim da linha.
     * `clientePagouEm` é a data em que o CLIENTE pagou À CLYON — o princípio.
     * Trocá-los dava um trabalho por pago no momento em que o cliente pagasse.
     */
    clientePagouEm: pagos.get(l.id) ?? null,
    // Sem ela, o trabalho conta como anterior ao corte — e a carteira deixava
    // levantar o que o cliente não pagou. Ver `verificaOPagamento`.
    negociacaoCriadaEm: l.createdAt ?? null,
    /*
     * EM DINHEIRO COM IVA INCLUÍDO, O PAGAMENTO DA NEGOCIAÇÃO É O DELE — o IVA
     * e a comissão que entregou à CLYON (01-10-2026). Ver `dividasDe`.
     */
    dividaPagaEm: temDividaDoProfissional(l.formaDePagamento, modeloDaNegociacao(l.createdAt))
      ? (pagos.get(l.id) ?? null)
      : null,
  }));
}
