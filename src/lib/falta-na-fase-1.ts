/**
 * O QUE FALTA NO PASSO 1 DO SIMULADOR — 11-11-2026.
 *
 * O «Seguinte» do passo 1 ficava cinzento sem dizer porquê: pedia uma
 * descrição ou uma fotografia a quem escolhia móveis por peça (as peças já
 * dizem tudo), a quem pedia uma mudança (a tipologia vem no passo seguinte) —
 * e o campo da descrição dizia «Opcional». Um botão desligado sem explicação
 * é um beco; a regra passa a viver aqui, numa lista que o ecrã mostra
 * («Falta preencher: …»), como no passo 3.
 *
 * Lista vazia = pode avançar.
 */

export interface DadosDaFase1 {
  serviceType?: string | null;
  description?: string;
  files?: unknown[];
  entulhoState?: string;
  entulhoQuantidade?: string;
  entulhoQuantidadeIncerta?: boolean;
  volumeTier?: string;
  quantityExact?: string;
  acessoDoEspaco?: string;
  movelMode?: "carga" | "item";
  movelItemsPequeno?: number;
  movelItemsMedio?: number;
  movelItemsGrande?: number;
}

/** O texto do que falta quando só a descrição (ou uma fotografia) segura o passo. */
export const FALTA_A_DESCRICAO = "uma descrição do que precisa (ou uma fotografia)";

const ESPACOS = new Set(["esvaziamento_garagem", "esvaziamento_sotao", "esvaziamento_cave"]);

export function pecasDosMoveis(d: DadosDaFase1): number {
  return (d.movelItemsPequeno ?? 0) + (d.movelItemsMedio ?? 0) + (d.movelItemsGrande ?? 0);
}

export function faltaNaFase1(d: DadosDaFase1): string[] {
  if (!d.serviceType) return ["o serviço"];

  if (d.serviceType === "recolha_entulho") {
    const falta: string[] = [];
    if (!d.entulhoState) falta.push("como está o entulho");
    if (!d.entulhoQuantidade && !d.entulhoQuantidadeIncerta) falta.push("a quantidade");
    return falta;
  }

  // A mudança diz o resto (tipologia, moradas, acessos) nos passos seguintes.
  if (d.serviceType === "mudanca") return [];

  if (ESPACOS.has(d.serviceType)) {
    const falta: string[] = [];
    if (!d.volumeTier) falta.push("a quantidade");
    if (!d.acessoDoEspaco) falta.push("o acesso");
    return falta;
  }

  // Móveis por peça: as peças contadas chegam.
  if (d.serviceType === "recolha_moveis" && d.movelMode === "item") {
    return pecasDosMoveis(d) > 0 ? [] : ["as peças (quantas pequenas, médias ou grandes)"];
  }

  const temDescricao = !!d.description?.trim();
  const temFicheiros = (d.files ?? []).length > 0;
  return temDescricao || temFicheiros ? [] : [FALTA_A_DESCRICAO];
}

/** A linha das peças que vai na descrição, como a do modo por volume. */
export function linhaDasPecas(pequeno: number, medio: number, grande: number): string {
  const partes: string[] = [];
  if (pequeno > 0) partes.push(`${pequeno} ${pequeno === 1 ? "pequena" : "pequenas"}`);
  if (medio > 0) partes.push(`${medio} ${medio === 1 ? "média" : "médias"}`);
  if (grande > 0) partes.push(`${grande} ${grande === 1 ? "grande" : "grandes"}`);
  return partes.length ? `Peças: ${partes.join(", ")}.` : "";
}

/** Põe (ou tira) a linha das peças no início da descrição, sem mexer no resto. */
export function comLinhaDasPecas(descricao: string | undefined, linha: string): string {
  const resto = (descricao ?? "").replace(/^Peças:.*\n?/, "");
  return [linha, resto].filter(Boolean).join("\n").trim();
}
