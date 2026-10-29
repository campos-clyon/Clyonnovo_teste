import * as Crypto from "expo-crypto";
import { pedirComToken } from "./api";
import { codigoNovo, FORMA_DO_CODIGO } from "./entrada";
import type { OpcoesDoPedido, Pedir } from "./erros";
import { apagarDoCofre, guardarNoCofre, lerDoCofre } from "./sessao";
import { sessoesValidas, type SessaoDeConvidado } from "./pedido-do-link";

/**
 * O PEDIDO PELO LINK, SEM CONTA (A9 — preparado; liga-se quando a S16 estiver
 * na main). Regras da Segurança (D3, 29-10-2026):
 *
 * - O convidado tem um CÓDIGO DO APARELHO PRÓPRIO, numa chave do cofre
 *   separada da entrada (S1): o da S1 deita-se fora ao entrar, em «Não sou eu»
 *   e em «Sair», e mataria as sessões de convidado. Este fica enquanto houver
 *   pedidos de convidado no telemóvel.
 * - A sessão de convidado (uma chave da R10) vive no cofre, com o pedido a que
 *   pertence e a validade; vai no `Authorization` e o código no cabeçalho
 *   `x-codigo-do-aparelho`. Nunca se escrevem em registos.
 * - O link do pedido NUNCA se guarda.
 * - Um 401 de convidado não faz sair da conta: só esquece esse pedido.
 */

const CODIGO = "clyon-cliente-convidado";
const SESSOES = "clyon-cliente-convidados";
export const CABECALHO_DO_APARELHO = "x-codigo-do-aparelho";

export async function codigoDoConvidado(): Promise<string> {
  const c = await lerDoCofre(CODIGO);
  if (c && FORMA_DO_CODIGO.test(c)) return c;
  const novo = codigoNovo((n) => Crypto.getRandomBytes(n));
  await guardarNoCofre(CODIGO, novo);
  return novo;
}

export async function sessoesDeConvidado(agora: Date = new Date()): Promise<SessaoDeConvidado[]> {
  try {
    return sessoesValidas(JSON.parse((await lerDoCofre(SESSOES)) ?? "[]"), agora);
  } catch {
    return [];
  }
}

async function escreverSessoes(lista: SessaoDeConvidado[]): Promise<void> {
  if (lista.length === 0) {
    await apagarDoCofre(SESSOES);
    // Sem pedidos de convidado, o código também sai.
    await apagarDoCofre(CODIGO);
    return;
  }
  await guardarNoCofre(SESSOES, JSON.stringify(lista));
}

export async function guardarSessaoDeConvidado(s: SessaoDeConvidado): Promise<void> {
  const outras = (await sessoesDeConvidado()).filter((x) => x.pedidoId !== s.pedidoId);
  await escreverSessoes([s, ...outras].slice(0, 20));
}

export async function sessaoDoPedido(pedidoId: number): Promise<SessaoDeConvidado | null> {
  return (await sessoesDeConvidado()).find((s) => s.pedidoId === pedidoId) ?? null;
}

export async function esquecerSessaoDeConvidado(pedidoId: number): Promise<void> {
  await escreverSessoes((await sessoesDeConvidado()).filter((s) => s.pedidoId !== pedidoId));
}

/** Marca quantas vezes este pedido foi aberto (a folha D4.6 só na 2.ª abertura, e não antes de 7 dias). */
export async function marcarAbertura(pedidoId: number, agora: Date = new Date()): Promise<SessaoDeConvidado | null> {
  const lista = await sessoesDeConvidado(agora);
  const s = lista.find((x) => x.pedidoId === pedidoId);
  if (!s) return null;
  const nova = { ...s, aberturas: (s.aberturas ?? 0) + 1 };
  await escreverSessoes(lista.map((x) => (x.pedidoId === pedidoId ? nova : x)));
  return nova;
}

export async function marcarFolhaMostrada(pedidoId: number, agora: Date = new Date()): Promise<void> {
  const lista = await sessoesDeConvidado(agora);
  await escreverSessoes(lista.map((x) => (x.pedidoId === pedidoId ? { ...x, folhaEm: agora.toISOString() } : x)));
}

/** O `pedir` de um pedido aberto pelo link: a sessão de convidado e o código deste telemóvel. Nunca faz sair da conta. */
export function pedirComoConvidado(s: SessaoDeConvidado, codigo: string): Pedir {
  return (<T,>(caminho: string, o: OpcoesDoPedido = {}) =>
    pedirComToken<T>(caminho, s.sessao, { ...o, cabecalhos: { ...(o.cabecalhos ?? {}), [CABECALHO_DO_APARELHO]: codigo } })) as Pedir;
}
