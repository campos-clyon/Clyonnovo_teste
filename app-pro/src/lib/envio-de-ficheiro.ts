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
 * 2. tenta-se outra vez por outro caminho (a segunda via);
 * 3. só se diz «sem ligação» quando se confirma que não há rede; com rede,
 *    diz-se que o envio falhou e que não é da rede.
 *
 * Desde a d14 (13-11-2026) a ORDEM inverteu-se: primeiro o `uploadAsync` do
 * expo-file-system (lê o ficheiro do disco pelo lado nativo), e o `fetch` com
 * FormData só como segunda via — ver `enviarPorVias`.
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
 * Uma via esgotou o prazo. Pode ter chegado ao site (o envio ia a meio):
 * não se tenta a outra via, para a fotografia não subir duas vezes, e o ecrã
 * mostra a frase da rede lenta.
 */
export class PrazoDoEnvio extends Error {
  constructor(readonly erro: unknown) {
    super(`prazo: ${textoDoErro(erro)}`);
  }
}

/** Uma via do envio: qual é, e como se manda. Lança se não chegou ao site. */
export type ViaDoEnvio = { tentativa: Tentativa; enviar: () => Promise<RespostaDoEnvio> };

/**
 * A ORDEM DAS VIAS — 13-11-2026 (decisão d14).
 *
 * Na build do runtime dcf63afc o `fetch` com FormData falha sempre
 * («Unsupported FormDataPart implementation», erros da app de 13/11) e era o
 * `uploadAsync` que salvava o envio. Agora a app manda PRIMEIRO pelo
 * `uploadAsync` e o `fetch` passa a segunda via — só quando o `uploadAsync` não
 * existe (não entra em `vias`) ou falha sem ter chegado ao site.
 *
 * Tenta as vias por ordem. Uma resposta do site (qualquer estado) devolve-se
 * logo. Uma via que falha de verdade fica registada; o prazo esgotado
 * (`PrazoDoEnvio`) regista-se e pára tudo. Se a última também falhar,
 * pergunta-se à rede e lança-se a frase certa: «sem ligação» só sem rede
 * confirmada.
 */
export async function enviarPorVias(opcoes: {
  caminho: string;
  vias: readonly ViaDoEnvio[];
  haRede: () => Promise<boolean | null>;
  aoRegistar?: (f: FalhaDoEnvio) => void;
  agora?: () => Date;
}): Promise<RespostaDoEnvio> {
  const agora = opcoes.agora ?? (() => new Date());
  let ultima: unknown = new Error("sem via de envio");
  let tentativa: Tentativa = "fetch";
  for (let i = 0; i < opcoes.vias.length; i++) {
    const via = opcoes.vias[i];
    try {
      return await via.enviar();
    } catch (e) {
      if (e instanceof PrazoDoEnvio) {
        registarOPrazo(opcoes.caminho, e.erro, opcoes.aoRegistar, agora(), via.tentativa);
        throw e;
      }
      ultima = e;
      tentativa = via.tentativa;
      // Antes de tentar a via seguinte, a falha desta fica registada.
      if (i < opcoes.vias.length - 1) {
        registar({ quando: agora().toISOString(), caminho: opcoes.caminho, tentativa, erro: textoDoErro(e), rede: "por saber" }, opcoes.aoRegistar);
      }
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
export function registarOPrazo(
  caminho: string,
  erro: unknown,
  aoRegistar?: (f: FalhaDoEnvio) => void,
  agora: Date = new Date(),
  tentativa: Tentativa = "uploadAsync",
): void {
  registar({ quando: agora.toISOString(), caminho, tentativa, erro: `prazo: ${textoDoErro(erro)}`, rede: "por saber" }, aoRegistar);
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
