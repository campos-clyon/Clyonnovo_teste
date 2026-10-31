/**
 * OS MATERIAIS NA PROPOSTA, NA APP — 31-10-2026. O formulário guarda o que ele
 * escreve (texto); daqui sai o `materiais` que vai no POST da proposta, já na
 * forma que o site lê (`lerMateriaisDaProposta` em materiais-da-proposta.ts).
 * Puro: os testes do site importam-no.
 */
import {
  MATERIAIS_DE_PARTIDA,
  lerMateriaisDaProposta,
  type MateriaisDaProposta,
} from "../../../src/lib/materiais-da-proposta";

export type OutroMaterial = { nome: string; preco: string; unidade: string };

export type EscolhaDosMateriais = {
  /** `null` = ainda não respondeu à pergunta. */
  incluidos: boolean | null;
  /** O preço escrito de cada um dos de partida, por id. */
  precos: Record<string, string>;
  outros: OutroMaterial[];
};

const comVirgula = (v: number) => v.toFixed(2).replace(".", ",");

/** A escolha a começar: o que ele já disse antes, ou os preços de partida da tabela. */
export function escolhaInicial(antes: MateriaisDaProposta | null | undefined): EscolhaDosMateriais {
  const precos: Record<string, string> = {};
  for (const m of MATERIAIS_DE_PARTIDA) precos[m.id] = comVirgula(m.preco);
  if (!antes) return { incluidos: null, precos, outros: [] };
  if (antes.incluidos) return { incluidos: true, precos, outros: [] };
  const outros: OutroMaterial[] = [];
  for (const i of antes.itens) {
    if (MATERIAIS_DE_PARTIDA.some((m) => m.id === i.id)) precos[i.id] = comVirgula(i.preco);
    else outros.push({ nome: i.nome, preco: comVirgula(i.preco), unidade: i.unidade });
  }
  return { incluidos: false, precos, outros };
}

/** O que vai no corpo da proposta — `undefined` quando ele não respondeu (ou a lista ficou vazia). */
export function materiaisParaEnviar(e: EscolhaDosMateriais): MateriaisDaProposta | undefined {
  if (e.incluidos === null) return undefined;
  if (e.incluidos) return { incluidos: true };
  const itens = [
    ...MATERIAIS_DE_PARTIDA.map((m) => ({ id: m.id, nome: m.nome, unidade: m.unidade, preco: e.precos[m.id] ?? "" })),
    ...e.outros.map((o, i) => ({ id: `outro-${i + 1}`, nome: o.nome, unidade: o.unidade || "unidade", preco: o.preco })),
  ];
  return lerMateriaisDaProposta({ incluidos: false, itens }) ?? undefined;
}

/** Num pedido de mudança, a pergunta é obrigatória antes de enviar. */
export function faltaResponderAosMateriais(serviceType: string | null | undefined, e: EscolhaDosMateriais): boolean {
  return serviceType === "mudanca" && materiaisParaEnviar(e) === undefined;
}
