import { negociacoesPagas, negociacoesPagasComDetalhe, type PagamentoQueFecha } from "./pagamentos-na-base";
import { verificaOPagamento, type TrabalhoNaCarteira } from "./carteira";
import { modeloDaNegociacao } from "./iva-incluido";
import { METODO_DO_ABATIMENTO, temDividaDoProfissional } from "./divida-do-profissional";

type LinhaAVerificar = { id: number; createdAt?: Date | string | null; formaDePagamento?: unknown };

/** Os ids por que vale a pena perguntar à tabela dos pagamentos. */
function idsAVerificar(linhas: LinhaAVerificar[]): number[] {
  return linhas
    .filter(
      (l) =>
        verificaOPagamento({ negociacaoCriadaEm: l.createdAt ?? null }) ||
        // A dívida do dinheiro com IVA incluído (01-10-2026) também se lê
        // daqui, seja qual for a data de corte da verificação.
        temDividaDoProfissional(l.formaDePagamento, modeloDaNegociacao(l.createdAt)),
    )
    .map((l) => Number(l.id));
}

/**
 * QUAIS DESTES O CLIENTE JÁ PAGOU — perguntado só pelos que a carteira verifica.
 *
 * Até 01-10-2026 era «tudo ou nada» com `A_PLATAFORMA_COBRA`. Desde a decisão
 * do dono desse dia (*«Ligar, só para trabalhos novos»*) pergunta-se pelos
 * trabalhos em que `verificaOPagamento` diz que sim: com o interruptor
 * desligado, os das negociações abertas a partir de `VERIFICAR_PAGAMENTO_DESDE`.
 * Nenhum desses, nenhuma viagem ao MySQL.
 *
 * Exportada porque a lista dos trabalhos do profissional (`meus-pedidos`) faz
 * a mesma pergunta — e tem de ser a mesma.
 */
export async function pagamentosAVerificar(linhas: LinhaAVerificar[]): Promise<Map<number, Date>> {
  const ids = idsAVerificar(linhas);
  return ids.length > 0 ? negociacoesPagas(ids) : new Map<number, Date>();
}

/**
 * O MESMO, COM O MÉTODO E O LEVANTAMENTO — para quem monta a carteira
 * (`trabalhosDaCarteira`) e o livro (db.ts). 01-10-2026: a carteira passou a
 * precisar de saber se a dívida de um trabalho em dinheiro foi abatida no
 * saldo, porque aí sai do disponível.
 */
export async function pagamentosAVerificarComDetalhe(
  linhas: LinhaAVerificar[],
): Promise<Map<number, PagamentoQueFecha>> {
  const ids = idsAVerificar(linhas);
  return ids.length > 0 ? negociacoesPagasComDetalhe(ids) : new Map<number, PagamentoQueFecha>();
}

/**
 * OS TRÊS CAMPOS DE PAGAMENTO DE UM TRABALHO NA CARTEIRA, a partir do que a
 * tabela dos pagamentos respondeu. Pura, e usada pela carteira do painel e
 * pelo livro — os dois têm de ler o mesmo pagamento da mesma maneira.
 *
 *   · `clientePagouEm` — a negociação tem um pagamento dado por pago;
 *   · `dividaPagaEm` — em dinheiro com IVA incluído esse pagamento é o DELE
 *     (o IVA e a comissão), e não do cliente;
 *   · `dividaAbatida` — e foi pago com o saldo dele (`abatimento`), e não por
 *     referência. Só aí sai do disponível.
 */
export function camposDoPagamento(
  l: { id: number; createdAt?: Date | string | null; formaDePagamento?: unknown },
  pagos: Map<number, PagamentoQueFecha>,
): Pick<TrabalhoNaCarteira, "clientePagouEm" | "dividaPagaEm" | "dividaAbatida"> {
  const p = pagos.get(Number(l.id)) ?? null;
  const comDivida = temDividaDoProfissional(l.formaDePagamento, modeloDaNegociacao(l.createdAt));
  return {
    clientePagouEm: p?.pagoEm ?? null,
    dividaPagaEm: comDivida ? (p?.pagoEm ?? null) : null,
    dividaAbatida:
      comDivida && p != null && p.metodo === METODO_DO_ABATIMENTO
        ? { valor: p.valor, em: p.pagoEm, levantamentoId: p.levantamentoId }
        : null,
  };
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
  const pagos = await pagamentosAVerificarComDetalhe(linhas);

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
     * ⚠️ NÃO CONFUNDIR `clientePagouEm` COM `pagoEm`, e o nome parecido é um
     * convite ao engano.
     *
     * `pagoEm` é a data em que a CLYON pagou AO PROFISSIONAL — o fim da linha.
     * `clientePagouEm` é a data em que o CLIENTE pagou À CLYON — o princípio.
     * Trocá-los dava um trabalho por pago no momento em que o cliente pagasse.
     *
     * Em dinheiro com IVA incluído, o pagamento da negociação é o DELE — o IVA
     * e a comissão que entregou à CLYON, por referência ou abatidos no saldo
     * (01-10-2026). Ver `camposDoPagamento` e `dividasDe`.
     */
    ...camposDoPagamento(l, pagos),
    // Sem ela, o trabalho conta como anterior ao corte — e a carteira deixava
    // levantar o que o cliente não pagou. Ver `verificaOPagamento`.
    negociacaoCriadaEm: l.createdAt ?? null,
  }));
}
