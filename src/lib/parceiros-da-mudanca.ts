import { createHmac, timingSafeEqual } from "node:crypto";
import { candidatosDaListaDasMudancas, type CandidatoDaMudancaNaBase } from "./db";
import { distanciaRodoviaria, distanciasRodoviarias } from "./distancia-rodoviaria";
import { distanciaParaElegibilidade, pontoValido, type Ponto } from "./distancia-entre-pontos";
import { geocodificarMorada } from "./geocodificar";
import { profissionaisBloqueadosEmDinheiro } from "./bloqueio-do-profissional";
import { FORMA_POR_OMISSAO, lerForma, type FormaDePagamento } from "./forma-de-pagamento";
import { pontoDaZona } from "./zona-da-lista";
import { aindaSeAceitaSemMarca, lerMarca, LISTA_POR_VER, PRECO_MUDOU } from "./o-que-o-cliente-viu";
import { notasNoGoogle, PRAZO_DA_NOTA_DO_GOOGLE_MS } from "./ficha-no-google";
import type { TarifaDasMudancas } from "./conta-da-mudanca";
import { pessoasParaACasa, soComTresPessoas, type IntervaloDeHoras, type Tipologia } from "./tabela-das-mudancas";
import {
  MAXIMO_DE_ESCOLHIDOS,
  ORDENACAO,
  TEXTOS_DA_LISTA,
  cartaoDoParceiro,
  horasDaMudanca,
  lerPessoas,
  lerTipologia,
  notaDoGoogleNoCartao,
  ordenarCartoes,
  porqueFicaDeFora,
  avisoDaEquipa,
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
 * telefone, o email, a morada e qualquer ligação ao Google (o place_id e o link
 * da ficha). Da ficha confirmada só sai a nota e o número de avaliações, com a
 * atribuição — e só na rota da lista (`comNotaDoGoogle`): a conferência do
 * pedido não pergunta ao Google, e a prova do pedido nunca guarda a nota.
 *
 * DESDE 11-11-2026 A LISTA DIZ MENOS: é a mesma seja qual for a forma de
 * pagamento (o que depende dela só se confere no envio do pedido,
 * `comFiltroDoPagamento`), e quem aparece decide-se pela localidade da origem
 * (`zona-da-lista.ts`), não pela porta.
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

/* ── A ASSINATURA DO PREÇO ────────────────────────────────────────────────── */

/** Os números que se congelam no pedido — é sobre eles que se assina. */
function precoAssinado(t: TarifaDasMudancas): string {
  return JSON.stringify([
    t.precoHora2,
    t.precoHora3,
    t.minimoHoras,
    t.precoKm,
    t.kmMinimo,
    t.kmMaximo,
    t.caixa,
    t.cartaoMetro,
    t.filmeRolo,
    t.plasticoBolhaRolo,
  ]);
}

/**
 * A ASSINATURA DO PREÇO MOSTRADO (11-11-2026): HMAC, com o segredo do servidor,
 * da tarifa com que o cartão foi feito. Vai em cada cartão (`assinatura`) e o
 * pedido devolve-a; o cliente não a consegue fazer, e ela muda quando o
 * parceiro muda qualquer preço (hora de 2 e de 3, mínimo, km, material).
 */
export function assinaturaDoPreco(providerId: number, tarifa: TarifaDasMudancas, chave: string = segredo()): string {
  return createHmac("sha256", chave).update(`preco-da-mudanca:${providerId}:${precoAssinado(tarifa)}`).digest("base64url").slice(0, 22);
}

/**
 * AS ASSINATURAS QUE VIERAM NO PEDIDO (`assinaturasDoPreco`: { idDoCartao:
 * assinatura }) contra as dos escolhidos, feitas com a tarifa de AGORA. Uma
 * diferente — ou em falta, quando vieram outras — recusa a escolha inteira:
 * não se grava com um preço que o cliente não viu. Sem nenhuma (apps de antes
 * de 11-11-2026): passa até `SEM_MARCA_ATE`, e depois manda ver a lista.
 */
export function conferirAssinaturasDoPreco(
  vistas: unknown,
  escolhidos: Array<Pick<EscolhivelDaLista, "id" | "providerId" | "tarifa">>,
  agora: Date = new Date(),
  chave: string = segredo(),
): { ok: true; comAssinatura: boolean } | { ok: false; erro: string } {
  const mapa = vistas && typeof vistas === "object" && !Array.isArray(vistas) ? (vistas as Record<string, unknown>) : null;
  if (mapa == null || Object.keys(mapa).length === 0) {
    return aindaSeAceitaSemMarca(agora) ? { ok: true, comAssinatura: false } : { ok: false, erro: LISTA_POR_VER };
  }
  for (const e of escolhidos) {
    const vista = lerMarca(Object.prototype.hasOwnProperty.call(mapa, e.id) ? mapa[e.id] : null);
    if (vista == null || !mesmoId(vista, assinaturaDoPreco(e.providerId, e.tarifa, chave))) return { ok: false, erro: PRECO_MUDOU };
  }
  return { ok: true, comAssinatura: true };
}

/* ── O PEDIDO DA LISTA ────────────────────────────────────────────────────── */

export type PontaDaMudanca = { lat: number | null; lng: number | null; morada: string | null; cidade: string | null };

export type PedidoDaLista = {
  origem: PontaDaMudanca;
  destino: PontaDaMudanca;
  tipologia: Tipologia | null;
  desmontagem: boolean;
  /** A equipa da conta: a pedida, ou 3 numa casa que só se faz com 3 (T3 ou maior). */
  pessoas: Pessoas;
  /** A equipa que o cliente (ou a app) pediu. */
  pessoasPedidas: Pessoas;
  /** A casa só se faz com 3 pessoas (11-11-2026): com 2 pedidas, a conta é com 3. */
  soComTres: boolean;
  /** O cliente pediu também as caixas e o embalamento completo (11-11-2026). */
  embalamento: boolean;
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
      // Num T3 ou maior só há equipa de 3: pedir 2 (a app publicada pede 2 por omissão) conta como 3.
      pessoas: pessoasParaACasa(tipologia, pessoas),
      pessoasPedidas: pessoas,
      soComTres: soComTresPessoas(tipologia),
      embalamento: c.embalamento === true,
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
  /** Da base dele à localidade da origem (zona-da-lista.ts). */
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
      /** O intervalo de horas habitual da casa, com a equipa da conta (antes do mínimo de cada parceiro). */
      horas: IntervaloDeHoras;
      origemPonto: Ponto;
      /** O ponto da localidade da origem: é por ele que se decide quem aparece — e quem recebe. */
      zonaPonto: Ponto;
      /** O destino, para o percurso com o traçado (mapa do parceiro, 11-11-2026). */
      destinoPonto: Ponto;
    }
  | { ok: false; erro: string };

export type OpcoesDaLista = {
  /** Pedir ao Google a nota das fichas confirmadas (só a rota pública da lista). */
  comNotaDoGoogle?: boolean;
  /**
   * Só o ENVIO do pedido: confere também o que depende da forma de pagamento.
   * A lista pública nunca o liga — responde o mesmo com qualquer forma.
   */
  comFiltroDoPagamento?: boolean;
  /** Para os testes. */
  busca?: typeof fetch;
  prazoDoGoogleMs?: number;
};

export async function listaDosParceirosDaMudanca(
  pedido: PedidoDaLista,
  agora: Date = new Date(),
  candidatos?: CandidatoDaMudancaNaBase[],
  opcoes: OpcoesDaLista = {},
): Promise<ResultadoDaLista> {
  const [o, d] = await Promise.all([ponto(pedido.origem), ponto(pedido.destino)]);
  if (!o) return { ok: false, erro: "Não conseguimos localizar a morada de origem." };
  if (!d) return { ok: false, erro: "Não conseguimos localizar a morada de destino." };

  const percurso = await distanciaRodoviaria(o, d);
  if (!percurso) return { ok: false, erro: "Não foi possível calcular o percurso entre as duas moradas." };

  const todos = candidatos ?? (await candidatosDaListaDasMudancas());
  const forma: FormaDePagamento = opcoes.comFiltroDoPagamento ? pedido.formaDePagamento : FORMA_POR_OMISSAO;
  const comDivida = forma === "dinheiro" ? await profissionaisBloqueadosEmDinheiro(agora) : new Set<number>();

  // Quem aparece decide-se pela localidade da origem, não pela porta (zona-da-lista.ts).
  const zona = pontoDaZona(o);
  const medidas = await distanciasRodoviarias(
    todos.map((c) => ({
      origem: c.baseLat != null && c.baseLng != null ? { lat: c.baseLat, lng: c.baseLng } : null,
      destino: zona,
    })),
  );

  const ctx: ContextoDaMudanca = {
    tipologia: pedido.tipologia,
    desmontagem: pedido.desmontagem,
    pessoas: pedido.pessoas,
    kmPercurso: percurso.km,
    formaDePagamento: forma,
    cidade: pedido.origem.cidade,
  };

  const cartoes: CartaoDoParceiro[] = [];
  const escolhiveis: EscolhivelDaLista[] = [];
  /** id opaco → place_id CONFIRMADO. Fica no servidor. */
  const fichas = new Map<string, string>();
  const chave = segredo();
  todos.forEach((c, i) => {
    const distanciaKm =
      medidas[i]?.km ??
      distanciaParaElegibilidade(c.baseLat != null && c.baseLng != null ? { lat: c.baseLat, lng: c.baseLng } : null, zona);
    const candidato = { ...c, dividaEmAtraso: comDivida.has(c.id) };
    if (porqueFicaDeFora(candidato, distanciaKm, ctx) !== null || !c.tarifa) return;
    const id = idOpacoDoParceiro(c.id, chave);
    const cartao = cartaoDoParceiro({ ...candidato, tarifa: c.tarifa }, ctx, id, agora);
    if (!cartao) return;
    // A assinatura do preço deste cartão: o pedido devolve-a e confere-se no envio.
    cartao.assinatura = assinaturaDoPreco(c.id, c.tarifa, chave);
    cartoes.push(cartao);
    if (c.googlePlaceId) fichas.set(id, c.googlePlaceId);
    escolhiveis.push({ id, providerId: c.id, nome: c.nome, tarifa: c.tarifa, distanciaKm });
  });

  // A nota do Google: em paralelo, com prazo curto; falha ou < 5 avaliações = sem a linha.
  if (opcoes.comNotaDoGoogle && fichas.size > 0) {
    const notas = await notasNoGoogle([...fichas.values()], {
      busca: opcoes.busca,
      prazoMs: opcoes.prazoDoGoogleMs ?? PRAZO_DA_NOTA_DO_GOOGLE_MS,
      agora: agora.getTime(),
    }).catch(() => new Map());
    for (const cartao of cartoes) {
      const placeId = fichas.get(cartao.id);
      cartao.notaGoogle = placeId ? notaDoGoogleNoCartao(notas.get(placeId)) : null;
    }
  }

  return {
    ok: true,
    cartoes: ordenarCartoes(cartoes),
    escolhiveis,
    kmPercurso: percurso.km,
    kmEstimado: percurso.origem !== "estrada",
    horas: horasDaMudanca(pedido.tipologia, pedido.desmontagem, pedido.pessoas),
    origemPonto: o,
    zonaPonto: zona,
    destinoPonto: d,
  };
}

/** A resposta pública da lista — o contrato que o simulador e a app de cliente lêem. */
export function respostaDaLista(pedido: PedidoDaLista, r: Extract<ResultadoDaLista, { ok: true }>) {
  return {
    ok: true as const,
    ligado: true as const,
    pessoas: pedido.pessoas,
    pessoasPedidas: pedido.pessoasPedidas,
    soComTres: pedido.soComTres,
    embalamento: pedido.embalamento,
    tipologia: pedido.tipologia,
    /** O meio do intervalo; os extremos em horasMinimo e horasMaximo. */
    horas: (r.horas[0] + r.horas[1]) / 2,
    horasMinimo: r.horas[0],
    horasMaximo: r.horas[1],
    kmPercurso: r.kmPercurso,
    kmEstimado: r.kmEstimado,
    resumo: resumoDaMudanca(pedido.tipologia, pedido.origem.cidade, pedido.destino.cidade, r.horas, pedido.pessoas),
    recomendaTres: avisoDaEquipa(pedido.tipologia),
    maximoDeEscolhidos: MAXIMO_DE_ESCOLHIDOS,
    parceiros: r.cartoes,
    semParceiros: r.cartoes.length === 0 ? TEXTOS_DA_LISTA.semParceiros : null,
    ordenacao: ORDENACAO,
    textos: TEXTOS_DA_LISTA,
  };
}

/**
 * A frase de quando um escolhido não pode receber o pedido — UMA SÓ, seja qual
 * for a razão (saiu da lista, mudou a conta, ou outra): o cliente não fica a
 * saber de um parceiro mais do que o cartão mostra.
 */
export const ESCOLHA_INDISPONIVEL =
  "Um dos parceiros que escolheu não está disponível para este pedido neste momento. " +
  "Volte à lista e escolha outro, ou use «Deixar a CLYON escolher por mim».";

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
      return { ok: false, erro: ESCOLHA_INDISPONIVEL };
    }
    escolhidos.push(e);
  }
  return { ok: true, escolhidos };
}
