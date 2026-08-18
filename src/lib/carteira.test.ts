import { describe, it, expect } from "vitest";
import {
  carteiraDe,
  recusaDoLevantamento,
  MINIMO_PARA_LEVANTAR,
  type TrabalhoNaCarteira,
} from "./carteira";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";

const agora = new Date("2026-08-18T12:00:00Z");
const haDias = (d: number) => new Date(agora.getTime() - d * 86_400_000);

const trabalho = (p: Partial<TrabalhoNaCarteira>): TrabalhoNaCarteira => ({
  negociacaoId: 1,
  estado: "acordada",
  valorAcordado: 200,
  ...p,
});

const liquidoDe200 = quantoOProfissionalRecebe(200);

describe("carteiraDe", () => {
  it("uma carteira vazia é toda a zeros", () => {
    const c = carteiraDe([], [], agora);
    expect(c).toEqual({ cativo: 0, disponivel: 0, aCaminho: 0, levantado: 0, totalGanho: 0 });
  });

  // O que ainda se está a negociar não é dinheiro dele. Contá-lo mostrava um
  // saldo que desaparecia quando o cliente escolhesse outro.
  it("negociações abertas não entram na carteira", () => {
    const c = carteiraDe(
      [trabalho({ estado: "aberta" }), trabalho({ estado: "aguarda_contratacao" })],
      [],
      agora,
    );
    expect(c.totalGanho).toBe(0);
  });

  it("fechado e por confirmar fica cativo", () => {
    const c = carteiraDe([trabalho({})], [], agora);
    expect(c.cativo).toBe(liquidoDe200);
    expect(c.disponivel).toBe(0);
  });

  it("confirmado passa a disponível", () => {
    const c = carteiraDe(
      [trabalho({ execucaoEnviadaEm: haDias(2), confirmadoEm: haDias(1) })],
      [],
      agora,
    );
    expect(c.cativo).toBe(0);
    expect(c.disponivel).toBe(liquidoDe200);
  });

  // Sem isto, o profissional via o prazo passar no ecrã do trabalho e o saldo
  // continuar preso à espera de alguém correr o processo que grava a data.
  it("o prazo liberta o saldo mesmo antes de ser gravado", () => {
    const c = carteiraDe([trabalho({ execucaoEnviadaEm: haDias(8) })], [], agora);
    expect(c.disponivel).toBe(liquidoDe200);
  });

  it("os valores são sempre líquidos, nunca o acordado", () => {
    const c = carteiraDe([trabalho({ confirmadoEm: haDias(1), execucaoEnviadaEm: haDias(2) })], [], agora);
    expect(c.disponivel).toBeLessThan(200);
    expect(c.disponivel).toBe(liquidoDe200);
  });

  it("o pedido de transferência sai do disponível e fica a caminho", () => {
    const c = carteiraDe(
      [trabalho({ execucaoEnviadaEm: haDias(2), confirmadoEm: haDias(1) })],
      [{ id: 1, valor: 50, estado: "pedido" }],
      agora,
    );
    expect(c.aCaminho).toBe(50);
    expect(c.disponivel).toBe(Number((liquidoDe200 - 50).toFixed(2)));
  });

  it("o que já foi pago sai do disponível de vez", () => {
    const c = carteiraDe(
      [trabalho({ execucaoEnviadaEm: haDias(2), confirmadoEm: haDias(1) })],
      [{ id: 1, valor: 100, estado: "pago" }],
      agora,
    );
    expect(c.levantado).toBe(100);
    expect(c.disponivel).toBe(Number((liquidoDe200 - 100).toFixed(2)));
  });

  // Um pedido recusado tem de devolver o saldo. Se descontasse, uma recusa
  // custava ao profissional o valor que pediu.
  it("um pedido recusado devolve o saldo", () => {
    const c = carteiraDe(
      [trabalho({ execucaoEnviadaEm: haDias(2), confirmadoEm: haDias(1) })],
      [{ id: 1, valor: 100, estado: "recusado" }],
      agora,
    );
    expect(c.disponivel).toBe(liquidoDe200);
    expect(c.aCaminho).toBe(0);
    expect(c.levantado).toBe(0);
  });

  it("o disponível nunca fica negativo", () => {
    const c = carteiraDe([trabalho({})], [{ id: 1, valor: 500, estado: "pago" }], agora);
    expect(c.disponivel).toBe(0);
  });

  it("o total ganho inclui o que ainda está cativo", () => {
    const c = carteiraDe(
      [
        trabalho({ negociacaoId: 1 }),
        trabalho({ negociacaoId: 2, execucaoEnviadaEm: haDias(2), confirmadoEm: haDias(1) }),
      ],
      [],
      agora,
    );
    expect(c.totalGanho).toBe(Number((liquidoDe200 * 2).toFixed(2)));
  });

  it("não rebenta com um acordado em falta", () => {
    const c = carteiraDe([trabalho({ valorAcordado: null })], [], agora);
    expect(c.cativo).toBe(0);
  });
});

describe("recusaDoLevantamento", () => {
  const cheia = carteiraDe(
    [trabalho({ execucaoEnviadaEm: haDias(2), confirmadoEm: haDias(1) })],
    [],
    agora,
  );

  it("aceita um pedido dentro do saldo", () => {
    expect(recusaDoLevantamento(50, cheia, true, false)).toBeNull();
  });

  it("sem IBAN não há para onde transferir", () => {
    expect(recusaDoLevantamento(50, cheia, false, false)).toBe("sem_iban");
  });

  // Dois pedidos ao mesmo tempo davam duas transferências do mesmo saldo se o
  // segundo entrasse antes de o primeiro ser processado.
  it("um pedido de cada vez", () => {
    expect(recusaDoLevantamento(50, cheia, true, true)).toBe("ja_tem_pedido");
  });

  it("recusa abaixo do mínimo", () => {
    expect(recusaDoLevantamento(MINIMO_PARA_LEVANTAR - 0.01, cheia, true, false)).toBe(
      "abaixo_do_minimo",
    );
  });

  it("recusa mais do que tem", () => {
    expect(recusaDoLevantamento(cheia.disponivel + 1, cheia, true, false)).toBe(
      "saldo_insuficiente",
    );
  });

  it("recusa lixo", () => {
    for (const v of [0, -10, NaN, Infinity]) {
      expect(recusaDoLevantamento(v, cheia, true, false)).not.toBeNull();
    }
  });

  it("aceita levantar tudo", () => {
    expect(recusaDoLevantamento(cheia.disponivel, cheia, true, false)).toBeNull();
  });
});
