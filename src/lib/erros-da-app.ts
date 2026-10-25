/**
 * OS ERROS DA APP CLYON PRO CHEGAM À EQUIPA — 25-10-2026.
 *
 * Quando a app rebentava num ecrã, só o profissional sabia — e muitas vezes
 * nem ele dizia nada: fechava e voltava a abrir. A app passa a mandar o erro
 * ao site (`POST /api/profissionais/erro-da-app`), e o backoffice mostra
 * quantos houve nos últimos 7 dias, na secção Profissionais.
 *
 * SEM DADOS DE PESSOAS. Guarda-se só a versão da app, o ecrã, uma mensagem
 * curta e quando aconteceu — nem a conta, nem o telemóvel, nem o endereço de
 * onde veio. E a mensagem passa por `semDadosDePessoas` antes de se gravar:
 * um erro pode levar um email, um telefone ou um token lá dentro sem ninguém
 * querer.
 *
 * Este ficheiro é a parte pura: ler e limpar o que a app manda. A tabela e as
 * consultas estão em db.ts (`registarErroDaApp`, `resumoDosErrosDaApp`).
 */

export const MAXIMO_DA_VERSAO = 20;
export const MAXIMO_DO_ECRA = 60;
export const MAXIMO_DA_MENSAGEM = 200;
/** Os dias que o backoffice conta. */
export const DIAS_DOS_ERROS = 7;

export type ErroDaApp = {
  versao: string;
  ecra: string;
  mensagem: string;
  quando: Date;
};

const umaLinha = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Tira de um texto o que pode identificar uma pessoa ou abrir uma conta:
 * emails, tokens (da Expo, de sessão, de links), sequências de números
 * (telefones, NIF, IBAN, cartões) e o que vem depois do «?» de um endereço.
 */
export function semDadosDePessoas(texto: string): string {
  return umaLinha(texto)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/Expo(nent)?PushToken\[[^\]]*\]/g, "[token]")
    .replace(/\beyJ[\w-]+\.[\w-]+(\.[\w-]+)?/g, "[token]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [token]")
    .replace(/\b(token|chave|key|senha|password)\s*[:=]\s*\S+/gi, "$1=[token]")
    .replace(/\bPT\d{2}(?:[ .]?\d){21}\b/gi, "[iban]")
    .replace(/(?:\+?\d[\d .-]{6,}\d)/g, "[número]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[código]")
    .replace(/(https?:\/\/[^\s?#]+)[?#]\S*/gi, "$1");
}

function cortar(s: string, maximo: number): string {
  const chars = [...s];
  return chars.length <= maximo ? s : chars.slice(0, maximo - 1).join("") + "…";
}

/**
 * QUANDO: o que a app diz, se for de há menos de 7 dias e não do futuro (com
 * cinco minutos de folga para o relógio do telemóvel); senão, agora.
 */
export function quandoDoErro(dito: unknown, agora: Date = new Date()): Date {
  const d = typeof dito === "string" || typeof dito === "number" ? new Date(dito) : null;
  if (!d || Number.isNaN(d.getTime())) return agora;
  const t = d.getTime();
  if (t > agora.getTime() + 5 * 60 * 1000) return agora;
  if (t < agora.getTime() - DIAS_DOS_ERROS * 24 * 60 * 60 * 1000) return agora;
  return d;
}

/**
 * O que a app mandou, lido e limpo — ou null se não houver mensagem.
 * Campos a mais (o email, o id da conta, o telemóvel) não passam daqui.
 */
export function lerErroDaApp(corpo: unknown, agora: Date = new Date()): ErroDaApp | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v : "");

  const mensagem = cortar(semDadosDePessoas(texto(c.mensagem)), MAXIMO_DA_MENSAGEM);
  if (!mensagem) return null;

  const versaoDita = umaLinha(texto(c.versao));
  const versao = /^[0-9A-Za-z.+() -]{1,40}$/.test(versaoDita) ? cortar(versaoDita, MAXIMO_DA_VERSAO) : "?";
  const ecra = cortar(semDadosDePessoas(texto(c.ecra)), MAXIMO_DO_ECRA) || "?";

  return { versao, ecra, mensagem, quando: quandoDoErro(c.quando, agora) };
}
