/**
 * O trabalho depois de fechado.
 *
 * A negociação acaba quando o cliente contrata, e é aí que começa a parte que
 * mexe com dinheiro: alguém tem de ir fazer o trabalho, provar que o fez, e o
 * cliente tem de confirmar antes de o valor sair da CLYON.
 *
 * Esta fase NÃO entra no motor de negociação. `negociacao.ts` decide quem pode
 * propor e quem pode aceitar, e tem testes que descrevem exactamente isso;
 * enfiar-lhe estados de execução tornava-o responsável por duas coisas sem
 * relação — e a segunda muda muito mais do que a primeira.
 *
 * O estado deriva de datas, não de uma coluna de texto. Uma coluna a dizer
 * "confirmado" pode discordar da data em que foi confirmado; duas fontes para o
 * mesmo facto acabam sempre por divergir, e depois não se sabe qual manda.
 */

export type FaseDoTrabalho =
  | "a_negociar"
  | "a_executar"
  | "a_confirmar"
  | "confirmado"
  | "pago";

export type Trabalho = {
  /** O estado da negociação: só "acordada" chegou a trabalho. */
  estado: string;
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
  /**
   * O que o profissional mandou com o «está feito» — `{ fotos, nota, em }`.
   *
   * `undefined` quer dizer que a consulta não a trouxe, e aí vale a regra de
   * antes de 26-10-2026 (o prazo corre). `null` é um «está feito» sem prova
   * nenhuma — o da CLYON por ele (`darPorEntreguePelaClyon`).
   */
  provaJson?: string | null;
};

/*
 * O «ESTÁ FEITO» SEM FOTOGRAFIAS — 26-10-2026 (d22). *«Remova o envio de
 * imagens para confirmar, mas explique que será um colega a confirmar se o
 * trabalho realmente foi feito ou não com o cliente.»* — o dono.
 *
 * Havia profissionais que não conseguiam pôr fotografias e, por isso, não
 * conseguiam dar o trabalho por feito. As fotografias passaram a ser opcionais.
 * Com elas fica tudo como estava: o cliente confirma, ou o trabalho confirma-se
 * sozinho ao fim do prazo. Sem elas o silêncio do cliente não vale como
 * aceitação — não há nada que ele tenha visto —, e quem confirma é a CLYON,
 * depois de falar com ele.
 */

/** O que o profissional lê ao marcar o trabalho como feito (painel e app). */
export const QUEM_CONFIRMA_O_TRABALHO =
  "Um colega da CLYON vai confirmar com o cliente se o trabalho foi feito.";
export const OBRIGADO_DEPOIS_DE_FEITO = `Obrigado. ${QUEM_CONFIRMA_O_TRABALHO}`;
/** Onde se pedia a fotografia do trabalho feito. */
export const FOTOGRAFIAS_SAO_OPCIONAIS =
  "Se puder, junte fotografias — ajudam, mas não são obrigatórias.";

/** As fotografias da prova, ou nenhuma. Uma prova ilegível não tem nenhuma. */
export function fotografiasDaProva(provaJson: string | null | undefined): string[] {
  if (!provaJson) return [];
  try {
    const p = JSON.parse(provaJson) as { fotos?: unknown } | null;
    return Array.isArray(p?.fotos)
      ? p.fotos.filter((f): f is string => typeof f === "string" && f !== "")
      : [];
  } catch {
    return [];
  }
}

/**
 * O prazo da confirmação automática corre para este trabalho?
 *
 * Só com fotografias. Sem a prova carregada (`provaJson` ausente), a regra de
 * sempre — as consultas que contam dinheiro trazem-na todas.
 */
export function prazoCorre(t: Trabalho): boolean {
  if (t.provaJson === undefined) return true;
  return fotografiasDaProva(t.provaJson).length > 0;
}

/**
 * Dado por feito sem fotografias, à espera de a CLYON confirmar com o cliente
 * — o «Por confirmar com o cliente» da Mesa.
 */
export function porConfirmarComOCliente(t: Trabalho): boolean {
  return faseDoTrabalho(t) === "a_confirmar" && !prazoCorre(t);
}

/**
 * A MESMA REGRA EM SQL, para o cron e para o selo: a prova tem pelo menos uma
 * fotografia. É o texto que `JSON.stringify({ fotos, nota, em })` escreve
 * (`"fotos":["…`); uma lista vazia dá `"fotos":[]` e não casa. Sem funções
 * JSON do MySQL de propósito: uma linha com JSON estragado partia o cron
 * inteiro em vez de ficar só ela de fora.
 */
export function provaComFotografiasSql(coluna: string): string {
  return `${coluna} LIKE '%"fotos":["%'`;
}

/** O contrário, contando a prova vazia (`NULL`) como sem fotografias. */
export function provaSemFotografiasSql(coluna: string): string {
  return `(${coluna} IS NULL OR ${coluna} NOT LIKE '%"fotos":["%')`;
}

/**
 * Quantos dias o cliente tem para confirmar antes de o valor ser libertado
 * sozinho.
 *
 * Sem isto, um cliente que simplesmente não volta ao site prendia o dinheiro do
 * profissional para sempre — e o profissional não tem forma nenhuma de o
 * obrigar a clicar. O prazo é a alternativa a esse refém.
 */
export const DIAS_ATE_LIBERTAR_SOZINHO = 7;

function data(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function faseDoTrabalho(t: Trabalho): FaseDoTrabalho {
  if (t.estado !== "acordada") return "a_negociar";
  if (data(t.pagoEm)) return "pago";
  if (data(t.confirmadoEm)) return "confirmado";
  if (data(t.execucaoEnviadaEm)) return "a_confirmar";
  return "a_executar";
}

/** O profissional só envia a prova de um trabalho que é dele e ainda não provou. */
export function podeEnviarProva(t: Trabalho): boolean {
  return faseDoTrabalho(t) === "a_executar";
}

/** O cliente confirma o que já foi provado. */
export function podeConfirmar(t: Trabalho): boolean {
  return faseDoTrabalho(t) === "a_confirmar";
}

/**
 * Passou o prazo e o cliente não disse nada — o valor liberta-se.
 *
 * Conta-se a partir da prova, e não do fecho: o prazo é para o cliente reagir
 * ao que foi feito, e antes da prova não há nada a que reagir. Sem
 * fotografias não há prazo (26-10-2026): confirma a CLYON, com o cliente.
 */
export function libertaSozinho(t: Trabalho, agora: Date): boolean {
  if (faseDoTrabalho(t) !== "a_confirmar") return false;
  if (!prazoCorre(t)) return false;
  const enviada = data(t.execucaoEnviadaEm);
  if (!enviada) return false;
  const dias = (agora.getTime() - enviada.getTime()) / 86_400_000;
  return dias >= DIAS_ATE_LIBERTAR_SOZINHO;
}

/** Quantos dias faltam para a libertação automática. Negativo nunca. */
export function diasAteLibertar(t: Trabalho, agora: Date): number | null {
  const enviada = data(t.execucaoEnviadaEm);
  if (faseDoTrabalho(t) !== "a_confirmar" || !enviada || !prazoCorre(t)) return null;
  const passados = (agora.getTime() - enviada.getTime()) / 86_400_000;
  return Math.max(0, DIAS_ATE_LIBERTAR_SOZINHO - passados);
}

/** O dinheiro deste trabalho já não está preso. */
export function estaLibertado(t: Trabalho, agora: Date): boolean {
  const fase = faseDoTrabalho(t);
  return fase === "confirmado" || fase === "pago" || libertaSozinho(t, agora);
}

/**
 * QUANDO É QUE O DINHEIRO DESTE TRABALHO DEIXA DE ESTAR PRESO.
 *
 * As três portas, e são as de `estaLibertado`:
 *
 *   · o cliente confirmou       → na hora em que confirmou;
 *   · já foi pago               → idem (a confirmação veio antes);
 *   · a prova foi enviada e o cliente não disse nada → sete dias depois dela.
 *
 * Antes da prova não há nada a libertar: o trabalho ainda nem foi feito. E um
 * «está feito» sem fotografias também não tem data (26-10-2026): liberta-se
 * quando a CLYON o confirmar com o cliente — a primeira porta.
 *
 * Devolver a DATA em vez de «sim/não» é o que permite ao livro escrever o
 * movimento uma vez, no momento em que o trabalho fecha, e nunca mais lhe
 * tocar. O prazo cumpre-se sozinho.
 *
 * Mudou-se para aqui de `livro-da-carteira.ts` a 01-10-2026, sem mudar uma
 * linha: a carteira passou a precisar dela para saber quando nasce a dívida de
 * um trabalho em dinheiro (e o prazo para a pagar), e importá-la do livro era
 * um ciclo — o livro importa a carteira.
 */
export function quandoLiberta(t: Trabalho): Date | null {
  const fase = faseDoTrabalho(t);
  if (fase === "pago" || fase === "confirmado") {
    // `pagoEm` como alternativa: uma linha antiga pode ter sido paga sem a data
    // da confirmação ter ficado gravada, e é melhor uma data do que nenhuma.
    return data(t.confirmadoEm) ?? data(t.pagoEm);
  }
  if (fase === "a_confirmar") {
    const enviada = data(t.execucaoEnviadaEm);
    if (!enviada || !prazoCorre(t)) return null;
    return new Date(enviada.getTime() + DIAS_ATE_LIBERTAR_SOZINHO * 86_400_000);
  }
  return null;
}
