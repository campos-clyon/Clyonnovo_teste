import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estadoAntesDoCancelamento, oQueReabrir } from "./cancelamento";

/**
 * «Esse pedido está nos cancelados por engano, como restauro ele?» —
 * 30-09-2026, sobre o #320: nove profissionais e três propostas.
 *
 * Cancelar era a única acção da mesa sem volta. Estes testes guardam as duas
 * metades do caminho de volta: o cancelamento passa a guardar o que apaga, e
 * os cancelados antes disso reconstroem-se sem reabrir o que não devia.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const propostas = (...l: Array<{ por: string; estado: string }>) =>
  JSON.stringify(l.map((p, i) => ({ ...p, valor: 100 + i, criadaEm: "2026-09-20" })));

describe("o estado de antes, reconstruído", () => {
  it("sem valor acordado estava a ser negociada — e as pendentes voltam pendentes", () => {
    expect(
      estadoAntesDoCancelamento({
        id: 1,
        valorAcordado: null,
        propostasJson: propostas({ por: "profissional", estado: "pendente" }),
      }),
    ).toBe("aberta");
    expect(estadoAntesDoCancelamento({ id: 1, valorAcordado: null, propostasJson: null })).toBe(
      "aberta",
    );
  });

  it("uma recusa do registo volta a ser recusa, e não uma proposta viva", () => {
    expect(
      estadoAntesDoCancelamento({
        id: 1,
        valorAcordado: null,
        propostasJson: propostas({ por: "profissional", estado: "pendente" }),
        desistiu: true,
      }),
    ).toBe("desistida");
  });

  it("o cliente aceitou o valor do profissional: estava fechada", () => {
    expect(
      estadoAntesDoCancelamento({
        id: 1,
        valorAcordado: "300.00",
        propostasJson: propostas({ por: "profissional", estado: "aceite" }),
      }),
    ).toBe("acordada");
  });

  it("o profissional aceitou o do cliente: fica à espera de o cliente contratar", () => {
    expect(
      estadoAntesDoCancelamento({
        id: 1,
        valorAcordado: "250.00",
        propostasJson: propostas(
          { por: "profissional", estado: "recusada" },
          { por: "cliente", estado: "aceite" },
        ),
      }),
    ).toBe("aguarda_contratacao");
  });

  it("trabalho entregue, confirmado ou com dia marcado é trabalho fechado", () => {
    for (const extra of [
      { execucaoEnviadaEm: "2026-09-25" },
      { confirmadoEm: "2026-09-26" },
      { dataCombinada: "2026-10-02" },
    ]) {
      expect(
        estadoAntesDoCancelamento({ id: 1, valorAcordado: 250, propostasJson: "[]", ...extra }),
      ).toBe("acordada");
    }
  });

  it("um JSON estragado não se adivinha: fica do lado seguro", () => {
    expect(estadoAntesDoCancelamento({ id: 1, valorAcordado: 250, propostasJson: "{" })).toBe(
      "aguarda_contratacao",
    );
  });
});

describe("quais voltam", () => {
  it("sem negócio fechado, voltam todas as que o cancelamento encerrou", () => {
    expect(
      oQueReabrir([
        { id: 1, valorAcordado: null, propostasJson: propostas({ por: "profissional", estado: "pendente" }) },
        { id: 2, valorAcordado: null, propostasJson: null },
        { id: 3, valorAcordado: null, propostasJson: null, desistiu: true },
      ]),
    ).toEqual([
      { id: 1, estado: "aberta" },
      { id: 2, estado: "aberta" },
      { id: 3, estado: "desistida" },
    ]);
  });

  it("com um negócio fechado, só esse volta — as outras já estavam mortas antes", () => {
    expect(
      oQueReabrir([
        { id: 1, valorAcordado: null, propostasJson: null },
        {
          id: 2,
          valorAcordado: 300,
          propostasJson: propostas({ por: "profissional", estado: "aceite" }),
        },
      ]),
    ).toEqual([{ id: 2, estado: "acordada" }]);
  });
});

describe("o cancelamento passa a ter memória", () => {
  const DB = semComentarios(ler("src/lib/db.ts"));

  it("guarda o estado de cada negociação ANTES de a matar", () => {
    // O MySQL aplica as atribuições da esquerda para a direita: a ordem é a regra.
    expect(DB).toContain(
      "UPDATE negociacoes SET estadoAntesDeCancelar = estado, estado = 'morta' WHERE pedidoId = ? AND estado <> 'morta'",
    );
    const i = DB.indexOf("export async function cancelarPedido(");
    const corpo = DB.slice(i, DB.indexOf("export async function reabrirPedidoCancelado(", i));
    expect(corpo).toContain("matarNegociacoesDoPedido(pedidoId, { lembrarOEstado: true })");
    expect(corpo).toContain("SET statusAntesDeCancelar = status WHERE id = ? AND status <> 'cancelado'");
  });

  it("as duas colunas existem, e as versões das migrações subiram", () => {
    expect(DB).toContain("ALTER TABLE negociacoes ADD COLUMN estadoAntesDeCancelar");
    expect(DB).toContain("ALTER TABLE simulatorOrders ADD COLUMN statusAntesDeCancelar");
    expect(Number(DB.match(/const VERSAO_DAS_NEGOCIACOES = (\d+);/)?.[1])).toBeGreaterThanOrEqual(7);
    expect(Number(DB.match(/const MIGRATION_VERSION = (\d+);/)?.[1])).toBeGreaterThanOrEqual(14);
  });

  it("o «recomeçar do zero» continua a matar sem memória — não é para desfazer", () => {
    const rec = semComentarios(ler("src/lib/recomecar-do-zero.ts"));
    expect(rec).toContain("matarNegociacoesDoPedido(pedido.id)");
  });
});

describe("reabrir", () => {
  const DB = semComentarios(ler("src/lib/db.ts"));
  const i = DB.indexOf("export async function reabrirPedidoCancelado(");
  const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 10));
  const ROTA = semComentarios(ler("src/app/api/admin/negociacoes/desfazer-cancelamento/route.ts"));
  const PAINEL = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

  it("só reabre o que está cancelado, e só as mortas", () => {
    expect(i).toBeGreaterThan(-1);
    expect(corpo).toContain('pedido.status !== "cancelado"');
    expect(corpo).toContain("WHERE id = ? AND estado = 'morta'");
    expect(corpo).toContain("WHERE id = ? AND status = 'cancelado'");
  });

  it("a memória manda; sem ela, reconstrói-se a partir do registo", () => {
    expect(corpo).toContain("estadoAntesDeCancelar");
    expect(corpo).toContain("acontecimento = 'pedido_cancelado'");
    expect(corpo).toContain("acontecimento = 'negociacao_desistida'");
    expect(corpo).toContain("oQueReabrir(");
  });

  it("não apaga nada", () => {
    expect(corpo).not.toContain("DELETE");
  });

  it("a rota é de admin, e deixa escrito quem desfez e o que voltou", () => {
    expect(ROTA).toContain("requireAdmin(req)");
    expect(ROTA).toContain("appendOrderHistory");
    expect(ROTA).toContain('acontecimento: "pedido_reaberto"');
    expect(ler("src/lib/db.ts")).toContain('| "pedido_reaberto"');
  });

  it("o botão só aparece nos cancelados, e chama a rota", () => {
    expect(PAINEL).toContain("{cancelado && (");
    expect(PAINEL).toContain('fetch("/api/admin/negociacoes/desfazer-cancelamento"');
  });
});
