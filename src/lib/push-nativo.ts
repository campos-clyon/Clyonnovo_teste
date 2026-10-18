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
};

export type MensagemDaExpo = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  data: { url?: string; tag?: string; negociacaoId?: number };
};

/** Um token da app (`ExponentPushToken[…]`), e não uma subscrição do navegador. */
export function eTokenDaApp(endpoint: unknown): endpoint is string {
  return typeof endpoint === "string" && /^Expo(nent)?PushToken\[[^\]\s]{8,200}\]$/.test(endpoint);
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
    data: { url: aviso.url, tag: aviso.tag, negociacaoId: aviso.negociacaoId },
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

export async function enviarAvisoNaApp(
  tokens: string[],
  aviso: AvisoNaApp,
  opcoes: {
    esquecer?: (token: string) => Promise<unknown>;
    pedir?: typeof fetch;
  } = {},
): Promise<void> {
  const pedir = opcoes.pedir ?? fetch;
  const cabecalhos: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  // Opcional: com o «push security» ligado na conta Expo, só quem tem esta
  // chave consegue mandar avisos para a app.
  if (process.env.EXPO_ACCESS_TOKEN) {
    cabecalhos.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  for (let i = 0; i < tokens.length; i += POR_PEDIDO) {
    const lote = tokens.slice(i, i + POR_PEDIDO);
    try {
      const r = await pedir(ENDERECO_DA_EXPO, {
        method: "POST",
        headers: cabecalhos,
        body: JSON.stringify(mensagensParaAExpo(lote, aviso)),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        console.error("[push-nativo] a Expo respondeu", r.status);
        continue;
      }
      const mortos = tokensQueMorreram(lote, await r.json());
      for (const t of mortos) await opcoes.esquecer?.(t).catch(() => {});
    } catch (e) {
      console.error("[push-nativo] falha ao enviar:", e instanceof Error ? e.message : e);
    }
  }
}
