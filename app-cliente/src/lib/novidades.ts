/**
 * «O QUE HÁ DE NOVO» — d23, 13-11-2026.
 *
 * Cada atualização sem loja traz uma nota (src/lib/notas-das-apps.json no
 * site; GET /api/apps/notas). A app mostra-a em dois sítios:
 *   1. antes de reiniciar, no aviso e na faixa da versão nova — a nota da
 *      atualização que vai entrar (o `updateId` do manifest);
 *   2. depois de reiniciar, se ele não a viu antes, um cartão «O que há de
 *      novo» UMA vez — o último visto fica no telemóvel.
 * Sem rede, o aviso e a faixa aparecem sem nota, como antes; o cartão tenta
 * outra vez da próxima vez que a app abrir.
 *
 * Puro de propósito: os testes do site importam-no. A mesma regra da app Pro
 * (app-pro/src/lib/novidades.ts), com a chave desta app.
 */

export type NotaRecebida = { id: string; nota: string };
/** O que fica no telemóvel: a atualização e a nota já vistas. */
export type VistaGuardada = { u: string | null; n: string | null };

export const CHAVE_DA_NOVIDADE = "clyon-cliente-novidade-vista";
export const PRAZO_DA_NOTA_MS = 8000;
export const TITULO_DA_NOVIDADE = "O que há de novo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function caminhoDaNota(app: "pro" | "cliente", updateId: string | null | undefined): string {
  const q = new URLSearchParams({ app });
  if (updateId && UUID.test(updateId)) q.set("update", updateId);
  return `/api/apps/notas?${q.toString()}`;
}

/** A resposta da rota, com tolerância à forma: o que não vier certo não aparece. */
export function lerNota(json: unknown): NotaRecebida | null {
  if (!json || typeof json !== "object") return null;
  const { id, nota } = json as Record<string, unknown>;
  if (typeof id !== "string" || !id || typeof nota !== "string") return null;
  const t = nota.trim();
  if (!t) return null;
  return { id, nota: t.slice(0, 300) };
}

export function lerVista(texto: string | null | undefined): VistaGuardada | null {
  if (!texto) return null;
  try {
    const v = JSON.parse(texto) as Record<string, unknown>;
    const u = typeof v.u === "string" ? v.u : null;
    const n = typeof v.n === "string" ? v.n : null;
    return u === null && n === null ? null : { u, n };
  } catch {
    return null;
  }
}

export function textoDaVista(v: VistaGuardada): string {
  return JSON.stringify({ u: v.u, n: v.n });
}

/**
 * Depois de arrancar: vale a pena pedir a nota? Só a correr uma atualização
 * (não a da loja) que ainda não se tratou neste telemóvel.
 */
export function pedirNotaAoArrancar(vista: VistaGuardada | null, updateId: string | null | undefined, embutida: boolean): boolean {
  if (embutida || !updateId) return false;
  return vista?.u !== updateId;
}

/** Com a nota da atualização que está a correr: mostra-se o cartão? E o que se guarda. */
export function depoisDeLerANota(
  vista: VistaGuardada | null,
  updateId: string,
  nota: NotaRecebida,
): { mostrar: boolean; guardar: VistaGuardada } {
  return { mostrar: vista?.n !== nota.id, guardar: { u: updateId, n: nota.id } };
}
