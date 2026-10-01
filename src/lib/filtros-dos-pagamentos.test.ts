import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  agrupar,
  dataDeReferencia,
  dentroDoIntervalo,
  intervaloDoPeriodo,
  tituloDoDia,
  type DatasDoTrabalho,
} from "./filtros-dos-pagamentos";

/**
 * OS FILTROS DOS PAGAMENTOS.
 *
 * *«Corrija a secção pagamentos, coloque filtros para ser mais fácil de
 * identificar, separe por profissional e datas.»* — 01-10-2026.
 *
 * O que se testa aqui são as contas que mais se enganam — a meia-noite, o mês
 * anterior, o último dia de um intervalo — e a regra que impede o filtro de
 * esconder dinheiro em silêncio.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

/* Quinta, 1 de outubro de 2026, às 14h — na hora local. */
const AGORA = new Date(2026, 9, 1, 14, 0);
const iso = (a: number, m: number, d: number, h = 12) => new Date(a, m - 1, d, h).toISOString();

describe("cada separador filtra pela sua data", () => {
  const t: DatasDoTrabalho = {
    dataDoTrabalho: iso(2026, 8, 28),
    clientePagouEm: iso(2026, 9, 2),
    confirmadoEm: iso(2026, 9, 5),
    pagoEm: iso(2026, 10, 1),
  };

  it("o que entrou, pelo dia em que entrou; o que se transferiu, pelo dia da transferência", () => {
    /*
     * Feito em Agosto, pago pelo cliente em Setembro, transferido em Outubro.
     * «Pagos aos pros este mês» tem de o apanhar; filtrado pela data do
     * trabalho, ficava em Agosto e não batia com o extracto do banco.
     */
    expect(dataDeReferencia(t, "por_receber")).toBe(t.dataDoTrabalho);
    expect(dataDeReferencia(t, "recebidos")).toBe(t.clientePagouEm);
    expect(dataDeReferencia(t, "por_pagar")).toBe(t.confirmadoEm);
    expect(dataDeReferencia(t, "pagos")).toBe(t.pagoEm);
  });

  it("e o que ainda não aconteceu cai na data do trabalho", () => {
    const novo: DatasDoTrabalho = { ...t, clientePagouEm: null, confirmadoEm: null, pagoEm: null };
    expect(dataDeReferencia(novo, "por_pagar")).toBe(novo.dataDoTrabalho);
    expect(dataDeReferencia(novo, "pagos")).toBe(novo.dataDoTrabalho);
  });
});

describe("os períodos", () => {
  const dentro = (p: Parameters<typeof intervaloDoPeriodo>[0], quando: string, entre?: { de?: string; ate?: string }) =>
    dentroDoIntervalo(quando, intervaloDoPeriodo(p, AGORA, entre));

  it("qualquer data não filtra nada — nem o que não tem data", () => {
    expect(intervaloDoPeriodo("todos", AGORA)).toBeNull();
    expect(dentroDoIntervalo(null, null)).toBe(true);
  });

  it("hoje é de hoje à meia-noite até amanhã à meia-noite", () => {
    expect(dentro("hoje", iso(2026, 10, 1, 0))).toBe(true);
    expect(dentro("hoje", iso(2026, 10, 1, 23))).toBe(true);
    expect(dentro("hoje", iso(2026, 9, 30, 23))).toBe(false);
  });

  it("ontem é ontem", () => {
    expect(dentro("ontem", iso(2026, 9, 30, 9))).toBe(true);
    expect(dentro("ontem", iso(2026, 10, 1, 9))).toBe(false);
  });

  it("os últimos 7 dias contam com hoje", () => {
    expect(dentro("7dias", iso(2026, 9, 25, 8))).toBe(true);
    expect(dentro("7dias", iso(2026, 9, 24, 23))).toBe(false);
    expect(dentro("7dias", iso(2026, 10, 1, 20))).toBe(true);
  });

  it("este mês e o mês passado, pelas fronteiras do calendário", () => {
    expect(dentro("este_mes", iso(2026, 10, 1, 0))).toBe(true);
    expect(dentro("este_mes", iso(2026, 9, 30, 23))).toBe(false);
    expect(dentro("mes_passado", iso(2026, 9, 1, 0))).toBe(true);
    expect(dentro("mes_passado", iso(2026, 9, 30, 23))).toBe(true);
    expect(dentro("mes_passado", iso(2026, 8, 31, 23))).toBe(false);
  });

  it("o mês passado de Janeiro é Dezembro do ano anterior", () => {
    const i = intervaloDoPeriodo("mes_passado", new Date(2027, 0, 15))!;
    expect(i.de.getFullYear()).toBe(2026);
    expect(i.de.getMonth()).toBe(11);
  });

  it("«entre datas» conta o último dia INTEIRO", () => {
    /*
     * Quem escreve «até 30 de setembro» está a contar com o dia 30. Um `ate`
     * à meia-noite do dia 30 deixava-o de fora.
     */
    const entre = { de: "2026-09-01", ate: "2026-09-30" };
    expect(dentro("entre", iso(2026, 9, 30, 22), entre)).toBe(true);
    expect(dentro("entre", iso(2026, 10, 1, 0), entre)).toBe(false);
    expect(dentro("entre", iso(2026, 9, 1, 0), entre)).toBe(true);
  });

  it("«entre datas» só com um dos lados funciona, e sem nenhum não filtra", () => {
    expect(dentro("entre", iso(2027, 5, 1), { de: "2026-09-01" })).toBe(true);
    expect(dentro("entre", iso(2026, 8, 1), { de: "2026-09-01" })).toBe(false);
    expect(intervaloDoPeriodo("entre", AGORA, { de: "", ate: "" })).toBeNull();
  });

  it("com período, o que não tem data fica de fora — e o ecrã diz quantos", () => {
    expect(dentroDoIntervalo(null, intervaloDoPeriodo("hoje", AGORA))).toBe(false);
    const PAINEL = semNotas(ler("src/components/admin/AdminPagamentosPanel.tsx"));
    expect(PAINEL).toContain("semDataDeFora");
    expect(PAINEL).toContain("sem data ficaram");
  });
});

describe("separar a lista", () => {
  type L = { id: number; pro: { id: number; nome: string }; data: string | null };
  const linhas: L[] = [
    { id: 1, pro: { id: 12, nome: "Revolution" }, data: iso(2026, 9, 30) },
    { id: 2, pro: { id: 3, nome: "estofos kld lda" }, data: iso(2026, 10, 1) },
    { id: 3, pro: { id: 12, nome: "Revolution" }, data: null },
    { id: 4, pro: { id: 15, nome: "Nova Recolha" }, data: iso(2026, 10, 1, 18) },
  ];
  const como = { profissional: (l: L) => l.pro, data: (l: L) => l.data };

  it("por profissional, de A a Z, com todos os dele juntos", () => {
    const g = agrupar(linhas, "profissional", como, AGORA);
    expect(g.map((x) => x.titulo)).toEqual(["estofos kld lda", "Nova Recolha", "Revolution"]);
    expect(g[2].linhas.map((l) => l.id)).toEqual([1, 3]);
  });

  it("por dia, do mais recente para trás, e os sem data no fim — nunca somem", () => {
    const g = agrupar(linhas, "dia", como, AGORA);
    expect(g.map((x) => x.titulo)).toEqual(["Hoje", "Ontem", "Sem data"]);
    expect(g[0].linhas.map((l) => l.id)).toEqual([2, 4]);
    expect(g.reduce((n, x) => n + x.linhas.length, 0)).toBe(linhas.length);
  });

  it("dois profissionais com o mesmo nome não se misturam", () => {
    const g = agrupar(
      [
        { id: 1, pro: { id: 1, nome: "Rui" }, data: null },
        { id: 2, pro: { id: 2, nome: "Rui" }, data: null },
      ],
      "profissional",
      como,
      AGORA,
    );
    expect(g).toHaveLength(2);
  });

  it("e «nada» é a lista tal e qual", () => {
    const g = agrupar(linhas, "nada", como, AGORA);
    expect(g).toHaveLength(1);
    expect(g[0].linhas).toHaveLength(4);
  });

  it("o título do dia diz Hoje, Ontem, ou o dia por extenso", () => {
    expect(tituloDoDia(new Date(2026, 9, 1), AGORA)).toBe("Hoje");
    expect(tituloDoDia(new Date(2026, 8, 30), AGORA)).toBe("Ontem");
    expect(tituloDoDia(new Date(2026, 8, 28), AGORA)).toBe("Segunda, 28 de setembro");
    expect(tituloDoDia(new Date(2025, 11, 24), AGORA)).toBe("Quarta, 24 de dezembro de 2025");
  });
});

describe("o painel e a rota", () => {
  const PAINEL = semNotas(ler("src/components/admin/AdminPagamentosPanel.tsx"));
  const ROTA = semNotas(ler("src/app/api/admin/pagamentos/route.ts"));

  it("a rota manda o dia do trabalho: o combinado, o pedido, ou o do «feito»", () => {
    expect(ROTA).toContain("n.dataCombinada, n.execucaoEnviadaEm");
    expect(ROTA).toContain("o.dataAgendada");
    expect(ROTA).toContain("dataDoTrabalho: iso(l.dataCombinada) ?? iso(l.dataAgendada) ?? iso(l.execucaoEnviadaEm)");
  });

  it("o painel filtra por profissional pelo NÚMERO dele, e não pelo nome", () => {
    expect(PAINEL).toContain("String(t.providerId) === profissional");
  });

  it("os quatro separadores contam com os mesmos filtros", () => {
    expect(PAINEL).toContain("dentroDoIntervalo(dataDeReferencia(t, s.id), intervalo)");
  });

  it("e os filtros não se guardam — só a maneira de separar", () => {
    /*
     * Um filtro esquecido de ontem escondia hoje um pagamento. Este é o ecrã
     * do dinheiro.
     */
    expect(PAINEL).toContain("CHAVE_DO_AGRUPAMENTO");
    expect(PAINEL.match(/localStorage\.setItem\(/g)).toHaveLength(1);
  });

  it("e cada linha diz o serviço e o dia", () => {
    expect(PAINEL).toContain("nomeDoServico(t.servico)");
    expect(PAINEL).toContain("dia {DIA(t.dataDoTrabalho)}");
  });
});
