import { A_PLATAFORMA_COBRA } from "./pagamento-na-plataforma";
import { negociacoesPagas } from "./pagamentos-na-base";
import type { TrabalhoNaCarteira } from "./carteira";

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
    execucaoEnviadaEm?: Date | string | null;
    confirmadoEm?: Date | string | null;
    pagoEm?: Date | string | null;
  }>,
): Promise<TrabalhoNaCarteira[]> {
  /*
   * SEM COBRANÇA NÃO SE PERGUNTA NADA À BASE.
   *
   * A tabela dos pagamentos está vazia enquanto o interruptor não mudar, e uma
   * consulta que se sabe de antemão que não devolve nada é uma viagem ao MySQL
   * por cada abertura do painel de cada profissional.
   */
  const pagos = A_PLATAFORMA_COBRA
    ? await negociacoesPagas(linhas.map((l) => l.id))
    : new Map<number, Date>();

  return linhas.map((l) => ({
    negociacaoId: l.id,
    estado: l.estado,
    valorAcordado: l.valorAcordado != null ? Number(l.valorAcordado) : null,
    // A comissão DESTE trabalho, e não a de hoje: a taxa pode mudar no
    // backoffice, e a carteira não pode mudar com ela.
    taxaCliente: l.taxaCliente as number | string | null | undefined,
    taxaProfissional: l.taxaProfissional as number | string | null | undefined,
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
  }));
}
