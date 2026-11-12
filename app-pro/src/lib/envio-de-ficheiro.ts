/**
 * O ENVIO DE UM FICHEIRO NÃO DIZ «SEM LIGAÇÃO» QUANDO HÁ REDE — 12-11-2026 (decisão d9).
 *
 * Um candidato com rede a funcionar via «A fotografia não seguiu: sem ligação
 * à internet» ao juntar a fotografia da carrinha. O `fetch` com FormData do
 * React Native falha às vezes por razões que não são a rede (o ficheiro que
 * não se lê, o multipart que o Android recusa) e a app dava a todas a mesma
 * frase. Agora:
 * 1. guarda-se o erro real num registo de diagnóstico (aqui, em memória, e
 *    uma vez por erro no `erro-da-app` do site, sem dados de pessoas);
 * 2. tenta-se outra vez por outro caminho — o `uploadAsync` do expo-file-system,
 *    que lê o ficheiro do disco pelo lado nativo;
 * 3. só se diz «sem ligação» quando se confirma que não há rede; com rede,
 *    diz-se que o envio falhou e que não é da rede.
 *
 * Esta parte é pura (corre nos testes do site): quem lhe dá o `fetch`, o
 * `uploadAsync` e a prova da rede é `api.ts`.
 */

export const MENSAGEM_DO_FICHEIRO_SEM_REDE = "A fotografia não seguiu: sem ligação à internet. Tente outra vez.";
export const MENSAGEM_DO_FICHEIRO_QUE_FALHOU =
  "A fotografia não seguiu. A rede está ligada, por isso o problema foi no envio — tente outra vez daqui a pouco.";
export const MAXIMO_DO_REGISTO = 20;

export type Tentativa = "fetch" | "uploadAsync";
export type EstadoDaRede = "com rede" | "sem rede" | "por saber";

export type FalhaDoEnvio = {
  quando: string;
  caminho: string;
  tentativa: Tentativa;
  /** O erro real, como veio («TypeError: Network request failed»). */
  erro: string;
  rede: EstadoDaRede;
};

/** O que volta de uma tentativa que chegou ao site: o estado e o corpo já lido. */
export type RespostaDoEnvio = { estado: number; corpo: Record<string, unknown> };

const registo: FalhaDoEnvio[] = [];

/** As últimas falhas deste arranque, da mais antiga para a mais nova. */
export function falhasDoEnvio(): readonly FalhaDoEnvio[] {
  return registo;
}

export function limparFalhasDoEnvio(): void {
  registo.length = 0;
}

export function textoDoErro(e: unknown): string {
  if (e instanceof Error) return `${e.name && e.name !== "Error" ? `${e.name}: ` : ""}${e.message || "sem mensagem"}`;
  if (typeof e === "string") return e || "sem mensagem";
  return "erro sem mensagem";
}

function registar(falha: FalhaDoEnvio, aoRegistar?: (f: FalhaDoEnvio) => void): void {
  registo.push(falha);
  while (registo.length > MAXIMO_DO_REGISTO) registo.shift();
  try {
    aoRegistar?.(falha);
  } catch {
    /* o registo nunca faz falhar o envio */
  }
}

/** O erro que o ecrã mostra: estado 0 (o site não respondeu) e a frase certa. */
export class FalhaDoFicheiro extends Error {
  constructor(
    message: string,
    readonly rede: EstadoDaRede,
  ) {
    super(message);
  }
}

/**
 * Depois de o `fetch` lançar (não chegou ao site, e não foi o prazo): regista
 * o erro, tenta por `porUpload` e, se também falhar, regista, pergunta à rede
 * e lança a frase certa. Se a segunda via chegar ao site, devolve a resposta.
 */
export async function recuperarDoEnvio(opcoes: {
  caminho: string;
  erroDoFetch: unknown;
  porUpload: (() => Promise<RespostaDoEnvio>) | null;
  haRede: () => Promise<boolean | null>;
  aoRegistar?: (f: FalhaDoEnvio) => void;
  agora?: () => Date;
}): Promise<RespostaDoEnvio> {
  const agora = opcoes.agora ?? (() => new Date());
  let ultima: unknown = opcoes.erroDoFetch;
  let tentativa: Tentativa = "fetch";
  if (opcoes.porUpload) {
    // A primeira falha fica registada antes de se tentar a segunda.
    registar({ quando: agora().toISOString(), caminho: opcoes.caminho, tentativa: "fetch", erro: textoDoErro(ultima), rede: "por saber" }, opcoes.aoRegistar);
    try {
      return await opcoes.porUpload();
    } catch (e) {
      ultima = e;
      tentativa = "uploadAsync";
    }
  }
  let rede: boolean | null = null;
  try {
    rede = await opcoes.haRede();
  } catch {
    rede = null;
  }
  const estado: EstadoDaRede = rede === false ? "sem rede" : rede === true ? "com rede" : "por saber";
  registar({ quando: agora().toISOString(), caminho: opcoes.caminho, tentativa, erro: textoDoErro(ultima), rede: estado }, opcoes.aoRegistar);
  // Só a falta de rede CONFIRMADA dá «sem ligação». Sem saber, não se acusa a rede.
  throw new FalhaDoFicheiro(rede === false ? MENSAGEM_DO_FICHEIRO_SEM_REDE : MENSAGEM_DO_FICHEIRO_QUE_FALHOU, estado);
}

/** O prazo esgotou: fica no registo, e o ecrã mostra a frase da rede lenta. */
export function registarOPrazo(caminho: string, erro: unknown, aoRegistar?: (f: FalhaDoEnvio) => void, agora: Date = new Date()): void {
  registar({ quando: agora.toISOString(), caminho, tentativa: "fetch", erro: `prazo: ${textoDoErro(erro)}`, rede: "por saber" }, aoRegistar);
}

/** O corpo de uma resposta em texto (o `uploadAsync` devolve texto), ou {}. */
export function corpoDeTexto(texto: string | null | undefined): Record<string, unknown> {
  if (!texto) return {};
  try {
    const v: unknown = JSON.parse(texto);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
