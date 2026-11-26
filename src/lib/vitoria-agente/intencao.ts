/**
 * O QUE A PESSOA QUER, ANTES DO FLUXO FIXO — d129 (pedida e aprovada pelo
 * dono, 26-11-2026). PURO (o modelo chega de fora; nos testes, fingido).
 *
 * O caso: um número desconhecido. A Vitória abriu com a saudação da recolha
 * («Fica anotado: recolha de móveis… Com quem tenho o gosto de falar?») e a
 * pessoa escreveu «Quero fazer meu cadastro para ser parceiro de vocês». O
 * fluxo leu-o como o nome e pediu a morada; «Que trabalhar com vocês» levou
 * «E o código postal…», o código postal levou «E em que andar é?», e só à
 * quarta mensagem («…sou o Gervásio, estou no Seixal com camião e quero ser
 * parceiro…», o nome inventado) se percebia — e mesmo aí a regra do
 * candidato (d69) calou-se, porque «recolha de» lhe parecia um cliente.
 *
 * O dono: «Estamos a usar a API do Claude para que seja mais inteligente, que
 * entenda o contexto, não seja uma coisa gravada.» Por isso, antes de cada
 * passo do fluxo fixo, o modelo lê a conversa e diz o que a pessoa quer:
 *
 *   · cliente_com_pedido — um cliente com um pedido (a responder, a dar
 *     dados, a cumprimentar, a pedir uma pessoa): o fluxo fixo continua, como
 *     sempre (as regras lêem os dados, validam-nos e fazem o pedido);
 *   · candidato_a_parceiro — quer trabalhar com a CLYON: a resposta dele, com
 *     a ligação da candidatura posta pelo código; nunca se cria pedido;
 *   · parceiro_registado — já é parceiro: a resposta, e uma pessoa da equipa;
 *   · pergunta_geral — uma dúvida que a pergunta do fluxo não responde: a
 *     resposta com o que o site diz, e a pergunta do fluxo outra vez, se fizer
 *     sentido;
 *   · fora_do_tema — o que não é da CLYON: a recusa delicada, e a pergunta do
 *     fluxo outra vez (o prompt único, `prompt-da-vitoria.ts`);
 *   · queixa — as desculpas de sempre, e uma pessoa (código);
 *   · outro — engano, venda de serviços, fornecedores: a resposta, e a equipa.
 *
 * LIBERDADE COM GUARDA: tudo o que o modelo escreve passa pela guarda da
 * Vitória agente (`motivoParaBloquearOAgente`: os € só das fontes do site, o
 * IVA, «parceiro», o português de Portugal, as frases proibidas) e, ao
 * candidato, pela guarda do recrutamento (sem entulho, sem prometer trabalho).
 * Bloqueado, sai o texto fixo de sempre (ou as regras). O modelo nunca cria
 * nem muda pedidos, nunca vê nomes, moradas nem contactos (chegam tapados).
 *
 * O modelo é o da Vitória agente (Claude Sonnet 5.5, `custo.ts`), com esforço
 * baixo e a resposta em JSON (structured outputs); o mesmo tecto diário.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { linkDaCandidatura, respostaAoCandidato } from "../candidato-a-parceiro";
import type { IdDoConcelho } from "../concelhos-da-cobertura";
import { EUROS_DAS_FONTES } from "../o-que-o-site-sabe";
import { conhecimentoDoSite, OS_LIMITES, QUEM_E_A_VITORIA } from "./prompt-da-vitoria";
import { MARCA_DO_CODIGO_POSTAL, MARCA_DO_CONTACTO } from "./anonimizar";
import { linhaDoDia } from "./aviso-ao-modelo";
import type { ClienteDoClaude } from "./cliente";
import { BETA_DA_RECOLHA, custoEmUsd, MODELO_DA_VITORIA_AGENTE, usoDe, type UsoSomado, USO_VAZIO } from "./custo";
import { motivoParaBloquearOAgente } from "./guarda";

/* ── As intenções ────────────────────────────────────────────────────────── */

export const INTENCOES = [
  "cliente_com_pedido",
  "candidato_a_parceiro",
  "parceiro_registado",
  "pergunta_geral",
  "fora_do_tema",
  "queixa",
  "outro",
] as const;
export type Intencao = (typeof INTENCOES)[number];

export type LeituraDaIntencao = {
  intencao: Intencao;
  /** A mensagem responde à pergunta que o fluxo fez? */
  respondeAPergunta: boolean;
  /** O que a Vitória diz (vazio para o cliente_com_pedido e a queixa). */
  resposta: string;
  /** Depois da resposta, a pergunta do fluxo faz sentido outra vez? */
  retomarAPergunta: boolean;
  /** Numa frase, porque leu assim (só para o registo). */
  porque: string;
};

/** Onde a ligação da candidatura entra na resposta: o modelo escreve a marca, o código põe a ligação. */
export const MARCA_DA_LIGACAO = "[ligação da candidatura]";

/** O tempo máximo da leitura: passado, as regras (a ponte tem 60 s, e a recolha ainda chama o Gemini). */
export const PRAZO_DA_INTENCAO_MS = 12_000;
export const ESFORCO_DA_INTENCAO = "low" as const;
export const MAX_TOKENS_DA_INTENCAO = 4000;

/* ── Quando nem vale a pena perguntar ────────────────────────────────────── */

/** Respostas curtas que só podem ser dados (o código lê-as): SIM, NÃO, um número, uma data, um código postal, o andar. */
const SO_DADOS = [
  /^(?:sim|nao|não|ok|okay|s|n|claro|pode ser|certo|exacto|exato|isso|correcto|correto|yes|no|oui|non|si|sí)[\s.!]*$/i,
  /^\s*(?:€\s*)?\d{1,5}(?:[.,]\d{1,2})?\s*(?:€|euros?|º|ª|o|a)?\s*(?:andar)?[\s.!]*$/i,
  /^\s*\d{4}\s*-?\s*\d{3}[\s.!]*$/,
  /^\s*\d{1,2}\s*[/.-]\s*\d{1,2}(?:\s*[/.-]\s*\d{2,4})?(?:\s+(?:às\s+)?\d{1,2}[:h]\d{0,2})?\s*$/i,
  /^\s*(?:r\/?c|rés[-\s]do[-\s]ch[aã]o|res[-\s]do[-\s]chao|cave|sótão|sotao)[\s.!]*$/i,
];

/**
 * Esta mensagem vai ao modelo? Só o que é claramente um dado curto fica com o
 * código sem perguntar (poupa a chamada e o tempo); tudo o resto — uma frase,
 * por curta que seja («Que trabalhar com vocês») — lê-se.
 */
export function precisaDeLerAIntencao(texto: string | null | undefined): boolean {
  const t = String(texto ?? "").trim();
  if (!t) return false;
  return !SO_DADOS.some((re) => re.test(t));
}

/* ── O aviso ao modelo ───────────────────────────────────────────────────── */

/** O que o site diz da candidatura (a página /quero-ser-parceiro e a aprovação do backoffice). */
export const A_CANDIDATURA_PARA_O_MODELO = [
  `A candidatura faz-se no site, em poucos minutos, na página da candidatura (escreve exactamente «${MARCA_DA_LIGACAO}» onde a ligação deve ficar: o código põe-na).`,
  "Na candidatura juntam-se 1 a 4 fotografias da carrinha (ou do camião) — são obrigatórias.",
  "Não há inscrição automática: uma pessoa da equipa da CLYON lê cada candidatura e confirma a identidade, o NIF e o contacto antes de haver conta. Se for aprovada, recebe por email a ligação para entrar.",
  "Candidatar-se e responder a pedidos é grátis: sem mensalidade, sem créditos e sem comprar contactos.",
  "Os pedidos chegam-lhe pela zona e pelos serviços que faz, e ele escolhe a que responde, com o preço dele.",
];

/** Fixo por dia (a cache de prompt é um prefixo): o que muda, a conversa e a hora, vai na mensagem. */
export function avisoDaIntencao(agora: Date): string {
  return `${QUEM_E_A_VITORIA}

${OS_LIMITES}

O TEU TRABALHO AQUI
O código conduz a recolha dos pedidos com perguntas fixas (o serviço, o nome, a morada, o código postal, o andar…). ANTES de cada passo lês a conversa e dizes o que a pessoa quer de facto, para o código não tratar quem não é cliente como cliente, e respondes tu ao que as perguntas fixas não respondem. Lês a ÚLTIMA mensagem da pessoa à luz da conversa toda e da pergunta que o código fez.

AS INTENÇÕES (escolhe uma)
- cliente_com_pedido: um cliente que quer um serviço — a responder à pergunta (mesmo mal escrito), a dar dados do pedido (o que levar, as medidas, a morada, o andar, a data, uma nota para o parceiro como «cuidado, na rua há outro lote 32»), a confirmar o resumo («sim é isso»), a cumprimentar, a pedir o preço ou o orçamento (o código dá a estimativa da tabela), a pedir para falar com uma pessoa, ou a perguntar se és um robô. Uma mensagem com dados do pedido é sempre cliente_com_pedido, mesmo que traga também uma pergunta. Na dúvida entre cliente e outra coisa, cliente_com_pedido.
- candidato_a_parceiro: quer TRABALHAR com a CLYON — ser parceiro, inscrever-se, registar-se, «fazer o registo» (ou a palavra do Brasil para isso), candidatar-se, trabalhar como motorista ou ajudante, «tenho carrinha/camião e quero trabalhar convosco», «estão a contratar?». Mesmo a meio de uma recolha, e mesmo que fale do serviço que faz («faço recolhas de móveis e fretes»). NÃO é candidato o cliente que precisa de um motorista ou de um ajudante para o trabalho dele.
- parceiro_registado: diz que JÁ é parceiro da CLYON (tem conta, recebe pedidos, fala de uma proposta que enviou, de um pagamento que vai receber).
- pergunta_geral: uma dúvida sobre a CLYON que não traz dados do pedido e que a pergunta do código não responde («trabalham ao sábado?», «vão até Setúbal?», «como funciona?», «quem faz o trabalho?», «passam fatura?», «o preço é com ou sem fatura?», «tem IVA?»).
- fora_do_tema: uma pergunta ou um pedido que não é da CLYON (os limites, em cima).
- queixa: queixa-se do atendimento, de um parceiro ou de um trabalho.
- outro: um engano de número, alguém a vender serviços à CLYON, um fornecedor, publicidade.

A RESPOSTA (o campo «resposta»)
- cliente_com_pedido e queixa: deixa-a vazia (o código responde).
- candidato_a_parceiro: agradece o interesse com calor e explica, em poucas frases, como se inscrever, com estes factos e só estes:
${A_CANDIDATURA_PARA_O_MODELO.map((f) => `  · ${f}`).join("\n")}
  Nunca prometas trabalho, pedidos, clientes nem volume («vai ter muito trabalho», «há muita procura»). Nunca fales de entulho, obras nem resíduos de construção ao candidato. Não peças os dados dele por aqui (é a candidatura que os pede). Diz que a equipa vê a candidatura e fala com ele.
- parceiro_registado: agradece e diz que passas a mensagem a uma pessoa da equipa da CLYON, que lhe responde por aqui.
- pergunta_geral: responde à pergunta com o que o site diz (em baixo), curto e com a verdade toda — à fatura: há sempre fatura (a do trabalho, do parceiro, e a da taxa da plataforma) e o preço da proposta já é o total, com o IVA incluído (ou isento, conforme o parceiro); não existe preço «sem fatura». Não repitas a pergunta do código: se ela fizer sentido a seguir, põe retomarAPergunta a true e o código junta-a.
- fora_do_tema: recusa com delicadeza numa frase e põe retomarAPergunta a true.
- outro: responde com educação e diz que uma pessoa da equipa vê a mensagem.
- Não te apresentes outra vez se já te apresentaste na conversa. Se a pessoa escreve noutra língua, escreves na mesma em português de Portugal (a saída é traduzida). A quem faz o trabalho chamas sempre «parceiro».

OS DADOS TAPADOS
Por privacidade, nomes, moradas e contactos chegam-te tapados («[nome recebido]», «[morada recebida: …]», «${MARCA_DO_CODIGO_POSTAL}», «${MARCA_DO_CONTACTO}»). Nunca os escrevas nem os peças outra vez.

${conhecimentoDoSite(agora)}`;
}

/* ── A mensagem do turno ─────────────────────────────────────────────────── */

export type LinhaDaConversaDaIntencao = { direccao: string; texto: string };

/** A conversa (já tapada), a pergunta que o código fez e a última mensagem da pessoa. */
export function mensagemDaIntencao(
  agora: Date,
  conversa: readonly LinhaDaConversaDaIntencao[],
  ultima: string,
  perguntaFeita: string | null,
): string {
  const fio = conversa
    .slice(-20)
    .map((l) => `${l.direccao === "in" ? "[pessoa]" : "[CLYON]"} ${String(l.texto ?? "").replace(/\s+/g, " ").trim()}`)
    .join("\n");
  return [
    linhaDoDia(agora),
    "",
    "A CONVERSA (da mais antiga para a mais recente):",
    fio || "(sem mensagens anteriores)",
    "",
    `A PERGUNTA QUE O CÓDIGO FEZ E ESPERA RESPOSTA: ${perguntaFeita ? `«${perguntaFeita}»` : "(nenhuma — a recolha ainda não começou)"}`,
    "",
    `A ÚLTIMA MENSAGEM DA PESSOA (a que lês): «${ultima.replace(/\s+/g, " ").trim()}»`,
  ].join("\n");
}

/* ── O formato da resposta (structured outputs) ──────────────────────────── */

export const ESQUEMA_DA_INTENCAO = {
  type: "object",
  properties: {
    intencao: { type: "string", enum: [...INTENCOES] },
    respondeAPergunta: { type: "boolean" },
    resposta: { type: "string" },
    retomarAPergunta: { type: "boolean" },
    porque: { type: "string" },
  },
  required: ["intencao", "respondeAPergunta", "resposta", "retomarAPergunta", "porque"],
  additionalProperties: false,
} as const;

/** O JSON do modelo, conferido (o esquema já o garante; isto é a rede). Null se não servir. */
export function lerALeitura(json: unknown): LeituraDaIntencao | null {
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
  if (!INTENCOES.includes(o.intencao as Intencao)) return null;
  return {
    intencao: o.intencao as Intencao,
    respondeAPergunta: o.respondeAPergunta === true,
    resposta: typeof o.resposta === "string" ? o.resposta.trim() : "",
    retomarAPergunta: o.retomarAPergunta === true,
    porque: typeof o.porque === "string" ? o.porque.slice(0, 300) : "",
  };
}

/* ── A guarda ────────────────────────────────────────────────────────────── */

/** d18: o recrutamento nunca fala de entulho (memória «entulho fora da divulgação»). */
const ENTULHO_NO_RECRUTAMENTO = /\b(entulho|obras?|res[ií]duos|demoli[çc][aã]o|caliça|calica)\b/i;
/** Sem prometer trabalho a quem se candidata. */
const PROMESSA_DE_TRABALHO =
  /(muito\s+trabalho|muitos\s+pedidos|trabalho\s+garantido|garant\w*\s+(?:trabalho|pedidos|clientes|servi[çc]os)|(?:h[aá]|temos)\s+muita\s+procura|trabalho\s+n[aã]o\s+(?:vai\s+)?falta|nunca\s+(?:vai\s+)?(?:faltar|falta)|ganh\w*\s+(?:at[eé]|mais\s+de)\s+\d)/i;
/** Uma marca de dado tapado nunca sai. */
const MARCA_TAPADA = /\[(?:nome recebido|morada(?: de destino)? recebida[^\]]*|NIF recebido|código postal recebido|contacto recebido)\]/i;

/** O porquê de não deixar sair esta resposta, ou null. */
export function motivoParaBloquearAResposta(texto: string, candidato: boolean): string | null {
  if (MARCA_TAPADA.test(texto)) return "Tem um dado tapado.";
  if (candidato) {
    if (ENTULHO_NO_RECRUTAMENTO.test(texto)) return "Fala de entulho ou obras a um candidato.";
    if (PROMESSA_DE_TRABALHO.test(texto)) return "Promete trabalho a um candidato.";
  }
  // A ligação da candidatura não é um contacto nem um preço: sai da guarda geral com a marca.
  return motivoParaBloquearOAgente(texto.split(MARCA_DA_LIGACAO).join("a página da candidatura"), EUROS_DAS_FONTES);
}

/** Põe a ligação no lugar da marca; sem a marca, junta-a no fim. */
export function comALigacao(texto: string, ligacao: string): string {
  const t = texto.trim();
  if (t.includes(MARCA_DA_LIGACAO)) return t.split(MARCA_DA_LIGACAO).join(ligacao);
  if (t.includes(ligacao)) return t;
  return `${t}\n${ligacao}`;
}

/* ── A decisão ───────────────────────────────────────────────────────────── */

export type DecisaoDaIntencao =
  | { tipo: "regras"; porque: string }
  | { tipo: "candidato"; texto: string; doModelo: boolean }
  | { tipo: "responder"; texto: string }
  | { tipo: "equipa"; texto: string; motivo: string }
  | { tipo: "queixa" };

export const MOTIVO_DO_PARCEIRO_DE_OUTRO_NUMERO = "Parceiro escreveu (diz que já é parceiro) — responder";
export const MOTIVO_DO_OUTRO = "Mensagem que não é um pedido — ver";
/** A recusa fixa, quando a do modelo não passa na guarda. */
export const AQUI_SO_A_CLYON = "Aqui só consigo ajudar com os serviços e os pedidos da CLYON.";
export const PASSO_A_UMA_PESSOA_DA_EQUIPA = "Obrigada pela mensagem. Passo-a a uma pessoa da equipa da CLYON, que lhe responde por aqui.";

/**
 * O QUE FAZER COM A LEITURA. Pura. O cliente fica com as regras; o resto
 * responde-se com o texto do modelo, se a guarda o deixar — senão, o texto
 * fixo (ao candidato) ou as regras (à pergunta).
 */
export function decidirPelaIntencao(
  l: LeituraDaIntencao | null,
  c: { perguntaPendente: string | null; zona: IdDoConcelho | null },
): DecisaoDaIntencao {
  if (!l) return { tipo: "regras", porque: "sem leitura do modelo" };
  switch (l.intencao) {
    case "cliente_com_pedido":
      return { tipo: "regras", porque: l.respondeAPergunta ? "cliente a responder à pergunta" : "cliente com o pedido" };
    case "queixa":
      return { tipo: "queixa" };
    case "candidato_a_parceiro": {
      const ligacao = linkDaCandidatura(c.zona);
      const texto = l.resposta ? comALigacao(l.resposta, ligacao) : "";
      const bloqueio = texto ? motivoParaBloquearAResposta(texto, true) : "sem resposta";
      if (!bloqueio) return { tipo: "candidato", texto, doModelo: true };
      return { tipo: "candidato", texto: respostaAoCandidato(c.zona), doModelo: false };
    }
    case "parceiro_registado": {
      const ok = l.resposta && !motivoParaBloquearAResposta(l.resposta, false);
      return { tipo: "equipa", texto: ok ? l.resposta : PASSO_A_UMA_PESSOA_DA_EQUIPA, motivo: MOTIVO_DO_PARCEIRO_DE_OUTRO_NUMERO };
    }
    case "pergunta_geral": {
      if (!l.resposta) return { tipo: "regras", porque: "pergunta sem resposta do modelo" };
      const bloqueio = motivoParaBloquearAResposta(l.resposta, false);
      if (bloqueio) return { tipo: "regras", porque: `resposta bloqueada: ${bloqueio}` };
      const retomar = l.retomarAPergunta && c.perguntaPendente ? `\n\n${c.perguntaPendente}` : "";
      return { tipo: "responder", texto: `${l.resposta}${retomar}` };
    }
    case "fora_do_tema": {
      const bloqueio = l.resposta ? motivoParaBloquearAResposta(l.resposta, false) : "sem resposta";
      const recusa = bloqueio ? AQUI_SO_A_CLYON : l.resposta;
      const retomar = c.perguntaPendente ? `\n\n${c.perguntaPendente}` : "";
      return { tipo: "responder", texto: `${recusa}${retomar}` };
    }
    case "outro": {
      const ok = l.resposta && !motivoParaBloquearAResposta(l.resposta, false);
      return { tipo: "equipa", texto: ok ? l.resposta : PASSO_A_UMA_PESSOA_DA_EQUIPA, motivo: MOTIVO_DO_OUTRO };
    }
  }
}

/* ── A chamada ───────────────────────────────────────────────────────────── */

export type ResultadoDaIntencao = {
  leitura: LeituraDaIntencao | null;
  erro: string | null;
  uso: UsoSomado;
  custoUsd: number;
  modelo: string | null;
};

function comPrazo<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`passou o prazo da leitura (${Math.round(ms / 1000)} s)`)), ms);
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

/** UMA LEITURA. Nunca lança: sem leitura, o erro diz porquê (e quem chama segue com as regras). */
export async function lerAIntencao(
  pedido: { agora: Date; conversa: readonly LinhaDaConversaDaIntencao[]; ultima: string; perguntaFeita: string | null; prazoMs?: number },
  cliente: ClienteDoClaude,
): Promise<ResultadoDaIntencao> {
  const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model: MODELO_DA_VITORIA_AGENTE,
    max_tokens: MAX_TOKENS_DA_INTENCAO,
    betas: [BETA_DA_RECOLHA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: {
      effort: ESFORCO_DA_INTENCAO,
      format: { type: "json_schema", schema: ESQUEMA_DA_INTENCAO as unknown as Record<string, unknown> },
    },
    system: [{ type: "text", text: avisoDaIntencao(pedido.agora), cache_control: { type: "ephemeral" } }],
    messages: [
      { role: "user", content: mensagemDaIntencao(pedido.agora, pedido.conversa, pedido.ultima, pedido.perguntaFeita) },
    ],
  };
  try {
    const r = await comPrazo(cliente.beta.messages.create(params), pedido.prazoMs ?? PRAZO_DA_INTENCAO_MS);
    const uso = usoDe(r.usage);
    const base = { uso, custoUsd: custoEmUsd(uso), modelo: r.model ?? MODELO_DA_VITORIA_AGENTE };
    if (r.stop_reason === "refusal") return { ...base, leitura: null, erro: "o modelo recusou" };
    if (r.stop_reason === "max_tokens") return { ...base, leitura: null, erro: "a resposta ficou cortada (max_tokens)" };
    const texto = r.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const leitura = lerALeitura(texto);
    return { ...base, leitura, erro: leitura ? null : "o JSON não se leu" };
  } catch (e) {
    return { leitura: null, erro: e instanceof Error ? e.message.slice(0, 200) : "erro desconhecido", uso: USO_VAZIO, custoUsd: 0, modelo: null };
  }
}
