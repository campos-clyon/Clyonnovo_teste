import { NextResponse } from "next/server";
import { instanteDaBase } from "./hora-de-lisboa";
import { porSessaoNaResposta, sessaoVemDaApp } from "./profissional-auth";
export { inicioDoSegundo } from "./inicio-do-segundo";

/**
 * SAIR DE TODOS OS APARELHOS — 25-10-2026.
 *
 * A sessão do profissional é um token assinado que vale trinta dias e se
 * renova enquanto ele usa a app. Até aqui não havia maneira de o desligar:
 * mudar a palavra-passe deixava o telemóvel perdido (ou o do colega que a
 * soube) dentro da conta até o token caducar — e com a renovação podia nunca
 * caducar.
 *
 * Agora a conta tem um corte (`providers.sessoesDesde`): mudar ou repor a
 * palavra-passe, ou «Sair de todos os aparelhos», põe-no em agora, e
 * `sessaoActivaDoProfissional` recusa os tokens emitidos antes dele (`iat`).
 * O aparelho que fez a mudança recebe logo um token novo — no cookie, no
 * painel; no corpo da resposta, na app — e continua dentro.
 */

/**
 * O token foi emitido antes do corte? Um token sem `iat` é dos de antes desta
 * mudança, e por isso de antes de qualquer corte. Sem corte, vale.
 */
export function emitidoAntesDoCorte(
  emitidoEm: number | null | undefined,
  sessoesDesde: Date | string | null | undefined,
): boolean {
  const corte = instanteDaBase(sessoesDesde ?? null);
  if (!corte) return false;
  if (typeof emitidoEm !== "number") return true;
  return emitidoEm < Math.floor(corte.getTime() / 1000);
}

/**
 * A resposta com a sessão nova do aparelho que pediu: na app o token vai no
 * corpo (a app não guarda cookies); no painel vai no cookie `httpOnly`, e
 * nunca no corpo — um script na página não pode levar uma sessão de 30 dias.
 */
export function respostaComSessaoNova(
  req: Parameters<typeof sessaoVemDaApp>[0],
  token: string,
  lembrar: boolean,
): NextResponse {
  if (sessaoVemDaApp(req)) return NextResponse.json({ ok: true, token });
  const resposta = NextResponse.json({ ok: true });
  porSessaoNaResposta(resposta, token, lembrar);
  return resposta;
}
