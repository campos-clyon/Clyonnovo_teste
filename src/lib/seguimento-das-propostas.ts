import { instanteDaBase } from "./hora-de-lisboa";
import { pedidoFechado } from "./pedido-arrumado";
import { valorDoLembrete } from "./validade-do-orcamento";

/**
 * O SEGUIMENTO DAS PROPOSTAS — d6 (CEO e dono, 23-11-2026).
 *
 * Duas coisas, as duas na Mesa e as duas só a dizer à equipa:
 *
 *   1. O SELO «propostas há mais de 1 h e o cliente ainda não as viu»: o
 *      cliente vê as propostas no link e na conta assim que o parceiro as faz
 *      (`oClienteVeEsta`), e a abertura grava-se em `vistoPeloClienteEm` (S11).
 *      Se passou mais de 1 h e ele não abriu, a equipa vê-o no cartão.
 *
 *   2. O BOTÃO «Seguimento»: abre o WhatsApp com o texto escrito, como o
 *      «Pedir o que falta» — NUNCA envia sozinho; quem envia é a equipa. Dois
 *      textos, 24 h e 72 h depois das propostas.
 *
 * PURO: o relógio e os dados vêm de quem chama. Os textos seguem as regras da
 * casa (o teste da orquestra): parceiro, o valor sem e com IVA
 * juntos, sem emoji, e quem faz o trabalho é o parceiro escolhido.
 */

/** Passada esta espera sem o cliente abrir as propostas, a Mesa põe o selo. */
export const HORAS_PARA_O_SELO = 1;
/** Os dois seguimentos: tantas horas depois das propostas. */
export const HORAS_DO_SEGUIMENTO_1 = 24;
export const HORAS_DO_SEGUIMENTO_2 = 72;

export const TEXTO_DO_SELO = "propostas há mais de 1 h e o cliente ainda não as viu";

/** A parte de um pedido que estas contas lêem — o que a Mesa já carrega. */
export type PedidoParaOSeguimento = {
  status?: string | null;
  valorFixoClyon?: number | string | null;
  valorUnicoCliente?: number | string | null;
  negociacoes: ReadonlyArray<{
    estado: string;
    propostasJson?: string | null;
    vistoPeloClienteEm?: string | Date | null;
    confirmadoEm?: string | Date | null;
  }>;
};

type PropostaLida = { por?: unknown; estado?: unknown; criadaEm?: unknown };

function propostasDe(json: string | null | undefined): PropostaLida[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as PropostaLida[]) : [];
  } catch {
    return [];
  }
}

/**
 * As propostas por ver: as pendentes de um parceiro, ainda vivas, que o cliente
 * não abriu desde que chegaram. Devolve o instante de cada uma. Vazio quando o
 * cliente não as vê (valor único, Trabalho CLYON), já há parceiro contratado ou
 * o pedido está fechado.
 */
export function propostasPorVer(p: PedidoParaOSeguimento): number[] {
  if (pedidoFechado(p.status ?? null)) return [];
  if (p.valorFixoClyon != null || p.valorUnicoCliente != null) return [];
  if (p.negociacoes.some((n) => n.estado === "acordada" || n.confirmadoEm != null)) return [];
  const instantes: number[] = [];
  for (const n of p.negociacoes) {
    if (n.estado === "morta" || n.estado === "desistida" || n.estado === "acordada") continue;
    const visto = instanteDaBase(n.vistoPeloClienteEm ?? null)?.getTime() ?? null;
    for (const x of propostasDe(n.propostasJson)) {
      if (x.por !== "profissional" || x.estado !== "pendente") continue;
      const t = instanteDaBase(x.criadaEm as string | Date | null)?.getTime();
      if (t == null) continue;
      // Vista só conta se foi aberta depois de a proposta chegar.
      if (visto != null && visto >= t) continue;
      instantes.push(t);
    }
  }
  return instantes;
}

/** O selo da Mesa: há propostas por ver há mais de 1 h? */
export function temOSeloDasPropostas(p: PedidoParaOSeguimento, agora: Date): boolean {
  const por = propostasPorVer(p);
  if (por.length === 0) return false;
  return agora.getTime() - Math.min(...por) > HORAS_PARA_O_SELO * 3_600_000;
}

export type PassoDoSeguimentoDasPropostas = "24h" | "72h";

/**
 * Qual dos dois seguimentos serve agora: 24 h ou 72 h depois das propostas
 * (a 1.ª proposta do parceiro, ou o envio ao cliente — o que vier primeiro).
 * Antes das 24 h, nenhum.
 */
export function passoDoSeguimento(depoisDeEm: Date | null | undefined, agora: Date): PassoDoSeguimentoDasPropostas | null {
  if (!depoisDeEm || Number.isNaN(depoisDeEm.getTime())) return null;
  const horas = (agora.getTime() - depoisDeEm.getTime()) / 3_600_000;
  if (horas >= HORAS_DO_SEGUIMENTO_2) return "72h";
  if (horas >= HORAS_DO_SEGUIMENTO_1) return "24h";
  return null;
}

/** O instante da 1.ª proposta de um parceiro num pedido — ou null. */
export function primeiraPropostaEm(p: PedidoParaOSeguimento): Date | null {
  const todas: number[] = [];
  for (const n of p.negociacoes) {
    for (const x of propostasDe(n.propostasJson)) {
      if (x.por !== "profissional") continue;
      const t = instanteDaBase(x.criadaEm as string | Date | null)?.getTime();
      if (t != null) todas.push(t);
    }
  }
  return todas.length ? new Date(Math.min(...todas)) : null;
}

/* ── Os textos ───────────────────────────────────────────────────────────── */

/** O endereço da conta do cliente, onde vê o pedido e escolhe. */
export const A_CONTA_DO_CLIENTE = "clyon.pt/conta";

export type DadosDoSeguimento = {
  pedidoId: number;
  /** O nome do cliente (sai só o primeiro). */
  nome: string | null | undefined;
  /** O serviço em palavras, em minúsculas: «recolha de monos». */
  servico: string;
  /** Quantas propostas de parceiros tem. */
  propostas: number;
  /** A mais barata, sem IVA e com IVA. */
  semIva: number;
  total: number;
  /** Por carga ou por hora, ou nada (o trabalho todo). */
  unidade?: "carga" | "hora" | null;
};

function ola(nome: string | null | undefined): string {
  const p = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return p.length >= 2 ? `Olá, ${p.charAt(0).toUpperCase()}${p.slice(1)}!` : "Olá!";
}

function asPropostas(d: DadosDoSeguimento): string {
  const desde = valorDoLembrete(d.semIva, d.total, d.unidade);
  return d.propostas === 1
    ? `uma proposta de um parceiro, de ${desde}`
    : `${d.propostas} propostas de parceiros, desde ${desde}`;
}

/** 24 h depois das propostas. */
export function textoDoSeguimento24h(d: DadosDoSeguimento): string {
  return (
    `${ola(d.nome)} O seu pedido #${d.pedidoId} (${d.servico}) já tem ${asPropostas(d)}. ` +
    `Pode vê-las e escolher na sua conta, em ${A_CONTA_DO_CLIENTE}, ou dizer-nos aqui qual prefere (basta o nome). ` +
    `Quem faz o trabalho é o parceiro escolhido. Se tiver alguma dúvida, é só responder.`
  );
}

/** 72 h depois das propostas. */
export function textoDoSeguimento72h(d: DadosDoSeguimento): string {
  return (
    `${ola(d.nome)} Voltamos ao seu pedido #${d.pedidoId} (${d.servico}): ${d.propostas === 1 ? "a proposta continua" : "as propostas continuam"} ` +
    `à sua espera, ${d.propostas === 1 ? "de" : "desde"} ${valorDoLembrete(d.semIva, d.total, d.unidade)}. ` +
    `Escolha na sua conta, em ${A_CONTA_DO_CLIENTE}, ou responda aqui com o nome do parceiro que prefere. ` +
    `Se já não precisar, diga-nos e fechamos o pedido, sem problema.`
  );
}

export function textoDoSeguimentoDasPropostas(passo: PassoDoSeguimentoDasPropostas, d: DadosDoSeguimento): string {
  return passo === "72h" ? textoDoSeguimento72h(d) : textoDoSeguimento24h(d);
}

export const ROTULO_DO_SEGUIMENTO: Record<PassoDoSeguimentoDasPropostas, string> = {
  "24h": "Seguimento (24 h)",
  "72h": "Seguimento (72 h)",
};
