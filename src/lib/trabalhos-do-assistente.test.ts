import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detalheDaComissao } from "./assistentes";
import { paraCsv } from "@/components/admin/TrabalhosDoAssistente";

/**
 * *«Quero mais detalhes dos trabalhos feitos para saber quais trabalhos o
 * assistente fez, para justificar os valores.»* — 29-09-2026.
 *
 * O cartão da Miriam dizia «4 concluídos · 22,88 €» e calava-se sobre quais.
 *
 * ⚠️ O DETALHE TEM DE SOMAR EXACTAMENTE O MESMO QUE O CARTÃO. Um extracto que
 * dá 22,87 € ao lado de um total de 22,88 € é pior do que não ter extracto: é
 * a prova de que um dos dois está errado, entregue à pessoa a quem se paga.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a conta linha a linha", () => {
  it("só os concluídos contam, e com a percentagem da CLYON e a dela", () => {
    const r = detalheDaComissao(
      [
        { id: 1, status: "concluido", valorAcordado: "100.00" },
        { id: 2, status: "em_analise", valorAcordado: "300.00" },
      ],
      11,
      40,
    );
    expect(r.trabalhos[0]).toMatchObject({ conta: true, valor: 100, comissaoClyon: 11, comissaoAssistente: 4.4 });
    expect(r.trabalhos[1].conta).toBe(false);
    expect(r.trabalhos[1].comissaoAssistente).toBe(0);
    expect(r.totais).toEqual({ valorConcluido: 100, comissaoClyon: 11, comissaoAssistente: 4.4 });
  });

  /*
   * A MESMA ORDEM DO COALESCE do cartão: acordado → preço final → estimativa.
   * E diz qual foi, porque «de onde veio este valor?» é a primeira pergunta.
   */
  it("o valor vem de onde vem no cartão, e diz de onde", () => {
    const r = detalheDaComissao(
      [
        { id: 1, status: "concluido", valorAcordado: 80, precoFinal: 90, estimateTotal: 100 },
        { id: 2, status: "concluido", precoFinal: 90, estimateTotal: 100 },
        { id: 3, status: "concluido", estimateTotal: 100 },
        { id: 4, status: "concluido" },
      ],
      10,
      50,
    );
    expect(r.trabalhos.map((t) => [t.valor, t.fonteDoValor])).toEqual([
      [80, "acordado"],
      [90, "preco_final"],
      [100, "estimativa"],
      [0, "sem_valor"],
    ]);
    expect(r.totais.valorConcluido).toBe(270);
  });

  /*
   * O TOTAL NÃO É A SOMA DAS LINHAS ARREDONDADAS — é a conta do cartão: soma
   * dos valores primeiro, percentagens depois. Três trabalhos de 33,33 € a
   * 11 % dão 3,67 € cada arredondado (11,01 €), mas o cartão diz 11 € certos.
   * O total tem de ser o do cartão, e é esse que se paga.
   */
  it("o total é calculado como o cartão, e não somando cêntimos arredondados", () => {
    const r = detalheDaComissao(
      [1, 2, 3].map((id) => ({ id, status: "concluido", valorAcordado: "33.33" })),
      11,
      100,
    );
    const somaDasLinhas = r.trabalhos.reduce((s, t) => s + t.comissaoClyon, 0);
    expect(Math.round(somaDasLinhas * 100) / 100).toBe(11.01);
    expect(r.totais.comissaoClyon).toBe(11);
  });

  it("valores em texto da base não viram NaN", () => {
    const r = detalheDaComissao([{ id: 1, status: "concluido", valorAcordado: "", precoFinal: null, estimateTotal: "abc" }], 11, 40);
    expect(r.trabalhos[0].fonteDoValor).toBe("sem_valor");
    expect(r.totais.comissaoAssistente).toBe(0);
  });
});

/**
 * O CARTÃO E O DETALHE LÊEM A MESMA COISA.
 *
 * Até 08-10-2026 eram duas consultas, cada uma com o seu COALESCE, e um teste
 * a exigir que dissessem o mesmo. Agora são uma só leitura
 * (`trabalhosQueContam`) e uma só conta (`comissoesPorPeriodo`): o cartão da
 * lista, o detalhe e o resumo da própria assistente saem todos daí, e o valor
 * de cada trabalho escolhe-se num sítio só (`detalheDaComissao`).
 */
describe("o detalhe e o cartão não se podem separar", () => {
  const LIB = ler("src/lib/assistentes.ts");
  // Da assinatura à chaveta que fecha a função, sozinha na linha — e não à do
  // tipo de retorno, que acaba em `} | undefined>`.
  const corpo = (nome: string) => {
    const ini = LIB.search(new RegExp(`(export )?async function ${nome}\\(`));
    expect(ini).toBeGreaterThan(-1);
    const resto = LIB.slice(ini);
    const fim = resto.search(/\r?\n\}\r?\n/);
    expect(fim).toBeGreaterThan(-1);
    return resto.slice(0, fim);
  };

  it("a lista e o detalhe fazem a mesma conta, sobre a mesma leitura e o mesmo alcance", () => {
    for (const nome of ["listarAssistentes", "comissoesDe"]) {
      const c = corpo(nome);
      expect(c).toContain("trabalhosQueContam()");
      expect(c).toContain("comissoesPorPeriodo(");
      expect(c).toContain("noAlcanceDe(");
    }
    expect(corpo("trabalhosDoAssistente")).toContain("comissoesDe(");
    expect(corpo("resumoDoAssistente")).toContain("comissoesDe(");
  });

  it("só contam negociações confirmadas pelo cliente", () => {
    expect(corpo("trabalhosQueContam")).toContain("WHERE x.confirmadoEm IS NOT NULL");
  });

  it("e só pedidos concluídos, sem as contas de teste", () => {
    const c = corpo("trabalhosQueContam");
    expect(c).toContain("WHERE o.status = 'concluido'");
    expect(c).toContain("COALESCE(n.deTeste, 0) = 0");
  });

  it("é a mesma porta de administrador — um assistente não vê a comissão de outro", () => {
    const ROTA = ler("src/app/api/admin/assistentes/route.ts");
    const get = ROTA.slice(ROTA.indexOf("export async function GET"), ROTA.indexOf("export async function POST"));
    expect(get).toContain("requireAdminGeral(req)");
    expect(get.indexOf("requireAdminGeral")).toBeLessThan(get.indexOf("trabalhosDoAssistente("));
  });

  it("e só o administrador marca um período como pago, ou o anula", () => {
    const ROTA = ler("src/app/api/admin/assistentes/route.ts");
    const post = ROTA.slice(ROTA.indexOf("export async function POST"));
    expect(post.indexOf("requireAdminGeral(req)")).toBeGreaterThan(-1);
    expect(post.indexOf("requireAdminGeral(req)")).toBeLessThan(post.indexOf("marcarPeriodoComoPago("));
    expect(post.indexOf("requireAdminGeral(req)")).toBeLessThan(post.indexOf("anularPagamentoDoPeriodo("));
  });
});

/**
 * *«Sim, mostra os períodos no painel dela.»* — 08-10-2026.
 *
 * Ela vê os seus, e só os seus: o id sai da sessão, nunca do endereço. E vê,
 * não mexe — pagar e anular são do administrador, aqui e na rota.
 */
describe("os períodos no painel da assistente", () => {
  const ROTA = ler("src/app/api/admin/sessao/eu/route.ts");
  const ramo = ROTA.slice(ROTA.indexOf('searchParams.has("periodos")'));

  it("são sempre os de quem chama", () => {
    expect(ROTA.indexOf("requireAdmin(req)")).toBeGreaterThan(-1);
    expect(ROTA.indexOf("requireAdmin(req)")).toBeLessThan(ROTA.indexOf('searchParams.has("periodos")'));
    expect(ramo).toContain("trabalhosDoAssistente(colab.id)");
    // Nenhum número lido do endereço.
    expect(ROTA).not.toMatch(/searchParams\.get\(/);
  });

  it("o administrador não passa por aqui", () => {
    expect(ramo.slice(0, ramo.indexOf("trabalhosDoAssistente("))).toContain('colab.papel !== "assistente"');
  });

  it("no painel dela não há pagar nem anular", () => {
    const COMP = ler("src/components/admin/TrabalhosDoAssistente.tsx");
    expect(COMP).toContain("const podeGerir = gerir != null;");
    expect(COMP).toMatch(/\{podeGerir && p\.estado === "por_pagar" && \(/);
    expect(COMP).toMatch(/\{podeGerir && p\.estado === "pago" && \(/);
    // O componente entra no ecrã dela: não pode trazer escrita a rota do administrador.
    expect(COMP).not.toContain("/api/admin/assistentes");
    const DELA = ler("src/components/admin/MinhaComissao.tsx");
    expect(DELA).toContain('fonte="/api/admin/sessao/eu?periodos=1"');
    expect(DELA).not.toMatch(/gerir=\{/);
  });
});

describe("o extracto para mandar à pessoa", () => {
  const d = {
    nome: "MIRIAM",
    comissaoPercent: 40,
    comissaoClyonPercent: 11,
    trabalhos: [
      {
        pedidoId: 346, estado: "concluido", conta: true, cliente: 'Ana "Tó" Silva', servico: "recolha_moveis",
        cidade: "Linda-a-Velha", profissional: "TRSul", atribuidoEm: null, actualizadoEm: null,
        valor: 40, fonteDoValor: "acordado" as const, comissaoClyon: 4.4, comissaoAssistente: 1.76,
      },
    ],
    totais: { valorConcluido: 40, comissaoClyon: 4.4, comissaoAssistente: 1.76 },
  };

  /*
   * `;` e vírgula decimal e BOM: é assim que o Excel português abre o ficheiro
   * com os acentos certos e os números como números. Com `,` a separar
   * colunas, cada valor em euros partia-se em duas células.
   */
  it("abre bem no Excel português", () => {
    const csv = paraCsv(d);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"#346";"concluido";"sim"');
    expect(csv).toContain('"40,00"');
    expect(csv).toContain('"TOTAL"');
    expect(csv).toContain('"1,76"');
  });

  it("aspas no nome de um cliente não partem a linha", () => {
    expect(paraCsv(d)).toContain('"Ana ""Tó"" Silva"');
  });
});
