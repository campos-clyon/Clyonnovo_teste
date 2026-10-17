import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { previsaoPorPeriodo, type LinhaQueAindaNaoConta } from "./assistentes";
import {
  relatorioDasComissoes,
  relatorioEmCsv,
  type PeriodoParaRelatorio,
  type PrevisaoParaRelatorio,
} from "./relatorio-das-comissoes";

/**
 * OS LUCROS DELA, PASSADOS E FUTUROS — 17-10-2026.
 *
 * *«Quero que aqui seja possível ver e gerir os lucros dela não só passados
 * mas futuros… o histórico de cada 15 dias e relatórios gerais.»* — o dono.
 * Escolheu: o 23/09–15/10 fica um período só; o preço do #422 escreve-se ali;
 * as quinzenas futuras com a previsão pelos trabalhos marcados; e o relatório
 * com tudo — quinzenas e totais, por mês, por operador, CSV.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const HOJE = "2026-10-17";
const MIRIAM = { id: 7, comissaoSobre: "todos" as const };

/** Um trabalho fechado à mão com o lucro escrito: o lucro é exactamente esse. */
const linha = (id: number, extra: Partial<LinhaQueAindaNaoConta> = {}): LinhaQueAindaNaoConta => ({
  id,
  status: "confirmado",
  contactName: `Cliente ${id}`,
  assignedToId: 7,
  assignedToName: "MIRIAM",
  profissional: "TRSul",
  lucroManual: 100,
  ...extra,
});
const marcado = (dia: string) => ({ dataCombinada: `${dia}T09:00:00.000Z` });

describe("a previsão das quinzenas", () => {
  const previsao = previsaoPorPeriodo({
    linhas: [
      linha(1, marcado("2026-10-19")),
      linha(2, { ...marcado("2026-11-05"), lucroManual: 50 }),
      // Marcado para um dia que já passou: conta-se hoje.
      linha(3, marcado("2026-10-10")),
      // Feito, à espera de confirmar: conta-se hoje.
      linha(4, { execucaoEnviadaEm: "2026-10-16T18:00:00.000Z" }),
      // Nunca contam.
      linha(5, { ...marcado("2026-10-20"), status: "cancelado" }),
      linha(6, { ...marcado("2026-10-20"), deTeste: 1 }),
      // Um Trabalho CLYON sem preço ao cliente: conta zero, e diz-se.
      linha(7, { ...marcado("2026-11-20"), lucroManual: null, valorFixoClyon: 200, precoClienteClyon: null }),
    ],
    a: MIRIAM,
    minhaPercent: 40,
    hoje: HOJE,
  });
  const de = (inicio: string) => previsao.find((p) => p.inicio === inicio);

  it("cada trabalho vai para a quinzena do dia marcado — ou de hoje, se o dia passou", () => {
    expect(previsao.map((p) => p.inicio)).toEqual(["2026-10-16", "2026-11-01", "2026-11-16"]);
    expect(de("2026-10-16")!.detalhe.map((t) => t.pedidoId)).toEqual([3, 4, 1]);
    expect(de("2026-11-01")!.detalhe.map((t) => t.pedidoId)).toEqual([2]);
    const tres = de("2026-10-16")!.detalhe.find((t) => t.pedidoId === 3)!;
    expect(tres).toMatchObject({ dia: HOJE, diaMarcado: false, motivo: "por_fazer" });
    expect(de("2026-10-16")!.detalhe.find((t) => t.pedidoId === 1)).toMatchObject({ dia: "2026-10-19", diaMarcado: true });
  });

  it("o lucro é o de quando contar, e a parte dela é a do total da quinzena", () => {
    expect(de("2026-10-16")).toMatchObject({ trabalhos: 3, lucro: 300, comissaoAssistente: 120, comissaoPercent: 40 });
    expect(de("2026-11-01")).toMatchObject({ trabalhos: 1, lucro: 50, comissaoAssistente: 20 });
  });

  it("cancelados e de contas de teste não entram; os sem valor contam zero e dizem-se", () => {
    const todos = previsao.flatMap((p) => p.detalhe.map((t) => t.pedidoId));
    expect(todos).not.toContain(5);
    expect(todos).not.toContain(6);
    expect(de("2026-11-16")).toMatchObject({ trabalhos: 1, lucro: 0, comissaoAssistente: 0, semValor: [7] });
  });

  it("com «só os dela», os dos outros ficam de fora", () => {
    const so = previsaoPorPeriodo({
      linhas: [linha(1, marcado("2026-10-19")), linha(2, { ...marcado("2026-10-19"), assignedToId: 9 })],
      a: { id: 7, comissaoSobre: "seus" },
      minhaPercent: 40,
      hoje: HOJE,
    });
    expect(so.flatMap((p) => p.detalhe.map((t) => t.pedidoId))).toEqual([1]);
  });

  it("a próxima quinzena aparece sempre, mesmo sem nada marcado — é a data do próximo fecho", () => {
    const vazia = previsaoPorPeriodo({ linhas: [], a: MIRIAM, minhaPercent: 40, hoje: HOJE });
    expect(vazia).toEqual([
      expect.objectContaining({ inicio: "2026-11-01", fim: "2026-11-15", trabalhos: 0, lucro: 0, comissaoAssistente: 0 }),
    ]);
  });
});

describe("o relatório geral", () => {
  const periodos: PeriodoParaRelatorio[] = [
    {
      inicio: "2026-10-16", fim: "2026-10-31", rotulo: "16/10 – 31/10/2026", estado: "em_curso",
      trabalhos: 1, lucro: 31.9, comissaoAssistente: 12.76, pago: null,
      detalhe: [{ operador: "MIRIAM", lucro: 31.9, comissaoAssistente: 12.76 }],
    },
    {
      inicio: "2026-09-23", fim: "2026-10-15", rotulo: "23/09 – 15/10/2026", estado: "por_pagar",
      trabalhos: 2, lucro: 908.58, comissaoAssistente: 363.43, pago: null,
      detalhe: [
        { operador: "MIRIAM", lucro: 500, comissaoAssistente: 200 },
        { operador: "Admin", lucro: 408.58, comissaoAssistente: 163.43 },
      ],
    },
  ];
  const previsao: PrevisaoParaRelatorio[] = [
    { inicio: "2026-10-16", fim: "2026-10-31", rotulo: "16/10 – 31/10/2026", trabalhos: 3, lucro: 100, comissaoAssistente: 40 },
    { inicio: "2026-11-01", fim: "2026-11-15", rotulo: "01/11 – 15/11/2026", trabalhos: 1, lucro: 50, comissaoAssistente: 20 },
  ];
  const r = relatorioDasComissoes(periodos, previsao);

  it("todas as quinzenas, da mais longe no futuro para a primeira", () => {
    expect(r.linhas.map((l) => [l.inicio, l.estado])).toEqual([
      ["2026-11-01", "previsto"],
      ["2026-10-16", "em_curso"],
      ["2026-09-23", "por_pagar"],
    ]);
    expect(r.linhas[1]).toMatchObject({ comissao: 12.76, previstoComissao: 40, previstoTrabalhos: 3 });
  });

  it("os totais: ganho é pago + por pagar + em curso; o previsto à parte", () => {
    expect(r.totais).toEqual({
      trabalhos: 3,
      lucro: 940.48,
      ganho: 376.19,
      pago: 0,
      porPagar: 363.43,
      emCurso: 12.76,
      previsto: 60,
    });
  });

  it("por mês somam-se quinzenas — a primeira conta em outubro, o mês em que fecha", () => {
    expect(r.porMes).toEqual([
      { mes: "2026-11", rotulo: "novembro de 2026", trabalhos: 0, lucro: 0, comissao: 0, previsto: 20 },
      { mes: "2026-10", rotulo: "outubro de 2026", trabalhos: 3, lucro: 940.48, comissao: 376.19, previsto: 40 },
    ]);
  });

  it("por operador, só o que já conta", () => {
    expect(r.porOperador).toEqual([
      { operador: "MIRIAM", trabalhos: 2, lucro: 531.9, comissao: 212.76 },
      { operador: "Admin", trabalhos: 1, lucro: 408.58, comissao: 163.43 },
    ]);
  });

  it("o CSV abre no Excel português e leva as quatro partes", () => {
    const csv = relatorioEmCsv("MIRIAM", 40, r);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Relatório de comissões — MIRIAM (40 % do lucro da CLYON)"');
    expect(csv).toContain('"01/11 – 15/11/2026";"previsto"');
    expect(csv).toContain('"TOTAL";"";"3";"940,48";"376,19"');
    expect(csv).toContain('"outubro de 2026";"3";"940,48";"376,19";"40,00"');
    expect(csv).toContain('"Admin";"1";"408,58";"163,43"');
  });
});

describe("as peças no código", () => {
  it("a consulta dos que ainda não contam lê o valor, para a previsão fazer a conta", () => {
    const db = ler("src/lib/assistentes.ts");
    const i = db.indexOf("export async function trabalhosQueAindaNaoContam(");
    const consulta = db.slice(i, db.indexOf("LIMIT 500", i));
    for (const campo of ["o.valorFixoClyon", "o.precoClienteClyon", "o.lucroManual", "n.valorAcordado", "n.taxaProfissional"]) {
      expect(consulta, campo).toContain(campo);
    }
    expect(db).toContain("const previsao = previsaoPorPeriodo({ linhas: porContar, a, minhaPercent: a.comissaoPercent, hoje });");
  });

  it("o preço ao cliente escreve-se no período, só pelo administrador, e fica no histórico", () => {
    const rota = ler("src/app/api/admin/assistentes/route.ts");
    const post = rota.slice(rota.indexOf("export async function POST"));
    const i = post.indexOf("corpo.precoDoPedido");
    expect(post.indexOf("requireAdminGeral(req)")).toBeLessThan(i);
    const bloco = post.slice(i, post.indexOf("corpo.dataDoPedido"));
    expect(bloco).toContain("lerPrecoAoCliente(precoCru)");
    expect(bloco).toContain("definirPrecoAoClienteClyon(pedidoId, lido.valor)");
    expect(bloco).toContain("appendOrderHistory(pedidoId,");
  });

  it("o campo do preço só aparece a quem gere", () => {
    const ecra = ler("src/components/admin/TrabalhosDoAssistente.tsx");
    expect(ecra).toContain("{podeGerir && gerirERecarregar && semPreco.length > 0 && (");
    expect(ecra).toContain("gerir({ precoDoPedido: { pedidoId, preco: texto } })");
  });
});
