import { createHash, timingSafeEqual } from "node:crypto";
import { ligacaoDeEntradaPorHash } from "@/lib/db";
import { pareceUmToken, porqueRecusa, type MotivoDeRecusa } from "@/lib/entrada-por-link";
import { hashDaLigacao } from "@/lib/entrada-por-link-segredo";

/**
 * O LINK DE ENTRADA DA APP DE CLIENTE, PRESO AO TELEMÓVEL QUE O PEDIU —
 * 28-10-2026 (d8 fase 2, S1).
 *
 * Ao pedir o link, a app cria um código do aparelho (32 bytes aleatórios em
 * base64url, 43 caracteres), guarda-o no cofre do telemóvel e manda só a
 * PROVA: o SHA-256 desse texto (UTF-8), em 64 caracteres hexadecimais. A prova
 * fica com o link na base (`ligacoesDeEntrada.provaDoAparelho`). Ao abrir o
 * link, a app manda o código; o servidor faz o SHA-256 e compara-o com a
 * prova, em tempo constante.
 *
 * Assim o link só serve no telemóvel que o pediu: aberto noutro (o email
 * reencaminhado, o Gmail num computador), não entra — e NÃO SE GASTA, para
 * voltar a servir no telemóvel certo.
 *
 * Cada porta só aceita os seus: um link sem prova é do site (`doSite`), e o
 * site recusa um link com prova (`daApp`, no provedor `link-de-entrada`).
 */

/** Quantas vezes a R1a pode perguntar de quem é um link. */
export const MAXIMO_DE_VERIFICACOES = 10;

/** 64 caracteres hexadecimais — o SHA-256 do código do aparelho. */
export function pareceUmaProva(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{64}$/i.test(v);
}

/** 43 caracteres de base64url, como o token do link. */
export function pareceUmCodigoDoAparelho(v: unknown): v is string {
  return pareceUmToken(v);
}

/** A prova de um código: SHA-256 do texto (UTF-8), em hexadecimal minúsculo. */
export function provaDoCodigo(codigo: string): string {
  return createHash("sha256").update(codigo, "utf8").digest("hex");
}

function igualEmTempoConstante(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export type LinkDaApp =
  | { ok: true; email: string; hash: string; prova: string }
  | { ok: false; motivo: MotivoDeRecusa; hash: string | null };

/**
 * De quem é este link, e se serve neste telemóvel — SEM O GASTAR.
 *
 * Pela ordem da especificação: a forma do token e o link na base
 * (`malformado`, `desconhecido`, `expirado`, `usado`), um link do site
 * (`doSite`), e o código do aparelho (`outroAparelho`).
 */
export async function verificarLinkDaApp(
  linkToken: unknown,
  codigoDoAparelho: string,
  agora: Date = new Date(),
): Promise<LinkDaApp> {
  if (!pareceUmToken(linkToken)) return { ok: false, motivo: "malformado", hash: null };
  const hash = hashDaLigacao(linkToken);
  const ligacao = await ligacaoDeEntradaPorHash(hash);
  const motivo = porqueRecusa(linkToken, ligacao, agora);
  if (motivo || !ligacao) return { ok: false, motivo: motivo ?? "desconhecido", hash };
  if (!ligacao.provaDoAparelho) return { ok: false, motivo: "doSite", hash };
  const prova = provaDoCodigo(codigoDoAparelho);
  if (!igualEmTempoConstante(prova, ligacao.provaDoAparelho.toLowerCase())) {
    return { ok: false, motivo: "outroAparelho", hash };
  }
  return { ok: true, email: ligacao.email, hash, prova };
}
