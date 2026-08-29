/**
 * O NÚMERO É PELO TRABALHO TODO, OU POR CADA CARGA?
 *
 * "Temos de ter aqui a opção de colocar valor por carga ou valor total. Deixe
 * um botão que mostra para o pro se o orçamento é por carga ou valor total."
 *
 * O campo do valor era um número sozinho, e um número sozinho não diz o que
 * mede. Numa recolha de entulho «150 €» tanto pode ser o trabalho inteiro como
 * cada viagem ao aterro — e a diferença entre as duas leituras são três
 * cargas, ou seja 300 € que ninguém combinou.
 *
 * É a discussão mais cara que uma plataforma destas pode ter, porque só
 * aparece no fim: o profissional faz o trabalho a contar com uma coisa, o
 * cliente pagou a contar com outra, e ambos têm razão a olhar para o mesmo
 * ecrã.
 *
 * Por isso a base anda AGARRADA ao número, do formulário até ao ecrã do
 * cliente, e nunca é uma nota solta na descrição.
 */

export type BaseDoPreco = "total" | "carga";

/**
 * Sem ninguém dizer nada, é pelo trabalho todo.
 *
 * É o que estava implícito em todos os pedidos que já existem — nenhum deles
 * foi combinado por carga — e é a leitura que não surpreende ninguém: quem
 * lê «150 €» sem mais nada assume que são 150 € e acabou.
 */
export const BASE_POR_OMISSAO: BaseDoPreco = "total";

export function baseValida(v: unknown): v is BaseDoPreco {
  return v === "total" || v === "carga";
}

/** O que vier da base de dados, com o valor por omissão para o que não vier. */
export function lerBase(v: unknown): BaseDoPreco {
  return baseValida(v) ? v : BASE_POR_OMISSAO;
}

/** Curto, para caber ao lado do número: "total" ou "por carga". */
export function etiquetaDaBase(b: BaseDoPreco): string {
  return b === "carga" ? "por carga" : "total";
}

/**
 * A frase inteira, para onde há espaço para ela.
 *
 * Diz o que se paga, e não o que se mede: "por cada carga" deixa claro que há
 * mais do que uma, que é precisamente a parte que se perde quando se escreve
 * só «por carga».
 */
export function basePorExtenso(b: BaseDoPreco): string {
  return b === "carga"
    ? "por cada carga — o total depende de quantas forem"
    : "pelo trabalho todo";
}

/**
 * O aviso, para quem tem de o ler antes de decidir.
 *
 * Só existe para o preço por carga: dizer «este valor é pelo trabalho todo» a
 * quem já assumia isso é ruído, e ruído em todos os cartões deixa de se ler.
 */
export function avisoDaBase(b: BaseDoPreco): string | null {
  return b === "carga"
    ? "Este valor é POR CARGA. Combine quantas cargas são antes de fechar."
    : null;
}

/** "150,00 € por carga" ou "150,00 €" — o número e a unidade, juntos. */
export function precoComBase(texto: string, b: BaseDoPreco): string {
  return b === "carga" ? `${texto} por carga` : texto;
}
