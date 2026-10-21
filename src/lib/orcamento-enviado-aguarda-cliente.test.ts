import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O ORÇAMENTO JÁ FOI AO CLIENTE — 21-10-2026. *«Esses dois pedidos já têm
 * orçamento mas os clientes não responderam, porém não têm a opção para
 * enviá-los para A AGUARDAR CLIENTE.»* — o dono, no #467 e no #453.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const M = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/admin/negociacoes/route.ts");

describe("o orçamento enviado", () => {
  it("grava-se no pedido (a coluna dos Trabalhos CLYON), só nas negociações, e fica no histórico", () => {
    expect(DB).toContain("UPDATE simulatorOrders SET propostaEnviadaEm = NOW(), updatedAt = updatedAt WHERE id = ? AND valorFixoClyon IS NULL");
    expect(DB).toContain("            o.propostaEnviadaEm,\n");
    expect(ROTA).toContain('if (corpo.accao === "orcamento_enviado") {');
    expect(ROTA).toContain("await marcarOrcamentoEnviado(pedidoId);");
    expect(ROTA).toContain("await appendOrderHistory(pedidoId, {");
  });

  it("cobre as propostas que havia — uma que chegue depois volta a «Precisa de si»", () => {
    const f = M.slice(M.indexOf("function orcamentoEnviadoCobre("), M.indexOf("/** O que falta fazer"));
    expect(f).toContain('.filter((x) => x.por === "profissional")');
    expect(f).toContain("return datas.every((t) => t <= enviado);");
  });

  it("as duas divisões da Mesa andam a par", () => {
    expect(M).toContain('const precisam = semConfirmar.filter((p) => quemNegoceia(p) === "clyon" && !orcamentoEnviadoCobre(p));');
    expect(M).toContain('const aguardaCliente = semConfirmar.filter((p) => quemNegoceia(p) !== "clyon" || orcamentoEnviadoCobre(p));');
    expect(M).toContain('return quemNegoceia(p) === "clyon" && !orcamentoEnviadoCobre(p) ? "n1" : "aguardaCliente";');
  });

  it("«Enviar orçamento» marca ao abrir o WhatsApp, e «Já enviei» marca sem abrir nada", () => {
    const f = M.slice(M.indexOf("async function enviarOrcamento("), M.indexOf("let copiou = false;"));
    expect(f).toContain("void marcarOrcamentoEnviado(p);");
    expect(M).toContain("onClick={() => void marcarOrcamentoEnviado(p)}");
    expect(M).toContain("Já enviei");
    expect(M).toContain('body: JSON.stringify({ accao: "orcamento_enviado", pedidoId: p.id }),');
  });
});
