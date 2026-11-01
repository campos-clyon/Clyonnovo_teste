import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aPagarAClyonDe,
  carteiraDe,
  dividasDe,
  levantavelDe,
  type TrabalhoNaCarteira,
} from "./carteira";
import { camposDoPagamento } from "./carteira-do-profissional";
import type { PagamentoQueFecha } from "./pagamentos-na-base";
import { bloqueioEmDinheiro } from "./bloqueio-por-divida";
import { pagamentoDoClienteParaMostrar } from "./pagamento-visto-pelo-cliente";
import {
  METODO_DA_QUITACAO,
  dividasAQuitar,
  fraseDaQuitacao,
  fraseDoAbatimento,
  fraseDoPagamentoDoProfissional,
  fraseDoPagoEmDinheiro,
  historicoDoDinheiro,
  limiteDaQuitacao,
  planoDoPagamentoDoProfissional,
} from "./pagamento-da-divida";
import { dividaDoRegistoEmMao } from "./pago-em-mao";

/*
 * O ACERTO DE 01-11-2026 E O HISTÓRICO DA DÍVIDA — valores inventados (o
 * repositório é público).
 *
 *   · #1 plataforma, pago em mão COM factura: 150 € a 10 % → deve 15 €;
 *   · #2 plataforma, pago em mão SEM factura: 80 € a 11 % → deve 8,80 €;
 *   · #3 em dinheiro com IVA incluído: 100 € a 10 % → deve IVA + taxa;
 *   · #4 pela plataforma, pago à CLYON: 100 € a 10 % → 90 € disponíveis.
 */

const NOVO = "2026-10-20T10:00:00Z";
const agora = new Date("2026-11-01T15:00:00Z");

function linha(id: number, valor: number, taxa: number, extra: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira {
  return {
    negociacaoId: id,
    estado: "acordada",
    valorAcordado: valor,
    taxaProfissional: taxa,
    taxaCliente: 0,
    formaDePagamento: null,
    execucaoEnviadaEm: "2026-10-25T10:00:00Z",
    confirmadoEm: "2026-10-25T12:00:00Z",
    pagoEm: null,
    clientePagouEm: "2026-10-26T10:00:00Z",
    negociacaoCriadaEm: NOVO,
    ...extra,
  } as TrabalhoNaCarteira;
}

const emMaoComFactura = linha(1, 150, 0.1, { comoEntrou: "ao_profissional", valorQueEntrou: 150 });
const emMaoSemFactura = linha(2, 80, 0.11, { comoEntrou: "ao_profissional", valorQueEntrou: 80 });
const emDinheiro = linha(3, 100, 0.1, { formaDePagamento: "dinheiro", clientePagouEm: null });
const pelaPlataforma = linha(4, 100, 0.1, { comoEntrou: "multibanco" });

const antes = [emMaoComFactura, emMaoSemFactura, emDinheiro, pelaPlataforma];

/** O que a base devolve depois do acerto: uma linha `quitacao` por dívida. */
function depoisDoAcerto(trabalhos: TrabalhoNaCarteira[], metodo = METODO_DA_QUITACAO): TrabalhoNaCarteira[] {
  const em = new Date("2026-11-01T16:00:00Z");
  return trabalhos.map((t) => {
    const l = { id: t.negociacaoId, createdAt: t.negociacaoCriadaEm, formaDePagamento: t.formaDePagamento };
    const pagos = new Map<number, PagamentoQueFecha>();
    if (t.comoEntrou === "ao_profissional") {
      pagos.set(t.negociacaoId, {
        pagoEm: new Date(String(t.clientePagouEm)),
        metodo: "ao_profissional",
        valor: Number(t.valorQueEntrou),
        levantamentoId: null,
        abatimentoAParte: { valor: 1, em, levantamentoId: null, metodo },
      });
    } else if (t.formaDePagamento === "dinheiro") {
      pagos.set(t.negociacaoId, { pagoEm: em, metodo, valor: 1, levantamentoId: null });
    } else if (t.clientePagouEm) {
      pagos.set(t.negociacaoId, {
        pagoEm: new Date(String(t.clientePagouEm)),
        metodo: String(t.comoEntrou),
        valor: 100,
        levantamentoId: null,
      });
    }
    return { ...t, ...camposDoPagamento(l, pagos) };
  });
}

describe("o acerto de 01-11-2026: tudo quitado até esta data", () => {
  it("antes: as três dívidas em aberto, e o reservado tira-se do «Pode pedir já»", () => {
    const deve = aPagarAClyonDe(antes, agora);
    expect(dividasDe(antes, agora).filter((d) => !d.paga)).toHaveLength(3);
    expect(deve).toBeGreaterThan(23.8);
    const k = carteiraDe(antes, [], agora);
    expect(k.disponivel).toBe(90);
    expect(levantavelDe(k, deve)).toBeLessThan(90);
  });

  it("fecha todas as dívidas pagas em mão ou em dinheiro até ao fim do dia", () => {
    const fecha = dividasAQuitar(antes, limiteDaQuitacao());
    expect(fecha.map((d) => d.negociacaoId).sort()).toEqual([1, 2, 3]);
    expect(fecha.reduce((s, d) => s + d.total, 0)).toBeCloseTo(aPagarAClyonDe(antes, agora), 2);
  });

  it("o limite é a meia-noite de 02-11 em Lisboa", () => {
    expect(limiteDaQuitacao().toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("um trabalho feito antes, ainda por confirmar, também fica quitado", () => {
    const porConfirmar = linha(5, 60, 0.1, {
      formaDePagamento: "dinheiro",
      clientePagouEm: null,
      confirmadoEm: null,
      execucaoEnviadaEm: "2026-11-01T09:00:00Z",
    });
    expect(dividasAQuitar([porConfirmar], limiteDaQuitacao()).map((d) => d.negociacaoId)).toEqual([5]);
  });

  it("o que ainda não foi feito, ou foi pago depois de 01-11, fica de fora", () => {
    const porFazer = linha(6, 60, 0.1, {
      formaDePagamento: "dinheiro",
      clientePagouEm: null,
      confirmadoEm: null,
      execucaoEnviadaEm: null,
    });
    const depois = linha(7, 60, 0.1, {
      comoEntrou: "ao_profissional",
      valorQueEntrou: 60,
      execucaoEnviadaEm: "2026-11-03T10:00:00Z",
      confirmadoEm: "2026-11-03T12:00:00Z",
      clientePagouEm: "2026-11-03T13:00:00Z",
    });
    expect(dividasAQuitar([porFazer, depois], limiteDaQuitacao())).toEqual([]);
  });

  it("depois: «A pagar à CLYON» a 0,00 €, sem tocar no saldo nem nos «Recebidos»", () => {
    const k0 = carteiraDe(antes, [], agora);
    const depois = depoisDoAcerto(antes);
    const k1 = carteiraDe(depois, [], agora);
    expect(aPagarAClyonDe(depois, agora)).toBe(0);
    // Nunca abate do «Pode pedir já»: o disponível fica igual, e já não há reserva.
    expect(k1.disponivel).toBe(k0.disponivel);
    expect(k1.abatidoEmDividas).toBe(0);
    expect(levantavelDe(k1, aPagarAClyonDe(depois, agora))).toBe(90);
    // O que ele recebeu em mão continua lá.
    expect(k1.recebidoEmMao).toBe(k0.recebidoEmMao);
    expect(k1.recebidoEmMao).toBeGreaterThan(0);
    expect(bloqueioEmDinheiro(depois, agora).bloqueado).toBe(false);
  });

  it("corre uma vez só: depois do acerto já não há nada a quitar", () => {
    expect(dividasAQuitar(depoisDoAcerto(antes), limiteDaQuitacao())).toEqual([]);
  });

  it("a frase do acerto, com o valor fechado", () => {
    expect(fraseDaQuitacao(23.8)).toBe(
      "Acerto de 01/11/2026: tudo quitado até esta data (decisão da CLYON). Valor fechado: 23,80 €.",
    );
  });
});

describe("a migração, lida do código: uma vez, com cópia, sem apagar", () => {
  const fonte = readFileSync(join(__dirname, "quitacao-na-base.ts"), "utf8");
  const arranque = readFileSync(join(__dirname, "..", "instrumentation.ts"), "utf8");

  it("a marca entra primeiro, na transacção, e um duplicado sai sem escrever", () => {
    const marca = fonte.indexOf('INSERT INTO migracoesFeitas (nome) VALUES (?)');
    const escrita = fonte.indexOf("INSERT IGNORE INTO pagamentos");
    expect(fonte.indexOf("beginTransaction")).toBeGreaterThan(-1);
    expect(marca).toBeGreaterThan(fonte.indexOf("beginTransaction"));
    expect(escrita).toBeGreaterThan(marca);
    expect(fonte).toMatch(/ER_DUP_ENTRY[\s\S]*rollback[\s\S]*ja_estava/);
  });

  it("guarda uma cópia dos pagamentos antes de escrever", () => {
    const copia = fonte.indexOf("INSERT INTO copiaPagamentosAntesDaQuitacao SELECT * FROM pagamentos");
    expect(copia).toBeGreaterThan(-1);
    expect(copia).toBeLessThan(fonte.indexOf("beginTransaction"));
  });

  it("não apaga nem altera linhas que não sejam a referência por pagar", () => {
    expect(fonte).not.toMatch(/DELETE\s+FROM/i);
    const updates = fonte.match(/UPDATE\s+\w+/gi) ?? [];
    expect(updates.map((u) => u.toLowerCase().replace(/\s+/g, " "))).toEqual([
      "update pagamentos",
      "update migracoesfeitas",
    ]);
  });

  it("corre no arranque, nunca durante o build", () => {
    const build = arranque.indexOf('process.env.NEXT_PHASE !== "phase-production-build"');
    expect(build).toBeGreaterThan(-1);
    expect(arranque.indexOf("quitarAsDividasAte01Nov")).toBeGreaterThan(build);
  });
});

describe("só o abatimento sai do saldo", () => {
  it("paga à mão pelo profissional: dívida paga, disponível intacto", () => {
    const depois = depoisDoAcerto(antes, "pro_transferencia");
    expect(aPagarAClyonDe(depois, agora)).toBe(0);
    expect(carteiraDe(depois, [], agora).abatidoEmDividas).toBe(0);
  });

  it("abatida numa transferência: sai do disponível", () => {
    const depois = depoisDoAcerto([emMaoComFactura, pelaPlataforma], "abatimento");
    const k = carteiraDe(depois, [], agora);
    expect(k.abatidoEmDividas).toBeGreaterThan(0);
    expect(k.disponivel).toBeLessThan(90);
  });

  it("o cliente nunca vê o pagamento da dívida como um pagamento dele", () => {
    for (const metodo of ["quitacao", "pro_transferencia", "pro_mbway", "pro_numerario", "abatimento"]) {
      expect(pagamentoDoClienteParaMostrar([{ estado: "pago", metodo }], true)).toBeNull();
    }
  });
});

describe("as frases do histórico", () => {
  it("o cliente pagou ao profissional em dinheiro — com factura", () => {
    // 150 € a 10 %, o cliente pagou com o IVA: ele fica com 135 €, deve o resto.
    const d = dividaDoRegistoEmMao(150, { cliente: 0, profissional: 0.1 }, 184.5);
    expect(fraseDoPagoEmDinheiro(d)).toBe(
      "Cliente pagou 184,50 € ao profissional em dinheiro. O profissional deve à CLYON 49,50 € (IVA 34,50 € + taxa 15,00 €).",
    );
  });

  it("o cliente pagou ao profissional em dinheiro — sem factura, só a taxa", () => {
    const d = dividaDoRegistoEmMao(80, { cliente: 0, profissional: 0.11 }, 80);
    expect(fraseDoPagoEmDinheiro(d)).toBe(
      "Cliente pagou 80,00 € ao profissional em dinheiro. O profissional deve à CLYON 8,80 € (taxa 8,80 €).",
    );
  });

  it("o abatimento numa transferência", () => {
    expect(
      fraseDoAbatimento({ valor: 15, pedidoId: 901, levantamentoId: 42, quando: new Date("2026-11-05T10:00:00Z") }),
    ).toBe("Abatidos 15,00 € da dívida do #901 na transferência de 05/11/2026 (pedido de transferência #42).");
  });

  it("o pagamento à mão", () => {
    expect(fraseDoPagamentoDoProfissional({ valor: 23.8, metodo: "pro_mbway" })).toBe(
      "O profissional pagou 23,80 € à CLYON (MB WAY).",
    );
    expect(fraseDoPagamentoDoProfissional({ valor: 15, metodo: "pro_transferencia", pedidoId: 901 })).toBe(
      "O profissional pagou 15,00 € à CLYON (transferência, dívida do #901).",
    );
  });
});

describe("registar o pagamento do profissional à CLYON", () => {
  const abertas = dividasDe(antes, agora).filter((d) => !d.paga);
  const [maisAntiga] = [...abertas].sort((a, b) => (a.nasceuEm?.getTime() ?? 0) - (b.nasceuEm?.getTime() ?? 0));

  it("o total fecha todas", () => {
    const total = abertas.reduce((s, d) => s + d.total, 0);
    const p = planoDoPagamentoDoProfissional(abertas, total);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.fecha).toHaveLength(3);
  });

  it("um valor que bate com a mais antiga fecha só essa", () => {
    const p = planoDoPagamentoDoProfissional(abertas, maisAntiga.total);
    expect(p.ok && p.fecha.map((d) => d.negociacaoId)).toEqual([maisAntiga.negociacaoId]);
  });

  it("um valor que não fecha dívidas inteiras é recusado, e diz os que fecham", () => {
    const p = planoDoPagamentoDoProfissional(abertas, 1.23);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.porque).toMatch(/Valores que fecham/);
  });

  it("mais do que deve, ou sem dívidas, é recusado", () => {
    expect(planoDoPagamentoDoProfissional(abertas, 10_000).ok).toBe(false);
    expect(planoDoPagamentoDoProfissional([], 10).ok).toBe(false);
  });
});

describe("o histórico do dinheiro mostra as duas direcções", () => {
  const h = historicoDoDinheiro(
    [
      { id: 42, valor: "90.00", estado: "pago", processadoEm: "2026-11-05T10:00:00Z", processadoPor: "Equipa" },
      { id: 43, valor: "10.00", estado: "pedido", processadoEm: null },
    ],
    [
      {
        acontecimento: "divida_paga_pelo_profissional",
        ocorridoEm: "2026-11-04T10:00:00Z",
        autorNome: "Equipa",
        resumo: "O profissional pagou 15,00 € à CLYON (transferência).",
        pedidoId: 901,
        valor: "15.00",
      },
      {
        acontecimento: "divida_quitada",
        ocorridoEm: "2026-11-01T16:00:00Z",
        resumo: fraseDaQuitacao(23.8),
        pedidoId: null,
        valor: "23.80",
      },
      // A linha de cada trabalho do acerto vê-se no pedido, não aqui.
      { acontecimento: "divida_quitada", ocorridoEm: "2026-11-01T16:00:00Z", resumo: "x", pedidoId: 901 },
      {
        acontecimento: "pagamento_recebido",
        ocorridoEm: "2026-10-26T10:00:00Z",
        resumo: "Cliente pagou 80,00 € ao profissional em dinheiro. O profissional deve à CLYON 8,80 € (taxa 8,80 €).",
        detalheJson: JSON.stringify({ metodo: "ao_profissional" }),
        pedidoId: 902,
      },
      // O cliente a pagar à CLYON não é dinheiro do profissional.
      { acontecimento: "pagamento_recebido", detalheJson: JSON.stringify({ metodo: "multibanco" }), resumo: "y" },
      { acontecimento: "levantamento_pago", ocorridoEm: "2026-10-30T10:00:00Z", valor: "45.00", pedidoId: 903 },
    ],
  );

  it("do mais recente para o mais antigo, em linguagem clara", () => {
    expect(h.map((e) => e.direccao)).toEqual([
      "clyon_para_profissional",
      "profissional_para_clyon",
      "acerto",
      "clyon_para_profissional",
      "cliente_para_profissional",
    ]);
    expect(h[0].texto).toBe("A CLYON transferiu 90,00 € ao profissional (pedido de transferência #42).");
    expect(h[3].texto).toBe("A CLYON transferiu 45,00 € ao profissional pelo #903.");
  });
});

describe("«Pagamentos em dinheiro»: fechado por omissão, no fim da carteira", () => {
  const raiz = join(__dirname, "..", "..");
  const painel = readFileSync(join(raiz, "src/app/profissionais/painel/Carteira.tsx"), "utf8");
  const app = readFileSync(join(raiz, "app-pro/src/app/(app)/carteira.tsx"), "utf8");

  it("no painel, «A pagar à CLYON», «Recebido em mão» e as dívidas vivem dentro do <details>", () => {
    const abre = painel.indexOf("<details");
    const fecha = painel.indexOf("</details>");
    expect(abre).toBeGreaterThan(-1);
    expect(painel.slice(abre, abre + 400)).toContain("Pagamentos em dinheiro");
    expect(painel.slice(abre, abre + 120)).not.toMatch(/\bopen\b/);
    for (const k of ["R.aPagarAClyon.rotulo", "R.recebidoEmMao.rotulo", "<DividaNoSaldo", "<Divida "]) {
      const i = painel.indexOf(k);
      expect(i, k).toBeGreaterThan(abre);
      expect(i, k).toBeLessThan(fecha);
    }
  });

  it("na app Pro, o mesmo, atrás de um toque que começa fechado", () => {
    expect(app).toContain("useState(false)");
    const abre = app.indexOf("<PagamentosEmDinheiro>");
    const fecha = app.indexOf("</PagamentosEmDinheiro>");
    expect(abre).toBeGreaterThan(-1);
    for (const k of ["R.aPagarAClyon.rotulo", "R.recebidoEmMao.rotulo", "<DividaNoSaldo", "<Divida "]) {
      const i = app.indexOf(k);
      expect(i, k).toBeGreaterThan(abre);
      expect(i, k).toBeLessThan(fecha);
    }
  });
});
