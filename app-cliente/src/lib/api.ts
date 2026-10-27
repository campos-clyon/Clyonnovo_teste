import Constants from "expo-constants";
import { lerToken } from "./sessao";

/**
 * A ÚNICA PORTA PARA O SITE.
 *
 * A app de cliente não tem base nem regras próprias: tudo o que mostra e faz
 * passa pelas rotas de clyon.pt, as mesmas do site. Os textos de erro vêm da
 * API tal como chegam (`error`); a app só escreve os seus quando o site nem
 * respondeu.
 *
 * O endereço vem do app.json (`extra.site`); `EXPO_PUBLIC_SITE` troca-o, por
 * exemplo para uma pré-visualização da Vercel.
 */
export const SITE: string =
  process.env.EXPO_PUBLIC_SITE ??
  (Constants.expoConfig?.extra as { site?: string } | undefined)?.site ??
  "https://clyon.pt";

/**
 * A VERSÃO DA APP EM CADA PEDIDO — como a Pro (d6). O site grava-a ao renovar
 * a sessão (`POST /api/cliente/sessao`). Não identifica a pessoa: é igual em
 * todos os telemóveis com a mesma versão.
 */
export const CABECALHO_DA_VERSAO = "x-app-versao";
export function versaoDestaApp(): string {
  const v = Constants.expoConfig?.version;
  return typeof v === "string" && v ? v : "0.0.0";
}

export const SEM_REDE = "Sem ligação à internet. Tente outra vez.";
export const REDE_LENTA = "A rede está lenta e o site não respondeu a tempo. Tente outra vez daqui a pouco.";
export const MUITAS_TENTATIVAS = "Muitas tentativas seguidas. Espere um minuto e tente outra vez.";
export const SESSAO_TERMINOU = "A sua sessão terminou. Entre outra vez.";

/** Quanto se espera pelo site antes de desistir (como a Pro, 25-10-2026). */
export const PRAZO_DO_PEDIDO_MS = 20_000;

export class ErroDaApi extends Error {
  constructor(
    message: string,
    readonly estado: number,
    readonly corpo: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/**
 * QUALQUER 401 FAZ SAIR. A especificação (d8): «401 em qualquer chamada → a
 * app apaga o token e volta ao E1 com "A sua sessão terminou. Entre outra
 * vez."». Só não conta o 401 de uma chamada feita sem sessão (a entrada com
 * um link gasto, por exemplo): aí o erro é do link, não da sessão.
 */
let aoPerderASessao: (() => void) | null = null;
export function quandoPerderASessao(fn: (() => void) | null) {
  aoPerderASessao = fn;
}

function sinalComPrazo(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
    const controlo = new AbortController();
    setTimeout(() => controlo.abort(), ms);
    return controlo.signal;
  } catch {
    return undefined;
  }
}

export async function pedir<T>(
  caminho: string,
  opcoes: { metodo?: "GET" | "POST" | "PATCH" | "DELETE"; corpo?: unknown; semSessao?: boolean } = {},
): Promise<T> {
  const cabecalhos: Record<string, string> = { Accept: "application/json", [CABECALHO_DA_VERSAO]: versaoDestaApp() };
  if (opcoes.corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  if (!opcoes.semSessao) {
    const token = await lerToken();
    if (token) cabecalhos.Authorization = `Bearer ${token}`;
  }

  const sinal = sinalComPrazo(PRAZO_DO_PEDIDO_MS);
  let r: Response;
  try {
    r = await fetch(`${SITE}${caminho}`, {
      method: opcoes.metodo ?? "GET",
      headers: cabecalhos,
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      signal: sinal,
    });
  } catch {
    throw new ErroDaApi(sinal?.aborted ? REDE_LENTA : SEM_REDE, 0);
  }

  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await r.json()) as Record<string, unknown>;
  } catch {
    /* resposta sem corpo */
  }

  if (r.status === 401 && !opcoes.semSessao) aoPerderASessao?.();
  if (!r.ok) {
    const mensagem =
      typeof corpo.error === "string"
        ? corpo.error
        : r.status === 429
          ? MUITAS_TENTATIVAS
          : r.status >= 500
            ? "O site não respondeu como devia. Tente outra vez daqui a pouco."
            : "Não foi possível fazer isto agora.";
    throw new ErroDaApi(mensagem, r.status, corpo);
  }
  return corpo as T;
}
