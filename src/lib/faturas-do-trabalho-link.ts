import crypto from "node:crypto";

/**
 * O LINK DE UMA FATURA DO TRABALHO — d28 (CEO e dono, 15-11-2026).
 *
 * As faturas do trabalho têm nome, NIF e morada: não se dão pelo endereço do
 * armazenamento. Quem já provou que pode ver o trabalho (o cliente pelas
 * credenciais do pedido, o parceiro pela sessão, a equipa pelo backoffice)
 * recebe um link para a rota de leitura (`/api/faturas-do-trabalho/<id>`),
 * assinado e com prazo. Sem a assinatura, a rota pede uma dessas três
 * credenciais. O endereço do armazenamento nunca sai do servidor.
 *
 * Só servidor (usa o segredo da sessão, com um rótulo só para isto).
 */

export const ROTA_DA_FATURA = "/api/faturas-do-trabalho";

/** Quanto tempo abre um link — o bastante para uma página aberta; depois relê-se a página. */
export const HORAS_DO_LINK_DA_FATURA = 12;

function chave(): string | null {
  const proprio = process.env.FATURAS_SECRET?.trim();
  if (proprio) return proprio;
  const base = process.env.JWT_SECRET;
  if (!base) return null;
  return crypto.createHmac("sha256", base).update("clyon:fatura-do-trabalho:v1").digest("base64url");
}

function assinatura(id: number, ate: string): string | null {
  const k = chave();
  if (!k) return null;
  return crypto.createHmac("sha256", k).update(`fatura:v1:${id}:${ate}`).digest("base64url").slice(0, 32);
}

/** O link assinado; sem segredo, o link sem assinatura (a rota pede então as credenciais). */
export function linkDaFatura(id: number, agora: Date = new Date()): string {
  const ate = Math.floor(agora.getTime() / 1000 + HORAS_DO_LINK_DA_FATURA * 3600).toString(36);
  const a = assinatura(id, ate);
  return a ? `${ROTA_DA_FATURA}/${id}?ate=${ate}&a=${a}` : `${ROTA_DA_FATURA}/${id}`;
}

/** A assinatura confere e está dentro do prazo? */
export function linkDaFaturaValido(id: number, ate: string | null, a: string | null, agora: Date = new Date()): boolean {
  if (!ate || !a || !/^[0-9a-z]{4,10}$/.test(ate) || !/^[A-Za-z0-9_-]{32}$/.test(a)) return false;
  if (parseInt(ate, 36) * 1000 < agora.getTime()) return false;
  const esperada = assinatura(id, ate);
  if (!esperada) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(esperada);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Um endereço do armazenamento PÚBLICO do Blob (as faturas de antes; lê-se sem token). Os outros pedem-no. */
export function eDoBlobPublico(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
