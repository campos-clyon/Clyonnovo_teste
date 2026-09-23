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
  /*
   * «Parece-me bem» é a forma mais natural de aceitar um preço em português,
   * e faltava. A 15-09-2026 o Joao Pereira respondeu-a à proposta de 280 € do
   * pedido #323 e levou de volta o ponto de situação.
   *
   * Continuam de fora «ok», «ótimo» e «perfeito»: são reacções, não
   * aceitações, e a seguir a elas vem tantas vezes um «obrigado» que fecha a
   * conversa sem fechar negócio. Ver a nota do «Ok, obrigada» acima.
   */
  "parece-me bem",
  "parece me bem",
  "parece bem",
  "por mim tudo bem",
  "por mim esta bem",
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

/**
 * Palavras que acompanham um número sem serem o nome de ninguém.
 *
 * Nenhum profissional se chama «contraproposta» nem «euros». O `contra*`
 * apanha de propósito o que vier escrito torto — «contraporposta», que foi o
 * que o cliente escreveu —, porque uma palavra que começa por «contra» ao
 * lado de um preço não é uma empresa de mudanças.
 */
const NAO_SAO_NOMES = new Set([
  "proposta",
  "propostas",
  "valor",
  "preco",
  "euro",
  "euros",
  "eur",
  "oferta",
  "fica",
  "por",
  "e",
]);

function naoEUmNome(palavra: string): boolean {
  return palavra.startsWith("contra") || NAO_SAO_NOMES.has(palavra);
}

/**
 * NENHUM PROFISSIONAL SE CHAMA «267,00 RECUSAR 300,00» — 23-09-2026.
 *
 * A rede de segurança que faltava. Quando o resto de um «recusar …» não dá um
 * valor, era tratado como o NOME de quem ele quer recusar, fosse ele o que
 * fosse. O cliente do pedido #357 escreveu «recusar 267,00, recusar 300,00,
 * recusar 250,00, recusar 283,42» e isto leu-o como o nome de uma empresa —
 * uma empresa que não existe, claro. O cérebro procurou-a, não a encontrou, e
 * devolveu-lhe a mesma lista de propostas que lhe tinha mandado um minuto
 * antes. Ele fez o que a mensagem ensinava e levou-a de volta.
 *
 * Um nome tem letras. Duas, pelo menos, seguidas. Sem isto, qualquer engano
 * de formato vira uma empresa imaginária e a conversa anda em círculo.
 */
/**
 * As palavras que decidem o negócio. Nenhuma empresa se chama assim.
 *
 * O «contra*» já estava guardado em `NAO_SAO_NOMES` desde o «250
 * contraporposta» de 15-09-2026. Faltavam estas, e é por uma delas que a
 * frase das quatro recusas escapava: «recusar 300,00 400,00» dava o
 * profissional «recusar 300,00» a pedir 400 €.
 */
const VERBOS_DA_MESA = /\b(?:sim|nao|aceito|aceitar|fechar|fechamos|recusar|recuso)\b/g;

/**
 * TIRA-SE O QUE NÃO PODE SER NOME, E VÊ-SE O QUE SOBRA.
 *
 * A primeira versão vetava a frase inteira quando encontrava um verbo lá
 * dentro, e isso calava a forma mais humana de todas: «não aceito a proposta
 * da Revolution» tem «aceito» no meio e é uma frase perfeitamente normal. O
 * «aceito» não é o nome de ninguém, mas «a proposta da Revolution» é — e o
 * cérebro sabia casá-la.
 *
 * Também apanhava um profissional que tivesse a palavra no nome. «Sim
 * Transportes» existe, e ficava inalcançável nas quatro formas de o dizer.
 *
 * Agora tiram-se os verbos e os números, e pergunta-se se ainda há ali um
 * nome. «recusar 300,00 400,00» fica vazio; «a proposta da revolution» fica
 * inteiro.
 */
function pareceUmNome(resto: string): boolean {
  const sobra = resto
    .replace(VERBOS_DA_MESA, " ")
    .replace(/\d[\d.,]*/g, " ")
    .replace(/[€]|\beur(?:os)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /[a-z]{2,}/.test(sobra);
}

/**
 * «recusar 267,00, recusar 300,00, recusar 250,00» — recusar VÁRIAS de uma vez.
 *
 * É a resposta que a nossa própria mensagem convida a dar. Com quatro
 * propostas na mesa, o assistente escreve «Diga qual pelo valor — por exemplo:
 * recusar 267,00». Quem as quer recusar todas escreve a mesma frase quatro
 * vezes, separadas por vírgulas, e tem toda a razão em esperar ser entendido.
 *
 * Só serve para RECUSAR. Fechar várias não quer dizer nada: contrata-se um
 * profissional, não quatro.
 *
 * Devolve `null` quando sobra texto que não é uma recusa — nesse caso não se
 * percebeu a frase inteira, e meia-frase percebida sobre dinheiro é pior do
 * que nenhuma.
 */
function recusasEmSerie(t: string): number[] | null {
  /*
   * «euros» ANTES de «eur», e não ao contrário.
   *
   * A alternância de uma expressão regular é ordenada: com `eur|euros`, a
   * palavra «euros» casa em «eur» e deixa «os» para trás. Esse «os» ficava na
   * sobra, a sobra deixava de estar vazia, e a leitura devolvia `null` — a
   * forma mais escrita de todas, «recusar 100 euros», era a única que não
   * funcionava.
   */
  const UMA_RECUSA = "(?:nao|recusar|recuso)\\s+(\\d{1,4}(?:[.,]\\d{1,2})?)\\s*(?:€|euros|eur)?";
  const achados = [...t.matchAll(new RegExp(UMA_RECUSA, "g"))];
  if (achados.length < 2) return null;

  // O que sobra depois de tirar as recusas só pode ser cola: vírgulas já
  // viraram espaços no `normalizar`, e fica o «e» de «X e Y».
  const sobra = t
    .replace(new RegExp(UMA_RECUSA, "g"), " ")
    .replace(/\be\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (sobra) return null;

  const valores = achados.map((m) => Number(m[1].replace(",", ".")));
  if (valores.some((v) => !Number.isFinite(v) || v <= 0)) return null;
  return [...new Set(valores)];
}

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
  /**
   * «recusar 267,00, recusar 300,00» — várias recusas numa frase só.
   *
   * Os valores vão todos, sem repetidos e pela ordem em que ele os escreveu.
   * Quem os casa com as propostas que estão mesmo na mesa é o cérebro, e a
   * regra dele é tudo ou nada: se um dos valores não bater em nada, não se
   * recusa nenhuma. Ver `whatsapp-negociacao.ts`.
   */
  | { tipo: "nao_varias"; valores: number[] }
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

  /*
   * ANTES DO «recusar <valor>» SOZINHO, de propósito: a frase com quatro
   * recusas também casa com esse padrão, e casa mal — o resto fica a ser lido
   * como o nome de uma empresa.
   */
  const varias = recusasEmSerie(t);
  if (varias) return { tipo: "nao_varias", valores: varias };

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
    if (resto.length >= 3 && pareceUmNome(resto)) return { tipo: "sim_nome", nome: resto };
  }
  const nao = t.match(NAO_COM_VALOR);
  if (nao) {
    const resto = nao[1].trim();
    const v = valorDe(resto);
    if (v != null) return { tipo: "nao", valor: v };
    if (resto.length >= 3 && pareceUmNome(resto)) return { tipo: "nao_nome", nome: resto };
  }

  const so = valorDe(t);
  if (so != null) return null; // um valor sozinho é contraproposta, e tem o seu leitor

  /*
   * NOME E VALOR. O nome é tudo o que não é o número, e vai inteiro para quem
   * o tem de casar com um profissional — aqui não se sabe quem existe.
   *
   * MAS NEM TUDO O QUE ACOMPANHA UM NÚMERO É UM NOME. A 15-09-2026 o cliente
   * do pedido #323 escreveu «250 contraporposta» — o valor e a palavra que
   * diz o que fazer com ele. Isto lia-o como o profissional «contraporposta»
   * a 250 €, ia procurá-lo, não o encontrava, e devolvia o ponto de situação.
   * A contraproposta de 250 € nunca chegou à mesa.
   *
   * Quem acompanha o número com a palavra da própria negociação não está a
   * escolher ninguém: está a dizer o que já se sabe. Nesse caso o número fica
   * sozinho, que é como se lê uma contraproposta.
   */
  const palavras = t.split(" ");
  const semONumero = palavras.filter((p) => valorDe(p) == null);
  if (semONumero.length > 0 && semONumero.every(naoEUmNome)) {
    const soUm = palavras.map(valorDe).filter((v): v is number => v != null);
    if (soUm.length === 1) return null; // um valor sozinho, e tem o seu leitor
  }

  if (palavras.length >= 2) {
    const ultima = valorDe(palavras[palavras.length - 1]);
    const primeira = valorDe(palavras[0]);
    if (ultima != null && primeira == null) {
      const nome = palavras.slice(0, -1).join(" ").trim();
      if (nome.length >= 3 && pareceUmNome(nome)) return { tipo: "nome_e_valor", nome, valor: ultima };
    }
    if (primeira != null && ultima == null) {
      const nome = palavras.slice(1).join(" ").trim();
      if (nome.length >= 3 && pareceUmNome(nome)) return { tipo: "nome_e_valor", nome, valor: primeira };
    }
  }

  return null;
}

/** Já se lê sem modelo? Então não se gasta uma chamada nem dezoito segundos. */
export function jaSeLeSemModelo(texto: string): boolean {
  return lerARespostaDirecta(texto) != null;
}
