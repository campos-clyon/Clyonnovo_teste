import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aPagarAClyonDe, dividasDe, planoDeAbatimento, type TrabalhoNaCarteira } from "./carteira";
import { bloqueioEmDinheiro } from "./bloqueio-por-divida";
import { dividaDoProfissional } from "./divida-do-profissional";
import { dividaDoRegistoEmMao } from "./pago-em-mao";
import { camposDoPagamento } from "./carteira-do-profissional";
import { porCobrarNosPagosEmMao, taxaDoPagoEmMao, fraseDaParteDaClyon } from "./a-quem-foi-o-dinheiro";
import { movimentosDaPlataforma } from "./financas";
import type { Taxas } from "./taxas-plataforma";
import {
  estadoDaCobranca,
  estadoDaParteEmPalavras,
  oQueFaltaDaDivida,
  partesDaDivida,
  planoDoPagamentoEmPartes,
  porPagarDasPartes,
  type MarcaDaParte,
} from "./cobrancas-ao-profissional";

/*
 * O IVA E A TAXA DA PLATAFORMA, CADA UM COM O SEU ESTADO — 11-11-2026 (dono).
 * Valores de exemplo, não de contas reais.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const TAXAS: Taxas = { cliente: 0, profissional: 0.11 };
const DIA = 86_400_000;
const ABERTA = new Date("2026-10-20T10:00:00Z");
const CONFIRMADO = new Date("2026-10-25T10:00:00Z");

/** Em dinheiro, com IVA incluído, feito e confirmado. */
const dinheiro = (p: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira => ({
  negociacaoId: 7,
  estado: "acordada",
  valorAcordado: 100,
  taxaCliente: String(TAXAS.cliente),
  taxaProfissional: String(TAXAS.profissional),
  formaDePagamento: "dinheiro",
  negociacaoCriadaEm: ABERTA,
  execucaoEnviadaEm: new Date("2026-10-24T10:00:00Z"),
  confirmadoEm: CONFIRMADO,
  ...p,
});

const D = dividaDoProfissional(100, TAXAS);

const marca = (parte: "iva" | "taxa", p: Partial<MarcaDaParte> = {}): MarcaDaParte => ({
  negociacaoId: 7,
  parte,
  valor: parte === "iva" ? D.iva : D.comissao,
  pagoEm: new Date("2026-11-05T11:00:00Z"),
  metodo: "pro_mbway",
  marcadoPor: "Equipa",
  pagamentoId: null,
  origem: "marcacao",
  ...p,
});

describe("as duas partes somam a dívida, pela conta de sempre", () => {
  it("IVA + taxa = o total da dívida, ao cêntimo — em dinheiro e no pago em mão registado", () => {
    expect(D.iva).toBeGreaterThan(0);
    expect(D.comissao).toBeGreaterThan(0);
    const partes = partesDaDivida(D, [], null);
    expect(partes.map((p) => p.parte)).toEqual(["iva", "taxa"]);
    expect(porPagarDasPartes(partes)).toBe(D.total);

    const emMao = dividaDoRegistoEmMao(100, TAXAS, 123);
    expect(porPagarDasPartes(partesDaDivida(emMao, [], null))).toBe(emMao.total);
  });

  it("sem IVA (sem factura) só há a taxa", () => {
    const semIva = dividaDoRegistoEmMao(100, TAXAS, 100);
    const partes = partesDaDivida(semIva, [], null);
    expect(partes.map((p) => p.parte)).toEqual(["taxa"]);
  });

  it("dividasDe dá as partes, com os valores da conta de sempre", () => {
    const [d] = dividasDe([dinheiro()], new Date("2026-10-26T12:00:00Z"));
    expect(d.totalDaDivida).toBe(D.total);
    expect(d.partes.reduce((s, p) => s + p.valor, 0)).toBeCloseTo(D.total, 2);
    expect(d.porPagar).toBe(D.total);
    expect(estadoDaCobranca(d.partes)).toBe("pendente");
  });
});

describe("parcial: só o IVA, ou só a taxa", () => {
  const agora = new Date("2026-10-26T12:00:00Z");

  it("com o IVA marcado falta só a taxa — na carteira, no «a pagar à CLYON» e no abatimento", () => {
    const t = dinheiro({ marcasDaDivida: [marca("iva")] });
    const [d] = dividasDe([t], agora);
    expect(d.paga).toBe(false);
    expect(estadoDaCobranca(d.partes)).toBe("parcial");
    expect(d.porPagar).toBe(D.comissao);
    expect(d.total).toBe(D.comissao);
    expect(d.iva).toBe(0);
    expect(aPagarAClyonDe([t], agora)).toBe(D.comissao);
    expect(planoDeAbatimento([d], 1000).totalAbatido).toBe(D.comissao);
    expect(estadoDaParteEmPalavras(d.partes[0])).toBe("pago · 05/11/2026 · MB WAY");
    expect(estadoDaParteEmPalavras(d.partes[1])).toBe("pendente");
  });

  it("com a taxa marcada falta só o IVA", () => {
    const [d] = dividasDe([dinheiro({ marcasDaDivida: [marca("taxa")] })], agora);
    expect(d.porPagar).toBe(D.iva);
    expect(d.comissao).toBe(0);
  });

  it("as duas marcadas: paga", () => {
    const [d] = dividasDe([dinheiro({ marcasDaDivida: [marca("iva"), marca("taxa")] })], agora);
    expect(d.paga).toBe(true);
    expect(d.porPagar).toBe(0);
    expect(estadoDaCobranca(d.partes)).toBe("pago");
  });

  it("a dívida fechada em `pagamentos` (o caminho de sempre) dá as duas partes por pagas, sem desfazer aqui", () => {
    const pagos = new Map([[7, { pagoEm: new Date("2026-11-01T10:00:00Z"), metodo: "multibanco", valor: D.total, levantamentoId: null }]]);
    const t = { ...dinheiro(), ...camposDoPagamento({ id: 7, createdAt: ABERTA, formaDePagamento: "dinheiro" }, pagos) };
    const [d] = dividasDe([t], agora);
    expect(d.paga).toBe(true);
    expect(d.partes.every((p) => p.paga && p.origem === "fecho" && !p.desfazivel)).toBe(true);
    expect(d.partes[0].metodo).toBe("multibanco");
  });

  it("a referência pede só o que falta", () => {
    expect(oQueFaltaDaDivida(D, [marca("iva")]).total).toBe(D.comissao);
    expect(oQueFaltaDaDivida(D, []).total).toBe(D.total);
  });
});

describe("o pagamento em bloco reparte: das mais antigas para as mais novas, o IVA antes da taxa", () => {
  const antiga = { negociacaoId: 1, nasceuEm: new Date("2026-10-01T10:00:00Z"), partes: partesDaDivida({ iva: 20, comissao: 10 }, [], null) };
  const nova = { negociacaoId: 2, nasceuEm: new Date("2026-10-10T10:00:00Z"), partes: partesDaDivida({ iva: 8, comissao: 4 }, [], null) };

  it("20 € pagam o IVA da mais antiga, e a taxa fica pendente", () => {
    const p = planoDoPagamentoEmPartes([nova, antiga], 20);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.passos).toEqual([{ negociacaoId: 1, partes: ["iva"], valor: 20, fecha: false }]);
  });

  it("38 € fecham a mais antiga e o IVA da nova", () => {
    const p = planoDoPagamentoEmPartes([nova, antiga], 38);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.passos).toEqual([
      { negociacaoId: 1, partes: ["iva", "taxa"], valor: 30, fecha: true },
      { negociacaoId: 2, partes: ["iva"], valor: 8, fecha: false },
    ]);
    expect(p.total).toBe(38);
  });

  it("uma dívida com o IVA já pago: o bloco começa pela taxa dela, e fecha-a", () => {
    const comIva = { ...antiga, partes: partesDaDivida({ iva: 20, comissao: 10 }, [{ ...marca("iva"), negociacaoId: 1, valor: 20 }], null) };
    const p = planoDoPagamentoEmPartes([comIva, nova], 10);
    expect(p.ok && p.passos).toEqual([{ negociacaoId: 1, partes: ["taxa"], valor: 10, fecha: true }]);
  });

  it("um valor que não fecha partes inteiras diz os que fecham", () => {
    const p = planoDoPagamentoEmPartes([antiga, nova], 25);
    expect(p.ok).toBe(false);
    if (p.ok) return;
    expect(p.porque).toContain("20,00 €, 30,00 €, 38,00 €, 42,00 €");
  });

  it("acima do que deve, recusa", () => {
    expect(planoDoPagamentoEmPartes([antiga, nova], 100).ok).toBe(false);
  });

  it("a rota do bloco usa o plano das partes e marca o que cobre", () => {
    const rota = semComentarios(ler("src/app/api/admin/carteiras/pagamento-do-profissional/route.ts"));
    expect(rota).toContain("planoDoPagamentoEmPartes(");
    expect(rota).toContain("marcarPartesCobertas(");
    expect(rota).toMatch(/origem:\s*"bloco"/);
    expect(rota).not.toContain("planoDoPagamentoDoProfissional(");
    const abater = semComentarios(ler("src/lib/abater-dividas-no-saldo.ts"));
    expect(abater).toMatch(/marcarPartesCobertas\(\{[\s\S]*?origem:\s*"abatimento"/);
  });
});

describe("desfazer", () => {
  it("sem a marca a parte volta a pendente", () => {
    const agora = new Date("2026-10-26T12:00:00Z");
    const antes = dividasDe([dinheiro({ marcasDaDivida: [marca("iva")] })], agora)[0];
    const depois = dividasDe([dinheiro({ marcasDaDivida: [] })], agora)[0];
    expect(antes.partes[0].desfazivel).toBe(true);
    expect(estadoDaCobranca(antes.partes)).toBe("parcial");
    expect(estadoDaCobranca(depois.partes)).toBe("pendente");
  });

  it("uma marca de um bloco ou de um abatimento que fechou a dívida não se desfaz aqui", () => {
    const [p] = partesDaDivida(D, [marca("iva", { origem: "abatimento", pagamentoId: 9 })], null);
    expect(p.desfazivel).toBe(false);
    const [q] = partesDaDivida(D, [marca("iva", { origem: "marcacao", pagamentoId: 9 })], null);
    expect(q.desfazivel).toBe(true);
  });

  it("na base: só o administrador, com motivo; cancela (não apaga) a linha que nasceu com a marca, e regista", () => {
    const rota = semComentarios(ler("src/app/api/admin/pagamentos/a-receber-dos-profissionais/route.ts"));
    expect(rota).toMatch(/export async function POST[\s\S]*?requireAdminGeral\(req\)/);
    expect(rota).toContain("Escreva o motivo para desfazer.");
    const base = semComentarios(ler("src/lib/cobrancas-na-base.ts"));
    const desfazer = base.slice(base.indexOf("export async function desfazerParte"));
    expect(desfazer).toContain(`origemLida(m.origem) !== "marcacao"`);
    expect(desfazer).toMatch(/SET estado = 'cancelado', negociacaoPaga = NULL, trid = NULL/);
    expect(desfazer).toMatch(/SET activa = NULL, desfeitoEm/);
    expect(desfazer).not.toMatch(/DELETE FROM/);
    expect(desfazer).toContain(`acontecimento: "parte_da_divida_desfeita"`);
    expect(desfazer).toContain("appendOrderHistory(");
  });

  it("cada marcação escreve no histórico do pedido e no do dinheiro do profissional", () => {
    const base = semComentarios(ler("src/lib/cobrancas-na-base.ts"));
    const marcar = base.slice(base.indexOf("export async function marcarPartes("), base.indexOf("export async function desfazerParte"));
    expect(marcar).toContain(`acontecimento: "parte_da_divida_paga"`);
    expect(marcar).toContain("appendOrderHistory(");
    const historico = ler("src/lib/pagamento-da-divida.ts");
    expect(historico).toContain(`"parte_da_divida_paga",`);
    expect(historico).toContain(`"parte_da_divida_desfeita",`);
  });
});

describe("as Carteiras e o separador dão o mesmo número", () => {
  it("as duas rotas lêem as dívidas pela mesma porta, e o que falta é a soma das partes pendentes", () => {
    const separador = semComentarios(ler("src/app/api/admin/pagamentos/a-receber-dos-profissionais/route.ts"));
    const carteiras = semComentarios(ler("src/app/api/admin/carteiras/route.ts"));
    expect(separador).toContain("dividasDosProfissionais(");
    expect(carteiras).toContain("dividasDosProfissionais(");
    expect(carteiras).toMatch(/ficha\.aPagarAClyon\s*=[\s\S]{0,120}\.filter\(\(d\) => !d\.paga\)\.reduce\(\(s, d\) => s \+ d\.porPagar/);
    expect(separador).toMatch(/porPagar: d\.paga \? 0 : d\.porPagar/);
    // A conta antiga das Carteiras (somar a dívida inteira) já não decide o «deve à CLYON».
    expect(carteiras).not.toMatch(/ficha\.aPagarAClyon \+ divida/);
  });

  it("a soma das partes pendentes é o «a pagar à CLYON» da carteira dele", () => {
    const agora = new Date("2026-10-26T12:00:00Z");
    const ts = [dinheiro({ marcasDaDivida: [marca("iva")] }), dinheiro({ negociacaoId: 8, marcasDaDivida: [] })];
    const soma = dividasDe(ts, agora)
      .filter((d) => !d.paga)
      .reduce((s, d) => s + d.porPagar, 0);
    expect(aPagarAClyonDe(ts, agora)).toBeCloseTo(soma, 2);
    expect(soma).toBeCloseTo(D.comissao + D.total, 2);
  });

  it("os Pagamentos (pagos em mão) contam só o que falta, e não dão alarme de diferença depois de pago em partes", () => {
    const x = taxaDoPagoEmMao({
      formaDePagamento: "dinheiro",
      dividaDoProfissional: D.total,
      clientePagouEm: null,
      valorAcordado: 100,
      taxas: TAXAS,
      jaPagoEmPartes: D.iva,
    })!;
    expect(porCobrarNosPagosEmMao([{ taxaEmMao: x }])).toBe(D.comissao);
    expect(fraseDaParteDaClyon(x, (v) => v.toFixed(2))).toContain("paga em parte");
  });
});

describe("o bloqueio dos 7 dias conta só as partes pendentes", () => {
  const depois = new Date(CONFIRMADO.getTime() + 8 * DIA);

  it("tudo por pagar há mais de 7 dias: bloqueia, com o total", () => {
    const b = bloqueioEmDinheiro([dinheiro()], depois);
    expect(b.bloqueado).toBe(true);
    expect(b.total).toBe(D.total);
  });

  it("só a taxa por pagar: bloqueia, com a taxa", () => {
    const b = bloqueioEmDinheiro([dinheiro({ marcasDaDivida: [marca("iva")] })], depois);
    expect(b.bloqueado).toBe(true);
    expect(b.total).toBe(D.comissao);
  });

  it("as duas partes pagas: não bloqueia", () => {
    expect(bloqueioEmDinheiro([dinheiro({ marcasDaDivida: [marca("iva"), marca("taxa")] })], depois).bloqueado).toBe(false);
  });

  it("dentro dos 7 dias: não bloqueia", () => {
    expect(bloqueioEmDinheiro([dinheiro()], new Date(CONFIRMADO.getTime() + 6 * DIA)).bloqueado).toBe(false);
  });
});

describe("as Finanças contam o dinheiro uma vez", () => {
  it("a parte paga à parte entra como receita; nas contas de teste não", () => {
    const onde = { contaPlataforma: 1, contaCaixa: 2, categoria: () => 9 };
    const base = { recebimentos: [], pagosAosProfissionais: [], levantamentos: [] };
    const m = movimentosDaPlataforma(
      {
        ...base,
        partesDaDividaPagas: [
          { id: 1, pedidoId: 480, parte: "iva", valor: 22.5, pagoEm: "2026-11-05 11:00:00", metodo: "pro_mbway", profissional: "Pro", contaDeTeste: false },
          { id: 2, pedidoId: 481, parte: "iva", valor: 5, pagoEm: "2026-11-05 11:00:00", metodo: "pro_mbway", profissional: "Teste", contaDeTeste: true },
        ],
      },
      onde,
    );
    expect(m).toHaveLength(1);
    expect(m[0].valor).toBe(22.5);
    expect(m[0].tipo).toBe("receita");
  });

  it("só as partes sem linha em `pagamentos` (as que fecharam a dívida já lá estão)", () => {
    const base = semComentarios(ler("src/lib/marcas-da-divida-na-base.ts"));
    expect(base).toMatch(/c\.activa = 1 AND c\.pagamentoId IS NULL/);
  });
});

describe("o selo dos Pagamentos no menu (11-11-2026)", () => {
  it("conta os trabalhos com o IVA ou a taxa por pagar, sem as contas de teste", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const db = readFileSync(join(process.cwd(), "src", "lib", "db.ts"), "utf8").replace(/\r\n/g, "\n");
    const bloco = db.slice(db.indexOf("export async function contarPorFazer("));
    expect(bloco).toContain('await import("./cobrancas-na-base")');
    expect(bloco).toContain('estadoDaCobranca(d.partes) !== "pago"');
    expect(bloco).toContain("COALESCE(contaDeTeste, 0) = 1");
  });
});
