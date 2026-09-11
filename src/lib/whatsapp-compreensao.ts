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

function instrucoes(
  jaSabido: Record<string, unknown>,
  agora: Date,
  perguntaPendente?: string,
): string {
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

A REGRA MAIS IMPORTANTE DE TODAS: a mensagem que vais ler é, quase sempre, uma RESPOSTA à pergunta que a CLYON acabou de fazer. Lê-a ao lado dessa pergunta e não sozinha. Um "não" a seguir a "Há elevador?" quer dizer que não há elevador — não quer dizer que a pessoa desistiu. Um "não preciso" a seguir a "Precisa de factura?" quer dizer que não precisa de FACTURA.

A PERGUNTA QUE A CLYON ACABOU DE FAZER: ${perguntaPendente ?? "(ainda nenhuma — é o início da conversa)"}

A intenção:
- "falar_com_pessoa" — pede para falar com alguém, com um humano, diz que não quer bots.
- "cancelar" — desiste do PEDIDO INTEIRO, e só quando é inequívoco ("deixa estar, já não quero nada", "esqueça o serviço", "cancele o pedido"). Na dúvida NÃO é cancelar: se a frase puder ser uma resposta à pergunta acima, é "informar". Cancelar apaga o trabalho todo desta conversa, por isso só se usa quando a pessoa o diz com todas as letras.
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

/** O modelo de recurso: não pensa antes de responder, e por isso é depressa. */
const MODELO_DE_RESERVA = "gemini-2.0-flash";

async function tentar(
  modelName: string,
  apiKey: string,
  texto: string,
  sistema: string,
  segundos: number,
): Promise<Compreensao | null> {
  const comecou = Date.now();
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: sistema,
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    });

    const resposta = await Promise.race([
      model.generateContent(texto),
      new Promise<never>((_, rejeitar) =>
        setTimeout(() => rejeitar(new Error(`demorou mais de ${segundos} s`)), segundos * 1000),
      ),
    ]);

    const lido = limpar(jsonDe(resposta.response.text()));
    // Sem isto, uma queda do Gemini é indistinguível de uma conversa normal: o
    // assistente volta aos números e ninguém sabe porquê. Ver a mensagem da
    // Patrícia Gonçalves, 10-09-2026.
    console.log(
      `[whatsapp/compreensao] ${modelName}: ${Object.keys(lido?.campos ?? {}).length} campos,` +
        ` intenção ${lido?.intencao ?? "—"}, ${Date.now() - comecou} ms`,
    );
    return lido;
  } catch (e) {
    console.error(
      `[whatsapp/compreensao] ${modelName} falhou aos ${Date.now() - comecou} ms:`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * O que a pessoa disse, lido pelo Gemini.
 *
 * Devolve null quando não há chave, quando as duas tentativas falham e quando
 * a resposta não se lê — e nesses casos quem chama segue pelo caminho antigo,
 * o das expressões regulares. Falhar aqui nunca pode ser calar-se.
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

  const sistema = instrucoes(resumoDoSabido(jaSabido), agora, perguntaPendente);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  /*
   * DUAS TENTATIVAS, E PORQUÊ.
   *
   * Doze segundos pareciam de sobra e não eram: a primeira cliente a escrever
   * uma mensagem a sério — quarenta linhas com morada, datas, andar e preço —
   * esgotou-os, caiu no plano B, e o assistente perguntou-lhe o nome que ela
   * tinha dado na primeira linha. O gemini-2.5-flash pensa antes de responder,
   * e o que lê aqui é uma mensagem inteira de WhatsApp.
   *
   * Dezoito segundos para o modelo bom; se ele não chegar a tempo — ou se o
   * nome do modelo estiver errado, ou a Google devolver um erro — dez para um
   * que não pensa. Vinte e oito no pior caso é muito tempo a olhar para o
   * WhatsApp, mas é menos mau do que perguntar o que já foi dito.
   */
  const bom = await tentar(modelName, apiKey, t, sistema, 18);
  if (bom) return bom;
  if (modelName === MODELO_DE_RESERVA) return null;
  return await tentar(MODELO_DE_RESERVA, apiKey, t, sistema, 10);
}

/**
 * AS INSTRUÇÕES PARA LER UM FIO INTEIRO — e não uma mensagem.
 *
 * A releitura mostra ao modelo a conversa toda, com as duas vozes e a data de
 * cada linha, e pede-lhe o ESTADO ACUMULADO: o que o cliente disse ao longo
 * dela, com as correcções do fim a valerem mais do que o princípio.
 *
 * A diferença que importa em relação a `instrucoes`: aqui NÃO se pede intenção
 * nenhuma. Um «sim» de há três dias não pode registar um pedido, um «quero
 * falar com uma pessoa» de há uma semana não pode entregar a conversa outra
 * vez, e um «recomeçar» dito a meio não pode apagar o que ele disse a seguir.
 * O que viaja do fio para os dados são CAMPOS, e mais nada.
 */
function instrucoesDoFio(jaSabido: Record<string, unknown>, agora: Date): string {
  const servicos = SERVICE_CATEGORIES.map((c) => `- ${c.id}: ${c.label}`).join("\n");
  const dia = agora.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `És o assistente da CLYON, uma empresa portuguesa de recolhas, mudanças e limpezas. Vais ler uma CONVERSA INTEIRA de WhatsApp entre a CLYON e um cliente, e o teu trabalho é dizer o que o cliente já contou sobre o pedido dele.

Hoje é ${dia}. Cada linha traz a data em que foi escrita, entre parénteses rectos, e quem falou.

Devolves SÓ um objecto JSON, sem texto à volta e sem blocos de código:

{ "campos": { ... } }

Só campos. NÃO devolvas intenção nenhuma — não é isso que te é pedido aqui.

Regras de leitura:
- Lê a conversa toda e devolve o ESTADO FINAL. Se ele disse uma morada e mais à frente a corrigiu, vale a corrigida.
- As linhas "CLYON:" são as perguntas do assistente. Servem para dar sentido às respostas curtas — um "sim" sozinho não quer dizer nada; a seguir a "Há elevador no prédio?" quer dizer que há elevador. NUNCA tomes uma pergunta da CLYON por uma resposta do cliente.
- Preenche SÓ o que o CLIENTE disse mesmo. Nunca inventes, nunca adivinhes, nunca preenchas por simpatia. Um campo a mais e inventado é muito pior do que um campo a menos: alguém vai a uma morada que ninguém deu.
- Se a conversa mudou de assunto a meio e trata de outro trabalho, devolve o do FIM.

Os campos são os mesmos de sempre:
- "servico" — um destes identificadores, e mais nenhum:
${servicos}
- "nome" — o nome próprio de quem fala.
- "morada" — rua e número do sítio do serviço.
- "codigoPostal" — código postal e localidade, como ele os escreveu (ex.: "2845-513 Amora"). Se só disser a localidade, mete só a localidade.
- "moradaDestino", "codigoPostalDestino" — só numa mudança, para onde vai.
- "andar" — o andar ("r/c", "3º", "cave").
- "elevador" — "sim" ou "não".
- "estacionamento" — "sim" ou "não", se dá para estacionar à porta.
- "entulho" — a quantidade, só em recolha de entulho (ex.: "20 sacos", "3 m3").
- "quando" — quando ele quer o serviço, com as palavras dele ("sexta de manhã", "amanhã", "sem pressa"). NÃO converta para data e NÃO tente corrigir uma data velha: escreve o que ele disse, que de a aproveitar ou não trata quem te chamou.
- "descricao" — o que há para levar ou fazer, com o detalhe que ele deu.
- "fatura" — "sim" ou "não", se precisa de factura.

O que já está gravado deste pedido — devolve um campo destes só se a conversa o CONTRADISSER ou o completar:
${JSON.stringify(jaSabido)}`;
}

/**
 * O que o cliente já contou, lido de uma vez a partir do fio.
 *
 * Uma chamada só, e não uma por mensagem: quem carregou no botão está a olhar
 * para o ecrã, e replayar dez mensagens a dezoito segundos cada não é uma
 * funcionalidade, é uma sala de espera.
 *
 * Devolve null quando não há chave, quando a chamada falha e quando a resposta
 * não se lê — e nesses casos quem chama não muda nada, que é melhor do que
 * gravar meio estado.
 */
export async function compreenderFio(
  guiao: string,
  jaSabido: Record<string, unknown>,
  agora: Date = new Date(),
): Promise<CamposCrus | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const t = guiao.trim();
  if (!t) return null;

  const sistema = instrucoesDoFio(resumoDoSabido(jaSabido), agora);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // A mesma escada de sempre — 18 s no modelo bom, 10 s no de reserva. Um fio
  // é maior do que uma mensagem, mas quem espera é a mesma pessoa.
  const bom = await tentar(modelName, apiKey, t, sistema, 18);
  if (bom) return bom.campos;
  if (modelName === MODELO_DE_RESERVA) return null;
  const reserva = await tentar(MODELO_DE_RESERVA, apiKey, t, sistema, 10);
  return reserva ? reserva.campos : null;
}
