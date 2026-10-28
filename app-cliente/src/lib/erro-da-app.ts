import { MAXIMO_DA_MENSAGEM, MAXIMO_DO_ECRA, MAXIMO_DA_VERSAO, semDadosDePessoas } from "../../../src/lib/erros-da-app";

/**
 * UM ECRÃ REBENTOU: A EQUIPA FICA A SABER — como a Pro (d13), para a app de
 * cliente (regra 7 da Segurança, S3: `POST /api/cliente/erro-da-app`).
 *
 * O QUE SAI DO TELEMÓVEL: a versão da app (com o id do update), o ecrã pelo
 * nome da rota («pedido/[id]», nunca o número do pedido nem o token de um
 * link), uma mensagem curta e quando foi. SEM SESSÃO: não vai o token, nem a
 * conta, nem o telemóvel. A mensagem é limpa aqui, com a mesma regra do site
 * (`semDadosDePessoas`), antes de sair — o site volta a limpá-la ao gravar.
 *
 * UMA VEZ POR ERRO e no máximo `MAXIMO_POR_ARRANQUE` por arranque. Sem rede, ou
 * com a rota ainda por fazer, não acontece nada: nunca lança, nunca repete.
 *
 * Puro de propósito: os testes do site importam-no.
 */

export const ROTA_DO_ERRO_DA_APP = "/api/cliente/erro-da-app";
export const MAXIMO_POR_ARRANQUE = 5;
export const PRAZO_DO_ERRO_MS = 10_000;

export type CorpoDoErro = { versao: string; ecra: string; mensagem: string; quando: string };

function cortar(s: string, maximo: number): string {
  const chars = [...s];
  return chars.length <= maximo ? s : chars.slice(0, maximo - 1).join("") + "…";
}

/** «0.1.0 (01a1741b)» com um EAS Update; «0.1.0 (base)» com o que veio na instalação. */
export function versaoDaApp(versao: string | null | undefined, idDaActualizacao: string | null | undefined): string {
  const base = (versao ?? "").trim() || "?";
  const id = (idDaActualizacao ?? "").replace(/[^0-9A-Za-z]/g, "").slice(0, 8);
  return cortar(`${base} (${id || "base"})`, MAXIMO_DA_VERSAO);
}

/** O ecrã pelos nomes das rotas: `["pedido", "[id]"]` → «pedido/[id]». */
export function ecraDe(segmentos: readonly string[] | null | undefined): string {
  const nomes = (segmentos ?? []).filter((s) => typeof s === "string" && s.length > 0);
  return cortar(semDadosDePessoas(nomes.length > 0 ? nomes.join("/") : "inicio"), MAXIMO_DO_ECRA) || "?";
}

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

/** Manda o erro ao site, sem sessão. Nunca lança. */
export async function enviarErroDaApp(site: string, corpo: CorpoDoErro, buscar: typeof fetch = fetch): Promise<boolean> {
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

/** Manda cada erro uma vez só (pelo ecrã e pela mensagem) e pára ao fim de `maximo`. */
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
