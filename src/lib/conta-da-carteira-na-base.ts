import { levantamentosDoProfissional, negociacoesDoProfissional } from "./db";
import { trabalhosDaCarteira } from "./carteira-do-profissional";
import type { TrabalhoNaCarteira } from "./carteira";
import { contaDaCarteira, type LevantamentoComData, type TrabalhoParaALista } from "./trabalhos-da-carteira";
import { primeiroNome } from "./regras-novas-da-retencao";
import { SERVICE_CATEGORIES } from "./service-categories";

/**
 * A CARTEIRA TRABALHO A TRABALHO, A PARTIR DA BASE — 30-10-2026.
 *
 * O painel do profissional (`/api/profissionais/carteira`, que serve também a
 * app Pro) e o backoffice (Carteiras) lêem a carteira por AQUI: as mesmas
 * negociações, a mesma conversão (`trabalhosDaCarteira`), os mesmos
 * levantamentos e a mesma conta (`contaDaCarteira`). Dois caminhos davam dois
 * números para o mesmo profissional.
 */
export function paraALista(
  trabalhos: TrabalhoNaCarteira[],
  linhas: Array<{ id: number; pedidoId: number; serviceType: string | null; contactName: string | null }>,
): TrabalhoParaALista[] {
  const porId = new Map(linhas.map((l) => [l.id, l]));
  return trabalhos.map((t) => {
    const l = porId.get(t.negociacaoId);
    return {
      ...t,
      pedidoId: l?.pedidoId ?? null,
      servico: SERVICE_CATEGORIES.find((c) => c.id === l?.serviceType)?.label ?? l?.serviceType ?? null,
      // Só o primeiro nome: é o que a retenção guarda depois de anonimizar.
      cliente: primeiroNome(l?.contactName ?? null),
    };
  });
}

export function levantamentosComData(
  ls: Array<{ id: number; valor: unknown; estado: string; processadoEm?: unknown; createdAt?: unknown }>,
): LevantamentoComData[] {
  return ls.map((l) => ({
    id: l.id,
    valor: Number(l.valor),
    estado: l.estado,
    processadoEm: (l.processadoEm as Date | string | null) ?? null,
    criadoEm: (l.createdAt as Date | string | null) ?? null,
  }));
}

export async function contaDaCarteiraDoProfissional(providerId: number, agora: Date = new Date()) {
  const [linhas, levantamentos] = await Promise.all([
    negociacoesDoProfissional(providerId),
    levantamentosDoProfissional(providerId),
  ]);
  const trabalhos = await trabalhosDaCarteira(linhas);
  return contaDaCarteira(paraALista(trabalhos, linhas), levantamentosComData(levantamentos as never), agora);
}
