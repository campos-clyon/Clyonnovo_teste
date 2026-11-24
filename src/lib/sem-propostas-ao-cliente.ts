/**
 * O PEDIDO SEM PROPOSTAS — d102 (a) (CEO e dono, 24-11-2026).
 *
 * «Cada passo, desde quando o cliente entra até ao momento em que ele sai, a
 * Vitória tem de estar a acompanhar.» Um pedido que seguiu para os parceiros e
 * ficou sem resposta era o passo em que o cliente ficava sozinho: ninguém lhe
 * dizia nada, e ele lia o silêncio como «não querem o meu trabalho».
 *
 * Agora a Vitória escreve-lhe UMA vez por pedido, num de dois momentos:
 *
 *   · «sem_propostas» — 24 h depois de o pedido seguir para os parceiros (a
 *     1.ª negociação aberta), sem nenhuma proposta nem aceite;
 *   · «sem_parceiros» — logo que o envio aos parceiros fica «sem parceiros na
 *     zona» (`envio-automatico-aos-parceiros.ts`).
 *
 * Pelo WhatsApp quando há telemóvel português; senão, por email. Das 8h às 21h
 * de Lisboa; nunca no dia em que já saiu outra mensagem automática a esse
 * cliente (`uma-mensagem-automatica-por-dia.ts`, que também diz «sim» a quem
 * está em «não contactar»); nunca com a conversa entregue a uma pessoa da
 * equipa. E o pedido aparece no «Do nosso lado» da Mesa, com o motivo.
 *
 * Os textos são curtos e não prometem prazos que não dependem de nós.
 *
 * PURO. A base, a rotina e a lista do «Do nosso lado» estão em
 * `sem-propostas-ao-cliente-na-base.ts`.
 */

import { naJanelaDasMensagensAutomaticas } from "./janela-das-mensagens-automaticas";
import { pedidoFechado } from "./pedido-arrumado";
import { TELEFONE_DA_CLYON_NACIONAL } from "./telefone-da-clyon";

/** Horas sem proposta depois de o pedido seguir para os parceiros. */
export const HORAS_SEM_PROPOSTAS = 24;

export type MotivoSemPropostas = "sem_propostas" | "sem_parceiros";

export const MOTIVOS_SEM_PROPOSTAS: Readonly<Record<MotivoSemPropostas, string>> = Object.freeze({
  sem_propostas: `seguiu para os parceiros há mais de ${HORAS_SEM_PROPOSTAS} h e não chegou nenhuma proposta`,
  sem_parceiros: "sem parceiros na zona",
});

export type CanalSemPropostas = "whatsapp" | "email";

/* ── Os textos ───────────────────────────────────────────────────────────── */

/** O que a Vitória escreve — pelo WhatsApp («por aqui») ou por email. */
export function textoSemPropostas(motivo: MotivoSemPropostas, pedidoId: number, canal: CanalSemPropostas): string {
  if (motivo === "sem_parceiros") {
    return canal === "whatsapp"
      ? `Ainda não temos parceiros disponíveis na zona do seu pedido #${pedidoId}. A equipa da CLYON está a tratar disso e volta a falar consigo por aqui.`
      : `Ainda não temos parceiros disponíveis na zona do seu pedido #${pedidoId}. A equipa da CLYON está a tratar disso e volta a falar consigo.`;
  }
  return canal === "whatsapp"
    ? `O seu pedido #${pedidoId} já seguiu para os parceiros da sua zona, mas ainda não chegou nenhuma proposta. ` +
        "Continuamos à procura e, assim que chegar uma, envio-lha por aqui. " +
        "Se puder ajustar o dia ou quiser acrescentar alguma informação, diga-me: ajuda os parceiros a responder."
    : `O seu pedido #${pedidoId} já seguiu para os parceiros da sua zona, mas ainda não chegou nenhuma proposta. ` +
        "Continuamos à procura e, assim que chegar uma, envio-lha. " +
        `Se puder ajustar o dia ou quiser acrescentar alguma informação, fale connosco pelo WhatsApp, no ${TELEFONE_DA_CLYON_NACIONAL}: ajuda os parceiros a responder.`;
}

/** O assunto do email. */
export function assuntoSemPropostas(pedidoId: number): string {
  return `O seu pedido #${pedidoId} na CLYON`;
}

/* ── Quando um pedido entra ──────────────────────────────────────────────── */

type PropostaLida = { por?: unknown };

/** As negociações do pedido, como a regra as lê. */
export type NegociacaoSemPropostas = {
  estado: string;
  propostasJson: string | null;
  criadaEm: Date | null;
};

/** Já há resposta de algum parceiro? Uma proposta dele, ou um aceite (à espera do cliente, ou acordado). Pura. */
export function haRespostaDeParceiro(negociacoes: readonly NegociacaoSemPropostas[]): boolean {
  return negociacoes.some((n) => {
    if (n.estado === "aguarda_contratacao" || n.estado === "acordada") return true;
    let propostas: PropostaLida[] = [];
    try {
      const lido = JSON.parse(n.propostasJson ?? "[]");
      propostas = Array.isArray(lido) ? lido : [];
    } catch {
      propostas = [];
    }
    return propostas.some((p) => p?.por === "profissional");
  });
}

export type PedidoSemPropostas = {
  pedidoId: number;
  status: string | null;
  anonimizado: boolean;
  trabalhoClyon: boolean;
  deTeste: boolean;
  negociacoes: readonly NegociacaoSemPropostas[];
  /** O envio automático aos parceiros ficou «sem parceiros na zona», e quando. */
  semParceirosDesde: Date | null;
};

/**
 * O PEDIDO ESTÁ SEM PROPOSTAS? — o motivo e desde quando, ou null. Pura.
 * Um fechado, anonimizado, de teste ou Trabalho CLYON (a CLYON trata dele à
 * mão) não entra; nem um com resposta de algum parceiro.
 */
export function pedidoSemPropostas(p: PedidoSemPropostas, agora: Date): { motivo: MotivoSemPropostas; desde: Date } | null {
  if (p.anonimizado || p.deTeste || p.trabalhoClyon || pedidoFechado(p.status)) return null;
  if (haRespostaDeParceiro(p.negociacoes)) return null;
  const vivas = p.negociacoes.filter((n) => n.estado === "aberta");
  if (vivas.length === 0) {
    return p.semParceirosDesde ? { motivo: "sem_parceiros", desde: p.semParceirosDesde } : null;
  }
  const inicios = vivas.map((n) => n.criadaEm?.getTime() ?? Number.NaN).filter((t) => Number.isFinite(t));
  if (inicios.length === 0) return null;
  const seguiu = Math.min(...inicios);
  const desde = seguiu + HORAS_SEM_PROPOSTAS * 3600_000;
  return agora.getTime() >= desde ? { motivo: "sem_propostas", desde: new Date(desde) } : null;
}

/* ── O aviso ao cliente ──────────────────────────────────────────────────── */

export type ClienteSemPropostas = {
  /** O telemóvel português (351…), ou null. */
  telemovel: string | null;
  email: string | null;
  /** A conversa está com uma pessoa da equipa (entregue, ou a equipa escreveu há pouco). */
  comUmaPessoa: boolean;
  bloqueado: boolean;
  /** Já saiu hoje outra mensagem automática (ou está em «não contactar»). */
  jaSaiuHoje: boolean;
  /** O aviso deste pedido já saiu (ou está a sair). */
  jaAvisado: boolean;
};

export type DecisaoSemPropostas =
  | { tipo: "sai"; canal: CanalSemPropostas }
  | { tipo: "espera"; porque: string }
  | { tipo: "fica"; porque: string }
  | { tipo: "ja_saiu" };

/** Sai agora? Pura. «espera» volta a ver-se na passagem seguinte; «fica» é da equipa. */
export function decidirOAvisoSemPropostas(c: ClienteSemPropostas, agora: Date): DecisaoSemPropostas {
  if (c.jaAvisado) return { tipo: "ja_saiu" };
  const canal: CanalSemPropostas | null = c.telemovel ? "whatsapp" : c.email ? "email" : null;
  if (!canal) return { tipo: "fica", porque: "sem telemóvel português nem email" };
  if (canal === "whatsapp" && c.bloqueado) return { tipo: "fica", porque: "o número está bloqueado" };
  if (canal === "whatsapp" && c.comUmaPessoa) return { tipo: "fica", porque: "a conversa está com uma pessoa da equipa" };
  if (!naJanelaDasMensagensAutomaticas(agora)) return { tipo: "espera", porque: "fora das 8h–21h de Lisboa" };
  if (c.jaSaiuHoje) return { tipo: "espera", porque: "já saiu hoje outra mensagem automática a este cliente" };
  return { tipo: "sai", canal };
}

/** A linha do «Do nosso lado»: o motivo, e o que a Vitória já fez. */
export function linhaSemPropostas(motivo: MotivoSemPropostas, aviso: { estado: string | null; porque: string | null }): string {
  const base = MOTIVOS_SEM_PROPOSTAS[motivo];
  if (aviso.estado === "enviado") return `${base} · a Vitória já avisou o cliente`;
  if (aviso.estado === "falhou") return `${base} · o aviso ao cliente não saiu${aviso.porque ? ` (${aviso.porque})` : ""}`;
  if (aviso.estado === "fica") return `${base} · avisar o cliente à mão${aviso.porque ? ` (${aviso.porque})` : ""}`;
  return `${base} · a Vitória avisa o cliente (8h–21h)`;
}
