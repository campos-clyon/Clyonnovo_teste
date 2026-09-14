/**
 * LER O SIM E O NÃO SEM PEDIR AJUDA A NINGUÉM.
 *
 * "O bot não conseguiu entender a resposta da cliente." — 14-09-2026, sobre
 * uma conversa onde ela escreveu «Sim serve» e, quatro minutos depois,
 * «Revolution 94». As duas levaram de volta o ponto de situação.
 *
 * O CHÃO ERA ESTREITO DE MAIS. A leitura sem modelo era
 * `^(sim|fechar|aceito|aceitar|pode fechar)$` — a palavra exacta e mais nada.
 * «Sim serve» não é uma frase difícil: é a forma normal de aceitar em
 * português, e falhava por ter duas palavras. Tudo o que não coubesse nesse
 * molde ficava dependente do Gemini, e no dia em que ele não responde o
 * assistente volta a exigir palavras-chave sem dizer a ninguém que voltou.
 *
 * ISTO NÃO SUBSTITUI O GEMINI — é o degrau abaixo dele. Ele continua a ser
 * quem lê «pode ser, fechamos por esse valor» e «e se fosse 180?». O que aqui
 * está é a lista curta e explícita das formas que aparecem todos os dias, para
 * que uma avaria na Google não leve o produto ao chão.
 *
 * UMA LISTA, E NÃO UMA EXPRESSÃO QUE CRESCE. As frases estão escritas uma a
 * uma de propósito: cada linha desta lista fecha ou recusa um negócio de
 * centenas de euros, e uma expressão regular que se vai alargando é a forma
 * mais fácil de apanhar por engano uma frase que quer dizer o contrário.
 * «Não serve» tem de estar na lista do não, e nunca na do sim.
 */

/**
 * Sem acentos, sem pontuação à volta, e com os espaços arrumados.
 *
 * O PONTO E A VÍRGULA SÓ SAEM QUANDO NÃO SÃO DECIMAIS. Varrer toda a
 * pontuação transformava «fechar 148,57» em «fechar 148 57», e o valor que a
 * própria mensagem da CLYON ensina a escrever deixava de ser lido.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[!;…?]+/g, " ")
    /*
     * Os dois pontos entram na mesma regra por causa de «Revolution: 84» — a
     * cliente copia o nome da lista, com os dois pontos e tudo. Entre dígitos
     * ficam, que é onde eles são uma hora: «14:30».
     */
    .replace(/([.,:])(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * As formas de dizer que sim a uma proposta, como ela está.
 *
 * Não entra aqui nada que possa ser outra coisa. «Ok» sozinho ficou de fora
 * por causa de «Ok, obrigada» — que é uma despedida, e que já fechou uma
 * conversa nesta plataforma sem fechar negócio nenhum.
 */
export const SIM_EXACTO = new Set([
  "sim",
  "sim sim",
  "claro",
  "sim claro",
  "serve",
  "sim serve",
  "serve sim",
  "pode ser",
  "sim pode ser",
  "esta bem",
  "sim esta bem",
  "aceito",
  "sim aceito",
  "aceito sim",
  "aceitar",
  "concordo",
  "de acordo",
  "combinado",
  "sim combinado",
  "fechar",
  "pode fechar",
  "fechamos",
  "sim fechamos",
  "vamos a isso",
]);

/** E as de dizer que não. «Não serve» vive aqui, e é o par de «serve». */
export const NAO_EXACTO = new Set([
  "nao",
  "nao nao",
  "nao quero",
  "nao serve",
  "nao me serve",
  "nao aceito",
  "nao obrigado",
  "nao obrigada",
  "recusar",
  "recuso",
  "fica para outra",
  "fica para outra altura",
]);

/** Os verbos que podem vir antes de um valor: «aceito 300», «recuso 300». */
const SIM_COM_VALOR = /^(?:sim|fechar|aceito|aceitar|pode fechar|fechamos)\s+(.+)$/;
const NAO_COM_VALOR = /^(?:nao|recusar|recuso)\s+(.+)$/;
/** «300», «300,50», «300 €», «300 euros». */
const SO_UM_VALOR = /^(\d{1,4})(?:[.,](\d{1,2}))?\s*(?:€|eur|euros)?$/;

export type LeituraDirecta =
  | { tipo: "sim"; valor: number | null }
  | { tipo: "nao"; valor: number | null }
  /**
   * «Revolution 94» — um nome e um número na mesma linha.
   *
   * Sozinho não decide nada: quem decide é o cérebro, que tem os alvos à frente
   * e exige que o nome bata num só. É a forma mais directa de escolher entre
   * duas propostas, e era a que o ponto de situação ensinava («Diga qual pelo
   * valor») sem depois a saber ler.
   */
  | { tipo: "nome_e_valor"; nome: string; valor: number }
  /**
   * «Aceito a proposta da Revolution» — um sim com um nome e sem número.
   *
   * É a forma mais humana de todas, e a que menos se parece com uma
   * palavra-chave. O `nome` vai inteiro, com os artigos e tudo: quem o tem de
   * casar com um profissional é o cérebro, que sabe quem existe.
   */
  | { tipo: "sim_nome"; nome: string }
  | { tipo: "nao_nome"; nome: string }
  | null;

function valorDe(texto: string): number | null {
  const m = texto.match(SO_UM_VALOR);
  if (!m) return null;
  const n = Number(`${m[1]}.${m[2] ?? "0"}`);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * O que se consegue ler da mensagem sem modelo nenhum.
 *
 * Devolve `null` quando não se percebe — e é isso que faz a diferença entre
 * «não percebi» e «percebi mal». Na dúvida não se lê nada: uma leitura errada
 * fecha um negócio errado, e não perceber custa uma mensagem a mais.
 */
export function lerARespostaDirecta(texto: string): LeituraDirecta {
  const t = normalizar(texto);
  if (!t) return null;

  if (SIM_EXACTO.has(t)) return { tipo: "sim", valor: null };
  if (NAO_EXACTO.has(t)) return { tipo: "nao", valor: null };

  const sim = t.match(SIM_COM_VALOR);
  if (sim) {
    const resto = sim[1].trim();
    const v = valorDe(resto);
    if (v != null) return { tipo: "sim", valor: v };
    /*
     * «Aceito a proposta da Revolution» — sem número nenhum.
     *
     * O resto vai inteiro, artigos e tudo, porque aqui não se sabe quem
     * existe. Quem o casa com um profissional é o cérebro, e exige que bata
     * num só.
     */
    if (resto.length >= 3) return { tipo: "sim_nome", nome: resto };
  }
  const nao = t.match(NAO_COM_VALOR);
  if (nao) {
    const resto = nao[1].trim();
    const v = valorDe(resto);
    if (v != null) return { tipo: "nao", valor: v };
    if (resto.length >= 3) return { tipo: "nao_nome", nome: resto };
  }

  const so = valorDe(t);
  if (so != null) return null; // um valor sozinho é contraproposta, e tem o seu leitor

  /*
   * NOME E VALOR. O nome é tudo o que não é o número, e vai inteiro para quem
   * o tem de casar com um profissional — aqui não se sabe quem existe.
   */
  const palavras = t.split(" ");
  if (palavras.length >= 2) {
    const ultima = valorDe(palavras[palavras.length - 1]);
    const primeira = valorDe(palavras[0]);
    if (ultima != null && primeira == null) {
      const nome = palavras.slice(0, -1).join(" ").trim();
      if (nome.length >= 3) return { tipo: "nome_e_valor", nome, valor: ultima };
    }
    if (primeira != null && ultima == null) {
      const nome = palavras.slice(1).join(" ").trim();
      if (nome.length >= 3) return { tipo: "nome_e_valor", nome, valor: primeira };
    }
  }

  return null;
}

/** Já se lê sem modelo? Então não se gasta uma chamada nem dezoito segundos. */
export function jaSeLeSemModelo(texto: string): boolean {
  return lerARespostaDirecta(texto) != null;
}
