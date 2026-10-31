import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aosCentimos,
  balancoDosMeses,
  saldoInicialParaBater,
  diaPorExtenso,
  diaValido,
  diasDoMes,
  emEuros,
  lerCategoria,
  lerConta,
  lerEuros,
  lerMovimento,
  movimentosDaPlataforma,
  nomeDoMes,
  pedidoDoMovimento,
  porCategoria,
  resumoDoMes,
  saldoDaConta,
  saldoTotal,
  somarMeses,
  ultimoDiaDoMes,
  type Categoria,
  type Conta,
  type Movimento,
  type RecebimentoDaPlataforma,
} from "./financas";
import { assistenteComSeccoesPodeChamar, assistentePodeChamar } from "./papel-do-painel";
import PainelDasFinancas from "@/components/admin/financas/PainelDasFinancas";

/**
 * A GESTORA DE CONTAS DA CLYON — 14-10-2026.
 *
 * *«Quero que transforme a carteira nessa gestora de contas da CLYON, onde
 * podemos gerir os pagamentos e gastos da CLYON, valores recebidos e pagos,
 * com categorias, entre outros.»* — com o Mobills dele ao lado.
 *
 * O que se guarda: que o saldo é a soma do que aconteceu (e não do que ficou
 * por pagar, nem do que se mandou ignorar); que as transferências entre contas
 * não são receitas nem despesas; e, sobretudo, que o dinheiro da plataforma
 * entra uma vez, só o que passou mesmo pelas contas da CLYON.
 */

// Nos testes o JSX sai como `React.createElement` e precisa do `React` à mão.
(globalThis as { React?: typeof React }).React = React;

const BANCO: Conta = { id: 1, nome: "Banco", tipo: "banco", saldoInicial: 1000, cor: "azul", papel: "plataforma" };
const CAIXA: Conta = { id: 2, nome: "Caixa", tipo: "dinheiro", saldoInicial: 0, cor: "esmeralda", papel: "caixa" };
const CONTAS = [BANCO, CAIXA];

const COMBUSTIVEL: Categoria = { id: 10, nome: "Combustível", tipo: "despesa", cor: "ardosia", icone: "combustivel", sistema: null };
const SALARIOS: Categoria = { id: 11, nome: "Salários", tipo: "despesa", cor: "laranja", icone: "salario", sistema: null };
const TRABALHOS: Categoria = { id: 20, nome: "Trabalhos feitos", tipo: "receita", cor: "lima", icone: "trabalho", sistema: null };
const CATEGORIAS = [COMBUSTIVEL, SALARIOS, TRABALHOS];

let n = 0;
function mov(p: Partial<Movimento> & Pick<Movimento, "tipo" | "valor" | "dia">): Movimento {
  n += 1;
  return {
    id: `m${n}`,
    descricao: "",
    categoriaId: p.tipo === "despesa" ? COMBUSTIVEL.id : p.tipo === "receita" ? TRABALHOS.id : null,
    contaId: BANCO.id,
    contaDestinoId: null,
    efectivado: true,
    ignorado: false,
    notas: null,
    anexo: null,
    automatico: null,
    criadoPor: null,
    ...p,
  };
}

describe("os números", () => {
  it("euros com o ponto dos milhares, como no Mobills dele", () => {
    expect(emEuros(18640.1)).toBe("18.640,10 €");
    expect(emEuros(-6733.36)).toBe("-6.733,36 €");
    expect(emEuros(0)).toBe("0,00 €");
    expect(emEuros(2.99)).toBe("2,99 €");
  });

  it("lê o valor como as pessoas o escrevem", () => {
    expect(lerEuros("1.234,56")).toBe(1234.56);
    expect(lerEuros("12,5")).toBe(12.5);
    expect(lerEuros("12.50")).toBe(12.5);
    expect(lerEuros("€ 100")).toBe(100);
    expect(lerEuros(7.555)).toBe(7.56);
    expect(lerEuros("doze")).toBeNull();
    expect(lerEuros("")).toBeNull();
  });

  it("os meses passam o ano, e os dias são de calendário", () => {
    expect(somarMeses("2026-10", 3)).toBe("2027-01");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(nomeDoMes("2026-02")).toBe("Fevereiro de 2026");
    expect(ultimoDiaDoMes("2028-02")).toBe("2028-02-29");
    expect(diaPorExtenso("2026-10-14")).toBe("quarta-feira, 14 de outubro");
    expect(diaValido("2026-02-30")).toBe(false);
    expect(diaValido("2026-10-14")).toBe(true);
  });
});

describe("o saldo", () => {
  const movimentos = [
    mov({ tipo: "receita", valor: 240, dia: "2026-10-01" }),
    mov({ tipo: "despesa", valor: 100, dia: "2026-10-02" }),
    mov({ tipo: "transferencia", valor: 50, dia: "2026-10-03", contaId: BANCO.id, contaDestinoId: CAIXA.id, categoriaId: null }),
    mov({ tipo: "despesa", valor: 30, dia: "2026-10-04", contaId: CAIXA.id }),
    // Por pagar: lançado, mas não aconteceu.
    mov({ tipo: "despesa", valor: 500, dia: "2026-10-05", efectivado: false }),
    // Ignorado: fica à vista, e não conta.
    mov({ tipo: "despesa", valor: 999, dia: "2026-10-05", ignorado: true }),
  ];

  it("cada conta: o inicial, mais o que entrou, menos o que saiu — as transferências mudam de conta", () => {
    expect(saldoDaConta(BANCO, movimentos)).toBe(1000 + 240 - 100 - 50);
    expect(saldoDaConta(CAIXA, movimentos)).toBe(50 - 30);
  });

  it("o total não muda com uma transferência, e o por pagar e o ignorado não contam", () => {
    expect(saldoTotal(CONTAS, movimentos)).toBe(1000 + 240 - 100 - 30);
  });

  it("até um dia: o que veio depois ainda não aconteceu", () => {
    expect(saldoTotal(CONTAS, movimentos, "2026-10-01")).toBe(1240);
    expect(saldoTotal(CONTAS, movimentos, "2026-10-03")).toBe(1140);
  });

  it("acertar com o banco: escreve-se o saldo de hoje, e o inicial é o que sobra do que já está lançado", () => {
    // O dinheiro da plataforma traz meses de história; o saldo de hoje do
    // extracto, escrito como inicial, contava-a duas vezes.
    const comFuturo = [...movimentos, mov({ tipo: "receita", valor: 777, dia: "2026-12-01" })];
    const inicial = saldoInicialParaBater(BANCO, comFuturo, 14119.84, "2026-10-14");
    expect(inicial).toBe(aosCentimos(14119.84 - (240 - 100 - 50)));
    // E com esse inicial, a conta mostra hoje o mesmo que o banco.
    expect(saldoDaConta({ ...BANCO, saldoInicial: inicial }, comFuturo, "2026-10-14")).toBe(14119.84);
  });
});

describe("o mês", () => {
  const movimentos = [
    mov({ tipo: "receita", valor: 240, dia: "2026-10-01" }),
    mov({ tipo: "receita", valor: 150, dia: "2026-10-06", efectivado: false }),
    mov({ tipo: "despesa", valor: 100, dia: "2026-10-02" }),
    mov({ tipo: "despesa", valor: 300, dia: "2026-10-02", categoriaId: SALARIOS.id }),
    mov({ tipo: "despesa", valor: 999, dia: "2026-10-03", ignorado: true }),
    mov({ tipo: "transferencia", valor: 50, dia: "2026-10-03", contaDestinoId: CAIXA.id, categoriaId: null }),
    mov({ tipo: "despesa", valor: 70, dia: "2026-09-30" }),
  ];

  it("receitas e despesas do que aconteceu; o resto em «por acontecer»; sem transferências nem ignorados", () => {
    expect(resumoDoMes(movimentos, "2026-10")).toEqual({
      receitas: 240,
      despesas: 400,
      balanco: -160,
      receitasPrevistas: 150,
      despesasPrevistas: 0,
    });
  });

  it("por categoria, da maior para a menor, e as partes somam o todo", () => {
    const f = porCategoria(movimentos, CATEGORIAS, "2026-10", "despesa");
    expect(f.map((x) => x.categoria?.nome)).toEqual(["Salários", "Combustível"]);
    expect(f.map((x) => x.total)).toEqual([300, 100]);
    expect(f.reduce((s, x) => s + x.fraccao, 0)).toBeCloseTo(1, 10);
  });

  it("o balanço dos últimos seis meses, do mais antigo ao actual", () => {
    const b = balancoDosMeses(movimentos, "2026-10");
    expect(b.map((x) => x.mes)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(b[4]).toEqual({ mes: "2026-09", receitas: 0, despesas: 70 });
    expect(b[5]).toEqual({ mes: "2026-10", receitas: 240, despesas: 400 });
  });

  it("os dias, do mais recente, cada um com o saldo com que acabou — contando o mês anterior", () => {
    const dias = diasDoMes(CONTAS, movimentos, movimentos, "2026-10");
    expect(dias.map((d) => d.dia)).toEqual(["2026-10-06", "2026-10-03", "2026-10-02", "2026-10-01"]);
    // 1000 − 70 (setembro) + 240 = 1170 no fim de 1 de outubro.
    expect(dias[3].saldoNoFimDoDia).toBe(1170);
    expect(dias[2].saldoNoFimDoDia).toBe(770);
  });

  it("filtrar o que se vê não muda o saldo do dia — é o da conta, não a soma da lista", () => {
    const so = movimentos.filter((m) => m.tipo === "receita");
    const dias = diasDoMes(CONTAS, movimentos, so, "2026-10");
    expect(dias.map((d) => d.dia)).toEqual(["2026-10-06", "2026-10-01"]);
    expect(dias[1].saldoNoFimDoDia).toBe(1170);
  });

  it("dentro do dia, pelo número do pedido — o mais alto primeiro, e no mesmo pedido o que entrou antes do que saiu", () => {
    // 15-10-2026: «Organize pela ordem dos números dos pedidos.»
    const auto = (pedidoId: number, tipo: Movimento["tipo"], de: "recebimento" | "pago_ao_profissional") =>
      mov({ id: `auto:${de}:${pedidoId}`, tipo, valor: 10, dia: "2026-10-14", automatico: { de, pedidoId } });
    const doDia = [
      auto(391, "receita", "recebimento"),
      auto(422, "receita", "recebimento"),
      mov({ tipo: "despesa", valor: 5, dia: "2026-10-14", descricao: "Gasóleo" }),
      auto(428, "despesa", "pago_ao_profissional"),
      auto(390, "receita", "recebimento"),
      auto(428, "receita", "recebimento"),
      mov({ tipo: "despesa", valor: 7, dia: "2026-10-14", descricao: "Portagem do #313" }),
    ];
    const [dia] = diasDoMes(CONTAS, doDia, doDia, "2026-10");
    expect(dia.movimentos.map((m) => `${pedidoDoMovimento(m) ?? "—"}:${m.tipo}`)).toEqual([
      "428:receita",
      "428:despesa",
      "422:receita",
      "391:receita",
      "390:receita",
      "313:despesa",
      "—:despesa",
    ]);
  });

  it("o número do pedido vem da plataforma, ou de um «#123» escrito à mão", () => {
    expect(pedidoDoMovimento(mov({ tipo: "receita", valor: 1, dia: "2026-10-14", automatico: { de: "recebimento", pedidoId: 77 } }))).toBe(77);
    expect(pedidoDoMovimento(mov({ tipo: "despesa", valor: 1, dia: "2026-10-14", descricao: "Ajuste do #405" }))).toBe(405);
    expect(pedidoDoMovimento(mov({ tipo: "despesa", valor: 1, dia: "2026-10-14", descricao: "Gasóleo" }))).toBeNull();
  });

  it("com uma conta escolhida, o saldo do dia é o dessa conta", () => {
    const dias = diasDoMes(CONTAS, movimentos, movimentos, "2026-10", CAIXA.id);
    const dia3 = dias.find((d) => d.dia === "2026-10-03");
    expect(dia3?.saldoNoFimDoDia).toBe(50);
  });
});

describe("lançar à mão", () => {
  const ok = { tipo: "despesa", valor: "100,00", dia: "2026-10-14", categoriaId: COMBUSTIVEL.id, contaId: BANCO.id, descricao: "  IVECO 1 " };

  it("uma despesa certa passa, limpa", () => {
    const r = lerMovimento(ok, CONTAS, CATEGORIAS);
    expect(r).toEqual({
      ok: true,
      dados: {
        tipo: "despesa",
        valor: 100,
        dia: "2026-10-14",
        descricao: "IVECO 1",
        categoriaId: COMBUSTIVEL.id,
        contaId: BANCO.id,
        contaDestinoId: null,
        efectivado: true,
        ignorado: false,
        notas: null,
        anexoUrl: null,
        anexoNome: null,
      },
    });
  });

  it("recusa o que não bate certo, a dizer porquê", () => {
    const erro = (c: Record<string, unknown>) => {
      const r = lerMovimento({ ...ok, ...c }, CONTAS, CATEGORIAS);
      return r.ok ? null : r.erro;
    };
    expect(erro({ valor: "0" })).toMatch(/maior do que zero/);
    expect(erro({ valor: "dez" })).toMatch(/maior do que zero/);
    expect(erro({ dia: "2026-13-01" })).toMatch(/dia/);
    expect(erro({ contaId: 99 })).toMatch(/conta/);
    expect(erro({ categoriaId: TRABALHOS.id })).toBe("«Trabalhos feitos» é uma categoria de receitas.");
    expect(erro({ anexoUrl: "javascript:alert(1)" })).toMatch(/anexo/);
  });

  it("uma transferência vai de uma conta para outra, sem categoria", () => {
    const r = lerMovimento({ ...ok, tipo: "transferencia", contaDestinoId: CAIXA.id }, CONTAS, CATEGORIAS);
    expect(r.ok && r.dados.categoriaId).toBeNull();
    expect(r.ok && r.dados.contaDestinoId).toBe(CAIXA.id);
    const igual = lerMovimento({ ...ok, tipo: "transferencia", contaDestinoId: BANCO.id }, CONTAS, CATEGORIAS);
    expect(igual.ok).toBe(false);
  });

  it("contas e categorias novas", () => {
    expect(lerConta({ nome: "Cartão da empresa", tipo: "cartao", saldoInicial: "-120,50", cor: "coral" })).toEqual({
      ok: true,
      dados: { nome: "Cartão da empresa", tipo: "cartao", saldoInicial: -120.5, cor: "coral" },
    });
    expect(lerConta({ nome: "" }).ok).toBe(false);
    expect(lerCategoria({ nome: "Seguros", tipo: "despesa", cor: "azul", icone: "seguro" })).toEqual({
      ok: true,
      dados: { nome: "Seguros", tipo: "despesa", cor: "azul", icone: "seguro" },
    });
    // Cor e ícone desconhecidos não partem nada: ficam os de omissão.
    const r = lerCategoria({ nome: "X", tipo: "receita", cor: "dourado", icone: "foguete" });
    expect(r.ok && [r.dados.cor, r.dados.icone]).toEqual(["ardosia", "outros"]);
  });
});

describe("⚠️ o dinheiro da plataforma — entra sozinho, uma vez, e só o que passou pela CLYON", () => {
  const SISTEMA = { clientes: 30, dividas_dos_profissionais: 31, pagamentos_aos_profissionais: 32, comissoes_eupago: 33 } as const;
  const onde = { contaPlataforma: BANCO.id, contaCaixa: CAIXA.id, categoria: (s: keyof typeof SISTEMA) => SISTEMA[s] };

  const recebimento = (p: Partial<RecebimentoDaPlataforma>): RecebimentoDaPlataforma => ({
    id: 1,
    pedidoId: 421,
    metodo: "mbway",
    valor: 83.69,
    valorPago: 83.69,
    comissaoEupago: 0.58,
    pagoEm: "2026-10-13 23:30:00",
    ambiente: "producao",
    deTeste: false,
    contaDeTeste: false,
    formaDoTrabalho: "plataforma",
    cliente: "Célio Lameirão",
    profissional: "Revolution",
    ...p,
  });

  const so = (r: RecebimentoDaPlataforma) =>
    movimentosDaPlataforma({ recebimentos: [r], pagosAosProfissionais: [], levantamentos: [] }, onde);

  it("um pagamento do cliente pelo euPago: receita no banco, e a comissão do euPago à parte", () => {
    const [receita, comissao] = so(recebimento({}));
    expect(receita).toMatchObject({
      id: "auto:recebimento:1",
      tipo: "receita",
      valor: 83.69,
      categoriaId: SISTEMA.clientes,
      contaId: BANCO.id,
      descricao: "Célio Lameirão — #421 (MB WAY)",
      efectivado: true,
      automatico: { de: "recebimento", pedidoId: 421 },
    });
    expect(comissao).toMatchObject({ id: "auto:comissao:1", tipo: "despesa", valor: 0.58, categoriaId: SISTEMA.comissoes_eupago });
  });

  it("o dia é o de Lisboa: 23h30 em UTC a 13 de outubro já é dia 14 em Portugal", () => {
    expect(so(recebimento({}))[0].dia).toBe("2026-10-14");
  });

  it("numerário entregue à CLYON entra na caixa", () => {
    expect(so(recebimento({ metodo: "numerario", comissaoEupago: null }))[0].contaId).toBe(CAIXA.id);
  });

  it("o que o cliente pagou ao profissional, e a dívida abatida no saldo, não entraram na CLYON", () => {
    expect(so(recebimento({ metodo: "ao_profissional" }))).toEqual([]);
    expect(so(recebimento({ metodo: "abatimento" }))).toEqual([]);
  });

  it("o sandbox é de faz-de-conta", () => {
    expect(so(recebimento({ ambiente: "sandbox" }))).toEqual([]);
  });

  it("numa conta de teste, o anotado à mão não conta — o que o euPago confirmou, sim", () => {
    expect(so(recebimento({ contaDeTeste: true, metodo: "transferencia" }))).toEqual([]);
    const real = so(recebimento({ contaDeTeste: true, deTeste: true }));
    expect(real[0].descricao).toContain("pagamento de teste");
  });

  it("num trabalho em dinheiro, o pagamento é o profissional a pagar o IVA e a taxa da plataforma", () => {
    const [m] = so(recebimento({ formaDoTrabalho: "dinheiro", valorPago: 21.92, comissaoEupago: null }));
    expect(m.categoriaId).toBe(SISTEMA.dividas_dos_profissionais);
    expect(m.descricao).toBe("IVA e taxa da plataforma de Revolution — #421 (MB WAY)");
  });

  it("o que se transferiu aos profissionais: trabalhos pagos e levantamentos, menos as contas de teste", () => {
    const fora = movimentosDaPlataforma(
      {
        recebimentos: [],
        pagosAosProfissionais: [
          { negociacaoId: 7, pedidoId: 415, pagoEm: new Date("2026-10-10T10:00:00Z"), recebe: 60.91, profissional: "Revolution", contaDeTeste: false, formaDoTrabalho: null },
          { negociacaoId: 8, pedidoId: 356, pagoEm: new Date("2026-10-10T10:00:00Z"), recebe: 99, profissional: "Fred Teste", contaDeTeste: true, formaDoTrabalho: null },
          { negociacaoId: 9, pedidoId: 400, pagoEm: new Date("2026-10-10T10:00:00Z"), recebe: 50, profissional: "TRSul", contaDeTeste: false, formaDoTrabalho: "dinheiro" },
        ],
        levantamentos: [
          { id: 3, valor: 405.5, processadoEm: "2026-10-11 09:00:00", profissional: "Nova Recolha", contaDeTeste: false },
          { id: 4, valor: 10, processadoEm: "2026-10-11 09:00:00", profissional: "Fred Teste", contaDeTeste: true },
        ],
      },
      onde,
    );
    expect(fora.map((m) => [m.id, m.tipo, m.valor, m.categoriaId])).toEqual([
      ["auto:pago:7", "despesa", 60.91, SISTEMA.pagamentos_aos_profissionais],
      ["auto:levantamento:3", "despesa", 405.5, SISTEMA.pagamentos_aos_profissionais],
    ]);
    expect(fora[1].descricao).toBe("Levantamento de Nova Recolha");
  });

  it("os da plataforma não se editam por aqui: o id não é de um lançado à mão", () => {
    const [m] = so(recebimento({}));
    expect(m.id.startsWith("m")).toBe(false);
    expect(m.automatico).not.toBeNull();
  });
});

describe("quem vê e quem lança — «quem tiver a secção»", () => {
  it("um assistente com a secção das Carteiras lê e lança na gestora", () => {
    for (const [metodo, rota] of [
      ["GET", "/api/admin/financas"],
      ["POST", "/api/admin/financas/movimentos"],
      ["PATCH", "/api/admin/financas/movimentos"],
      ["POST", "/api/admin/financas/contas"],
      ["PATCH", "/api/admin/financas/categorias"],
    ]) {
      expect(assistenteComSeccoesPodeChamar(["carteiras"], rota, metodo), `${metodo} ${rota}`).toBe(true);
    }
  });

  it("apagar é do administrador, como em todo o backoffice", () => {
    expect(assistentePodeChamar("/api/admin/financas/movimentos", "DELETE")).toBe(false);
    const ROTA = readFileSync(join(process.cwd(), "src/app/api/admin/financas/movimentos/route.ts"), "utf8");
    const del = ROTA.slice(ROTA.indexOf("export async function DELETE"));
    expect(del).toContain("await requireAdminGeral(req)");
  });

  it("sem a secção, nada; e o ecrã de pagar aos profissionais continua «só ver» para o assistente", () => {
    expect(assistenteComSeccoesPodeChamar(["pagamentos"], "/api/admin/financas", "GET")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(["carteiras"], "/api/admin/carteiras", "POST")).toBe(false);
  });

  it("a secção chama-se Finanças no menu, e o id fica — os acessos já dados não se perdem", () => {
    const SHELL = readFileSync(join(process.cwd(), "src/components/admin/LegacyAdminClient.tsx"), "utf8");
    expect(SHELL).toContain('carteiras: "Finanças",');
    expect(SHELL).toContain('{activeSection === "carteiras" && <GestoraDeContas novasPorTransferir={novasAoAbrir.carteiras ?? 0} />}');
  });
});

describe("o painel, desenhado", () => {
  it("os quatro números do mês e as categorias, com as contas", () => {
    const movimentos = [
      mov({ tipo: "receita", valor: 11708, dia: "2026-10-01" }),
      mov({ tipo: "despesa", valor: 2567.29, dia: "2026-10-02", categoriaId: SALARIOS.id }),
      mov({ tipo: "despesa", valor: 700, dia: "2026-10-03" }),
    ];
    const html = renderToStaticMarkup(
      createElement(PainelDasFinancas, {
        contas: CONTAS,
        categorias: CATEGORIAS,
        movimentos,
        mes: "2026-10",
        hoje: "2026-10-14",
        onVerTransacoes: () => {},
        onLancar: () => {},
      }),
    ).replace(/<!-- -->/g, "");
    expect(html).toContain("Saldo atual");
    expect(html).toContain(emEuros(1000 + 11708 - 2567.29 - 700));
    expect(html).toContain("11.708,00 €");
    expect(html).toContain("3.267,29 €");
    expect(html).toContain("Despesas por categoria");
    expect(html).toContain("Salários");
    expect(html).toContain("78,6 %");
    // Sem receitas lançadas noutras categorias, a lista mostra só a que há.
    expect(html).toContain("Trabalhos feitos");
  });

  it("num mês passado, o saldo é o do fim desse mês", () => {
    const html = renderToStaticMarkup(
      createElement(PainelDasFinancas, {
        contas: CONTAS,
        categorias: CATEGORIAS,
        movimentos: [],
        mes: "2026-09",
        hoje: "2026-10-14",
        onVerTransacoes: () => {},
        onLancar: () => {},
      }),
    );
    expect(html).toContain("Saldo no fim do mês");
    expect(html).toContain("Ainda não há despesas neste mês.");
  });
});
