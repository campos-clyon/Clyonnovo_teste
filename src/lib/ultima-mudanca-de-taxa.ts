import { instanteDaBase } from "./hora-de-lisboa";
import type { Taxas } from "./taxas-plataforma";

/**
 * A ÚLTIMA MUDANÇA DE TAXA, NO ECRÃ DAS TAXAS — 12-11-2026 (d2).
 *
 * As taxas mudaram e ninguém, a olhar para o backoffice, sabia dizer quando
 * nem quem. A linha já existia no registo permanente (`taxas_alteradas`,
 * escrita por `guardarTaxas`); faltava mostrá-la ao lado dos números. Só
 * leitura: isto não muda nenhuma taxa.
 *
 * O PERFIL: a rota que muda as taxas só deixa passar o administrador
 * (`requireAdminGeral`), e desde hoje a linha nova grava-o no detalhe. As
 * linhas antigas não o tinham — vêm com `perfil: null`, e o ecrã não inventa.
 * A frase do ecrã está em `components/admin/frase-da-mudanca-de-taxa.ts`.
 */

export type LinhaDaMudancaDeTaxa = {
  ocorridoEm: Date | string | null;
  autorNome: string | null;
  detalheJson: string | null;
};

export type UltimaMudancaDeTaxa = {
  /** ISO, em UTC; mostra-se sempre em hora de Lisboa. */
  quando: string;
  quem: string;
  perfil: string | null;
  antes: Taxas;
  depois: Taxas;
};

function taxasDe(v: unknown): Taxas | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const c = Number(o.cliente);
  const p = Number(o.profissional);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  return { cliente: c, profissional: p };
}

/** A linha do registo, lida. `null` se lhe faltar o essencial (data ou números). */
export function lerMudancaDeTaxa(linha: LinhaDaMudancaDeTaxa | null | undefined): UltimaMudancaDeTaxa | null {
  if (!linha) return null;
  const instante = instanteDaBase(linha.ocorridoEm);
  if (!instante) return null;
  let detalhe: Record<string, unknown> = {};
  try {
    detalhe = linha.detalheJson ? (JSON.parse(linha.detalheJson) as Record<string, unknown>) : {};
  } catch {
    return null;
  }
  const antes = taxasDe(detalhe.antes);
  const depois = taxasDe(detalhe.depois);
  if (!antes || !depois) return null;
  const perfil = typeof detalhe.perfil === "string" && detalhe.perfil.trim() ? detalhe.perfil.trim() : null;
  return {
    quando: instante.toISOString(),
    quem: linha.autorNome?.trim() || "sem nome",
    perfil,
    antes,
    depois,
  };
}
