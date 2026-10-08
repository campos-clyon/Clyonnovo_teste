import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  comissoesPorPeriodo,
  noAlcanceDe,
  trabalhosPagosDoJson,
  type LinhaQueConta,
  type PagamentoDeComissao,
} from "./assistentes";

/**
 * *«Quero mudar como os trabalhos estão a ser contabilizados, não apenas os
 * que estão ligados à Miriam e sim todos os trabalhos realizados a partir do
 * dia 23/09, porém devemos ter uma gestão dos valores: do dia 23/09 ao 15/10,
 * depois a próxima contagem vai até ao final do mês…»* — 08-10-2026.
 *
 * Decidido com o dono: cada conta escolhe «todos» ou «os seus»; conta o dia
 * em que o trabalho ficou concluído; cada período marca-se como pago e fica
 * congelado; o que foi concluído antes de 23/09 não conta.
 */

const concluido = (id: number, concluidoEm: string, valor: number, extra: Partial<LinhaQueConta> = {}): LinhaQueConta => ({
  id,
  status: "concluido",
  concluidoEm,
  valorAcordado: valor,
  ...extra,
});

const conta = (linhas: LinhaQueConta[], hoje: string, pagamentos: PagamentoDeComissao[] = []) =>
  comissoesPorPeriodo({ linhas, pagamentos, clyonPercent: 11, minhaPercent: 40, hoje });

describe("em que período cai cada trabalho", () => {
  it("pelo dia de LISBOA: 00:30 de 16/10 em Portugal é 23:30 de 15/10 em UTC", () => {
    const r = conta(
      [
        concluido(1, "2026-10-15T22:30:00Z", 100), // 23:30 de 15/10 em Lisboa
        concluido(2, "2026-10-15T23:30:00Z", 100), // 00:30 de 16/10 em Lisboa
      ],
      "2026-10-20",
    );
    const primeiro = r.periodos.find((p) => p.inicio === "2026-09-23")!;
    const segundo = r.periodos.find((p) => p.inicio === "2026-10-16")!;
    expect(primeiro.detalhe.map((t) => t.pedidoId)).toEqual([1]);
    expect(segundo.detalhe.map((t) => t.pedidoId)).toEqual([2]);
  });

  it("o texto da base sem fuso é UTC, como o resto da base", () => {
    const r = conta([concluido(1, "2026-10-15 23:30:00", 100)], "2026-10-20");
    expect(r.periodos.find((p) => p.inicio === "2026-10-16")!.trabalhos).toBe(1);
  });

  it("o que foi concluído antes de 23/09 não conta em lado nenhum", () => {
    const r = conta([concluido(1, "2026-09-22T12:00:00Z", 500)], "2026-10-01");
    expect(r.totais.trabalhos).toBe(0);
    expect(r.periodos).toHaveLength(1);
    expect(r.periodos[0].comissaoAssistente).toBe(0);
  });

  it("só os concluídos contam", () => {
    const r = conta([concluido(1, "2026-10-01T12:00:00Z", 100, { status: "cancelado" })], "2026-10-02");
    expect(r.totais.trabalhos).toBe(0);
  });
});

describe("a conta de cada período", () => {
  it("valor do trabalho × 11 % da CLYON × 40 % dela, somados primeiro", () => {
    const r = conta(
      [concluido(1, "2026-10-01T12:00:00Z", 100), concluido(2, "2026-10-02T12:00:00Z", 150)],
      "2026-10-08",
    );
    const p = r.periodos[0];
    expect(p).toMatchObject({
      inicio: "2026-09-23",
      fim: "2026-10-15",
      rotulo: "23/09 – 15/10/2026",
      estado: "em_curso",
      trabalhos: 2,
      valorTrabalhos: 250,
      comissaoClyon: 27.5,
      comissaoAssistente: 11,
    });
  });

  it("o mais recente primeiro, e os totais por estado", () => {
    const r = conta(
      [concluido(1, "2026-10-01T12:00:00Z", 100), concluido(2, "2026-10-20T12:00:00Z", 200)],
      "2026-11-03",
    );
    expect(r.periodos.map((p) => [p.inicio, p.estado])).toEqual([
      ["2026-11-01", "em_curso"],
      ["2026-10-16", "por_pagar"],
      ["2026-09-23", "por_pagar"],
    ]);
    expect(r.totais).toEqual({
      periodoActual: "01/11 – 15/11/2026",
      estePeriodo: 0,
      porPagar: 13.2, // (100 + 200) × 11 % × 40 %
      pago: 0,
      trabalhos: 2,
    });
  });
});

describe("um período pago fica como foi pago", () => {
  const pagamento = (extra: Partial<PagamentoDeComissao> = {}): PagamentoDeComissao => ({
    periodoInicio: "2026-09-23",
    periodoFim: "2026-10-15",
    valorTrabalhos: 100,
    comissaoClyonPercent: 11,
    comissaoPercent: 40,
    valorPago: 4.4,
    trabalhos: [
      {
        pedidoId: 1,
        valor: 100,
        fonteDoValor: "acordado",
        comissaoClyon: 11,
        comissaoAssistente: 4.4,
        concluidoEm: "2026-10-01T12:00:00.000Z",
        servico: "recolha_moveis",
      },
    ],
    pagoEm: "2026-10-16T09:00:00.000Z",
    pagoPor: "WANDERSON",
    ...extra,
  });

  it("mostra o que se pagou, mesmo com outras percentagens hoje", () => {
    const r = comissoesPorPeriodo({
      linhas: [concluido(1, "2026-10-01T12:00:00Z", 100)],
      pagamentos: [pagamento()],
      clyonPercent: 20,
      minhaPercent: 50,
      hoje: "2026-10-20",
    });
    const p = r.periodos.find((x) => x.inicio === "2026-09-23")!;
    expect(p).toMatchObject({
      estado: "pago",
      comissaoAssistente: 4.4,
      comissaoPercent: 40,
      comissaoClyonPercent: 11,
      diferenca: null,
      pago: { pagoEm: "2026-10-16T09:00:00.000Z", pagoPor: "WANDERSON" },
    });
    expect(r.totais.pago).toBe(4.4);
    expect(r.totais.porPagar).toBe(0);
  });

  it("diz a diferença quando um trabalho do período mudou depois de pago", () => {
    const r = conta([concluido(1, "2026-10-01T12:00:00Z", 150)], "2026-10-20", [pagamento()]);
    const p = r.periodos.find((x) => x.inicio === "2026-09-23")!;
    expect(p.comissaoAssistente).toBe(4.4);
    expect(p.diferenca).toBe(2.2); // 150 × 11 % × 40 % = 6,60 — pagaram-se 4,40
  });

  it("um pedido já pago não volta a contar noutro período, nem dá diferença no seu", () => {
    // Reaberto e fechado outra vez: a conclusão saltou para o período seguinte.
    const r = conta([concluido(1, "2026-10-20T12:00:00Z", 100)], "2026-11-03", [pagamento()]);
    expect(r.periodos.find((x) => x.inicio === "2026-10-16")!.trabalhos).toBe(0);
    expect(r.totais.porPagar).toBe(0);
    expect(r.periodos.find((x) => x.inicio === "2026-09-23")!.diferenca).toBeNull();
  });

  /*
   * A purga apaga os pedidos fechados à mão ao fim de 60 dias. Um pedido
   * apagado não mudou de valor: o período pago não pode passar a gritar
   * «diferença» por isso — nem convidar a anular e voltar a pagar menos.
   */
  it("um pedido que já não existe (a purga) não dá diferença", () => {
    const r = conta([], "2026-12-20", [pagamento()]);
    const p = r.periodos.find((x) => x.inicio === "2026-09-23")!;
    expect(p.diferenca).toBeNull();
    expect(p.comissaoAssistente).toBe(4.4);
    expect(p.detalhe.map((t) => t.pedidoId)).toEqual([1]);
  });

  it("e só os que existem entram na comparação: os outros mudaram de valor ou não", () => {
    const pago2 = pagamento({
      valorTrabalhos: 200,
      valorPago: 8.8,
      trabalhos: [
        ...pagamento().trabalhos,
        { pedidoId: 2, valor: 100, fonteDoValor: "preco_final", comissaoClyon: 11, comissaoAssistente: 4.4, concluidoEm: null, servico: null },
      ],
    });
    // O 2 foi apagado; o 1 passou de 100 € para 150 €.
    const r = conta([concluido(1, "2026-10-01T12:00:00Z", 150)], "2026-12-20", [pago2]);
    expect(r.periodos.find((x) => x.inicio === "2026-09-23")!.diferenca).toBe(2.2);
  });

  it("os trabalhos do período pago são os da fotografia, com o cliente lido de hoje", () => {
    const r = conta(
      [concluido(1, "2026-10-01T12:00:00Z", 100, { contactName: "Ana Silva", city: "Almada" })],
      "2026-10-20",
      [pagamento()],
    );
    const t = r.periodos.find((x) => x.inicio === "2026-09-23")!.detalhe[0];
    expect(t).toMatchObject({ pedidoId: 1, valor: 100, cliente: "Ana Silva", cidade: "Almada", servico: "recolha_moveis" });
  });
});

/**
 * *«Os valores negociados menos o IVA, 11 % desses valores.»* — 08-10-2026.
 *
 * Decidido com o dono: num pedido como os outros, o negociado é o acordado
 * com o profissional, que já é sem IVA (350 € → a CLYON fica com 38,50 €).
 * Num Trabalho CLYON é o preço ao cliente, sem IVA — o valor fixo é só o que
 * o profissional recebe.
 */
describe("sobre que valor se tiram os 11 %", () => {
  it("o acordado com o profissional: 350 € dão 38,50 € à CLYON e 15,40 € a ela", () => {
    const r = conta([concluido(1, "2026-10-05T12:00:00Z", 350)], "2026-10-08");
    expect(r.periodos[0]).toMatchObject({ valorTrabalhos: 350, comissaoClyon: 38.5, comissaoAssistente: 15.4 });
    expect(r.periodos[0].detalhe[0].fonteDoValor).toBe("acordado");
  });

  it("num Trabalho CLYON, o preço ao cliente e não o valor fixo", () => {
    const r = conta(
      [concluido(1, "2026-10-05T12:00:00Z", 300, { valorFixoClyon: 300, precoClienteClyon: "400.00" })],
      "2026-10-08",
    );
    const p = r.periodos[0];
    expect(p.detalhe[0]).toMatchObject({ valor: 400, fonteDoValor: "preco_ao_cliente" });
    expect(p).toMatchObject({ valorTrabalhos: 400, comissaoClyon: 44, comissaoAssistente: 17.6, semPrecoAoCliente: [] });
  });

  it("sem o preço ao cliente conta o valor fixo, marcado em falta", () => {
    const r = conta(
      [concluido(7, "2026-10-05T12:00:00Z", 300, { valorFixoClyon: 300, precoClienteClyon: null })],
      "2026-10-20",
    );
    const p = r.periodos.find((x) => x.inicio === "2026-09-23")!;
    expect(p.detalhe[0]).toMatchObject({ valor: 300, fonteDoValor: "falta_preco_ao_cliente" });
    expect(p.semPrecoAoCliente).toEqual([7]);
  });

  it("e um período assim não se paga — a conta recusa-o antes de gravar", () => {
    const LIB = readFileSync(join(process.cwd(), "src/lib/assistentes.ts"), "utf8");
    const ini = LIB.indexOf("export async function marcarPeriodoComoPago(");
    const corpo = LIB.slice(ini, LIB.indexOf("INSERT INTO comissoesPagas", ini));
    expect(ini).toBeGreaterThan(-1);
    expect(corpo).toContain("if (p.semPrecoAoCliente.length > 0) {");
  });
});

describe("todos, ou só os seus", () => {
  const linhas = [
    concluido(1, "2026-10-01T12:00:00Z", 100, { assignedToId: 7 }),
    concluido(2, "2026-10-01T12:00:00Z", 100, { assignedToId: 9 }),
    concluido(3, "2026-10-01T12:00:00Z", 100, { assignedToId: null }),
  ];
  it("«todos» conta tudo, de quem quer que o tenha tratado", () => {
    expect(noAlcanceDe(linhas, { id: 7, comissaoSobre: "todos" }).map((l) => l.id)).toEqual([1, 2, 3]);
  });
  it("«os seus» só aqueles de que foi responsável", () => {
    expect(noAlcanceDe(linhas, { id: 7, comissaoSobre: "seus" }).map((l) => l.id)).toEqual([1]);
  });
});

describe("a fotografia gravada lê-se com desconfiança", () => {
  it("o que não se perceber cai, sem partir o ecrã", () => {
    expect(trabalhosPagosDoJson(null)).toEqual([]);
    expect(trabalhosPagosDoJson("{partido")).toEqual([]);
    expect(trabalhosPagosDoJson('{"pedidoId":1}')).toEqual([]);
    expect(trabalhosPagosDoJson('[{"pedidoId":"x"},{"pedidoId":5,"valor":"40","fonteDoValor":"inventada"}]')).toEqual([
      {
        pedidoId: 5,
        valor: 40,
        fonteDoValor: "sem_valor",
        comissaoClyon: 0,
        comissaoAssistente: 0,
        concluidoEm: null,
        servico: null,
      },
    ]);
  });

  it("não guarda o nome do cliente — os pedidos apagam-se, esta tabela fica", () => {
    const LIB = readFileSync(join(process.cwd(), "src/lib/assistentes.ts"), "utf8");
    const tipo = LIB.slice(LIB.indexOf("export type TrabalhoPago = {"), LIB.indexOf("export type PagamentoDeComissao"));
    expect(tipo.length).toBeGreaterThan(0);
    expect(tipo).not.toMatch(/cliente|contact|telefone|email|morada/i);
  });
});

/**
 * O DIA EM QUE FICOU CONCLUÍDO tem de ser escrito em TODAS as passagens a
 * «concluído», e ANTES do estado: o MySQL avalia as atribuições de um UPDATE
 * da esquerda para a direita, e depois de `status = 'concluido'` o `IF` já via
 * o estado novo e nunca escrevia a data.
 */
describe("concluidoEm", () => {
  const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
  const GRAVA = "concluidoEm = IF(status = 'concluido', concluidoEm, NOW())";

  it("cada UPDATE que conclui um pedido grava a data, antes do estado", () => {
    // O SET de cada UPDATE, até ao WHERE. «Conclui» é ATRIBUIR o estado — no
    // princípio do SET ou depois de uma vírgula —, e não o `IF(status = …)`.
    const sets = [...DB.matchAll(/UPDATE simulatorOrders SET ([^`]*?)(?:\sWHERE\s|`)/g)].map((m) => m[1]);
    const ATRIBUI = /(^|,\s*)status = 'concluido'/;
    const queConcluem = sets.filter((s) => ATRIBUI.test(s));
    expect(queConcluem.length).toBeGreaterThanOrEqual(2);
    for (const s of queConcluem) {
      expect(s.indexOf(GRAVA)).toBeGreaterThan(-1);
      expect(s.indexOf(GRAVA)).toBeLessThan(s.search(ATRIBUI));
    }
  });

  it("e a passagem à mão, no backoffice, também — à frente das outras colunas", () => {
    const ini = DB.indexOf("export async function updateSimulatorOrder(");
    const corpo = DB.slice(ini, DB.indexOf("UPDATE simulatorOrders SET ${sets}", ini));
    expect(ini).toBeGreaterThan(-1);
    expect(corpo).toContain(`data.status === "concluido" ? "${GRAVA}, " : ""`);
    expect(corpo).toMatch(/const sets = quandoConcluiu \+ entries/);
  });

  it("a coluna está na lista das migrações, e a versão subiu com ela", () => {
    expect(DB).toContain("`ALTER TABLE simulatorOrders ADD COLUMN concluidoEm DATETIME NULL DEFAULT NULL`");
    expect(DB).toContain("`ALTER TABLE simulatorOrders ADD COLUMN precoClienteClyon DECIMAL(10,2) NULL DEFAULT NULL`");
    expect(Number(DB.match(/const MIGRATION_VERSION = (\d+);/)?.[1])).toBeGreaterThanOrEqual(18);
  });

  /*
   * Os que já estavam concluídos ganham a data uma vez, a seguir à coluna — e
   * sem o ON UPDATE do `updatedAt` a pôr tudo a «agora», que era mudar a
   * última mexida de todos os pedidos concluídos da base.
   */
  it("os concluídos de antes ganham a data uma vez, sem mexer no updatedAt", () => {
    const coluna = DB.indexOf("ADD COLUMN concluidoEm DATETIME");
    const enche = DB.search(/SET o\.concluidoEm = COALESCE\(n\.confirmadoEm, o\.updatedAt\), o\.updatedAt = o\.updatedAt/);
    expect(coluna).toBeGreaterThan(-1);
    expect(enche).toBeGreaterThan(coluna);
    expect(DB.slice(enche, enche + 300)).toMatch(/WHERE o\.status = 'concluido' AND o\.concluidoEm IS NULL/);
  });

  it("quem conclui pela plataforma garante a coluna antes de escrever nela", () => {
    for (const nome of ["confirmarExecucao", "libertarTrabalhosPorPrazo"]) {
      const ini = DB.indexOf(`export async function ${nome}(`);
      expect(ini).toBeGreaterThan(-1);
      const corpo = DB.slice(ini, DB.indexOf("SET concluidoEm", ini));
      expect(corpo).toContain("await ensureSimulatorOrdersTable();");
    }
  });
});
