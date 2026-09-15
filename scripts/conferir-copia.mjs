/**
 * CONFERIR UMA CÓPIA DE SEGURANÇA — contar o que lá está dentro.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Uma cópia vale o que uma verificação disser que ela vale. Um ficheiro de 14 MB
 * com os CREATE TABLE todos e zero linhas tem o tamanho de uma cópia a sério e
 * não serve para nada — e essa é exactamente a maneira como isto corre mal sem
 * ninguém dar por ela.
 *
 * Isto lê o .sql e CONTA os registos de cada tabela, a sério: percorre o texto
 * a saber quando está dentro de uma string, para um apóstrofo num nome ou uma
 * mudança de linha dentro da descrição de um pedido não desalinharem a conta.
 * Contar linhas com `grep -c` daria um número errado, e um número errado aqui é
 * pior do que nenhum.
 *
 * NÃO IMPRIME NADA DO CONTEÚDO. Só nomes de tabelas e números — pode correr e
 * mostrar o resultado a quem for preciso sem expor os dados de ninguém.
 *
 * Uso:
 *   node scripts/conferir-copia.mjs "C:/.../copia-clyon-2026-09-15-1350.sql"
 *
 * Sai com código 1 se a cópia estiver truncada ou sem as tabelas essenciais —
 * para poder travar um script que arme a purga a seguir.
 */

import { readFileSync } from "node:fs";

const caminho = process.argv[2];
if (!caminho) {
  console.error('Uso: node scripts/conferir-copia.mjs "caminho/para/copia.sql"');
  process.exit(1);
}

/**
 * Sem estas, a cópia não serve para repor o que a purga apaga.
 *
 * `simulatorOrders` e `negociacoes` são o que a purga toca; `providers` e
 * `levantamentos` são o dinheiro dos profissionais; `registoPermanente` é o
 * histórico para um processo judicial.
 */
const ESSENCIAIS = [
  "simulatorOrders",
  "negociacoes",
  "providers",
  "levantamentos",
  "registoPermanente",
  "users",
];

const texto = readFileSync(caminho, "utf8");

/*
 * A cópia acabou de ser escrita?
 *
 * O script escreve esta linha no fim, depois de tudo. Se ela não estiver lá, o
 * processo foi cortado a meio — e as últimas tabelas, que podem ser as que
 * interessam, ficaram por escrever.
 */
const completa = texto.trimEnd().endsWith("SET FOREIGN_KEY_CHECKS = 1;");

const tabelas = new Map();
let dentroDeString = false;
let aContar = null;
let profundidade = 0;

for (let i = 0; i < texto.length; i += 1) {
  const c = texto[i];

  if (dentroDeString) {
    // A barra invertida engole o caracter seguinte — incluindo um apóstrofo.
    if (c === "\\") { i += 1; continue; }
    if (c === "'") dentroDeString = false;
    continue;
  }

  if (c === "'") { dentroDeString = true; continue; }

  if (c === "(") {
    profundidade += 1;
    // Só os parênteses de primeiro nível de um INSERT são registos. Os de
    // dentro (uma função, um tipo de coluna) não contam, e os do CREATE TABLE
    // também não — aí `aContar` é nulo.
    if (aContar && profundidade === 1) tabelas.set(aContar, (tabelas.get(aContar) ?? 0) + 1);
    continue;
  }
  if (c === ")") { profundidade -= 1; continue; }
  if (c === ";" && profundidade === 0) { aContar = null; continue; }

  if (c === "I" && texto.startsWith("INSERT INTO `", i)) {
    const fim = texto.indexOf("`", i + 13);
    if (fim > -1) {
      const nome = texto.slice(i + 13, fim);
      if (!tabelas.has(nome)) tabelas.set(nome, 0);
      /*
       * A lista de COLUNAS vem a seguir, entre parênteses, e seria contada
       * como se fosse um registo. Salta-se até ao VALUES.
       */
      const values = texto.indexOf(" VALUES", fim);
      if (values > -1) {
        aContar = nome;
        i = values + 6;
        continue;
      }
    }
  }
}

// As tabelas vazias também aparecem no ficheiro, com CREATE TABLE e sem INSERT.
for (const m of texto.matchAll(/CREATE TABLE `([^`]+)`/g)) {
  if (!tabelas.has(m[1])) tabelas.set(m[1], 0);
}

const nomes = [...tabelas.keys()].sort((a, b) => a.localeCompare(b));
const maisLongo = Math.max(...nomes.map((n) => n.length));
let total = 0;
for (const n of nomes) {
  const q = tabelas.get(n);
  total += q;
  console.log(`  ${n.padEnd(maisLongo)}  ${q === 0 ? "vazia" : `${q} registo(s)`}`);
}

console.log(`\n${nomes.length} tabela(s), ${total} registo(s).`);
console.log(completa ? "A cópia está completa (chega ao fim)." : "⚠️ A cópia parece TRUNCADA — falta a linha final.");

const emFalta = ESSENCIAIS.filter((t) => !tabelas.get(t));
if (emFalta.length > 0) {
  console.error(`\n❌ SEM REGISTOS NAS TABELAS ESSENCIAIS: ${emFalta.join(", ")}.`);
  console.error("Esta cópia NÃO serve para repor o que a purga apaga. Não arme nada.");
  process.exit(1);
}
if (!completa) {
  console.error("\n❌ Cópia truncada. Volte a correr o script da cópia.");
  process.exit(1);
}
console.log("\n✅ Serve. Tem as tabelas essenciais com registos e chega ao fim.");
