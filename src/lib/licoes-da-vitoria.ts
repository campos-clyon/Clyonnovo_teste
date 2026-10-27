/**
 * AS LIÇÕES DA VITÓRIA — ela aprende com cada conversa. 27-10-2026 (decisão d11).
 *
 * *«A Vitória tem de aprender com os erros, com as respostas dos clientes e
 * com as respostas da equipa, e evoluir com o tempo.»* — o dono, depois do
 * #510. Um modelo destes não se re-treina: aprende pelo que se lhe põe à
 * frente. Por isso cada vez que a equipa teve de entrar — respondeu à mão,
 * a Vitória deixou a pergunta «anotada», o cliente repetiu a pergunta, ou a
 * conversa passou a uma pessoa — a rotina diária propõe uma LIÇÃO: a pergunta
 * (sem dados de pessoas) e a resposta que a Vitória deve dar da próxima vez.
 *
 * NADA APRENDE SOZINHO. A lição nasce «por rever»; só depois de uma pessoa da
 * CLYON a aprovar (ou corrigir) entra na conversa seguinte — sem deploy. E
 * nunca muda um preço, uma taxa ou uma promessa: uma resposta com euros que
 * não batem com o site, com «próprio dia», contentores ou big bags, fica
 * bloqueada com o motivo (`motivoParaBloquear`).
 *
 * ESTE FICHEIRO É PURO: as regras, os casos, a semelhança e o painel. A base
 * está em `licoes-da-vitoria-na-base.ts`; a rotina em `propor-licoes.ts`.
 */
import { inicioDoDiaEmLisboa, segundaDaSemanaEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import { semAcentos } from "./leitor-da-recolha";
import { euroDasFontes, eurosNoTexto } from "./o-que-o-site-sabe";
import { respostaFrequente } from "./perguntas-frequentes-da-vitoria";
import { eDaEquipa, eMarcaDeImagem, semMarcaDeMao } from "./rajada-do-whatsapp";
import { PROPRIO_DIA, VOCE_SEM_ACENTO } from "./frases-proibidas";
import { TAXA_IVA } from "./taxas-plataforma";

import type { EstadoDaLicao, OrigemDaLicao } from "./licoes-da-vitoria-rotulos";

export {
  ESTADO_POR_EXTENSO,
  ESTADOS_DA_LICAO,
  ORIGEM_POR_EXTENSO,
  ORIGENS_DA_LICAO,
  type EstadoDaLicao,
  type OrigemDaLicao,
} from "./licoes-da-vitoria-rotulos";

export type Licao = {
  id: number;
  criadaEm: string;
  origem: OrigemDaLicao;
  pergunta: string;
  respostaDaEquipa: string | null;
  respostaProposta: string;
  estado: EstadoDaLicao;
  revistaPor: string | null;
  revistaEm: string | null;
  usos: number;
  /** Porque é que não pode ser usada (preço, promessa) — ou `null`. */
  bloqueadaPor: string | null;
};

/** Uma lição em uso: aprovada ou corrigida, e não bloqueada. */
export type LicaoEmUso = Pick<Licao, "id" | "pergunta" | "respostaProposta">;

export function estaEmUso(l: Pick<Licao, "estado" | "bloqueadaPor">): boolean {
  return (l.estado === "aprovada" || l.estado === "corrigida") && !l.bloqueadaPor;
}

/* ── Sem dados de pessoas ──────────────────────────────────────────────── */

/** Palavras com maiúscula que não são nomes de pessoas. */
const NAO_SAO_NOMES = new Set(
  ["vitoria", "clyon", "lisboa", "setubal", "almada", "seixal", "amora", "barreiro", "moita", "sesimbra", "palmela", "montijo", "sintra", "cascais", "oeiras", "loures", "odivelas", "amadora", "mafra", "olx", "mb", "way", "multibanco", "iva", "whatsapp", "google", "sim", "nao", "ok", "boa", "bom", "obrigado", "obrigada"],
);

const NOME = String.raw`[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçà]+(?:\s+(?:d[aoe]s?\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçà]+){0,3}`;

function tirarNomeDepoisDe(prefixos: string, texto: string): string {
  const re = new RegExp(String.raw`(\b(?:${prefixos})[,!]?\s+)(${NOME})`, "g");
  return texto.replace(re, (todo, antes: string, nome: string) =>
    NAO_SAO_NOMES.has(semAcentos(nome.split(/\s+/)[0])) ? todo : `${antes}[nome]`,
  );
}

/**
 * TIRA OS DADOS DE PESSOAS — nomes, telefones, emails, moradas, códigos
 * postais, NIF/IBAN e os números dos pedidos. Uma lição é sobre a PERGUNTA, e
 * nunca sobre quem a fez. `nomes` são os que se sabem da conversa (o nome do
 * pedido), e saem onde quer que apareçam.
 */
export function semDadosDePessoas(texto: string, nomes: readonly string[] = []): string {
  let t = String(texto ?? "");
  t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]");
  t = t.replace(/\bPT\s?50[\d\s]{19,30}\b/gi, "[iban]");
  t = t.replace(/(?:\+|\b00)?\d[\d\s.-]{7,16}\d\b/g, (m) => (m.replace(/\D/g, "").length >= 9 ? "[telefone]" : m));
  t = t.replace(/\b\d{4}\s?-\s?\d{3}\b(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wáéíóúâêôãõç-]+)*/g, "[código postal]");
  t = t.replace(
    /\b(rua|r\.|avenida|av\.?|travessa|tv\.|largo|praça|praceta|estrada|calçada|beco|alameda|urbaniza[çc][ãa]o|urb\.|bairro|lote)\s+[^,.;:!?\n]{2,60}?(?:,?\s*(?:n\.?\s?º?|nº|n°)?\s*\d+\s*[a-zA-Z]?\b)?(?=[,.;:!?\n]|$)/gi,
    "[morada]",
  );
  t = t.replace(/#\s?\d{2,}/g, "#[pedido]");
  for (const n of nomes) {
    for (const parte of String(n ?? "").split(/\s+/)) {
      const p = parte.trim();
      if (p.length < 3 || NAO_SAO_NOMES.has(semAcentos(p))) continue;
      const seguro = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      t = t.replace(new RegExp(String.raw`(?<![\wÀ-ú])${seguro}(?![\wÀ-ú])`, "gi"), "[nome]");
    }
  }
  t = tirarNomeDepoisDe(
    "sou o|sou a|chamo-me|o meu nome é|o meu nome e|aqui é o|aqui é a|fala o|fala a|Olá|Ola|Oi|Obrigad[oa]|Bom dia|Boa tarde|Boa noite|Cumprimentos|Atenciosamente|Sr\\.?|Sra\\.?|Senhor|Senhora|D\\.|Dona",
    t,
  );
  return t.replace(/(\[nome\]\s*){2,}/g, "[nome] ").replace(/[ \t]{2,}/g, " ").trim();
}

/* ── A guarda: preços, taxas e promessas ───────────────────────────────── */

/** As frases de um texto — para ver se o que é proibido vem negado. */
function frases(texto: string): string[] {
  return texto.split(/[.!?\n]+/).map((f) => f.trim()).filter(Boolean);
}

function negada(frase: string): boolean {
  return /\b(nao|nem|sem|nunca|nenhum|nenhuma)\b/.test(semAcentos(frase));
}

/**
 * PORQUE É QUE ESTA RESPOSTA NÃO PODE SER DITA — ou `null`, quando pode.
 *
 * É a guarda das lições e da resposta livre do modelo: nenhuma muda um preço
 * (euros que não batem com as fontes do site), uma taxa (percentagens que não
 * são o IVA) ou uma promessa (o «próprio dia», os contentores, os big bags),
 * nem diz que a Vitória é uma IA, nem põe a CLYON a fazer o trabalho.
 */
export function motivoParaBloquear(texto: string): string | null {
  const t = String(texto ?? "");
  if (!t.trim()) return null;
  for (const n of eurosNoTexto(t)) {
    if (!euroDasFontes(n)) {
      return `Tem ${String(n).replace(".", ",")} €, que não bate com os preços do site — uma lição não muda preços.`;
    }
  }
  const iva = Math.round(TAXA_IVA * 100);
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)) {
    if (Math.abs(Number(m[1].replace(",", ".")) - iva) > 0.001) {
      return `Tem ${m[1]} %, que não é o IVA — uma lição não muda taxas.`;
    }
  }
  for (const f of frases(t)) {
    const s = semAcentos(f);
    if (/\bproprio\s+dia\b/.test(s) && !negada(f)) return `Promete «no ${PROPRIO_DIA}» — a data é do profissional.`;
    if (/\bcontentor(es)?\b/.test(s) && !negada(f)) return "Fala de contentores — a CLYON não os tem.";
    if (/\bbig\s?-?bags?\b/.test(s) && !negada(f)) return "Fala de big bags — a CLYON não os tem.";
  }
  const s = semAcentos(t);
  if (/\b(inteligencia\s+artificial|assistente\s+virtual|sou\s+(um|uma)\s+(robo|bot|ia)\b)/.test(s)) {
    return "A Vitória é «assistente online» — nunca IA nem virtual.";
  }
  if (/\b(a\s+nossa\s+equipa\s+(vai|leva|faz|carrega|desmonta|recolhe)|vamos\s+buscar|nos\s+(levamos|fazemos\s+o\s+trabalho|recolhemos))\b/.test(s)) {
    return "Fala como empresa que faz o trabalho — quem faz é o profissional escolhido.";
  }
  return null;
}

/* ── A semelhança entre perguntas ──────────────────────────────────────── */

const PALAVRAS_VAZIAS = new Set([
  ..."a o as os um uma uns umas de do da dos das em no na nos nas por para com sem que e ou se me te lhe nos vos ja nao sim ola boa bom dia tarde noite obrigado obrigada por favor isso isto esse essa este esta aqui ai la qual quais como quando onde quanto quanta quantos quantas porque pode podem posso poder vou vai vcs eu ele ela eles elas meu minha seu sua tem tenho ter ser sao era foi fica muito mais menos tambem so ainda entao pois mas ate ao aos".split(" "),
  ...VOCE_SEM_ACENTO,
]);

/** As palavras que contam numa pergunta — sem acentos, sem as vazias, sem o plural. */
export function palavrasDaPergunta(texto: string): string[] {
  const t = semAcentos(String(texto ?? "")).replace(/[^a-z0-9\s]/g, " ");
  const out = new Set<string>();
  for (const w of t.split(/\s+/)) {
    if (w.length < 3 || PALAVRAS_VAZIAS.has(w)) continue;
    out.add(w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);
  }
  return [...out];
}

/** Quanto duas perguntas se parecem, de 0 a 1 (Jaccard das palavras que contam). */
export function semelhanca(a: string, b: string): { indice: number; comuns: number } {
  const A = new Set(palavrasDaPergunta(a));
  const B = new Set(palavrasDaPergunta(b));
  if (A.size === 0 || B.size === 0) return { indice: 0, comuns: 0 };
  let comuns = 0;
  for (const w of A) if (B.has(w)) comuns += 1;
  return { indice: comuns / (A.size + B.size - comuns), comuns };
}

/** Parecem a mesma pergunta? Metade das palavras em comum, e pelo menos duas. */
export function mesmaPergunta(a: string, b: string, limiar = 0.5): boolean {
  const s = semelhanca(a, b);
  return s.comuns >= 2 && s.indice >= limiar;
}

/** É uma pergunta? Um «?», ou começa como uma. */
export function pareceUmaPergunta(texto: string): boolean {
  const t = String(texto ?? "").trim();
  if (/\?/.test(t)) return true;
  return /^(como|quando|quanto|quantos|quantas|qual|quais|onde|porque|porqu[eê]|ser[aá] que|posso|podem|pode|fazem|tem|t[eê]m|aceitam|levam|e se)\b/i.test(
    t,
  );
}

/* ── As lições em uso, na conversa ─────────────────────────────────────── */

/**
 * AS LIÇÕES QUE A CONVERSA CONHECE — carregadas da base com cache curta
 * (`refrescarLicoes`, em `licoes-da-vitoria-na-base.ts`) no princípio de cada
 * mensagem. Ficam aqui para as funções puras da conversa as lerem sem ir à
 * base: aprovar uma lição muda a resposta seguinte, sem deploy.
 */
let EM_USO: LicaoEmUso[] = [];

export function usarLicoes(licoes: readonly LicaoEmUso[]): void {
  EM_USO = licoes.filter((l) => l.pergunta.trim() && l.respostaProposta.trim() && !motivoParaBloquear(l.respostaProposta));
}

export function licoesEmCache(): readonly LicaoEmUso[] {
  return EM_USO;
}

/**
 * A RESPOSTA DE UMA LIÇÃO a esta pergunta — a da lição mais parecida, ou
 * `null`. Só para perguntas, e só com uma semelhança clara: na dúvida, a
 * pergunta continua a ficar anotada para uma pessoa da CLYON.
 */
export function respostaPelasLicoes(
  texto: string,
  licoes: readonly LicaoEmUso[] = EM_USO,
): { id: number; resposta: string } | null {
  const t = String(texto ?? "").trim();
  if (!t || !pareceUmaPergunta(t) || licoes.length === 0) return null;
  let melhor: { id: number; resposta: string; indice: number } | null = null;
  for (const l of licoes) {
    const s = semelhanca(t, l.pergunta);
    if (s.comuns < 2 || s.indice < 0.5) continue;
    if (!melhor || s.indice > melhor.indice) melhor = { id: l.id, resposta: l.respostaProposta.trim(), indice: s.indice };
  }
  return melhor ? { id: melhor.id, resposta: melhor.resposta } : null;
}

/** Quem conta os usos — a base regista-se aqui (`refrescarLicoes`); nos testes, ninguém. */
let AO_USAR: ((id: number) => void) | null = null;

export function quandoSeUsarUmaLicao(f: ((id: number) => void) | null): void {
  AO_USAR = f;
}

/**
 * A RESPOSTA QUE O SITE OU UMA LIÇÃO JÁ TÊM — antes de «Deixo-a anotada».
 * Primeiro o que o site diz (`respostaFrequente`), depois a lição aprovada
 * mais parecida. `contar: false` só pergunta se há, sem contar o uso.
 */
export function respostaDoSiteOuDasLicoes(texto: string, opcoes: { contar?: boolean } = {}): string | null {
  const site = respostaFrequente(texto);
  if (site) return site;
  const l = respostaPelasLicoes(texto);
  if (!l) return null;
  if (opcoes.contar !== false) AO_USAR?.(l.id);
  return l.resposta;
}

/** O bloco das lições para o aviso ao modelo — vazio quando não há nenhuma. */
export function licoesParaOModelo(licoes: readonly LicaoEmUso[] = EM_USO): string {
  if (licoes.length === 0) return "";
  const linhas = licoes
    .slice(0, 40)
    .map((l) => `- Pergunta: «${l.pergunta.slice(0, 300)}» → Resposta: «${l.respostaProposta.slice(0, 500)}»`);
  return `O QUE A EQUIPA DA CLYON TE ENSINOU (lições aprovadas por uma pessoa — usa a resposta quando a pergunta for a mesma, com outras palavras):\n${linhas.join("\n")}`;
}

/* ── Os casos de uma conversa: onde a equipa teve de entrar ────────────── */

export type MensagemDoFio = { id: number; direccao: string; texto: string; criadoEm: Date };

export type CasoDaConversa = {
  origem: OrigemDaLicao;
  /** A mensagem do cliente que deu origem à lição — a chave contra repetidos. */
  mensagemId: number;
  pergunta: string;
  respostaDaEquipa: string | null;
};

/** «Boa pergunta! Deixo-a anotada para…» — a frase antiga e a nova. */
export function eAnotada(texto: string): boolean {
  return /deixo-a anotada para/i.test(texto);
}

/** «Vou passar a conversa a…», «Passo a sua mensagem a…» — a passagem a uma pessoa. */
export function ePassagem(texto: string): boolean {
  return /\b(passo|passar|vou passar)\s+(j[aá]\s+)?(a\s+)?(sua\s+mensagem|conversa)\s+(j[aá]\s+)?a\s+/i.test(texto);
}

/** «Pedido #N registado!» — a Vitória registou o pedido. */
export function ePedidoRegistado(texto: string): boolean {
  return /\bPedido #\d+ registado!/.test(texto);
}

function textoDoCliente(m: MensagemDoFio): string | null {
  if (m.direccao !== "in") return null;
  const t = m.texto.trim();
  if (!t || eMarcaDeImagem(t) || t.startsWith("[áudio]")) return null;
  return t;
}

/** A última mensagem do cliente antes de `i`, e a primeira resposta à mão depois. */
function clienteAntes(fio: MensagemDoFio[], i: number): MensagemDoFio | null {
  for (let j = i - 1; j >= 0 && j >= i - 6; j--) {
    if (textoDoCliente(fio[j])) return fio[j];
  }
  return null;
}

function equipaDepois(fio: MensagemDoFio[], i: number): string | null {
  for (let j = i + 1; j < fio.length; j++) {
    if (fio[j].direccao === "out" && eDaEquipa(fio[j].texto)) return semMarcaDeMao(fio[j].texto);
    if (fio[j].direccao === "in" && j > i + 3) break;
  }
  return null;
}

/**
 * ONDE A EQUIPA TEVE DE ENTRAR, numa conversa — uma lição por caso, só do que
 * aconteceu desde `desde`. Puro.
 */
export function casosDaConversa(fio: MensagemDoFio[], desde: Date): CasoDaConversa[] {
  const casos: CasoDaConversa[] = [];
  const vistos = new Set<string>();
  const juntar = (c: CasoDaConversa) => {
    const chave = `${c.origem}:${c.mensagemId}`;
    if (vistos.has(chave) || !c.pergunta.trim()) return;
    vistos.add(chave);
    casos.push(c);
  };
  const perguntasAntes: MensagemDoFio[] = [];
  fio.forEach((m, i) => {
    const recente = m.criadoEm.getTime() >= desde.getTime();
    if (m.direccao === "in") {
      const t = textoDoCliente(m);
      if (!t || !pareceUmaPergunta(t)) return;
      const repetida = perguntasAntes.find((p) => mesmaPergunta(p.texto, t, 0.6));
      if (recente && repetida) {
        juntar({ origem: "repetida", mensagemId: m.id, pergunta: t, respostaDaEquipa: equipaDepois(fio, i) });
      }
      perguntasAntes.push(m);
      return;
    }
    if (!recente) return;
    const saida = m.texto.trim();
    if (eDaEquipa(saida)) {
      const c = clienteAntes(fio, i);
      const resposta = semMarcaDeMao(saida);
      if (c && pareceUmaPergunta(c.texto) && resposta.length >= 15) {
        juntar({ origem: "equipa_a_mao", mensagemId: c.id, pergunta: c.texto.trim(), respostaDaEquipa: resposta });
      }
      return;
    }
    if (eAnotada(saida)) {
      const c = clienteAntes(fio, i);
      if (c) juntar({ origem: "anotada", mensagemId: c.id, pergunta: c.texto.trim(), respostaDaEquipa: equipaDepois(fio, i) });
      return;
    }
    if (ePassagem(saida)) {
      const c = clienteAntes(fio, i);
      if (c) juntar({ origem: "passagem", mensagemId: c.id, pergunta: c.texto.trim(), respostaDaEquipa: equipaDepois(fio, i) });
    }
  });
  return casos;
}

/* ── O painel da semana ────────────────────────────────────────────────── */

export type NumerosDaSemana = {
  /** Conversas com uma mensagem do cliente na semana. */
  conversas: number;
  /** Dessas, as que chegaram a «Pedido #N registado!» sem a equipa entrar. */
  pedidosSemEquipa: number;
  /** A percentagem, ou `null` sem conversas. */
  percentagem: number | null;
  anotadas: number;
  repetidas: number;
  licoesAprovadas: number;
};

export type MensagemDoPainel = { telefone: string; direccao: string; texto: string; criadoEm: Date };

/**
 * OS NÚMEROS DE UMA SEMANA, entre `inicio` (inclusive) e `fim` (exclusive).
 * A equipa «entrou» quando respondeu à mão ou a conversa passou a uma pessoa.
 * Puro.
 */
export function numerosDaSemana(
  mensagens: readonly MensagemDoPainel[],
  licoes: ReadonlyArray<{ estado: EstadoDaLicao; revistaEm: Date | null }>,
  inicio: Date,
  fim: Date,
): NumerosDaSemana {
  const dentro = (d: Date) => d.getTime() >= inicio.getTime() && d.getTime() < fim.getTime();
  const porNumero = new Map<string, MensagemDoPainel[]>();
  for (const m of mensagens) {
    if (!dentro(m.criadoEm)) continue;
    const k = m.telefone.replace(/\D/g, "").slice(-9);
    const l = porNumero.get(k);
    if (l) l.push(m);
    else porNumero.set(k, [m]);
  }
  let conversas = 0;
  let pedidosSemEquipa = 0;
  let anotadas = 0;
  let repetidas = 0;
  for (const fio of porNumero.values()) {
    fio.sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
    const doCliente = fio.filter((m) => m.direccao === "in");
    if (doCliente.length > 0) conversas += 1;
    const saidas = fio.filter((m) => m.direccao === "out");
    anotadas += saidas.filter((m) => eAnotada(m.texto)).length;
    const equipaEntrou = saidas.some((m) => eDaEquipa(m.texto) || ePassagem(m.texto));
    if (doCliente.length > 0 && !equipaEntrou && saidas.some((m) => ePedidoRegistado(m.texto))) pedidosSemEquipa += 1;
    const perguntas: string[] = [];
    for (const m of doCliente) {
      const t = m.texto.trim();
      if (!pareceUmaPergunta(t)) continue;
      if (perguntas.some((p) => mesmaPergunta(p, t, 0.6))) repetidas += 1;
      perguntas.push(t);
    }
  }
  const licoesAprovadas = licoes.filter(
    (l) => (l.estado === "aprovada" || l.estado === "corrigida") && l.revistaEm && dentro(l.revistaEm),
  ).length;
  return {
    conversas,
    pedidosSemEquipa,
    percentagem: conversas > 0 ? Math.round((pedidosSemEquipa / conversas) * 100) : null,
    anotadas,
    repetidas,
    licoesAprovadas,
  };
}

/** A semana de `agora` e a anterior, de segunda à meia-noite de Lisboa. */
export function semanasEmLisboa(agora: Date): {
  actual: { inicio: Date; fim: Date };
  anterior: { inicio: Date; fim: Date };
} {
  const segunda = segundaDaSemanaEmLisboa(agora);
  const inicio = inicioDoDiaEmLisboa(segunda);
  return {
    actual: { inicio, fim: inicioDoDiaEmLisboa(somarDiasAoDia(segunda, 7)) },
    anterior: { inicio: inicioDoDiaEmLisboa(somarDiasAoDia(segunda, -7)), fim: inicio },
  };
}

export type PainelDaVitoria = {
  actual: NumerosDaSemana;
  anterior: NumerosDaSemana;
  /** «2026-10-26» — a segunda-feira da semana actual, em Lisboa. */
  desde: string;
};

/** O painel: esta semana contra a anterior, em hora de Lisboa. Puro. */
export function painelDaSemana(
  mensagens: readonly MensagemDoPainel[],
  licoes: ReadonlyArray<{ estado: EstadoDaLicao; revistaEm: Date | null }>,
  agora: Date = new Date(),
): PainelDaVitoria {
  const s = semanasEmLisboa(agora);
  return {
    actual: numerosDaSemana(mensagens, licoes, s.actual.inicio, s.actual.fim),
    anterior: numerosDaSemana(mensagens, licoes, s.anterior.inicio, s.anterior.fim),
    desde: segundaDaSemanaEmLisboa(agora),
  };
}
