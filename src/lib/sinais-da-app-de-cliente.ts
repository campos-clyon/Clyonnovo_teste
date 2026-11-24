/**
 * OS SINAIS DA APP DE CLIENTE — 24-11-2026 (d108, P5 do Produto).
 *
 * Duas coisas que a app de cliente passa a dizer ao site:
 *
 * 1. A PRIMEIRA ABERTURA (`POST /api/cliente/primeira-abertura`). Até hoje só
 *    sabíamos que alguém abriu a app se tivesse entrado na conta
 *    (`users.appClienteAbertaEm`). Quem instala pela Play e não entra contava
 *    como «Nunca entrou». Agora a app avisa UMA VEZ, na primeira abertura,
 *    só com a versão — SEM IDENTIFICADOR NENHUM (correcção do Jurídico,
 *    24-11-2026: um número guardado no aparelho e enviado precisa de
 *    consentimento, Lei 41/2004, art. 5.º). A marca «já avisou» fica só no
 *    telemóvel e nunca sai. A rota não guarda o endereço (nem no travão, que é
 *    um só para toda a gente). O backoffice mostra as primeiras aberturas ao
 *    lado das aberturas com sessão.
 *
 * 2. «ALGO NÃO FUNCIONA?» (`POST /api/cliente/algo-nao-funciona`). O que a
 *    pessoa escreve e envia, com a versão, o modelo do aparelho, o sistema e o
 *    sítio da app onde aconteceu (uma escolha fechada, `ONDE_ACONTECEU`). Com
 *    sessão válida, a rota junta o email da conta, para a equipa poder
 *    responder; sem sessão, vai sem ninguém. Aparece no backoffice em Contas ›
 *    Programa da app, por baixo de «Quem conta para os 12».
 *
 * Este ficheiro é a parte pura (ler e validar o que a app manda), igual para
 * as duas rotas e para os testes. A base está em
 * `sinais-da-app-de-cliente-na-base.ts`.
 */

import { MAXIMO_DA_VERSAO } from "./erros-da-app";

/** As primeiras aberturas e os problemas saem da base ao fim disto. */
export const DIAS_QUE_SE_GUARDAM = 90;

/** Os dias que o backoffice conta. */
export const DIAS_DOS_SINAIS = 30;

export const MINIMO_DO_PROBLEMA = 5;
export const MAXIMO_DO_PROBLEMA = 1000;
export const MAXIMO_DO_MODELO = 60;
export const MAXIMO_DO_SISTEMA = 30;

/**
 * ONDE ACONTECEU — a pessoa escolhe; nunca texto livre (o nome de uma rota com
 * o número de um pedido não sai do telemóvel). A mesma lista está na app
 * (`app-cliente/src/lib/algo-nao-funciona.ts`); o teste compara as duas.
 */
export const ONDE_ACONTECEU = [
  { id: "inicio", rotulo: "No Início" },
  { id: "pedir", rotulo: "Ao pedir um orçamento" },
  { id: "pedido", rotulo: "Num pedido ou numa proposta" },
  { id: "pagar", rotulo: "Ao pagar" },
  { id: "entrar", rotulo: "Ao entrar na conta" },
  { id: "avisos", rotulo: "Nos avisos" },
  { id: "outro", rotulo: "Outro sítio" },
] as const;

export type OndeAconteceu = (typeof ONDE_ACONTECEU)[number]["id"];

export const ROTULO_DE_ONDE: Readonly<Record<string, string>> = Object.fromEntries(
  ONDE_ACONTECEU.map((o) => [o.id, o.rotulo]),
);

const umaLinha = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

function cortar(s: string, maximo: number): string {
  const chars = [...s];
  return chars.length <= maximo ? s : chars.slice(0, maximo - 1).join("") + "…";
}

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/** A versão como a app a escreve («0.1.0 (01a1741b)»); outra coisa é «?». */
export function versaoLida(v: unknown): string {
  const dita = umaLinha(texto(v));
  return /^[0-9A-Za-z.+() -]{1,40}$/.test(dita) ? cortar(dita, MAXIMO_DA_VERSAO) : "?";
}

/** Um nome curto (o modelo, o sistema): só letras, números e pontuação simples. */
function nomeCurto(v: unknown, maximo: number): string | null {
  const dito = umaLinha(texto(v));
  if (!dito) return null;
  const limpo = dito.replace(/[^0-9A-Za-zÀ-ÿ .,()+_/-]/g, "").trim();
  return limpo ? cortar(limpo, maximo) : null;
}

export type PrimeiraAbertura = { versao: string; plataforma: "android" | "ios" | "outra" };

/** A primeira abertura: só a versão e a plataforma. Campos a mais não passam daqui. */
export function lerPrimeiraAbertura(corpo: unknown): PrimeiraAbertura {
  const c = corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>) : {};
  const p = texto(c.plataforma).trim().toLowerCase();
  return { versao: versaoLida(c.versao), plataforma: p === "android" || p === "ios" ? p : "outra" };
}

export type ProblemaDaApp = {
  texto: string;
  onde: OndeAconteceu;
  versao: string;
  modelo: string | null;
  sistema: string | null;
};

export type LeituraDoProblema = { ok: true; problema: ProblemaDaApp } | { ok: false; erro: string };

/** O «Algo não funciona?», lido. A frase do erro é a que a app mostra. */
export function lerProblema(corpo: unknown): LeituraDoProblema {
  if (!corpo || typeof corpo !== "object") return { ok: false, erro: "Pedido inválido." };
  const c = corpo as Record<string, unknown>;
  // Várias linhas são bem-vindas; só os caracteres de controlo saem.
  const escrito = texto(c.texto).replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if ([...escrito].length < MINIMO_DO_PROBLEMA) return { ok: false, erro: "Conte-nos em poucas palavras o que aconteceu." };
  const ondeDito = texto(c.onde).trim();
  const onde = (ONDE_ACONTECEU.some((o) => o.id === ondeDito) ? ondeDito : "outro") as OndeAconteceu;
  return {
    ok: true,
    problema: {
      texto: cortar(escrito, MAXIMO_DO_PROBLEMA),
      onde,
      versao: versaoLida(c.versao),
      modelo: nomeCurto(c.modelo, MAXIMO_DO_MODELO),
      sistema: nomeCurto(c.sistema, MAXIMO_DO_SISTEMA),
    },
  };
}

/** As contas do backoffice: primeiras aberturas e aberturas com sessão, nos últimos dias. */
export type ResumoDasAberturas = {
  dias: number;
  /** Telemóveis que abriram a app pela primeira vez (com ou sem conta). */
  primeirasAberturas: number;
  /** As contas de cliente que abriram a app com sessão (`users.appClienteAbertaEm`). */
  aberturasComSessao: number;
};
