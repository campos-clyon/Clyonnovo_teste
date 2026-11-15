import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contaDoPagamentoDirecto, contaDoValorAcordado } from "./pagamento-directo";
import { PARTE_DA_CLYON_COM_RESERVA, reservaDoValorUnico, reservaParaOValor } from "./reserva";
import { totalAoClienteDaNegociacao } from "./total-ao-cliente";
import { taxaAPassarAClyon } from "./taxa-a-passar-a-clyon";
import { carteiraDe, creditoDaReservaDe, dividasDe, recebidoEmMaoDe, type TrabalhoNaCarteira } from "./carteira";
import { carteiraDoLivro, livroDe } from "./livro-da-carteira";
import { contaDaCarteira, creditoEmPalavras } from "./trabalhos-da-carteira";
import { contaDoNovoModelo, contaFecha } from "./conta-do-pagamento";
import { diferencaEmTexto, avisoAcimaDoValorUnico } from "./valor-unico";
import { fraseDoDinheiro } from "./fim-do-trabalho";

/**
 * d39 (15-11-2026) — A RESERVA PARA IMPREVISTOS NO MODELO DE 15-11.
 *
 * O exemplo do dono: o parceiro propõe 120 € a 10 % → ele 108 (132,84 com IVA),
 * a CLYON 12 (14,76). Com o valor único a 130 €, a reserva é 10 €: a fatura da
 * CLYON passa a 22 + IVA = 27,06, e o cliente paga 159,90 = 130 × 1,23. O
 * parceiro fatura o mesmo; a parte da CLYON passa por ele, pela dívida.
 */

const T10 = { cliente: 0, profissional: 0.1 };
const c = (valor: number, reserva: number, regime: "normal" | "isento" = "normal") => {
  const r = contaDoPagamentoDirecto({ servicoCent: Math.round(valor * 100), taxas: T10, regime, reservaCent: reserva });
  if (!r.ok) throw new Error(r.erro);
  return r.conta;
};

describe("a conta com reserva", () => {
  it("sem reserva, a conta é a de sempre (o exemplo do dono: 132,84 + 14,76 = 147,60)", () => {
    const x = c(120, 0);
    expect([x.faturaDoProfissionalCent, x.faturaDaClyonCent, x.totalAoClienteCent]).toEqual([13284, 1476, 14760]);
    expect(x.baseDaFaturaDaClyonCent).toBe(x.taxaCent);
    expect(x.creditoAoProfissionalCent).toBe(0);
  });

  it("valor único 130: reserva 10 €, a fatura da CLYON 22 + IVA, o parceiro igual, o cliente 159,90", () => {
    expect(reservaDoValorUnico(130, 120, T10)).toBe(1000);
    const x = c(120, 1000);
    expect(x.faturaDoProfissionalCent).toBe(13284);
    expect(x.baseDaFaturaDaClyonCent).toBe(2200);
    expect(x.faturaDaClyonCent).toBe(2706);
    expect(x.totalAoClienteCent).toBe(15990);
    expect(x.aPassarAClyonCent).toBe(2706);
    expect(x.ficaAClyonCent).toBe(2200);
  });

  it("parceiro isento: a fatura dele sem IVA, a da CLYON sempre com IVA", () => {
    const x = c(120, 1000, "isento");
    expect([x.faturaDoProfissionalCent, x.faturaDaClyonCent, x.totalAoClienteCent]).toEqual([10800, 2706, 13506]);
  });

  it("reserva negativa pequena: a parte da CLYON desce abaixo da taxa", () => {
    const x = c(120, -500);
    expect(x.baseDaFaturaDaClyonCent).toBe(700);
    expect(x.faturaDaClyonCent).toBe(861);
    expect(x.totalAoClienteCent).toBe(14145); // 115 × 1,23
    expect(x.creditoAoProfissionalCent).toBe(0);
  });

  it("reserva abaixo da taxa: a fatura da CLYON a zero, o parceiro fatura o que o cliente paga, e o resto é crédito", () => {
    const x = c(120, -2000); // valor único 100
    expect(x.faturaDaClyonCent).toBe(0);
    expect(x.baseDoProfissionalCent).toBe(10000);
    expect(x.totalAoClienteCent).toBe(12300);
    expect(x.creditoAoProfissionalCent).toBe(800);
    expect(x.liquidoDoProfissionalCent).toBe(10800); // fica com o mesmo
    expect(x.ficaAClyonCent).toBe(-800);
  });

  it("a dívida do parceiro leva a reserva na parte da CLYON", () => {
    expect(taxaAPassarAClyon(120, T10, "normal", 1000)).toMatchObject({ comissao: 22, iva: 5.06, total: 27.06, recebidoDoCliente: 159.9 });
    expect(taxaAPassarAClyon(120, T10, "normal", -2000)).toMatchObject({ comissao: 0, total: 0 });
  });
});

describe("o total do cliente", () => {
  const linha = {
    estado: "acordada",
    valorAcordado: "120.00",
    reservaCent: 1000,
    taxaCliente: "0",
    taxaProfissional: "0.1",
    regimeDoProfissional: "normal",
  };

  it("no acordado de uma negociação fechada, com a reserva; numa proposta, sem ela", () => {
    expect(totalAoClienteDaNegociacao(linha as never, 120)?.total).toBe(159.9);
    expect(totalAoClienteDaNegociacao(linha as never, 125)?.total).toBe(contaDoValorAcordado(125, T10, "normal")!.totalAoClienteCent / 100);
    expect(reservaParaOValor({ ...linha, estado: "aberta" }, 120)).toBe(0);
  });
});

describe("na carteira do parceiro", () => {
  const agora = new Date("2026-11-20T12:00:00Z");
  const feito = (p: Partial<TrabalhoNaCarteira>): TrabalhoNaCarteira & { pedidoId: number } => ({
    negociacaoId: 77,
    pedidoId: 640,
    estado: "acordada",
    valorAcordado: 120,
    taxaCliente: 0,
    taxaProfissional: 0.1,
    execucaoEnviadaEm: new Date("2026-11-17T10:00:00Z"),
    confirmadoEm: new Date("2026-11-18T10:00:00Z"),
    noNovoModelo: true,
    ...p,
  });

  it("reserva positiva: a dívida é a parte da CLYON com a reserva, sem crédito", () => {
    const t = feito({ reservaCent: 1000 });
    const [d] = dividasDe([t], agora);
    expect(d.total).toBe(27.06);
    expect(creditoDaReservaDe(t, agora)).toBe(0);
  });

  it("reserva abaixo da taxa: sem dívida, e o crédito fica disponível — o livro dá o mesmo", () => {
    const t = feito({ reservaCent: -2000 });
    expect(dividasDe([t], agora)).toEqual([]);
    expect(creditoDaReservaDe(t, agora)).toBe(8);
    const cart = carteiraDe([t], [], agora);
    expect(cart.disponivel).toBe(8);
    expect(carteiraDoLivro(livroDe(5, [t], []), agora, 0, recebidoEmMaoDe([t], agora))).toEqual(cart);
    const { linhas } = contaDaCarteira([t], [], agora);
    expect(linhas[0].falta).toBe(8);
    expect(linhas[0].razao).toContain(creditoEmPalavras(640));
  });
});

describe("o que se diz", () => {
  it("a conta do backoffice tem a linha da reserva e fecha", () => {
    const conta = contaDoNovoModelo(120, T10, "normal", false, 1000)!;
    expect(conta.taxas.map((t) => t.rotulo)).toEqual(["Taxa da plataforma", "Reserva para imprevistos"]);
    expect(conta.total).toBe(159.9);
    expect(contaFecha(conta)).toBe(true);
    const comCredito = contaDoNovoModelo(120, T10, "normal", false, -2000)!;
    expect(contaFecha(comCredito)).toBe(true);
    expect(comCredito.notas.join(" ")).toContain("crédito na carteira");
  });

  it("sai o «tratamento por decidir»", () => {
    expect(diferencaEmTexto(140, 125)).not.toContain("por decidir");
    expect(avisoAcimaDoValorUnico("X", 150, 140)).not.toContain("tratamento decidido");
    const mesa = readFileSync("src/components/admin/ValorUnicoNaMesa.tsx", "utf8");
    expect(mesa).not.toContain("por decidir");
  });

  it("o parceiro lê uma só linha, sem dizer «valor único»", () => {
    const f = fraseDoDinheiro("em_mao_com_divida", { liquido: 108, divida: { recebidoDoCliente: 159.9, total: 27.06 }, noNovoModelo: true, comReserva: true });
    expect(f).toContain(PARTE_DA_CLYON_COM_RESERVA);
    expect(f).not.toMatch(/valor único/i);
    expect(PARTE_DA_CLYON_COM_RESERVA).not.toMatch(/valor único/i);
  });

  it("a reserva grava-se ao fechar na Mesa, uma vez", () => {
    const rota = readFileSync("src/app/api/admin/negociacoes/agir/route.ts", "utf8");
    expect(rota).toContain("gravarReservaAoFechar(pedidoId, negociacaoId, quem)");
    const base = readFileSync("src/lib/reserva-na-base.ts", "utf8");
    expect(base).toContain("WHERE id = ? AND reservaCent IS NULL");
  });
});
