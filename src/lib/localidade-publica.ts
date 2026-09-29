import { CITIES } from "./seo-data";
import { COVERED_ZONES, normalize } from "./coverage";
import { CIDADES_MUDANCAS } from "./mudancas-cidades";
import { TIPOS_DE_VIA } from "./inscricao-profissional";

/**
 * ONDE ELE ESTÁ, DITO SEM DIZER ONDE MORA.
 *
 * A «cidade» do profissional não é uma cidade: é a MORADA DA BASE, e é de
 * propósito. O painel pede-a com a lista do Google para as distâncias serem
 * medidas a partir do sítio certo — e por isso lá dentro está «R. dos Jasmins
 * 3, Amora», ou «Rua da liberdade 61». A página pública usava esse texto tal
 * como estava: no título, no JSON-LD e no corpo. Era a morada de casa de
 * alguém, indexada pelo Google, ao lado do nome dele.
 *
 * A REGRA: como cidade só se publica uma terra que CONHECEMOS. Se o texto
 * trouxer uma — «…, Amora» — é essa que se mostra; senão tenta-se a primeira
 * das zonas dele que seja uma terra conhecida; senão não se diz nada. A
 * página funciona sem cidade, e uma cidade a menos não é um problema — uma
 * morada a mais é.
 *
 * As terras conhecidas são as que o site já conhece: as cidades das páginas
 * locais (e as vizinhas que elas citam), as zonas de cobertura e as cidades
 * das mudanças. Uma lista nova escrita à mão aqui divergia das outras.
 */

/** O texto só com letras e algarismos, separados por um espaço, e com margem. */
function paraComparar(texto: string): string {
  return ` ${normalize(texto).replace(/[^a-z0-9]+/g, " ").trim()} `;
}

const CONHECIDAS: Array<{ nome: string; chave: string }> = (() => {
  const nomes = [
    ...CITIES.flatMap((c) => [c.name, ...c.nearby]),
    ...COVERED_ZONES,
    ...CIDADES_MUDANCAS.map((c) => c.nome),
  ];
  const porChave = new Map<string, string>();
  // O primeiro a aparecer fica: os nomes de CITIES vêm com os acentos certos.
  for (const nome of nomes) {
    const chave = paraComparar(nome);
    if (chave.trim() && !porChave.has(chave)) porChave.set(chave, nome);
  }
  return [...porChave].map(([chave, nome]) => ({ nome, chave }));
})();

/**
 * A terra conhecida que este texto nomeia, ou null.
 *
 * Numa morada a terra vem no fim — «Rua de Lisboa 5, Almada» é em Almada —
 * por isso ganha a que acaba mais tarde no texto. Com palavras inteiras:
 * «Amoreiras» não é a Amora.
 */
export function localidadeConhecida(texto: string | null | undefined): string | null {
  if (typeof texto !== "string" || !texto.trim()) return null;
  const alvo = paraComparar(texto);
  let melhor: { nome: string; fim: number; tamanho: number } | null = null;
  for (const l of CONHECIDAS) {
    const i = alvo.lastIndexOf(l.chave);
    if (i < 0) continue;
    const fim = i + l.chave.length;
    if (!melhor || fim > melhor.fim || (fim === melhor.fim && l.chave.length > melhor.tamanho)) {
      melhor = { nome: l.nome, fim, tamanho: l.chave.length };
    }
  }
  return melhor?.nome ?? null;
}

/** A cidade que a página pública pode mostrar — ver o topo do ficheiro. */
export function cidadePublica(
  cidade: string | null | undefined,
  zonas: readonly string[] = [],
): string | null {
  const daCidade = localidadeConhecida(cidade);
  if (daCidade) return daCidade;
  for (const z of zonas) {
    const conhecida = localidadeConhecida(z);
    if (conhecida) return conhecida;
  }
  return null;
}

/**
 * Isto é o nome de uma terra que não conhecemos, ou pode ser uma morada?
 *
 * Sem algarismos (uma porta, um lote, um código postal), sem um tipo de via à
 * cabeça, e curto. É a mesma desconfiança da inscrição, ao contrário: lá
 * recusa-se uma morada no campo do nome, aqui deixa-se de fora uma morada na
 * lista das zonas.
 */
function pareceSoUmaTerra(texto: string): boolean {
  const t = texto.trim();
  if (t.length < 2 || t.length > 40) return false;
  if (/\d/.test(t)) return false;
  if (/[<>@]/.test(t)) return false;
  return !TIPOS_DE_VIA.test(t);
}

/**
 * As zonas que a página pública pode mostrar.
 *
 * A cidade de base entra sempre nas zonas (ver `validarInscricao`), e por isso
 * a morada que estava na cidade estava também aqui, em «Onde trabalha». Uma
 * zona que nomeie uma terra conhecida mostra-se pelo nome dessa terra; uma
 * que não conhecemos mostra-se só se não parecer uma morada — há freguesias a
 * mais para as ter todas numa lista, e «Quinta do Conde» não tem nada que
 * esconder.
 */
export function zonasPublicas(zonas: readonly string[]): string[] {
  const saida: string[] = [];
  const vistas = new Set<string>();
  for (const z of zonas) {
    if (typeof z !== "string") continue;
    const publica = localidadeConhecida(z) ?? (pareceSoUmaTerra(z) ? z.trim() : null);
    if (!publica) continue;
    const chave = paraComparar(publica);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(publica);
  }
  return saida;
}
