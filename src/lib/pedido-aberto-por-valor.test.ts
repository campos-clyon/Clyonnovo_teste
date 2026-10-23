import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O PEDIDO ABERTO — 23-10-2026, o #467. *«Antes de abrir o pedido mostra
 * quando tem agendamento para aquele profissional na mesma data e horário,
 * porém quando abre não mostra; ao abrir, os profissionais não aparecem no
 * topo, só no corpo; os que não enviaram propostas no final com um botão
 * “ver todos”; as propostas por valor, do menor para o maior.»* — o dono.
 */
const P = readFileSync(join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("o pedido aberto", () => {
  it("o «Em nome do cliente» do topo só com o pedido fechado", () => {
    expect(P).toContain("{espera && !cancelado && !concluido && !feito && !aberto && (");
  });

  it("os profissionais por valor, do menor para o maior, e os sem proposta no fim, atrás de «Ver todos»", () => {
    expect(P).toContain(".sort((a, b) => (valorDe(a) as number) - (valorDe(b) as number));");
    expect(P).toContain("{[...comValor, ...(verSem ? semValor : [])].map(linhaDoProfissional)}");
    expect(P).toContain("`Ver todos — mais ${semValor.length} sem proposta`");
    expect(P).not.toContain("{p.negociacoes.map((n) => {");
  });

  it("a agenda ocupada também lá dentro: o nome, o porquê e os botões a vermelho", () => {
    expect(P).toContain('<span className={`text-sm font-medium ${n.choques?.length ? "text-red-300" : "text-slate-100"}`}>');
    expect(P).toContain("const ocupadoAEssaHora = negociacao.choques?.length");
    expect(P.split("${corDoAceitar}").length - 1).toBe(2);
  });
});
