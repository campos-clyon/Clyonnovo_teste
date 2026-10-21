/**
 * O TIPO DA SUGESTÃO DA CLYON PARA O PROFISSIONAL — à parte desde 21-10-2026.
 *
 * Vivia em `sugestao-para-o-profissional.ts`, que importa o `pricing-helper`
 * do servidor. A conta refeita (`sugestao-ajustada.ts`) só precisa do tipo, e
 * a app do profissional usa-a para mudar as horas e as pessoas, como o painel:
 * com o tipo aqui, a cadeia de imports dela fica toda em src/lib e sem
 * dependências (ver `app-pro.test.ts`).
 */
import type { Taxas } from "./taxas-plataforma";

export type SugestaoParaOProfissional = {
  horas: number;
  pessoas: number;
  custoHoraPessoa: number;
  custoKm: number;
  /** Km contados para o combustível (ida e volta, ou o percurso da mudança). */
  kmDeCarro: number | null;
  custoCombustivel: number;
  custoPessoal: number;
  custosFixos: number;
  /** A reserva de risco deste trabalho, em €, e a percentagem que a gerou. */
  seguroDeRisco: number;
  riscoPercent: number;
  /** Abaixo disto é prejuízo. */
  custoMinimo: number;
  margem: number;
  /** O que propor ao cliente, sem IVA. */
  precoSugerido: number;
  /** O que lhe fica desse preço, já com a taxa CLYON descontada. */
  recebeSePropuser: number;
  /**
   * AS TAXAS COM QUE O «RECEBE» FOI FEITO — as da negociação dele.
   *
   * Fazia-se com as de origem (6 %), escritas no código. A 29-09-2026 a
   * comissão passou a sair dos 11 % do que o cliente paga — 6,55 % ao
   * profissional —, e o ecrã ia prometer-lhe 329 € de um trabalho de 350 €
   * que lhe deixa 327,08 €. Ficam aqui para a conta refeita
   * (`sugestaoComOutroTempo`) usar as mesmas.
   */
  taxas?: Taxas;
  /** recebeSePropuser − custoMinimo. */
  lucroEstimado: number;
  /** O pedido é pago por carga: a conta é de UMA carga. */
  porCarga: boolean;
  /**
   * O pedido é pago À HORA (as mudanças, desde 13-10-2026): os quatro números
   * de cima — custo mínimo, a propor, o que recebe e o lucro — são POR HORA.
   * As parcelas de baixo continuam a ser do trabalho todo, que é de onde vêm.
   */
  porHora?: boolean;
  /** Entraram os custos do perfil dele, e não os de referência. */
  comOsSeusCustos: boolean;
  /** Não havia distância: o combustível ficou a zero e a conta é por baixo. */
  semDistancia: boolean;
  /** As parcelas, por extenso, para o ecrã mostrar de onde vem o número. */
  pressupostos: string[];
};
