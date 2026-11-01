import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { limparZonasAntigas, TABELA_DA_COPIA_DAS_ZONAS } from "./zonas-limpas";

/**
 * TERMOS E PRIVACIDADE DE 01-11-2026 — ordem do CEO com as decisões do dono,
 * a partir do relatório do Jurídico.
 *
 * O que se guarda aqui: as avaliações que o parceiro dá ao cliente saem
 * quando o cliente apaga a conta (e só aí — sem prazo na purga); só o
 * administrador as remove no backoffice, e fica no registo; as zonas antigas
 * saem da base com cópia antes; e os textos dizem isso mesmo.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const DB = ler("src/lib/db.ts");
const CORPO_CLIENTE = (() => {
  const i = DB.indexOf("export async function apagarContaDeCliente(");
  const fim = DB.indexOf("export async function apagarFotosDoBlob", i);
  return semNotas(DB.slice(i, fim));
})();
const TERMOS = semNotas(ler("src/app/termos/page.tsx"));
const PRIVACIDADE = semNotas(ler("src/app/privacidade/page.tsx"));
const ROTA = ler("src/app/api/admin/pedidos/[id]/avaliacao-ao-cliente/route.ts");
const LIB = ler("src/lib/avaliacoes-do-cliente.ts");

describe("as avaliações que o parceiro dá ao cliente", () => {
  it("saem quando o cliente apaga a conta, dentro da transacção", () => {
    const apagar = CORPO_CLIENTE.indexOf('DELETE FROM avaliacoesAoCliente WHERE clienteEmail = ?", [alvo]');
    expect(apagar, "apagarContaDeCliente não apaga as avaliações ao cliente").toBeGreaterThan(-1);
    expect(apagar).toBeLessThan(CORPO_CLIENTE.indexOf("await conn.commit()"));
    // Sem tabela (nenhuma avaliação feita ainda) não pára o apagar; outro erro pára.
    expect(CORPO_CLIENTE).toContain('!== "ER_NO_SUCH_TABLE") throw err');
  });

  it("não têm prazo na purga (decisão do dono: só com a conta)", () => {
    expect(ler("src/app/api/cron/purgar-pedidos/route.ts")).not.toContain("avaliacoesAoCliente");
    expect(ler("src/lib/retencao.ts")).not.toContain("avaliacoesAoCliente");
  });

  it("só o administrador as vê e remove no backoffice", () => {
    expect(ROTA).not.toMatch(/\brequireAdmin\(/);
    expect(ROTA.match(/await requireAdminGeral\(req\)/g)?.length).toBe(2);
    expect(ler("src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx")).toContain(
      "{isAdmin && <AvaliacoesAoClienteDoPedido",
    );
  });

  it("remover fica no registo, na mesma transacção, antes de apagar — e sem o comentário", () => {
    const i = LIB.indexOf("export async function removerAvaliacaoAoCliente(");
    const corpo = semNotas(LIB.slice(i));
    const registo = corpo.indexOf('acontecimento: "avaliacao_ao_cliente_removida"');
    expect(registo).toBeGreaterThan(-1);
    expect(registo).toBeLessThan(corpo.indexOf("DELETE FROM avaliacoesAoCliente WHERE id = ?"));
    expect(corpo).toContain("registarNaTransaccao(conn");
    // Só apaga a avaliação deste pedido.
    expect(corpo).toContain("WHERE id = ? AND pedidoId = ? FOR UPDATE");
    expect(corpo.slice(registo, corpo.indexOf("DELETE FROM avaliacoesAoCliente WHERE id = ?"))).not.toContain("comentario");
    expect(DB).toContain('| "avaliacao_ao_cliente_removida"');
  });

  it("os textos dizem que existem, quem as vê e que duram enquanto a conta existir", () => {
    expect(TERMOS).toContain("o parceiro que o fez pode também avaliá-lo a");
    expect(TERMOS).toContain("Guarda-se enquanto a sua conta existir e apaga-se quando a");
    expect(TERMOS).toContain("Se avaliar um cliente, faça-o só");
    expect(PRIVACIDADE).toContain("Avaliações que recebe:");
    expect(PRIVACIDADE).toContain("Avaliações que recebe dos parceiros:</strong> guardadas enquanto a sua");
    expect(PRIVACIDADE).toContain("Avaliações que dá aos clientes:");
    expect(PRIVACIDADE).toContain("lhe mostrar as avaliações que os");
    // A frase falsa de antes: o cliente vê o primeiro nome do parceiro.
    expect(PRIVACIDADE).not.toContain("sem identificar quem as escreveu");
  });
});

describe("parceiro, empresa parceira e «verificado» nos Termos", () => {
  it("define parceiro e separa-o de quem passa a fatura (a constante fica)", () => {
    expect(TERMOS).toContain("Neste documento, «parceiro» é a pessoa ou a empresa, independente");
    expect(TERMOS).toContain("não são sócios, agentes nem trabalhadores da");
    expect(TERMOS).toContain("profissional na acepção da lei de defesa do consumidor");
    expect(TERMOS).toContain("é uma entidade\n            diferente: não é o parceiro e não presta o serviço.");
    expect(ler("src/lib/identificacao-legal.ts")).toContain(
      'export const EMPRESA_PARCEIRA_AO_PUBLICO = "empresa parceira da CLYON";',
    );
  });

  it("diz o que quer dizer «verificado»: NIF, identidade e contacto", () => {
    expect(TERMOS).toContain("a CLYON confirmou o NIF, a identidade e o\n            contacto dele");
  });
});

describe("os erros das apps e as zonas na Privacidade", () => {
  it("os erros das apps: na §11 e na §6, com o prazo do código", () => {
    expect(PRIVACIDADE).toContain("<strong>Erros da app:</strong>");
    expect(PRIVACIDADE).toContain("<strong>Erros das apps:</strong> {DIAS_DOS_ERROS_DA_APP} dias.");
  });

  it("a §12 já não fala de zonas", () => {
    const i = PRIVACIDADE.indexOf('id="apagar-conta"');
    expect(i).toBeGreaterThan(-1);
    expect(PRIVACIDADE.slice(i)).not.toMatch(/\bzonas\b/);
  });

  it("a data das duas é a da publicação", () => {
    expect(TERMOS).toContain("Última atualização: 1 de novembro de 2026.");
    expect(PRIVACIDADE).toContain("Última atualização: 1 de novembro de 2026.");
    const datas = ler("src/lib/datas-das-paginas.ts");
    expect(datas).toContain('"/termos": "2026-11-01"');
    expect(datas).toContain('"/privacidade": "2026-11-01"');
  });
});

describe("as zonas antigas saem da base, com cópia antes", () => {
  it("copia antes de limpar, e só onde há zonas", async () => {
    const sqls: Array<{ sql: string; v?: unknown[] }> = [];
    const conn = {
      execute: async (sql: string, v?: unknown[]) => {
        sqls.push({ sql, v });
        if (sql.startsWith("SELECT id, zonas FROM providers")) {
          return [[{ id: 7, zonas: '["Almada","Seixal"]' }], []];
        }
        return [{ affectedRows: 1 }, []];
      },
    };
    const r = await limparZonasAntigas(conn);
    expect(r.limpos).toBe(1);
    const copia = sqls.findIndex((s) => s.sql.startsWith(`INSERT IGNORE INTO ${TABELA_DA_COPIA_DAS_ZONAS}`));
    const limpa = sqls.findIndex((s) => s.sql.startsWith("UPDATE providers SET zonas = NULL"));
    expect(copia).toBeGreaterThan(-1);
    expect(copia).toBeLessThan(limpa);
    expect(sqls[copia].v).toEqual([7, '["Almada","Seixal"]']);
    expect(sqls[limpa].sql).toContain("updatedAt = updatedAt");
    expect(sqls.find((s) => s.sql.startsWith("SELECT id, zonas"))?.sql).toContain("TRIM(zonas) <> '[]'");
  });

  it("corre ao arrancar, depois das categorias", () => {
    const i = DB.indexOf("await migrarCategoriasParaGrupos(");
    const j = DB.indexOf("await limparZonasAntigas(");
    expect(j).toBeGreaterThan(i);
    expect(DB).toMatch(/const VERSAO_DOS_PROFISSIONAIS = (7|8|9);/);
  });
});
