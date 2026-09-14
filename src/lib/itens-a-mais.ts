import type { BaseDoPreco } from "@/lib/base-do-preco";

/**
 * O QUE ACONTECE QUANDO APARECEM COISAS A MAIS.
 *
 * "Nestes casos o cliente diz sempre que são só 2 sacos, mas depois aparecem
 * mais coisas." — um profissional, 14-09-2026. E a seguir, o caso concreto:
 * "Aconteceu agora com o Louis em Lisboa. Além do colchão apareceram mais 4
 * almofadas."
 *
 * O orçamento é dado à distância, sobre fotografias e uma descrição. É o
 * método certo — poupa uma deslocação a cada orçamento — mas tem um buraco por
 * baixo: quem descreve é quem paga, e a lista encolhe sem má intenção nenhuma.
 * O profissional chega, encontra mais, e fica com três saídas más: fazer de
 * graça, discutir à porta, ou ir-se embora.
 *
 * "Caso o cliente tenha mais coisas deve ter um acréscimo de 32 euros por item
 * adicionado a mais." — 14-09-2026.
 *
 * NÃO É UMA TAXA DA CASA. A CLYON não cobra isto nem o recebe: é o preço do
 * trabalho a mais, e vai inteiro para quem o faz. Por isso vive aqui e não em
 * `taxas-plataforma.ts`, que é o ficheiro do que a plataforma leva.
 *
 * NÃO SE APLICA AO PREÇO POR CARGA, e é a única excepção. Um valor por carga
 * já mede quantidade: se aparecer mais coisa, faz-se outra carga e cobra-se
 * outra carga. Somar-lhe 32 € por item seria cobrar a mesma quantidade duas
 * vezes.
 *
 * O QUE ISTO NÃO É: não é uma autorização para cobrar mais sozinho. É a regra
 * escrita à frente dos dois ANTES de fecharem, para que no dia não seja uma
 * surpresa — o acréscimo continua a combinar-se com o cliente antes de o
 * trabalho avançar. Ver `docs/plano-ajuste-no-local.md`.
 */

/**
 * O que vale cada coisa que aparece a mais.
 *
 * Não sai de uma margem: sai dos encargos de mover mais um objecto, ditos por
 * quem os paga — "combustível, desgaste do veículo, IUC, inspecção, ajudante,
 * comissão da CLYON".
 */
export const ACRESCIMO_POR_ITEM_EXTRA = 32;

/** O acréscimo aplica-se a este orçamento? */
export function haAcrescimoPorItem(base: BaseDoPreco): boolean {
  return base !== "carga";
}

/**
 * Quanto acrescem N itens a mais.
 *
 * Zero ou menos é zero: um orçamento não desce por terem aparecido menos
 * coisas do que as descritas — isso combina-se, e é outra conversa.
 */
export function acrescimoPorItens(itens: number): number {
  if (!Number.isFinite(itens) || itens <= 0) return 0;
  return Math.floor(itens) * ACRESCIMO_POR_ITEM_EXTRA;
}

/**
 * "2 itens a mais — 64 €", para pôr à frente de quem decide.
 *
 * O plural é «itens» e não «items»: a palavra é portuguesa e faz o plural em
 * -ns, como «hífen» e «abdómen». Escrito à mão como `item + "s"`, sai inglês.
 */
export function acrescimoPorExtenso(itens: number): string {
  const n = Math.max(0, Math.floor(Number.isFinite(itens) ? itens : 0));
  const valor = acrescimoPorItens(n);
  return `${n} ${n === 1 ? "item" : "itens"} a mais — ${valor.toFixed(2).replace(".", ",")} €`;
}

/**
 * O aviso, escrito para quem o lê.
 *
 * São duas frases diferentes porque são dois interesses diferentes: um está a
 * decidir se paga, o outro está a decidir se vai. Dizer o mesmo aos dois
 * obrigava a escrever uma frase sem dono, e uma frase sem dono não protege
 * ninguém.
 *
 * Devolve `null` no preço por carga — ver a nota do módulo. Dizer o que não se
 * aplica é ruído, e ruído em todos os cartões deixa de se ler.
 */
export function avisoDosItens(base: BaseDoPreco, quem: "cliente" | "profissional"): string | null {
  if (!haAcrescimoPorItem(base)) return null;
  return quem === "cliente"
    ? `Este valor cobre o que está nas fotografias e na descrição. Se no dia aparecerem mais coisas, ` +
        `cada item a mais acresce ${ACRESCIMO_POR_ITEM_EXTRA} € — combinado consigo antes de o trabalho avançar.`
    : `A sua proposta cobre o que está nas fotografias e na descrição. Cada item que apareça a mais no ` +
        `local vale ${ACRESCIMO_POR_ITEM_EXTRA} € — combine-o com o cliente antes de carregar.`;
}
