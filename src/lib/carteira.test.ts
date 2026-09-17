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
    expect(c).toEqual({ porCobrar: 0, cativo: 0, disponivel: 0, aCaminho: 0, levantado: 0, totalGanho: 0 });
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

/**
 * ⚠️ O MUNDO EM QUE A PLATAFORMA JÁ COBRA — 17-09-2026.
 *
 * *«Os pagamentos recebidos vão para a conta usando o euPago; não fica nada no
 * euPago cativo, apenas o site diz isso — e não liberta o levantamento sem que
 * o cliente confirme o trabalho realizado.»*
 *
 * Como o dinheiro fica numa conta da CLYON e não numa caução do euPago, é o
 * SITE que segura a promessa. Estes testes são essa promessa escrita: sem eles,
 * o dia em que `A_PLATAFORMA_COBRA` mudar é o dia em que se descobre que
 * «cativo» queria dizer outra coisa.
 *
 * Passa-se `aPlataformaCobra` à mão de propósito — para se poder provar o mundo
 * de amanhã sem mexer no interruptor de hoje.
 */
const COBRA = { aPlataformaCobra: true } as const;

describe("com a plataforma a cobrar, o pagamento manda sobre a fase", () => {
  const pago = trabalho({
    confirmadoEm: haDias(1),
    clientePagouEm: haDias(2),
  });
  const porPagar = trabalho({ negociacaoId: 2, confirmadoEm: haDias(1) });

  it("um trabalho pago e confirmado fica disponível, como sempre", () => {
    const c = carteiraDe([pago], [], agora, COBRA);
    expect(c.disponivel).toBe(liquidoDe200);
    expect(c.porCobrar).toBe(0);
  });

  /*
   * O TESTE QUE IMPEDE A CLYON DE TRANSFERIR O QUE NUNCA RECEBEU.
   *
   * O cliente confirmou que o trabalho está feito, mas não pagou. Sem esta
   * regra, o valor ia para «disponível» e o profissional podia levantá-lo —
   * com dinheiro que não existe em conta nenhuma.
   */
  it("confirmado mas NÃO pago não fica disponível — fica por cobrar", () => {
    const c = carteiraDe([porPagar], [], agora, COBRA);
    expect(c.disponivel).toBe(0);
    expect(c.cativo).toBe(0);
    expect(c.porCobrar).toBe(liquidoDe200);
  });

  /*
   * E o prazo de sete dias também não o liberta. É a mesma armadilha por
   * outro caminho: o prazo existe para o cliente não prender o dinheiro do
   * profissional — não para inventar dinheiro que ninguém entregou.
   */
  it("nem o prazo automático liberta um trabalho por pagar", () => {
    const velho = trabalho({ negociacaoId: 3, execucaoEnviadaEm: haDias(30) });
    const c = carteiraDe([velho], [], agora, COBRA);
    expect(c.disponivel).toBe(0);
    expect(c.porCobrar).toBe(liquidoDe200);
  });

  it("pago e por confirmar é «cativo» — e aí o site diz a verdade", () => {
    const c = carteiraDe(
      [trabalho({ execucaoEnviadaEm: haDias(1), clientePagouEm: haDias(2) })],
      [],
      agora,
      COBRA,
    );
    expect(c.cativo).toBe(liquidoDe200);
    expect(c.porCobrar).toBe(0);
    expect(c.disponivel).toBe(0);
  });

  it("o total ganho continua a contar o trabalho feito, pago ou não", () => {
    const c = carteiraDe([pago, porPagar], [], agora, COBRA);
    expect(c.totalGanho).toBe(liquidoDe200 * 2);
    expect(c.disponivel).toBe(liquidoDe200);
    expect(c.porCobrar).toBe(liquidoDe200);
  });

  /*
   * ⚠️ E SEM O INTERRUPTOR, NADA DISTO ACONTECE.
   *
   * É o teste que protege os profissionais de hoje: se `oClientePagou`
   * respondesse «não» quando não há pagamentos, a carteira inteira de toda a
   * gente ia para «por cobrar» no primeiro deploy.
   */
  it("sem a plataforma a cobrar, um trabalho sem pagamento conta como sempre contou", () => {
    const c = carteiraDe([porPagar], [], agora, { aPlataformaCobra: false });
    expect(c.porCobrar).toBe(0);
    expect(c.disponivel).toBe(liquidoDe200);
  });
});

describe("a recusa diz porquê, e não só que não chega", () => {
  const aEsperaDoCliente = carteiraDe(
    [trabalho({ confirmadoEm: haDias(1) })],
    [],
    agora,
    COBRA,
  );

  it("com trabalho por cobrar, explica que o cliente é que não pagou", () => {
    expect(recusaDoLevantamento(50, aEsperaDoCliente, true, false)).toBe("a_espera_do_cliente");
  });

  it("sem nada por cobrar, continua a ser saldo insuficiente", () => {
    const vazia = carteiraDe([], [], agora, COBRA);
    expect(recusaDoLevantamento(50, vazia, true, false)).toBe("saldo_insuficiente");
  });

  // A falta de IBAN vem primeiro: é a única que ele resolve sozinho e já.
  it("a falta de IBAN continua a mandar em tudo o resto", () => {
    expect(recusaDoLevantamento(50, aEsperaDoCliente, false, false)).toBe("sem_iban");
  });
});
