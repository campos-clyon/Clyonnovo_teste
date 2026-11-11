import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dividasDe, type TrabalhoNaCarteira } from "./carteira";
import { dividaDoProfissional } from "./divida-do-profissional";
import type { MarcaDaParte } from "./cobrancas-ao-profissional";
import type { Taxas } from "./taxas-plataforma";
import {
  aDividaTemIva,
  eurosDaDivida,
  faltaDaDivida,
  fraseDaDividaEmMao,
  fraseDaDividaNoSaldo,
  linhasDasPartesDaDivida,
} from "./frases-da-divida";

/*
 * A CARTEIRA DO PROFISSIONAL DIZ AS DUAS PARTES DA DÍVIDA — 11-11-2026.
 *
 * Com o IVA marcado como pago, `iva` (o que falta) fica a zero — e o painel e
 * a app, que escolhiam a frase por `iva > 0`, diziam «em mão, sem IVA» num
 * trabalho com IVA. Valores de exemplo, não de contas reais.
 */

const TAXAS: Taxas = { cliente: 0, profissional: 0.1 };
const AGORA = new Date("2026-10-26T12:00:00Z");
const D = dividaDoProfissional(100, TAXAS);

/** Em dinheiro, com IVA incluído, feito e confirmado. */
const dinheiro = (p: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira => ({
  negociacaoId: 7,
  estado: "acordada",
  valorAcordado: 100,
  taxaCliente: String(TAXAS.cliente),
  taxaProfissional: String(TAXAS.profissional),
  formaDePagamento: "dinheiro",
  negociacaoCriadaEm: new Date("2026-10-20T10:00:00Z"),
  execucaoEnviadaEm: new Date("2026-10-24T10:00:00Z"),
  confirmadoEm: new Date("2026-10-25T10:00:00Z"),
  ...p,
});

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

/** A dívida como a rota da carteira a manda: por JSON, com as datas em texto. */
const comoARotaManda = (t: TrabalhoNaCarteira) =>
  JSON.parse(JSON.stringify(dividasDe([t], AGORA)[0])) as ReturnType<typeof dividasDe>[number] & {
    partes: Array<{ parte: "iva" | "taxa"; valor: number; paga: boolean; pagoEm: string | null }>;
  };

const FRASE_COM_IVA =
  `O cliente pagou-lhe ${eurosDaDivida(D.recebidoDoCliente)} em mão, com IVA. ` +
  `São da CLYON ${eurosDaDivida(D.iva)} de IVA e ${eurosDaDivida(D.comissao)} de taxa da plataforma.`;

describe("a frase lê a dívida inteira, nunca o que falta", () => {
  it("o exemplo tem as duas partes", () => {
    expect(D.iva).toBeGreaterThan(0);
    expect(D.comissao).toBeGreaterThan(0);
  });

  it("nada pago: «com IVA», as duas partes por pagar, e não repete o total", () => {
    const d = comoARotaManda(dinheiro());
    expect(fraseDaDividaEmMao(d)).toBe(FRASE_COM_IVA);
    expect(linhasDasPartesDaDivida(d).map((l) => l.texto)).toEqual([
      `IVA: ${eurosDaDivida(D.iva)} — por pagar`,
      `Taxa da plataforma: ${eurosDaDivida(D.comissao)} — por pagar`,
    ]);
    expect(faltaDaDivida(d)).toBeNull();
  });

  it("IVA pago, taxa por pagar: continua «com IVA», diz o dia do IVA e o que falta", () => {
    const d = comoARotaManda(dinheiro({ marcasDaDivida: [marca("iva")] }));
    // O que estragava a frase antiga: o que FALTA do IVA é zero.
    expect(d.iva).toBe(0);
    expect(d.ivaDaDivida).toBe(D.iva);

    expect(aDividaTemIva(d)).toBe(true);
    expect(fraseDaDividaEmMao(d)).toBe(FRASE_COM_IVA);
    expect(fraseDaDividaEmMao(d)).not.toContain("sem IVA");
    expect(linhasDasPartesDaDivida(d)).toEqual([
      { parte: "iva", paga: true, texto: `IVA: ${eurosDaDivida(D.iva)} — pago a 05/11` },
      { parte: "taxa", paga: false, texto: `Taxa da plataforma: ${eurosDaDivida(D.comissao)} — por pagar` },
    ]);
    expect(faltaDaDivida(d)).toBe(`Falta pagar ${eurosDaDivida(D.comissao)} (a taxa da plataforma).`);
  });

  it("o inverso — taxa paga, IVA por pagar: a taxa da frase é a inteira, e falta o IVA", () => {
    const d = comoARotaManda(dinheiro({ marcasDaDivida: [marca("taxa")] }));
    expect(d.comissao).toBe(0);
    expect(fraseDaDividaEmMao(d)).toBe(FRASE_COM_IVA);
    expect(linhasDasPartesDaDivida(d)).toEqual([
      { parte: "iva", paga: false, texto: `IVA: ${eurosDaDivida(D.iva)} — por pagar` },
      { parte: "taxa", paga: true, texto: `Taxa da plataforma: ${eurosDaDivida(D.comissao)} — pago a 05/11` },
    ]);
    expect(faltaDaDivida(d)).toBe(`Falta pagar ${eurosDaDivida(D.iva)} (o IVA).`);
  });

  it("a que só se desconta no saldo segue a mesma regra", () => {
    const d = comoARotaManda(dinheiro({ marcasDaDivida: [marca("iva")] }));
    expect(fraseDaDividaNoSaldo(d)).toBe(
      `O cliente pagou-lhe ${eurosDaDivida(D.recebidoDoCliente)} em mão. São da CLYON ${eurosDaDivida(D.iva)} de IVA e ` +
        `${eurosDaDivida(D.comissao)} de taxa da plataforma — desconta-se do próximo valor que a CLYON lhe transferir.`,
    );
  });

  it("sem fatura não há IVA: «sem IVA», só a taxa, e nenhuma linha de partes", () => {
    const d = {
      recebidoDoCliente: 100,
      iva: 0,
      comissao: 10,
      ivaDaDivida: 0,
      comissaoDaDivida: 10,
      partes: [{ parte: "taxa" as const, valor: 10, paga: false, pagoEm: null }],
    };
    expect(fraseDaDividaEmMao(d)).toBe(
      "O cliente pagou-lhe 100,00 € em mão, sem IVA. A taxa da plataforma (10,00 €) é da CLYON.",
    );
    expect(linhasDasPartesDaDivida(d)).toEqual([]);
    expect(faltaDaDivida(d)).toBeNull();
  });

  it("uma resposta antiga, sem as partes: a frase de sempre e nenhuma linha", () => {
    const d = { recebidoDoCliente: 123, iva: 23, comissao: 10 };
    expect(fraseDaDividaEmMao(d)).toBe(
      "O cliente pagou-lhe 123,00 € em mão, com IVA. São da CLYON 23,00 € de IVA e 10,00 € de taxa da plataforma.",
    );
    expect(linhasDasPartesDaDivida(d)).toEqual([]);
    expect(faltaDaDivida(d)).toBeNull();
  });
});

describe("o dia é o de Lisboa, seja qual for o fuso de quem vê", () => {
  const com = (pagoEm: string) => ({
    recebidoDoCliente: 123,
    iva: 0,
    comissao: 10,
    ivaDaDivida: 23,
    comissaoDaDivida: 10,
    partes: [
      { parte: "iva" as const, valor: 23, paga: true, pagoEm },
      { parte: "taxa" as const, valor: 10, paga: false, pagoEm: null },
    ],
  });

  it("no Inverno, 23h40 UTC de dia 5 é ainda dia 5 em Lisboa", () => {
    expect(linhasDasPartesDaDivida(com("2026-11-05T23:40:00.000Z"))[0].texto).toBe("IVA: 23,00 € — pago a 05/11");
  });

  it("no Verão, 23h40 UTC de dia 5 já é dia 6 em Lisboa", () => {
    expect(linhasDasPartesDaDivida(com("2026-07-05T23:40:00.000Z"))[0].texto).toBe("IVA: 23,00 € — pago a 06/07");
  });

  it("paga sem data conhecida: «pago», sem inventar o dia", () => {
    expect(linhasDasPartesDaDivida({ ...com(""), partes: [{ parte: "iva", valor: 23, paga: true, pagoEm: null }, { parte: "taxa", valor: 10, paga: false }] })[0].texto).toBe(
      "IVA: 23,00 € — pago",
    );
  });
});

describe("o painel e a rota", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
  const semComentarios = (s: string) =>
    s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

  it("o painel não escolhe a frase por `d.iva > 0`, nem a escreve à mão: lê-a de frases-da-divida.ts", () => {
    const painel = semComentarios(ler("src/app/profissionais/painel/Carteira.tsx"));
    expect(painel).not.toMatch(/d\.iva\s*>\s*0/);
    expect(painel).not.toContain("em mão, sem IVA");
    expect(painel).not.toContain("em mão, com IVA");
    expect(painel).toContain("{fraseDaDividaEmMao(d)}");
    expect(painel).toContain("{fraseDaDividaNoSaldo(d)}");
    expect(painel).toContain("linhasDasPartesDaDivida(d)");
    expect(painel).toContain("faltaDaDivida(d)");
  });

  it("a rota da carteira manda a dívida inteira (`...d` de dividasDe): partes, porPagar, ivaDaDivida, comissaoDaDivida", () => {
    const rota = semComentarios(ler("src/app/api/profissionais/carteira/route.ts"));
    const dividas = rota.slice(rota.indexOf("const dividas = await Promise.all("));
    expect(dividas).toMatch(/dividasDe\(trabalhos, agora\)[\s\S]*?return \{\s*\.\.\.d,/);
    const d = dividasDe([dinheiro({ marcasDaDivida: [marca("iva")] })], AGORA)[0];
    expect(Object.keys(d)).toEqual(expect.arrayContaining(["partes", "porPagar", "ivaDaDivida", "comissaoDaDivida"]));
  });

  it("a lib das frases não depende de nada além da hora de Lisboa — a app CLYON Pro importa-a tal como está", () => {
    const lib = ler("src/lib/frases-da-divida.ts");
    const imports = [...lib.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
    expect(imports).toEqual(["./hora-de-lisboa"]);
  });
});
