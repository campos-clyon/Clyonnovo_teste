/**
 * AVISOS NO TELEMÓVEL PELA APP — 18-10-2026.
 *
 * A app do profissional (CLYON Pro, feita com Expo) recebe avisos nativos: os
 * que chegam com a app fechada e o telemóvel bloqueado, que é onde o painel no
 * navegador falhava. Quem os entrega ao Android (Firebase) e ao iPhone (Apple)
 * é o serviço de avisos da Expo; daqui só se fala com ele.
 *
 * O token da app guarda-se na MESMA tabela das subscrições do navegador
 * (`pushSubscriptions`), por email, com o token no lugar do endpoint. Assim
 * cada aviso que já existe para o profissional chega também à app sem tocar
 * em quem o manda, e apagar a conta continua a apagar tudo de uma vez.
 *
 * NUNCA LANÇA, como o `webpush.ts`: um aviso que falha não pode impedir o
 * pedido de ser distribuído nem o trabalho de ser confirmado.
 */

export const ENDERECO_DA_EXPO = "https://exp.host/--/api/v2/push/send";

/** A Expo aceita no máximo 100 avisos por pedido. */
const POR_PEDIDO = 100;

export type AvisoNaApp = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** O trabalho que a app abre quando ele toca no aviso. */
  negociacaoId?: number;
  /** O pedido que a app de cliente abre (S10), e que aviso é. */
  pedidoId?: number;
  tipo?: string;
};

export type MensagemDaExpo = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  data: { url?: string; tag?: string; negociacaoId?: number; pedidoId?: number; tipo?: string };
};

/** Um token da app (`ExponentPushToken[…]`), e não uma subscrição do navegador. */
export function eTokenDaApp(endpoint: unknown): endpoint is string {
  return typeof endpoint === "string" && /^Expo(nent)?PushToken\[[^\]\s]{8,200}\]$/.test(endpoint);
}

/*
 * DE QUE APP É CADA APARELHO — 25-10-2026.
 *
 * Com a app do cliente a caminho, o mesmo email pode ter as duas apps: um
 * profissional que também pede trabalhos, ou a equipa a testar. Pelo email só,
 * a proposta que é para o cliente tocava na app do profissional, e o pedido
 * novo para o profissional na app do cliente. E a Expo recusa um envio com
 * tokens de dois projectos ao mesmo tempo: as duas apps são dois projectos.
 *
 * Por isso cada linha de `pushSubscriptions` diz de que app é («pro»,
 * «cliente» ou «web», o navegador), cada aviso diz para que app vai, e os
 * envios à Expo saem num lote por projecto.
 */
export type AppDoAparelho = "pro" | "cliente" | "web";
export type AppNativa = Exclude<AppDoAparelho, "web">;
export const APPS_NATIVAS: readonly AppNativa[] = ["pro", "cliente"];

/** Um telemóvel com uma das apps: o token da Expo e de que app é. */
export type AparelhoDaApp = { token: string; app: AppNativa };

/**
 * A app de uma linha da tabela. O que estiver gravado manda; uma linha sem
 * coluna (a base antes da migração) lê-se como sempre se leu: um token da Expo
 * era da app do profissional, que era a única.
 */
export function appDoAparelho(linha: { endpoint: string; app?: unknown }): AppDoAparelho {
  if (linha.app === "pro" || linha.app === "cliente" || linha.app === "web") {
    // Um endereço do navegador nunca é de uma app nativa, diga a coluna o que disser.
    if (linha.app !== "web" && !eTokenDaApp(linha.endpoint)) return "web";
    return linha.app;
  }
  return eTokenDaApp(linha.endpoint) ? "pro" : "web";
}

/** Os telemóveis de uma app (ou de várias), a partir das linhas da tabela. */
export function aparelhosDaApp(
  linhas: Array<{ endpoint: string; app?: unknown }>,
  para: AppNativa | readonly AppNativa[],
): AparelhoDaApp[] {
  const quais: readonly AppNativa[] = typeof para === "string" ? [para] : para;
  const saida: AparelhoDaApp[] = [];
  for (const l of linhas) {
    const app = appDoAparelho(l);
    if (app !== "web" && quais.includes(app)) saida.push({ token: l.endpoint, app });
  }
  return saida;
}

/**
 * Os lotes para a Expo: um projecto por lote, e no máximo `POR_PEDIDO` tokens
 * em cada. Um envio com tokens de dois projectos é recusado inteiro.
 */
export function lotesPorProjecto(
  aparelhos: AparelhoDaApp[],
  porPedido: number = POR_PEDIDO,
): Array<{ app: AppNativa; tokens: string[] }> {
  const lotes: Array<{ app: AppNativa; tokens: string[] }> = [];
  for (const app of APPS_NATIVAS) {
    const tokens = [...new Set(aparelhos.filter((a) => a.app === app).map((a) => a.token))];
    for (let i = 0; i < tokens.length; i += porPedido) {
      lotes.push({ app, tokens: tokens.slice(i, i + porPedido) });
    }
  }
  return lotes;
}

export function mensagensParaAExpo(tokens: string[], aviso: AvisoNaApp): MensagemDaExpo[] {
  return tokens.map((to) => ({
    to,
    title: aviso.title,
    body: aviso.body,
    sound: "default",
    // Sem `high`, o Android guarda o aviso para quando o telemóvel acordar — e
    // um pedido novo visto meia hora depois já foi para outro profissional.
    priority: "high",
    data: {
      url: aviso.url,
      tag: aviso.tag,
      negociacaoId: aviso.negociacaoId,
      // A app de cliente abre o pedido pelo `pedidoId` (S10, 28-10-2026).
      pedidoId: aviso.pedidoId,
      tipo: aviso.tipo,
    },
  }));
}

/**
 * Os tokens que a Expo diz que já não existem: a app foi desinstalada ou ele
 * tirou-lhe a permissão. As respostas vêm pela mesma ordem das mensagens.
 */
export function tokensQueMorreram(tokens: string[], resposta: unknown): string[] {
  const bilhetes = (resposta as { data?: unknown } | null)?.data;
  if (!Array.isArray(bilhetes)) return [];
  return tokens.filter((_, i) => {
    const b = bilhetes[i] as { status?: unknown; details?: { error?: unknown } } | undefined;
    return b?.status === "error" && b?.details?.error === "DeviceNotRegistered";
  });
}

/** O que a Expo respondeu a cada aviso: o número do recibo, ou o erro logo à entrada. */
export type Bilhete = { token: string; id?: string; erro?: string };

function cabecalhosDaExpo(): Record<string, string> {
  const cabecalhos: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  // Opcional: com o «push security» ligado na conta Expo, só quem tem esta
  // chave consegue mandar avisos para a app.
  if (process.env.EXPO_ACCESS_TOKEN) {
    cabecalhos.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }
  return cabecalhos;
}

export function bilhetesDe(tokens: string[], resposta: unknown): Bilhete[] {
  const lista = (resposta as { data?: unknown } | null)?.data;
  return tokens.map((token, i) => {
    const b = (Array.isArray(lista) ? lista[i] : undefined) as
      | { status?: unknown; id?: unknown; message?: unknown; details?: { error?: unknown } }
      | undefined;
    if (b?.status === "ok" && typeof b.id === "string") return { token, id: b.id };
    const erro = typeof b?.details?.error === "string" ? b.details.error : typeof b?.message === "string" ? b.message : "SemResposta";
    return { token, erro };
  });
}

/**
 * Manda o aviso aos telemóveis da app a que se destina (`para`), um lote por
 * projecto Expo. Os aparelhos de outra app ficam de fora: a proposta para o
 * cliente não toca na app do profissional com o mesmo email.
 */
export async function enviarAvisoNaApp(
  aparelhos: AparelhoDaApp[],
  aviso: AvisoNaApp,
  opcoes: {
    /** A app (ou as apps) a que o aviso se destina. */
    para: AppNativa | readonly AppNativa[];
    esquecer?: (token: string) => Promise<unknown>;
    pedir?: typeof fetch;
  },
): Promise<Bilhete[]> {
  const pedir = opcoes.pedir ?? fetch;
  const bilhetes: Bilhete[] = [];
  const quais: readonly AppNativa[] = typeof opcoes.para === "string" ? [opcoes.para] : opcoes.para;

  for (const { tokens: lote } of lotesPorProjecto(aparelhos.filter((a) => quais.includes(a.app)))) {
    try {
      const r = await pedir(ENDERECO_DA_EXPO, {
        method: "POST",
        headers: cabecalhosDaExpo(),
        body: JSON.stringify(mensagensParaAExpo(lote, aviso)),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        console.error("[push-nativo] a Expo respondeu", r.status);
        bilhetes.push(...lote.map((token) => ({ token, erro: `HTTP ${r.status}` })));
        continue;
      }
      const resposta = await r.json();
      bilhetes.push(...bilhetesDe(lote, resposta));
      const mortos = tokensQueMorreram(lote, resposta);
      for (const t of mortos) await opcoes.esquecer?.(t).catch(() => {});
    } catch (e) {
      console.error("[push-nativo] falha ao enviar:", e instanceof Error ? e.message : e);
      bilhetes.push(...lote.map((token) => ({ token, erro: "SemLigacao" })));
    }
  }
  return bilhetes;
}

export const ENDERECO_DOS_RECIBOS = "https://exp.host/--/api/v2/push/getReceipts";

/**
 * Os recibos: o que o Android (Firebase) ou o iPhone (Apple) disseram à Expo.
 * Um bilhete «ok» só quer dizer que a Expo aceitou o aviso; é o recibo que diz
 * se chegou ao telemóvel. Chegam uns segundos depois. Nunca lança.
 */
export async function recibosDaExpo(
  ids: string[],
  pedir: typeof fetch = fetch,
): Promise<Record<string, { ok: boolean; erro?: string }>> {
  if (!ids.length) return {};
  try {
    const r = await pedir(ENDERECO_DOS_RECIBOS, {
      method: "POST",
      headers: cabecalhosDaExpo(),
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return {};
    const dados = ((await r.json()) as { data?: Record<string, { status?: string; message?: string; details?: { error?: string } }> }).data ?? {};
    const recibos: Record<string, { ok: boolean; erro?: string }> = {};
    for (const [id, rec] of Object.entries(dados)) {
      recibos[id] = rec.status === "ok" ? { ok: true } : { ok: false, erro: rec.details?.error ?? rec.message ?? "Erro" };
    }
    return recibos;
  } catch {
    return {};
  }
}

/**
 * O erro da Expo dito a quem carregou no aviso de teste (e a quem o ajuda).
 * `app` diz de que projecto da Expo se fala: a CLYON Pro (clyon-pro) ou a
 * app de cliente (clyon-cliente, d5 de 31-10-2026), cada uma com a sua chave.
 */
export function explicarErroDoAviso(codigo: string, app: AppNativa = "pro"): string {
  switch (codigo) {
    case "InvalidCredentials":
      return `O aviso não chegou: falta a chave do Firebase (FCM V1) no projecto ${app === "cliente" ? "clyon-cliente" : "clyon-pro"} da Expo.`;
    case "MismatchSenderId":
      return "O aviso não chegou: a chave do Firebase na Expo é de outro projecto. Tem de ser a do projecto Clyon.";
    case "DeviceNotRegistered":
      return app === "cliente"
        ? "Este telemóvel deixou de receber avisos. Desligue e volte a ligar «Avisos no telemóvel»."
        : "Este telemóvel deixou de receber avisos. Carregue outra vez em «Ligar os avisos».";
    case "MessageRateExceeded":
      return "Demasiados avisos seguidos para este telemóvel. Espere um minuto e tente outra vez.";
    case "SemLigacao":
      return "O site não conseguiu falar com o serviço de avisos. Tente outra vez daqui a pouco.";
    default:
      return `O serviço de avisos recusou o aviso (${codigo}).`;
  }
}
