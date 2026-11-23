import { after } from "next/server";
import { appendOrderHistory, registarSemFalhar } from "./db";
import { trabalhoVistoPeloBackoffice } from "./acesso-ao-pagamento";
import { oQueOClienteVeDoParceiro } from "./pagar-ao-parceiro-para-o-cliente";
import { comoPagarValido, type ComoPagarAoParceiro } from "./pagar-ao-parceiro";
import { gravarAindaNaoRecebi, gravarJaPaguei, gravarRecebi, registoDoPagamentoDe } from "./pagamento-registado-na-base";
import { avisarOParceiroQueOClienteDizQuePagou } from "./avisar-do-pagamento-registado";
import { formaPorExtenso, pagoA, registoDoPagamento } from "./pagamento-registado";
import type { RespostaDaRota } from "./responder-ajuste";

/**
 * AS TRÊS ACÇÕES DO REGISTO DO PAGAMENTO — d3 (23-11-2026). Uma só função para
 * cada, para o site, a conta, a app de cliente e a app Pro dizerem o mesmo: a
 * regra e as guardas estão aqui e em `pagamento-registado-na-base.ts` (um
 * `UPDATE` com as guardas no `WHERE`). Quem chama já provou de quem é o pedido
 * (token do link, sessão, ou a sessão do parceiro).
 */

export const ACCAO_JA_PAGUEI = "ja_paguei";
export const ACCAO_RECEBI = "recebi";
export const ACCAO_NAO_RECEBI = "nao_recebi";

const falha = (status: number, error: string): RespostaDaRota => ({ status, corpo: { ok: false, error } });

const NAO_SE_PAGA_AO_PARCEIRO = "Este trabalho não se paga diretamente ao parceiro.";
const JA_NAO_E_O_MOMENTO = "Já não é o momento de registar este pagamento: o pagamento já foi confirmado, ou o pedido já foi fechado.";

/** O trabalho é do modelo de 15-11 e está contratado? Devolve o trabalho (com o regime e o total) ou a razão. */
async function trabalhoDoModeloNovo(pedidoId: number, negociacaoId: number) {
  const acesso = await trabalhoVistoPeloBackoffice(negociacaoId);
  if (!acesso.ok || acesso.trabalho.pedidoId !== pedidoId || !acesso.trabalho.novoModelo) return null;
  return acesso.trabalho;
}

/** O CLIENTE: «Já paguei a {parceiro}», com a forma. */
export async function dizerQueJaPagou(a: {
  pedidoId: number;
  negociacaoId: number;
  forma: unknown;
  onde: string;
  autorNome: string | null;
}): Promise<RespostaDaRota> {
  if (!comoPagarValido(a.forma)) return falha(400, "Diga como pagou: transferência, MB WAY ou dinheiro.");
  const forma: ComoPagarAoParceiro = a.forma;
  const trabalho = await trabalhoDoModeloNovo(a.pedidoId, a.negociacaoId);
  if (!trabalho) return falha(409, NAO_SE_PAGA_AO_PARCEIRO);
  const gravou = await gravarJaPaguei(a.negociacaoId, forma);
  if (!gravou) return falha(409, JA_NAO_E_O_MOMENTO);

  const total = await oQueOClienteVeDoParceiro(trabalho)
    .then((v) => v.conta?.total ?? null)
    .catch(() => null);
  const resumo = `O cliente disse que pagou${total != null ? ` ${total.toFixed(2).replace(".", ",")} €` : ""} a ${trabalho.profissionalNome} por ${formaPorExtenso(forma)} (${a.onde}). À espera do «Recebi» do parceiro.`;
  await appendOrderHistory(a.pedidoId, { type: "created", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "cliente_diz_que_pagou",
    pedidoId: a.pedidoId,
    negociacaoId: a.negociacaoId,
    providerId: trabalho.providerId,
    autorTipo: "cliente",
    autorNome: a.autorNome,
    valor: total,
    resumo,
  });
  after(() =>
    avisarOParceiroQueOClienteDizQuePagou({
      providerId: trabalho.providerId,
      pedidoId: a.pedidoId,
      negociacaoId: a.negociacaoId,
      total,
      forma,
    }).then(() => undefined),
  );
  return { status: 200, corpo: { ok: true, jaPagou: true } };
}

/**
 * O PARCEIRO: «Sim, recebi» — ou, sem o cliente ter dito nada, «O cliente já me
 * pagou». Só no trabalho dele. Com isto o pedido mostra «Pago a …» e os dados de
 * pagamento saem do ecrã do cliente.
 */
export async function parceiroRecebeu(a: { pedidoId: number; negociacaoId: number; providerId: number; autorNome: string | null }): Promise<RespostaDaRota> {
  const trabalho = await trabalhoDoModeloNovo(a.pedidoId, a.negociacaoId);
  if (!trabalho || trabalho.providerId !== a.providerId) return falha(404, "Trabalho não encontrado.");
  const gravou = await gravarRecebi(a.negociacaoId, a.providerId);
  if (!gravou) return falha(409, JA_NAO_E_O_MOMENTO);
  const l = await registoDoPagamentoDe(a.negociacaoId);
  const resumo = `${pagoA(trabalho.profissionalNome, l?.parceiroConfirmouEm)} — o parceiro confirmou que recebeu.`;
  await appendOrderHistory(a.pedidoId, { type: "created", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "parceiro_recebeu",
    pedidoId: a.pedidoId,
    negociacaoId: a.negociacaoId,
    providerId: a.providerId,
    providerNome: trabalho.profissionalNome,
    autorTipo: "profissional",
    autorNome: a.autorNome,
    resumo,
  });
  return { status: 200, corpo: { ok: true, registo: registoDoPagamento(l ?? {}) } };
}

/** O PARCEIRO: «Ainda não recebi» — só depois de o cliente dizer que pagou; fica o selo «Pagamento em dúvida» na Mesa. */
export async function parceiroNaoRecebeu(a: { pedidoId: number; negociacaoId: number; providerId: number; autorNome: string | null }): Promise<RespostaDaRota> {
  const trabalho = await trabalhoDoModeloNovo(a.pedidoId, a.negociacaoId);
  if (!trabalho || trabalho.providerId !== a.providerId) return falha(404, "Trabalho não encontrado.");
  const gravou = await gravarAindaNaoRecebi(a.negociacaoId, a.providerId);
  if (!gravou) return falha(409, "Só pode dizer que ainda não recebeu depois de o cliente dizer que pagou, e antes de confirmar o pagamento.");
  const resumo = `O parceiro ${trabalho.profissionalNome} diz que ainda não recebeu o pagamento que o cliente disse ter feito. Pagamento em dúvida.`;
  await appendOrderHistory(a.pedidoId, { type: "created", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "parceiro_nao_recebeu",
    pedidoId: a.pedidoId,
    negociacaoId: a.negociacaoId,
    providerId: a.providerId,
    providerNome: trabalho.profissionalNome,
    autorTipo: "profissional",
    autorNome: a.autorNome,
    resumo,
  });
  return { status: 200, corpo: { ok: true, registo: registoDoPagamento((await registoDoPagamentoDe(a.negociacaoId)) ?? {}) } };
}
