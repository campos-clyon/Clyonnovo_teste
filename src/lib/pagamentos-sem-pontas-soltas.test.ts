import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  consultaDaPago,
  fechaPorCaducar,
  pagamentoEmVigor,
  pagamentoForaDeVigor,
} from "./conferir-o-pagamento";
import {
  ambienteDaAssinatura,
  confereComOPedido,
  lerAvisoDoEupago,
  referenciasIguais,
  todosOsSegredos,
  type AvisoDoEupago,
} from "./webhook-do-eupago";
import { comoORecebemos, pagamentoDoClienteParaMostrar } from "./pagamento-visto-pelo-cliente";
import { recebidoDoCliente } from "./dinheiro-do-trabalho";
import { configuracaoDoEupago } from "./eupago";

/**
 * OS PAGAMENTOS SEM PONTAS SOLTAS — 27-10-2026 (d16).
 *
 * As regras puras dos oito riscos da auditoria do euPago. As rotas estão em
 * `webhook-do-eupago-rota.test.ts` e `conferir-pagamentos-rotina.test.ts`; o
 * SQL em `pagamentos-na-base-sql.test.ts`.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const DIA = 86_400_000;

describe("R3 — as referências caducadas fecham-se, com folga", () => {
  const agora = Date.parse("2026-10-27T12:00:00Z");
  it("Multibanco com o prazo passado há mais de 2 dias fecha", () => {
    expect(fechaPorCaducar({ metodo: "multibanco", expiraEm: new Date(agora - 2.5 * DIA) }, agora)).toBe(true);
  });
  it("dentro da folga, sem prazo, ou MB WAY, não fecha", () => {
    expect(fechaPorCaducar({ metodo: "multibanco", expiraEm: new Date(agora - 1 * DIA) }, agora)).toBe(false);
    expect(fechaPorCaducar({ metodo: "multibanco", expiraEm: null }, agora)).toBe(false);
    expect(fechaPorCaducar({ metodo: "mbway", expiraEm: new Date(agora - 9 * DIA) }, agora)).toBe(false);
  });
});

describe("R4 — o valor em vigor é o da referência mais recente", () => {
  const todos = [
    { id: 1, valor: 300, estado: "substituido", metodo: "multibanco" },
    { id: 2, valor: 452.03, estado: "pendente", metodo: "multibanco" },
    { id: 3, valor: 999, estado: "falhado", metodo: "mbway" },
    { id: 4, valor: 452.03, estado: "pago", metodo: "transferencia" },
  ];
  it("ignora as falhadas e os registos à mão", () => {
    expect(pagamentoEmVigor(todos)!.id).toBe(2);
  });
  it("a antiga de outro valor fica fora de vigor, para devolver", () => {
    expect(pagamentoForaDeVigor(todos[0], todos)).toMatch(/devolver/);
  });
  it("a em vigor, ou uma antiga do mesmo valor, pode fechar o pedido", () => {
    expect(pagamentoForaDeVigor(todos[1], todos)).toBeNull();
    expect(pagamentoForaDeVigor({ ...todos[0], valor: 452.03 }, todos)).toBeNull();
  });
  it("gerar uma referência nova anula as anteriores — nas três portas que geram", () => {
    // As três chamam marcarPedido, e é lá que as anteriores passam a substituído.
    const base = semComentarios(ler("src/lib/pagamentos-na-base.ts"));
    const marcar = base.slice(base.indexOf("export async function marcarPedido"));
    expect(marcar.slice(0, marcar.indexOf("\n}\n"))).toContain("await substituirAsAnteriores(id);");
    for (const f of [
      "src/app/api/admin/pagamentos/criar/route.ts",
      "src/app/api/pagamentos/route.ts",
      "src/lib/cobrar-divida-do-profissional.ts",
    ]) {
      expect(semComentarios(ler(f)), f).toContain("await marcarPedido(pagamentoId");
    }
  });
});

describe("R5 — quem assinou decide o ambiente; a referência tem de bater", () => {
  const corpo = '{"transactions":{"trid":"1"}}';
  const assina = (s: string) => crypto.createHmac("sha256", s).update(corpo, "utf8").digest("base64");
  const config = { ambiente: "producao" as const, segredoDoWebhook: "P", segredoDoWebhookSandbox: "S" };

  it("o segredo principal é do ambiente configurado; o da sandbox é sandbox; outro, nenhum", () => {
    expect(ambienteDaAssinatura(corpo, assina("P"), config)).toBe("producao");
    expect(ambienteDaAssinatura(corpo, assina("S"), config)).toBe("sandbox");
    expect(ambienteDaAssinatura(corpo, assina("X"), config)).toBeNull();
    expect(todosOsSegredos(config)).toBe("P,S");
    expect(todosOsSegredos({ segredoDoWebhook: "P" })).toBe("P");
  });

  it("o segredo da sandbox lê-se da sua própria variável", () => {
    const r = configuracaoDoEupago({ EUPAGO_API_KEY: "k", EUPAGO_WEBHOOK_SEGREDO_SANDBOX: " S " });
    expect(r.ok && r.config.segredoDoWebhookSandbox).toBe("S");
  });

  const aviso = (referencia: string | null): AvisoDoEupago => {
    const l = lerAvisoDoEupago({
      transactions: {
        trid: "9",
        identifier: "clyon-site-7",
        status: "Paid",
        amount: { value: 10, currency: "EUR" },
        ...(referencia ? { reference: referencia } : {}),
      },
    });
    if (!l.ok) throw new Error(l.porque);
    return l.aviso;
  };

  it("referência diferente, ou outro ambiente, não confere", () => {
    const esperado = { pagamentoId: 7, valor: 10, referencia: "104295830", ambiente: "producao" as const };
    expect(confereComOPedido(aviso("104295830"), esperado, "producao")).toBeNull();
    expect(confereComOPedido(aviso(null), esperado, "producao")).toBeNull();
    expect(confereComOPedido(aviso("100000017"), esperado, "producao")).toMatch(/referência/);
    expect(confereComOPedido(aviso("104295830"), esperado, "sandbox")).toMatch(/ambiente/);
  });

  it("a mesma referência com espaços ou zeros à esquerda é a mesma", () => {
    expect(referenciasIguais("104 295 830", "104295830")).toBe(true);
    expect(referenciasIguais("0104295830", "104295830")).toBe(true);
    expect(referenciasIguais("104295831", "104295830")).toBe(false);
  });
});

describe("R6 — a consulta só dá por pago com o valor dito e a bater", () => {
  it("sem valor → por confirmar", () => {
    expect(consultaDaPago({ pago: true, valor: null }, 120)).toMatchObject({ aplicar: false, porConfirmar: true });
  });
  it("outro valor → por confirmar", () => {
    expect(consultaDaPago({ pago: true, valor: 12 }, 120)).toMatchObject({ aplicar: false, porConfirmar: true });
  });
  it("não paga → nada", () => {
    expect(consultaDaPago({ pago: false, valor: 120 }, 120)).toMatchObject({ aplicar: false, porConfirmar: false });
  });
  it("o valor certo → aplica, com o valor do euPago", () => {
    expect(consultaDaPago({ pago: true, valor: 120.004 }, 120)).toEqual({ aplicar: true, valor: 120.004 });
  });
});

describe("R7 — o cliente vê «pago» depois do trabalho feito, com o método certo", () => {
  it("o método certo, e nunca «Multibanco» num registo à mão", () => {
    expect(comoORecebemos("mbway")).toBe("por MB WAY");
    expect(comoORecebemos("multibanco")).toBe("por Multibanco");
    expect(comoORecebemos("transferencia")).toBe("por transferência");
    expect(comoORecebemos("numerario")).toBe("em numerário");
    expect(comoORecebemos("outra_coisa")).toBeNull();
  });

  it("a dívida do profissional não aparece ao cliente como pagamento dele", () => {
    const pagos = [{ estado: "pago", metodo: "multibanco" }];
    expect(pagamentoDoClienteParaMostrar(pagos, false)).toBeNull();
    expect(pagamentoDoClienteParaMostrar([{ estado: "pago", metodo: "abatimento" }], true)).toBeNull();
    expect(pagamentoDoClienteParaMostrar(pagos, true)).toEqual(pagos[0]);
  });

  it("a página do pedido mostra o «pago» também nas fases confirmado e pago, só para ver", () => {
    const P = semComentarios(ler("src/app/pedido/[token]/PropostasRecebidas.tsx"));
    const i = P.search(/\(acordada\.fase === "confirmado" \|\| acordada\.fase === "pago"\) && \(\s*<PagarTrabalho/);
    expect(i).toBeGreaterThan(-1);
    const bloco = P.slice(i, P.indexOf("/>", i));
    expect(bloco).toContain("soSePago");
    expect(bloco).toContain("soParaVer");
  });

  it("o componente diz o método pelo helper e não oferece pagar quando é só o «pago»", () => {
    const C = semComentarios(ler("src/components/PagarTrabalho.tsx"));
    expect(C).toContain("comoORecebemos(pago.metodo)");
    expect(C).not.toContain('" por Multibanco"');
    expect(C).toContain("if (soSePago || !estado.disponivel) return null;");
    const rota = semComentarios(ler("src/app/api/pagamentos/route.ts"));
    // O GET responde pela função que a app de cliente também lê (28-10-2026, d8 R5).
    expect(rota).toContain("estadoDoPagamentoParaOCliente(acesso.trabalho)");
    expect(semComentarios(ler("src/lib/pagamento-para-o-cliente.ts"))).toContain("doCliente: !temDividaDoProfissional(");
  });
});

describe("R8 — «Recebido do cliente» só com pagamento, e a fila das faturas", () => {
  it("um trabalho confirmado sem pagamento não está recebido (Trabalhos CLYON incluídos)", () => {
    const confirmado = { clientePagouEm: null, declaradoComo: null, formaDePagamento: "na_plataforma", confirmadoEm: new Date() };
    expect(recebidoDoCliente(confirmado)).toBe(false);
    expect(recebidoDoCliente({ ...confirmado, clientePagouEm: new Date() })).toBe(true);
    expect(recebidoDoCliente({ ...confirmado, declaradoComo: "transferencia" })).toBe(true);
    expect(recebidoDoCliente({ ...confirmado, declaradoComo: "ainda_nao" })).toBe(false);
    expect(recebidoDoCliente({ ...confirmado, formaDePagamento: "dinheiro" })).toBe(true);
  });

  it("os Trabalhos CLYON já não contam como recebidos só por estarem confirmados", () => {
    const T = semComentarios(ler("src/lib/trabalhos-para-gerir.ts"));
    expect(T).toContain("const recebido = recebidoDoCliente({");
    expect(T).not.toMatch(/const recebido = trabalhoClyon\s*\?/);
  });

  it("a fila aparece nos Pagamentos, com o botão do administrador, e conta no selo", () => {
    const rota = semComentarios(ler("src/app/api/admin/pagamentos/route.ts"));
    expect(rota).toContain("faturasPorEmitir(50)");
    const painel = semComentarios(ler("src/components/admin/AdminPagamentosPanel.tsx"));
    expect(painel).toContain('"/api/admin/pagamentos/fatura-emitida"');
    expect(painel).toContain("podeMarcar={mexeNoDinheiro}");
    const db = semComentarios(ler("src/lib/db.ts"));
    const contar = db.slice(db.indexOf("export async function contarPorFazer"));
    expect(contar.slice(0, contar.indexOf("\n}\n"))).toContain("SQL_DAS_FATURAS_POR_EMITIR");
    const marcar = semComentarios(ler("src/app/api/admin/pagamentos/fatura-emitida/route.ts"));
    expect(marcar).toContain("requireAdminGeral(req)");
    expect(marcar).toContain('acontecimento: "fatura_emitida"');
  });
});
