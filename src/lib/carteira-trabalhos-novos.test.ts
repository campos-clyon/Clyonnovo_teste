import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * A tabela dos pagamentos, fingida: o que interessa aqui é POR QUEM se
 * pergunta, e o que a carteira faz com a resposta.
 */
const pagas = vi.hoisted(() => ({
  perguntados: [] as number[][],
  resposta: new Map<number, Date>(),
}));
vi.mock("./pagamentos-na-base", () => ({
  negociacoesPagas: vi.fn(async (ids: number[]) => {
    pagas.perguntados.push(ids);
    return new Map([...pagas.resposta].filter(([id]) => ids.includes(id)));
  }),
  // A carteira lê o pagamento com o método (01-10-2026, «abater no saldo»).
  negociacoesPagasComDetalhe: vi.fn(async (ids: number[]) => {
    pagas.perguntados.push(ids);
    return new Map(
      [...pagas.resposta]
        .filter(([id]) => ids.includes(id))
        .map(([id, pagoEm]) => [id, { pagoEm, metodo: "multibanco", valor: 0, levantamentoId: null }]),
    );
  }),
}));

import {
  VERIFICAR_PAGAMENTO_DESDE,
  carteiraDe,
  destinoDoValorConcluido,
  oClientePagou,
  porCobrarDe,
  recusaDoLevantamento,
  verificaOPagamento,
  type TrabalhoNaCarteira,
} from "./carteira";
import { pagamentosAVerificar, trabalhosDaCarteira } from "./carteira-do-profissional";
import { movimentoDoTrabalho } from "./livro-da-carteira";
import { A_PLATAFORMA_COBRA } from "./pagamento-na-plataforma";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";

/**
 * «LIGAR, SÓ PARA TRABALHOS NOVOS» — decisão do dono, 01-10-2026.
 *
 * A regra de 17-09-2026 (confirmado mas não pago fica «por cobrar», nunca
 * «disponível») passa a valer com `A_PLATAFORMA_COBRA` desligado — mas só nos
 * trabalhos cuja negociação foi aberta a partir de `VERIFICAR_PAGAMENTO_DESDE`.
 * Os anteriores ficam exactamente como estavam, e o dinheiro em mão não muda.
 *
 * Estes testes correm com o interruptor COMO ESTÁ (desligado) e sem passar
 * `aPlataformaCobra`: é o mundo de produção.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const agora = new Date("2026-10-20T12:00:00Z");
const ontem = new Date(agora.getTime() - 86_400_000);
const haDias = (n: number) => new Date(agora.getTime() - n * 86_400_000);

/** Meia-noite de Lisboa de 01-10-2026 é 23:00 de 30-09 em UTC (hora de Verão). */
const ANTES = new Date("2026-09-30T22:59:59Z");
const NO_CORTE = new Date("2026-09-30T23:00:00Z");
const DEPOIS = new Date("2026-10-05T10:00:00Z");

const trabalho = (p: Partial<TrabalhoNaCarteira>): TrabalhoNaCarteira => ({
  negociacaoId: 1,
  estado: "acordada",
  valorAcordado: 200,
  execucaoEnviadaEm: haDias(2),
  confirmadoEm: ontem,
  ...p,
});

const LIQUIDO = quantoOProfissionalRecebe(200);

describe("a data de corte", () => {
  it("é a meia-noite de 01-10-2026 em Lisboa", () => {
    expect(VERIFICAR_PAGAMENTO_DESDE.toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });

  it("o interruptor continua desligado — estes testes são o mundo de produção", () => {
    expect(A_PLATAFORMA_COBRA).toBe(false);
  });

  it("verifica desde o corte, inclusive, e não antes", () => {
    expect(verificaOPagamento({ negociacaoCriadaEm: ANTES })).toBe(false);
    expect(verificaOPagamento({ negociacaoCriadaEm: NO_CORTE })).toBe(true);
    expect(verificaOPagamento({ negociacaoCriadaEm: DEPOIS })).toBe(true);
  });

  it("lê a data como vem da base, em texto ou em Date", () => {
    expect(verificaOPagamento({ negociacaoCriadaEm: "2026-10-02T08:00:00Z" })).toBe(true);
    expect(verificaOPagamento({ negociacaoCriadaEm: "2026-09-15T08:00:00Z" })).toBe(false);
  });

  it("sem data, ou com lixo, conta como anterior — o lado em que nada muda", () => {
    expect(verificaOPagamento({})).toBe(false);
    expect(verificaOPagamento({ negociacaoCriadaEm: null })).toBe(false);
    expect(verificaOPagamento({ negociacaoCriadaEm: "isto não é uma data" })).toBe(false);
  });

  it("com o interruptor ligado, verifica todos, como antes", () => {
    expect(verificaOPagamento({ negociacaoCriadaEm: ANTES }, { aPlataformaCobra: true })).toBe(true);
    expect(verificaOPagamento({}, { aPlataformaCobra: true })).toBe(true);
  });
});

describe("trabalhos anteriores ao corte — exactamente como hoje", () => {
  it("confirmado e sem pagamento registado continua disponível", () => {
    const t = trabalho({ negociacaoCriadaEm: ANTES });
    expect(oClientePagou(t)).toBe(true);
    const c = carteiraDe([t], [], agora);
    expect(c.disponivel).toBe(LIQUIDO);
    expect(c.porCobrar).toBe(0);
    expect(destinoDoValorConcluido(t)).toBe("disponivel");
  });

  it("os de antes de 17-09-2026, pagos em mão sem registo, não caem em «por cobrar»", () => {
    const t = trabalho({ negociacaoCriadaEm: new Date("2026-09-01T10:00:00Z"), confirmadoEm: haDias(40) });
    expect(carteiraDe([t], [], agora).porCobrar).toBe(0);
    expect(porCobrarDe([t])).toBe(0);
  });

  it("em dinheiro, recebido em mão", () => {
    const c = carteiraDe([trabalho({ negociacaoCriadaEm: ANTES, formaDePagamento: "dinheiro" })], [], agora);
    expect(c.recebidoEmMao).toBe(LIQUIDO);
    expect(c.disponivel).toBe(0);
  });

  it("e o livro continua a dar-lhes movimento", () => {
    expect(movimentoDoTrabalho({ ...trabalho({ negociacaoCriadaEm: ANTES }), providerId: 7 })).not.toBeNull();
  });
});

describe("trabalhos novos — o pagamento manda sobre a fase", () => {
  it("confirmado e NÃO pago fica por cobrar, e não disponível", () => {
    const t = trabalho({ negociacaoCriadaEm: DEPOIS });
    const c = carteiraDe([t], [], agora);
    expect(c.porCobrar).toBe(LIQUIDO);
    expect(c.disponivel).toBe(0);
    expect(c.cativo).toBe(0);
    // O total ganho continua a contar o trabalho feito.
    expect(c.totalGanho).toBe(LIQUIDO);
  });

  it("nem o prazo automático dos 7 dias o põe disponível", () => {
    const t = trabalho({ negociacaoCriadaEm: DEPOIS, confirmadoEm: null, execucaoEnviadaEm: haDias(9) });
    const c = carteiraDe([t], [], agora);
    expect(c.disponivel).toBe(0);
    expect(c.porCobrar).toBe(LIQUIDO);
  });

  it("no próprio instante do corte já conta como novo", () => {
    expect(carteiraDe([trabalho({ negociacaoCriadaEm: NO_CORTE })], [], agora).porCobrar).toBe(LIQUIDO);
  });

  it("pago e confirmado fica disponível", () => {
    const t = trabalho({ negociacaoCriadaEm: DEPOIS, clientePagouEm: haDias(3) });
    const c = carteiraDe([t], [], agora);
    expect(c.disponivel).toBe(LIQUIDO);
    expect(c.porCobrar).toBe(0);
  });

  it("pago e por confirmar fica cativo", () => {
    const t = trabalho({ negociacaoCriadaEm: DEPOIS, clientePagouEm: haDias(3), confirmadoEm: null, execucaoEnviadaEm: ontem });
    expect(carteiraDe([t], [], agora).cativo).toBe(LIQUIDO);
  });

  it("em dinheiro não muda nada: recebido em mão, nunca por cobrar", () => {
    const t = trabalho({ negociacaoCriadaEm: DEPOIS, formaDePagamento: "dinheiro" });
    const c = carteiraDe([t], [], agora);
    expect(c.recebidoEmMao).toBe(LIQUIDO);
    expect(c.porCobrar).toBe(0);
    expect(c.disponivel).toBe(0);
    expect(porCobrarDe([t])).toBe(0);
    expect(destinoDoValorConcluido(t)).toBe("em_mao");
  });

  it("e o livro não lhe escreve movimento enquanto não for pago", () => {
    expect(movimentoDoTrabalho({ ...trabalho({ negociacaoCriadaEm: DEPOIS }), providerId: 7 })).toBeNull();
    expect(
      movimentoDoTrabalho({ ...trabalho({ negociacaoCriadaEm: DEPOIS, clientePagouEm: ontem }), providerId: 7 }),
    ).not.toBeNull();
  });
});

describe("o levantamento não deixa levantar o que está por cobrar", () => {
  it("um trabalho novo por pagar não dá saldo para transferir", () => {
    const c = carteiraDe([trabalho({ negociacaoCriadaEm: DEPOIS })], [], agora);
    expect(recusaDoLevantamento(LIQUIDO, c, true, false, 0)).toBe("a_espera_do_cliente");
    expect(recusaDoLevantamento(10, c, true, false, 0)).toBe("a_espera_do_cliente");
  });

  it("ao lado de um antigo, só o antigo se levanta", () => {
    const c = carteiraDe(
      [
        trabalho({ negociacaoId: 1, negociacaoCriadaEm: ANTES }),
        trabalho({ negociacaoId: 2, negociacaoCriadaEm: DEPOIS }),
      ],
      [],
      agora,
    );
    expect(c.disponivel).toBe(LIQUIDO);
    expect(c.porCobrar).toBe(LIQUIDO);
    expect(recusaDoLevantamento(LIQUIDO, c, true, false, 0)).toBeNull();
    expect(recusaDoLevantamento(LIQUIDO + 10, c, true, false, 0)).toBe("a_espera_do_cliente");
  });

  it("a rota do levantamento usa a mesma conversão e a mesma carteira do painel", () => {
    const rota = ler("src/app/api/profissionais/levantamento/route.ts");
    expect(rota).toContain("await trabalhosDaCarteira(linhas)");
    expect(rota).toContain("carteiraDe(");
    expect(rota).toContain("recusaDoLevantamento(");
  });
});

describe("o email de «trabalho confirmado» diz o mesmo que a carteira", () => {
  it("caso a caso: antes/depois do corte, pago/por pagar, dinheiro", () => {
    for (const t of [
      trabalho({ negociacaoCriadaEm: ANTES }),
      trabalho({ negociacaoCriadaEm: DEPOIS }),
      trabalho({ negociacaoCriadaEm: DEPOIS, clientePagouEm: ontem }),
      trabalho({ negociacaoCriadaEm: DEPOIS, formaDePagamento: "dinheiro" }),
      trabalho({ negociacaoCriadaEm: ANTES, formaDePagamento: "dinheiro" }),
    ]) {
      const c = carteiraDe([t], [], agora);
      const destino = destinoDoValorConcluido(t);
      expect({
        emMao: c.recebidoEmMao > 0,
        porCobrar: c.porCobrar > 0,
        disponivel: c.disponivel > 0,
      }).toEqual({
        emMao: destino === "em_mao",
        porCobrar: destino === "por_cobrar",
        disponivel: destino === "disponivel",
      });
    }
  });

  it("o trabalho novo por pagar é «por cobrar» no email", () => {
    expect(destinoDoValorConcluido(trabalho({ negociacaoCriadaEm: DEPOIS }))).toBe("por_cobrar");
  });

  it("e o aviso lê a negociação inteira, com a data de abertura", () => {
    // `negociacoesDoPedido` faz `SELECT n.*` — o `createdAt` vem lá dentro e
    // `trabalhosDaCarteira` passa-o à carteira.
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function negociacoesDoPedido");
    expect(DB.slice(i, i + 1200)).toContain("SELECT n.*,");
    expect(ler("src/lib/avisar-confirmacao.ts")).toContain("await trabalhosDaCarteira([n])");
  });
});

describe("a conversão da base pergunta só pelos trabalhos novos", () => {
  beforeEach(() => {
    pagas.perguntados = [];
    pagas.resposta = new Map();
  });

  it("os antigos não vão à tabela dos pagamentos", async () => {
    const m = await pagamentosAVerificar([
      { id: 1, createdAt: ANTES },
      { id: 2, createdAt: null },
    ]);
    expect(m.size).toBe(0);
    expect(pagas.perguntados).toEqual([]);
  });

  it("os novos vão, e só eles", async () => {
    await pagamentosAVerificar([
      { id: 1, createdAt: ANTES },
      { id: 2, createdAt: DEPOIS },
      { id: 3, createdAt: "2026-10-10 09:00:00" },
    ]);
    expect(pagas.perguntados).toEqual([[2, 3]]);
  });

  it("trabalhosDaCarteira passa a data e o pagamento, e a carteira faz o resto", async () => {
    pagas.resposta = new Map([[3, ontem]]);
    const linha = (id: number, createdAt: Date | null) => ({
      id,
      estado: "acordada",
      valorAcordado: "200.00",
      formaDePagamento: null,
      execucaoEnviadaEm: haDias(2),
      confirmadoEm: ontem,
      pagoEm: null,
      createdAt,
    });
    const trabalhos = await trabalhosDaCarteira([
      linha(1, ANTES), // antigo, sem pagamento → disponível, como hoje
      linha(2, DEPOIS), // novo, sem pagamento → por cobrar
      linha(3, DEPOIS), // novo, pago → disponível
    ]);
    expect(trabalhos.map((t) => t.negociacaoCriadaEm)).toEqual([ANTES, DEPOIS, DEPOIS]);
    expect(trabalhos[2].clientePagouEm).toEqual(ontem);

    const c = carteiraDe(trabalhos, [], agora);
    expect(c.disponivel).toBe(LIQUIDO * 2);
    expect(c.porCobrar).toBe(LIQUIDO);
  });
});

describe("todas as leituras da base trazem a data de abertura", () => {
  /*
   * Uma leitura que a esqueça põe os trabalhos novos no regime antigo, sem
   * erro nenhum — a carteira volta a deixar levantar o que não foi pago. Por
   * isso cada uma é verificada aqui.
   */
  const DB = ler("src/lib/db.ts");
  const corpo = (inicio: string) => {
    const i = DB.indexOf(inicio);
    expect(i).toBeGreaterThan(-1);
    return DB.slice(i, DB.indexOf("\nexport ", i + 1));
  };

  it("a lista do profissional (painel, carteira e levantamento)", () => {
    expect(corpo("export async function negociacoesDoProfissional")).toContain("n.createdAt,");
  });

  it("o livro da carteira", () => {
    const livro = corpo("async function tudoOQueOLivroPrecisa");
    expect(livro).toContain("pagoEm, createdAt");
    expect(livro).toContain("negociacaoCriadaEm: n.createdAt ?? null");
    // Com o detalhe desde 01-10-2026: a dívida abatida no saldo é um movimento.
    expect(livro).toContain("pagamentosAVerificarComDetalhe(");
    expect(livro).toContain("...camposDoPagamento(");
  });

  it("o apagar de um profissional, que decide pela carteira", () => {
    expect(corpo("export async function apagarProfissional(")).toContain(
      "execucaoEnviadaEm, confirmadoEm, pagoEm, createdAt",
    );
  });

  it("a conversão passa-a à carteira", () => {
    expect(ler("src/lib/carteira-do-profissional.ts")).toContain("negociacaoCriadaEm: l.createdAt ?? null");
  });

  it("o cartão do trabalho pergunta como a carteira pergunta", () => {
    const rota = ler("src/app/api/profissionais/meus-pedidos/route.ts");
    expect(rota).toContain("verificaOPagamento({ negociacaoCriadaEm: l.createdAt })");
    expect(rota).toContain("await pagamentosAVerificar(linhas)");
    expect(rota).not.toContain("A_PLATAFORMA_COBRA");
  });
});
