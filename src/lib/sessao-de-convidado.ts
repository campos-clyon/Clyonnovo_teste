import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { pareceUmCodigoDoAparelho, provaDoCodigo } from "./entrada-na-app";
import { sessaoDeConvidadoPorHash, tocarSessaoDeConvidado } from "./db";

/**
 * A SESSÃO DE CONVIDADO — 29-10-2026 (S16, regras R1–R7 e R16 da Segurança).
 *
 * Quem abre na app o link de um pedido feito sem conta (pelo WhatsApp) troca-o
 * UMA VEZ por uma sessão presa a esse telemóvel e a esse pedido:
 *
 *   · uma chave OPACA de 256 bits (`cv_…`), e não um JWT: na base só o
 *     SHA-256, numa linha por telemóvel e pedido (`convidadosDoPedido`); o
 *     servidor confirma-a na base em cada pedido (R2);
 *   · presa ao CÓDIGO DO APARELHO DO CONVIDADO — um código próprio, guardado
 *     no cofre numa chave separada da S1 (R5), que vai em cada pedido no
 *     cabeçalho `x-codigo-do-aparelho`; a base guarda só a prova (R6);
 *   · vale até ao fim da validade do link no momento da troca (R3), e morre
 *     com «Cortar o acesso pelo link», quando o pedido passa a ter conta, ou
 *     com o pedido (R4).
 *
 * Um quinto leitor, separado dos outros: só aceita a chave de convidado, e os
 * outros (cliente, profissional, equipa) não a aceitam — não é um JWT.
 * Nunca se escreve a chave nem o código num registo (R7).
 */

export const PREFIXO_DA_SESSAO_DE_CONVIDADO = "cv_";
export const CABECALHO_DO_APARELHO = "x-codigo-do-aparelho";

const FORMA_DA_CHAVE = /^cv_[A-Za-z0-9_-]{43}$/;

export const resumoDaChave = (chave: string) => createHash("sha256").update(chave, "utf8").digest("hex");

/** Uma chave nova (a app guarda-a no cofre; a base só o resumo). */
export function novaChaveDeConvidado(): { chave: string; hash: string } {
  const chave = PREFIXO_DA_SESSAO_DE_CONVIDADO + randomBytes(32).toString("base64url");
  return { chave, hash: resumoDaChave(chave) };
}

export function pareceUmaChaveDeConvidado(v: unknown): v is string {
  return typeof v === "string" && FORMA_DA_CHAVE.test(v);
}

function igual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export type Convidado = { pedidoId: number; prova8: string; sessaoId: number };

/** A chave do cabeçalho Authorization, se for de convidado. */
export function chaveDoPedidoHttp(req: { headers: { get: (n: string) => string | null } }): string | null {
  const a = req.headers.get("authorization") ?? "";
  const m = a.match(/^Bearer\s+(\S+)$/i);
  return m && pareceUmaChaveDeConvidado(m[1]) ? m[1] : null;
}

/**
 * O LEITOR DO CONVIDADO. Só para o pedido pedido (quando se diz qual), só com
 * a chave e o código do aparelho certos, e só enquanto a sessão é válida
 * (R4). Qualquer falha dá `null`, sem dizer qual (R6).
 */
export async function convidadoDoPedido(
  req: { headers: { get: (n: string) => string | null } },
  pedidoId?: number,
  agora: Date = new Date(),
): Promise<Convidado | null> {
  return validarConvidado(chaveDoPedidoHttp(req), req.headers.get(CABECALHO_DO_APARELHO), pedidoId, agora);
}

/** O mesmo, com a chave e o código dados (a junção à conta manda-os no corpo). */
export async function validarConvidado(
  chave: unknown,
  codigo: unknown,
  pedidoId?: number,
  agora: Date = new Date(),
): Promise<Convidado | null> {
  if (!pareceUmaChaveDeConvidado(chave) || !pareceUmCodigoDoAparelho(codigo)) return null;
  const s = await sessaoDeConvidadoPorHash(resumoDaChave(chave)).catch(() => null);
  if (!s) return null;
  if (!igual(s.provaDoAparelho, provaDoCodigo(codigo))) return null;
  if (s.revogadaEm) return null;
  if (new Date(s.expiraEm).getTime() <= agora.getTime()) return null;
  if (s.convidadosDesde && new Date(s.criadaEm).getTime() < new Date(s.convidadosDesde).getTime()) return null;
  // O pedido passou a ter conta: o convidado deixa de servir (entra com a conta).
  if ((s.contactEmail ?? "").trim()) return null;
  if (pedidoId != null && Number(s.pedidoId) !== Number(pedidoId)) return null;
  await tocarSessaoDeConvidado(s.id).catch(() => {});
  return { pedidoId: Number(s.pedidoId), prova8: s.provaDoAparelho.slice(0, 8), sessaoId: s.id };
}
