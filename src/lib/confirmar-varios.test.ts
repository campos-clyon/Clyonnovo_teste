import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planoDeConfirmacao, precisaDoParaQue, ROTA_DE_CONFIRMAR, type PedidoAConfirmar } from "./confirmar-varios";

/**
 * CONFIRMAR VÁRIOS TRABALHOS FEITOS DE UMA VEZ, nas Negociações — 08-10-2026.
 *
 * *«Sim, também nas Negociações.»* Confirmar fecha o trabalho e liberta o
 * dinheiro do profissional, e não tem volta: o que importa é quem entra.
 */

const ANTES_DO_IVA = "2026-09-20T10:00:00Z";
const COM_IVA = "2026-10-05T10:00:00Z";
const p = (pedidoId: number, extra: Partial<PedidoAConfirmar> = {}): PedidoAConfirmar => ({
  pedidoId,
  negociacao: { id: pedidoId * 10, criadaEm: ANTES_DO_IVA },
  podeConfirmar: true,
  ...extra,
});

describe("quem entra", () => {
  it("confirma pela rota de cada cartão, com as respostas dadas uma vez", () => {
    const plano = planoDeConfirmacao([p(409)], { paraQue: "sem_factura", como: "transferencia" });
    expect(plano.aConfirmar).toEqual([
      {
        pedidoId: 409,
        corpo: { pedidoId: 409, negociacaoId: 4090, accao: "confirmar", paraQue: "sem_factura", como: "transferencia" },
      },
    ]);
    expect(ROTA_DE_CONFIRMAR).toBe("/api/admin/negociacoes/agir");
  });

  it("o cliente com email confirma pelo link — fica de fora, com o porquê", () => {
    const plano = planoDeConfirmacao([p(407, { podeConfirmar: false })], { paraQue: "sem_factura", como: "numerario" });
    expect(plano.aConfirmar).toEqual([]);
    expect(plano.deFora).toEqual([{ pedidoId: 407, porque: "o cliente tem email e confirma pelo link" }]);
  });

  it("um marcado sem trabalho feito por confirmar não é tocado", () => {
    const plano = planoDeConfirmacao([p(1, { negociacao: null }), p(2)], { paraQue: "com_factura", como: "ainda_nao" });
    expect(plano.semNada).toBe(1);
    expect(plano.aConfirmar.map((c) => c.pedidoId)).toEqual([2]);
  });
});

describe("com ou sem factura", () => {
  it("com IVA incluído é sempre com factura, e não se pergunta", () => {
    const iva = p(420, { negociacao: { id: 1, criadaEm: COM_IVA } });
    expect(precisaDoParaQue([iva])).toBe(false);
    const plano = planoDeConfirmacao([iva], { paraQue: null, como: "transferencia" });
    expect(plano.aConfirmar[0].corpo.paraQue).toBe("com_factura");
  });

  it("antes disso pergunta-se, e sem resposta não se confirma", () => {
    expect(precisaDoParaQue([p(300)])).toBe(true);
    const plano = planoDeConfirmacao([p(300)], { paraQue: null, como: "transferencia" });
    expect(plano.aConfirmar).toEqual([]);
    expect(plano.deFora[0].pedidoId).toBe(300);
  });

  it("os que a CLYON não pode confirmar não fazem a pergunta aparecer", () => {
    expect(precisaDoParaQue([p(300, { podeConfirmar: false })])).toBe(false);
  });
});

describe("o ecrã", () => {
  const PAINEL = readFileSync(join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"), "utf8").replace(
    /\r\n/g,
    "\n",
  );

  it("o que sabe de cada pedido vem das regras do cartão, e não de uma cópia", () => {
    expect(PAINEL).toContain("const n = (p.negociacoes ?? []).find(esperaConfirmacao) ?? null;");
    expect(PAINEL).toContain("podeConfirmar: clyonPodeConfirmar(p),");
  });

  it("pergunta antes, vai um de cada vez, e os recusados ficam marcados", () => {
    const f = PAINEL.slice(PAINEL.indexOf("async function confirmarMarcados()"));
    expect(f).toContain("!window.confirm(");
    expect(f).toContain("for (const c of plano.aConfirmar) {");
    expect(f).toContain("for (const id of feitos) novo.delete(id);");
  });

  it("o bloco dos feitos marca-se inteiro, e a barra tem o botão", () => {
    expect(PAINEL).toContain("setMarcados((m) => new Set([...m, ...porNivel.porConfirmar.map((p) => p.id)]))");
    expect(PAINEL).toContain("Confirmar os feitos · {marcadosAConfirmar().filter((p) => p.negociacao && p.podeConfirmar).length}");
    expect(PAINEL).toContain("onClick={() => void confirmarMarcados()}");
  });
});
