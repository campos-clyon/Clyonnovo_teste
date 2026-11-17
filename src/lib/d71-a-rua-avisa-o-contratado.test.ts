import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * d71 (5) — 17-11-2026, o CEO e o dono. Quando a morada de um pedido passa de
 * «falta a rua» (d69) a completa depois do aceite, o parceiro contratado recebe
 * um aviso por push na app Pro, pelo servidor: uma vez só, só ao contratado,
 * sem WhatsApp. A base é inventada aqui (um pedido, as negociações dele).
 */

type Neg = { id: number; estado: string; email: string | null };
const estado = { ruaEmFalta: 1 as number | null, ruaRecebidaEm: null as string | null, negociacoes: [] as Neg[] };
const sqls: string[] = [];

const pool = {
  async execute(sql: string) {
    sqls.push(sql);
    if (/^\s*ALTER TABLE/i.test(sql)) return [{}, null];
    if (/ruaEmFalta IS NULL/.test(sql)) return [{ affectedRows: 0 }, null];
    if (/^\s*UPDATE simulatorOrders/i.test(sql) && /ruaEmFalta = 0/.test(sql)) {
      if (estado.ruaEmFalta !== 1 || estado.ruaRecebidaEm) return [{ affectedRows: 0 }, null];
      estado.ruaEmFalta = 0;
      estado.ruaRecebidaEm = "agora";
      return [{ affectedRows: 1 }, null];
    }
    if (/FROM negociacoes n JOIN providers p/.test(sql)) {
      const acordadas = /n\.estado = 'acordada'/.test(sql) ? estado.negociacoes.filter((n) => n.estado === "acordada") : estado.negociacoes;
      return [acordadas.map((n) => ({ id: n.id, email: n.email })), null];
    }
    throw new Error("SQL inesperado no teste: " + sql);
  },
};

vi.mock("./db", () => ({
  getPool: async () => pool,
  appendOrderHistory: vi.fn(async () => {}),
  ensureSimulatorOrdersTable: async () => {},
  ensureNegociacoesTable: async () => {},
}));
const enviados: Array<{ email: string; payload: Record<string, unknown>; para: string }> = [];
vi.mock("./webpush", () => ({
  sendPushToUser: vi.fn(async (email: string, payload: Record<string, unknown>, para: string) => {
    enviados.push({ email, payload, para });
    return 1;
  }),
}));

import { fecharARuaQueChegou, gravarARua } from "./rua-depois-do-aceite-na-base";

const RUA = { morada: "Rua das Gaivotas Mansas 3", andar: "2º Dto", codigoPostal: null, localidade: null };

beforeEach(() => {
  estado.ruaEmFalta = 1;
  estado.ruaRecebidaEm = null;
  estado.negociacoes = [
    { id: 71, estado: "acordada", email: "parceiro.contratado@exemplo.pt" },
    { id: 72, estado: "recusada", email: "outro.parceiro@exemplo.pt" },
  ];
  enviados.length = 0;
  sqls.length = 0;
});

describe("d71 (5) — a rua que chega avisa o parceiro contratado", () => {
  it("quando a resposta do cliente grava a rua: um push ao contratado, na app Pro, para o trabalho dele", async () => {
    expect(await gravarARua(512, RUA, "pelo WhatsApp")).toBe(true);
    expect(enviados).toHaveLength(1);
    const [p] = enviados;
    expect(p.email).toBe("parceiro.contratado@exemplo.pt");
    expect(p.para).toBe("pro");
    expect(p.payload.negociacaoId).toBe(71);
    expect(p.payload.tag).toBe("rua-512");
    expect(String(p.payload.body)).toContain("#512");
    // A morada não vai no ecrã de bloqueio.
    expect(String(p.payload.body)).not.toContain("Gaivotas");
  });

  it("uma vez só: a segunda vez a marca já não está, e não sai outro", async () => {
    await gravarARua(512, RUA, "pelo WhatsApp");
    expect(await gravarARua(512, RUA, "pelo WhatsApp")).toBe(false);
    expect(await fecharARuaQueChegou(512, "Rua das Gaivotas Mansas 5", "pela equipa, no backoffice")).toBe(false);
    expect(enviados).toHaveLength(1);
  });

  it("só ao contratado: sem negociação acordada, ninguém é avisado", async () => {
    estado.negociacoes = [{ id: 80, estado: "aberta", email: "candidato@exemplo.pt" }];
    expect(await gravarARua(512, RUA, "pelo WhatsApp")).toBe(true);
    expect(enviados).toHaveLength(0);
  });

  it("pela edição no backoffice: só com a rua completa, e uma vez", async () => {
    expect(await fecharARuaQueChegou(512, "Oeiras (rua por confirmar)", "pela equipa, no backoffice")).toBe(false);
    expect(await fecharARuaQueChegou(512, "Oeiras", "pela equipa, no backoffice")).toBe(false);
    expect(enviados).toHaveLength(0);
    expect(await fecharARuaQueChegou(512, "Rua das Gaivotas Mansas 3", "pela equipa, no backoffice")).toBe(true);
    expect(await fecharARuaQueChegou(512, "Rua das Gaivotas Mansas 3", "pela equipa, no backoffice")).toBe(false);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].email).toBe("parceiro.contratado@exemplo.pt");
  });

  it("sem WhatsApp, e a edição do backoffice chama-o", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    const base = ler("src/lib/rua-depois-do-aceite-na-base.ts");
    const corpo = base.slice(base.indexOf("export async function avisarOContratadoDaRua"), base.indexOf("export async function fecharARuaQueChegou"));
    expect(corpo).toContain("avisarProfissionalDaRuaPorPush(");
    expect(corpo).not.toMatch(/whatsapp|enviarAviso|enviarTexto/i);
    expect(ler("src/app/api/admin/pedidos/[id]/editar/route.ts")).toContain("await fecharARuaQueChegou(pedidoId");
  });
});
