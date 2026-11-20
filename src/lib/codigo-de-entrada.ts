import { createHash, createHmac, randomInt } from "node:crypto";
import * as bcrypt from "bcryptjs";

/**
 * O CÓDIGO PARA ENTRAR NO BACKOFFICE — d75, 20-11-2026.
 *
 * O backoffice deixa de pedir utilizador e palavra-passe: pede só um campo,
 * «Código para entrar». Cada pessoa tem o seu, e é o código que diz quem é —
 * o registo de quem fez cada coisa continua a funcionar como antes.
 *
 * Guarda-se de duas formas, e nenhuma deixa lê-lo:
 *
 *   · o ÍNDICE: HMAC-SHA256 do código com um segredo do servidor
 *     (`CODIGO_DE_ENTRADA_PEPPER`). É o que deixa encontrar a pessoa com uma
 *     consulta, sem percorrer os hashes um a um. Sem o segredo, a base sozinha
 *     não serve para testar códigos;
 *   · o HASH LENTO: bcrypt (custo 12), o mesmo das palavras-passe. Depois de
 *     o índice encontrar a linha, confirma-se SEMPRE por aqui.
 *
 * O bcrypt só lê os primeiros 72 bytes, e um código Unicode pode passar disso.
 * Por isso entra no bcrypt o SHA-256 do código (44 caracteres em base64) e
 * não o código cru: o código inteiro conta, até ao último carácter.
 *
 * Este ficheiro não toca na base: é a regra, o gerador e as contas. A base
 * está em `codigo-de-entrada-na-base.ts`.
 */

/** A variável de ambiente com o segredo do índice. */
export const VARIAVEL_DO_SEGREDO = "CODIGO_DE_ENTRADA_PEPPER";

/** O segredo tem de ter pelo menos isto para valer (32 bytes em hex = 64). */
const SEGREDO_MINIMO = 32;

export const CODIGO_MINIMO = 12;
/** Um tecto, para ninguém mandar um megabyte para o servidor fazer contas. */
export const CODIGO_MAXIMO = 128;

const CUSTO_DO_BCRYPT = 12;

/**
 * Como o código se lê, à entrada e ao gravar — as duas da mesma maneira.
 *
 * NFC: o mesmo «é» escrito num telemóvel e num PC pode vir em bytes
 * diferentes. Os espaços das pontas saem (copiar e colar traz-nos muitas
 * vezes); os do meio ficam, e contam.
 */
export function normalizarCodigo(bruto: unknown): string {
  if (typeof bruto !== "string") return "";
  return bruto.normalize("NFC").trim();
}

/** Quantos caracteres tem, contados como se vêem (um emoji é um, não dois). */
export function comprimentoDoCodigo(codigo: string): number {
  return Array.from(codigo).length;
}

/**
 * O que falta a este código para valer — ou null, se vale.
 *
 * Mínimo 12 caracteres, com pelo menos uma maiúscula, uma minúscula, um
 * número e um símbolo. Qualquer carácter Unicode serve, espaços no meio
 * incluídos. Símbolo é tudo o que não é letra, número nem espaço.
 *
 * O servidor chama isto SEMPRE antes de gravar: o ecrã pode mostrar a mesma
 * regra, mas não é ele quem decide.
 */
export function erroDoCodigo(bruto: unknown): string | null {
  const codigo = normalizarCodigo(bruto);
  const n = comprimentoDoCodigo(codigo);
  const faltas: string[] = [];
  if (n < CODIGO_MINIMO) faltas.push(`pelo menos ${CODIGO_MINIMO} caracteres`);
  if (!/\p{Lu}/u.test(codigo)) faltas.push("uma letra maiúscula");
  if (!/\p{Ll}/u.test(codigo)) faltas.push("uma letra minúscula");
  if (!/\p{N}/u.test(codigo)) faltas.push("um número");
  if (!/[^\p{L}\p{N}\s]/u.test(codigo)) faltas.push("um símbolo");
  if (n > CODIGO_MAXIMO) return `O código pode ter no máximo ${CODIGO_MAXIMO} caracteres.`;
  if (faltas.length === 0) return null;
  return `O código precisa de ${juntar(faltas)}.`;
}

function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/*
 * O GERADOR. Sem os caracteres que se confundem ao ditar ou ao ler num ecrã
 * pequeno (0/O, 1/l/I), e com símbolos que qualquer teclado tem.
 */
const MAIUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz";
const NUMEROS = "23456789";
const SIMBOLOS = "!#%+=?@*-_";
const TODOS = MAIUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS;

/** Comprimento do código gerado: ~120 bits, muito acima do que se adivinha. */
export const COMPRIMENTO_GERADO = 20;

/** Um código forte e aleatório (crypto.randomInt), com as quatro classes garantidas. */
export function gerarCodigo(comprimento = COMPRIMENTO_GERADO): string {
  const n = Math.max(comprimento, CODIGO_MINIMO);
  const letras = [
    MAIUSCULAS[randomInt(MAIUSCULAS.length)],
    MINUSCULAS[randomInt(MINUSCULAS.length)],
    NUMEROS[randomInt(NUMEROS.length)],
    SIMBOLOS[randomInt(SIMBOLOS.length)],
  ];
  while (letras.length < n) letras.push(TODOS[randomInt(TODOS.length)]);
  // Baralhar (Fisher–Yates), para as quatro garantidas não ficarem sempre à frente.
  for (let i = letras.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [letras[i], letras[j]] = [letras[j], letras[i]];
  }
  return letras.join("");
}

/**
 * O segredo do índice, ou null se não estiver posto (ou for curto demais).
 *
 * Sem ele, a entrada por código FALHA FECHADA: não se entra, e também não se
 * gravam códigos — um índice feito sem segredo seria um SHA-256 simples, que
 * se testa à força a partir de uma cópia da base.
 */
export function segredoDoIndice(env: Record<string, string | undefined> = process.env): string | null {
  const s = env[VARIAVEL_DO_SEGREDO];
  if (typeof s !== "string" || s.trim().length < SEGREDO_MINIMO) return null;
  return s.trim();
}

/** O índice do código: HMAC-SHA256 com o segredo, em hex (64 caracteres). */
export function indiceDoCodigo(codigo: string, segredo: string): string {
  return createHmac("sha256", segredo).update(normalizarCodigo(codigo), "utf8").digest("hex");
}

/** O que entra no bcrypt: o SHA-256 do código, em base64 (cabe nos 72 bytes). */
function entradaDoBcrypt(codigo: string): string {
  return createHash("sha256").update(normalizarCodigo(codigo), "utf8").digest("base64");
}

export function hashDoCodigo(codigo: string): Promise<string> {
  return bcrypt.hash(entradaDoBcrypt(codigo), CUSTO_DO_BCRYPT);
}

const HASH_BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/*
 * UM HASH QUE NÃO É DE NINGUÉM, para comparar quando o índice não encontra
 * linha nenhuma. Assim um código errado custa o mesmo bcrypt que um certo, e
 * o tempo de resposta não diz se o índice bateu.
 */
let hashFicticio: Promise<string> | null = null;
function hashQueNaoEDeNinguem(): Promise<string> {
  if (!hashFicticio) hashFicticio = bcrypt.hash(gerarCodigo(32), CUSTO_DO_BCRYPT);
  return hashFicticio;
}

/**
 * Confirma o código contra o hash guardado. Sem hash (o índice não bateu),
 * compara com um hash fictício e devolve false — mas gasta o mesmo tempo.
 */
export async function codigoConfere(codigo: string, hashGuardado: string | null | undefined): Promise<boolean> {
  const valido = typeof hashGuardado === "string" && HASH_BCRYPT.test(hashGuardado);
  const alvo = valido ? hashGuardado : await hashQueNaoEDeNinguem();
  let confere = false;
  try {
    confere = await bcrypt.compare(entradaDoBcrypt(codigo), alvo);
  } catch {
    confere = false;
  }
  return valido && confere;
}

/**
 * O TEMPO DA RESPOSTA, IGUAL PARA CERTOS E ERRADOS.
 *
 * O bcrypt já iguala a comparação. O que vem depois não: um código certo
 * ainda assina o token e grava a entrada. Por isso a resposta nunca sai antes
 * deste tempo desde que o pedido chegou — certo ou errado, demora o mesmo.
 */
export const TEMPO_MINIMO_DA_RESPOSTA_MS = 1200;

export async function esperarAte(inicio: number, minimoMs = TEMPO_MINIMO_DA_RESPOSTA_MS): Promise<void> {
  const falta = inicio + minimoMs - Date.now();
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
}

/** A mensagem de qualquer código que não entra — a mesma para todos os motivos. */
export const CODIGO_INVALIDO = "Código inválido.";
