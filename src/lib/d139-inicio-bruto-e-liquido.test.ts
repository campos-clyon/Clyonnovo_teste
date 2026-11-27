import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Categoria, Movimento } from "./financas";
import type { Gasto } from "./financas-gastos";
import { contasDoMes, despesasNoIntervalo, type DadosDasContas } from "./financas-do-mes";
import { dinheiroDoInicio, intervalosDoInicio, margemDe, primeiroDiaDoTotal, type GanhoDoTrabalho } from "./dinheiro-do-inicio";
import { ganhosDosTrabalhos } from "./ganhos-dos-trabalhos";
import { taxaAPassarAClyon } from "./taxa-a-passar-a-clyon";
import { comissaoDaClyon } from "./taxas-plataforma";

/**
 * d139 — 27-11-2026 (dono): o Início com BRUTO (o que a CLYON ganhou com as
 * taxas, pelo dia do trabalho feito) e LÍQUIDO (bruto − despesas das
 * Finanças), o ano civil, os dois modelos, as contas de teste fora, e o
 * «Precisa de si» e as propostas das 24 h no topo da Mesa.
 * Todos os valores e nomes são inventados.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const CATEGORIAS: Categoria[] = [{ id: 1, nome: "Serviços", tipo: "despesa", cor: "azul", icone: "servicos", sistema: null }];

function gasto(p: Partial<Gasto>): Gasto {
  return { id: 1, nome: "Gasto inventado", valor: 30, categoriaId: null, tipo: "recorrente", inicio: "2026-10", dia: null, pausas: [], notas: null, criadoPor: null, ...p };
}

function mov(p: Partial<Movimento>): Movimento {
  return {
    id: "m1", tipo: "despesa", valor: 0, dia: "2026-11-05", descricao: "", categoriaId: 1, contaId: 1, contaDestinoId: null,
    efectivado: true, ignorado: false, notas: null, anexo: null, automatico: null, criadoPor: null, ...p,
  };
}

function contas(extra: Partial<DadosDasContas> = {}): DadosDasContas {
  return {
    entradas: [],
    movimentos: [mov({ valor: 5, dia: "2026-11-05" })],
    categorias: CATEGORIAS,
    gastos: [gasto({})],
    assistentes: [{ dia: "2026-10-31", valor: 10, nome: "Assistente inventada", periodo: "x", assistenteId: 3 }],
    ...extra,
  };
}

const T = (pedidoId: number, dia: string, ganho: number, semValor = false): GanhoDoTrabalho => ({ pedidoId, dia, ganho, semValor });

describe("bruto e líquido", () => {
  const trabalhos = [T(10, "2026-09-20", 40), T(11, "2026-10-12", 60), T(12, "2026-11-26", 25), T(13, "2026-11-27", 15)];
  const din = dinheiroDoInicio({ trabalhos, contas: contas(), hoje: "2026-11-27" });

  it("o bruto é a soma das taxas dos trabalhos feitos, sem descontar nada", () => {
    expect(din.hoje.bruto).toBe(15);
    expect(din.semana.bruto).toBe(40);
    expect(din.mes.bruto).toBe(40);
    expect(din.ano.bruto).toBe(140);
    expect(din.total.bruto).toBe(140);
    expect(din.mes.trabalhos).toBe(2);
  });

  it("o líquido é o bruto menos as despesas das Finanças", () => {
    // Mês: recorrente 30 + despesa lançada 5 = 35.
    expect(din.mes.despesas.total).toBe(35);
    expect(din.mes.liquido).toBe(5);
    // Ano: recorrente out + nov (60) + lançada 5 + assistente de outubro 10 = 75.
    expect(din.ano.despesas.total).toBe(75);
    expect(din.ano.liquido).toBe(65);
    expect(din.ano.margem).toBe(46.4);
  });

  it("as despesas de um mês inteiro são as das Finanças (gastos + assistentes)", () => {
    const c = contas();
    const f = contasDoMes(c, "2026-10");
    expect(despesasNoIntervalo(c, "2026-10-01", "2026-10-31", "mes_inteiro").total).toBe(
      Math.round((f.gastos.total + (f.assistentes ?? 0)) * 100) / 100,
    );
  });

  it("o bruto nunca é menor no ano do que no mês, nem no total do que no ano (com ganhos positivos)", () => {
    expect(din.ano.bruto).toBeGreaterThanOrEqual(din.mes.bruto);
    expect(din.total.bruto).toBeGreaterThanOrEqual(din.ano.bruto);
  });

  it("a margem é líquido ÷ bruto; sem bruto não há margem", () => {
    expect(margemDe(25, 100)).toBe(25);
    expect(margemDe(-10, 0)).toBeNull();
  });

  it("os trabalhos sem valor conhecido contam 0 e dizem-se", () => {
    const d = dinheiroDoInicio({ trabalhos: [T(20, "2026-11-27", 0, true)], contas: contas(), hoje: "2026-11-27" });
    expect(d.hoje.semValor).toBe(1);
    expect(d.hoje.bruto).toBe(0);
  });
});

describe("o ano civil e o total", () => {
  it("o ano vai de 1 de janeiro a hoje; um trabalho de dezembro do ano passado não entra", () => {
    const iv = intervalosDoInicio("2027-01-05");
    expect(iv.ano.de).toBe("2027-01-01");
    const d = dinheiroDoInicio({ trabalhos: [T(1, "2026-12-30", 50), T(2, "2027-01-02", 20)], contas: contas({ gastos: [], movimentos: [], assistentes: [] }), hoje: "2027-01-05" });
    expect(d.ano.bruto).toBe(20);
    expect(d.total.bruto).toBe(70);
    expect(d.total.de).toBe("2026-12-30");
  });

  it("o total começa no primeiro dia com dinheiro (um gasto conta desde o mês dele)", () => {
    expect(primeiroDiaDoTotal([T(1, "2026-09-20", 1)], contas(), "2026-11-27")).toBe("2026-09-20");
    expect(primeiroDiaDoTotal([T(1, "2026-11-20", 1)], contas(), "2026-11-27")).toBe("2026-10-01");
  });
});

describe("os dois modelos e as contas de teste", () => {
  const base = { status: "concluido", concluidoEm: "2026-11-20 10:00:00" };

  it("antes de 15-11: a parte da CLYON do acordado, no dia do trabalho feito", () => {
    const g = ganhosDosTrabalhos(
      [{ id: 1, ...base, valorAcordado: 200, taxaCliente: 0.05, taxaProfissional: 0.06, feitoEm: "2026-11-10 09:00:00" }],
      "2026-11-27",
    );
    expect(g).toEqual([{ pedidoId: 1, dia: "2026-11-10", ganho: comissaoDaClyon(200, { cliente: 0.05, profissional: 0.06 }), semValor: false }]);
  });

  it("desde 15-11: a taxa que o parceiro passa (a base da fatura da CLYON, sem IVA), quando o trabalho é feito", () => {
    const taxas = { cliente: 0.05, profissional: 0.06 };
    const [g] = ganhosDosTrabalhos([{ id: 2, ...base, valorAcordado: 300, taxaCliente: 0.05, taxaProfissional: 0.06, feitoEm: "2026-11-18 09:00:00" }], "2026-11-27");
    expect(g.dia).toBe("2026-11-18");
    expect(g.ganho).toBeCloseTo(taxaAPassarAClyon(300, taxas)!.comissao, 2);
  });

  it("só os concluídos contam, e nunca um dia depois de hoje", () => {
    const g = ganhosDosTrabalhos(
      [
        { id: 3, status: "confirmado", valorAcordado: 100, concluidoEm: "2026-11-20 10:00:00" },
        { id: 4, ...base, valorAcordado: 100, feitoEm: "2026-11-29 09:00:00" },
      ],
      "2026-11-27",
    );
    expect(g).toEqual([]);
  });

  it("a leitura dos trabalhos tira as contas de teste e é a das comissões", () => {
    const a = ler("src/lib/assistentes.ts");
    const i = a.indexOf("export async function trabalhosQueContam(");
    expect(a.slice(i, i + 3000)).toContain("COALESCE(c.deTeste, 0) = 0");
    const g = ler("src/lib/ganhos-dos-trabalhos.ts");
    expect(g).toContain("trabalhosQueContam(DESDE_SEMPRE)");
    expect(g).toContain("lucroDoTrabalho(l)");
    expect(g).toContain("diaQueConta(l)");
  });
});

describe("o ecrã", () => {
  it("o Dinheiro tem duas linhas — bruto e líquido — com a margem, e sem «A pagar a profissionais»", () => {
    const e = ler("src/components/admin/DinheiroDoInicio.tsx");
    expect(e).toContain("<b className=\"text-slate-200\">Bruto</b>");
    expect(e).toContain("<b className=\"text-slate-200\">Líquido</b>");
    expect(e).toContain("A receber dos profissionais");
    expect(e).toContain("Margem do mês");
    expect(e).not.toContain("A pagar a profissionais");
    expect(ler("src/lib/dinheiro-do-inicio.ts")).toContain('total: "Total até hoje"');
  });

  it("o «Precisa de si» e as propostas das 24 h saíram do Início e estão no topo da Mesa", () => {
    const inicio = ler("src/components/admin/AdminInicioPanel.tsx");
    expect(inicio).not.toContain("PropostasSemResposta");
    expect(inicio).not.toContain("Precisa de si\"");
    expect(inicio).not.toContain("sem valor há mais de");
    const mesa = ler("src/components/admin/PrecisaDeSiNaMesa.tsx");
    expect(mesa).toContain("<PropostasSemResposta");
    expect(mesa).toContain('"Precisa de si"');
    for (const t of ["atrasados", "à espera de si", "sem dia marcado", "candidaturas", "por aprovar", "fora da grelha (semana)"]) {
      expect(mesa).toContain(t);
    }
    const shell = ler("src/components/admin/LegacyAdminClient.tsx");
    const i = shell.indexOf('{activeSection === "negociacoes_clyon" && (');
    const bloco = shell.slice(i, shell.indexOf("<AdminNegociacoesPanel", i));
    expect(bloco).toContain("<PrecisaDeSiNaMesa");
  });
});
