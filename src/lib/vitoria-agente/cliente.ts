/**
 * O CLIENTE DO CLAUDE DA VITÓRIA AGENTE — d85, fase 0 (22-11-2026).
 *
 * Uma volta da conversa: o modelo lê o turno, chama as ferramentas que quiser
 * (o código decide o que é permitido, `ferramentas.ts`) e entrega a resposta
 * por `propor_resposta`, que passa pela guarda dos € (`guarda.ts`). Nunca
 * envia nada: devolve o que teria dito e feito, e quem chama decide.
 *
 *  - a chave lê-se de `ANTHROPIC_API_KEY`; sem ela o agente fica INACTIVO e
 *    diz porquê (nunca falha calado);
 *  - o tecto diário em dólares (Configs, 10 USD por omissão): passado, o
 *    agente não chama o modelo e tudo fica nas regras;
 *  - Claude Sonnet 5.5, pensamento adaptativo com esforço baixo, sem
 *    `temperature`, a recolha do servidor (`fallbacks: "default"`) se o modelo
 *    recusar, ferramentas `strict`, `tool_choice` auto, e a cache de prompt
 *    com o aviso fixo à frente (a data vai na mensagem do turno);
 *  - cada chamada devolve o uso (com `cache_read_input_tokens`) e o custo.
 */

import Anthropic from "@anthropic-ai/sdk";
import { AVISO_AO_MODELO, mensagemDoTurno, type LinhaParaOModelo } from "./aviso-ao-modelo";
import {
  BETA_DA_RECOLHA,
  custoEmUsd,
  dentroDoTecto,
  ESFORCO_POR_OMISSAO,
  MODELO_DA_VITORIA_AGENTE,
  somarUsos,
  USO_VAZIO,
  usoDe,
  type EsforcoDoAgente,
  type UsoSomado,
} from "./custo";
import { correrFerramenta, estadoNovo, FERRAMENTAS_DA_VITORIA, type DependenciasDasFerramentas } from "./ferramentas";
import type { Pendente } from "./pendentes";
import { motivoParaBloquearOAgente, eurosDosResultados } from "./guarda";

/** Quantas idas ao modelo numa volta, no máximo (cada ida pode trazer várias ferramentas). */
export const IDAS_NO_MAXIMO = 6;
/** A resposta é curta; o pensamento conta para isto. */
export const MAX_TOKENS = 8000;

/** A parte do SDK que se usa — nos testes, um cliente fingido (nunca se chama a API num teste). */
export type ClienteDoClaude = {
  beta: { messages: { create: (p: Anthropic.Beta.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.BetaMessage> } };
};

/** Lê a chave do ambiente. Sem ela, null (e o porquê vai para o painel). */
export function chaveDoClaude(env: Record<string, string | undefined> = process.env): string | null {
  const k = String(env.ANTHROPIC_API_KEY ?? "").trim();
  return k.length > 0 ? k : null;
}

/** O cliente de verdade, ou null sem chave. Sem tentativas a mais: um erro passa às regras. */
export function clienteDoClaude(env: Record<string, string | undefined> = process.env): ClienteDoClaude | null {
  const apiKey = chaveDoClaude(env);
  if (!apiKey) return null;
  return new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 }) as unknown as ClienteDoClaude;
}

/** O registo de cada passo (a tabela vitoriaAccoes). Nunca deve lançar. */
export type LinhaDoRegistoDoAgente = {
  ferramenta: string;
  entrada?: unknown;
  resultado?: unknown;
  texto?: string | null;
  modelo?: string | null;
  uso?: UsoSomado;
  custoUsd?: number;
  erro?: string | null;
};

export type PedidoAoAgente = {
  conversa: readonly LinhaParaOModelo[];
  pedidos: readonly number[];
  agora: Date;
  esforco?: EsforcoDoAgente;
  /** d92: o tempo máximo da volta (a resposta a sério tem de caber na função da ponte). Passado, pára entre idas. */
  prazoMs?: number;
};

export type ResultadoDoAgente = {
  estado: "inactivo" | "tecto" | "erro" | "recusou" | "bloqueado" | "equipa" | "ok";
  /** O que teria dito ao cliente (só com «ok», ou o da passagem à equipa). */
  texto: string | null;
  motivo: string | null;
  teriaFeito: string[];
  recusadas: Array<{ texto: string; motivo: string }>;
  uso: UsoSomado;
  custoUsd: number;
  idas: number;
  modelo: string | null;
  /** d92: a acção que ficou à espera do SIM / do CANCELAR / do parceiro (só com «ok»). */
  pendente: Pendente | null;
  /** d92: a mensagem ao cliente ao passar à equipa, escrita pelo modelo e revista (null = a frase de sempre). */
  mensagemDeEquipa: string | null;
};

export type DependenciasDoAgente = {
  cliente: ClienteDoClaude | null;
  ferramentas: DependenciasDasFerramentas;
  /** O gasto de hoje (Lisboa) e o tecto, em dólares. */
  gastoETecto: () => Promise<{ gastoUsd: number; tectoUsd: number }>;
  registar: (l: LinhaDoRegistoDoAgente) => Promise<void>;
};

const vazio = (estado: ResultadoDoAgente["estado"], motivo: string): ResultadoDoAgente => ({
  estado,
  texto: null,
  motivo,
  teriaFeito: [],
  recusadas: [],
  uso: USO_VAZIO,
  custoUsd: 0,
  idas: 0,
  modelo: null,
  pendente: null,
  mensagemDeEquipa: null,
});

/** O erro da API em palavras (os tipos do SDK, do mais concreto para o mais geral). */
export function erroEmPalavras(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "a chave do Claude não é válida (ANTHROPIC_API_KEY)";
  if (err instanceof Anthropic.PermissionDeniedError) return "a chave do Claude não tem acesso a este modelo";
  if (err instanceof Anthropic.RateLimitError) return "o Claude pediu para esperar (limite de pedidos)";
  if (err instanceof Anthropic.BadRequestError) return `pedido recusado pela API: ${err.message.slice(0, 140)}`;
  if (err instanceof Anthropic.APIConnectionError) return "sem ligação ao Claude";
  if (err instanceof Anthropic.APIError) return `erro da API (${err.status ?? "?"})`;
  return err instanceof Error ? err.message.slice(0, 160) : "erro desconhecido";
}

/**
 * UMA VOLTA DO AGENTE. Nunca lança: o resultado diz sempre o estado e porquê.
 */
export async function correrOAgente(pedido: PedidoAoAgente, deps: DependenciasDoAgente): Promise<ResultadoDoAgente> {
  if (!deps.cliente) return vazio("inactivo", "falta a chave ANTHROPIC_API_KEY na Vercel");
  let tecto: { gastoUsd: number; tectoUsd: number };
  try {
    tecto = await deps.gastoETecto();
  } catch {
    return vazio("tecto", "não li o gasto de hoje — por segurança não se chama o modelo");
  }
  if (!dentroDoTecto(tecto.gastoUsd, tecto.tectoUsd)) {
    return vazio("tecto", `tecto diário atingido (${tecto.gastoUsd.toFixed(2)} de ${tecto.tectoUsd.toFixed(2)} USD)`);
  }

  const estado = estadoNovo();
  const mensagens: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: mensagemDoTurno(pedido.agora, pedido.conversa, pedido.pedidos) },
  ];
  let uso = USO_VAZIO;
  let modelo: string | null = null;
  let idas = 0;
  let textoSolto: string | null = null;
  const fim = (
    r: Omit<ResultadoDoAgente, "uso" | "custoUsd" | "idas" | "modelo" | "teriaFeito" | "recusadas" | "pendente" | "mensagemDeEquipa">,
  ): ResultadoDoAgente => ({
    ...r,
    // A acção proposta só conta com uma resposta aceite (que leva a pergunta do SIM / do CANCELAR).
    pendente: r.estado === "ok" ? estado.pendente : null,
    mensagemDeEquipa: r.estado === "equipa" ? estado.mensagemDeEquipa : null,
    teriaFeito: estado.teriaFeito,
    recusadas: estado.recusadas,
    uso,
    custoUsd: custoEmUsd(uso),
    idas,
    modelo,
  });

  const comecou = Date.now();
  while (idas < IDAS_NO_MAXIMO) {
    if (pedido.prazoMs != null && idas > 0 && Date.now() - comecou > pedido.prazoMs) {
      return fim({ estado: "erro", texto: null, motivo: `passou o prazo da volta (${Math.round(pedido.prazoMs / 1000)} s)` });
    }
    idas += 1;
    let resposta: Anthropic.Beta.BetaMessage;
    try {
      resposta = await deps.cliente.beta.messages.create({
        model: MODELO_DA_VITORIA_AGENTE,
        max_tokens: MAX_TOKENS,
        betas: [BETA_DA_RECOLHA],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: pedido.esforco ?? ESFORCO_POR_OMISSAO },
        // O aviso é fixo e vai à frente: a cache apanha as ferramentas e o aviso; a de cima, o resto da conversa.
        system: [{ type: "text", text: AVISO_AO_MODELO, cache_control: { type: "ephemeral" } }],
        cache_control: { type: "ephemeral" },
        tools: FERRAMENTAS_DA_VITORIA,
        tool_choice: { type: "auto" },
        messages: mensagens,
      });
    } catch (err) {
      const motivo = erroEmPalavras(err);
      await deps.registar({ ferramenta: "chamada", erro: motivo, modelo: MODELO_DA_VITORIA_AGENTE }).catch(() => {});
      return fim({ estado: "erro", texto: null, motivo });
    }
    const daIda = usoDe(resposta.usage);
    uso = somarUsos(uso, daIda);
    modelo = resposta.model ?? MODELO_DA_VITORIA_AGENTE;
    await deps
      .registar({ ferramenta: "chamada", modelo, uso: daIda, custoUsd: custoEmUsd(daIda), resultado: { stop_reason: resposta.stop_reason } })
      .catch(() => {});

    if (resposta.stop_reason === "refusal") {
      return fim({ estado: "recusou", texto: null, motivo: "o modelo recusou (e a recolha também)" });
    }
    // O conteúdo volta tal e qual (o pensamento incluído).
    mensagens.push({ role: "assistant", content: resposta.content });
    const pedidosDeFerramenta = resposta.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const soltos = resposta.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text.trim());
    if (soltos.some(Boolean)) textoSolto = soltos.filter(Boolean).join("\n");

    if (resposta.stop_reason === "max_tokens") {
      return fim({ estado: "erro", texto: null, motivo: "a resposta ficou cortada (max_tokens)" });
    }
    if (resposta.stop_reason !== "tool_use" || pedidosDeFerramenta.length === 0) break;

    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const b of pedidosDeFerramenta) {
      const r = await correrFerramenta(b.name, b.input, deps.ferramentas, estado);
      await deps.registar({ ferramenta: b.name, entrada: b.input, resultado: r.resultado, erro: r.erro ? "recusada" : null }).catch(() => {});
      resultados.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(r.resultado), ...(r.erro ? { is_error: true } : {}) });
    }
    // Todos os resultados numa só mensagem (o modelo continua a pedir várias ao mesmo tempo).
    mensagens.push({ role: "user", content: resultados });
    // Depois de uma resposta aceite, não há mais nada a fazer.
    if (estado.respostaAceite && pedidosDeFerramenta.some((b) => b.name === "propor_resposta")) break;
    // d92: a sério, um dado do pedido gravam-no as regras — a volta acaba aqui, e quem chama passa às regras.
    if (estado.deixarAsRegras) return fim({ estado: "bloqueado", texto: null, motivo: `deixa às regras: ${estado.deixarAsRegras}` });
  }

  if (estado.respostaAceite) {
    await deps.registar({ ferramenta: "resposta", texto: estado.respostaAceite }).catch(() => {});
    return fim({ estado: "ok", texto: estado.respostaAceite, motivo: null });
  }
  if (estado.passouAEquipa) {
    return fim({ estado: "equipa", texto: null, motivo: estado.passouAEquipa });
  }
  // Sem propor_resposta: o texto solto também passa pela guarda.
  if (textoSolto) {
    const motivo =
      motivoParaBloquearOAgente(textoSolto, eurosDosResultados(estado.resultados)) ??
      (estado.fraseObrigatoria && !textoSolto.replace(/\s+/g, " ").includes(estado.fraseObrigatoria.replace(/\s+/g, " ").trim())
        ? `falta a frase obrigatória: «${estado.fraseObrigatoria}»`
        : null);
    if (!motivo) {
      await deps.registar({ ferramenta: "resposta", texto: textoSolto }).catch(() => {});
      return fim({ estado: "ok", texto: textoSolto, motivo: null });
    }
    estado.recusadas.push({ texto: textoSolto, motivo });
    return fim({ estado: "bloqueado", texto: null, motivo });
  }
  const ultima = estado.recusadas.at(-1);
  return fim({ estado: "bloqueado", texto: null, motivo: ultima ? ultima.motivo : `sem resposta em ${idas} idas` });
}
