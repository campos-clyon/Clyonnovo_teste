import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { EM_DEMO, pedirEmDemo } from "./demo";
import { versaoDaApp } from "./erro-da-app";
import { guardarToken, lerToken } from "./sessao";

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

/**
 * A VERSÃO DA APP EM CADA PEDIDO — 27-10-2026 (decisão d6).
 *
 * «0.1.0 (01a1782e)» — a versão da loja e o EAS Update que está a correr, a
 * mesma que vai no erro-da-app. O site grava-a ao renovar a sessão
 * (`POST /api/profissionais/sessao`, `providers.appVersao`) e o backoffice
 * mostra quem tem a app e com que versão. Não identifica a pessoa: é igual
 * em todos os telemóveis com a mesma actualização.
 */
export const CABECALHO_DA_VERSAO = "x-app-versao";
let versaoLida: string | null = null;
function versaoDestaApp(): string {
  if (versaoLida === null) {
    try {
      versaoLida = versaoDaApp(Constants.expoConfig?.version, Updates.updateId);
    } catch {
      versaoLida = versaoDaApp(Constants.expoConfig?.version, null);
    }
  }
  return versaoLida;
}

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

/**
 * A SESSÃO NOVA — 25-10-2026 (decisão d14).
 *
 * Mudar a palavra-passe ou «Sair de todos os aparelhos» fecha no site as
 * sessões de antes (`providers.sessoesDesde`) — também a deste telemóvel — e
 * o site devolve logo um token novo (`{ ok, token }`). Guarda-se no lugar do
 * antigo; sem isso, quem mudava a palavra-passe na app era posto fora.
 *
 * Enquanto a troca está a meio, um pedido que já tinha saído com o token
 * antigo (a lista renova-se de minuto a minuto) pode voltar com 401: esse não
 * faz sair. Também não faz sair o 401 de um token que entretanto já foi
 * trocado. O 401 da própria troca continua a fazer sair.
 */
let trocasEmCurso = 0;

export async function pedirComSessaoNova<T extends { token?: unknown }>(caminho: string, corpo?: unknown): Promise<T> {
  trocasEmCurso += 1;
  let r: T;
  try {
    r = await pedir<T>(caminho, { metodo: "POST", corpo });
    if (typeof r.token === "string" && r.token) await guardarToken(r.token);
  } catch (e) {
    trocasEmCurso -= 1;
    if (e instanceof ErroDaApi && e.estado === 401) aoPerderASessao?.();
    throw e;
  }
  trocasEmCurso -= 1;
  return r;
}

/** Um 401 só faz sair se o token que o levou ainda for o desta sessão. */
async function perdeuASessao(tokenUsado: string | null): Promise<void> {
  if (trocasEmCurso > 0) return;
  if (tokenUsado !== null && tokenUsado !== (await lerToken())) return;
  aoPerderASessao?.();
}

/**
 * QUANTO SE ESPERA PELO SITE — 25-10-2026.
 *
 * Sem prazo, uma chamada com a rede fraca ficava a rodar sem fim: o botão
 * preso em «A enviar…» e nenhuma mensagem. Só a falta total de rede dava
 * «Sem ligação». Agora desiste-se ao fim de 20 s (60 s para os ficheiros, que
 * pesam) e diz-se que a rede está lenta. O estado continua a ser 0: o site
 * não respondeu.
 */
export const PRAZO_DO_PEDIDO_MS = 20_000;
export const PRAZO_DO_FICHEIRO_MS = 60_000;
export const MENSAGEM_DE_REDE_LENTA =
  "A rede está lenta e o site não respondeu a tempo. Tente outra vez daqui a pouco.";
export const MENSAGEM_DE_FICHEIRO_LENTO =
  "A fotografia não seguiu: a rede está lenta e o envio passou de um minuto. Tente outra vez com melhor rede.";

/**
 * O sinal que desiste ao fim do prazo. No Android e no iPhone o
 * `AbortSignal.timeout` vem do Expo (expo/src/winter); o resto é rede de
 * segurança, para um pedido nunca falhar por causa do próprio prazo.
 */
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
  opcoes: { metodo?: "GET" | "POST" | "PUT" | "DELETE"; corpo?: unknown; semSessao?: boolean } = {},
): Promise<T> {
  if (EM_DEMO) return pedirEmDemo<T>(caminho, opcoes.metodo ?? "GET", opcoes.corpo);
  const cabecalhos: Record<string, string> = { Accept: "application/json", [CABECALHO_DA_VERSAO]: versaoDestaApp() };
  if (opcoes.corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  let tokenUsado: string | null = null;
  if (!opcoes.semSessao) {
    tokenUsado = await lerToken();
    if (tokenUsado) cabecalhos.Authorization = `Bearer ${tokenUsado}`;
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
    if (sinal?.aborted) throw new ErroDaApi(MENSAGEM_DE_REDE_LENTA, 0);
    throw new ErroDaApi("Sem ligação à internet. Tente outra vez daqui a pouco.", 0);
  }
  return lerResposta<T>(r, !!opcoes.semSessao, tokenUsado);
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
  const cabecalhos: Record<string, string> = { Accept: "application/json", [CABECALHO_DA_VERSAO]: versaoDestaApp() };
  const tokenUsado = await lerToken();
  if (tokenUsado) cabecalhos.Authorization = `Bearer ${tokenUsado}`;
  const sinal = sinalComPrazo(PRAZO_DO_FICHEIRO_MS);
  let r: Response;
  try {
    // Sem Content-Type: o fetch escreve-o, com a fronteira do multipart.
    r = await fetch(`${SITE}${caminho}`, { method: "POST", headers: cabecalhos, body: corpo, signal: sinal });
  } catch {
    if (sinal?.aborted) throw new ErroDaApi(MENSAGEM_DE_FICHEIRO_LENTO, 0);
    throw new ErroDaApi("A fotografia não seguiu: sem ligação à internet. Tente outra vez.", 0);
  }
  return lerResposta<T>(r, false, tokenUsado);
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

async function lerResposta<T>(r: Response, semSessao: boolean, tokenUsado: string | null): Promise<T> {
  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await r.json()) as Record<string, unknown>;
  } catch {
    /* resposta sem corpo */
  }

  if (r.status === 401 && !semSessao) await perdeuASessao(tokenUsado);
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
