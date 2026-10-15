import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aindaNaoContamDe,
  comissoesPorPeriodo,
  porqueAindaNaoConta,
  type LinhaQueAindaNaoConta,
  type LinhaQueConta,
} from "./assistentes";

/**
 * OS QUE AINDA NÃO CONTAM, E A ORDEM POR NÚMERO DE PEDIDO — 15-10-2026.
 *
 * *«Coloque esses trabalhos em ordem pelo número do pedido. Parece que nem
 * todos os pedidos estão aparecendo, como o caso da Talita, pedido 422 — não
 * vejo ele e não sei porquê.»* A lista dos períodos só tem os concluídos (é o
 * que se paga); os acordados que ainda não estão passam a aparecer à parte,
 * cada um com a razão.
 */

const linha = (id: number, extra: Partial<LinhaQueAindaNaoConta> = {}): LinhaQueAindaNaoConta => ({
  id,
  status: "confirmado",
  contactName: "Cliente",
  assignedToId: 7,
  assignedToName: "MIRIAM",
  profissional: "TRSul",
  ...extra,
});

describe("a razão de cada um", () => {
  it("por fazer, com o dia marcado — ou sem ele", () => {
    expect(porqueAindaNaoConta(linha(422, { dataCombinada: "2026-10-16T09:00:00.000Z" }))).toEqual({
      motivo: "por_fazer",
      porque: "por fazer — marcado para 16/10",
    });
    expect(porqueAindaNaoConta(linha(422, { dataAgendada: "2026-10-17T09:00:00.000Z" })).porque).toBe(
      "por fazer — marcado para 17/10",
    );
    expect(porqueAindaNaoConta(linha(422)).porque).toBe("por fazer — sem dia marcado");
  });

  it("feito pelo profissional e por confirmar", () => {
    expect(porqueAindaNaoConta(linha(422, { execucaoEnviadaEm: "2026-10-14T15:00:00.000Z" }))).toEqual({
      motivo: "falta_confirmar",
      porque: "feito a 14/10 — falta confirmar",
    });
  });

  it("confirmado mas o pedido não ficou concluído — diz onde se corrige", () => {
    const r = porqueAindaNaoConta(
      linha(422, { execucaoEnviadaEm: "2026-10-13T15:00:00.000Z", confirmadoEm: "2026-10-14T10:00:00.000Z" }),
    );
    expect(r.motivo).toBe("confirmado_sem_concluir");
    expect(r.porque).toContain("confirmado a 14/10");
    expect(r.porque).toContain("mude o estado em Pedidos");
  });

  it("os que nunca contam dizem-no, e mandam sobre o resto", () => {
    const feito = { execucaoEnviadaEm: "2026-10-14T15:00:00.000Z" };
    expect(porqueAindaNaoConta(linha(1, { ...feito, status: "cancelado" })).motivo).toBe("cancelado");
    expect(porqueAindaNaoConta(linha(1, { ...feito, status: "arquivado" })).motivo).toBe("arquivado");
    expect(porqueAindaNaoConta(linha(1, { ...feito, status: "concluido", deTeste: 1 })).motivo).toBe("conta_de_teste");
    expect(porqueAindaNaoConta(linha(1, { status: "cancelado" })).porque).toBe("pedido cancelado — não conta");
  });

  it("o dia é o de Lisboa", () => {
    // 23:30 em UTC a 15/10 já é dia 16 em Lisboa (UTC+1).
    expect(porqueAindaNaoConta(linha(1, { execucaoEnviadaEm: "2026-10-15T23:30:00.000Z" })).porque).toBe(
      "feito a 16/10 — falta confirmar",
    );
  });
});

describe("de quem é a lista", () => {
  const linhas = [
    linha(430, { assignedToId: 7 }),
    linha(422, { assignedToId: 9, assignedToName: null }),
    linha(425, { assignedToId: 7 }),
  ];

  it("quem conta «todos» vê todos, por número de pedido; sem responsável, o operador é o Admin", () => {
    const r = aindaNaoContamDe(linhas, { id: 7, comissaoSobre: "todos" });
    expect(r.map((t) => t.pedidoId)).toEqual([422, 425, 430]);
    expect(r[0].operador).toBe("Admin");
  });

  it("quem conta «os seus» vê só os seus", () => {
    expect(aindaNaoContamDe(linhas, { id: 7, comissaoSobre: "seus" }).map((t) => t.pedidoId)).toEqual([425, 430]);
  });
});

describe("os trabalhos de cada período vão por número de pedido", () => {
  const concluido = (id: number, concluidoEm: string): LinhaQueConta => ({
    id,
    status: "concluido",
    concluidoEm,
    valorAcordado: 100,
    assignedToName: "MIRIAM",
  });

  it("e não pela data em que ficaram concluídos", () => {
    const r = comissoesPorPeriodo({
      linhas: [
        concluido(437, "2026-10-15T14:00:00Z"),
        concluido(264, "2026-10-04T10:00:00Z"),
        concluido(390, "2026-10-12T10:00:00Z"),
      ],
      pagamentos: [],
      minhaPercent: 40,
      hoje: "2026-10-15",
    });
    const periodo = r.periodos.find((p) => p.inicio === "2026-09-23")!;
    expect(periodo.detalhe.map((t) => t.pedidoId)).toEqual([264, 390, 437]);
  });
});

describe("a leitura e o ecrã", () => {
  const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

  it("lê os acordados que não estão concluídos, ou que são de teste, desde o início das comissões", () => {
    const L = ler("src/lib/assistentes.ts");
    const consulta = L.slice(L.indexOf("export async function trabalhosQueAindaNaoContam"));
    expect(consulta).toContain("WHERE estado = 'acordada'");
    expect(consulta).toContain("(o.status IS NULL OR o.status <> 'concluido' OR COALESCE(pn.contaDeTeste, 0) = 1)");
    expect(consulta).toContain("desde: string = INICIO_DAS_COMISSOES");
    // E vai na resposta do detalhe de cada conta.
    expect(L).toContain("aindaNaoContam: c.aindaNaoContam,");
  });

  it("o ecrã mostra-os por baixo dos períodos, com a razão", () => {
    const C = ler("src/components/admin/TrabalhosDoAssistente.tsx");
    expect(C).toContain("Ainda não contam");
    expect(C).toContain("{d.aindaNaoContam!.map((t) => (");
    expect(C).toContain("{t.porque}");
  });
});
