import { MAXIMO_DA_MENSAGEM, MAXIMO_DO_ECRA, MAXIMO_DA_VERSAO, semDadosDePessoas } from "../../../src/lib/erros-da-app";

/**
 * UM ECRÃ REBENTOU: A EQUIPA FICA A SABER — 25-10-2026 (decisão d13).
 *
 * O ecrã de erro da raiz (`_layout.tsx`) manda o erro ao site, que o conta na
 * secção Profissionais do backoffice (`POST /api/profissionais/erro-da-app`).
 * Até aqui só o profissional sabia — e muitas vezes fechava e voltava a abrir
 * sem dizer nada.
 *
 * O QUE SAI DO TELEMÓVEL: a versão da app, o ecrã (o caminho com os nomes das
 * rotas — «trabalho/[id]», nunca o número do trabalho nem o token de um link),
 * uma mensagem curta e quando foi. SEM SESSÃO: não vai o token, nem a conta,
 * nem o telemóvel. A mensagem é limpa aqui, com a mesma regra do site
 * (`semDadosDePessoas`), antes de sair — o site volta a limpá-la ao gravar.
 *
 * UMA VEZ POR ERRO: o mesmo erro no mesmo ecrã conta-se uma vez por arranque
 * (o «Tentar outra vez» que volta a rebentar não manda outro), e no máximo
 * `MAXIMO_POR_ARRANQUE` erros diferentes. Sem rede, ou se o site não
 * responder, não acontece nada: nunca lança, nunca tenta outra vez.
 *
 * Esta parte é pura (corre nos testes do site); quem a liga ao Expo é a raiz.
 */

export const ROTA_DO_ERRO_DA_APP = "/api/profissionais/erro-da-app";
export const MAXIMO_POR_ARRANQUE = 5;
export const PRAZO_DO_ERRO_MS = 10_000;

export type CorpoDoErro = { versao: string; ecra: string; mensagem: string; quando: string };

function cortar(s: string, maximo: number): string {
  const chars = [...s];
  return chars.length <= maximo ? s : chars.slice(0, maximo - 1).join("") + "…";
}

/** «0.1.0 (01a1741b)» com um EAS Update; «0.1.0 (base)» com o que veio na loja. */
export function versaoDaApp(versao: string | null | undefined, idDaActualizacao: string | null | undefined): string {
  const base = (versao ?? "").trim() || "?";
  const id = (idDaActualizacao ?? "").replace(/[^0-9A-Za-z]/g, "").slice(0, 8);
  return cortar(`${base} (${id || "base"})`, MAXIMO_DA_VERSAO);
}

/** O ecrã pelos nomes das rotas: `["trabalho", "[id]"]` → «trabalho/[id]». */
export function ecraDe(segmentos: readonly string[] | null | undefined): string {
  const nomes = (segmentos ?? []).filter((s) => typeof s === "string" && s.length > 0);
  return cortar(semDadosDePessoas(nomes.length > 0 ? nomes.join("/") : "inicio"), MAXIMO_DO_ECRA) || "?";
}

/** O corpo que vai para o site: só estes quatro campos. */
export function corpoDoErro(erro: unknown, ecra: string, versao: string, agora: Date = new Date()): CorpoDoErro {
  const texto =
    erro instanceof Error
      ? `${erro.name && erro.name !== "Error" ? `${erro.name}: ` : ""}${erro.message}`
      : typeof erro === "string"
        ? erro
        : "Erro sem mensagem";
  const mensagem = cortar(semDadosDePessoas(texto), MAXIMO_DA_MENSAGEM) || "Erro sem mensagem";
  return { versao, ecra, mensagem, quando: agora.toISOString() };
}

/** Manda o erro ao site, sem sessão. Nunca lança: sem rede, fica por aqui. */
export async function enviarErroDaApp(
  site: string,
  corpo: CorpoDoErro,
  buscar: typeof fetch = fetch,
): Promise<boolean> {
  try {
    let sinal: AbortSignal | undefined;
    try {
      sinal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(PRAZO_DO_ERRO_MS) : undefined;
    } catch {
      sinal = undefined;
    }
    const r = await buscar(`${site}${ROTA_DO_ERRO_DA_APP}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: sinal,
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * O contador de um arranque: devolve uma função que manda cada erro uma vez
 * só (pelo ecrã e pela mensagem) e pára ao fim de `maximo`. Diz se mandou.
 */
export function contadorDeErros(
  enviar: (corpo: CorpoDoErro) => Promise<unknown>,
  maximo: number = MAXIMO_POR_ARRANQUE,
): (corpo: CorpoDoErro) => boolean {
  const vistos = new Set<string>();
  return (corpo) => {
    const chave = `${corpo.ecra}|${corpo.mensagem}`;
    if (vistos.has(chave) || vistos.size >= maximo) return false;
    vistos.add(chave);
    try {
      void Promise.resolve(enviar(corpo)).catch(() => {});
    } catch {
      /* nunca deixa o ecrã de erro rebentar também */
    }
    return true;
  };
}
