import { describe, it, expect } from "vitest";
import {
  carteiraDe,
  cativoPorFazerDe,
  recusaDoLevantamento,
  MINIMO_PARA_LEVANTAR,
  type TrabalhoNaCarteira,
} from "./carteira";
import { carteiraDoLivro, livroDe } from "./livro-da-carteira";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";

/**
 * O «PAGO AO PROFISSIONAL» DO BACKOFFICE — 18-10-2026, decisão do dono.
 *
 * Um trabalho que a CLYON pagou um a um (`pagoEm`) continuava a contar como
 * disponível: a carteira da conta Revolution mostrava 7220,86 € levantáveis
 * com trabalhos já pagos dentro, e um pedido de transferência pagava-os outra
 * vez. Passa a contar como levantado («já transferido»).
 *
 * E a parte do cativo cujo trabalho ainda está por fazer, que a app tira do
 * «Para receber» (o dono: «não o futuro»).
 */

const agora = new Date("2026-08-18T12:00:00Z");
const haDias = (d: number) => new Date(agora.getTime() - d * 86_400_000);
const trabalho = (p: Partial<TrabalhoNaCarteira>): TrabalhoNaCarteira => ({
  negociacaoId: 1,
  estado: "acordada",
  valorAcordado: 200,
  ...p,
});
const liquido = quantoOProfissionalRecebe(200);
const pago = (id: number) => trabalho({ negociacaoId: id, execucaoEnviadaEm: haDias(9), confirmadoEm: haDias(8), pagoEm: haDias(7) });
const confirmado = (id: number) => trabalho({ negociacaoId: id, execucaoEnviadaEm: haDias(3), confirmadoEm: haDias(2) });

describe("um trabalho pago um a um sai do disponível", () => {
  it("conta como levantado e continua no total ganho", () => {
    const c = carteiraDe([pago(1)], [], agora);
    expect(c.disponivel).toBe(0);
    expect(c.levantado).toBe(liquido);
    expect(c.totalGanho).toBe(liquido);
  });

  it("e não se pede outra vez", () => {
    const c = carteiraDe([pago(1)], [], agora);
    expect(recusaDoLevantamento(MINIMO_PARA_LEVANTAR, c, true, false, 0)).not.toBeNull();
  });

  it("ao lado de um confirmado por pagar, só esse fica disponível", () => {
    const c = carteiraDe([pago(1), confirmado(2)], [], agora);
    expect(c.disponivel).toBe(liquido);
    expect(c.levantado).toBe(liquido);
    expect(recusaDoLevantamento(liquido, c, true, false, 0)).toBeNull();
    expect(recusaDoLevantamento(liquido + 1, c, true, false, 0)).not.toBeNull();
  });

  it("um levantamento pago continua a contar como antes", () => {
    const c = carteiraDe([confirmado(2)], [{ id: 5, valor: 50, estado: "pago" }], agora);
    expect(c.levantado).toBe(50);
    expect(c.disponivel).toBe(Math.round((liquido - 50) * 100) / 100);
  });

  it("o livro dá o mesmo que a carteira, ao cêntimo", () => {
    const trabalhos = [pago(1), confirmado(2), pago(3), trabalho({ negociacaoId: 4 })];
    const levantamentos = [{ id: 7, valor: 30, estado: "pago" }, { id: 8, valor: 20, estado: "pedido" }];
    const livro = livroDe(9, trabalhos, levantamentos);
    expect(livro.filter((m) => m.tipo === "trabalho_pago").map((m) => m.chave)).toEqual(["trabalho:1:pago", "trabalho:3:pago"]);
    expect(carteiraDoLivro(livro, agora)).toEqual(carteiraDe(trabalhos, levantamentos, agora));
  });
});

describe("o cativo dos trabalhos por fazer", () => {
  it("só os por fazer, e não os que já foram feitos e esperam a confirmação", () => {
    const porFazer = trabalho({ negociacaoId: 1 });
    const aConfirmar = trabalho({ negociacaoId: 2, execucaoEnviadaEm: haDias(1) });
    expect(cativoPorFazerDe([porFazer, aConfirmar], agora)).toBe(liquido);
    // O cativo da carteira tem os dois: a app mostra-o todo na caixa «Cativo».
    expect(carteiraDe([porFazer, aConfirmar], [], agora).cativo).toBe(Math.round(liquido * 2 * 100) / 100);
  });

  it("em dinheiro, ou por pagar pelo cliente, não é cativo", () => {
    const emMao = trabalho({ negociacaoId: 1, formaDePagamento: "dinheiro" } as Partial<TrabalhoNaCarteira>);
    expect(cativoPorFazerDe([emMao], agora)).toBe(0);
    // Com a plataforma a cobrar e sem pagamento registado, é «por cobrar».
    const porPagar = trabalho({ negociacaoId: 2, createdAt: new Date("2026-10-05T10:00:00Z") } as Partial<TrabalhoNaCarteira>);
    expect(cativoPorFazerDe([porPagar], new Date("2026-10-18T12:00:00Z"), { aPlataformaCobra: true })).toBe(0);
  });
});
