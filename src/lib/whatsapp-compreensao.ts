/**
 * A COMPREENSÃO — o Gemini a ler o que o cliente escreveu.
 *
 * "quero ele mais inteligente sem números, ele deve entender textos complexos"
 * — 10-09-2026.
 *
 * O assistente perguntava uma coisa de cada vez e lia a resposta com
 * expressões regulares: «Responda com o número: 1. Recolha de móveis…». Quem
 * escrevia «preciso de tirar um sofá de um 3º andar em Cascais, na sexta de
 * manhã» ouvia «Não percebi o serviço».
 *
 * Este ficheiro trata só de PERCEBER. Recebe o que a pessoa escreveu e devolve
 * o que ela disse, em campos soltos e por validar — texto cru, tal como ela o
 * escreveu. Não decide nada, não pergunta nada, não cria pedidos.
 *
 * Quem valida é `whatsapp-recolha`, com os mesmos validadores de sempre: o
 * código postal continua a ter de ter quatro dígitos e três, a data continua a
 * passar por `interpretarQuando`, o serviço continua a ter de ser um dos da
 * lista. O Gemini alarga o que se percebe; não alarga o que se aceita.
 *
 * E quando não há chave, ou a chamada falha, ou o Gemini responde uma coisa
 * que não se lê — devolve-se null, e a conversa segue pelo caminho de sempre,
 * com os números. Uma avaria na Google não pode calar o assistente.
 */

import { SERVICE_CATEGORIES } from "./service-categories";

/** O que a pessoa quer fazer com esta mensagem, para lá dos dados que dá. */
export type Intencao =
  | "informar"
  | "confirmar"
  | "cancelar"
  | "recomecar"
  | "falar_com_pessoa";

/** Os campos, em texto cru — por validar, tal como a pessoa os disse. */
export type CamposCrus = {
  servico?: string;
  nome?: string;
  morada?: string;
  codigoPostal?: string;
  moradaDestino?: string;
  codigoPostalDestino?: string;
  andar?: string;
  elevador?: string;
  estacionamento?: string;
  entulho?: string;
  quando?: string;
  descricao?: string;
  fatura?: string;
};

export type Compreensao = {
  intencao: Intencao;
  campos: CamposCrus;
};

const CAMPOS: Array<keyof CamposCrus> = [
  "servico",
  "nome",
  "morada",
  "codigoPostal",
  "moradaDestino",
  "codigoPostalDestino",
  "andar",
  "elevador",
  "estacionamento",
  "entulho",
  "quando",
  "descricao",
  "fatura",
];

const INTENCOES: Intencao[] = [
  "informar",
  "confirmar",
  "cancelar",
  "recomecar",
  "falar_com_pessoa",
];

/** Há chave? Sem ela nem se tenta — e o assistente volta aos números. */
export function compreensaoDisponivel(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function instrucoes(jaSabido: Record<string, unknown>, agora: Date): string {
  const servicos = SERVICE_CATEGORIES.map((c) => `- ${c.id}: ${c.label}`).join("\n");
  const dia = agora.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `És o assistente da CLYON, uma empresa portuguesa de recolhas, mudanças e limpezas. Falas com um cliente por WhatsApp e o teu trabalho é PERCEBER o que ele escreve, para preencher o pedido dele.

Hoje é ${dia}.

Devolves SÓ um objecto JSON, sem texto à volta e sem blocos de código, com esta forma:

{
  "intencao": "informar" | "confirmar" | "cancelar" | "recomecar" | "falar_com_pessoa",
  "campos": { ... }
}

A intenção:
- "falar_com_pessoa" — pede para falar com alguém, com um humano, diz que não quer bots.
- "cancelar" — desiste do pedido ("deixa estar", "já não preciso", "esquece").
- "recomecar" — quer começar de novo, do início.
- "confirmar" — está a confirmar que o resumo está certo ("sim", "está tudo bem", "pode ser", "confirmo").
- "informar" — tudo o resto, incluindo quando dá dados novos ou corrige dados antigos.

Os campos. Preenche SÓ os que a pessoa disse mesmo, nesta mensagem ou a corrigir uma anterior. Nunca inventes, nunca adivinhes, nunca preenchas por simpatia. Se ela não disse a morada, o campo "morada" não aparece. Um campo a mais e inventado é muito pior do que um campo a menos.

- "servico" — um destes identificadores, e mais nenhum:
${servicos}
- "nome" — o nome próprio de quem fala.
- "morada" — rua e número do sítio do serviço.
- "codigoPostal" — código postal e localidade, como ela os escreveu (ex.: "2845-513 Amora"). Se só disser a localidade, mete só a localidade.
- "moradaDestino", "codigoPostalDestino" — só numa mudança, para onde vai.
- "andar" — o andar ("r/c", "3º", "cave").
- "elevador" — "sim" ou "não".
- "estacionamento" — "sim" ou "não", se dá para estacionar à porta.
- "entulho" — a quantidade, só em recolha de entulho (ex.: "20 sacos", "3 m3").
- "quando" — quando quer o serviço, com as palavras dela ("sexta de manhã", "amanhã", "sem pressa", "urgente"). Não convertas para data; escreve o que ela disse.
- "descricao" — o que há para levar ou fazer, com o detalhe que ela deu (ex.: "um sofá de 3 lugares e duas cadeiras").
- "fatura" — "sim" ou "não", se precisa de factura.

O que já se sabe deste pedido, para não repetires nem apagares — devolve um campo destes só se ela o estiver a mudar agora:
${JSON.stringify(jaSabido)}

Exemplo. A pessoa escreve: "boas, preciso de tirar um sofá velho e um colchão de um 3º sem elevador, aqui em Cascais, se puder ser sexta de manhã"
{"intencao":"informar","campos":{"servico":"recolha_moveis","morada":"","codigoPostal":"Cascais","andar":"3º","elevador":"não","quando":"sexta de manhã","descricao":"um sofá velho e um colchão"}}
(repara: "morada" ficou de fora por ela não ter dito a rua — um campo vazio não se inventa)`;
}

/** Só o que interessa do que já se sabe, para o modelo não receber ruído. */
function resumoDoSabido(dados: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (v != null && v !== "") out[k] = v;
  }
  return out;
}

/** Tira o JSON de uma resposta que pode vir embrulhada em ```json … ```. */
function jsonDe(texto: string): unknown {
  const limpo = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const abre = limpo.indexOf("{");
  const fecha = limpo.lastIndexOf("}");
  if (abre < 0 || fecha <= abre) return null;
  try {
    return JSON.parse(limpo.slice(abre, fecha + 1));
  } catch {
    return null;
  }
}

function limpar(bruto: unknown): Compreensao | null {
  if (bruto == null || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;

  const i = typeof o.intencao === "string" ? o.intencao.trim() : "";
  const intencao: Intencao = (INTENCOES as string[]).includes(i) ? (i as Intencao) : "informar";

  const campos: CamposCrus = {};
  const dados = o.campos != null && typeof o.campos === "object" ? (o.campos as Record<string, unknown>) : {};
  for (const c of CAMPOS) {
    const v = dados[c];
    if (typeof v !== "string") continue;
    const t = v.trim();
    // Um campo vazio, ou um "não sei" disfarçado, é um campo que não veio.
    if (t.length === 0 || /^(null|undefined|n\/a|nao sei|não sei|-)$/i.test(t)) continue;
    campos[c] = t.slice(0, 400);
  }
  return { intencao, campos };
}

/**
 * O que a pessoa disse, lido pelo Gemini.
 *
 * Devolve null quando não há chave, quando a chamada falha e quando a resposta
 * não se lê — e nesses casos quem chama segue pelo caminho antigo. Falhar aqui
 * nunca pode ser calar-se.
 */
export async function compreender(
  texto: string,
  jaSabido: Record<string, unknown>,
  agora: Date = new Date(),
): Promise<Compreensao | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const t = texto.trim();
  if (!t) return null;

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: instrucoes(resumoDoSabido(jaSabido), agora),
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    });

    // Doze segundos: a pessoa está à espera no WhatsApp. Se demorar mais do
    // que isto, mais vale responder pelos números do que não responder nada.
    const resposta = await Promise.race([
      model.generateContent(t),
      new Promise<never>((_, rejeitar) =>
        setTimeout(() => rejeitar(new Error("o Gemini demorou de mais")), 12_000),
      ),
    ]);

    return limpar(jsonDe(resposta.response.text()));
  } catch (e) {
    console.error("[whatsapp/compreensao]", e instanceof Error ? e.message : e);
    return null;
  }
}
