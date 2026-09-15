/**
 * MANTER-ME LIGADO — e não ter de escrever a palavra-passe várias vezes ao dia.
 *
 * "Crie a opção manter-me conectado, e garanta que funcione para eles não
 * terem de entrar com senha várias vezes ao dia." — 15-09-2026.
 *
 * O QUE ENCONTREI ANTES DE ESCREVER ISTO, porque muda o que a caixa tem de ser:
 * a sessão JÁ durava trinta dias. O cookie é persistente, tem `maxAge`, é
 * `httpOnly`, e os três sítios que o escrevem escrevem-no igual. Uma caixa
 * «manter-me ligado» por cima disso não era uma opção — era um enfeite a
 * prometer o que já acontecia.
 *
 * Então a caixa ganha o significado que lhe falta, e que é o INVERSO: quem a
 * DESLIGA está a dizer «este computador não é meu». Aí a sessão morre com o
 * browser, que é o que uma pessoa num computador emprestado precisa e nunca
 * teve como pedir.
 *
 * E JUNTA-SE O QUE FALTAVA MESMO: a RENOVAÇÃO. Trinta dias contados do dia em
 * que entrou expulsam-no ao trigésimo primeiro por muito que o tenha usado
 * todos os dias — que é a forma mais idiota de perder alguém. Agora o prazo
 * conta-se a partir da última vez que ele lá esteve: enquanto usar, nunca sai.
 *
 * Ficheiro puro. As decisões de tempo testam-se com um relógio a fingir.
 */

/** O prazo de quem pediu para ficar ligado. */
export const DIAS_A_LEMBRAR = 30;
export const SEGUNDOS_A_LEMBRAR = DIAS_A_LEMBRAR * 24 * 60 * 60;

/**
 * O prazo de quem NÃO pediu — e porque não é «zero».
 *
 * Sem `maxAge` o cookie morre quando o browser fecha, e é isso que se quer num
 * computador emprestado. Mas o TOKEN também tem de ter fim: um browser que
 * nunca fecha (um telemóvel) guardaria para sempre um cookie que a pessoa
 * pediu para não guardar. Doze horas é um dia de trabalho.
 */
export const HORAS_SEM_LEMBRAR = 12;
export const SEGUNDOS_SEM_LEMBRAR = HORAS_SEM_LEMBRAR * 60 * 60;

/** Quanto tempo vale o token, conforme a escolha dele. */
export function duracaoDaSessao(lembrar: boolean): number {
  return lembrar ? SEGUNDOS_A_LEMBRAR : SEGUNDOS_SEM_LEMBRAR;
}

/**
 * As opções do cookie que dependem da escolha.
 *
 * `maxAge: undefined` é o que faz dele um cookie de sessão — e tem de ser
 * ausência e não zero: `maxAge: 0` APAGA o cookie, que é como se faz o sair.
 * Trocar um pelo outro dava uma sessão que terminava no instante em que
 * começava, e só a quem desmarcasse a caixa.
 */
export function maxAgeDoCookie(lembrar: boolean): number | undefined {
  return lembrar ? SEGUNDOS_A_LEMBRAR : undefined;
}

/**
 * A ESCOLHA VEM MARCADA, e é uma decisão e não um descuido.
 *
 * É o que o profissional quer em noventa e tal por cento dos casos — entra do
 * telemóvel dele, para ver os trabalhos dele — e é o que o sistema já fazia. A
 * caixa existe para quem precisa do contrário poder dizê-lo.
 */
export const LEMBRAR_POR_OMISSAO = true;

/** O que veio do formulário. Só um `false` explícito desliga. */
export function lerLembrar(valor: unknown): boolean {
  if (valor === false || valor === "false" || valor === 0 || valor === "0") return false;
  if (valor === true || valor === "true" || valor === 1 || valor === "1") return true;
  return LEMBRAR_POR_OMISSAO;
}

/**
 * A partir de quando vale a pena renovar: passada METADE do prazo.
 *
 * Renovar a cada pedido escrevia um `Set-Cookie` em todas as respostas do
 * painel — que se recarrega de minuto a minuto — para não mudar nada nas
 * primeiras duas semanas. Metade do prazo é o ponto em que a renovação passa a
 * comprar tempo a sério, e dá quinze dias de folga a quem só aparece de vez em
 * quando.
 */
export function devePrologar(
  expiraEmSegundos: number | null | undefined,
  lembrar: boolean,
  agora: Date = new Date(),
): boolean {
  /*
   * Quem não pediu para ser lembrado NÃO se renova. Renovar-lhe a sessão era
   * desfazer pelas costas a escolha que ele fez à frente — e num computador
   * emprestado isso é deixar a conta dele aberta a quem vier a seguir.
   */
  if (!lembrar) return false;
  if (typeof expiraEmSegundos !== "number" || !Number.isFinite(expiraEmSegundos)) return false;

  const faltam = expiraEmSegundos - Math.floor(agora.getTime() / 1000);
  if (faltam <= 0) return false;
  return faltam < SEGUNDOS_A_LEMBRAR / 2;
}
