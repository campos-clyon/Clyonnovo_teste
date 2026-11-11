import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * TRÊS GUARDAS DAS MUDANÇAS COM A LISTA — 11-11-2026 (ordem do CEO com o sim do dono).
 *
 *   1. A hora congelada: se a leitura à base falhar, a proposta NÃO segue.
 *   2. A folha com que o cliente não concordou não se reenvia igual.
 *   3. O traçado do percurso (começa e acaba à porta) sai com a morada.
 */

const estado = vi.hoisted(() => ({ gravadas: [] as unknown[] }));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  appendOrderHistory: vi.fn(async () => undefined),
  folhaDaNegociacao: vi.fn(async () => null),
  folhasPorResponder: vi.fn(async () => []),
  gravarFolhaDoTrabalho: vi.fn(async (...a: unknown[]) => {
    estado.gravadas.push(a);
    return true;
  }),
  marcarPassoDaFolha: vi.fn(async () => true),
  negociacaoNoTerreno: vi.fn(async () => null),
  registarSemFalhar: vi.fn(async () => undefined),
}));
vi.mock("@/lib/avisos-ao-cliente", () => ({ avisarOClienteDoPedido: vi.fn(async () => undefined) }));
vi.mock("@/lib/avisos-do-terreno", () => ({ avisarClienteDasHoras: vi.fn(async () => undefined) }));

import { congelarTarifa, REGRAS_DAS_MUDANCAS, type TarifaDasMudancas } from "./conta-da-mudanca";
import { guardaDaHoraCongelada, SEM_CONFERIR_A_HORA } from "./mudanca-escolhida-pelo-cliente";
import { FOLHA_IGUAL_A_CONTESTADA, lerFolha, mesmaFolha, type ContextoDaFolha, type CorpoDaFolha } from "./folha-da-mudanca";
import { enviarAFolha } from "./folha-no-servidor";
import { COMO_SE_ANONIMIZA_O_PEDIDO } from "./regras-novas-da-retencao";
import type { FolhaDaNegociacaoNaBase } from "./db";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) => s.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

const TARIFA: TarifaDasMudancas = {
  precoHora2: 50,
  precoHora3: 65,
  minimoHoras: 3,
  precoKm: 0.5,
  kmMinimo: 20,
  kmMaximo: 100,
  caixa: 2,
  cartaoMetro: 1,
  filmeRolo: 15,
  plasticoBolhaRolo: null,
  aparecerNaLista: true,
};
const CONGELADA = congelarTarifa(TARIFA, REGRAS_DAS_MUDANCAS, new Date("2026-11-11T10:00:00Z"));
const JSON_DA_TARIFA = JSON.stringify(CONGELADA);

beforeEach(() => {
  vi.clearAllMocks();
  estado.gravadas = [];
});

describe("1. a hora congelada recusa quando não consegue ler a base", () => {
  const calado = () => vi.spyOn(console, "error").mockImplementation(() => undefined);

  it("a leitura rebenta: 503, com uma frase para tentar outra vez — e nunca «pode seguir»", async () => {
    const registo = calado();
    const r = await guardaDaHoraCongelada(
      async () => {
        throw new Error("DB not available");
      },
      999,
      "teste",
    );
    expect(r).toEqual({ status: 503, erro: SEM_CONFERIR_A_HORA, acimaDaHora: false });
    registo.mockRestore();
  });

  it("uma tarifa gravada que não se percebe também recusa", async () => {
    const registo = calado();
    const r = await guardaDaHoraCongelada(async () => ({ tarifaCongeladaJson: "{isto não é JSON", pessoasEscolhidas: 2 }), 10, "teste");
    expect(r?.status).toBe(503);
    registo.mockRestore();
  });

  it("lida a tarifa: acima da hora recusa (409), na hora ou abaixo segue", async () => {
    const ler2 = async () => ({ tarifaCongeladaJson: JSON_DA_TARIFA, pessoasEscolhidas: 2 });
    const acima = await guardaDaHoraCongelada(ler2, 50.01, "teste");
    expect(acima?.status).toBe(409);
    expect(acima?.acimaDaHora).toBe(true);
    expect(acima?.erro).toMatch(/50,00\s€ sem IVA/);
    expect(await guardaDaHoraCongelada(ler2, 50, "teste")).toBeNull();
    expect(await guardaDaHoraCongelada(ler2, 42, "teste")).toBeNull();
    // Com 3 pessoas, a hora de 3.
    expect(await guardaDaHoraCongelada(async () => ({ tarifaCongeladaJson: JSON_DA_TARIFA, pessoasEscolhidas: 3 }), 65, "teste")).toBeNull();
    expect((await guardaDaHoraCongelada(async () => ({ tarifaCongeladaJson: JSON_DA_TARIFA, pessoasEscolhidas: 3 }), 66, "teste"))?.status).toBe(409);
  });

  it("uma negociação sem tarifa congelada (todas as outras) segue como sempre", async () => {
    expect(await guardaDaHoraCongelada(async () => null, 999, "teste")).toBeNull();
    expect(await guardaDaHoraCongelada(async () => ({ tarifaCongeladaJson: null, pessoasEscolhidas: null }), 999, "teste")).toBeNull();
  });

  it("as duas portas da proposta usam a guarda antes do motor, sem leitura que engole o erro", () => {
    for (const f of ["src/app/api/profissionais/negociacao/route.ts", "src/app/api/negociacao/[token]/route.ts"]) {
      const s = semNotas(ler(f));
      const guarda = s.indexOf("await guardaDaHoraCongelada(");
      const recusa = s.indexOf("if (recusa) return NextResponse.json(");
      const motor = s.indexOf('propor(estadoActual, "profissional"');
      expect(guarda, f).toBeGreaterThan(0);
      expect(recusa, f).toBeGreaterThan(guarda);
      expect(motor, f).toBeGreaterThan(recusa);
      expect(s, f).not.toContain("semDerrubar(");
      expect(s, f).toContain("status: recusa.status");
    }
  });

  it("a leitura da tarifa rebenta sem base (em vez de responder «não tem»)", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function tarifaCongeladaDaNegociacao(");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, i + 1 + DB.slice(i + 1).search(/\nexport /));
    expect(corpo).toContain('if (!pool) throw new Error("DB not available");');
    expect(corpo).toContain("WHERE id = ? AND providerId = ?");
    expect(corpo).not.toMatch(/catch/);
  });
});

describe("2. a folha contestada não se reenvia igual", () => {
  const AGORA = new Date("2026-11-13T12:00:00Z");
  const CTX: ContextoDaFolha = { tarifa: CONGELADA, pessoasEscolhidas: 2, kmDoPercurso: 70, valorPorHoraAcordado: 50, diaPorOmissao: "2026-11-12" };
  const CORPO: CorpoDaFolha = { inicio: "09:00", fim: "17:30", pausas: [{ inicio: "12:30", fim: "13:00" }], km: "70", materiais: { filmeRolos: 3, caixas: 10 } };
  const folha = (corpo: CorpoDaFolha) => {
    const r = lerFolha(corpo, CTX, AGORA);
    if (!r.ok) throw new Error(r.erro);
    return r.folha;
  };

  function naBase(mais: Partial<FolhaDaNegociacaoNaBase> = {}): FolhaDaNegociacaoNaBase {
    return {
      id: 501,
      pedidoId: 9001,
      providerId: 7,
      estado: "acordada",
      tarifaCongeladaJson: JSON_DA_TARIFA,
      pessoasEscolhidas: 2,
      taxaCliente: "0",
      folhaJson: JSON.stringify(folha(CORPO)),
      folhaHistoricoJson: null,
      folhaNaMesaEm: null,
      horasContestadasEm: null,
      kmPercurso: "70",
      ...mais,
    };
  }
  const enviar = (folhaNaBase: FolhaDaNegociacaoNaBase, corpo: CorpoDaFolha) =>
    enviarAFolha({
      providerId: 7,
      nome: "Parceiro de exemplo",
      negociacaoId: 501,
      pedidoId: 9001,
      folhaNaBase,
      ctx: CTX,
      linha: { horasMarcadasEm: "2026-11-12 18:00:00", horasContestadasEm: folhaNaBase.horasContestadasEm ?? null },
      corpo,
      agora: AGORA,
    });

  it("«a mesma folha»: iguais no que o cliente vê e paga; o motivo dos km não conta", () => {
    expect(mesmaFolha(folha(CORPO), folha({ ...CORPO }))).toBe(true);
    expect(mesmaFolha(folha(CORPO), folha({ ...CORPO, materiais: { caixas: 10, filmeRolos: 3 } }))).toBe(true);
    expect(mesmaFolha(folha({ ...CORPO, km: "60", motivoDosKm: "desvio" }), folha({ ...CORPO, km: "60", motivoDosKm: "outra frase" }))).toBe(true);
    expect(mesmaFolha(folha(CORPO), folha({ ...CORPO, fim: "17:00" }))).toBe(false);
    expect(mesmaFolha(folha(CORPO), folha({ ...CORPO, pausas: [{ inicio: "12:30", fim: "13:30" }] }))).toBe(false);
    expect(mesmaFolha(folha(CORPO), folha({ ...CORPO, km: "60", motivoDosKm: "desvio" }))).toBe(false);
    expect(mesmaFolha(folha(CORPO), folha({ ...CORPO, materiais: { filmeRolos: 2, caixas: 10 } }))).toBe(false);
  });

  it("depois do «Não concordo», a mesma folha é recusada e nada se grava", async () => {
    const r = await enviar(naBase({ horasContestadasEm: "2026-11-12 20:00:00" }), CORPO);
    expect(r.status).toBe(409);
    expect(r.corpo).toEqual({ ok: false, error: FOLHA_IGUAL_A_CONTESTADA });
    expect(estado.gravadas).toHaveLength(0);
  });

  it("uma folha corrigida segue, e grava-se", async () => {
    const r = await enviar(naBase({ horasContestadasEm: "2026-11-12 20:00:00" }), { ...CORPO, fim: "17:00" });
    expect(r.status).toBe(200);
    expect(estado.gravadas).toHaveLength(1);
  });

  it("sem contestação, corrigir para o mesmo não é travado (o cliente ainda não disse que não)", async () => {
    const r = await enviar(naBase(), CORPO);
    expect(r.status).toBe(200);
    expect(estado.gravadas).toHaveLength(1);
  });

  it("a frase diz o que fazer e não promete nada pela CLYON além de confirmar com o cliente", () => {
    expect(FOLHA_IGUAL_A_CONTESTADA).toMatch(/Corrija/);
    expect(FOLHA_IGUAL_A_CONTESTADA).toMatch(/fale com a CLYON/);
  });

  it("a base diz se a folha foi contestada, na mesma leitura da folha", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function folhaDaNegociacao(");
    const corpo = DB.slice(i, i + 1 + DB.slice(i + 1).search(/\nexport /));
    expect(corpo).toContain("n.horasContestadasEm");
  });
});

describe("3. o traçado do percurso apaga-se com a morada", () => {
  it("nas regras novas da retenção, o percurso sai como a morada e o formulário", () => {
    expect(COMO_SE_ANONIMIZA_O_PEDIDO.percursoJson).toBe("nulo");
    expect(COMO_SE_ANONIMIZA_O_PEDIDO.address).not.toBe("fica");
  });

  it("em db.ts, todo o comando que limpa a morada de um pedido limpa também o traçado", () => {
    const DB = ler("src/lib/db.ts");
    // Cada comando SQL entre crases que mexe em simulatorOrders.
    const comandos = [...DB.matchAll(/`([^`]*UPDATE simulatorOrders[^`]*)`/g)].map((m) => m[1]);
    expect(comandos.length).toBeGreaterThan(20);
    const limpamAMorada = comandos.filter((c) => /\baddress\s*=\s*NULL\b|\brawOrderJson\s*=\s*NULL\b/.test(c));
    expect(limpamAMorada.length).toBeGreaterThan(0);
    for (const c of limpamAMorada) expect(c, c.slice(0, 80)).toMatch(/\bpercursoJson\s*=\s*NULL\b/);
  });

  it("apagar a conta do cliente garante primeiro que a coluna existe", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function apagarContaDeCliente(");
    const corpo = DB.slice(i, i + 1 + DB.slice(i + 1).search(/\nexport /));
    expect(corpo.indexOf("await ensureSimulatorOrdersTable();")).toBeGreaterThan(-1);
    expect(corpo.indexOf("await ensureSimulatorOrdersTable();")).toBeLessThan(corpo.indexOf("percursoJson = NULL"));
  });
});
