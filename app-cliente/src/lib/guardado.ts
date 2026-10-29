import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { listaValida, type PedidoNaLista } from "./pedidos";
import { rascunhoValido, type Rascunho } from "./novo-pedido";

/**
 * O QUE FICA NUM FICHEIRO DA APP — a última lista de pedidos (para a mostrar
 * sem rede, E2) e o rascunho do novo pedido (E3, guardado a cada campo).
 *
 * Têm moradas, nomes e telefones: ficam dentro da app (o Android não os deixa
 * ler a mais ninguém, e o `allowBackup` está desligado — regra 9 da
 * Segurança) e APAGAM-SE AO SAIR da conta ou ao trocar de conta.
 */

const LISTA = "pedidos.json";
const RASCUNHO = "rascunho.json";
const CONTAGEM = "rascunhos.json";

function ficheiro(nome: string): File | null {
  if (Platform.OS === "web") return null;
  try {
    return new File(Paths.document, nome);
  } catch {
    return null;
  }
}

function escrever(nome: string, valor: unknown): void {
  const f = ficheiro(nome);
  if (!f) return;
  try {
    if (!f.exists) f.create();
    f.write(JSON.stringify(valor));
  } catch {
    /* sem espaço ou sem permissão: fica sem cópia, e é só isso */
  }
}

async function ler(nome: string): Promise<unknown> {
  const f = ficheiro(nome);
  if (!f) return null;
  try {
    if (!f.exists) return null;
    return JSON.parse(await f.text());
  } catch {
    return null;
  }
}

function apagar(nome: string): void {
  const f = ficheiro(nome);
  try {
    if (f?.exists) f.delete();
  } catch {
    /* já não estava lá */
  }
}

export function guardarLista(pedidos: PedidoNaLista[], agora = new Date()): void {
  escrever(LISTA, { pedidos, lidaEm: agora.toISOString() });
}
export async function lerListaGuardada() {
  return listaValida(await ler(LISTA));
}

export function guardarRascunho(r: Rascunho): void {
  escrever(RASCUNHO, r);
}
export async function lerRascunho(): Promise<Rascunho | null> {
  return rascunhoValido(await ler(RASCUNHO));
}
export function apagarRascunho(): void {
  apagar(RASCUNHO);
}

/** Quantos rascunhos começou desde o último envio (só um número, para a medida do E3). */
export async function rascunhosComecados(): Promise<number> {
  const v = (await ler(CONTAGEM)) as { n?: unknown } | null;
  return typeof v?.n === "number" && v.n >= 0 ? Math.floor(v.n) : 0;
}
export async function contarRascunhoNovo(): Promise<void> {
  escrever(CONTAGEM, { n: Math.min(50, (await rascunhosComecados()) + 1) });
}
export function recomecarContagem(): void {
  apagar(CONTAGEM);
}

/** Ao sair ou trocar de conta: nada da conta antiga fica no telemóvel. */
export function apagarTudoDaConta(): void {
  apagar(LISTA);
  apagar(RASCUNHO);
  apagar(CONTAGEM);
  apagar(DEPOIS_DE_ENTRAR);
}

/*
 * O CATÁLOGO (R7 v2) — público, igual para toda a gente: fica guardado para o
 * Início abrir sem rede (especificação v3, E0). Não é da conta, não se apaga
 * ao sair.
 */
const CATALOGO = "catalogo.json";
export function guardarCatalogo(c: unknown): void {
  escrever(CATALOGO, c);
}
export const lerCatalogoGuardado = () => ler(CATALOGO);

/*
 * PARA ONDE VOLTAR DEPOIS DE ENTRAR (E1 v3). O link por email abre a app pelo
 * E1a, que não sabe de onde se veio: fica aqui, no telemóvel, até se entrar.
 *   resumo  → o passo 3 do pedido (E3.F), com o rascunho inteiro;
 *   juntar  → juntar o pedido aberto pelo link (D5);
 *   pedidos → os pedidos.
 */
const DEPOIS_DE_ENTRAR = "depois-de-entrar.json";
export type DepoisDeEntrar = { para: "resumo" } | { para: "juntar"; pedidoId: number } | { para: "pedidos" };
export function guardarDepoisDeEntrar(d: DepoisDeEntrar): void {
  escrever(DEPOIS_DE_ENTRAR, d);
}
export async function lerDepoisDeEntrar(): Promise<DepoisDeEntrar | null> {
  const d = (await ler(DEPOIS_DE_ENTRAR)) as { para?: unknown; pedidoId?: unknown } | null;
  if (d?.para === "resumo" || d?.para === "pedidos") return { para: d.para };
  if (d?.para === "juntar" && typeof d.pedidoId === "number" && d.pedidoId > 0) return { para: "juntar", pedidoId: d.pedidoId };
  return null;
}
export function esquecerDepoisDeEntrar(): void {
  apagar(DEPOIS_DE_ENTRAR);
}
