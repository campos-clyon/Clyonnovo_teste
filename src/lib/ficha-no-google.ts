/**
 * A FICHA DO PARCEIRO NO GOOGLE — 11-11-2026 (ordem «Textos e nota Google»).
 *
 * O parceiro procura a sua empresa no Google e propõe a ficha; um
 * administrador confere-a (nome, NIF, morada) e confirma. Só a ficha
 * CONFIRMADA conta: é dela que sai a nota do Google no cartão da lista das
 * mudanças, ao lado (e nunca misturada) da nota da CLYON.
 *
 * O QUE SE GUARDA, E O QUE NÃO (termos da Google Maps Platform): na base fica
 * só o place_id (o único conteúdo que se pode guardar sem prazo). A nota, o
 * número de avaliações, o nome e a morada da ficha pedem-se ao Google no
 * momento e ficam, no máximo, uns minutos na memória deste processo — nunca
 * na base, nunca na prova do pedido.
 *
 * Tudo pela Places API (New), com a chave do servidor
 * (`GOOGLE_MAPS_SERVER_API_KEY`) e o FieldMask mínimo:
 *   · a procura (Text Search): id, nome, morada e link do Maps;
 *   · a ficha para o backoffice e para o parceiro (Place Details): o mesmo;
 *   · a nota para a lista (Place Details): só `rating,userRatingCount`.
 */

/** Com menos avaliações do que isto, a nota do Google não aparece (a regra vive na lib do cartão). */
export { AVALIACOES_PARA_A_NOTA_DO_GOOGLE as AVALIACOES_MINIMAS_DO_GOOGLE } from "./lista-de-parceiros-da-mudanca";

/** A nota tem de chegar depressa: a lista não espera mais do que isto por ela. */
export const PRAZO_DA_NOTA_DO_GOOGLE_MS = 1500;

/** Quanto tempo uma resposta do Google fica na memória do servidor (nunca na base). */
export const MEMORIA_DO_GOOGLE_MS = 5 * 60_000;
/** Uma falha lembra-se menos tempo: não se insiste, mas também não se esquece a nota por muito. */
const MEMORIA_DA_FALHA_MS = 60_000;
const MAXIMO_NA_MEMORIA = 500;

/** Os FieldMasks — o que se pede é o que se paga. */
export const CAMPOS_DA_NOTA = "rating,userRatingCount";
export const CAMPOS_DA_FICHA = "id,displayName,formattedAddress,googleMapsUri";
export const CAMPOS_DA_PROCURA = "places.id,places.displayName,places.formattedAddress,places.googleMapsUri";

const BASE = "https://places.googleapis.com/v1";

/** Um place_id do Google: letras, números, «_» e «-». */
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

export function lerPlaceId(v: unknown): string | null {
  return typeof v === "string" && PLACE_ID.test(v.trim()) ? v.trim() : null;
}

export type FichaDoGoogle = { placeId: string; nome: string; morada: string | null; mapsUri: string | null };
export type NotaCrua = { rating: number; userRatingCount: number };

type Busca = typeof fetch;

/** Porque é que o Google disse que não — o motivo fica no registo e na resposta ao painel. */
export type MotivoDaFalha = "sem_chave" | "api_desligada" | "recusado" | "rede" | "prazo";

function chave(): string | null {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY || null;
}

/**
 * 403 do Google com «SERVICE_DISABLED» ou «API_KEY_SERVICE_BLOCKED» = a Places
 * API (New) não está ligada no projecto, ou não está nas restrições da chave.
 * Não é o Google em baixo: diz-se assim no registo para o diagnóstico ser rápido.
 */
async function motivoDoErro(res: Response): Promise<MotivoDaFalha> {
  if (res.status !== 403) return "recusado";
  const texto = await res.text().catch(() => "");
  if (/SERVICE_DISABLED|API_KEY_SERVICE_BLOCKED|has not been used|is disabled|blocked/i.test(texto)) {
    console.warn(
      "[ficha-no-google] a Places API (New) está desligada ou fora das restrições da chave do servidor (GOOGLE_MAPS_SERVER_API_KEY).",
    );
    return "api_desligada";
  }
  return "recusado";
}

function texto(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v && typeof v === "object" && typeof (v as { text?: unknown }).text === "string") {
    const t = ((v as { text: string }).text || "").trim();
    return t || null;
  }
  return null;
}

function fichaDe(p: unknown): FichaDoGoogle | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const placeId = lerPlaceId(o.id);
  const nome = texto(o.displayName);
  if (!placeId || !nome) return null;
  const uri = texto(o.googleMapsUri);
  return {
    placeId,
    nome: nome.slice(0, 200),
    morada: texto(o.formattedAddress)?.slice(0, 300) ?? null,
    mapsUri: uri && /^https:\/\/(maps\.google\.com|www\.google\.com\/maps|maps\.app\.goo\.gl)\//.test(uri) ? uri : null,
  };
}

/* ── A MEMÓRIA (só deste processo, só uns minutos) ───────────────────────── */

type Lembrado<T> = { ate: number; valor: T };

function memoria<T>() {
  const m = new Map<string, Lembrado<T>>();
  return {
    ler(k: string, agora: number): { valor: T } | null {
      const l = m.get(k);
      if (!l) return null;
      if (l.ate <= agora) {
        m.delete(k);
        return null;
      }
      return { valor: l.valor };
    },
    guardar(k: string, valor: T, agora: number, ms: number) {
      if (m.size >= MAXIMO_NA_MEMORIA) {
        const primeira = m.keys().next().value;
        if (primeira !== undefined) m.delete(primeira);
      }
      m.set(k, { ate: agora + ms, valor });
    },
    limpar() {
      m.clear();
    },
  };
}

const memoriaDasNotas = memoria<NotaCrua | null>();
const memoriaDasFichas = memoria<FichaDoGoogle | null>();

/** Para os testes. */
export function esquecerOGoogle() {
  memoriaDasNotas.limpar();
  memoriaDasFichas.limpar();
}

/* ── A PROCURA ────────────────────────────────────────────────────────────── */

export type ResultadoDaProcura = { ok: true; fichas: FichaDoGoogle[] } | { ok: false; motivo: MotivoDaFalha };

/** Procura estabelecimentos pelo nome (Text Search, Portugal, até 5). */
export async function procurarFichasNoGoogle(consulta: string, busca: Busca = fetch): Promise<ResultadoDaProcura> {
  const k = chave();
  if (!k) return { ok: false, motivo: "sem_chave" };
  try {
    const res = await busca(`${BASE}/places:searchText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": k, "X-Goog-FieldMask": CAMPOS_DA_PROCURA },
      body: JSON.stringify({ textQuery: consulta, languageCode: "pt-PT", regionCode: "PT", pageSize: 5 }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, motivo: await motivoDoErro(res) };
    const d = (await res.json()) as { places?: unknown[] };
    const fichas = (d.places ?? []).map(fichaDe).filter((f): f is FichaDoGoogle => f !== null).slice(0, 5);
    return { ok: true, fichas };
  } catch {
    return { ok: false, motivo: "rede" };
  }
}

/* ── A FICHA (nome, morada, link) ─────────────────────────────────────────── */

/** A ficha de um place_id, para o parceiro e o backoffice verem o que foi proposto. Null se falhar. */
export async function fichaNoGoogle(placeId: string, busca: Busca = fetch, agora: number = Date.now()): Promise<FichaDoGoogle | null> {
  const id = lerPlaceId(placeId);
  if (!id) return null;
  const lembrada = memoriaDasFichas.ler(id, agora);
  if (lembrada) return lembrada.valor;
  const k = chave();
  if (!k) return null;
  try {
    const res = await busca(`${BASE}/places/${encodeURIComponent(id)}?languageCode=pt-PT&regionCode=PT`, {
      headers: { "X-Goog-Api-Key": k, "X-Goog-FieldMask": CAMPOS_DA_FICHA },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      await motivoDoErro(res);
      memoriaDasFichas.guardar(id, null, agora, MEMORIA_DA_FALHA_MS);
      return null;
    }
    const f = fichaDe(await res.json());
    memoriaDasFichas.guardar(id, f, agora, f ? MEMORIA_DO_GOOGLE_MS : MEMORIA_DA_FALHA_MS);
    return f;
  } catch {
    return null;
  }
}

/* ── A NOTA (só rating e userRatingCount) ────────────────────────────────── */

function notaCrua(d: unknown): NotaCrua | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const rating = typeof o.rating === "number" ? o.rating : NaN;
  const quantas = typeof o.userRatingCount === "number" ? o.userRatingCount : NaN;
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;
  if (!Number.isInteger(quantas) || quantas < 0) return null;
  return { rating, userRatingCount: quantas };
}

/**
 * A nota de um place_id CONFIRMADO, com prazo curto. Null se não houver
 * chave, se o Google falhar ou se demorar mais do que o prazo — a lista segue
 * sem a nota do Google, nunca à espera dela.
 */
export async function notaNoGoogle(
  placeId: string,
  opcoes: { busca?: Busca; prazoMs?: number; agora?: number } = {},
): Promise<NotaCrua | null> {
  const id = lerPlaceId(placeId);
  if (!id) return null;
  const agora = opcoes.agora ?? Date.now();
  const lembrada = memoriaDasNotas.ler(id, agora);
  if (lembrada) return lembrada.valor;
  const k = chave();
  if (!k) return null;
  const busca = opcoes.busca ?? fetch;
  try {
    const res = await busca(`${BASE}/places/${encodeURIComponent(id)}`, {
      headers: { "X-Goog-Api-Key": k, "X-Goog-FieldMask": CAMPOS_DA_NOTA },
      cache: "no-store",
      signal: AbortSignal.timeout(opcoes.prazoMs ?? PRAZO_DA_NOTA_DO_GOOGLE_MS),
    });
    if (!res.ok) {
      await motivoDoErro(res);
      memoriaDasNotas.guardar(id, null, agora, MEMORIA_DA_FALHA_MS);
      return null;
    }
    const n = notaCrua(await res.json());
    memoriaDasNotas.guardar(id, n, agora, n ? MEMORIA_DO_GOOGLE_MS : MEMORIA_DA_FALHA_MS);
    return n;
  } catch {
    // Prazo passado ou rede: não se lembra (a próxima lista tenta outra vez).
    return null;
  }
}

/** As notas de vários place_ids, em paralelo, cada uma com o seu prazo. */
export async function notasNoGoogle(
  placeIds: string[],
  opcoes: { busca?: Busca; prazoMs?: number; agora?: number } = {},
): Promise<Map<string, NotaCrua>> {
  const unicos = [...new Set(placeIds.map(lerPlaceId).filter((x): x is string => x !== null))];
  const respostas = await Promise.all(unicos.map((id) => notaNoGoogle(id, opcoes).catch(() => null)));
  const m = new Map<string, NotaCrua>();
  unicos.forEach((id, i) => {
    const n = respostas[i];
    if (n) m.set(id, n);
  });
  return m;
}
