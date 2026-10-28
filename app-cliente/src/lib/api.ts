import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";
import { versaoDaApp } from "./erro-da-app";
import { ErroDaApi, mensagemDaResposta, REDE_LENTA, SEM_REDE, type OpcoesDoPedido } from "./erros";
import { lerToken } from "./sessao";

export { ErroDaApi, MUITAS_TENTATIVAS, REDE_LENTA, SEM_REDE, SESSAO_TERMINOU, mensagemDe } from "./erros";

/**
 * A ÚNICA PORTA PARA O SITE.
 *
 * A app de cliente não tem base nem regras próprias: tudo o que mostra e faz
 * passa pelas rotas de clyon.pt, as mesmas do site. Os textos de erro vêm da
 * API tal como chegam (`error`); a app só escreve os seus quando o site nem
 * respondeu (`erros.ts`).
 *
 * O endereço vem do app.json (`extra.site`); `EXPO_PUBLIC_SITE` troca-o, por
 * exemplo para uma pré-visualização da Vercel.
 */
export const SITE: string =
  process.env.EXPO_PUBLIC_SITE ??
  (Constants.expoConfig?.extra as { site?: string } | undefined)?.site ??
  "https://clyon.pt";

/**
 * A VERSÃO DA APP EM CADA PEDIDO — como a Pro (d6): «0.1.0 (01a1741b)» com um
 * EAS Update, «0.1.0 (base)» com o que veio na instalação. O site grava-a ao
 * renovar a sessão (`POST /api/cliente/sessao`). Não identifica a pessoa: é
 * igual em todos os telemóveis com a mesma versão.
 */
export const CABECALHO_DA_VERSAO = "x-app-versao";
export function versaoDestaApp(): string {
  const v = Constants.expoConfig?.version;
  const id = Platform.OS === "web" ? null : Updates.updateId;
  return versaoDaApp(typeof v === "string" && v ? v : "0.0.0", id);
}

/** Quanto se espera pelo site antes de desistir (como a Pro, 25-10-2026). */
export const PRAZO_DO_PEDIDO_MS = 20_000;

/**
 * QUALQUER 401 FAZ SAIR. A especificação: «401 em qualquer chamada → a app
 * apaga o token e volta ao E1 com "A sua sessão terminou. Entre outra vez."».
 * Só não conta o 401 de uma chamada feita sem sessão (a entrada com um link
 * gasto, por exemplo): aí o erro é do link, não da sessão. E o 401 de um token
 * que já não é o guardado (trocou-se de conta entretanto) também não.
 */
let aoPerderASessao: (() => void) | null = null;
export function quandoPerderASessao(fn: (() => void) | null) {
  aoPerderASessao = fn;
}

export function sinalComPrazo(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
    const controlo = new AbortController();
    setTimeout(() => controlo.abort(), ms);
    return controlo.signal;
  } catch {
    return undefined;
  }
}

async function chamar<T>(caminho: string, opcoes: OpcoesDoPedido, token: string | null, podeFazerSair: boolean): Promise<T> {
  const cabecalhos: Record<string, string> = { Accept: "application/json", [CABECALHO_DA_VERSAO]: versaoDestaApp() };
  if (opcoes.corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  if (token) cabecalhos.Authorization = `Bearer ${token}`;

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
  if (r.status === 401 && podeFazerSair && token && token === (await lerToken())) aoPerderASessao?.();
  if (!r.ok) throw new ErroDaApi(mensagemDaResposta(r.status, corpo), r.status, corpo);
  return corpo as T;
}

/** Uma chamada ao site — com a sessão guardada, salvo `semSessao`. */
export async function pedir<T>(caminho: string, opcoes: OpcoesDoPedido = {}): Promise<T> {
  const token = opcoes.semSessao ? null : await lerToken();
  return chamar<T>(caminho, opcoes, token, !opcoes.semSessao);
}

/** Uma chamada com um token dado (tirar o telemóvel da conta antiga ao trocar de conta). Nunca faz sair. */
export function pedirComToken<T>(caminho: string, token: string, opcoes: OpcoesDoPedido = {}): Promise<T> {
  return chamar<T>(caminho, opcoes, token, false);
}
