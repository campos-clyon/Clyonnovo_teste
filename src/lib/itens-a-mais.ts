import { notaDaCargaParaOCliente, type BaseDoPreco } from "./base-do-preco";
import type { ValorDaBase } from "./frase-da-base";
import { PECAS_EM_TEXTO, PRECO_DA_PRIMEIRA_GRANDE, PRECO_POR_ITEM } from "./precos-publicos";
import { extraNoLocal, INCLUI } from "./extra-no-local";
import { TAXA_IVA } from "./taxas-plataforma";

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

/*
 * O que vale cada coisa que aparece a mais.
 *
 * Era um valor só, 32 € + IVA por item (14-09 e 22-10-2026), dito a partir dos
 * encargos de mover mais um objecto — "combustível, desgaste do veículo, IUC,
 * inspecção, ajudante, comissão da CLYON".
 *
 * PELA TABELA DAS PEÇAS DESDE 04-11-2026 (decisão d7, o dono): a Vendas viu que
 * os 32 € chocavam com os preços por peça da recolha de móveis. Cada item a
 * mais conta como uma peça da tabela (`PRECO_POR_ITEM`): pequena 15 €, média
 * 30 €, grande 50 € + IVA. Sem tamanho dito, conta a peça média.
 *
 * SEM IVA. Ao cliente diz-se com o IVA ao lado, como todos os valores: nunca o
 * sem IVA sozinho.
 */
export type TamanhoDoItemAMais = keyof typeof PRECO_POR_ITEM;

/** Sem tamanho dito, um item a mais conta como uma peça média (d7). */
export const TAMANHO_SEM_TAMANHO_DITO: TamanhoDoItemAMais = "medio";

/** O valor de um item a mais sem tamanho dito, sem IVA — a peça média (30 €). */
export const ACRESCIMO_POR_ITEM_SEM_TAMANHO = PRECO_POR_ITEM[TAMANHO_SEM_TAMANHO_DITO];

/** «18,45 / 36,90 / 79,95 e 61,50 €» — o com IVA de cada peça (a primeira grande e as seguintes, d60). */
const comIvaEmTexto = (v: number) => (Math.round(v * (1 + TAXA_IVA) * 100) / 100).toFixed(2).replace(".", ",");
const PECAS_COM_IVA_EM_TEXTO =
  `${[PRECO_POR_ITEM.pequeno, PRECO_POR_ITEM.medio, PRECO_DA_PRIMEIRA_GRANDE].map(comIvaEmTexto).join(" / ")} e ${comIvaEmTexto(PRECO_POR_ITEM.grande)} €`;

/*
 * A TABELA DOS ITENS A MAIS É A TABELA DA D60 — 17-11-2026 (d62/d63). Dizia só
 * «grande 50 €», o preço de antes da d60; passa a dizer a tabela inteira pela
 * fonte única (`PECAS_EM_TEXTO`): a primeira grande 65 € e as seguintes 50 €,
 * como o aviso ao profissional (`avisoDosItens`). A conta (`acrescimoPorItens`)
 * não muda aqui.
 */

/** «pequena 15 €, média 30 €, grande 65 € a primeira e 50 € as seguintes + IVA» — a tabela dos itens a mais, para quem faz o trabalho. */
export const TABELA_DOS_ITENS_A_MAIS = `${PECAS_EM_TEXTO} + IVA`;

/**
 * «cada item a mais conta pela tabela das peças: pequena 15 €, média 30 €,
 * grande 65 € a primeira e 50 € as seguintes + IVA (18,45 / 36,90 / 79,95 e
 * 61,50 € com IVA)» — como o cliente o lê.
 */
export const ITENS_A_MAIS_PARA_O_CLIENTE = `cada item a mais conta pela tabela das peças: ${TABELA_DOS_ITENS_A_MAIS} (${PECAS_COM_IVA_EM_TEXTO} com IVA)`;

/** O acréscimo aplica-se a este orçamento? */
export function haAcrescimoPorItem(base: BaseDoPreco): boolean {
  // Por carga ou por hora, o que aparecer a mais já se paga na unidade — 13-10-2026.
  return base === "total";
}

/**
 * Quanto acrescem N itens a mais deste tamanho, sem IVA — pela tabela das
 * peças; sem tamanho, a peça média (d7).
 *
 * Zero ou menos é zero: um orçamento não desce por terem aparecido menos
 * coisas do que as descritas — isso combina-se, e é outra conversa.
 */
export function acrescimoPorItens(itens: number, tamanho: TamanhoDoItemAMais = TAMANHO_SEM_TAMANHO_DITO): number {
  if (!Number.isFinite(itens) || itens <= 0) return 0;
  return Math.floor(itens) * PRECO_POR_ITEM[tamanho];
}

/**
 * "2 itens a mais — 60,00 €", para pôr à frente de quem decide.
 *
 * O plural é «itens» e não «items»: a palavra é portuguesa e faz o plural em
 * -ns, como «hífen» e «abdómen». Escrito à mão como `item + "s"`, sai inglês.
 */
export function acrescimoPorExtenso(itens: number, tamanho: TamanhoDoItemAMais = TAMANHO_SEM_TAMANHO_DITO): string {
  const n = Math.max(0, Math.floor(Number.isFinite(itens) ? itens : 0));
  const valor = acrescimoPorItens(n, tamanho);
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
export function avisoDosItens(
  base: BaseDoPreco,
  quem: "cliente" | "profissional",
  servico?: string | null,
): string | null {
  if (!haAcrescimoPorItem(base)) return null;
  /*
   * AO CLIENTE, CURTO E IGUAL EM TODO O LADO — 15-11-2026 (d47): «Inclui o que
   * está nas fotografias e na descrição.» e o extra com o preço da regra do
   * serviço (a tabela das peças nas recolhas de móveis e de monos, os sacos no
   * entulho, as horas na mudança, o volume no esvaziamento). Ver
   * `mensagem-do-orcamento.ts`.
   */
  // Sem serviço passado (undefined), a regra de sempre: a tabela das peças; com null, nenhum serviço (d20).
  if (quem === "cliente") return `${INCLUI} ${extraNoLocal(servico === undefined ? "recolha_moveis" : servico, base)}`;
  // Ao profissional, a tabela da d60 pela fonte única (d62/d63, 17-11-2026): dizia «grande 50 €».
  return `A sua proposta cobre o que está nas fotografias e na descrição. Cada item que apareça a mais no ` +
        `local conta pela tabela das peças (${PECAS_EM_TEXTO} + IVA) — combine-o com o cliente antes de carregar.`;
}

/**
 * O QUE O CLIENTE TEM DE LER AO LADO DE UM PREÇO, em qualquer mensagem — 22-10-2026.
 *
 * *«A criação de pedidos, tanto nos Trabalhos CLYON quanto nas negociações,
 * deve sempre ter a opção de marcar se é valor total ou valor por carga. E
 * as mensagens que são enviadas para o cliente têm de deixar claro que o
 * valor é por carga.»* E: *«Caso seja valor total, a mensagem também tem de
 * deixar claro que, se o cliente tiver itens de que não enviou imagens, que
 * não estavam no orçamento, são 32 € por item a mais.»* — o dono, 22-10-2026.
 *
 * Por carga ou por hora, a unidade (`notaDaCargaParaOCliente`); pelo trabalho
 * todo, os itens a mais pela tabela das peças (`avisoDosItens`; eram 32 € por
 * item até à d7, 04-11-2026). Nunca nada: um preço sem
 * isto ao lado é a discussão cara de `base-do-preco.ts`.
 *
 * Num Trabalho CLYON o cliente fala com a CLYON, e não com o profissional:
 * as cargas confirmam-se connosco.
 */
export function notaDoPrecoParaOCliente(
  base: BaseDoPreco,
  comQuem: "profissional" | "clyon" = "profissional",
  /** O serviço do pedido (o id). Dito, a tabela das peças só sai na recolha de móveis (d20). */
  servico?: string | null,
  /** d63: o valor (por carga ou por hora), para a frase dizer o número e o exemplo. */
  valor: ValorDaBase = {},
): string {
  /*
   * d63 (18-11-2026): por carga ou por hora, a frase única da base
   * (`frase-da-base.ts`) — a mesma com a CLYON e com o parceiro: as cargas
   * confirmam-se no local, pela equipa, antes de começar. Com o valor, o exemplo.
   */
  void comQuem;
  return notaDaCargaParaOCliente(base, valor) ?? (avisoDosItens(base, "cliente", servico) as string);
}

/*
 * A TABELA DAS PEÇAS É DA RECOLHA DE MÓVEIS — 05-11-2026 (decisão d20).
 *
 * No #524, uma mudança de valor fixo, a cliente lia «cada item a mais conta
 * pela tabela das peças (15/30/50 €)» — uma regra da recolha de móveis por
 * peça, que numa mudança não diz nada. Com o serviço dito, a tabela só sai na
 * recolha de móveis; nos outros serviços fica a nota do serviço. Sem serviço
 * dito (`undefined`), fica como estava: as mensagens antigas não mudam aqui.
 */
export const SERVICOS_PELA_TABELA_DAS_PECAS: readonly string[] = ["recolha_moveis"];

export function contaPelaTabelaDasPecas(servico: string | null | undefined): boolean {
  return typeof servico === "string" && SERVICOS_PELA_TABELA_DAS_PECAS.includes(servico);
}

/** A nota de um preço pelo trabalho todo, num serviço que não se conta por peça. */
export function notaDoServicoParaOCliente(servico: string | null | undefined): string {
  // d47: a mesma frase de todas as mensagens.
  return `${INCLUI} ${extraNoLocal(servico ?? null, "total")}`;
}
