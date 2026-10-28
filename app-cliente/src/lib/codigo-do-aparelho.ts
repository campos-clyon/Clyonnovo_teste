import * as Crypto from "expo-crypto";
import { codigoNovo, FORMA_DO_CODIGO } from "./entrada";
import { apagarDoCofre, guardarNoCofre, lerDoCofre } from "./sessao";

/**
 * O CÓDIGO DESTE TELEMÓVEL PARA A ENTRADA PELO LINK (versão 2, 28-10-2026).
 *
 * 32 bytes aleatórios (`expo-crypto`) em base64url, guardados no cofre. Nunca
 * sai do telemóvel a não ser para a R1a e a R1, por HTTPS; ao pedir o link vai
 * só o SHA-256 dele (a prova). O mesmo código serve para «Reenviar» e «Usar
 * outro email» enquanto não se entra; deita-se fora depois de entrar, depois
 * de «Não sou eu» e depois de «Sair» — o seguinte nasce no próximo pedido.
 */

const CHAVE = "clyon-cliente-aparelho";

const bytes = (n: number) => Crypto.getRandomBytes(n);

/** O código guardado, ou `null` (este telemóvel não pediu nenhum link). */
export async function lerCodigoDoAparelho(): Promise<string | null> {
  const c = await lerDoCofre(CHAVE);
  return c && FORMA_DO_CODIGO.test(c) ? c : null;
}

/** O código para pedir um link: o guardado, ou um novo (guardado já). */
export async function codigoParaPedirOLink(): Promise<string> {
  const guardado = await lerCodigoDoAparelho();
  if (guardado) return guardado;
  const novo = codigoNovo(bytes);
  await guardarNoCofre(CHAVE, novo);
  return novo;
}

/**
 * Um código que não se guarda: para perguntar ao site de quem é um link que
 * este telemóvel não pediu. O site responde com o motivo certo (`outroAparelho`
 * ou `doSite`) e a app mostra a frase dele, sem a escrever.
 */
export const codigoDescartavel = (): string => codigoNovo(bytes);

export const esquecerCodigoDoAparelho = () => apagarDoCofre(CHAVE);

/** A prova que vai com o pedido do link: o SHA-256 do código, em hexadecimal minúsculo. */
export async function sha256Hex(texto: string): Promise<string> {
  const d = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, texto, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  return d.toLowerCase();
}
