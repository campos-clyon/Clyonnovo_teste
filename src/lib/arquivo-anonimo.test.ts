import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COLUNAS_NAO_PESSOAIS_DO_ARQUIVO,
  COLUNAS_PESSOAIS_DO_ARQUIVO,
  DA_NEGOCIACAO_FICA,
  DA_NEGOCIACAO_SAI,
  DO_PEDIDO_FICA,
  DO_PEDIDO_SAI,
  dadosDoArquivoAnonimizados,
} from "./arquivo-anonimo";
import { MESES_ATE_ANONIMIZAR_O_ARQUIVO } from "./retencao";

/**
 * A CÓPIA DOS PEDIDOS APAGADOS, ANONIMIZADA — 01-10-2026.
 *
 * *«Anonimizar ao fim de 12 meses»*, e também quando o cliente apaga a conta
 * — decisão do dono, 01-10-2026.
 *
 * O teste do meio é o que importa a prazo: as colunas da tabela e os campos
 * que `deleteSimulatorOrder` escreve na cópia são LIDOS DO CÓDIGO, e cada um
 * tem de estar numa de duas listas. Uma coluna ou um campo novo sem decisão
 * chumba aqui — o mesmo padrão de `apagar-tudo-o-que-identifica.test.ts` para
 * a tabela `providers`.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const DB = ler("src/lib/db.ts");

const corpoDe = (inicio: string) => {
  const i = DB.indexOf(inicio);
  expect(i, inicio).toBeGreaterThan(-1);
  const fim = DB.indexOf("\nexport ", i + 1);
  return DB.slice(i, fim === -1 ? undefined : fim);
};

/** As colunas da tabela, como ela é criada e como cresce. */
const COLUNAS_DA_TABELA = (() => {
  const i = DB.indexOf("CREATE TABLE IF NOT EXISTS arquivoDePedidos (");
  expect(i).toBeGreaterThan(-1);
  const bloco = DB.slice(i, DB.indexOf(") ENGINE=", i));
  const doCreate = bloco
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.match(/^\s*(\w+)\s+(?:INT|BIGINT|TINYINT|VARCHAR|CHAR|TEXT|LONGTEXT|DATETIME|DATE|DECIMAL|JSON)\b/i)?.[1])
    .filter((c): c is string => c != null);
  const dosAlter = [...DB.matchAll(/ALTER TABLE arquivoDePedidos ADD COLUMN (\w+)/g)].map((m) => m[1]);
  return [...new Set([...doCreate, ...dosAlter])];
})();

/** Os nomes das colunas de um SELECT (o alias, quando há; senão o que vem depois do ponto). */
const colunasDoSelect = (corpo: string, depois: string) => {
  const fim = corpo.indexOf(depois);
  expect(fim, depois).toBeGreaterThan(-1);
  const inicio = corpo.lastIndexOf("SELECT", fim);
  return corpo
    .slice(inicio + "SELECT".length, fim)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (c.match(/\bAS\s+(\w+)$/i)?.[1] ?? c.split(".").pop()!).trim());
};

const APAGAR = corpoDe("export async function deleteSimulatorOrder");
const CAMPOS_DO_PEDIDO = colunasDoSelect(APAGAR, "FROM simulatorOrders WHERE id = ? LIMIT 1");
const CAMPOS_DA_NEGOCIACAO = colunasDoSelect(APAGAR, "FROM negociacoes n");

describe("as colunas da tabela estão todas decididas", () => {
  it("há colunas para comparar — se a leitura falhar, o teste seguinte não vale nada", () => {
    expect(COLUNAS_DA_TABELA).toEqual(
      expect.arrayContaining(["id", "pedidoId", "clienteNome", "clienteEmail", "dados", "criadoEm"]),
    );
    expect(COLUNAS_DA_TABELA).toContain("anonimizadoEm");
  });

  it("cada coluna é pessoal ou não pessoal — e nenhuma é as duas", () => {
    const pessoais = new Set<string>(COLUNAS_PESSOAIS_DO_ARQUIVO);
    const naoPessoais = new Set<string>(COLUNAS_NAO_PESSOAIS_DO_ARQUIVO);
    const porDecidir = COLUNAS_DA_TABELA.filter((c) => !pessoais.has(c) && !naoPessoais.has(c));
    expect(
      porDecidir,
      `Colunas novas em arquivoDePedidos sem decisão: ${porDecidir.join(", ")}. ` +
        "Se identificam alguém, acrescente-as a COLUNAS_PESSOAIS_DO_ARQUIVO e ao UPDATE de " +
        "anonimizarLinhasDoArquivo. Se não, a COLUNAS_NAO_PESSOAIS_DO_ARQUIVO.",
    ).toEqual([]);
    expect([...pessoais].filter((c) => naoPessoais.has(c))).toEqual([]);
  });

  it("e as listas não falam de colunas que não existem", () => {
    for (const c of [...COLUNAS_PESSOAIS_DO_ARQUIVO, ...COLUNAS_NAO_PESSOAIS_DO_ARQUIVO]) {
      expect(COLUNAS_DA_TABELA).toContain(c);
    }
  });
});

describe("os campos que vão para dentro de `dados` estão todos decididos", () => {
  it("lê os dois SELECT do apagar — se a leitura falhar, isto não vale nada", () => {
    expect(CAMPOS_DO_PEDIDO).toEqual(expect.arrayContaining(["id", "contactName", "contactEmail", "filesJson"]));
    expect(CAMPOS_DA_NEGOCIACAO).toEqual(expect.arrayContaining(["id", "valorAcordado", "provaJson", "profissionalNome"]));
  });

  it("cada campo do pedido fica ou sai", () => {
    const decididos = new Set<string>([...DO_PEDIDO_FICA, ...DO_PEDIDO_SAI]);
    const porDecidir = CAMPOS_DO_PEDIDO.filter((c) => !decididos.has(c));
    expect(
      porDecidir,
      `deleteSimulatorOrder passou a copiar do pedido: ${porDecidir.join(", ")}. ` +
        "Decida em arquivo-anonimo.ts: DO_PEDIDO_FICA (não identifica) ou DO_PEDIDO_SAI.",
    ).toEqual([]);
  });

  it("cada campo da negociação fica ou sai", () => {
    const decididos = new Set<string>([...DA_NEGOCIACAO_FICA, ...DA_NEGOCIACAO_SAI]);
    const porDecidir = CAMPOS_DA_NEGOCIACAO.filter((c) => !decididos.has(c));
    expect(
      porDecidir,
      `deleteSimulatorOrder passou a copiar da negociação: ${porDecidir.join(", ")}. ` +
        "Decida em arquivo-anonimo.ts: DA_NEGOCIACAO_FICA ou DA_NEGOCIACAO_SAI.",
    ).toEqual([]);
  });

  it("nada fica e sai ao mesmo tempo", () => {
    const fica = new Set<string>(DO_PEDIDO_FICA);
    expect(DO_PEDIDO_SAI.filter((c) => fica.has(c))).toEqual([]);
    const ficaN = new Set<string>(DA_NEGOCIACAO_FICA);
    expect(DA_NEGOCIACAO_SAI.filter((c) => ficaN.has(c))).toEqual([]);
  });

  it("o que fica é só o que o dono disse: datas, valores, serviço e zona", () => {
    expect([...DO_PEDIDO_FICA].sort()).toEqual(
      ["city", "createdAt", "id", "serviceType", "valorDesejadoCliente"].sort(),
    );
    for (const c of ["contactName", "contactEmail", "contactPhone", "address", "postalCode", "description", "filesJson"]) {
      expect(DO_PEDIDO_SAI).toContain(c);
    }
  });
});

describe("a reescrita de `dados`", () => {
  const original = JSON.stringify({
    pedido: {
      id: 412,
      serviceType: "recolha-moveis",
      city: "Cascais",
      contactName: "Maria Exemplo",
      contactEmail: "maria@exemplo.pt",
      contactPhone: "912345678",
      address: "Rua das Flores 12, 2750-123 Cascais",
      postalCode: "2750-123",
      description: "Sofá velho na garagem, ligar ao vizinho Joaquim",
      valorDesejadoCliente: "120.00",
      createdAt: "2026-05-02T10:00:00.000Z",
      filesJson: '[{"url":"https://blob.exemplo/casa-1.jpg"}]',
      calendarEventId: "evento-abc",
      // Um campo que ninguém previu: sai por omissão.
      nif: "123456789",
    },
    negociacoes: [
      {
        id: 900,
        providerId: 33,
        estado: "acordada",
        valorAcordado: "110.00",
        confirmadoEm: "2026-05-10T10:00:00.000Z",
        execucaoEnviadaEm: "2026-05-09T10:00:00.000Z",
        pagoEm: null,
        provaJson: '{"fotos":["https://blob.exemplo/prova.jpg"],"nota":"deixei na porta da Maria"}',
        profissionalNome: "João Transportes",
      },
    ],
    fotografias: ["https://blob.exemplo/casa-1.jpg", "https://blob.exemplo/prova.jpg"],
  });

  const anonimo = dadosDoArquivoAnonimizados(original);
  const lido = JSON.parse(anonimo);

  it("não sobra nada que identifique alguém", () => {
    for (const pessoal of [
      "Maria",
      "maria@exemplo.pt",
      "912345678",
      "Rua das Flores",
      "2750-123",
      "Joaquim",
      "blob.exemplo",
      "evento-abc",
      "123456789",
      "João",
    ]) {
      expect(anonimo).not.toContain(pessoal);
    }
  });

  it("ficam as datas, os valores, o serviço e a zona", () => {
    expect(lido.pedido).toEqual({
      id: 412,
      serviceType: "recolha-moveis",
      city: "Cascais",
      valorDesejadoCliente: "120.00",
      createdAt: "2026-05-02T10:00:00.000Z",
    });
    expect(lido.negociacoes).toEqual([
      {
        id: 900,
        providerId: 33,
        estado: "acordada",
        valorAcordado: "110.00",
        confirmadoEm: "2026-05-10T10:00:00.000Z",
        execucaoEnviadaEm: "2026-05-09T10:00:00.000Z",
        pagoEm: null,
      },
    ]);
  });

  it("as fotografias passam a ser só quantas eram", () => {
    expect(lido.quantasFotografias).toBe(2);
    expect(lido.fotografias).toBeUndefined();
    expect(lido.anonimizado).toBe(true);
  });

  it("duas vezes dá o mesmo", () => {
    expect(dadosDoArquivoAnonimizados(anonimo)).toBe(anonimo);
  });

  it("um JSON estragado não deixa passar nada", () => {
    const r = JSON.parse(dadosDoArquivoAnonimizados("{ isto não é json maria@exemplo.pt"));
    expect(r).toEqual({ anonimizado: true, pedido: null, negociacoes: [], quantasFotografias: 0 });
    expect(JSON.parse(dadosDoArquivoAnonimizados(null)).pedido).toBeNull();
  });

  it("um campo que fica, mas com um objecto lá dentro, sai", () => {
    const r = JSON.parse(
      dadosDoArquivoAnonimizados(JSON.stringify({ pedido: { id: 1, city: { morada: "Rua X" } } })),
    );
    expect(r.pedido).toEqual({ id: 1 });
  });
});

describe("o UPDATE tira todas as colunas pessoais, e não apaga a linha", () => {
  const UPDATE = (() => {
    const corpo = corpoDe("async function anonimizarLinhasDoArquivo");
    const i = corpo.indexOf("UPDATE arquivoDePedidos");
    expect(i).toBeGreaterThan(-1);
    return corpo.slice(i, corpo.indexOf("WHERE id = ?", i));
  })();

  it.each([...COLUNAS_PESSOAIS_DO_ARQUIVO])("limpa a coluna %s", (coluna) => {
    expect(UPDATE).toContain(`${coluna} = `);
  });

  it("os nomes saem a NULL, e `dados` é reescrito pela lista do que fica", () => {
    expect(UPDATE).toContain("clienteNome = NULL");
    expect(UPDATE).toContain("clienteEmail = NULL");
    expect(UPDATE).toContain("motivo = NULL");
    expect(UPDATE).toContain("dados = ?");
    expect(corpoDe("async function anonimizarLinhasDoArquivo")).toContain(
      "dadosDoArquivoAnonimizados(l.dados)",
    );
  });

  it("e marca quando, para nunca a reler", () => {
    expect(UPDATE).toContain("anonimizadoEm = NOW()");
    expect(corpoDe("async function anonimizarLinhasDoArquivo")).toContain(
      "WHERE id = ? AND anonimizadoEm IS NULL",
    );
  });

  it("não há DELETE no arquivo em lado nenhum", () => {
    expect(DB).not.toMatch(/DELETE\s+FROM\s+arquivoDePedidos/i);
  });
});

describe("ao fim de 12 meses, no cron da purga", () => {
  it("o prazo é de 12 meses", () => {
    expect(MESES_ATE_ANONIMIZAR_O_ARQUIVO).toBe(12);
  });

  it("conta-se da data em que a cópia foi arquivada, pelo relógio do MySQL", () => {
    const f = corpoDe("export async function anonimizarArquivoAntigo");
    expect(f).toContain("criadoEm < NOW() - INTERVAL ${m} MONTH");
    expect(f).toContain('"prazo"');
  });

  it("a seco conta e não toca em nada", () => {
    const f = corpoDe("export async function anonimizarArquivoAntigo");
    const seco = f.indexOf("if (!aSerio) return");
    expect(seco).toBeGreaterThan(-1);
    expect(f.indexOf("anonimizarLinhasDoArquivo(")).toBeGreaterThan(seco);
  });

  it("corre no mesmo cron, armado pelo mesmo PURGA_ARMADA", () => {
    const rota = ler("src/app/api/cron/purgar-pedidos/route.ts");
    expect(rota).toContain("anonimizarArquivoAntigo(MESES_ATE_ANONIMIZAR_O_ARQUIVO, {");
    expect(rota).toMatch(/anonimizarArquivoAntigo\(MESES_ATE_ANONIMIZAR_O_ARQUIVO, \{\r?\n\s*aSerio: armada,/);
  });
});

describe("quando o cliente apaga a conta", () => {
  it("o arquivo dele é anonimizado, pelo email normalizado, depois do commit", () => {
    const conta = corpoDe("export async function apagarContaDeCliente");
    const commit = conta.indexOf("await conn.commit()");
    const arquivo = conta.indexOf("await anonimizarArquivoDoCliente(alvo)");
    expect(commit).toBeGreaterThan(-1);
    expect(arquivo).toBeGreaterThan(commit);
    expect(conta).toContain("const alvo = email.trim().toLowerCase();");
  });

  it("procura o email normalizado dos dois lados, e sem alvo não faz nada", () => {
    const f = corpoDe("export async function anonimizarArquivoDoCliente");
    expect(f).toContain("email.trim().toLowerCase()");
    expect(f).toContain('"LOWER(TRIM(clienteEmail)) = ?"');
    expect(f).toContain("if (!alvo) return 0;");
    expect(f).toContain('"conta_cliente"');
  });
});

describe("a página de privacidade diz o prazo", () => {
  it("§6 fala dos 12 meses e do apagar da conta, com o número do código", () => {
    const pagina = ler("src/app/privacidade/page.tsx");
    const i = pagina.indexOf("Cópia dos pedidos apagados:");
    expect(i).toBeGreaterThan(-1);
    const paragrafo = pagina.slice(i, pagina.indexOf("</li>", i));
    expect(paragrafo).toContain("{MESES_ATE_ANONIMIZAR_O_ARQUIVO} meses");
    expect(paragrafo).toContain("quando apaga a sua conta");
    expect(paragrafo).toContain("anonimizada");
    expect(paragrafo).not.toContain("enquanto puder ser necessária");
  });
});
