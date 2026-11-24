/**
 * OS TEXTOS SOBRE A APP DE CLIENTE — O PONTO ÚNICO ONDE SE TROCAM.
 *
 * v3 da d107, escrita pelo Marketing, revista pelo Jurídico (d109) e
 * APROVADA À LETRA pelo dono a 24-11-2026 («Aprovo»). Não se reescrevem sem
 * nova aprovação. (Substituem os de 17-11-2026, d59.)
 *
 * Fora, de propósito (v3, «Antes de enviar»):
 *   · as linhas [SÓ COM AVISOS] — só entram quando a chave FCM V1 da app de
 *     cliente estiver carregada e um aviso de teste chegar a um telemóvel;
 *   · o 2.º lembrete (secção 3) — muda o limite «1 convite + 1 lembrete» e
 *     precisa do sim do dono.
 *
 * UMA PALAVRA À ESPERA DO DONO: «parceiros verificados» (1.a, 1.b e a
 * resposta «Não percebo para que serve») sai como «parceiros». A regra q da
 * orquestra (dono, 01-11-2026: «Selo só nos que tiverem os 3») só deixa dizer
 * «verificado» ao cliente junto de um parceiro com as três confirmações; um
 * convite genérico não sabe quem vai propor. Volta se o dono decidir.
 *
 * O QUE SAI E QUANDO (24-11-2026, CEO e dono): NADA se envia sozinho.
 *   · secções 1 e 2 (convite e lembrete ao grupo de 17/11): DESLIGADAS, à
 *     espera do advogado (`ENVIOS_AO_GRUPO_DE_17_11_LIGADOS`, `LEMBRETE_DA_APP_LIGADO`);
 *   · secção 4 («Já pode instalar»): desligada (`AVISO_JA_PODE_INSTALAR_LIGADO`),
 *     e só a quem nos deu o Gmail;
 *   · secção 0 (a linha no aviso de propostas): atrás do interruptor das
 *     Configs, desligado;
 *   · secção 6 (profissionais, equipa, conhecidos): só o texto, sem envio.
 *
 * Os emails montam-se em `email-da-app-de-cliente.ts` (texto e HTML, sem
 * píxel); `{ligacao}` é a ligação NOSSA da pessoa (/app-cliente?c=…), e o fim
 * leva sempre «Não quero receber mensagens sobre a app» ({LINK_RECUSA}).
 *
 * Nos WhatsApp, as marcas (trocadas por `preencherTexto`, seguimento-da-app.ts):
 *   {Nome}         — o primeiro nome; sem nome, sai com a vírgula antes
 *   {linkDeAdesao} — a ligação NOSSA da pessoa
 *   {linkDoPedido} — o pedido na conta
 *   {n}            — o n.º do pedido
 */

import type { ModeloDeEmailDaApp } from "./email-da-app-de-cliente";

/* ─── Os interruptores (todos desligados a 24-11-2026) ──────────────────── */

/** Secção 1 (convite) ao grupo de 17/11, pelo backoffice — à espera do advogado. */
export const ENVIOS_AO_GRUPO_DE_17_11_LIGADOS: boolean = false;

/** Secção 2 (lembrete, 3 dias depois), pela rotina — à espera do advogado. */
export const LEMBRETE_DA_APP_LIGADO: boolean = false;

/** O lembrete também por WhatsApp (só conta com o de cima ligado). */
export const LEMBRETE_DA_APP_POR_WHATSAPP_LIGADO: boolean = false;

/** Secção 4, ao colar a lista da Play (só a quem nos deu o Gmail). */
export const AVISO_JA_PODE_INSTALAR_LIGADO: boolean = false;

/* ─── 0. A linha no aviso «chegaram propostas» ──────────────────────────── */

/**
 * No email do aviso de propostas, que já tem o seu «Ver a proposta»: por
 * isso a 1.ª linha é a variante «Também as pode ver…». Depois, em letra
 * pequena, a recusa.
 */
export const LINHA_DA_APP_NO_AVISO_DE_PROPOSTAS_EMAIL: string[] = [
  "Também as pode ver na app CLYON (Android): {ligacao}",
  "Na app também vê as fotografias do trabalho e paga ao parceiro no telemóvel.",
  "A app é opcional e ainda está em teste na Google Play.",
];

/** O mesmo, no WhatsApp das propostas (por ligar: fica para quando esse aviso sair por WhatsApp). */
export const LINHA_DA_APP_NO_AVISO_DE_PROPOSTAS_WHATSAPP: string = [
  "Chegaram propostas para o seu pedido n.º {n}: veja-as aqui {linkDoPedido} ou na app CLYON (Android): {linkDeAdesao}",
  "A app é opcional e ainda está em teste.",
  "Para não receber mais mensagens sobre a app, responda SEM APP.",
].join("\n");

/* ─── 1. Convite ────────────────────────────────────────────────────────── */

export const MODELO_DO_CONVITE_POR_EMAIL: ModeloDeEmailDaApp = {
  assunto: "Os seus pedidos CLYON no telemóvel (Android)",
  preCabecalho: "Peça, compare propostas e acompanhe o trabalho na app. Por agora só Android.",
  blocos: [
    "Já pode acompanhar os seus pedidos CLYON no telemóvel. Com a app:",
    {
      lista: [
        "faz um pedido com fotografias e recebe as propostas dos parceiros no mesmo sítio;",
        "compara as propostas e escolhe com calma;",
        "acompanha o trabalho passo a passo, com as fotografias do parceiro;",
        "vê quanto paga e paga ao parceiro sem andar à procura de mensagens.",
      ],
    },
    { botao: "Ver como instalar", destino: "link" },
    "A ligação mostra o passo-a-passo, em menos de 2 minutos. Se alguma coisa não correr bem, diga-nos lá em que passo ficou e nós ajudamos.",
    "A app é opcional: no site faz tudo na mesma. Ainda está em teste na Google Play e, por agora, é só para Android.",
  ],
};

export const TEXTO_DO_CONVITE_POR_WHATSAPP: string = [
  "Olá, {Nome}! Sou a Vitória, a assistente automática da CLYON.",
  "Já pode acompanhar os seus pedidos na app CLYON: recebe e compara as propostas dos parceiros, vê as fotografias do trabalho e paga ao parceiro, tudo no telemóvel 😊",
  "A app é opcional, ainda está em teste e, por agora, é só para Android. Como instalar, em menos de 2 minutos: {linkDeAdesao}",
  "Para não receber mais mensagens sobre a app, responda SEM APP.",
].join("\n");

/**
 * O convite a quem tem conta com um email que não é Gmail: desde a v3 é o
 * mesmo convite (a página trata da conta Google no passo 2).
 */
export const TEXTO_DO_CONVITE_QUE_PEDE_O_GMAIL: ModeloDeEmailDaApp | null = MODELO_DO_CONVITE_POR_EMAIL;

/* ─── 2. Lembrete, 3 dias depois ────────────────────────────────────────── */

export const MODELO_DO_LEMBRETE_POR_EMAIL: ModeloDeEmailDaApp = {
  assunto: "Conseguiu instalar a app CLYON?",
  preCabecalho: "Se ficou a meio, diga-nos num toque.",
  blocos: [
    "Há uns dias enviámos-lhe a ligação para acompanhar os seus pedidos na app CLYON (Android). Se ainda quer experimentar, o passo-a-passo está aqui: {ligacao}",
    "Se não deu, diga-nos porquê num toque:",
    { botao: "Tentei e não consegui", destino: "r1" },
    { botao: "Não tenho Android", destino: "r2" },
    { botao: "Não me interessa", destino: "r3" },
    "Com o 2.º e o 3.º botões não voltamos a escrever-lhe sobre a app. Com o 1.º, mostramos-lhe o que fazer.",
  ],
};

export const TEXTO_DO_LEMBRETE_POR_WHATSAPP: string | null = [
  "Olá, {Nome}, é a Vitória outra vez. Conseguiu instalar a app CLYON?",
  "Se ficou a meio, responda só com um número:",
  "1 — tentei e não consegui entrar",
  "2 — não tenho Android",
  "3 — não me interessa",
  "A ligação continua aqui: {linkDeAdesao}",
  "Para não receber mais mensagens sobre a app, responda SEM APP.",
].join("\n");

/* ─── 4. «Já pode instalar» (só a quem nos deu o Gmail) ─────────────────── */

export const MODELO_DO_AVISO_JA_PODE_INSTALAR: ModeloDeEmailDaApp = {
  assunto: "Já pode instalar a app CLYON",
  preCabecalho: "A conta Google que nos indicou já está na lista do teste.",
  blocos: [
    "A conta Google que nos indicou já está na lista da app CLYON. Agora é só:",
    {
      numerada: true,
      lista: [
        "abrir a ligação no telemóvel Android e tocar em «Tornar-me testador»;",
        "instalar a app pela Play Store e entrar com o email da sua conta CLYON.",
      ],
    },
    { botao: "Instalar a app", destino: "link" },
    "A app está em teste na Google Play: vai recebendo melhorias e, se algo não funcionar, diga-nos.",
  ],
};

export const TEXTO_DO_AVISO_JA_PODE_INSTALAR_POR_WHATSAPP: string = [
  "Olá, {Nome}! A conta Google que nos indicou já está na lista da app CLYON 😊 Abra esta ligação no telemóvel, toque em «Tornar-me testador» e instale a app: {linkDeAdesao}",
  "Depois entre com o email da sua conta CLYON. Se algo falhar, diga-me aqui.",
  "Para não receber mais mensagens sobre a app, responda SEM APP.",
].join("\n");

/* ─── 6. Profissionais, equipa e conhecidos, por email (só o texto) ─────── */

export type VoluntarioDaApp = "profissional" | "equipa";

/** Nunca pelo WhatsApp dos avisos de pedidos. À equipa e aos conhecidos, sem a frase dos pedidos. */
export function modeloDoConviteAosVoluntarios(quem: VoluntarioDaApp): ModeloDeEmailDaApp {
  return {
    assunto: "Um pedido pessoal: experimentar a app CLYON de cliente",
    blocos: [
      "Estamos a testar a app CLYON para clientes na Google Play e procuramos pessoas com Android que a usem a sério durante 14 dias: explorar, simular um orçamento, ver como o cliente vê as propostas.",
      quem === "profissional" ? "É voluntário. Aceitar ou não, não muda nada nos pedidos que recebe." : "É voluntário.",
      "Não há nada em troca. E pedimos-lhe que não faça pedidos a fingir na plataforma: se quiser experimentar um pedido do princípio ao fim, diga-nos e damos-lhe uma conta de teste.",
      "Se quiser ajudar, o passo-a-passo está aqui: {ligacao}",
    ],
    assinatura: "Obrigado,\nEquipa CLYON",
  };
}

/** No máximo um, 3 dias depois, só a quem não respondeu. */
export function modeloDoLembreteAosVoluntarios(quem: VoluntarioDaApp): ModeloDeEmailDaApp {
  return {
    assunto: "Um pedido pessoal: experimentar a app CLYON de cliente",
    saudacaoNaMesmaLinha: true,
    blocos: [
      quem === "profissional"
        ? "Só um lembrete do convite para experimentar a app CLYON de cliente: {ligacao}. É voluntário e não muda nada nos pedidos que recebe. Não voltamos a escrever sobre isto."
        : "Só um lembrete do convite para experimentar a app CLYON de cliente: {ligacao}. É voluntário. Não voltamos a escrever sobre isto.",
    ],
    assinatura: null,
  };
}
