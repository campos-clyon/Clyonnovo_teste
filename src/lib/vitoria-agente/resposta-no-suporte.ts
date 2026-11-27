import type Anthropic from "@anthropic-ai/sdk";
import { conhecimentoDoSite, OS_LIMITES, QUEM_E_A_VITORIA } from "./prompt-da-vitoria";
import { MARCA_DO_CODIGO_POSTAL, MARCA_DO_CONTACTO } from "./anonimizar";
import { linhaDoDia } from "./aviso-ao-modelo";
import type { ClienteDoClaude } from "./cliente";
import { BETA_DA_RECOLHA, custoEmUsd, MODELO_DA_VITORIA_AGENTE, usoDe, USO_VAZIO, type UsoSomado } from "./custo";
import { motivoParaBloquearAResposta } from "./intencao";
import { eurosNoTexto } from "../o-que-o-site-sabe";

/**
 * A VITÓRIA RESPONDE NO SUPORTE DO PEDIDO — d140 (27-11-2026).
 *
 * O mesmo cérebro do WhatsApp (d129): o prompt único (quem é, os limites, o
 * que o site sabe), as guardas de sempre e só os assuntos da CLYON. Muda o
 * sítio: aqui responde dentro do pedido, na conta do cliente (site ou app), e
 * a resposta fica no histórico desse pedido.
 *
 * Uma chamada só, com a resposta num JSON fechado. O código decide o que é da
 * equipa antes de perguntar (`motivoDaEquipa`); o modelo pode passar mais
 * coisas, nunca menos. Sem chave, sem leitura, ou com a resposta barrada pela
 * guarda: a resposta fixa de passar à equipa — o cliente nunca fica sem nada.
 */

export const PRAZO_DA_RESPOSTA_NO_SUPORTE_MS = 20_000;
export const MAX_TOKENS_DA_RESPOSTA_NO_SUPORTE = 4000;

/** A resposta quando passa à equipa — fixa, sem valores nem promessas. */
export function respostaDePassarAEquipa(pedidoId: number): string {
  return `Obrigada pela mensagem. Uma pessoa da equipa da CLYON confirma e responde-lhe aqui, no pedido #${pedidoId}.`;
}

export function avisoDaRespostaNoSuporte(agora: Date): string {
  return `${QUEM_E_A_VITORIA}

${OS_LIMITES}

O TEU TRABALHO AQUI
Aqui NÃO estás no WhatsApp: respondes no Suporte de um pedido, na conta do cliente (no site clyon.pt ou na app). O cliente escreveu dentro do pedido dele, e a tua resposta fica no histórico desse pedido, onde ele a lê. Lês a ÚLTIMA mensagem do cliente à luz do pedido e da conversa do pedido, e respondes ao que perguntou.

O QUE É DA EQUIPA (passarAEquipa = true)
- Trabalho a mais, mudar o dia, a hora ou a morada, mudar o valor, descontos, reembolsos, queixas, cancelar, falar com uma pessoa, ou o que não sabes com certeza pelo que o pedido e o site dizem.
- Nesses casos a resposta diz, numa ou duas frases, que recebeste o pedido e que uma pessoa da equipa da CLYON confirma e responde aqui. Nunca dizes que sim, que fica feito, nem um valor novo. O motivo (curto, para a equipa) vai em «motivo».

O QUE PODES RESPONDER SOZINHA (passarAEquipa = false)
- Dúvidas sobre como a CLYON funciona, as faturas, o IVA, o pagamento, o que o serviço inclui, o estado do pedido tal como está escrito em baixo. Nunca inventas o que não está lá.
- Um agradecimento ou um «ok»: responde com simpatia numa frase.

OS DADOS TAPADOS
Nomes, moradas e contactos chegam-te tapados («[nome recebido]», «[morada recebida: …]», «${MARCA_DO_CODIGO_POSTAL}», «${MARCA_DO_CONTACTO}»). Nunca os escrevas.

${conhecimentoDoSite(agora)}`;
}

export type PedidoParaOSuporte = {
  id: number;
  servico: string | null;
  estado: string | null;
  dia: string | null;
  /** Já tem um parceiro contratado? */
  contratado: boolean;
};

export type LinhaDoSuporte = { de: "cliente" | "clyon"; texto: string };

export function mensagemDaRespostaNoSuporte(
  agora: Date,
  pedido: PedidoParaOSuporte,
  conversa: readonly LinhaDoSuporte[],
  ultima: string,
): string {
  const fio = conversa
    .slice(-12)
    .map((l) => `${l.de === "cliente" ? "[cliente]" : "[CLYON]"} ${String(l.texto ?? "").replace(/\s+/g, " ").trim()}`)
    .join("\n");
  return [
    linhaDoDia(agora),
    "",
    `O PEDIDO: #${pedido.id} · ${pedido.servico ?? "serviço por dizer"} · estado «${pedido.estado ?? "—"}»${
      pedido.dia ? ` · dia ${pedido.dia}` : ""
    } · ${pedido.contratado ? "já tem um parceiro contratado" : "ainda sem parceiro contratado"}`,
    "",
    "A CONVERSA NO PEDIDO (da mais antiga para a mais recente):",
    fio || "(sem mensagens anteriores)",
    "",
    `A ÚLTIMA MENSAGEM DO CLIENTE (a que respondes): «${ultima.replace(/\s+/g, " ").trim()}»`,
  ].join("\n");
}

export const ESQUEMA_DA_RESPOSTA_NO_SUPORTE = {
  type: "object",
  properties: {
    resposta: { type: "string" },
    passarAEquipa: { type: "boolean" },
    motivo: { type: "string" },
  },
  required: ["resposta", "passarAEquipa", "motivo"],
  additionalProperties: false,
} as const;

export type LeituraNoSuporte = { resposta: string; passarAEquipa: boolean; motivo: string };

export function lerARespostaNoSuporte(json: unknown): LeituraNoSuporte | null {
  let v = json;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.resposta !== "string" || typeof o.passarAEquipa !== "boolean") return null;
  return {
    resposta: o.resposta.trim(),
    passarAEquipa: o.passarAEquipa,
    motivo: typeof o.motivo === "string" ? o.motivo.trim().slice(0, 200) : "",
  };
}

export type DecisaoNoSuporte =
  | { tipo: "responder"; texto: string }
  | { tipo: "equipa"; texto: string; motivo: string };

/**
 * A DECISÃO. `motivoDasRegras` é o do código (`motivoDaEquipa`): com ele,
 * passa sempre. Ao passar, o texto do modelo só sai se passar a guarda, não
 * tiver euros e disser que a equipa confirma; senão, a frase fixa.
 */
export function decidirNoSuporte(
  leitura: LeituraNoSuporte | null,
  c: { pedidoId: number; motivoDasRegras: string | null; erro?: string | null },
): DecisaoNoSuporte {
  const fixa = respostaDePassarAEquipa(c.pedidoId);
  const textoDePassar = (t: string | undefined) =>
    t && !motivoParaBloquearAResposta(t, false) && eurosNoTexto(t).length === 0 && /\bequipa\b/i.test(t) ? t : fixa;

  if (c.motivoDasRegras) return { tipo: "equipa", texto: textoDePassar(leitura?.resposta), motivo: c.motivoDasRegras };
  if (!leitura) return { tipo: "equipa", texto: fixa, motivo: `A Vitória não leu a mensagem${c.erro ? ` (${c.erro})` : ""} — responder` };
  if (leitura.passarAEquipa) {
    return { tipo: "equipa", texto: textoDePassar(leitura.resposta), motivo: leitura.motivo || "A Vitória passou à equipa — responder" };
  }
  if (!leitura.resposta) return { tipo: "equipa", texto: fixa, motivo: "A Vitória ficou sem resposta — responder" };
  const bloqueio = motivoParaBloquearAResposta(leitura.resposta, false);
  if (bloqueio) return { tipo: "equipa", texto: fixa, motivo: `A resposta da Vitória não passou a guarda (${bloqueio}) — responder` };
  return { tipo: "responder", texto: leitura.resposta };
}

export type ResultadoNoSuporte = {
  leitura: LeituraNoSuporte | null;
  erro: string | null;
  uso: UsoSomado;
  custoUsd: number;
  modelo: string | null;
};

function comPrazo<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`passou o prazo (${Math.round(ms / 1000)} s)`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** UMA LEITURA. Nunca lança. */
export async function lerNoSuporte(
  p: { agora: Date; pedido: PedidoParaOSuporte; conversa: readonly LinhaDoSuporte[]; ultima: string; prazoMs?: number },
  cliente: ClienteDoClaude,
): Promise<ResultadoNoSuporte> {
  const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model: MODELO_DA_VITORIA_AGENTE,
    max_tokens: MAX_TOKENS_DA_RESPOSTA_NO_SUPORTE,
    betas: [BETA_DA_RECOLHA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: ESQUEMA_DA_RESPOSTA_NO_SUPORTE as unknown as Record<string, unknown> },
    },
    system: [{ type: "text", text: avisoDaRespostaNoSuporte(p.agora), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: mensagemDaRespostaNoSuporte(p.agora, p.pedido, p.conversa, p.ultima) }],
  };
  try {
    const r = await comPrazo(cliente.beta.messages.create(params), p.prazoMs ?? PRAZO_DA_RESPOSTA_NO_SUPORTE_MS);
    const uso = usoDe(r.usage);
    const base = { uso, custoUsd: custoEmUsd(uso), modelo: r.model ?? MODELO_DA_VITORIA_AGENTE };
    if (r.stop_reason === "refusal") return { ...base, leitura: null, erro: "o modelo recusou" };
    if (r.stop_reason === "max_tokens") return { ...base, leitura: null, erro: "a resposta ficou cortada" };
    const texto = r.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const leitura = lerARespostaNoSuporte(texto);
    return { ...base, leitura, erro: leitura ? null : "o JSON não se leu" };
  } catch (e) {
    return { leitura: null, erro: e instanceof Error ? e.message.slice(0, 200) : "erro desconhecido", uso: USO_VAZIO, custoUsd: 0, modelo: null };
  }
}
