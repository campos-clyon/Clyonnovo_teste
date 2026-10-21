import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * MAIS OPÇÕES NO LOTE DA MESA — 21-10-2026. *«Ao marcar os pedidos coloque
 * mais opções, inclusive o “Já enviei”.»* — o dono.
 */
const M = readFileSync(join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("«Já enviei» nos marcados", () => {
  it("só os que têm o que enviar e ainda não estão marcados — os dois tipos, cada um pela sua rota", () => {
    expect(M).toContain("propostasParaOCliente(p.negociacoes).length > 0 &&");
    expect(M).toContain("!orcamentoEnviadoCobre(p),");
    expect(M).toContain('(t) => marcados.has(t.pedidoId) && t.resumo.fase === "escolher" && !t.propostaEnviadaEm,');
    expect(M).toContain('{ accao: "orcamento_enviado", pedidoId: p.id }');
    expect(M).toContain('{ pedidoId: t.pedidoId, accao: "ja_enviei" }');
    expect(M).toContain("Já enviei · {enviaveisNegociacao.length + enviaveisClyon.length}");
  });
});

describe("«Cancelar» nos marcados", () => {
  it("um motivo para todos, dos da Mesa, e cada um pela sua rota", () => {
    expect(M).toContain("function MotivoParaCancelarVarios({");
    expect(M).toContain('{[...MOTIVOS_DE_CANCELAMENTO, "Outro motivo"].map((m) => (');
    expect(M).toContain('"/api/admin/negociacoes/cancelar", "POST", { pedidoId: p.id, motivo }');
    expect(M).toContain('{ pedidoId: t.pedidoId, accao: "cancelar", motivo }');
  });

  it("fora os concluídos, os já cancelados e os valor fixo já feitos", () => {
    expect(M).toContain('(p) => marcados.has(p.id) && p.status !== "cancelado" && !pedidoConcluido(p),');
    expect(M).toContain('!["cancelada", "confirmada", "paga", "por_confirmar"].includes(t.resumo.fase),');
  });
});
