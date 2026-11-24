/**
 * A VITÓRIA AGENTE A SÉRIO — d92 (23-11-2026). A ORQUESTRA, sem base (as
 * dependências vêm de fora; nos testes, fingidas).
 *
 * DESLIGADO POR OMISSÃO. Com o interruptor «Vitória agente — conversa livre»
 * ligado (Configs, só o administrador, LIGAR), a mensagem do cliente passa
 * por aqui ANTES das regras:
 *
 *  1. o que o agente deixou pendente lê-se primeiro, pelo código: o SIM ao
 *     fecho proposto fecha pelo caminho de sempre (o botão «Contratar» do
 *     WhatsApp → `fecharPeloCliente`: o interruptor «fechar», a guia antes de
 *     contratar, o retrato para desfazer), o CANCELAR cancela pelo caminho
 *     único (`cancelar-pelo-lembrete.ts`) — os dois só com «Vitória agente —
 *     aceitar» também ligado; a proposta relê-se antes (a mesma, o mesmo
 *     total, dentro dos 30 min);
 *  2. ficam com as REGRAS: quem ainda não tem pedido (a recolha faz o pedido),
 *     a recolha a meio, a conversa que uma pessoa da equipa tomou, as
 *     fotografias e os vídeos, as respostas curtas que o código lê (SIM, NÃO,
 *     1/2/3, CANCELAR, um valor, uma data) e a resposta a uma pergunta de
 *     dados que o código fez (a morada, o andar…);
 *  3. o resto é do AGENTE: a resposta dele É a que sai (pela porta de sempre,
 *     `enviarTextoWhatsApp`, que traduz para a língua do cliente e não repete);
 *     ao passar à equipa, sai a mensagem que ele escreveu (revista) e a
 *     conversa fica para uma pessoa;
 *  3b. d97: a pergunta ao parceiro SAI sozinha (`perguntarAoParceiro`: o
 *     WhatsApp dos avisos e a app Pro); só se não puder sair passa à equipa.
 *     E quando o cliente pergunta alguma coisa a meio de um fecho proposto
 *     («inclui o transporte?»), o agente sabe-o (a nota do turno): responde
 *     e repete a pergunta do SIM;
 *  4. REDE DE SEGURANÇA: se o agente falhar, passar o prazo da volta, passar o
 *     tecto do dia, ou a guarda bloquear, respondem as regras, como hoje.
 *
 * Nunca lança: na dúvida, as regras.
 */

import { MENSAGEM_DE_PASSAR_A_UMA_PESSOA } from "../voz-da-vitoria";
import type { ResultadoDoAgente } from "./cliente";
import { pendenteEmPalavras, respostaAoPendente, type Pendente, type PerguntaAoParceiro } from "./pendentes";
import { emEuros, motivoParaNaoFecharNoSim, type FechoProposto, type PropostaDoAgente } from "./propostas-do-agente";

/** O tempo da volta do agente a sério: cabe nos 60 s da ponte, com a espera da rajada e, se falhar, as regras. */
export const PRAZO_DA_VOLTA_AO_VIVO_MS = 22_000;

/** As respostas curtas que o código lê (e que nunca vão ao agente). */
const RESPOSTA_DE_CODIGO =
  /^(?:sim|nao|não|ok|okay|s|n|1|2|3|4|cancelar|cancel|annuler|aceito|recuso|yes|no|oui|non|si|sí|obrigad[oa]|ja|nein)[\s.!]*$/i;
const SO_UM_VALOR = /^\s*(?:€\s*)?\d{1,5}(?:[.,]\d{1,2})?\s*(?:€|euros?)?\s*$/i;
const SO_UMA_DATA = /^\s*\d{1,2}\s*[/.-]\s*\d{1,2}(?:\s*[/.-]\s*\d{2,4})?(?:\s+(?:às\s+)?\d{1,2}[:h]\d{0,2})?\s*$/i;

export type SituacaoDaConversa = {
  temPedidos: boolean;
  interrompida: boolean;
  recolhaEmCurso: boolean;
  imagens: number;
  videos: number;
  texto: string;
  /** A última pergunta de dados que o código fez (a morada, o andar…) e ainda espera resposta? */
  perguntaDeDadosAEspera: boolean;
  /** d111: a desistência clara às propostas, a resposta à lista ou a escolha ao seguimento — o código lê-as. */
  oCodigoLe?: boolean;
};

export type QuemResponde = { quem: "regras" | "agente"; porque: string };

/** PURA: quem responde a esta mensagem com a «conversa livre» ligada (sem contar os pendentes). */
export function quemResponde(s: SituacaoDaConversa): QuemResponde {
  if (s.interrompida) return { quem: "regras", porque: "uma pessoa da equipa tem a conversa" };
  if (s.imagens > 0 || s.videos > 0) return { quem: "regras", porque: "fotografias ou vídeos" };
  if (!s.texto.trim()) return { quem: "regras", porque: "sem texto" };
  if (!s.temPedidos) return { quem: "regras", porque: "ainda sem pedido (a recolha faz o pedido)" };
  if (s.recolhaEmCurso) return { quem: "regras", porque: "a recolha está a meio" };
  const t = s.texto.trim();
  if (RESPOSTA_DE_CODIGO.test(t) || SO_UM_VALOR.test(t) || SO_UMA_DATA.test(t)) return { quem: "regras", porque: "resposta curta que o código lê" };
  if (s.perguntaDeDadosAEspera) return { quem: "regras", porque: "responde a uma pergunta de dados do código" };
  if (s.oCodigoLe) return { quem: "regras", porque: "a escolha ou a desistência às propostas, que o código lê (d111)" };
  return { quem: "agente", porque: "conversa livre" };
}

export type ConteudoDaRajada = { tipo: "texto"; texto: string; imagens?: number; visto?: string[]; videos?: number };

/** O que o modo a sério precisa do mundo. Nos testes, fingido. */
export type DependenciasAoVivo = {
  agora: Date;
  interruptores: () => Promise<{ conversa: boolean; aceitar: boolean }>;
  situacao: () => Promise<Omit<SituacaoDaConversa, "imagens" | "videos" | "texto">>;
  /** As regras de sempre (tratarMensagemDoCliente). */
  regras: () => Promise<void>;
  pendente: () => Promise<Pendente | null>;
  acabarPendente: (p: Pendente, como: string) => Promise<void>;
  gravarPendente: (p: Pendente) => Promise<void>;
  propostasParaEscolher: (pedidoId: number) => Promise<PropostaDoAgente[]>;
  /** O fecho de sempre, como o botão «Contratar» (ct:pedido:negociação). */
  fecharPeloBotao: (pedidoId: number, negociacaoId: number) => Promise<void>;
  cancelarPeloCancelar: (pedidoId: number) => Promise<{ ok: true } | { ok: false; porque: string }>;
  marcarPerguntaDoCancelar: (pedidoId: number) => Promise<void>;
  /** d97: `nota` é o que o agente tem de saber deste turno (um fecho que estava à espera do SIM). */
  correrOAgente: (prazoMs: number, nota?: string) => Promise<ResultadoDoAgente>;
  /** d97: manda a pergunta ao parceiro (WhatsApp dos avisos + app Pro) e regista-a. Sem canal, diz porquê. */
  perguntarAoParceiro: (p: PerguntaAoParceiro) => Promise<{ ok: true; jaPerguntado?: boolean; ate?: string } | { ok: false; porque: string }>;
  /** A porta de sempre (traduz, não repete). */
  enviar: (texto: string) => Promise<boolean>;
  /** Passa a uma pessoa: manda a mensagem (null = nenhuma, já saiu a do agente) e interrompe o número com o motivo. */
  passarAEquipa: (motivo: string, mensagem: string | null) => Promise<void>;
  /** Uma linha no painel «Ensaio da Vitória» (o que saiu a sério). Nunca deve lançar. */
  registar: (l: { estado: string; texto: string | null; motivo: string | null; teriaFeito: string[]; resultado?: ResultadoDoAgente }) => Promise<void>;
};

export type QuemRespondeu = "agente" | "codigo" | "regras";

/** A mensagem de quando o SIM chega e a proposta já não é a mesma. */
export function mensagemDaPropostaMudada(parceiro: string): string {
  return `Obrigada pela resposta! Entretanto a proposta de ${parceiro} mudou, por isso ainda não reservei nada — uma pessoa da equipa confirma consigo o valor de agora, já a seguir.`;
}

/** d97: a nota do turno quando o cliente responde a um fecho proposto com outra coisa (uma pergunta). */
export function notaDoFechoAEspera(f: FechoProposto): string {
  return (
    `A CLYON tinha acabado de propor o fecho do pedido #${f.pedidoId} com ${f.parceiro} (${emEuros(f.total)}, à espera do SIM), ` +
    "e o cliente respondeu com outra coisa. Responde ao que ele disse (o que o serviço inclui responde-se já, com o_que_o_servico_inclui); " +
    `se ele continua com esta proposta, chama aceitar_proposta (pedido ${f.pedidoId}, escolha «${f.parceiro}») para a pergunta do SIM ir outra vez na resposta.`
  );
}

/**
 * RESPONDER A SÉRIO, OU DEIXAR ÀS REGRAS. Devolve quem respondeu (as regras
 * só correm aqui dentro quando é a vez delas). Nunca lança.
 */
export async function responderAoVivo(conteudo: ConteudoDaRajada, deps: DependenciasAoVivo): Promise<QuemRespondeu> {
  const pelasRegras = async (): Promise<QuemRespondeu> => {
    await deps.regras();
    return "regras";
  };
  let ints: { conversa: boolean; aceitar: boolean };
  try {
    ints = await deps.interruptores();
  } catch {
    return pelasRegras();
  }
  if (!ints.conversa) return pelasRegras();

  // Depois de algo sair para o cliente, um erro já não chama as regras (seriam duas respostas).
  let jaSaiu = false;
  try {
    const texto = String(conteudo.texto ?? "");
    const base = await deps.situacao();
    const situacao: SituacaoDaConversa = { ...base, texto, imagens: conteudo.imagens ?? 0, videos: conteudo.videos ?? 0 };
    if (situacao.interrompida || situacao.imagens > 0 || situacao.videos > 0) return pelasRegras();

    // 1. O que o agente deixou pendente — lido pelo código, antes de tudo.
    let acabouDeResponderAoAgente = false;
    let nota: string | undefined;
    const p = await deps.pendente();
    if (p && p.tipo !== "parceiro") {
      const r = respostaAoPendente(p, texto, deps.agora);
      if (r.tipo === "confirmou" && ints.aceitar) {
        if (p.tipo === "fecho") {
          const motivo = motivoParaNaoFecharNoSim(p, deps.agora, await deps.propostasParaEscolher(p.pedidoId));
          if (motivo) {
            await deps.acabarPendente(p, `não fechou: ${motivo}`);
            jaSaiu = true;
            await deps.passarAEquipa(`Pedido #${p.pedidoId}: o cliente disse SIM ao fecho com ${p.parceiro} pela Vitória, mas ${motivo}`, mensagemDaPropostaMudada(p.parceiro));
            await deps.registar({ estado: "vivo_codigo", texto: null, motivo, teriaFeito: [`não fechou o #${p.pedidoId}: ${motivo}`] });
            return "codigo";
          }
          await deps.acabarPendente(p, "fechado pelo SIM");
          jaSaiu = true;
          await deps.fecharPeloBotao(p.pedidoId, p.negociacaoId);
          await deps.registar({ estado: "vivo_codigo", texto: null, motivo: null, teriaFeito: [`fechou o #${p.pedidoId} com ${p.parceiro} pelo SIM do cliente`] });
          return "codigo";
        }
        jaSaiu = true;
        const c = await deps.cancelarPeloCancelar(p.pedidoId);
        await deps.acabarPendente(p, c.ok ? "cancelado pelo CANCELAR" : `não cancelou: ${c.porque}`);
        if (!c.ok) {
          await deps.passarAEquipa(`Pedido #${p.pedidoId}: respondeu CANCELAR à Vitória, mas ${c.porque} — cancelar à mão`, MENSAGEM_DE_PASSAR_A_UMA_PESSOA);
        }
        await deps.registar({
          estado: "vivo_codigo",
          texto: null,
          motivo: c.ok ? null : c.porque,
          teriaFeito: [c.ok ? `cancelou o #${p.pedidoId} pelo CANCELAR do cliente` : `não cancelou o #${p.pedidoId}: ${c.porque}`],
        });
        return "codigo";
      }
      // Outra resposta (ou o prazo passou, ou o «aceitar» desligou-se): o pendente acaba e quem responde é o agente.
      await deps.acabarPendente(p, r.tipo === "confirmou" ? "confirmou com o «aceitar» desligado" : r.tipo);
      acabouDeResponderAoAgente = true;
      if (p.tipo === "fecho" && r.tipo === "outra") nota = notaDoFechoAEspera(p);
    }

    // 2. O que fica com as regras.
    if (!acabouDeResponderAoAgente) {
      const q = quemResponde(situacao);
      if (q.quem === "regras") return pelasRegras();
    } else if (!situacao.temPedidos || situacao.recolhaEmCurso) {
      return pelasRegras();
    }

    // 3. O agente.
    // O prazo também por fora: uma ida lenta não pode deixar o cliente sem resposta (a função da ponte tem 60 s).
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const r = await Promise.race([
      deps.correrOAgente(PRAZO_DA_VOLTA_AO_VIVO_MS, nota),
      new Promise<null>((res) => {
        relogio = setTimeout(() => res(null), PRAZO_DA_VOLTA_AO_VIVO_MS + 6_000);
      }),
    ]).finally(() => clearTimeout(relogio));
    if (!r) {
      await deps.registar({ estado: "vivo_regras", texto: null, motivo: "o agente demorou de mais", teriaFeito: [] });
      return pelasRegras();
    }
    if (r.estado === "ok" && r.texto) {
      jaSaiu = true;
      await deps.enviar(r.texto);
      const feito = [...r.teriaFeito];
      if (r.pendente) {
        await deps.gravarPendente(r.pendente);
        if (r.pendente.tipo === "cancelar") await deps.marcarPerguntaDoCancelar(r.pendente.pedidoId).catch(() => {});
        if (r.pendente.tipo === "parceiro") {
          // d97: a pergunta sai sozinha para o parceiro. Só se não puder sair (sem WhatsApp dos avisos nem app) vai à equipa.
          const q = await deps.perguntarAoParceiro(r.pendente).catch((e) => ({ ok: false as const, porque: e instanceof Error ? e.message.slice(0, 120) : "falhou" }));
          if (q.ok) {
            feito.push(
              q.jaPerguntado
                ? `a pergunta a ${r.pendente.parceiro} sobre «${r.pendente.condicao}» já tinha saído (#${r.pendente.pedidoId}): não se repete`
                : `perguntou ao parceiro ${r.pendente.parceiro}: «${r.pendente.condicao}» (#${r.pendente.pedidoId}) — à espera da resposta${q.ate ? ` até ${q.ate}` : ""}`,
            );
          } else {
            await deps.passarAEquipa(
              `Pedido #${r.pendente.pedidoId}: perguntar a ${r.pendente.parceiro} se consegue «${r.pendente.condicao}» — a pergunta não saiu (${q.porque}). Mensagem pronta: ${r.pendente.mensagem}`,
              null,
            );
            feito.push(`a pergunta a ${r.pendente.parceiro} não saiu (${q.porque}): passou à equipa`);
          }
        } else feito.push(pendenteEmPalavras(r.pendente, false));
      }
      await deps.registar({ estado: "vivo_ok", texto: r.texto, motivo: null, teriaFeito: feito, resultado: r });
      return "agente";
    }
    if (r.estado === "equipa") {
      jaSaiu = true;
      await deps.passarAEquipa(r.motivo ?? "a Vitória passou à equipa", r.mensagemDeEquipa ?? MENSAGEM_DE_PASSAR_A_UMA_PESSOA);
      await deps.registar({ estado: "vivo_equipa", texto: r.mensagemDeEquipa, motivo: r.motivo, teriaFeito: r.teriaFeito, resultado: r });
      return "agente";
    }
    // 4. A rede de segurança.
    await deps.registar({ estado: "vivo_regras", texto: null, motivo: r.motivo, teriaFeito: r.teriaFeito, resultado: r });
    return pelasRegras();
  } catch (e) {
    console.error("[vitoria-agente] a resposta a sério falhou:", e instanceof Error ? e.message : e);
    // Já saiu alguma coisa: não se responde outra vez. Nada saiu: respondem as regras.
    return jaSaiu ? "agente" : pelasRegras();
  }
}
