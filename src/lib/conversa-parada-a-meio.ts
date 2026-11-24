/**
 * A CONVERSA PARADA A MEIO — d93, ponto 1 (CEO e dono, 23-11-2026).
 *
 * Antes de o pedido estar registado, a última mensagem foi uma pergunta da
 * Vitória e o cliente não respondeu. A mensagem gentil dos 10 minutos (d25)
 * continua; depois dela:
 *
 *   · um lembrete 2 horas depois — se ainda for das 9h às 20h de Lisboa nesse
 *     dia; senão, fica para a manhã;
 *   · outro na manhã seguinte (a partir das 10h);
 *   · um último no dia a seguir;
 *   · e, no outro dia, a conversa fecha com uma mensagem gentil (o rascunho
 *     sai: não se guarda a morada de ninguém sem razão).
 *
 * Cada lembrete RETOMA de onde ficou — diz o que já está anotado (as linhas do
 * resumo que já têm resposta, `oQueJaEstaAnotado`) e repete só a pergunta em
 * falta (`perguntaDeSeguimento`, que o `passoDaPergunta` reconhece depois de
 * «Para continuarmos:»). NUNCA recomeça a recolha. O rascunho guarda-se 7 dias
 * (`HORAS_DO_RASCUNHO`): era 1 dia, e a cliente que disse tudo às 11h58 ouviu
 * no dia seguinte «o que é para levar?» outra vez.
 *
 * Contam para a uma-por-dia comum (d85) e respeitam o «não contactar» (d93);
 * a mensagem dos 10 minutos não conta.
 *
 * PURO. A base e a passagem estão em `conversa-parada-a-meio-na-base.ts`.
 */

import { JANELA_DE_CONTACTO } from "./janela-de-contacto";
import { diaEmLisboa, pecasEmLisboa } from "./hora-de-lisboa";

/** Quanto tempo o rascunho da recolha vale (era um dia — d93). */
export const HORAS_DO_RASCUNHO = 7 * 24;

/** O rascunho ainda vale? (`actualizadoEm` da recolha.) Pura. */
export function rascunhoAindaVale(actualizadoEm: string | Date | null | undefined, agora: Date = new Date()): boolean {
  if (actualizadoEm == null) return false;
  const t = new Date(actualizadoEm).getTime();
  if (!Number.isFinite(t)) return false;
  return agora.getTime() - t <= HORAS_DO_RASCUNHO * 3600_000;
}

/** O primeiro lembrete, depois da pergunta sem resposta. */
export const HORAS_ATE_AO_PRIMEIRO = 2;
/** Os outros, a partir desta hora (Lisboa). */
export const HORA_DOS_OUTROS = 10;
/** A janela: a de contacto (das 9h00 às 19h59, em Lisboa). */
export const JANELA_DA_CONVERSA_PARADA = { das: JANELA_DE_CONTACTO.abre, as: JANELA_DE_CONTACTO.fecha } as const;

export type PassoDaConversaParada = "lembrete1" | "lembrete2" | "lembrete3" | "fechar";

export type CicloDaConversaParada = {
  /** Quando saiu a pergunta que ficou sem resposta. */
  desde: Date;
  lembrete1Em?: Date | null;
  lembrete2Em?: Date | null;
  lembrete3Em?: Date | null;
  fechadoEm?: Date | null;
};

/**
 * O PASSO QUE TOCA AGORA — ou null. Pura.
 *
 *   · fechado, ou fora da janela de contacto: nenhum;
 *   · nunca dois no mesmo dia;
 *   · o 1.º (2 h depois) só no próprio dia da pergunta; passado o dia, salta-se
 *     para o da manhã (a partir das 10h);
 *   · cada um dos seguintes num dia depois do anterior, a partir das 10h; o
 *     fecho no dia a seguir ao último.
 */
export function proximoPassoDaConversaParada(c: CicloDaConversaParada, agora: Date): PassoDaConversaParada | null {
  if (c.fechadoEm) return null;
  const h = pecasEmLisboa(agora).hora;
  if (h < JANELA_DA_CONVERSA_PARADA.das || h >= JANELA_DA_CONVERSA_PARADA.as) return null;
  const hoje = diaEmLisboa(agora);
  const ultimo = c.lembrete3Em ?? c.lembrete2Em ?? c.lembrete1Em ?? null;
  if (ultimo && diaEmLisboa(ultimo) >= hoje) return null;
  const deManha = h >= HORA_DOS_OUTROS;
  if (!c.lembrete1Em && !c.lembrete2Em) {
    if (hoje === diaEmLisboa(c.desde)) {
      return agora.getTime() - c.desde.getTime() >= HORAS_ATE_AO_PRIMEIRO * 3600_000 ? "lembrete1" : null;
    }
    return hoje > diaEmLisboa(c.desde) && deManha ? "lembrete2" : null;
  }
  if (!c.lembrete2Em) return deManha ? "lembrete2" : null;
  if (!c.lembrete3Em) return deManha ? "lembrete3" : null;
  return deManha ? "fechar" : null;
}

/* ── Os textos (a voz da Vitória; sem emoji) ─────────────────────────────── */

/** A âncora da pergunta: o `passoDaPergunta` lê a pergunta depois dela. */
export const PARA_CONTINUARMOS = "Para continuarmos:";

export type DadosDoLembreteDaConversa = {
  /** O primeiro nome, se o deu. */
  nome?: string | null;
  /** O serviço em palavras, em minúsculas («recolha de monos»), se já se sabe. */
  servico?: string | null;
  /** As linhas do que já está anotado (`oQueJaEstaAnotado`). */
  anotado: readonly string[];
  /** A pergunta em falta (`perguntaParaContinuar`: a de sempre, sem a apresentação). */
  pergunta: string;
};

function ola(nome: string | null | undefined): string {
  const p = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return p.length >= 2 ? `Olá, ${p.charAt(0).toUpperCase()}${p.slice(1)}!` : "Olá!";
}

const oSeuPedido = (servico: string | null | undefined) => (servico?.trim() ? `seu pedido de ${servico.trim()}` : "seu pedido");

/** «Já tenho anotado:» e as linhas — ou nada. */
function oAnotado(d: DadosDoLembreteDaConversa): string[] {
  return d.anotado.length > 0 ? ["Já tenho anotado:", ...d.anotado.map((l) => `- ${l}`)] : [];
}

/** O texto de cada passo. Pura. */
export function textoDaConversaParada(passo: PassoDaConversaParada, d: DadosDoLembreteDaConversa): string {
  if (passo === "fechar") {
    return (
      `${ola(d.nome)} Como não voltámos a falar, deixei o ${oSeuPedido(d.servico)} sem registar. ` +
      "Se ainda precisar, é só escrever-me por aqui quando quiser: pedir é grátis e sem compromisso."
    );
  }
  const abertura =
    passo === "lembrete1"
      ? `${ola(d.nome)} Ficámos a meio do ${oSeuPedido(d.servico)}, e não quero que se perca.`
      : passo === "lembrete2"
        ? `${ola(d.nome)} Volto ao ${oSeuPedido(d.servico)}, que ficou a meio.`
        : `${ola(d.nome)} É a última vez que lhe escrevo sobre o ${oSeuPedido(d.servico)}: sem resposta, amanhã deixo-o sem registar.`;
  // A pergunta na linha dela, depois da âncora: as traduções fixas lêem-na como a pergunta de sempre.
  return [abertura, ...oAnotado(d), PARA_CONTINUARMOS, d.pergunta].join("\n");
}

/** O que fica no registo da passagem e no ciclo. */
export const ROTULO_DO_PASSO: Record<PassoDaConversaParada, string> = {
  lembrete1: "lembrete das 2 horas",
  lembrete2: "lembrete da manhã seguinte",
  lembrete3: "último lembrete",
  fechar: "conversa fechada sem resposta",
};
