import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * d39 (15-11-2026) — O VALOR ÚNICO ACEITE COM ESTADO PRÓPRIO.
 *
 * A Vitória já lia o «SIM, aceito» e escrevia no histórico; agora fica também
 * no pedido (`valorUnicoAceiteEm`, `valorUnicoAceitePor`), a Mesa mostra
 * «Valor único aceite pelo cliente — escolher o parceiro» com selo, e a equipa
 * pode marcá-lo à mão (aceitou por telefone). Um aceite só vale para o valor
 * que estava enviado.
 */

const chamadas: Array<{ sql: string; args: unknown[] }> = [];
let linhasDoSelect: unknown[] = [];
vi.mock("./db", () => ({
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  ensureNegociacoesTable: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({
    execute: vi.fn(async (sql: string, args: unknown[] = []) => {
      chamadas.push({ sql, args });
      if (/^\s*ALTER/.test(sql)) throw new Error("Duplicate column name");
      if (/^\s*UPDATE/.test(sql)) return [{ affectedRows: 1 }, undefined];
      return [linhasDoSelect, undefined];
    }),
  })),
}));

import { aceitesDoValorUnico, marcarValorUnicoAceite } from "./valor-unico-no-whatsapp-na-base";

beforeEach(() => {
  chamadas.length = 0;
  linhasDoSelect = [];
});

describe("na base", () => {
  it("marca só num pedido com valor único, e só se não houver aceite que valha para o valor enviado", async () => {
    expect(await marcarValorUnicoAceite(812, "Ana")).toBe(true);
    const u = chamadas.find((c) => /^\s*UPDATE/.test(c.sql))!;
    expect(u.sql).toContain("SET valorUnicoAceiteEm = NOW(), valorUnicoAceitePor = ?");
    expect(u.sql).toContain("valorUnicoCliente IS NOT NULL");
    expect(u.sql).toContain("valorUnicoAceiteEm IS NULL OR (valorUnicoEm IS NOT NULL AND valorUnicoAceiteEm < valorUnicoEm)");
    expect(u.args).toEqual(["Ana", 812]);
    // As colunas nascem aqui (aditivas); «já existe» não é erro.
    expect(chamadas.filter((c) => /^\s*ALTER TABLE simulatorOrders ADD COLUMN valorUnicoAceite/.test(c.sql))).toHaveLength(2);
  });

  it("recusa um pedido inválido sem ir à base", async () => {
    expect(await marcarValorUnicoAceite(0, "Ana")).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("lê só os aceites posteriores ao último envio do valor único", async () => {
    linhasDoSelect = [{ id: 812, valorUnicoAceiteEm: new Date("2026-11-15T18:00:00Z"), valorUnicoAceitePor: "o cliente, pelo WhatsApp" }];
    const m = await aceitesDoValorUnico([812, 813]);
    expect(m.get(812)).toEqual({ em: "2026-11-15T18:00:00.000Z", por: "o cliente, pelo WhatsApp" });
    const s = chamadas.find((c) => /^\s*SELECT/.test(c.sql))!;
    expect(s.sql).toContain("valorUnicoEm IS NULL OR valorUnicoAceiteEm >= valorUnicoEm");
  });
});

describe("quem o grava e onde se vê", () => {
  const ler = (p: string) => readFileSync(p, "utf8");

  it("a Vitória grava o estado quando lê o «SIM» — e continua a não aceitar propostas", () => {
    const cerebro = ler("src/lib/whatsapp-negociacao.ts");
    const ini = cerebro.indexOf("async function tratarOValorUnico(");
    const corpo = cerebro.slice(ini, cerebro.indexOf("\n}\n", ini));
    expect(corpo).toContain("marcarValorUnicoAceite(decisao.pedidoId");
    expect(corpo).not.toMatch(/fecharPeloCliente|recusarPeloCliente|agirComoCliente/);
  });

  it("a equipa marca-o à mão, e fica no histórico como o da Vitória", () => {
    const rota = ler("src/app/api/admin/negociacoes/route.ts");
    const i = rota.indexOf('corpo.accao === "valor_unico_aceite"');
    expect(i).toBeGreaterThan(0);
    const bloco = rota.slice(i, i + 1200);
    expect(bloco).toContain("marcarValorUnicoAceite(pedidoId, quem)");
    expect(bloco).toContain('type: "valor_unico_aceite"');
    expect(rota).toContain("valorUnicoAceite: aceites.get(Number(p.id)) ?? null");
  });

  it("a Mesa mostra a frase e o selo enquanto não há parceiro escolhido", () => {
    const mesa = ler("src/components/admin/ValorUnicoNaMesa.tsx");
    expect(mesa).toContain('"Valor único aceite pelo cliente — escolher o parceiro"');
    expect(mesa).toContain("O cliente aceitou por telefone");
    const painel = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(painel).toContain("aceite={p.valorUnicoAceite ?? null}");
    expect(painel).toContain('p.valorUnicoAceite && !p.negociacoes.some((n) => n.estado === "acordada")');
  });
});
