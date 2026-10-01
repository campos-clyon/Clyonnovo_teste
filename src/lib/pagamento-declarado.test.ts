import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMO_PAGOU,
  PARA_QUE,
  fraseDaDeclaracao,
  lerComoPagou,
  lerParaQue,
  metodoDoRecebimento,
  valorDoPagamento,
} from "./pagamento-declarado";
import { RECEBIMENTOS_A_MAO } from "./dinheiro-do-trabalho";
import { contaDoCliente } from "./taxas-plataforma";

/**
 * «Está feito», e depois as duas perguntas — 29-09-2026.
 *
 * «Vamos deixar apenas "Está feito" e depois vamos perguntar para que foi
 * feito o pagamento e como o cliente pagou; essas informações devem ir para os
 * registos para confirmar depois nos pagamentos.»
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

// O trabalho de 270 € da Sandra Matos: 283,50 € sem factura, 348,71 € com.
const CONTA = contaDoCliente(270);

describe("para que foi o pagamento", () => {
  it("são os dois números que a caixa de confirmar já mostra", () => {
    expect(CONTA.semIva).toBe(283.5);
    expect(CONTA.total).toBe(348.71);
    // Antes do corte de 01-10-2026; com IVA incluído é sempre o total.
    expect(valorDoPagamento(CONTA, "sem_factura", "sem_iva")).toBe(283.5);
    expect(valorDoPagamento(CONTA, "com_factura", "sem_iva")).toBe(348.71);
    expect(valorDoPagamento(CONTA, "sem_factura", "iva_incluido")).toBe(348.71);
  });

  it("sem declaração fica o total, que é o que sempre se gravou", () => {
    // Um trabalho confirmado antes de haver a pergunta lê-se como era.
    expect(valorDoPagamento(CONTA, null, "sem_iva")).toBe(348.71);
  });

  it("só aceita o que está na lista", () => {
    expect(lerParaQue("com_factura")).toBe("com_factura");
    expect(lerParaQue("metade")).toBeNull();
    expect(lerParaQue(undefined)).toBeNull();
    expect(PARA_QUE.map((p) => p.id)).toEqual(["sem_factura", "com_factura"]);
  });
});

describe("como é que o cliente pagou", () => {
  it("as formas à mão são AS MESMAS dos Pagamentos, mais «ainda não»", () => {
    /*
     * A declaração e o recebimento não podem discordar: o que se diz aqui é o
     * que se grava lá com um toque. Uma forma que só existisse deste lado
     * ficava declarada e impossível de confirmar.
     */
    const aqui = COMO_PAGOU.map((c) => c.id).filter((c) => c !== "ainda_nao");
    expect([...aqui].sort()).toEqual([...RECEBIMENTOS_A_MAO].sort());
    expect(COMO_PAGOU.map((c) => c.id)).toContain("ainda_nao");
  });

  it("«ainda não pagou» não é método de recebimento nenhum", () => {
    expect(metodoDoRecebimento("ainda_nao")).toBeNull();
    expect(metodoDoRecebimento(null)).toBeNull();
    expect(metodoDoRecebimento("transferencia")).toBe("transferencia");
    expect(metodoDoRecebimento("ao_profissional")).toBe("ao_profissional");
  });

  it("só aceita o que está na lista", () => {
    expect(lerComoPagou("numerario")).toBe("numerario");
    // MB WAY e Multibanco entram pelo euPago, que os marca sozinho.
    expect(lerComoPagou("mbway")).toBeNull();
    expect(lerComoPagou("cheque")).toBeNull();
  });
});

describe("a frase que fica nos registos", () => {
  it("escrita por inteiro, com o valor", () => {
    expect(fraseDaDeclaracao("com_factura", "transferencia", 348.71)).toBe(
      "Com factura, 348,71 € — Transferência.",
    );
  });

  it("diz quando o cliente ainda não pagou", () => {
    expect(fraseDaDeclaracao("sem_factura", "ainda_nao", 283.5)).toBe(
      "Sem factura, 283,50 € — o cliente ainda não pagou.",
    );
  });

  it("sem valor acordado não inventa um número", () => {
    expect(fraseDaDeclaracao("sem_factura", "numerario", null)).toBe("Sem factura — Numerário.");
  });
});

describe("as peças estão ligadas", () => {
  const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");
  const AGIR = ler("src/app/api/admin/negociacoes/agir/route.ts");
  const DB = ler("src/lib/db.ts");
  const PAGAMENTOS = ler("src/app/api/admin/pagamentos/route.ts");
  const RECEBIDO = ler("src/app/api/admin/pagamentos/recebido/route.ts");
  const PAINEL_PAG = ler("src/components/admin/AdminPagamentosPanel.tsx");

  it("o botão diz só «Está feito»", () => {
    // Ao texto DENTRO do botão: o comentário que explica a mudança cita o antigo.
    expect(PAINEL).not.toContain("Está feito — libertar o pagamento\n        </button>");
    // Desde 01-10-2026 o mesmo botão diz «Já está feito — finalizar» quando o
    // profissional não deu o trabalho por entregue. O de sempre continua só
    // «Está feito».
    expect(PAINEL).toContain('{semProva ? "Já está feito — finalizar" : "Está feito"}');
  });

  it("as duas perguntas estão no ecrã, e o pedido leva as respostas", () => {
    expect(PAINEL).toContain("Para que foi o pagamento?");
    expect(PAINEL).toContain("Como é que o cliente pagou?");
    expect(PAINEL).toContain('accao: "confirmar", paraQue, como');
  });

  it("a rota recusa confirmar sem as duas respostas", () => {
    expect(AGIR).toContain("const paraQue = lerParaQue(corpo.paraQue);");
    expect(AGIR).toContain("const como = lerComoPagou(corpo.como);");
    expect(AGIR).toContain("if (!paraQue || !como) {");
  });

  it("a declaração vai no MESMO update que a confirmação", () => {
    // Gravada à parte, uma falha entre os dois deixava um trabalho confirmado
    // sem a resposta que se deu para o confirmar.
    const i = DB.indexOf("export async function confirmarExecucao");
    const corpo = DB.slice(i, DB.indexOf("export async function libertarTrabalhosPorPrazo"));
    expect(corpo).toContain("SET confirmadoEm = NOW(),");
    expect(corpo).toContain("pagamentoParaQue = ?, pagamentoComo = ?,");
    expect(AGIR).toContain("confirmarExecucao(negociacaoId, pedidoId, {");
  });

  it("fica no registo permanente como acontecimento próprio", () => {
    // O trabalho feito e o pagamento declarado são factos diferentes.
    expect(DB).toContain('| "pagamento_declarado"');
    expect(AGIR).toContain('acontecimento: "pagamento_declarado"');
    expect(AGIR).toContain('acontecimento: "execucao_confirmada"');
  });

  it("o histórico já não diz «pagamento libertado»", () => {
    // Confirmar o trabalho não põe dinheiro nenhum na conta.
    expect(AGIR).not.toContain("Pagamento libertado.");
  });

  it("os Pagamentos lêem a declaração e cobram o valor certo", () => {
    expect(PAGAMENTOS).toContain("n.pagamentoParaQue, n.pagamentoComo");
    // E no modelo da negociação: com IVA incluído é sempre o total (01-10-2026).
    expect(PAGAMENTOS).toContain("valorDoPagamento(contaDoCliente(acordado, taxas), paraQue, modelo)");
    expect(PAGAMENTOS).toContain("await ensureNegociacoesTable();");
  });

  it("o recebimento grava sem IVA a quem declarou sem factura", () => {
    // Antes gravava sempre o total com IVA — 23 % a mais em cada um.
    expect(RECEBIDO).toContain("lerParaQue(l.pagamentoParaQue)");
    expect(RECEBIDO).not.toContain(
      "const valor = contaDoCliente(Number(l.valorAcordado), taxasDaNegociacao(l)).total;",
    );
  });

  it("nos Pagamentos, a declaração confirma-se com um toque — e há saída se foi de outra forma", () => {
    expect(PAINEL_PAG).toContain("Confirmar que entrou");
    expect(PAINEL_PAG).toContain("Entrou de outra forma");
    expect(PAINEL_PAG).toContain("onEntrou(metodo)");
  });
});
