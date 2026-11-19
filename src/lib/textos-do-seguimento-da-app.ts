/**
 * OS TEXTOS NOVOS DO CONVITE E DO LEMBRETE DA APP DE CLIENTE — 17-11-2026 (d59).
 *
 * Escritos pelo Marketing e APROVADOS À LETRA pelo dono a 17-11-2026 (d59,
 * parte 2: «Aprovo tudo»). Não se reescrevem sem nova aprovação. O email do
 * convite novo está em `convite-app-cliente.ts` (`textoDoConvite`, com o
 * assunto e o pré-cabeçalho).
 *
 * Marcas que se podem usar dentro dos textos (trocadas no envio, por
 * `preencherTexto` em `seguimento-da-app.ts`):
 *   {Nome}            — o primeiro nome da conta; sem nome, sai com a vírgula
 *                       antes («Olá, {Nome}!» → «Olá!»)
 *   {linkDeAdesao}    — o link de adesão da Play (Configs)
 *   {linkDaPlayStore} — a página da app na Play Store
 *   {linkDaConta}     — a área de conta no site
 *
 * Num email, uma linha em branco separa parágrafos; um link fica um link.
 */

import { ASSUNTO_DO_CONVITE, textoDoConvite } from "./convite-app-cliente";

export type TextoDeEmail = { assunto: string; texto: string };

/**
 * 1. O CONVITE A QUEM TEM CONTA COM UM EMAIL QUE NÃO É GMAIL. A Play só dá
 * acesso a uma conta Google: é o mesmo convite novo, que já traz o parágrafo
 * do Gmail («O email onde recebeu esta mensagem não é o Gmail do seu
 * telemóvel? Responda a este email só com esse Gmail…»). Sai pelo mesmo
 * email (`enviarConviteDaApp`); este modelo é a referência em texto.
 */
export const TEXTO_DO_CONVITE_QUE_PEDE_O_GMAIL: TextoDeEmail | null = {
  assunto: ASSUNTO_DO_CONVITE,
  texto: textoDoConvite({ nome: null, link: "{linkDeAdesao}" }).replace(/^Olá,\n/, "Olá, {Nome}.\n"),
};

/** 2. O LEMBRETE POR EMAIL, 3 dias depois do convite novo, a quem ainda não aderiu. */
export const TEXTO_DO_LEMBRETE_POR_EMAIL: TextoDeEmail | null = {
  assunto: "Falta só um toque para a app CLYON",
  texto: [
    "Olá, {Nome}. Ainda faltam alguns clientes com Android para a app CLYON chegar a toda a gente.",
    "Abra {linkDeAdesao} com o Gmail do telemóvel, toque em «Tornar-me testador» e instale a app.",
    "Se o seu Gmail for outro, responda só com ele. Se não puder, não faz mal: não voltamos a escrever sobre isto.",
    "Equipa CLYON",
  ].join("\n\n"),
};

/** 3. O LEMBRETE POR WHATSAPP, ao mesmo tempo, a quem tem telemóvel na conta. */
export const TEXTO_DO_LEMBRETE_POR_WHATSAPP: string | null = [
  "Olá, {Nome}, é a Vitória outra vez. Ainda precisamos de alguns clientes com Android para lançar a app CLYON.",
  "É só abrir {linkDeAdesao} com o Gmail do telemóvel e instalar a app.",
  "Se o Gmail for outro, envie-mo por aqui.",
  "Se não puder, não faz mal, obrigada na mesma!",
].join("\n");

/** 4. O CONVITE NOVO POR WHATSAPP, com o email, a quem tem telemóvel na conta. */
export const TEXTO_DO_CONVITE_POR_WHATSAPP: string = [
  "Olá, {Nome}! Sou a Vitória, assistente online da CLYON.",
  "Tem telemóvel Android? Estamos a lançar a app CLYON e procuramos 12 clientes para a experimentarem primeiro 😊",
  "Na app acompanha os seus pedidos, vê as fotografias e paga ao parceiro, tudo no telemóvel.",
  "1) Abra esta ligação com o Gmail do telemóvel e toque em «Tornar-me testador»: {linkDeAdesao}",
  "2) Instale a app e fique com ela 14 dias.",
  "Se o Gmail do telemóvel for outro, envie-mo por aqui, por favor.",
].join("\n");

/**
 * O lembrete (email) — LIGADO desde 17-11-2026, com o texto aprovado. Só a
 * quem recebeu o convite NOVO, 3 dias depois dele (`seguimento-da-app-na-base.ts`).
 */
export const LEMBRETE_DA_APP_LIGADO: boolean = true;

/** O lembrete também por WhatsApp — LIGADO desde 17-11-2026, com o texto aprovado. */
export const LEMBRETE_DA_APP_POR_WHATSAPP_LIGADO: boolean = true;
