import Constants from "expo-constants";
import { EM_DEMO, pedirEmDemo } from "./demo";
import { lerToken } from "./sessao";

/**
 * A ÚNICA PORTA PARA O SITE.
 *
 * A app não tem base nem regras próprias: tudo o que mostra e tudo o que faz
 * passa pelas rotas do painel do profissional em clyon.pt, as mesmas que o
 * painel no navegador usa. Assim há uma só verdade — o erro que deitou abaixo
 * as apps antigas foi cada uma ter a sua.
 *
 * O endereço vem do app.json (`extra.site`); `EXPO_PUBLIC_SITE` troca-o, por
 * exemplo para uma pré-visualização da Vercel.
 */
export const SITE: string =
  process.env.EXPO_PUBLIC_SITE ??
  (Constants.expoConfig?.extra as { site?: string } | undefined)?.site ??
  "https://clyon.pt";

export class ErroDaApi extends Error {
  constructor(
    message: string,
    readonly estado: number,
    readonly corpo: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Chamado quando o site responde 401: a sessão acabou ou a conta foi fechada. */
let aoPerderASessao: (() => void) | null = null;
export function quandoPerderASessao(fn: (() => void) | null) {
  aoPerderASessao = fn;
}

export async function pedir<T>(
  caminho: string,
  opcoes: { metodo?: "GET" | "POST" | "PUT" | "DELETE"; corpo?: unknown; semSessao?: boolean } = {},
): Promise<T> {
  if (EM_DEMO) return pedirEmDemo<T>(caminho, opcoes.metodo ?? "GET", opcoes.corpo);
  const cabecalhos: Record<string, string> = { Accept: "application/json" };
  if (opcoes.corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  if (!opcoes.semSessao) {
    const token = await lerToken();
    if (token) cabecalhos.Authorization = `Bearer ${token}`;
  }

  let r: Response;
  try {
    r = await fetch(`${SITE}${caminho}`, {
      method: opcoes.metodo ?? "GET",
      headers: cabecalhos,
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    });
  } catch {
    throw new ErroDaApi("Sem ligação à internet. Tente outra vez daqui a pouco.", 0);
  }
  return lerResposta<T>(r, !!opcoes.semSessao);
}

/**
 * Uma fotografia do trabalho, já reduzida pela app, para o armazenamento da
 * CLYON (`POST /api/profissionais/trabalho/fotos`). Devolve o endereço que
 * entra depois no ajuste ou na prova.
 */
export async function enviarFotografia(
  negociacaoId: number,
  ficheiro: { uri: string; nome: string; tipo: string },
): Promise<{ url: string }> {
  return enviarFicheiro<{ url: string }>("/api/profissionais/trabalho/fotos", { negociacaoId: String(negociacaoId) }, ficheiro);
}

/** Um ficheiro (campo `file`) e campos de texto, num POST multipart com a sessão. */
export async function enviarFicheiro<T>(
  caminho: string,
  campos: Record<string, string>,
  ficheiro: { uri: string; nome: string; tipo: string },
): Promise<T> {
  if (EM_DEMO) return pedirEmDemo<T>(caminho, "POST", { ...campos, url: ficheiro.uri });
  const corpo = new FormData();
  for (const [k, v] of Object.entries(campos)) corpo.append(k, v);
  // O React Native lê o ficheiro do disco a partir de {uri, name, type}.
  corpo.append("file", { uri: ficheiro.uri, name: ficheiro.nome, type: ficheiro.tipo } as unknown as Blob);
  const cabecalhos: Record<string, string> = { Accept: "application/json" };
  const token = await lerToken();
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  let r: Response;
  try {
    // Sem Content-Type: o fetch escreve-o, com a fronteira do multipart.
    r = await fetch(`${SITE}${caminho}`, { method: "POST", headers: cabecalhos, body: corpo });
  } catch {
    throw new ErroDaApi("A fotografia não seguiu: sem ligação à internet. Tente outra vez.", 0);
  }
  return lerResposta<T>(r, false);
}

/** Os erros por campo que as rotas de gravar devolvem (`erros: [{campo, mensagem}]`). */
export function errosPorCampo(e: unknown): Record<string, string> {
  if (!(e instanceof ErroDaApi) || !Array.isArray(e.corpo.erros)) return {};
  const saida: Record<string, string> = {};
  for (const x of e.corpo.erros as Array<{ campo?: unknown; mensagem?: unknown }>) {
    if (typeof x.campo === "string" && typeof x.mensagem === "string" && !saida[x.campo]) saida[x.campo] = x.mensagem;
  }
  return saida;
}

async function lerResposta<T>(r: Response, semSessao: boolean): Promise<T> {
  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await r.json()) as Record<string, unknown>;
  } catch {
    /* resposta sem corpo */
  }

  if (r.status === 401 && !semSessao) aoPerderASessao?.();
  if (!r.ok) {
    const mensagem =
      typeof corpo.error === "string"
        ? corpo.error
        : r.status >= 500
          ? "O site não respondeu como devia. Tente outra vez daqui a pouco."
          : "Não foi possível fazer isto agora.";
    throw new ErroDaApi(mensagem, r.status, corpo);
  }
  return corpo as T;
}
