import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comprovativoEmPdf, conteudoDoComprovativo, emEuros, paraOPdf, type DadosDoComprovativo } from "./comprovativo-pdf";
import { contaDaLinha } from "./conta-do-pagamento";
import { ENTIDADE_QUE_FACTURA } from "./entidade-que-factura";
import { moradaCompleta } from "./trabalhos-para-gerir";

/**
 * O COMPROVATIVO DE PAGAMENTO EM PDF — 24-10-2026. *«Como geramos comprovativo
 * em PDF de pagamento aqui? … Crie essa função.»* — o dono, sobre o #904.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

// O #904: Trabalho CLYON de 420 € a 15 %, sem factura, pago à Recolhas Exemplo.
const conta = contaDaLinha(
  {
    valorAcordado: "420.00",
    taxaCliente: 0,
    taxaProfissional: 0.15,
    formaDePagamento: "na_plataforma",
    negociacaoCriadaEm: "2026-10-21T14:39:00Z",
    ofertaClyon: "distribuida",
    valorFixoClyon: "420.00",
    taxaClyon: "0.15",
    precoClienteClyon: "420.00",
    semFactura: 1,
  },
  true,
)!;
const base: Omit<DadosDoComprovativo, "para" | "pagoEm" | "como"> = {
  pedidoId: 904,
  cliente: "Rui Exemplo",
  telefoneDoCliente: "960 000 029",
  cidade: "Lisboa",
  servico: "recolha_moveis",
  profissional: "Recolhas Exemplo",
  dataDoTrabalho: "2026-10-23T14:40:00Z",
  semFactura: true,
  conta,
};
const EMITIDO = new Date("2026-10-24T10:00:00Z");

describe("o que o comprovativo diz", () => {
  it("o do cliente: o que pagou, sem fatura, quando e como", () => {
    const c = conteudoDoComprovativo({ ...base, para: "cliente", pagoEm: "2026-10-23T16:53:00Z", como: "Transferência" }, EMITIDO);
    expect(c.numero).toBe("904-C");
    expect(c.valores.map((v) => v.valor)).toEqual(["420,00 €", "0,00 €", "420,00 €"]);
    expect(c.pagamento).toBe("Pago a 23/10/2026 · Transferência");
    expect(c.nota).toContain("sem fatura");
    expect(c.nota).toContain("não é uma fatura");
  });

  it("o do cliente leva a morada exacta; o do profissional não (dono, 30-10-2026)", () => {
    const morada = moradaCompleta("Av. Exemplo 47", "7.º D", "2675-301", "Odivelas");
    expect(morada).toBe("Av. Exemplo 47, 7.º D, 2675-301 Odivelas");
    expect(moradaCompleta("Rua X 1, 2675-301 Odivelas", null, "2675-301", "Odivelas")).toBe("Rua X 1, 2675-301 Odivelas");
    const doCliente = conteudoDoComprovativo({ ...base, morada, para: "cliente", pagoEm: null, como: null }, EMITIDO);
    expect(doCliente.trabalho).toContainEqual({ rotulo: "Morada", valor: morada });
    const doPro = conteudoDoComprovativo({ ...base, morada, para: "profissional", pagoEm: null, como: null }, EMITIDO);
    expect(doPro.trabalho.some((l) => l.rotulo === "Morada")).toBe(false);
  });

  it("o do profissional: o valor do trabalho, a taxa da plataforma e o que se lhe pagou", () => {
    const c = conteudoDoComprovativo({ ...base, para: "profissional", pagoEm: "2026-10-23T16:54:00Z", como: null }, EMITIDO);
    expect(c.numero).toBe("904-P");
    expect(c.valores.map((v) => `${v.rotulo}: ${v.valor}`)).toEqual([
      "Valor do trabalho, sem IVA: 420,00 €",
      "Taxa da plataforma (15 %): - 63,00 €",
      "Valor pago ao profissional: 357,00 €",
    ]);
    expect(c.destinatario.nome).toBe("Recolhas Exemplo");
  });

  it("com fatura, diz que a emite a empresa parceira — sem o nome nem o NIF dela", () => {
    // 26-10-2026, o dono: a parceira não se expõe; o nome vai só na factura.
    const comFactura = contaDaLinha(
      { valorAcordado: 282, taxaCliente: 0, taxaProfissional: 0.11, formaDePagamento: "na_plataforma", negociacaoCriadaEm: "2026-10-23T10:00:00Z", semFactura: 0 },
      true,
    )!;
    const c = conteudoDoComprovativo({ ...base, semFactura: false, conta: comFactura, para: "cliente", pagoEm: null, como: null }, EMITIDO);
    expect(c.valores.map((v) => v.valor)).toEqual(["282,00 €", "64,86 €", "346,86 €"]);
    expect(c.nota).toContain("não substitui a fatura, emitida pela empresa parceira da CLYON.");
    expect(c.nota).not.toContain(ENTIDADE_QUE_FACTURA.nomeCurto);
    expect(c.nota).not.toContain(ENTIDADE_QUE_FACTURA.nif);
  });
});

describe("o PDF", () => {
  it("é um PDF, e um nome com emojis não o rebenta", async () => {
    const bytes = await comprovativoEmPdf({ ...base, cliente: "Ana 😀 Sousa", para: "cliente", pagoEm: null, como: null }, EMITIDO);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(paraOPdf("Ana 😀 Sousa")).toBe("Ana  Sousa");
    expect(emEuros(1234.5)).toBe("1 234,50 €");
  });
});

describe("as peças", () => {
  it("a rota só o dá depois de o dinheiro passar", () => {
    const R = ler("src/lib/comprovativo-do-trabalho.ts") + ler("src/app/api/admin/comprovativo/route.ts");
    expect(R).toContain('if (para === "cliente" && !t.recebido) {');
    expect(R).toContain('if (para === "profissional" && !t.pagoEm) {');
    expect(R).toContain('"Content-Type": "application/pdf",');
    // Aberto à Mesa também — só lê (24-10-2026).
    expect(ler("src/lib/papel-do-painel.ts")).toContain('{ prefixo: "/api/admin/comprovativo", seccoes: ["pagamentos", "negociacoes_clyon", "trabalhos_clyon"] },');
  });

  it("os botões no cartão de valor fixo e nos Pagamentos", () => {
    const T = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(T).toContain('{a?.confirmadoEm && <BotaoDoComprovativo negociacaoId={a.negociacaoId} pedidoId={t.pedidoId} para="cliente" />}');
    expect(T).toContain('{a?.pagoEm && <BotaoDoComprovativo negociacaoId={a.negociacaoId} pedidoId={t.pedidoId} para="profissional" />}');
    const P = ler("src/components/admin/AdminPagamentosPanel.tsx");
    expect(P).toContain('{t.recebido && <BotaoDoComprovativo negociacaoId={t.negociacaoId} pedidoId={t.pedidoId} para="cliente" />}');
  });
});
