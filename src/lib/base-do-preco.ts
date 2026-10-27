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

/*
 * E À HORA — 13-10-2026. *«Não temos valores fixos para mudanças, e sim este
 * esquema»*: 50 € + IVA por hora, mínimo 3 horas (ver `tabela-das-mudancas.ts`).
 * Como a carga, a base diz o que o número mede, e o total sai do que se fizer
 * no dia — aqui, das horas.
 */
export type BaseDoPreco = "total" | "carga" | "hora";

/**
 * Sem ninguém dizer nada, é pelo trabalho todo.
 *
 * É o que estava implícito em todos os pedidos que já existem — nenhum deles
 * foi combinado por carga — e é a leitura que não surpreende ninguém: quem
 * lê «150 €» sem mais nada assume que são 150 € e acabou.
 */
export const BASE_POR_OMISSAO: BaseDoPreco = "total";

export function baseValida(v: unknown): v is BaseDoPreco {
  return v === "total" || v === "carga" || v === "hora";
}

/** O que vier da base de dados, com o valor por omissão para o que não vier. */
export function lerBase(v: unknown): BaseDoPreco {
  return baseValida(v) ? v : BASE_POR_OMISSAO;
}

/** Curto, para caber ao lado do número: "total" ou "por carga". */
export function etiquetaDaBase(b: BaseDoPreco): string {
  return b === "carga" ? "por carga" : b === "hora" ? "por hora" : "total";
}

/**
 * A frase inteira, para onde há espaço para ela.
 *
 * Diz o que se paga, e não o que se mede: "por cada carga" deixa claro que há
 * mais do que uma, que é precisamente a parte que se perde quando se escreve
 * só «por carga».
 */
export function basePorExtenso(b: BaseDoPreco): string {
  if (b === "hora") return "por cada hora de trabalho — o total depende das horas, com um mínimo de 3";
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
  if (b === "hora") return "Este valor é POR HORA (mínimo 3 horas). Combine as horas previstas antes de fechar.";
  return b === "carga"
    ? "Este valor é POR CARGA. Combine quantas cargas são antes de fechar."
    : null;
}

/**
 * O MESMO AVISO, mas sem um valor ao lado a que possa chamar «este».
 *
 * Na página do cliente deixou de haver número nenhum nesta zona — o valor que
 * ele indicou saiu de lá a 18-09-2026 — e as propostas ficam no topo, longe
 * daqui. «Este valor» passou a apontar para o vazio.
 *
 * Duas frases quase iguais e não uma: onde há um número ao lado, «este valor»
 * é mais curto e mais claro do que uma perífrase; onde não há, mentia. A
 * decisão que as duas transmitem é a mesma, e é isso que interessa.
 */
export function avisoDaBaseParaOCliente(b: BaseDoPreco): string | null {
  if (b === "hora") return "O preço deste pedido é POR HORA, com um mínimo de 3 horas. O total depende das horas de trabalho.";
  return b === "carga"
    ? "O preço deste pedido é POR CARGA. Combine quantas cargas são antes de fechar."
    : null;
}

/**
 * O QUE FICA DITO AO CLIENTE DEPOIS DE UM VALOR POR CARGA — 30-09-2026.
 *
 * *«Porque a mensagem não é clara em relação ao valor de 300, que é por
 * carga?»* A Carolina (#400) recebeu no WhatsApp «TRSul propõe 300,00 €» e
 * «fica em 315,00 € sem IVA» — dois números sem unidade, num pedido marcado
 * POR CARGA. O ecrã do profissional dizia-o, a página do pedido dizia-o, e a
 * única mensagem que o cliente de telefone lê calava-o. É a discussão cara do
 * princípio deste ficheiro, a nascer exactamente onde ninguém estava a olhar.
 *
 * Sem «antes de fechar» nem «antes de começar»: a mesma frase serve à
 * proposta e ao «Fechado com…», e vai logo a seguir ao «confirma-se no local
 * antes de começar» do orçamento à distância — dizê-lo duas vezes seguidas
 * era a mensagem a falar sozinha.
 */
export function notaDaCargaParaOCliente(b: BaseDoPreco): string | null {
  if (b === "hora") {
    return "É um preço POR HORA, com um mínimo de 3 horas: o total depende das horas de trabalho no dia.";
  }
  return b === "carga"
    ? `É um preço POR CARGA (${O_QUE_E_UMA_CARGA}): o total depende de quantas cargas forem — combine o número com o profissional.`
    : null;
}

/**
 * O QUE É UMA CARGA, dito ao cliente — 27-10-2026 (decisão d2, o pedido #853).
 *
 * A proposta dizia «360,00 € + IVA = 442,80 € por carga», e a cliente
 * perguntou «Não entendi, o que é a carga? A carrinha?». A Vitória não soube
 * responder; respondeu uma pessoa da equipa. Uma frase só, para a nota da
 * proposta e para a resposta da Vitória dizerem o mesmo.
 *
 * Sem metros cúbicos de propósito: a lista dos veículos tem os seus («8 a
 * 15 m³» na carrinha grande), e um número diferente aqui seria o site a falar
 * duas línguas.
 */
export const O_QUE_E_UMA_CARGA = "uma carga é uma carrinha cheia, o que cabe de uma vez na viatura";

/** "150,00 € por carga", "50,00 € por hora" ou "150,00 €" — o número e a unidade, juntos. */
export function precoComBase(texto: string, b: BaseDoPreco): string {
  return `${texto}${unidadeDaBase(b)}`;
}

/** « por carga», « por hora» ou nada — para colar a seguir a um valor. */
export function unidadeDaBase(b: BaseDoPreco): string {
  return b === "carga" ? " por carga" : b === "hora" ? " por hora" : "";
}

/** O número é por unidade (carga ou hora), e não pelo trabalho todo? */
export function ePorUnidade(b: BaseDoPreco): boolean {
  return b === "carga" || b === "hora";
}
