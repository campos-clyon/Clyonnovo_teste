import { instanteDaBase } from "./hora-de-lisboa";
import { NOVO_MODELO_DESDE, novoModeloEmVigor } from "./novo-modelo";
import type { LinhaDoNossoLado } from "./do-nosso-lado";

/**
 * O TRABALHO DO MODELO NOVO FECHA SEM DEPENDER SÓ DO PARCEIRO — d15 (CEO e
 * dono, 13-11-2026).
 *
 * A partir de 15-11-2026 o cliente paga ao parceiro, e a taxa da plataforma só
 * nasce quando o trabalho fecha (`quandoLiberta`, `taxa-a-passar-a-clyon.ts`).
 * Quem fechava era quase sempre o parceiro, com o «Está feito». Daí as três
 * regras desta decisão — esta é a primeira, a das horas:
 *
 *   · 24 h depois da data do trabalho, contratado e sem «Está feito», acende uma
 *     linha na Mesa («Do nosso lado») e sai um aviso à equipa (d23);
 *   · 48 h depois, o cliente vê a pergunta de um toque «O trabalho já foi
 *     feito?» na página do pedido (e na app, R5). O «Sim» fecha o trabalho como
 *     o «Está feito» fechado pelo cliente, e a taxa nasce;
 *   · (a terceira — sem apagar a conta com o valor por pagar — vive na rota da
 *     conta do parceiro.)
 *
 * SÓ NO MODELO NOVO E SÓ A PARTIR DA DATA ÚNICA (`NOVO_MODELO_DESDE`): antes de
 * 15-11 nada aqui devolve coisa nenhuma, e um trabalho do modelo antigo (pago à
 * CLYON antes da data, um Trabalho CLYON) nunca entra — quem o diz é quem chama
 * (`noNovoModelo`), pela regra de `eDoNovoModelo`.
 *
 * O ENVIO DO EMAIL ao cliente fica atrás de um interruptor nas Configs,
 * desligado por omissão (`fecho-do-modelo-novo-na-base.ts`). A Mesa, o aviso à
 * equipa e a pergunta dentro da página do pedido ligam-se sozinhos com a data.
 *
 * PURO: o relógio e o modelo chegam de fora, para os testes correrem com o
 * relógio simulado.
 */

/** A data única do modelo — a mesma de `novo-modelo.ts`, nunca outra. */
export const FECHO_DO_MODELO_NOVO_DESDE = NOVO_MODELO_DESDE;

/** Horas depois da data do trabalho até à linha na Mesa e ao aviso à equipa. */
export const HORAS_ATE_A_MESA = 24;
/** Horas depois da data do trabalho até à pergunta ao cliente. */
export const HORAS_ATE_A_PERGUNTA = 48;
/** Quem respondeu «Ainda não» volta a ser perguntado passado este tempo. */
export const HORAS_ATE_PERGUNTAR_OUTRA_VEZ = 48;

/** A acção que o cliente manda (link, conta, app) — `agirComoCliente`. */
export const ACCAO_DO_FECHO = "trabalho_ja_feito";

/* ── Os textos — os mesmos no site, no email e na app ──────────────────── */

export const PERGUNTA_DO_FECHO = "O trabalho já foi feito?";
export const RESPOSTA_SIM_DO_FECHO = "Sim, já foi feito";
export const RESPOSTA_NAO_DO_FECHO = "Ainda não";
export const ASSUNTO_DO_EMAIL_DO_FECHO = "O trabalho já foi feito?";

/** O porquê da pergunta, ao cliente. Voz de plataforma: quem fez é o parceiro. */
export function explicacaoDoFecho(nomeDoParceiro: string | null | undefined): string {
  const nome = (nomeDoParceiro ?? "").trim().split(/\s+/)[0] || "o parceiro";
  return `A data do trabalho já passou e ${nome} ainda não o marcou como feito. Se já ficou feito, diga-nos com um toque: o trabalho fica fechado e pode avaliar ${nome}.`;
}

export const OBRIGADO_DO_SIM = "Obrigado. O trabalho ficou fechado.";
export const OBRIGADO_DO_NAO = "Obrigado por nos dizer. A equipa da CLYON vai acompanhar o trabalho com o parceiro.";

/* ── A regra ─────────────────────────────────────────────────────────────── */

/** O que é preciso de um trabalho para saber em que ponto está o fecho. */
export type TrabalhoParaOFecho = {
  pedidoId: number;
  negociacaoId: number;
  estado: string;
  /** A data combinada com o parceiro — ou, sem ela, a que o cliente pediu. */
  dataCombinada?: Date | string | null;
  dataAgendada?: Date | string | null;
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  /** O estado do pedido: um pedido arrumado (cancelado, arquivado…) não entra. */
  estadoDoPedido?: string | null;
  /** Segue o modelo de 15-11 (`eDoNovoModelo`, com os pagamentos lidos)? Quem chama diz. */
  noNovoModelo: boolean;
  /** O cliente respondeu «Ainda não» — quando. */
  respondeuNaoEm?: Date | string | null;
};

export type FaseDoFecho = "nada" | "mesa" | "pergunta";

const PEDIDO_ARRUMADO = new Set(["cancelado", "arquivado", "concluido", "rejeitado"]);
const HORA_MS = 3600 * 1000;

/** A data do trabalho: a combinada, ou a que o cliente pediu. */
export function dataDoTrabalho(t: Pick<TrabalhoParaOFecho, "dataCombinada" | "dataAgendada">): Date | null {
  return instanteDaBase(t.dataCombinada ?? null) ?? instanteDaBase(t.dataAgendada ?? null);
}

/** Há quantas horas passou a data do trabalho (negativo se ainda não chegou), ou `null` sem data. */
export function horasDesdeAData(t: TrabalhoParaOFecho, agora: Date): number | null {
  const d = dataDoTrabalho(t);
  return d ? (agora.getTime() - d.getTime()) / HORA_MS : null;
}

/**
 * EM QUE PONTO ESTÁ O FECHO: «nada», «mesa» (24 h) ou «pergunta» (48 h).
 * Antes de 15-11, fora do modelo novo, sem data, com o «Está feito» ou já
 * confirmado, ou com o pedido arrumado — sempre «nada».
 */
export function faseDoFecho(t: TrabalhoParaOFecho, agora: Date): FaseDoFecho {
  if (!novoModeloEmVigor(agora)) return "nada";
  if (!t.noNovoModelo) return "nada";
  if (t.estado !== "acordada") return "nada";
  if (t.execucaoEnviadaEm != null || t.confirmadoEm != null) return "nada";
  if (PEDIDO_ARRUMADO.has(String(t.estadoDoPedido ?? ""))) return "nada";
  const horas = horasDesdeAData(t, agora);
  if (horas == null) return "nada";
  if (horas >= HORAS_ATE_A_PERGUNTA) return "pergunta";
  if (horas >= HORAS_ATE_A_MESA) return "mesa";
  return "nada";
}

/** O cliente pode ser perguntado agora? A fase «pergunta», e sem um «Ainda não» das últimas 48 h. */
export function perguntaAoClienteAgora(t: TrabalhoParaOFecho, agora: Date): boolean {
  if (faseDoFecho(t, agora) !== "pergunta") return false;
  const nao = instanteDaBase(t.respondeuNaoEm ?? null);
  if (nao && agora.getTime() - nao.getTime() < HORAS_ATE_PERGUNTAR_OUTRA_VEZ * HORA_MS) return false;
  return true;
}

/* ── A Mesa ──────────────────────────────────────────────────────────────── */

export const TITULO_DO_GRUPO_DO_FECHO = "Modelo novo: contratados com a data passada há mais de 24 h, sem «Está feito»";

/** O corpo do aviso à equipa (d23), já escrito. Sem dados de pessoas: só o n.º do pedido. */
export function avisoAEquipaDoFecho(pedidoId: number, fase: FaseDoFecho): string {
  return fase === "pergunta"
    ? `Pedido #${pedidoId}: a data passou há mais de 48 h e o parceiro não disse «Está feito». O cliente já vê a pergunta «${PERGUNTA_DO_FECHO}».`
    : `Pedido #${pedidoId}: a data passou há mais de 24 h e o parceiro não disse «Está feito». A taxa só nasce quando o trabalho fechar.`;
}

/**
 * AS LINHAS DA MESA — uma por pedido, nas fases «mesa» e «pergunta». Espera
 * desde a data do trabalho. A chave do aviso à equipa é por tipo e pedido, por
 * isso sai uma vez por espera (`avisos-a-equipa.ts`).
 */
export function linhasDoFecho(trabalhos: readonly TrabalhoParaOFecho[], agora: Date): LinhaDoNossoLado[] {
  const out: LinhaDoNossoLado[] = [];
  const vistos = new Set<number>();
  for (const t of trabalhos) {
    if (vistos.has(t.pedidoId)) continue;
    const fase = faseDoFecho(t, agora);
    if (fase === "nada") continue;
    const d = dataDoTrabalho(t);
    if (!d) continue;
    vistos.add(t.pedidoId);
    const horas = Math.floor((agora.getTime() - d.getTime()) / HORA_MS);
    out.push({
      tipo: "sem_fecho",
      pedidoId: t.pedidoId,
      telefone: null,
      esperaS: Math.max(0, Math.floor((agora.getTime() - d.getTime()) / 1000)),
      oQue:
        fase === "pergunta"
          ? `a data passou há ${horas} h, sem «Está feito» — o cliente já vê a pergunta`
          : `a data passou há ${horas} h, sem «Está feito» — a taxa ainda não nasceu`,
      aviso: avisoAEquipaDoFecho(t.pedidoId, fase),
    });
  }
  return out;
}

/* ── A pergunta, para os ecrãs do cliente (página, conta e app R5) ─────── */

export type PerguntaDoFecho = {
  negociacaoId: number;
  /** A acção a mandar, com `resposta: "sim" | "nao"`. */
  accao: typeof ACCAO_DO_FECHO;
  pergunta: string;
  explicacao: string;
  sim: string;
  nao: string;
};

export function perguntaDoFechoParaOCliente(
  t: TrabalhoParaOFecho,
  nomeDoParceiro: string | null | undefined,
  agora: Date,
): PerguntaDoFecho | null {
  if (!perguntaAoClienteAgora(t, agora)) return null;
  return {
    negociacaoId: t.negociacaoId,
    accao: ACCAO_DO_FECHO,
    pergunta: PERGUNTA_DO_FECHO,
    explicacao: explicacaoDoFecho(nomeDoParceiro),
    sim: RESPOSTA_SIM_DO_FECHO,
    nao: RESPOSTA_NAO_DO_FECHO,
  };
}

/** A resposta do cliente, lida do corpo: «sim», «nao», ou nada. */
export function lerRespostaDoFecho(v: unknown): "sim" | "nao" | null {
  return v === "sim" || v === "nao" ? v : null;
}
