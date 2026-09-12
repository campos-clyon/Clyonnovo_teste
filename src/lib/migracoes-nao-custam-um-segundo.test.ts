import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * SESSENTA IDAS AO MYSQL ANTES DA PRIMEIRA LEITURA.
 *
 * "Todos os carregamentos, tanto das categorias como das informações de
 * pedidos no painel do profissional ou do admin, demoram enorme tempo a
 * carregar. Não é possível optimizar isso?" — 12-09-2026, com o ecrã das
 * negociações preso num spinner.
 *
 * Era isto. Cada `ensure…Table` corria a lista inteira de `ALTER TABLE` a
 * cada arranque a frio — uma a uma, em série — e apanhava o «Duplicate
 * column» de cada uma. São 48 na `simulatorOrders` e 11 nas `negociacoes`, e
 * o ecrã das negociações chama TRÊS destas funções antes de mostrar seja o
 * que for. A um par de dezenas de milissegundos por viagem ao Railway, é mais
 * de um segundo gasto a descobrir que não havia nada para fazer.
 *
 * A base sabe responder à pergunta certa: que colunas e que índices já tens.
 * Duas consultas, e depois só corre o que falta. Em regime normal — que é
 * sempre, depois da primeira vez — são duas viagens em vez de sessenta.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");

describe("pergunta-se uma vez em vez de tentar sessenta", () => {
  it("lê as colunas e os índices que já existem", () => {
    expect(DB).toContain("async function jaNaTabela(");
    expect(DB).toContain("FROM information_schema.COLUMNS");
    expect(DB).toContain("FROM information_schema.STATISTICS");
  });

  it("as duas leituras vão juntas — são independentes", () => {
    const i = DB.indexOf("async function jaNaTabela(");
    expect(DB.slice(i, i + 900)).toContain("await Promise.all([");
  });

  it("salta o que já lá está, e corre o resto", () => {
    const i = DB.indexOf("async function correrMigracoes(");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, i + 1200);
    expect(corpo).toContain("if (coluna && colunas.has(coluna)) continue;");
    expect(corpo).toContain("if (indice && indices.has(indice)) continue;");
    // E o que não se souber ler corre à mesma, como corria antes.
    expect(corpo).toContain("await pool.execute(sql);");
  });

  it("os dois ciclos grandes passaram a usá-la", () => {
    expect(DB).toContain('await correrMigracoes(pool, "negociacoes", colunas, "negociacoes");');
    expect(DB).toContain(
      'await correrMigracoes(pool, "simulatorOrders", migrations, "simulatorOrders");',
    );
    // E já não há ciclos a tentar tudo às cegas.
    expect(DB).not.toContain("for (const sql of colunas) {");
    expect(DB).not.toContain("for (const sql of migrations) {");
  });

  it("sem information_schema não se fica pior — a lista corre inteira", () => {
    /*
     * Degradação, não avaria. Se a leitura do esquema falhar, devolve-se
     * vazio e nada é saltado: é exactamente o comportamento de ontem.
     */
    const i = DB.indexOf("async function jaNaTabela(");
    const corpo = DB.slice(i, i + 1600);
    expect(corpo).toContain("return vazio;");
    expect(corpo).toContain("const vazio = { colunas: new Set<string>(), indices: new Set<string>() };");
  });

  it("o «Duplicate column» continua a ser silêncio", () => {
    // A migração já lá estava e não se soube ler o nome dela — não é um erro
    // para encher os registos a cada arranque.
    const i = DB.indexOf("async function correrMigracoes(");
    expect(DB.slice(i, i + 1200)).toContain('e?.message?.includes("Duplicate column")');
  });
});

describe("o índice que faltava ao painel do profissional", () => {
  it("existe, e começa pelo providerId", () => {
    /*
     * A tabela tinha `UNIQUE KEY (pedidoId, providerId)` — e um índice só
     * serve a partir da coluna da ESQUERDA. Uma consulta por `providerId` não
     * o podia usar e varria a tabela inteira, de trinta em trinta segundos,
     * por cada painel aberto, contra um pool de cinco ligações.
     */
    expect(DB).toContain(
      "CREATE INDEX idx_negociacoes_provider ON negociacoes (providerId, updatedAt)",
    );
  });

  it("e a versão das migrações subiu, senão nunca corria", () => {
    // O guarda booleano sozinho só deixa as migrações novas passar em
    // arranques frios; um processo já quente nunca as via.
    expect(DB).toContain("const VERSAO_DAS_NEGOCIACOES = 5;");
  });
});
