import type { Morada } from "./novo-pedido";

/**
 * «É NESTA MORADA?» — o 1.º ecrã do Pedir (ordem do CEO com o sim do dono,
 * 02-11-2026). Com sessão, a app junta a morada da conta (a do Perfil) e as
 * dos últimos pedidos, sem repetir, até 3; o ecrã abre com a primeira já
 * escolhida e «Outra morada» abre a procura de sempre. Sem sessão ou sem
 * nenhuma, o ecrã fica como estava.
 *
 * Uma morada nova num pedido NÃO vai para a conta: só a do Perfil é da conta.
 * Aqui só há funções puras (os testes lêem-nas); quem lê a conta e os pedidos
 * é `lerMoradasParaOPedido` em morada-do-cliente.ts.
 */
export const MAXIMO_DE_MORADAS = 3;

/** Os campos da conta (`GET /api/users/me`). */
export type MoradaDaContaCrua = {
  addressLine?: string | null;
  addressNumber?: string | null;
  postalCode?: string | null;
  addressCity?: string | null;
};

const limpo = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** A chave para não repetir: sem acentos, maiúsculas, pontuação nem espaços a mais. */
export function chaveDaMorada(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A morada do Perfil numa linha: a rua, e o número, o código postal e a localidade que ainda não estejam nela. */
export function moradaDaConta(u: MoradaDaContaCrua | null | undefined): Morada | null {
  const linha = limpo(u?.addressLine);
  if (!linha) return null;
  const chave = chaveDaMorada(linha);
  const falta = (v: string) => v && !chave.includes(chaveDaMorada(v));
  const numero = limpo(u?.addressNumber);
  const codigo = limpo(u?.postalCode);
  const cidade = limpo(u?.addressCity);
  let texto = linha;
  if (falta(numero)) texto += ` ${numero}`;
  const resto = [codigo, cidade].filter(falta).join(" ");
  if (resto) texto += `, ${resto}`;
  return {
    formattedAddress: texto,
    postalCode: codigo || undefined,
    city: cidade || undefined,
    aMao: true,
  };
}

/** A morada de um pedido anterior (R5: `pedido.morada` e `pedido.cidade`). */
export function moradaDoPedido(p: { morada?: string | null; cidade?: string | null } | null | undefined): Morada | null {
  const texto = limpo(p?.morada);
  if (!texto) return null;
  const cidade = limpo(p?.cidade);
  return { formattedAddress: texto, city: cidade || undefined, aMao: true };
}

/** Junta pela ordem dada (a conta primeiro), sem repetir, até 3. A primeira de cada repetida fica. */
export function juntarMoradas(lista: ReadonlyArray<Morada | null | undefined>, maximo = MAXIMO_DE_MORADAS): Morada[] {
  const vistas = new Set<string>();
  const fora: Morada[] = [];
  for (const m of lista) {
    const texto = limpo(m?.formattedAddress);
    if (!m || !texto) continue;
    const chave = chaveDaMorada(texto);
    if (!chave || vistas.has(chave)) continue;
    vistas.add(chave);
    fora.push(m);
    if (fora.length >= maximo) break;
  }
  return fora;
}

/** Os pedidos de onde se lêem as moradas: os mais recentes (n.º maior primeiro), até 3. */
export function pedidosParaAsMoradas(ids: ReadonlyArray<number>, maximo = MAXIMO_DE_MORADAS): number[] {
  return [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => b - a).slice(0, maximo);
}

/** Qual das moradas guardadas é a do rascunho (-1 se nenhuma). */
export function indiceDaMorada(moradas: ReadonlyArray<Morada>, m: Morada | undefined | null): number {
  if (!m?.formattedAddress) return -1;
  const chave = chaveDaMorada(m.formattedAddress);
  return moradas.findIndex((x) => chaveDaMorada(x.formattedAddress) === chave);
}

/**
 * O ecrã abre a escolher quando há moradas guardadas, ele não pediu «Outra
 * morada», e o rascunho está sem morada ou com uma delas.
 */
export function abreAEscolher(moradas: ReadonlyArray<Morada>, m: Morada | undefined | null, outraMorada: boolean): boolean {
  if (moradas.length === 0 || outraMorada) return false;
  return !m?.formattedAddress?.trim() || indiceDaMorada(moradas, m) >= 0;
}

/** A pergunta do ecrã a escolher (a mudança pergunta de onde sai). */
export function perguntaDaEscolha(quantas: number, mudanca: boolean): string {
  if (mudanca) return quantas > 1 ? "De que morada sai a mudança?" : "A mudança sai desta morada?";
  return quantas > 1 ? "Em que morada é?" : "É nesta morada?";
}

/** O botão de baixo: «Sim, é esta» com uma só; «Continuar» quando escolhe entre várias. */
export function botaoDaEscolha(quantas: number): string {
  return quantas > 1 ? "Continuar" : "Sim, é esta";
}

export const OUTRA_MORADA = "Outra morada";
export const USAR_UMA_GUARDADA = "Usar uma das minhas moradas";
