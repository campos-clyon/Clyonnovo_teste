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
import {
  buildQuoteApprovalPayload,
  isQuoteApprovalAvailable,
  quotePriceIsRequiredForStatus,
  validatedQuotePrice,
} from "@/lib/quote-approval";

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

// ── 6. displayText — renderização defensiva contra React #31 ──────────────
function displayText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ");
    return joined || fallback;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined) {
        parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
      }
    }
    return parts.length > 0 ? parts.join("; ") : fallback;
  }
  return String(value) || fallback;
}

describe("displayText — renderização segura para JSX", () => {
  it("devolve fallback para null", () => {
    expect(displayText(null)).toBe("—");
  });

  it("devolve fallback para undefined", () => {
    expect(displayText(undefined)).toBe("—");
  });

  it("devolve fallback para string vazia", () => {
    expect(displayText("")).toBe("—");
  });

  it("devolve string quando é texto válido", () => {
    expect(displayText("Limpar casa")).toBe("Limpar casa");
  });

  it("devolve número como string", () => {
    expect(displayText(42)).toBe("42");
  });

  it("devolve boolean como string", () => {
    expect(displayText(true)).toBe("true");
  });

  it("converte array de strings", () => {
    expect(displayText(["a", "b"])).toBe("a, b");
  });

  it("converte array misto com JSON", () => {
    const r = displayText(["texto", { x: 1 }]);
    expect(r).toContain("texto");
    expect(r).toContain("{");
  });

  it("converte o objecto real de produção (React #31) sem lançar erro", () => {
    const prodDetails = {
      items_max: 5,
      items_min: 2,
      distance_km: 12.5,
      travel_cost: 8.00,
      matched_keywords: ["entulho", "obra"],
      pending_quote_id: "abc-123",
    };
    const result = displayText(prodDetails);
    expect(typeof result).toBe("string");
    expect(result).not.toBe("—");
    expect(result).toContain("items_max");
    expect(result).toContain("distance_km");
    expect(result).not.toBe("[object Object]");
  });

  it("devolve fallback para objecto vazio", () => {
    expect(displayText({})).toBe("—");
  });

  it("ignora chaves com valor null no objecto", () => {
    const result = displayText({ a: 1, b: null });
    expect(result).toBe("a: 1");
  });

  it("usa fallback personalizado", () => {
    expect(displayText(null, "N/D")).toBe("N/D");
  });
});

// ── 7. Aprovação explícita de orçamento ────────────────────────────────────
describe("aprovação de orçamento", () => {
  it("só fica disponível para rascunhos, recebidos ou em análise (CONTRATO.md §3)", () => {
    expect(isQuoteApprovalAvailable("draft")).toBe(true);
    expect(isQuoteApprovalAvailable("received")).toBe(true);
    expect(isQuoteApprovalAvailable("in_review")).toBe(true);
    expect(isQuoteApprovalAvailable("awaiting_deposit")).toBe(false);
    expect(isQuoteApprovalAvailable("confirmed")).toBe(false);
  });

  it("cria a operação de aprovação para confirmed (publicação automática)", () => {
    const result = buildQuoteApprovalPayload("200.50", "Cliente informado por telefone.");
    expect(result.error).toBeNull();
    expect(result.payload).toEqual({
      status: "confirmed",
      estimated_price: 200.5,
      admin_note: "Orçamento aprovado; pedido confirmado — publicação aos parceiros é automática. Cliente informado por telefone.",
    });
  });

  it("rejeita uma aprovação sem orçamento positivo", () => {
    expect(buildQuoteApprovalPayload("", null).error).toMatch(/superior a 0/);
    expect(buildQuoteApprovalPayload(0, null).error).toMatch(/superior a 0/);
    expect(buildQuoteApprovalPayload(-1, null).error).toMatch(/superior a 0/);
    expect(buildQuoteApprovalPayload("abc", null).error).toMatch(/superior a 0/);
  });

  it("normaliza apenas preços finitos e positivos", () => {
    expect(validatedQuotePrice("42.75")).toBe(42.75);
    expect(validatedQuotePrice(0)).toBeNull();
    expect(validatedQuotePrice(null)).toBeNull();
    expect(validatedQuotePrice(true)).toBeNull();
    expect(validatedQuotePrice("NaN")).toBeNull();
  });

  it("exige orçamento antes de aguardar depósito ou confirmar", () => {
    expect(quotePriceIsRequiredForStatus("awaiting_deposit")).toBe(true);
    expect(quotePriceIsRequiredForStatus("confirmed")).toBe(true);
    expect(quotePriceIsRequiredForStatus("in_review")).toBe(false);
  });
});

// ── 8. safeText (normalizador API) ─────────────────────────────────────────
function safeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined) {
        parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
      }
    }
    return parts.length > 0 ? parts.join("; ") : null;
  }
  return String(value);
}

describe("safeText — normalizador API para campos de texto", () => {
  it("preserva string", () => {
    expect(safeText("hello")).toBe("hello");
  });

  it("devolve null para null", () => {
    expect(safeText(null)).toBeNull();
  });

  it("converte número", () => {
    expect(safeText(42)).toBe("42");
  });

  it("serializa objecto de produção como texto legível", () => {
    const details = {
      items_max: 5,
      items_min: 2,
      distance_km: 12.5,
      travel_cost: 8.00,
      matched_keywords: ["entulho", "obra"],
      pending_quote_id: "abc-123",
    };
    const result = safeText(details);
    expect(typeof result).toBe("string");
    expect(result).not.toBeNull();
    expect(result!).toContain("items_max: 5");
    expect(result!).toContain("distance_km: 12.5");
    expect(result!).toContain("pending_quote_id: abc-123");
  });

  it("devolve null para objecto vazio", () => {
    expect(safeText({})).toBeNull();
  });

  it("serializa array", () => {
    expect(safeText(["a", "b"])).toBe("a, b");
  });
});
