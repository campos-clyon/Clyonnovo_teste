import {
  appendOrderHistory,
  atribuirDirectamenteTrabalhoClyon,
  registarSemFalhar,
} from "./db";
import { avisarProfissionalEscolhido } from "./avisar-escolhido-da-oferta";
import { avisarOClienteDoPedido } from "./avisos-ao-cliente";
import { guiaImpedeOProfissional } from "./guia-na-base";
import { GUIA_POR_VERIFICAR_FRASE } from "./guia-antes-de-contratar";

/**
 * «ATRIBUIR DIRECTAMENTE A…» — 11-11-2026 (dono, o #591).
 *
 * *«Não consigo atribuir esse pedido a ele: ele tem de ir à conta aceitar, e
 * ele não sabe usar a aplicação. Quero só atribuir o pedido a ele e ficar
 * ligado a ele, sem ele ter de fazer nada.»*
 *
 * O acordo foi feito por fora. A negociação dele fica «acordada» com o valor
 * fixo e a taxa do Trabalho CLYON (`atribuirDirectamenteTrabalhoClyon`), sem
 * oferta para aceitar e sem distribuir a mais ninguém. Fica no histórico
 * «atribuído pela CLYON (quem) — acordado por fora», e ele é avisado (email,
 * notificação e WhatsApp, com as fechaduras de sempre) de que o trabalho é
 * dele, com o dia.
 *
 * A guia antes de contratar (d10.1) vale aqui também: atribuir é contratar.
 */

export const PORQUE_NAO_SE_ATRIBUI: Record<string, [string, number]> = {
  nao_e_clyon: ["Esse pedido não é um Trabalho CLYON.", 404],
  arrumado: ["Este trabalho está cancelado ou arquivado — restaure-o primeiro.", 409],
  ja_feito: ["Este trabalho já foi feito — já não se atribui.", 409],
  outro_tem: ["Este trabalho já está com outra pessoa — para o mudar, use a troca no cartão.", 409],
  ja_e_dele: ["Este trabalho já está atribuído a essa pessoa.", 409],
  sem_profissional: ["Não há essa conta (ou foi apagada).", 404],
  sem_taxa: ["Trabalho antigo, sem taxa: grave primeiro o valor e a taxa.", 409],
};

export type ResultadoDaAtribuicaoDirecta =
  | { ok: true; feito: string; negociacaoId: number; profissional: string; avisado: boolean }
  | { ok: false; erro: string; estado: number; guiaPorVerificar?: boolean };

export async function atribuirDirectamente(a: {
  pedidoId: number;
  providerId: number;
  quem: string;
  por: { id: number; nome: string; role: string } | null;
  baseUrl: string;
}): Promise<ResultadoDaAtribuicaoDirecta> {
  if (await guiaImpedeOProfissional(a.pedidoId, a.providerId)) {
    return { ok: false, erro: GUIA_POR_VERIFICAR_FRASE, estado: 409, guiaPorVerificar: true };
  }
  const r = await atribuirDirectamenteTrabalhoClyon(a.pedidoId, a.providerId);
  if (!r.ok) {
    const [erro, estado] = PORQUE_NAO_SE_ATRIBUI[r.porque];
    return { ok: false, erro: r.porque === "outro_tem" && r.detalhe ? erro.replace("outra pessoa", r.detalhe) : erro, estado };
  }

  const aviso = await avisarProfissionalEscolhido({
    negociacaoId: r.negociacaoId,
    pedidoId: r.pedidoId,
    providerId: r.providerId,
    baseUrl: a.baseUrl,
    porFora: true,
  });
  const nome = aviso.profissional || r.profissional || `#${r.providerId}`;
  const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
  const feito =
    `Atribuído pela CLYON (${a.quem}) a ${nome} — acordado por fora, sem ele ter de aceitar: ` +
    `${euros(r.valor)} + IVA, com a taxa de ${Math.round(r.taxa * 100)} %.` +
    (r.encerradas > 0 ? ` ${r.encerradas} que tinham a oferta em aberto ficaram de fora.` : "") +
    (aviso.saiu ? ` ${nome} foi avisado.` : " O aviso por email não saiu — diga-lhe à mão.");

  await appendOrderHistory(r.pedidoId, { type: "created", by: a.por, message: feito });
  // O cliente fica a saber quem faz o trabalho (S10), como na escolha.
  await avisarOClienteDoPedido(r.pedidoId, "escolhido", { nome: aviso.profissional || null, negociacaoId: r.negociacaoId });
  await registarSemFalhar({
    acontecimento: "negociacao_fechada",
    pedidoId: r.pedidoId,
    negociacaoId: r.negociacaoId,
    providerId: r.providerId,
    providerNome: aviso.profissional || r.profissional || null,
    autorTipo: "clyon",
    autorNome: a.quem,
    valor: r.valor,
    valorProfissional: aviso.valor,
    resumo: feito,
    visivelProfissional: true,
  });
  return { ok: true, feito, negociacaoId: r.negociacaoId, profissional: nome, avisado: aviso.saiu };
}
