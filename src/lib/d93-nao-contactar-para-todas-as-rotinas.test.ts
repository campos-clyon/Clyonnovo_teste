import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Pool } from "mysql2/promise";
import { jaSaiuHojeUmaMensagemAutomatica } from "./uma-mensagem-automatica-por-dia";
import { chaveDoNumero } from "./nao-contactar";

/*
 * NÃO CONTACTAR — d93 (CEO e dono, 23-11-2026). Quem cancelou pela conversa
 * ouviu «Não voltaremos a contactá-lo»: a pergunta que TODAS as rotinas fazem
 * antes de enviar (`jaSaiuHojeUmaMensagemAutomatica`) responde «sim» a esse
 * número, e nada sai. Base fingida. Números INVENTADOS.
 */

function base(naLista: string[]): { pool: Pool; perguntas: string[] } {
  const perguntas: string[] = [];
  const chaves = new Set(naLista.map((t) => chaveDoNumero(t)));
  const pool = {
    execute: async (sql: string, params: unknown[] = []) => {
      perguntas.push(sql);
      if (/FROM naoContactar/.test(sql)) return [chaves.has(String(params[0])) ? [{ x: 1 }] : [], []];
      return [[], []];
    },
  } as unknown as Pool;
  return { pool, perguntas };
}

describe("d93 — o «não contactar» cala todas as rotinas automáticas", () => {
  const agora = new Date("2026-11-24T10:30:00Z");

  it("um número da lista: «já saiu hoje» — nenhuma rotina lhe envia", async () => {
    const { pool } = base(["351910000001"]);
    expect(await jaSaiuHojeUmaMensagemAutomatica({ telefone: "+351 910 000 001" }, agora, { pool })).toBe(true);
  });

  it("outro número: segue a conta de sempre (nada saiu hoje)", async () => {
    const { pool } = base(["351910000001"]);
    expect(await jaSaiuHojeUmaMensagemAutomatica({ telefone: "351910000002" }, agora, { pool })).toBe(false);
  });

  it("as rotinas que mandam ao cliente passam todas por esta pergunta (d62, d71/d88, d83/d90, d88 propostas, d87, d93)", () => {
    for (const f of [
      "validade-do-orcamento-na-base.ts",
      "lembrete-do-que-falta-na-base.ts",
      "seguimento-do-cliente-na-base.ts",
      "envio-das-propostas-ao-cliente-na-base.ts",
      "envio-automatico-aos-parceiros-na-base.ts",
      "conversa-parada-a-meio-na-base.ts",
    ]) {
      const src = readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
      expect(src, f).toContain("jaSaiuHojeUmaMensagemAutomatica");
    }
  });
});
