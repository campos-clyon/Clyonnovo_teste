/**
 * AS PROPOSTAS COMO O AGENTE AS LÊ — d92, fases 4 e 5 (23-11-2026). PURO.
 *
 * O caso que a motivou (#663, inventado aqui com os mesmos números): duas
 * propostas, «85,00 € + IVA = 86,96 €» de um parceiro ISENTO de IVA e
 * «108,00 € + IVA = 132,84 €» de um com IVA. A cliente perguntou se o IVA do
 * primeiro estava certo; o agente não sabia o regime e passou à equipa.
 *
 * Aqui, para cada proposta que o cliente vê e pode escolher, sai:
 *   · o regime do parceiro (com IVA, isento, a confirmar) e a frase da fatura;
 *   · a conta do MESMO cálculo que monta a mensagem das propostas
 *     (`totalDaVitoria` / `precoDaVitoria`, d17): o trabalho do parceiro, a
 *     taxa da plataforma, o IVA de cada um, o sem IVA e o total;
 *   · a explicação do regime numa frase simples, com esses números;
 *   · quando mudou pela última vez (para não fechar uma que acabou de mudar).
 *
 * E as regras do fecho pelo agente: identificar a escolhida em linguagem livre
 * («fico com o da Recolhas Tejo», «a de 85», «a primeira»), os limites que passam à
 * equipa (acima de 500 € com IVA, Trabalho CLYON / valor único, mudança à
 * hora, já fechado), o texto da proposta de fecho («Responda SIM») e o da
 * pergunta ao parceiro. O valor que o parceiro escreveu nunca vai ao modelo
 * (só a conta como o cliente a paga); fica no pendente, para falar com ele.
 */

import { oClienteVeEsta, type Proposta } from "../negociacao";
import { precoDaVitoria, tipoDeFaturaDaLinha, totalDaVitoria, type LinhaDaVitoria } from "../o-total-da-vitoria";
import { FRASES_DA_FATURA, type TipoDeFatura } from "../perfil-fiscal";
import { semEComIva } from "../preco-do-cliente";
import { modeloDaNegociacao } from "../iva-incluido";
import { taxasDaNegociacao } from "../taxas-plataforma";
import { lerBase, type BaseDoPreco } from "../base-do-preco";

/** Acima disto (com IVA), o agente não propõe o fecho: passa à equipa (decidido a 22-11). */
export const LIMITE_DO_FECHO_PELO_AGENTE = 500;
/** Uma proposta que mudou há menos disto não se fecha: o cliente pode ter visto outro valor. */
export const MINUTOS_DE_ESTABILIDADE = 10;
/** O SIM ao fecho proposto pelo agente vale este tempo; depois, pergunta-se outra vez. */
export const MINUTOS_PARA_O_SIM = 30;
/** O CANCELAR à pergunta do agente vale o mesmo que o da pergunta de sempre (48 h). */
export const HORAS_PARA_O_CANCELAR = 48;

/** A linha da negociação como vem de `negociacoesDoPedido` (o que isto lê). */
export type NegociacaoParaOAgente = LinhaDaVitoria & {
  id: number | string;
  estado: string;
  profissionalNome: string;
  propostasJson: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  ofertaClyon?: string | null;
};

export type RegimeDaProposta = TipoDeFatura | "modelo_antigo";

export type ContaDaProposta = {
  /** O trabalho do parceiro (a fatura dele), sem IVA. */
  trabalhoSemIva: number;
  /** O IVA do trabalho (0 num parceiro isento). */
  ivaDoTrabalho: number;
  /** A taxa da plataforma, sem IVA. */
  taxaDaPlataformaSemIva: number;
  /** O IVA da taxa da plataforma. */
  ivaDaTaxa: number;
  /** Tudo sem IVA (o número antes do «+ IVA»). */
  semIva: number;
  /** O IVA todo. */
  iva: number;
  /** O que o cliente paga, com IVA. */
  total: number;
};

export type PropostaDoAgente = {
  /** A ordem em que o cliente as vê (1, 2, …). */
  n: number;
  negociacaoId: number;
  pedidoId: number;
  parceiro: string;
  estado: "proposta_do_parceiro" | "aceite_pelo_parceiro";
  regime: RegimeDaProposta;
  fatura: string;
  conta: ContaDaProposta;
  /** «85,00 € + IVA = 86,96 €» — como a mensagem das propostas o diz. */
  comoOClienteVe: string;
  explicacaoDoIva: string;
  base: BaseDoPreco;
  mudouEm: string | null;
  trabalhoClyon: boolean;
};

/** O que fica só no código (nunca vai ao modelo): o valor que o parceiro escreveu. */
export type PropostaComOValorDoParceiro = PropostaDoAgente & { valorDoParceiro: number };

const c2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const emEuros = (v: number) => `${c2(v).toFixed(2).replace(".", ",")} €`;

function propostasDe(json: string | null | undefined): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

const quando = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const t = (v instanceof Date ? v : new Date(String(v))).getTime();
  return Number.isFinite(t) ? t : null;
};

/** A explicação do regime numa frase, com os números da conta. */
export function explicacaoDoIva(parceiro: string, regime: RegimeDaProposta, c: ContaDaProposta): string {
  const taxa = `a taxa da plataforma (${emEuros(c.taxaDaPlataformaSemIva)})`;
  switch (regime) {
    case "isento":
      return (
        `${parceiro} é isento de IVA (art. 53.º do Código do IVA): o trabalho dele, ${emEuros(c.trabalhoSemIva)}, não leva IVA. ` +
        `O único IVA, ${emEuros(c.ivaDaTaxa)}, é o de ${taxa}. Total ${emEuros(c.total)} com IVA (${emEuros(c.semIva)} sem IVA).`
      );
    case "com_iva":
      return (
        `${parceiro} passa fatura com IVA: o trabalho é ${emEuros(c.trabalhoSemIva)} mais ${emEuros(c.ivaDoTrabalho)} de IVA, ` +
        `e ${taxa} leva ${emEuros(c.ivaDaTaxa)} de IVA. Total ${emEuros(c.total)} com IVA (${emEuros(c.semIva)} sem IVA).`
      );
    case "a_confirmar":
      return (
        `O tipo de fatura de ${parceiro} ainda está por confirmar: o total foi feito como com IVA, ${emEuros(c.total)} com IVA (${emEuros(c.semIva)} sem IVA). ` +
        `Se se confirmar que é isento, o valor desce — nunca sobe.`
      );
    default:
      return `O valor de ${parceiro} é ${emEuros(c.total)} com IVA (${emEuros(c.semIva)} sem IVA), IVA incluído.`;
  }
}

/**
 * AS PROPOSTAS QUE O CLIENTE PODE ESCOLHER, com a conta e o regime. As mesmas
 * que um SIM fecha nas regras: uma proposta do parceiro pendente, ou a
 * aceitação dele à espera do cliente. `novas` = as do modelo de 15-11.
 */
export function propostasParaOAgente(
  pedidoId: number,
  linhas: readonly NegociacaoParaOAgente[],
  novas: ReadonlySet<number>,
  baseDoPedido?: unknown,
): PropostaComOValorDoParceiro[] {
  const base = lerBase(baseDoPedido);
  const out: PropostaComOValorDoParceiro[] = [];
  for (const l of linhas) {
    if (l.estado === "morta" || l.estado === "desistida" || l.estado === "acordada") continue;
    const lista = propostasDe(l.propostasJson);
    if (!oClienteVeEsta({ estado: String(l.estado), propostas: lista })) continue;
    const invertidas = [...lista].reverse();
    const pendenteDoPro = invertidas.find((p) => p.estado === "pendente" && p.por === "profissional");
    if (!pendenteDoPro && l.estado !== "aguarda_contratacao") continue;
    const valorCru =
      (l as { valorAcordado?: unknown }).valorAcordado != null
        ? Number((l as { valorAcordado?: unknown }).valorAcordado)
        : (pendenteDoPro?.valor ?? invertidas.find((p) => p.estado === "aceite")?.valor ?? invertidas[0]?.valor);
    const valor = Number(valorCru);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    const id = Number(l.id);
    const noNovo = novas.has(id);
    const modelo = modeloDaNegociacao(l.createdAt ?? null);
    const total = totalDaVitoria(l, valor, noNovo);
    const p = precoDaVitoria(valor, taxasDaNegociacao(l), modelo, total);
    const ivaDaTaxa = c2(p.ivaDaTaxa ?? 0);
    const conta: ContaDaProposta = {
      trabalhoSemIva: c2(p.servico),
      ivaDoTrabalho: c2(p.iva - ivaDaTaxa),
      taxaDaPlataformaSemIva: c2(p.taxa),
      ivaDaTaxa,
      semIva: c2(p.semIva),
      iva: c2(p.iva),
      total: c2(p.total),
    };
    const regime: RegimeDaProposta = noNovo ? tipoDeFaturaDaLinha(l) : "modelo_antigo";
    // Quando o VALOR mudou: a última proposta (o updatedAt da linha muda por outras razões).
    const mudou = Math.max(0, ...lista.map((x) => quando(x.criadaEm) ?? 0));
    out.push({
      n: out.length + 1,
      negociacaoId: id,
      pedidoId,
      parceiro: String(l.profissionalNome ?? "").trim() || "o parceiro",
      estado: l.estado === "aguarda_contratacao" ? "aceite_pelo_parceiro" : "proposta_do_parceiro",
      regime,
      fatura: regime === "modelo_antigo" ? "IVA incluído" : FRASES_DA_FATURA[regime],
      conta,
      comoOClienteVe: semEComIva({ semIva: conta.semIva, total: conta.total, ivaIncluido: p.ivaIncluido }),
      explicacaoDoIva: explicacaoDoIva(String(l.profissionalNome ?? "o parceiro"), regime, conta),
      base,
      mudouEm: mudou > 0 ? new Date(mudou).toISOString() : null,
      trabalhoClyon: Boolean(l.ofertaClyon),
      valorDoParceiro: valor,
    });
  }
  return out;
}

/** O que vai ao modelo: tudo menos o valor que o parceiro escreveu. */
export function semOValorDoParceiro(p: PropostaComOValorDoParceiro): PropostaDoAgente {
  const { valorDoParceiro: _fora, ...resto } = p;
  void _fora;
  return resto;
}

/* ── Identificar a escolhida em linguagem livre ──────────────────────────── */

const semAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const ORDINAIS: Array<[RegExp, number]> = [
  [/\b(primeir[ao]|1\.?\s*[aªo]|first|premi[eè]re?|primer[ao]?|1st)\b/, 1],
  [/\b(segund[ao]|2\.?\s*[aªo]|second|deuxi[eè]me|2nd)\b/, 2],
  [/\b(terceir[ao]|3\.?\s*[aªo]|third|troisi[eè]me|tercer[ao]?|3rd)\b/, 3],
  [/\b(quart[ao]|4\.?\s*[aªo]|fourth|4th)\b/, 4],
];

/** Os números em euros (ou soltos) que o cliente disse: «a de 85», «86,96». */
function numerosDitos(t: string): number[] {
  return [...t.matchAll(/(\d{1,5}(?:[.,]\d{1,2})?)/g)].map((m) => Number(m[1].replace(",", "."))).filter((n) => Number.isFinite(n) && n > 0);
}

export type Identificacao<P extends PropostaDoAgente = PropostaDoAgente> =
  | { ok: true; proposta: P; porque: string }
  | { ok: false; porque: string };

/**
 * QUAL É A ESCOLHIDA. Pelo nome (todo ou uma palavra do nome com 4+ letras),
 * pelo valor (o com IVA ou o sem IVA, ao cêntimo, ou a parte inteira),
 * pela ordem («a primeira»), ou «a mais barata/cara». Só uma: dois a bater,
 * ou nenhum, não se escolhe (diz-se porquê, para o agente perguntar).
 */
export function identificarProposta<P extends PropostaDoAgente>(dito: string, propostas: readonly P[]): Identificacao<P> {
  const t = semAcentos(String(dito ?? "")).trim();
  if (propostas.length === 0) return { ok: false, porque: "Não há propostas que o cliente possa escolher neste pedido." };
  if (!t) return { ok: false, porque: "Falta dizer qual proposta (o nome do parceiro, o valor ou a ordem)." };
  const uma = (lista: P[], porque: string): Identificacao<P> | null => {
    if (lista.length === 1) return { ok: true, proposta: lista[0], porque };
    if (lista.length > 1) return { ok: false, porque: `Bate em ${lista.length} propostas (${lista.map((p) => p.parceiro).join(", ")}): pergunta qual.` };
    return null;
  };
  // 1. O nome.
  const porNome = propostas.filter((p) => {
    const nome = semAcentos(p.parceiro);
    if (nome && t.includes(nome)) return true;
    return nome
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !["recolhas", "recolha", "servicos", "multiservice", "multiservicos", "lisboa", "transportes", "mudancas"].includes(w))
      .some((w) => new RegExp(`\\b${w}\\b`).test(t));
  });
  const n1 = uma(porNome, "pelo nome");
  if (n1) return n1;
  // 2. O valor.
  const nums = numerosDitos(t);
  if (nums.length > 0) {
    const porValor = propostas.filter((p) =>
      nums.some(
        (v) =>
          Math.abs(v - p.conta.total) < 0.011 ||
          Math.abs(v - p.conta.semIva) < 0.011 ||
          (Number.isInteger(v) && (Math.floor(p.conta.total) === v || Math.floor(p.conta.semIva) === v)),
      ),
    );
    const n2 = uma(porValor, "pelo valor");
    if (n2) return n2;
  }
  // 3. A ordem.
  for (const [re, n] of ORDINAIS) {
    if (re.test(t)) {
      const p = propostas.find((x) => x.n === n);
      if (p) return { ok: true, proposta: p, porque: "pela ordem" };
    }
  }
  // 4. A mais barata / a mais cara.
  const ordenadas = [...propostas].sort((a, b) => a.conta.total - b.conta.total);
  if (/\b(mais barat|menor|cheapest|moins cher|mas barat)/.test(t)) {
    if (ordenadas.length > 1 && ordenadas[0].conta.total === ordenadas[1].conta.total) return { ok: false, porque: "Há duas com o mesmo valor: pergunta qual." };
    return { ok: true, proposta: ordenadas[0], porque: "a mais barata" };
  }
  if (/\b(mais car|maior|most expensive|plus cher|mas car)/.test(t)) {
    return { ok: true, proposta: ordenadas[ordenadas.length - 1], porque: "a mais cara" };
  }
  if (propostas.length === 1 && /\b(essa|esta|ela|aceito|escolho|quero|fico|that one|this one|celle)\b/.test(t)) {
    return { ok: true, proposta: propostas[0], porque: "é a única" };
  }
  return { ok: false, porque: "Não percebi qual proposta: pergunta ao cliente pelo nome do parceiro ou pelo valor." };
}

/* ── Os limites do fecho pelo agente ─────────────────────────────────────── */

export type PedidoParaOFecho = {
  status?: string | null;
  baseDoPreco?: unknown;
  temValorUnicoPorDecidir?: boolean;
  temAcordada?: boolean;
  jaPago?: boolean;
  queixa?: boolean;
};

/**
 * O PORQUÊ DE NÃO PROPOR O FECHO (passa à equipa), ou null. Os limites de
 * 22-11: acima de 500 € com IVA, Trabalho CLYON / valor único, mudança à
 * hora, já fechado ou pago, pedido cancelado/concluído, uma queixa.
 */
export function motivoParaNaoFecharPeloAgente(p: PropostaDoAgente, pedido: PedidoParaOFecho, agora: Date): string | null {
  if (p.conta.total > LIMITE_DO_FECHO_PELO_AGENTE) return `acima de ${LIMITE_DO_FECHO_PELO_AGENTE} € com IVA (${emEuros(p.conta.total)}) — fecha uma pessoa`;
  if (p.trabalhoClyon) return "é um Trabalho CLYON (valor fixo) — fecha uma pessoa";
  if (pedido.temValorUnicoPorDecidir) return "o pedido tem um valor único por decidir — quem escolhe o parceiro é a equipa";
  if (lerBase(pedido.baseDoPreco) === "hora" || p.base === "hora") return "é uma mudança à hora — fecha uma pessoa";
  if (pedido.temAcordada) return "o pedido já está fechado com um parceiro";
  if (pedido.jaPago) return "já há dinheiro pago neste pedido";
  if (pedido.queixa) return "há uma queixa na conversa";
  const estado = String(pedido.status ?? "").toLowerCase();
  if (/cancel|conclu|complet|arquiv/.test(estado)) return `o pedido está ${estado}`;
  if (p.mudouEm) {
    const min = (agora.getTime() - new Date(p.mudouEm).getTime()) / 60_000;
    if (min >= 0 && min < MINUTOS_DE_ESTABILIDADE) return `a proposta mudou há ${Math.floor(min)} min — confirma primeiro o valor de agora com o cliente`;
  }
  return null;
}

/** A frase do regime para o fecho, curta. */
function regimeNoFecho(p: PropostaDoAgente): string {
  if (p.regime === "isento") return " (parceiro isento de IVA — só a taxa da plataforma leva IVA)";
  if (p.regime === "a_confirmar") return " (com IVA; se o parceiro se confirmar isento, o valor desce)";
  return " (IVA incluído)";
}

/**
 * A PERGUNTA DO FECHO, escrita pelo código e obrigatória na resposta:
 * «Reservo Recolhas Tejo por 86,96 € (parceiro isento de IVA —
 * só a taxa da plataforma leva IVA)? Responda SIM.» O agente pode pôr à volta
 * o que quiser (a condição, a data); esta frase vai tal e qual.
 */
export function perguntaDoFecho(p: PropostaDoAgente): string {
  return `Reservo ${p.parceiro} por ${emEuros(p.conta.total)}${regimeNoFecho(p)} no pedido #${p.pedidoId}? Responda SIM.`;
}

/**
 * A MENSAGEM AO PARCEIRO quando o cliente escolhe com uma condição. Ao
 * parceiro fala-se do valor dele (o que ele escreveu) e da condição, tal e
 * qual. Curta, para o telemóvel.
 */
export function mensagemAoParceiro(p: PropostaComOValorDoParceiro, condicao: string): string {
  const cond = condicao.replace(/\s+/g, " ").trim().slice(0, 200);
  return (
    `Olá! O cliente do pedido #${p.pedidoId} quer escolher a sua proposta (${emEuros(p.valorDoParceiro)}), com uma condição: «${cond}». ` +
    `Consegue? Responda SIM ou NÃO, por favor.`
  );
}

/** O que o pendente guarda do fecho (para o SIM se conferir pelo código). */
export type FechoProposto = {
  tipo: "fecho";
  pedidoId: number;
  negociacaoId: number;
  parceiro: string;
  total: number;
  propostoEm: string;
};

/**
 * O SIM AINDA VALE? Relê-se a proposta: a mesma negociação, ainda escolhível,
 * o mesmo total ao cêntimo, dentro do prazo. Devolve o porquê de não fechar, ou null.
 */
export function motivoParaNaoFecharNoSim(
  f: FechoProposto,
  agora: Date,
  propostasDeAgora: readonly PropostaDoAgente[],
): string | null {
  const min = (agora.getTime() - new Date(f.propostoEm).getTime()) / 60_000;
  if (!(min >= 0 && min <= MINUTOS_PARA_O_SIM)) return `o SIM chegou ${Math.round(min)} min depois — pergunta-se outra vez`;
  const p = propostasDeAgora.find((x) => x.negociacaoId === f.negociacaoId);
  if (!p) return `a proposta de ${f.parceiro} já não está disponível`;
  if (Math.abs(p.conta.total - f.total) >= 0.005) return `a proposta de ${f.parceiro} mudou (era ${emEuros(f.total)}, agora ${emEuros(p.conta.total)})`;
  return null;
}
