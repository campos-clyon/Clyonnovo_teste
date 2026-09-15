/**
 * UMA CÓPIA DE SEGURANÇA DA BASE, PARA UM FICHEIRO .sql.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PORQUE É QUE ISTO EXISTE (15-09-2026)
 *
 * A purga dos pedidos está travada em modo seco à espera de uma coisa só:
 * alguém confirmar que há de onde recuperar se ela correr mal. E não há — o
 * Railway só faz cópias no plano Pro, e a conta não está nele. Sem cópia, armar
 * uma purga diária e irreversível é apostar que o código não tem um erro.
 *
 * Isto não substitui cópias automáticas. É o mínimo para poder armar: uma
 * cópia feita à mão, guardada fora do Railway, na véspera da primeira passagem
 * a sério.
 *
 * ⚠️ O FICHEIRO QUE ISTO PRODUZ TEM OS DADOS DE TODA A GENTE — nomes, moradas,
 * telefones, IBANs. Guarde-o num sítio seguro, não o deixe na pasta das
 * transferências, e apague-o quando já não fizer falta. Uma cópia de segurança
 * é um motivo legítimo para ter estes dados; uma cópia esquecida no ambiente de
 * trabalho não é.
 *
 * COMO SE USA
 *
 *   DATABASE_URL="mysql://..." node scripts/copia-de-seguranca.mjs
 *
 * O URL está no Railway: serviço MySQL → Variables → MYSQL_PUBLIC_URL (o
 * público, não o interno — o interno só funciona de dentro do Railway).
 *
 * Grava `copia-clyon-<data>.sql` na pasta onde correr, ou onde disser:
 *
 *   DESTINO=D:/copias node scripts/copia-de-seguranca.mjs
 *
 * COMO SE VOLTA ATRÁS
 *
 *   mysql -h <host> -P <porta> -u <utilizador> -p <base> < copia-clyon-<data>.sql
 *
 * ou, sem o cliente do MySQL instalado, abrindo o ficheiro num DBeaver/HeidiSQL
 * ligado à base e mandando executar.
 */

import mysql from "mysql2/promise";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    'DATABASE_URL não definido.\n' +
      'Use: DATABASE_URL="mysql://utilizador:senha@host:porta/base" node scripts/copia-de-seguranca.mjs',
  );
  process.exit(1);
}

/** Quantas linhas por INSERT. Poucas faz um ficheiro enorme; muitas estoiram o max_allowed_packet. */
const LINHAS_POR_INSERT = 200;

const destino = process.env.DESTINO || process.cwd();
const agora = new Date();
const carimbo =
  `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}` +
  `-${String(agora.getHours()).padStart(2, "0")}${String(agora.getMinutes()).padStart(2, "0")}`;
const ficheiro = join(destino, `copia-clyon-${carimbo}.sql`);

async function correr() {
  mkdirSync(destino, { recursive: true });

  const ligacao = await mysql.createConnection({
    uri: DATABASE_URL,
    /*
     * As datas vêm como TEXTO, tal como estão gravadas.
     *
     * Sem isto o driver converte-as para objectos Date na hora local da
     * máquina, e o `escape` volta a escrevê-las noutra hora. Uma cópia que
     * desloca todas as datas duas horas é pior do que nenhuma: parece boa.
     */
    dateStrings: true,
    // Uma cópia de segurança lê a base inteira; o tempo por omissão não chega.
    connectTimeout: 60_000,
  });

  const saida = createWriteStream(ficheiro, { encoding: "utf8" });
  const escrever = (t) =>
    new Promise((ok, falha) => saida.write(t, (e) => (e ? falha(e) : ok())));

  const [tabelas] = await ligacao.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const nomes = tabelas.map((linha) => Object.values(linha)[0]);
  console.log(`${nomes.length} tabela(s) a copiar para ${ficheiro}`);

  await escrever(
    `-- Cópia de segurança da base da CLYON\n` +
      `-- Feita em ${agora.toISOString()}\n` +
      `-- ATENÇÃO: contém dados pessoais. Guarde em local seguro e apague quando não fizer falta.\n\n` +
      `SET FOREIGN_KEY_CHECKS = 0;\n` +
      `SET NAMES utf8mb4;\n\n`,
  );

  let totalLinhas = 0;
  for (const tabela of nomes) {
    const [criar] = await ligacao.query(`SHOW CREATE TABLE \`${tabela}\``);
    const sqlDaTabela = criar[0]["Create Table"];
    await escrever(
      `-- ─── ${tabela} ───────────────────────────────────────────────\n` +
        `DROP TABLE IF EXISTS \`${tabela}\`;\n${sqlDaTabela};\n\n`,
    );

    const [linhas] = await ligacao.query(`SELECT * FROM \`${tabela}\``);
    if (linhas.length === 0) {
      console.log(`  ${tabela}: vazia`);
      continue;
    }

    const colunas = Object.keys(linhas[0]);
    const nomesDasColunas = colunas.map((c) => `\`${c}\``).join(", ");
    for (let i = 0; i < linhas.length; i += LINHAS_POR_INSERT) {
      const lote = linhas.slice(i, i + LINHAS_POR_INSERT);
      const valores = lote
        .map((l) => `(${colunas.map((c) => mysql.escape(l[c])).join(", ")})`)
        .join(",\n  ");
      await escrever(`INSERT INTO \`${tabela}\` (${nomesDasColunas}) VALUES\n  ${valores};\n`);
    }
    await escrever("\n");
    totalLinhas += linhas.length;
    console.log(`  ${tabela}: ${linhas.length} linha(s)`);
  }

  await escrever(`SET FOREIGN_KEY_CHECKS = 1;\n`);
  await new Promise((ok) => saida.end(ok));
  await ligacao.end();

  console.log(`\nPronto: ${ficheiro}`);
  console.log(`${nomes.length} tabela(s), ${totalLinhas} linha(s).`);
  console.log(
    "\nCONFIRME ANTES DE ARMAR A PURGA: abra o ficheiro e veja que tem INSERTs\n" +
      "para simulatorOrders, negociacoes e providers. Um ficheiro só com CREATE\n" +
      "TABLE e nenhuma linha não serve de cópia nenhuma.",
  );
}

correr().catch((e) => {
  console.error("\nA cópia FALHOU — não a dê por feita:", e?.message ?? e);
  process.exit(1);
});
