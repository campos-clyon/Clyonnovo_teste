import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OS PREÇOS DAS MUDANÇAS DE CADA PROFISSIONAL — 10-11-2026 (fase 1).
 *
 * A conta (mínimos, 3 pessoas, material sem taxa, taxa só nas horas e km, os
 * dois modos da taxa e o IVA do material), a tarifa congelada, a rota
 * (autenticação, limites, só quem faz mudanças aparece na lista) e a tabela
 * (criada uma vez, colunas idempotentes).
 */

vi.mock("@/lib/sessao-activa-do-profissional", () => ({ sessaoActivaDoProfissional: vi.fn() }));
vi.mock("@/lib/profissional-auth", () => ({ tokenDoProfissional: () => "x" }));
vi.mock("@/lib/db", () => ({
  categoriasDoProfissional: vi.fn(async () => ["mudancas"]),
  gravarTarifaDasMudancas: vi.fn(async () => {}),
  tarifaDasMudancasDe: vi.fn(async () => null),
}));

import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { categoriasDoProfissional, gravarTarifaDasMudancas, tarifaDasMudancasDe } from "@/lib/db";
import { GET, PUT } from "@/app/api/profissionais/tarifas-mudancas/route";
import {
  MATERIAL_COM_IVA,
  MODO_DA_TAXA_DAS_MUDANCAS,
  REGRAS_DAS_MUDANCAS,
  TAXA_DAS_MUDANCAS,
  congelarTarifa,
  tarifaCongeladaDeJson,
  validarTarifa,
  valorDaMudanca,
  type ContaDaMudanca,
  type RegrasDaConta,
  type TarifaDasMudancas,
} from "./conta-da-mudanca";
import { TAXA_IVA } from "./taxas-plataforma";

const TARIFA: TarifaDasMudancas = {
  precoHora2: 40,
  precoHora3: 55,
  minimoHoras: 3,
  precoKm: 1.2,
  kmMinimo: 20,
  kmMaximo: 100,
  caixa: 2.5,
  cartaoMetro: null,
  filmeRolo: 12,
  plasticoBolhaRolo: 8,
  aparecerNaLista: true,
};

const regras = (r: Partial<RegrasDaConta>): RegrasDaConta => ({ taxa: 0.1, modo: "de_dentro", materialComIva: true, iva: 0.23, ...r });
const conta = (r: Partial<RegrasDaConta>, uso: Parameters<typeof valorDaMudanca>[1]) => {
  const c = valorDaMudanca(congelarTarifa(TARIFA, regras(r)), uso);
  if (!c.ok) throw new Error(c.erro);
  return c as ContaDaMudanca;
};
const EXEMPLO = { pessoas: 2 as const, horas: 5, km: 30, materiais: { caixas: 10 } };

describe("as escolhas por decidir estão num só sítio", () => {
  it("por omissão: a taxa sai de dentro, o material leva IVA, e são as regras de hoje", () => {
    expect(MODO_DA_TAXA_DAS_MUDANCAS).toBe("de_dentro");
    expect(MATERIAL_COM_IVA).toBe(true);
    expect(REGRAS_DAS_MUDANCAS).toEqual({ taxa: TAXA_DAS_MUDANCAS, modo: MODO_DA_TAXA_DAS_MUDANCAS, materialComIva: MATERIAL_COM_IVA, iva: TAXA_IVA });
  });
});

describe("a conta de uma mudança", () => {
  it("o exemplo do dono (10-11-2026), com as regras de hoje: 40 €/h e um rolo de 2 €", () => {
    const t = congelarTarifa({ ...TARIFA, minimoHoras: 1, kmMinimo: 0, filmeRolo: 2 });
    const hora = valorDaMudanca(t, { pessoas: 2, horas: 1, km: 0 });
    if (!hora.ok) throw new Error(hora.erro);
    expect(hora.semIvaCent).toBe(4000);
    expect(hora.totalCent).toBe(4920);
    expect(hora.profissionalCent).toBe(3600);
    expect(hora.taxa.cent).toBe(400);
    const rolo = valorDaMudanca(t, { pessoas: 2, horas: 1, km: 0, materiais: { filmeRolos: 1 } });
    if (!rolo.ok) throw new Error(rolo.erro);
    expect(rolo.totalCent - hora.totalCent).toBe(246);
    expect(rolo.taxa.cent).toBe(400);
    expect(rolo.profissionalCent - hora.profissionalCent).toBe(200);
  });

  it("de dentro: o cliente paga o preço do profissional, a taxa sai das horas e km", () => {
    const c = conta({ modo: "de_dentro" }, EXEMPLO);
    expect(c.horas.cent).toBe(20000); // 5 h × 40 €
    expect(c.km.cent).toBe(3600); // 30 km × 1,20 €
    expect(c.materiais.cent).toBe(2500); // 10 × 2,50 €
    expect(c.servicoCent).toBe(23600);
    expect(c.taxa.cent).toBe(2360);
    expect(c.semIvaCent).toBe(26100);
    expect(c.ivaCent).toBe(6003);
    expect(c.totalCent).toBe(32103);
    expect(c.profissionalCent).toBe(23600 - 2360 + 2500);
  });

  it("por cima: a taxa soma-se, o profissional recebe o preço todo", () => {
    const c = conta({ modo: "por_cima" }, EXEMPLO);
    expect(c.taxa.cent).toBe(2360);
    expect(c.semIvaCent).toBe(23600 + 2360 + 2500);
    expect(c.ivaCent).toBe(Math.round(28460 * 0.23));
    expect(c.totalCent).toBe(28460 + 6546);
    expect(c.profissionalCent).toBe(26100);
  });

  it("o material não leva taxa, nos dois modos", () => {
    for (const modo of ["de_dentro", "por_cima"] as const) {
      const sem = conta({ modo }, { ...EXEMPLO, materiais: {} });
      const com = conta({ modo }, { ...EXEMPLO, materiais: { caixas: 10, filmeRolos: 3, plasticoBolhaRolos: 1 } });
      expect(com.taxa.cent).toBe(sem.taxa.cent);
      const material = 2500 + 3600 + 800;
      expect(com.materiais.cent).toBe(material);
      expect(com.semIvaCent - sem.semIvaCent).toBe(material);
      expect(com.profissionalCent - sem.profissionalCent).toBe(material);
    }
  });

  it("material sem IVA: o IVA conta só sobre o resto", () => {
    const c = conta({ materialComIva: false }, EXEMPLO);
    expect(c.baseDoIvaCent).toBe(23600);
    expect(c.ivaCent).toBe(5428);
    expect(c.totalCent).toBe(26100 + 5428);
  });

  it("os mínimos de horas e de km", () => {
    const c = conta({}, { pessoas: 2, horas: 2, km: 5 });
    expect(c.horas.cobradas).toBe(3);
    expect(c.horas.cent).toBe(12000);
    expect(c.km.cobrados).toBe(20);
    expect(c.km.cent).toBe(2400);
  });

  it("3 pessoas usa o preço da equipa de 3, e recusa quem não faz com 3", () => {
    expect(conta({}, { pessoas: 3, horas: 4, km: 20 }).horas.cent).toBe(22000);
    const sem3 = valorDaMudanca(congelarTarifa({ ...TARIFA, precoHora3: null }), { pessoas: 3, horas: 4, km: 20 });
    expect(sem3.ok).toBe(false);
  });

  it("material que ele não fornece não entra na conta", () => {
    const r = valorDaMudanca(congelarTarifa(TARIFA), { ...EXEMPLO, materiais: { cartaoMetros: 5 } });
    expect(r.ok).toBe(false);
  });

  it("a distância acima do máximo fica assinalada", () => {
    expect(conta({}, { pessoas: 2, horas: 5, km: 150 }).km.acimaDoMaximo).toBe(true);
    expect(conta({}, EXEMPLO).km.acimaDoMaximo).toBe(false);
  });

  it("a taxa conta só sobre horas + km (as horas fraccionadas também)", () => {
    const c = conta({}, { pessoas: 2, horas: 5.5, km: 33 });
    expect(c.horas.cent).toBe(22000);
    expect(c.taxa.cent).toBe(Math.round((22000 + 3960) * 0.1));
  });
});

describe("a tarifa congelada", () => {
  it("fica igual depois de o profissional mudar a conta, e volta igual do JSON", () => {
    const original = { ...TARIFA };
    const congelada = congelarTarifa(original, regras({ modo: "por_cima" }), new Date("2026-11-10T10:00:00Z"));
    original.precoHora2 = 99;
    expect(congelada.precoHora2Cent).toBe(4000);
    expect(Object.isFrozen(congelada)).toBe(true);
    expect(Object.isFrozen(congelada.regras)).toBe(true);
    const lida = tarifaCongeladaDeJson(JSON.stringify(congelada));
    expect(lida).toEqual(congelada);
    expect(valorDaMudanca(lida!, EXEMPLO)).toEqual(valorDaMudanca(congelada, EXEMPLO));
    expect(tarifaCongeladaDeJson("{}")).toBeNull();
    expect(tarifaCongeladaDeJson("lixo")).toBeNull();
  });
});

describe("a validação dos limites", () => {
  const corpo = (m: Record<string, unknown>) => ({ ...TARIFA, ...m });
  it("aceita vírgulas e vazios nos opcionais", () => {
    const v = validarTarifa(corpo({ precoHora2: "42,50", precoHora3: "", caixa: null }));
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.tarifa.precoHora2).toBe(42.5);
      expect(v.tarifa.precoHora3).toBeNull();
      expect(v.tarifa.caixa).toBeNull();
    }
  });
  it.each([
    ["precoHora2", 14],
    ["precoHora2", 151],
    ["precoHora3", 200],
    ["precoKm", 5.01],
    ["caixa", 101],
    ["minimoHoras", 0.5],
    ["minimoHoras", 9],
    ["minimoHoras", 2.3],
    ["kmMinimo", 501],
    ["kmMaximo", 0],
    ["kmMaximo", 12.5],
    ["precoHora2", "abc"],
    ["precoHora2", 40.123],
    ["precoHora2", null],
  ])("recusa %s = %s", (campo, valor) => {
    const v = validarTarifa(corpo({ [campo]: valor }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(Object.keys(v.erros)).toContain(campo);
  });
});

describe("a rota /api/profissionais/tarifas-mudancas", () => {
  const pedido = (metodo: "GET" | "PUT", corpo?: unknown) =>
    new NextRequest("https://clyon.pt/api/profissionais/tarifas-mudancas", {
      method: metodo,
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo), headers: { "Content-Type": "application/json" } }),
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessaoActivaDoProfissional).mockResolvedValue({ providerId: 7 } as never);
    vi.mocked(categoriasDoProfissional).mockResolvedValue(["mudancas"]);
    vi.mocked(tarifaDasMudancasDe).mockResolvedValue(null);
  });

  it("sem sessão: 401, e não lê nem grava", async () => {
    vi.mocked(sessaoActivaDoProfissional).mockResolvedValue(null as never);
    expect((await GET(pedido("GET"))).status).toBe(401);
    expect((await PUT(pedido("PUT", TARIFA))).status).toBe(401);
    expect(gravarTarifaDasMudancas).not.toHaveBeenCalled();
    expect(tarifaDasMudancasDe).not.toHaveBeenCalled();
  });

  it("GET: a tarifa dele, se pode aparecer, os limites e as regras", async () => {
    const r = await GET(pedido("GET"));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.tarifa).toBeNull();
    expect(d.podeAparecerNaLista).toBe(true);
    expect(d.limites.hora).toEqual({ min: 15, max: 150 });
    expect(d.regras).toEqual({ taxaDaPlataforma: TAXA_DAS_MUDANCAS, modoDaTaxa: MODO_DA_TAXA_DAS_MUDANCAS, materialComIva: MATERIAL_COM_IVA, iva: TAXA_IVA });
    expect(tarifaDasMudancasDe).toHaveBeenCalledWith(7);
  });

  it("PUT: grava na conta da sessão, nunca na do corpo", async () => {
    const r = await PUT(pedido("PUT", { ...TARIFA, providerId: 99 }));
    expect(r.status).toBe(200);
    expect(gravarTarifaDasMudancas).toHaveBeenCalledWith(7, TARIFA);
  });

  it("PUT fora dos limites: 400 com o campo, e nada gravado", async () => {
    const r = await PUT(pedido("PUT", { ...TARIFA, precoHora2: 500, precoKm: -1 }));
    expect(r.status).toBe(400);
    const d = await r.json();
    expect(Object.keys(d.erros)).toEqual(expect.arrayContaining(["precoHora2", "precoKm"]));
    expect(gravarTarifaDasMudancas).not.toHaveBeenCalled();
  });

  it("sem a categoria mudanças não liga a lista (403), mas pode gravar desligada", async () => {
    vi.mocked(categoriasDoProfissional).mockResolvedValue(["recolhas"]);
    expect((await PUT(pedido("PUT", TARIFA))).status).toBe(403);
    expect(gravarTarifaDasMudancas).not.toHaveBeenCalled();
    expect((await PUT(pedido("PUT", { ...TARIFA, aparecerNaLista: false }))).status).toBe(200);
    expect(gravarTarifaDasMudancas).toHaveBeenCalledWith(7, { ...TARIFA, aparecerNaLista: false });
  });

  it("corpo que não é JSON: 400", async () => {
    const r = await PUT(
      new NextRequest("https://clyon.pt/api/profissionais/tarifas-mudancas", { method: "PUT", body: "{" }),
    );
    expect(r.status).toBe(400);
  });
});

describe("a tabela tarifasDasMudancas", () => {
  const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8").replace(/\r\n/g, "\n");
  const i = DB.indexOf("export async function ensureTarifasDasMudancasTable(");
  const corpo = DB.slice(i, DB.indexOf("\n}\n", i));
  const criar = corpo.slice(corpo.indexOf("CREATE TABLE IF NOT EXISTS tarifasDasMudancas"), corpo.indexOf(") ENGINE="));

  it("cria-se uma vez, sem apagar nada, e as colunas novas passam pelas migrações", () => {
    expect(i).toBeGreaterThan(-1);
    expect(corpo).toContain("if (tarifasDasMudancasReady) return;");
    expect(corpo).toContain("CREATE TABLE IF NOT EXISTS tarifasDasMudancas");
    expect(corpo).toContain('await correrMigracoes(pool, "tarifasDasMudancas", MIGRACOES_DAS_TARIFAS_DAS_MUDANCAS, "tarifasDasMudancas");');
    expect(DB).not.toMatch(/DROP\s+TABLE[^;\n]*tarifasDasMudancas/i);
  });

  it("uma linha por profissional, com todas as colunas da tarifa", () => {
    expect(criar).toMatch(/providerId\s+INT UNSIGNED NOT NULL PRIMARY KEY/);
    for (const col of [...Object.keys(TARIFA), "actualizadoEm"]) {
      expect(criar, col).toMatch(new RegExp(`\\n\\s+${col}\\s`));
    }
  });

  it("cada migração acrescenta uma coluna que o CREATE também tem", () => {
    const j = DB.indexOf("const MIGRACOES_DAS_TARIFAS_DAS_MUDANCAS");
    const lista = DB.slice(j, DB.indexOf("];", j));
    const cols = [...lista.matchAll(/ALTER TABLE tarifasDasMudancas ADD COLUMN (\w+)/g)].map((m) => m[1]);
    expect(cols.length).toBeGreaterThan(0);
    for (const c of cols) expect(criar).toMatch(new RegExp(`\\n\\s+${c}\\s`));
  });
});
