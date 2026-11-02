import { ErroDaApi, type Pedir } from "./erros";
import { O_VALOR_FICA_COM_A_CLYON } from "../../../src/lib/palavras-do-pagamento";
import type { Pagamento, PendenteDoPagamento } from "./pedidos";

/**
 * O ECRÃ DE PAGAR — as regras, puras (02-11-2026, ordem do CEO com o sim do
 * dono: «ecrãs simples, direto ao ponto»; e o #551, em que o MB WAY falhou e a
 * app ficou num ecrã morto).
 *
 * Três regras que não se partem:
 *  1. Qualquer falha ao pedir o pagamento (HTTP ≠ 2xx, `ok: false`, sem rede,
 *     tempo esgotado) diz a frase do servidor (`error`) ou `FALHOU_O_PEDIDO`,
 *     e deixa «Tentar de novo» e «Pagar por Multibanco».
 *  2. Um MB WAY por confirmar tem prazo (`expiraEm`, cinco minutos no
 *     servidor). Passado o prazo — ou se o servidor o deixar de dar como
 *     pendente sem estar pago — volta a «por pagar», com o bloco de pagar
 *     inteiro. «Por pagar» mostra SEMPRE o bloco, haja ou não uma tentativa
 *     antes (falhada, expirada, ou pendente há mais de cinco minutos).
 *  3. «Pago» só quando o servidor o diz (`pagamento.pago`, lido do pedido).
 */

export const FALHOU_O_PEDIDO = "Não foi possível pedir o pagamento. Tente de novo ou pague por Multibanco.";
export const MBWAY_NAO_CONFIRMADO = "O MB WAY não foi confirmado a tempo. Pode tentar de novo ou pagar por Multibanco.";
/** A frase do site, à letra (`frases-do-pagamento.ts`, que a reexporta de `palavras-do-pagamento.ts`). */
export const SO_DEPOIS_DE_FEITO = O_VALOR_FICA_COM_A_CLYON;
/** Sem `expiraEm` (um site antigo), o MB WAY conta-se como vivo durante este tempo desde que a app o viu. */
export const MINUTOS_DO_MBWAY = 5;

const MBWAY = "mbway";

/** Um MB WAY ainda dentro do prazo. Sem prazo conhecido, conta desde `vistoEm` (quando a app o viu pela primeira vez). */
export function mbwayVivo(p: Pick<PendenteDoPagamento, "metodo" | "expiraEm">, agora: number, vistoEm: number | null = null): boolean {
  if (p.metodo !== MBWAY) return false;
  const fim = p.expiraEm ? Date.parse(p.expiraEm) : NaN;
  if (Number.isFinite(fim)) return fim > agora;
  return vistoEm != null && agora - vistoEm < MINUTOS_DO_MBWAY * 60_000;
}

/** Uma referência Multibanco que ainda se pode pagar. */
export function multibancoVivo(p: Pick<PendenteDoPagamento, "metodo" | "expiraEm" | "referencia">, agora: number): boolean {
  if (p.metodo === MBWAY || !p.referencia) return false;
  const fim = p.expiraEm ? Date.parse(p.expiraEm) : NaN;
  return !Number.isFinite(fim) || fim > agora;
}

export type EstadoDoPagar =
  | { tipo: "pago"; quando: string | null }
  | { tipo: "no-local" }
  /** O servidor não abre pagamentos para este trabalho agora (`disponivel: false`). */
  | { tipo: "indisponivel" }
  | { tipo: "a-confirmar-mbway"; fimEm: number; valorTexto: string }
  /** Por pagar: o bloco inteiro. Com a referência que já exista, e se houve um MB WAY que não chegou ao fim. */
  | { tipo: "por-pagar"; multibanco: PendenteDoPagamento | null; mbwayNaoConfirmado: boolean };

/**
 * O que o ecrã mostra, a partir do pagamento que o pedido (R5) trouxe.
 * `esperavaMbway`: a app pediu um MB WAY nesta visita (se ele desaparecer sem
 * «pago», foi recusado ou expirou).
 */
export function estadoDoPagar(
  pg: Pagamento,
  agora: number,
  o: { esperavaMbway?: boolean; mbwayVistoEm?: number | null } = {},
): EstadoDoPagar {
  if (pg.pago) return { tipo: "pago", quando: pg.pagoEmTexto };
  if (pg.emDinheiroAoProfissional) return { tipo: "no-local" };
  const mbways = pg.pendentes.filter((p) => p.metodo === MBWAY);
  const vivo = mbways.find((p) => mbwayVivo(p, agora, o.mbwayVistoEm ?? null));
  if (vivo) {
    const fim = vivo.expiraEm ? Date.parse(vivo.expiraEm) : (o.mbwayVistoEm ?? agora) + MINUTOS_DO_MBWAY * 60_000;
    return { tipo: "a-confirmar-mbway", fimEm: fim, valorTexto: vivo.valorTexto };
  }
  const multibanco = pg.pendentes.find((p) => multibancoVivo(p, agora)) ?? null;
  // Sem porta aberta e sem nada a pagar: não se mostra um botão que o servidor recusa.
  if (!pg.disponivel && !multibanco) return { tipo: "indisponivel" };
  return { tipo: "por-pagar", multibanco, mbwayNaoConfirmado: mbways.length > 0 || !!o.esperavaMbway };
}

/** «4:07» — o que falta do prazo do MB WAY. */
export function contagem(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** O valor do botão: «452,03 €» de «452,03 € (367,50 € sem IVA)». */
export function valorDoBotao(texto: string): string {
  return texto.split(" (")[0].trim();
}

/**
 * Só a referência, sem o botão grande (02-11-2026, ordem do CEO com o sim do
 * dono): com uma referência Multibanco ainda válida, «Pagar Z €» parecia gerar
 * outra. Fica a referência, «Válida até …» e uma ligação «Pagar por MB WAY».
 * Expirada, `multibancoVivo` deixa-a de fora e volta o bloco inteiro.
 */
export function soAReferencia(e: EstadoDoPagar | null): boolean {
  return e?.tipo === "por-pagar" && !!e.multibanco;
}

/* ─── A linha debaixo do título ─────────────────────────────────────────── */

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const somaDosNumeros = (t: string) => (t.match(/\d+/g) ?? []).reduce((s, x) => s + Number(x), 0);

/**
 * O resumo curto da quantidade, lido das linhas que o simulador e a app
 * escrevem na descrição: «Itens: 2 grandes, 1 pequenos.» → «3 itens»,
 * «Sacos: 10.» → «10 sacos», «Quantidade estimada: Enche uma carrinha…» →
 * «1 carga», «Casa: T2.» → «T2». Sem nada disto, `null` (não se inventa).
 */
export function quantidadeCurta(descricao: string | null | undefined): string | null {
  const linhas = String(descricao ?? "")
    .split("\n")
    .map((l) => l.trim());
  const valor = (prefixo: RegExp) => {
    const l = linhas.find((x) => prefixo.test(x));
    return l ? l.replace(prefixo, "").replace(/\.$/, "").trim() : null;
  };
  const itens = valor(/^Itens:\s*/i);
  if (itens && somaDosNumeros(itens) > 0) return plural(somaDosNumeros(itens), "item", "itens");
  const exacta = valor(/^Quantidade exacta:\s*/i);
  if (exacta && somaDosNumeros(exacta) > 0) return plural(somaDosNumeros(exacta), "item", "itens");
  const sacos = valor(/^Sacos:\s*/i);
  if (sacos && somaDosNumeros(sacos) > 0) return plural(somaDosNumeros(sacos), "saco", "sacos");
  const volume = valor(/^(Quantidade estimada|Volume):\s*/i);
  if (volume) {
    const v = volume.toLowerCase();
    if (v.includes("caixa de um camião")) return "Caixa de camião";
    if (v.includes("camião")) return "1 camião";
    if (v.includes("carrinha")) return "1 carga";
  }
  const casa = valor(/^Casa:\s*/i);
  if (casa) return casa;
  return null;
}

/** «04/11/2026 · 1 carga» — o dia (com a hora, se houver) e a quantidade em curto. Sem prefixos nem a descrição inteira. */
export function linhaDoPagar(dia: string | null | undefined, descricao: string | null | undefined): string | null {
  const partes = [dia?.trim() || null, quantidadeCurta(descricao)].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : null;
}

export type ResultadoDoPedido ={ ok: true } | { ok: false; mensagem: string };

/**
 * PEDIR O PAGAMENTO (`POST /api/pagamentos`). Nunca lança: devolve a frase a
 * mostrar. Só conta como pedido um 2xx com `pagamento` e sem `ok: false`.
 */
export async function pedirOPagamento(pedir: Pedir, corpo: Record<string, unknown>): Promise<ResultadoDoPedido> {
  try {
    const r = await pedir<Record<string, unknown>>("/api/pagamentos", { metodo: "POST", corpo });
    if (r && r.ok !== false && r.pagamento && typeof r.pagamento === "object") return { ok: true };
    return { ok: false, mensagem: fraseDoServidor(r) ?? FALHOU_O_PEDIDO };
  } catch (e) {
    return { ok: false, mensagem: (e instanceof ErroDaApi ? fraseDoServidor(e.corpo) : null) ?? FALHOU_O_PEDIDO };
  }
}

function fraseDoServidor(corpo: unknown): string | null {
  const e = corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>).error : null;
  return typeof e === "string" && e.trim() ? e.trim() : null;
}
