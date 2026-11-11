import { createHmac, timingSafeEqual } from "node:crypto";
import { candidatosDaListaDasMudancas, type CandidatoDaMudancaNaBase } from "./db";
import { distanciaRodoviaria, distanciasRodoviarias } from "./distancia-rodoviaria";
import { distanciaParaElegibilidade, pontoValido, type Ponto } from "./distancia-entre-pontos";
import { geocodificarMorada } from "./geocodificar";
import { profissionaisBloqueadosEmDinheiro } from "./bloqueio-do-profissional";
import { lerForma, type FormaDePagamento } from "./forma-de-pagamento";
import type { TarifaDasMudancas } from "./conta-da-mudanca";
import type { Tipologia } from "./tabela-das-mudancas";
import {
  MAXIMO_DE_ESCOLHIDOS,
  ORDENACAO,
  TEXTOS_DA_LISTA,
  cartaoDoParceiro,
  horasDaMudanca,
  lerPessoas,
  lerTipologia,
  ordenarCartoes,
  porqueFicaDeFora,
  recomendaTresPessoas,
  resumoDaMudanca,
  type CartaoDoParceiro,
  type ContextoDaMudanca,
  type Pessoas,
} from "./lista-de-parceiros-da-mudanca";

/**
 * A LISTA DOS PARCEIROS DE UMA MUDANÇA, NO SERVIDOR — 10-11-2026 (fase 2).
 *
 * A mesma função serve a rota pública `POST /api/mudancas/parceiros` (o ecrã
 * do simulador e, a seguir, a app de cliente) e a rota do pedido, que volta a
 * fazer a lista no momento de gravar para conferir a escolha: o cliente não
 * pode forçar um id — só passa o que ESTA conta devolve agora.
 *
 * O que fica de fora do cartão, de propósito: o número do parceiro na base, o
 * telefone, o email, a morada e qualquer ligação ao Google.
 */

/* ── O ID OPACO ───────────────────────────────────────────────────────────── */

function segredo(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET em falta: sem ele não há id opaco para os parceiros da lista.");
  return s;
}

/** HMAC do número com o segredo do servidor: não se adivinha nem se conta. */
export function idOpacoDoParceiro(providerId: number, chave: string = segredo()): string {
  return createHmac("sha256", chave).update(`parceiro-da-mudanca:${providerId}`).digest("base64url").slice(0, 22);
}

export function mesmoId(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ── O PEDIDO DA LISTA ────────────────────────────────────────────────────── */

export type PontaDaMudanca = { lat: number | null; lng: number | null; morada: string | null; cidade: string | null };

export type PedidoDaLista = {
  origem: PontaDaMudanca;
  destino: PontaDaMudanca;
  tipologia: Tipologia | null;
  desmontagem: boolean;
  pessoas: Pessoas;
  /** AAAA-MM-DD, opcional. Ainda não decide nada (a agenda dos parceiros vem depois). */
  data: string | null;
  formaDePagamento: FormaDePagamento;
};

const texto = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function lerPonta(v: unknown): PontaDaMudanca | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lat = numero(o.lat);
  const lng = numero(o.lng);
  const morada = texto(o.morada) ?? texto(o.formattedAddress);
  const cidade = texto(o.cidade, 80) ?? texto(o.city, 80);
  const ponto = lat != null && lng != null && pontoValido({ lat, lng });
  if (!ponto && !morada) return null;
  return { lat: ponto ? lat : null, lng: ponto ? lng : null, morada, cidade };
}

/** Lê e valida o corpo da rota (e o mesmo pedaço do pedido). Erro em português para o cliente. */
export function lerPedidoDaLista(corpo: unknown): { ok: true; pedido: PedidoDaLista } | { ok: false; erro: string } {
  const c = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const origem = lerPonta(c.origem);
  if (!origem) return { ok: false, erro: "Falta a morada de origem." };
  const destino = lerPonta(c.destino);
  if (!destino) return { ok: false, erro: "Falta a morada de destino." };
  const pessoas = c.pessoas === undefined || c.pessoas === null ? 2 : lerPessoas(c.pessoas);
  if (!pessoas) return { ok: false, erro: "A equipa é de 2 ou de 3 pessoas." };
  const tipologia = c.tipologia == null || c.tipologia === "" ? null : lerTipologia(c.tipologia);
  if (c.tipologia != null && c.tipologia !== "" && !tipologia) return { ok: false, erro: "O tamanho da casa não se percebeu." };
  const data = texto(c.data, 10);
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, erro: "A data vem como AAAA-MM-DD." };
  return {
    ok: true,
    pedido: {
      origem,
      destino,
      tipologia,
      desmontagem: c.desmontagem === true,
      pessoas,
      data,
      formaDePagamento: lerForma(c.formaDePagamento),
    },
  };
}

async function ponto(p: PontaDaMudanca): Promise<Ponto | null> {
  if (p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng };
  const g = await geocodificarMorada(p.morada, null, p.cidade).catch(() => null);
  return g ? { lat: g.lat, lng: g.lng } : null;
}

/* ── A LISTA ──────────────────────────────────────────────────────────────── */

export type EscolhivelDaLista = {
  id: string;
  providerId: number;
  nome: string;
  tarifa: TarifaDasMudancas;
  /** Da base dele à origem — o que a distribuição usa no aviso. */
  distanciaKm: number | null;
};

export type ResultadoDaLista =
  | {
      ok: true;
      cartoes: CartaoDoParceiro[];
      /** Só no servidor: o id opaco → o parceiro. Nunca sai na resposta. */
      escolhiveis: EscolhivelDaLista[];
      kmPercurso: number;
      kmEstimado: boolean;
      horas: number;
      origemPonto: Ponto;
      /** O destino, para o percurso com o traçado (mapa do parceiro, 11-11-2026). */
      destinoPonto: Ponto;
    }
  | { ok: false; erro: string };

export async function listaDosParceirosDaMudanca(
  pedido: PedidoDaLista,
  agora: Date = new Date(),
  candidatos?: CandidatoDaMudancaNaBase[],
): Promise<ResultadoDaLista> {
  const [o, d] = await Promise.all([ponto(pedido.origem), ponto(pedido.destino)]);
  if (!o) return { ok: false, erro: "Não conseguimos localizar a morada de origem." };
  if (!d) return { ok: false, erro: "Não conseguimos localizar a morada de destino." };

  const percurso = await distanciaRodoviaria(o, d);
  if (!percurso) return { ok: false, erro: "Não foi possível calcular o percurso entre as duas moradas." };

  const todos = candidatos ?? (await candidatosDaListaDasMudancas());
  const comDivida = pedido.formaDePagamento === "dinheiro" ? await profissionaisBloqueadosEmDinheiro(agora) : new Set<number>();

  const medidas = await distanciasRodoviarias(
    todos.map((c) => ({
      origem: c.baseLat != null && c.baseLng != null ? { lat: c.baseLat, lng: c.baseLng } : null,
      destino: o,
    })),
  );

  const ctx: ContextoDaMudanca = {
    tipologia: pedido.tipologia,
    desmontagem: pedido.desmontagem,
    pessoas: pedido.pessoas,
    kmPercurso: percurso.km,
    formaDePagamento: pedido.formaDePagamento,
    cidade: pedido.origem.cidade,
  };

  const cartoes: CartaoDoParceiro[] = [];
  const escolhiveis: EscolhivelDaLista[] = [];
  const chave = segredo();
  todos.forEach((c, i) => {
    const distanciaKm =
      medidas[i]?.km ??
      distanciaParaElegibilidade(c.baseLat != null && c.baseLng != null ? { lat: c.baseLat, lng: c.baseLng } : null, o);
    const candidato = { ...c, dividaEmAtraso: comDivida.has(c.id) };
    if (porqueFicaDeFora(candidato, distanciaKm, ctx) !== null || !c.tarifa) return;
    const id = idOpacoDoParceiro(c.id, chave);
    const cartao = cartaoDoParceiro({ ...candidato, tarifa: c.tarifa }, ctx, id, agora);
    if (!cartao) return;
    cartoes.push(cartao);
    escolhiveis.push({ id, providerId: c.id, nome: c.nome, tarifa: c.tarifa, distanciaKm });
  });

  return {
    ok: true,
    cartoes: ordenarCartoes(cartoes),
    escolhiveis,
    kmPercurso: percurso.km,
    kmEstimado: percurso.origem !== "estrada",
    horas: horasDaMudanca(pedido.tipologia, pedido.desmontagem, pedido.pessoas),
    origemPonto: o,
    destinoPonto: d,
  };
}

/** A resposta pública da lista — o contrato que o simulador e a app de cliente lêem. */
export function respostaDaLista(pedido: PedidoDaLista, r: Extract<ResultadoDaLista, { ok: true }>) {
  return {
    ok: true as const,
    ligado: true as const,
    pessoas: pedido.pessoas,
    tipologia: pedido.tipologia,
    horas: r.horas,
    kmPercurso: r.kmPercurso,
    kmEstimado: r.kmEstimado,
    resumo: resumoDaMudanca(pedido.tipologia, pedido.origem.cidade, pedido.destino.cidade, r.horas, pedido.pessoas),
    recomendaTres: recomendaTresPessoas(pedido.tipologia) ? TEXTOS_DA_LISTA.recomendaTres : null,
    maximoDeEscolhidos: MAXIMO_DE_ESCOLHIDOS,
    parceiros: r.cartoes,
    semParceiros: r.cartoes.length === 0 ? TEXTOS_DA_LISTA.semParceiros : null,
    ordenacao: ORDENACAO,
    textos: TEXTOS_DA_LISTA,
  };
}

/**
 * A ESCOLHA DO CLIENTE, CONFERIDA. Cada id tem de estar na lista feita AGORA
 * (elegível e com tarifa activa); um que não esteja recusa a escolha inteira.
 */
export function conferirEscolha(
  ids: unknown,
  escolhiveis: EscolhivelDaLista[],
): { ok: true; escolhidos: EscolhivelDaLista[] } | { ok: false; erro: string } {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, erro: "Escolha pelo menos um parceiro." };
  const unicos = [...new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))];
  if (unicos.length !== ids.length) return { ok: false, erro: "A escolha dos parceiros não se percebeu." };
  if (unicos.length > MAXIMO_DE_ESCOLHIDOS) return { ok: false, erro: `No máximo ${MAXIMO_DE_ESCOLHIDOS} parceiros.` };
  const escolhidos: EscolhivelDaLista[] = [];
  for (const id of unicos) {
    const e = escolhiveis.find((x) => mesmoId(x.id, id));
    if (!e) {
      return {
        ok: false,
        erro: "Um dos parceiros que escolheu já não está disponível para esta mudança. Volte a ver a lista e escolha outra vez.",
      };
    }
    escolhidos.push(e);
  }
  return { ok: true, escolhidos };
}
