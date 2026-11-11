import { contactoJaNaoServe } from "./contacto-so-enquanto-ha-trabalho";
import type { FaseDoTrabalho } from "./trabalho";

/**
 * O MAPA DO PERCURSO DE UMA MUDANÇA — 11-11-2026 (ordem do CEO com o sim do dono).
 *
 * «Levar ao profissional um mapa do ponto de partida e de chegada.» (dono, 10-11)
 *
 * Uma imagem estática servida pelo site (`/api/mapa?percurso=<negociação>`):
 * a chave da Google não sai do servidor e não há nada nativo na app. O traçado
 * vem do Routes e fica guardado no pedido (`simulatorOrders.percursoJson`)
 * para não se pagar duas vezes.
 *
 * A REGRA DA MORADA: antes de o parceiro estar contratado (negociação
 * «acordada»), só a localidade — o mapa marca as duas cidades, sem traçado
 * (o traçado começa e acaba à porta), e o «Abrir no Google Maps» vai de cidade
 * a cidade. Depois, a morada exacta: o traçado, os dois pontos e as direcções
 * de porta a porta. É a mesma regra da vista do pedido (`vistaParaOEstado`).
 *
 * E SÓ ENQUANTO HÁ TRABALHO (11-11-2026): confirmado, pago, arquivado ou com a
 * negociação morta, volta a ser só a localidade — a regra do contacto do
 * cliente (`contacto-so-enquanto-ha-trabalho.ts`, d3 de 28-10-2026), que o
 * mapa e o «Abrir no Google Maps» passam a seguir.
 *
 * PURA (sem base, sem rede, sem process.env): a rota, o painel, a app Pro e os
 * testes usam as mesmas funções.
 */

export type PercursoGuardado = {
  versao: 1;
  km: number;
  minutos: number | null;
  /** O traçado codificado do Routes (encodedPolyline). */
  polyline: string | null;
  em: string;
};

export type PontaDoMapa = { lat: number | null; lng: number | null; morada: string | null; cidade: string | null };

/** O que decide a morada exacta: o estado da negociação, a fase do trabalho e o arquivo dele. */
export type TrabalhoDoPercurso = { estado: string | null | undefined; fase: FaseDoTrabalho; arquivadoEm?: unknown };

/**
 * A morada exacta só com o parceiro contratado E enquanto há trabalho por
 * fazer ou por confirmar — a mesma função que tira o contacto do cliente.
 */
export function podeVerAMoradaExacta(t: TrabalhoDoPercurso): boolean {
  if (t.estado !== "acordada") return false;
  return !contactoJaNaoServe({ estado: t.estado, fase: t.fase, arquivadoEm: t.arquivadoEm });
}

export function percursoDeJson(texto: string | null | undefined): PercursoGuardado | null {
  if (!texto) return null;
  try {
    const p = JSON.parse(texto) as PercursoGuardado;
    if (!p || p.versao !== 1 || typeof p.km !== "number" || !Number.isFinite(p.km)) return null;
    return { ...p, minutos: typeof p.minutos === "number" && p.minutos > 0 ? p.minutos : null, polyline: typeof p.polyline === "string" && p.polyline ? p.polyline : null };
  } catch {
    return null;
  }
}

function lerPonta(v: unknown): PontaDoMapa {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const n = (x: unknown) => {
    const k = typeof x === "number" ? x : typeof x === "string" && x.trim() ? Number(x) : NaN;
    return Number.isFinite(k) ? k : null;
  };
  const t = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim().slice(0, 200) : null);
  return { lat: n(o.lat), lng: n(o.lng), morada: t(o.formattedAddress), cidade: t(o.city) };
}

/** As duas pontas da mudança, do JSON do pedido (o simulador grava `originAddress` e `destinationAddress`). */
export function pontasDoPedido(rawOrderJson: string | null | undefined): { origem: PontaDoMapa; destino: PontaDoMapa } | null {
  if (!rawOrderJson) return null;
  try {
    const o = JSON.parse(rawOrderJson) as Record<string, unknown>;
    if (!o || typeof o !== "object" || !o.originAddress || !o.destinationAddress) return null;
    return { origem: lerPonta(o.originAddress), destino: lerPonta(o.destinationAddress) };
  } catch {
    return null;
  }
}

/** «62 km · cerca de 55 min», «62 km · cerca de 1 h 10 min», «62 km». */
export function textoDoPercurso(km: number, minutos: number | null): string {
  const k = Number.isInteger(km) ? String(km) : String(Math.round(km * 10) / 10).replace(".", ",");
  if (minutos == null || !(minutos > 0)) return `${k} km`;
  const m = Math.round(minutos);
  const h = Math.floor(m / 60);
  const r = m % 60;
  const tempo = h === 0 ? `${r} min` : r === 0 ? `${h} h` : `${h} h ${r} min`;
  return `${k} km · cerca de ${tempo}`;
}

const cidadeParaOMapa = (c: string) => `${c}, Portugal`;
const coordenadas = (p: PontaDoMapa) => (p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : null);

/**
 * Os parâmetros do Static Maps (sem a chave): com a morada exacta, os dois
 * pontos e o traçado; sem ela, só as duas cidades. Null quando não há o que
 * desenhar.
 */
export function parametrosDoMapa(d: {
  exacto: boolean;
  origem: PontaDoMapa;
  destino: PontaDoMapa;
  polyline: string | null;
}): string[] | null {
  const a = d.exacto ? coordenadas(d.origem) ?? d.origem.morada : d.origem.cidade ? cidadeParaOMapa(d.origem.cidade) : null;
  const b = d.exacto ? coordenadas(d.destino) ?? d.destino.morada : d.destino.cidade ? cidadeParaOMapa(d.destino.cidade) : null;
  if (!a || !b) return null;
  const p = [
    `markers=${encodeURIComponent(`color:0x0F172A|label:A|${a}`)}`,
    `markers=${encodeURIComponent(`color:0x00B4CC|label:B|${b}`)}`,
  ];
  // O traçado só com a morada exacta — ele começa e acaba à porta.
  if (d.exacto && d.polyline && d.polyline.length <= 8000) {
    p.push(`path=${encodeURIComponent(`color:0x0F172Acc|weight:4|enc:${d.polyline}`)}`);
  }
  return p;
}

/** O «Abrir no Google Maps» — direcções de carro, de cidade a cidade ou de porta a porta. */
export function ligacaoDeDireccoes(d: { exacto: boolean; origem: PontaDoMapa; destino: PontaDoMapa }): string | null {
  const a = d.exacto ? d.origem.morada ?? coordenadas(d.origem) : d.origem.cidade ? cidadeParaOMapa(d.origem.cidade) : null;
  const b = d.exacto ? d.destino.morada ?? coordenadas(d.destino) : d.destino.cidade ? cidadeParaOMapa(d.destino.cidade) : null;
  if (!a || !b) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a)}&destination=${encodeURIComponent(b)}&travelmode=driving`;
}

/** O caminho da imagem. `e=1` só muda a cache quando a morada passa a exacta — quem decide é a rota. */
export function caminhoDoMapaDoPercurso(negociacaoId: number, exacto: boolean): string {
  return `/api/mapa?percurso=${negociacaoId}&w=640&h=240${exacto ? "&e=1" : ""}`;
}

export type PercursoParaOParceiro = {
  texto: string;
  mapa: string;
  direccoes: string | null;
  exacto: boolean;
  /** «Origem → destino», só as localidades. */
  deOndeParaOnde: string | null;
};

/**
 * O bloco do percurso no pedido dirigido ao parceiro. As moradas exactas só
 * entram aqui com a negociação «acordada» e o trabalho por acabar (e só as
 * manda quem já as pode ver: a vista do pedido).
 */
export function percursoParaOParceiro(d: {
  negociacaoId: number;
  estado: string;
  /** A fase do trabalho e o arquivo do parceiro: acabado, só as localidades. */
  fase: FaseDoTrabalho;
  arquivadoEm?: unknown;
  percurso: PercursoGuardado | null;
  kmDoPercurso: number | null;
  cidadeOrigem: string | null;
  cidadeDestino: string | null;
  moradaOrigem?: string | null;
  moradaDestino?: string | null;
}): PercursoParaOParceiro | null {
  const km = d.percurso?.km ?? d.kmDoPercurso;
  if (km == null || !Number.isFinite(km)) return null;
  const exacto = podeVerAMoradaExacta(d);
  const origem: PontaDoMapa = { lat: null, lng: null, morada: exacto ? d.moradaOrigem ?? null : null, cidade: d.cidadeOrigem };
  const destino: PontaDoMapa = { lat: null, lng: null, morada: exacto ? d.moradaDestino ?? null : null, cidade: d.cidadeDestino };
  const comMoradas = exacto && origem.morada != null && destino.morada != null;
  return {
    texto: textoDoPercurso(km, d.percurso?.minutos ?? null),
    mapa: caminhoDoMapaDoPercurso(d.negociacaoId, exacto),
    direccoes: ligacaoDeDireccoes({ exacto: comMoradas, origem, destino }),
    exacto,
    deOndeParaOnde: d.cidadeOrigem && d.cidadeDestino ? `${d.cidadeOrigem} → ${d.cidadeDestino}` : null,
  };
}
