import { unstable_cache } from "next/cache";
import {
  SEM_PARCEIROS,
  lembrarPrecoPublico,
  precoPublicoConhecido,
  precoPublicoDosCandidatos,
  type PrecoPublicoDasMudancas,
} from "./preco-publico-das-mudancas";

/**
 * O PREÇO PÚBLICO DAS MUDANÇAS, LIDO DA BASE — 11-11-2026.
 *
 * Uma ida à base por hora (cache de 1 h): os candidatos da lista das
 * mudanças, e o «desde» sai de `precoPublicoDosCandidatos`. Com o interruptor
 * da lista desligado (Configs), ou sem base, fica a referência.
 */
export const SEGUNDOS_DO_PRECO_PUBLICO = 3600;

const lerNaBase = unstable_cache(
  async (): Promise<PrecoPublicoDasMudancas> => {
    const db = await import("./db");
    if (!(await db.listaDeParceirosNasMudancasLigada())) return SEM_PARCEIROS;
    return precoPublicoDosCandidatos(await db.candidatosDaListaDasMudancas());
  },
  ["preco-publico-das-mudancas-v5"],
  { revalidate: SEGUNDOS_DO_PRECO_PUBLICO, tags: ["preco-publico-das-mudancas"] },
);

export async function precoPublicoDasMudancas(): Promise<PrecoPublicoDasMudancas> {
  try {
    const p = await lerNaBase();
    lembrarPrecoPublico(p);
    return p;
  } catch (e) {
    console.error("[preço público das mudanças] não li a base — fica o último conhecido:", e instanceof Error ? e.message : e);
    return precoPublicoConhecido();
  }
}
