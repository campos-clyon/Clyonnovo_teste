import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detalheDaComissao, lucroDoTrabalho } from "./assistentes";
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

describe("a conta linha a linha — sobre o lucro", () => {
  /*
   * *«Os 40 % da assistente passam a ser não dos 11 e sim dos lucros totais do
   * período.»* — 08-10-2026. O lucro de um pedido da plataforma são as taxas
   * dele: sem taxas gravadas, as de origem (5 % + 6 % = 11 %).
   */
  it("pedido da plataforma: as taxas dele sobre o acordado — e só os concluídos contam", () => {
    const r = detalheDaComissao(
      [
        { id: 1, status: "concluido", valorAcordado: "100.00" },
        { id: 2, status: "em_analise", valorAcordado: "300.00" },
      ],
      40,
    );
    expect(r.trabalhos[0]).toMatchObject({ conta: true, valor: 100, lucro: 11, comissaoAssistente: 4.4, fonteDoValor: "acordado" });
    expect(r.trabalhos[1]).toMatchObject({ conta: false, lucro: 0, comissaoAssistente: 0 });
    expect(r.totais).toEqual({ valorTrabalhos: 100, lucro: 11, comissaoAssistente: 4.4 });
    expect(r.pendentes).toEqual([]);
  });

  it("as taxas que a negociação gravou, e o acréscimo do «pagar depois»", () => {
    const r = detalheDaComissao(
      [{ id: 1, status: "concluido", valorAcordado: 100, taxaCliente: "0.05", taxaProfissional: "0.10", acrescimoPagamento: "3.00" }],
      40,
    );
    expect(r.trabalhos[0].lucro).toBe(18); // 100 × 15 % + 3
  });

  /*
   * O exemplo do dono: um Trabalho CLYON de 350 € sem IVA, com 20 % de taxa —
   * o profissional recebe 280 €, a CLYON fica com 70 €, e ela com 40 %: 28 €.
   */
  it("Trabalho CLYON de 350 € a 20 %: 70 € de lucro, 28 € para ela", () => {
    const r = detalheDaComissao(
      [
        {
          id: 1,
          status: "concluido",
          valorFixoClyon: 350,
          taxaClyon: 0.2,
          precoClienteClyon: 350,
          valorAcordado: 350,
          taxaCliente: 0,
          taxaProfissional: 0.2,
        },
      ],
      40,
    );
    expect(r.trabalhos[0]).toMatchObject({ valor: 350, lucro: 70, comissaoAssistente: 28, fonteDoValor: "preco_ao_cliente" });
  });

  it("Trabalho CLYON antigo (o valor era o que o pro recebia): o preço ao cliente menos esse valor", () => {
    const antigo = { id: 1, status: "concluido", valorFixoClyon: 260, valorAcordado: 260, taxaCliente: 0, taxaProfissional: 0 };
    expect(lucroDoTrabalho({ ...antigo, precoClienteClyon: 325 })).toEqual({ valor: 325, lucro: 65, fonte: "preco_ao_cliente" });
    const r = detalheDaComissao([antigo], 40);
    expect(r.trabalhos[0]).toMatchObject({ lucro: 0, fonteDoValor: "falta_preco_ao_cliente" });
    expect(r.pendentes).toEqual([{ pedidoId: 1, falta: "preco_ao_cliente" }]);
  });

  it("fechado à mão, sem negociação: o lucro escrito — ou pendente, sem ele", () => {
    const r = detalheDaComissao(
      [
        { id: 1, status: "concluido", precoFinal: 200, lucroManual: "50.00" },
        { id: 2, status: "concluido", precoFinal: 90, estimateTotal: 100 },
      ],
      40,
    );
    expect(r.trabalhos.map((t) => [t.valor, t.lucro, t.fonteDoValor])).toEqual([
      [200, 50, "lucro_manual"],
      [90, 0, "falta_lucro"],
    ]);
    expect(r.pendentes).toEqual([{ pedidoId: 2, falta: "lucro" }]);
    expect(r.totais).toEqual({ valorTrabalhos: 290, lucro: 50, comissaoAssistente: 20 });
  });

  /*
   * O TOTAL NÃO É A SOMA DAS LINHAS ARREDONDADAS: soma dos lucros primeiro,
   * percentagem depois. Três lucros de 3,33 € a 40 % dão 1,33 € cada
   * arredondado (3,99 €), mas 40 % de 9,99 € são 4,00 €. Paga-se o total.
   */
  it("a parte dela tira-se do lucro total, e não somando cêntimos arredondados", () => {
    const r = detalheDaComissao(
      [1, 2, 3].map((id) => ({ id, status: "concluido", lucroManual: "3.33" })),
      40,
    );
    const somaDasLinhas = r.trabalhos.reduce((s, t) => s + t.comissaoAssistente, 0);
    expect(Math.round(somaDasLinhas * 100) / 100).toBe(3.99);
    expect(r.totais.comissaoAssistente).toBe(4);
  });

  it("valores em texto da base não viram NaN", () => {
    const r = detalheDaComissao([{ id: 1, status: "concluido", valorAcordado: "", precoFinal: null, estimateTotal: "abc" }], 40);
    expect(r.trabalhos[0]).toMatchObject({ valor: 0, lucro: 0, fonteDoValor: "falta_lucro" });
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
    expect(c).toContain("COALESCE(c.deTeste, 0) = 0");
  });

  it("é a mesma porta de administrador — um assistente não vê a comissão de outro", () => {
    const ROTA = ler("src/app/api/admin/assistentes/route.ts");
    const get = ROTA.slice(ROTA.indexOf("export async function GET"), ROTA.indexOf("export async function POST"));
    expect(get).toContain("requireAdminGeral(req)");
    expect(get.indexOf("requireAdminGeral")).toBeLessThan(get.indexOf("trabalhosDoAssistente("));
  });

  /*
   * «Escrevo o lucro à mão» (08-10-2026) — só onde não há outra fonte, e só o
   * administrador: o número decide quanto se paga à sócia.
   */
  it("o lucro escrito à mão: só o administrador, e só em pedidos sem negociação nem Trabalho CLYON", () => {
    const ROTA = ler("src/app/api/admin/assistentes/route.ts");
    const post = ROTA.slice(ROTA.indexOf("export async function POST"));
    expect(post.indexOf("requireAdminGeral(req)")).toBeLessThan(post.indexOf("definirLucroManual("));
    expect(post).toContain("appendOrderHistory(pedidoId");
    const LIB = ler("src/lib/assistentes.ts");
    const definir = LIB.slice(LIB.indexOf("export async function definirLucroManual("));
    expect(definir.slice(0, 1500)).toContain("o.valorFixoClyon IS NULL");
    expect(definir.slice(0, 1500)).toContain("NOT EXISTS (SELECT 1 FROM negociacoes x WHERE x.pedidoId = o.id AND x.confirmadoEm IS NOT NULL)");
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
    trabalhos: [
      {
        pedidoId: 346, estado: "concluido", conta: true, cliente: 'Ana "Tó" Silva', servico: "recolha_moveis",
        cidade: "Linda-a-Velha", profissional: "TRSul", atribuidoEm: null, actualizadoEm: null,
        valor: 40, fonteDoValor: "acordado" as const, lucro: 4.4, comissaoAssistente: 1.76,
      },
    ],
    totais: { valorTrabalhos: 40, lucro: 4.4, comissaoAssistente: 1.76 },
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
