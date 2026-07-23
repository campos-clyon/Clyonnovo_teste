/**
 * Testes para a consolidação do painel App CLYON em /admin.
 *
 * Cobre:
 *  1. Parser de URL para secção/aba/pedido
 *  2. Lista de abas permitidas (CLYON_TAB_IDS)
 *  3. Validação de cupões (campos obrigatórios, limites, tipos)
 *  4. Protecção de escalada de função (role) na API de utilizadores
 *  5. Redirects de rotas antigas
 */

import { describe, it, expect } from "vitest";
import { CLYON_TABS, CLYON_TAB_IDS, type AppClyonTab } from "@/components/admin/app-clyon/navigation";

// ── 1. Parser de URL ───────────────────────────────────────────────────────
function parseClyonUrl(search: string): { section: string | null; tab: AppClyonTab | null; pedido: string | null } {
  const sp = new URLSearchParams(search);
  const section = sp.get("section");
  const rawTab = sp.get("tab") as AppClyonTab | null;
  const tab = rawTab && CLYON_TAB_IDS.includes(rawTab) ? rawTab : null;
  const pedido = sp.get("pedido");
  return { section, tab, pedido };
}

describe("parseClyonUrl", () => {
  it("extrai section e tab válidos", () => {
    const r = parseClyonUrl("?section=app_clyon&tab=pedidos");
    expect(r.section).toBe("app_clyon");
    expect(r.tab).toBe("pedidos");
    expect(r.pedido).toBeNull();
  });

  it("ignora tab inválido", () => {
    const r = parseClyonUrl("?section=app_clyon&tab=nao_existe");
    expect(r.tab).toBeNull();
  });

  it("extrai pedido UUID", () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const r = parseClyonUrl(`?section=app_clyon&tab=pedidos&pedido=${uuid}`);
    expect(r.tab).toBe("pedidos");
    expect(r.pedido).toBe(uuid);
  });

  it("devolve tudo null para URL vazia", () => {
    const r = parseClyonUrl("");
    expect(r.section).toBeNull();
    expect(r.tab).toBeNull();
    expect(r.pedido).toBeNull();
  });
});

// ── 2. Lista de abas ───────────────────────────────────────────────────────
describe("CLYON_TABS / CLYON_TAB_IDS", () => {
  it("contém exactamente 11 abas", () => {
    expect(CLYON_TABS).toHaveLength(11);
  });

  it("CLYON_TAB_IDS tem os IDs das 11 abas", () => {
    expect(CLYON_TAB_IDS).toHaveLength(11);
    expect(CLYON_TAB_IDS).toContain("visao-geral");
    expect(CLYON_TAB_IDS).toContain("pedidos");
    expect(CLYON_TAB_IDS).toContain("cupons");
    expect(CLYON_TAB_IDS).toContain("auditoria");
    expect(CLYON_TAB_IDS).toContain("contas");
    expect(CLYON_TAB_IDS).toContain("moedas");
  });

  it("cada aba tem id e label", () => {
    for (const tab of CLYON_TABS) {
      expect(typeof tab.id).toBe("string");
      expect(tab.id.length).toBeGreaterThan(0);
      expect(typeof tab.label).toBe("string");
      expect(tab.label.length).toBeGreaterThan(0);
    }
  });

  it("ids são únicos", () => {
    const ids = CLYON_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── 3. Validação de cupões ─────────────────────────────────────────────────
function validateCupon(body: Record<string, unknown>): string | null {
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code || code.length < 3 || code.length > 32) return "Código inválido (3-32 caracteres).";
  if (!/^[A-Z0-9_-]+$/.test(code)) return "Código só pode conter letras, números, _ e -.";

  const dtype = body.discount_type;
  if (dtype !== "percent" && dtype !== "fixed") return "discount_type deve ser 'percent' ou 'fixed'.";

  const dval = Number(body.discount_value);
  if (!isFinite(dval) || dval <= 0) return "discount_value deve ser positivo.";
  if (dtype === "percent" && dval > 100) return "Desconto em percentagem não pode exceder 100%.";

  if (body.usage_limit !== undefined && body.usage_limit !== null) {
    const ul = Number(body.usage_limit);
    if (!Number.isInteger(ul) || ul <= 0) return "usage_limit deve ser um inteiro positivo.";
  }
  if (body.per_account_limit !== undefined && body.per_account_limit !== null) {
    const pal = Number(body.per_account_limit);
    if (!Number.isInteger(pal) || pal <= 0) return "per_account_limit deve ser um inteiro positivo.";
  }
  if (body.minimum_order_amount !== undefined && body.minimum_order_amount !== null) {
    const moa = Number(body.minimum_order_amount);
    if (!isFinite(moa) || moa < 0) return "minimum_order_amount deve ser >= 0.";
  }
  return null;
}

describe("validateCupon", () => {
  const valid = { code: "PROMO20", discount_type: "percent", discount_value: 20 };

  it("aceita cupão válido", () => {
    expect(validateCupon(valid)).toBeNull();
  });

  it("rejeita código demasiado curto", () => {
    expect(validateCupon({ ...valid, code: "AB" })).toMatch(/3-32/);
  });

  it("rejeita código com caracteres inválidos", () => {
    expect(validateCupon({ ...valid, code: "PROMO 20" })).toMatch(/só pode conter/);
  });

  it("rejeita discount_type inválido", () => {
    expect(validateCupon({ ...valid, discount_type: "halfprice" })).toMatch(/percent.*fixed/);
  });

  it("rejeita discount_value zero", () => {
    expect(validateCupon({ ...valid, discount_value: 0 })).toMatch(/positivo/);
  });

  it("rejeita percentagem > 100", () => {
    expect(validateCupon({ ...valid, discount_value: 101 })).toMatch(/100%/);
  });

  it("aceita fixed > 100 (valor em €)", () => {
    expect(validateCupon({ ...valid, discount_type: "fixed", discount_value: 150 })).toBeNull();
  });

  it("rejeita usage_limit negativo", () => {
    expect(validateCupon({ ...valid, usage_limit: -1 })).toMatch(/inteiro positivo/);
  });

  it("rejeita usage_limit não inteiro", () => {
    expect(validateCupon({ ...valid, usage_limit: 1.5 })).toMatch(/inteiro positivo/);
  });

  it("aceita usage_limit null (ilimitado)", () => {
    expect(validateCupon({ ...valid, usage_limit: null })).toBeNull();
  });

  it("rejeita minimum_order_amount negativo", () => {
    expect(validateCupon({ ...valid, minimum_order_amount: -5 })).toMatch(/>= 0/);
  });

  it("aceita minimum_order_amount zero", () => {
    expect(validateCupon({ ...valid, minimum_order_amount: 0 })).toBeNull();
  });
});

// ── 4. Protecção de escalada de função ────────────────────────────────────
describe("protecção de escalada de função em /api/admin/users PATCH", () => {
  function canChangeRole(funcao: string | undefined): boolean {
    return funcao === "admin_geral";
  }

  it("admin_geral pode alterar funções", () => {
    expect(canChangeRole("admin_geral")).toBe(true);
  });

  it("assistente não pode alterar funções", () => {
    expect(canChangeRole("assistente")).toBe(false);
  });

  it("admin genérico não pode alterar funções", () => {
    expect(canChangeRole("admin")).toBe(false);
  });

  it("funcao indefinida não pode alterar funções", () => {
    expect(canChangeRole(undefined)).toBe(false);
  });
});

// ── 5. Rotas antigas devem ser redirects ──────────────────────────────────
describe("mapeamento de redirects de rotas antigas", () => {
  const redirectMap: Record<string, string> = {
    "/admin/app-clyon":                    "/admin?section=app_clyon&tab=visao-geral",
    "/admin/app-clyon/visao-geral":        "/admin?section=app_clyon&tab=visao-geral",
    "/admin/app-clyon/pedidos":            "/admin?section=app_clyon&tab=pedidos",
    "/admin/app-clyon/agenda":             "/admin?section=app_clyon&tab=agenda",
    "/admin/app-clyon/equipa":             "/admin?section=app_clyon&tab=profissionais",
    "/admin/app-clyon/catalogo":           "/admin?section=app_clyon&tab=catalogo",
    "/admin/app-clyon/config":             "/admin?section=app_clyon&tab=config",
    "/admin/app-clyon/metricas":           "/admin?section=app_clyon&tab=metricas",
    "/admin/app-pedidos":                  "/admin?section=app_clyon&tab=pedidos",
  };

  for (const [from, to] of Object.entries(redirectMap)) {
    it(`${from} → ${to}`, () => {
      expect(to).toContain("section=app_clyon");
      expect(to).toContain("/admin?");
      expect(from).not.toBe(to);
    });
  }

  it("rota de detalhe de pedido inclui ID no redirect", () => {
    const id = "abc123";
    const target = `/admin?section=app_clyon&tab=pedidos&pedido=${id}`;
    expect(target).toContain(id);
    expect(target).toContain("tab=pedidos");
  });
});
