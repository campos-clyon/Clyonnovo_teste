/**
 * O CONVITE PARA TESTAR A APP DE CLIENTE — 01-11-2026 (ordem do CEO, aprovada
 * pelo dono).
 *
 * As contas de cliente activas recebem um email a convidá-las para o teste
 * fechado da app CLYON na Google Play. O texto foi aprovado À LETRA pelo dono:
 * não se reescreve aqui sem nova aprovação.
 *
 * Este ficheiro é puro (sem base nem Resend): serve o painel, que mostra a
 * pré-visualização, e a rota, que envia. O envio está em
 * `convite-app-cliente-envio.ts`, o registo em `convite-app-cliente-na-base.ts`.
 */

import { montarEmailDaApp, type EmailMontado } from "./email-da-app-de-cliente";
import { MODELO_DO_CONVITE_POR_EMAIL } from "./textos-do-seguimento-da-app";

/** A chave do link de adesão em `plataformaConfiguracoes`. */
export const CHAVE_DO_LINK_DE_ADESAO = "linkDeAdesaoDaAppDeCliente";

/** O link do teste da app de cliente, para sugerir no campo. */
export const LINK_DE_ADESAO_SUGERIDO = "https://play.google.com/apps/testing/pt.clyon.cliente";

/** O assunto do convite (v3 da d107, aprovada pelo dono a 24-11-2026). */
export const ASSUNTO_DO_CONVITE = MODELO_DO_CONVITE_POR_EMAIL.assunto;

/**
 * O remetente do convite e do lembrete da app de cliente (dono, 17-11-2026):
 * geral@clyon.pt, para a resposta com o Gmail do telemóvel chegar a uma caixa
 * que se lê. Os outros emails do site continuam a sair de noreply@.
 */
export const REMETENTE_DA_APP_DE_CLIENTE = "CLYON <geral@clyon.pt>";

/** O pré-cabeçalho (o resumo que a caixa de entrada mostra a seguir ao assunto). */
export const PRE_CABECALHO_DO_CONVITE = MODELO_DO_CONVITE_POR_EMAIL.preCabecalho ?? "";

/**
 * Entre um envio e o seguinte. O Resend aceita poucos pedidos por segundo por
 * chave; um a cada 600 ms fica abaixo do limite com folga, e os emails de
 * entrada do site (a mesma chave) continuam a sair entretanto.
 */
export const INTERVALO_ENTRE_ENVIOS_MS = 600;

/** Quantos emails por chamada à rota: cada chamada acaba em ~10 s, longe do limite da função. */
export const ENVIOS_POR_LOTE = 10;

/**
 * O link de adesão tem de ser da Google Play e em https. Devolve o link limpo,
 * ou `null` se não servir — um email com um link errado não se desfaz.
 */
export function linkDeAdesaoValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  if (limpo.length === 0 || limpo.length > 500) return null;
  let url: URL;
  try {
    url = new URL(limpo);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "play.google.com") return null;
  return url.toString();
}

/**
 * O primeiro nome, só com a primeira letra em maiúscula («WANDERSON» e
 * «wanderson» → «Wanderson»); `null` se não houver nome que sirva.
 */
export function primeiroNome(nome: unknown): string | null {
  if (typeof nome !== "string") return null;
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  // Um «nome» que é um email ou só números não é um nome.
  if (primeiro.length < 2 || primeiro.includes("@") || !/\p{L}/u.test(primeiro)) return null;
  return primeiro.charAt(0).toLocaleUpperCase("pt-PT") + primeiro.slice(1).toLocaleLowerCase("pt-PT");
}

/** «Olá, Ana.» ou, sem nome, «Olá,» — como o dono escreveu. */
export function saudacao(nome: unknown): string {
  const p = primeiroNome(nome);
  return p ? `Olá, ${p}.` : "Olá,";
}

/**
 * O CONVITE — v3 da d107, aprovada À LETRA pelo dono a 24-11-2026. O texto
 * está em `textos-do-seguimento-da-app.ts` (MODELO_DO_CONVITE_POR_EMAIL, o
 * ponto único) e monta-se em `email-da-app-de-cliente.ts`. `link` é a ligação
 * NOSSA da pessoa (/app-cliente?c=…); o fim leva a recusa num toque.
 */
export function emailDoConvite(params: { nome: unknown; link: string }): EmailMontado {
  return montarEmailDaApp(MODELO_DO_CONVITE_POR_EMAIL, params);
}

/** A versão em texto simples — também a que o painel mostra na pré-visualização. */
export function textoDoConvite(params: { nome: unknown; link: string }): string {
  return emailDoConvite(params).texto;
}

/** O HTML, no estilo dos outros emails da CLYON (sem píxel, sem links reescritos). */
export function htmlDoConvite(params: { nome: unknown; link: string }): string {
  return emailDoConvite(params).html;
}

/** Uma conta como vem da tabela `users`, só com o que a escolha precisa. */
export type ContaParaConvidar = {
  id: number;
  name: string | null;
  email: string | null;
  role: string | null;
  deletedAt: unknown;
};

export type MotivoDeFora =
  | "desactivada"
  | "nao-e-cliente"
  | "sem-email"
  | "profissional"
  | "de-teste"
  | "email-repetido";

/** Um nome ou email com «teste»/«test» como palavra é de teste. */
const PARECE_DE_TESTE = /(^|[^\p{L}])tes?te([^\p{L}]|$)/iu;

function normalizarEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * Quem recebe o convite: contas de cliente activas, sem desactivadas, sem
 * contas de teste, sem administradores nem profissionais. Uma pessoa com duas
 * contas no mesmo email recebe um só.
 *
 * `emailsDeProfissionais` — os emails da tabela `providers`;
 * `emailsDeTeste` — os da lista de teste (`EUPAGO_EMAILS_DE_TESTE`).
 */
export function escolherDestinatarios(
  contas: ContaParaConvidar[],
  emailsDeProfissionais: Iterable<string>,
  emailsDeTeste: Iterable<string>,
): {
  destinatarios: Array<{ id: number; nome: string | null; email: string }>;
  deFora: Record<MotivoDeFora, number>;
} {
  const profissionais = new Set([...emailsDeProfissionais].map((e) => e.trim().toLowerCase()));
  const teste = new Set([...emailsDeTeste].map((e) => e.trim().toLowerCase()));
  const vistos = new Set<string>();
  const deFora: Record<MotivoDeFora, number> = {
    desactivada: 0,
    "nao-e-cliente": 0,
    "sem-email": 0,
    profissional: 0,
    "de-teste": 0,
    "email-repetido": 0,
  };
  const destinatarios: Array<{ id: number; nome: string | null; email: string }> = [];

  for (const c of contas) {
    if (c.deletedAt) { deFora.desactivada++; continue; }
    if ((c.role ?? "user") !== "user") { deFora["nao-e-cliente"]++; continue; }
    const email = normalizarEmail(c.email);
    if (!email) { deFora["sem-email"]++; continue; }
    if (profissionais.has(email)) { deFora.profissional++; continue; }
    if (teste.has(email) || PARECE_DE_TESTE.test(email.split("@")[0]) || PARECE_DE_TESTE.test(c.name ?? "")) {
      deFora["de-teste"]++;
      continue;
    }
    if (vistos.has(email)) { deFora["email-repetido"]++; continue; }
    vistos.add(email);
    destinatarios.push({ id: Number(c.id), nome: c.name ?? null, email });
  }
  return { destinatarios, deFora };
}

/** A lista para a Play Console: só os emails, um por linha, sem cabeçalho. */
export function csvParaAPlay(emails: string[]): string {
  return emails.map((e) => e.replace(/[\r\n,"]/g, "")).join("\r\n") + (emails.length ? "\r\n" : "");
}
