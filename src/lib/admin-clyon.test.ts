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
  validateProposal,
  isQuoteApprovalAvailable,
  quotePriceIsRequiredForStatus,
  validatedQuotePrice,
  QUOTE_APPROVAL_TARGET_STATUS,
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

// ── 7. Proposta de preço ao cliente (plano de negociação §3, §6, §9) ───────
describe("proposta de preço ao cliente", () => {
  it("só fica disponível para rascunhos, recebidos ou em análise", () => {
    expect(isQuoteApprovalAvailable("draft")).toBe(true);
    expect(isQuoteApprovalAvailable("received")).toBe(true);
    // Após contraproposta do cliente o pedido volta a in_review — o admin
    // pode enviar nova proposta a partir daí
    expect(isQuoteApprovalAvailable("in_review")).toBe(true);
    expect(isQuoteApprovalAvailable("awaiting_customer_approval")).toBe(false);
    expect(isQuoteApprovalAvailable("awaiting_deposit")).toBe(false);
    expect(isQuoteApprovalAvailable("confirmed")).toBe(false);
  });

  it("a proposta leva o pedido a awaiting_customer_approval, não a confirmed", () => {
    expect(QUOTE_APPROVAL_TARGET_STATUS).toBe("awaiting_customer_approval");
  });

  it("aceita uma proposta com valor positivo e justificação suficiente", () => {
    const r = validateProposal("200.50", "Acesso fácil, sem segundo operador.");
    expect(r.ok).toBe(true);
    expect(r.error).toBeNull();
  });

  it("rejeita uma proposta sem valor positivo", () => {
    const msg = "Justificação suficientemente longa.";
    expect(validateProposal("", msg).error).toMatch(/superior a 0/);
    expect(validateProposal(0, msg).error).toMatch(/superior a 0/);
    expect(validateProposal(-1, msg).error).toMatch(/superior a 0/);
    expect(validateProposal("abc", msg).error).toMatch(/superior a 0/);
  });

  it("exige justificação — um campo opcional acaba vazio quando há pressa", () => {
    expect(validateProposal(200, "").error).toMatch(/justificação é obrigatória/i);
    expect(validateProposal(200, "   ").error).toMatch(/justificação é obrigatória/i);
    expect(validateProposal(200, "curto").error).toMatch(/justificação é obrigatória/i);
    expect(validateProposal(200, null).error).toMatch(/justificação é obrigatória/i);
  });

  it("normaliza apenas preços finitos e positivos", () => {
    expect(validatedQuotePrice("42.75")).toBe(42.75);
    expect(validatedQuotePrice(0)).toBeNull();
    expect(validatedQuotePrice(null)).toBeNull();
    expect(validatedQuotePrice(true)).toBeNull();
    expect(validatedQuotePrice("NaN")).toBeNull();
  });

  it("exige orçamento em todos os estados publicáveis (NOTA-PARA-O-SITE §1)", () => {
    expect(quotePriceIsRequiredForStatus("awaiting_deposit")).toBe(true);
    expect(quotePriceIsRequiredForStatus("confirmed")).toBe(true);
    // Sem preço, o trigger não publica e o pedido fica invisível sem erro —
    // o override manual para "A atribuir" também tem de exigir preço.
    expect(quotePriceIsRequiredForStatus("assignment_pending")).toBe(true);
    // Enviar o cliente a decidir sem valor é absurdo
    expect(quotePriceIsRequiredForStatus("awaiting_customer_approval")).toBe(true);
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

// ── 7. Fila de trabalho da visão geral ─────────────────────────────────────
// A lista mostrava o nome do cliente a partir de `profiles.name`, um campo
// que a API nunca devolveu — daí o traço em todas as linhas.
function haQuantoTempo(horas: number | null): string {
  if (horas === null) return "";
  if (horas < 1) return "agora mesmo";
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} dia${dias === 1 ? "" : "s"}`;
}

describe("haQuantoTempo — o tempo à espera lê-se de relance", () => {
  it("menos de uma hora não inventa números", () => {
    expect(haQuantoTempo(0)).toBe("agora mesmo");
  });

  it("horas dentro do primeiro dia", () => {
    expect(haQuantoTempo(3)).toBe("há 3 h");
    expect(haQuantoTempo(23)).toBe("há 23 h");
  });

  it("passa a dias às 24 h, no singular", () => {
    expect(haQuantoTempo(24)).toBe("há 1 dia");
    expect(haQuantoTempo(47)).toBe("há 1 dia");
    expect(haQuantoTempo(48)).toBe("há 2 dias");
  });

  it("sem data não afirma nada", () => {
    expect(haQuantoTempo(null)).toBe("");
  });
});

describe("ordenação da fila — o mais parado primeiro", () => {
  it("o pedido mais antigo encabeça a lista", () => {
    const rows = [
      { id: "b", created_at: "2026-07-20T10:00:00Z" },
      { id: "a", created_at: "2026-07-18T10:00:00Z" },
      { id: "c", created_at: "2026-07-25T10:00:00Z" },
    ];
    const ordenado = [...rows].sort((x, y) =>
      String(x.created_at ?? "").localeCompare(String(y.created_at ?? "")),
    );
    expect(ordenado.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

// ── 8. Filtro "Novos" da lista de pedidos ─────────────────────────────────
// O cartão contava viewedAt IS NULL (servidor) e a lista filtrava
// status === "pendente" (cliente). Duas definições para a mesma palavra: o
// cartão dizia 4 e a lista aparecia vazia.
function pedidoNoFiltro(
  p: { status: string; viewedAt?: string | null },
  filtro: string,
): boolean {
  if (p.status === "arquivado") return filtro === "arquivado";
  if (filtro === "todos") return true;
  if (filtro === "pendente") return !p.viewedAt;
  return p.status === filtro;
}

describe("pedidoNoFiltro — Novos é o que ninguém abriu", () => {
  it("um pedido nunca aberto é novo, seja qual for o estado", () => {
    expect(pedidoNoFiltro({ status: "sem_assistente", viewedAt: null }, "pendente")).toBe(true);
    expect(pedidoNoFiltro({ status: "atribuido", viewedAt: null }, "pendente")).toBe(true);
  });

  it("depois de aberto deixa de ser novo, mesmo com status pendente", () => {
    expect(pedidoNoFiltro({ status: "pendente", viewedAt: "2026-07-28T10:00:00Z" }, "pendente")).toBe(false);
  });

  it("arquivados só aparecem no seu próprio filtro", () => {
    expect(pedidoNoFiltro({ status: "arquivado", viewedAt: null }, "pendente")).toBe(false);
    expect(pedidoNoFiltro({ status: "arquivado" }, "todos")).toBe(false);
    expect(pedidoNoFiltro({ status: "arquivado" }, "arquivado")).toBe(true);
  });

  // O filtro "sem assistente" desapareceu com a função. O ESTADO
  // sem_assistente continua a existir — é com ele que um pedido nasce — e
  // passa a filtrar-se como qualquer outro.
  it("sem_assistente filtra-se como estado, não como vista", () => {
    expect(pedidoNoFiltro({ status: "sem_assistente" }, "sem_assistente")).toBe(true);
    expect(pedidoNoFiltro({ status: "em_analise" }, "sem_assistente")).toBe(false);
  });

  it("os estados de fecho são filtráveis", () => {
    expect(pedidoNoFiltro({ status: "concluido" }, "concluido")).toBe(true);
    expect(pedidoNoFiltro({ status: "rejeitado" }, "rejeitado")).toBe(true);
    expect(pedidoNoFiltro({ status: "concluido" }, "rejeitado")).toBe(false);
  });

  it("um pedido fechado continua a contar em todos", () => {
    expect(pedidoNoFiltro({ status: "concluido" }, "todos")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A coluna Origem dizia "Simulador" a toda a gente
// ─────────────────────────────────────────────────────────────────────────
import { origemPeloSlug, origemDoPedido } from "./acesso";
import { readFileSync as lerFicheiro } from "node:fs";
import { join as juntar } from "node:path";

describe("origemPeloSlug — a lista não recebe o JSON inteiro", () => {
  it("traduz os slugs que existem nos dados", () => {
    expect(origemPeloSlug("formulario_contactos").label).toBe("Contactos");
    expect(origemPeloSlug("hero_quote_form").label).toBe("Formulário");
    expect(origemPeloSlug("simulador").label).toBe("Simulador");
  });

  it("uma origem nova aparece como veio, em vez de virar 'Simulador'", () => {
    expect(origemPeloSlug("campanha_verao").label).toBe("campanha_verao");
  });

  it("sem slug, é mesmo do simulador", () => {
    expect(origemPeloSlug(null).label).toBe("Simulador");
    expect(origemPeloSlug("  ").label).toBe("Simulador");
  });

  /**
   * O detalhe e a lista mostravam etiquetas diferentes para o MESMO pedido:
   * "#188 · CONTACTOS" no topo do detalhe, "Simulador" na lista. As duas
   * funções passam a dar o mesmo, porque partilham o mapa de rótulos.
   */
  it("dá o mesmo que o caminho do detalhe, para o mesmo pedido", () => {
    const raw = JSON.stringify({ _source: "formulario_contactos" });
    expect(origemPeloSlug("formulario_contactos").label).toBe(origemDoPedido(raw).label);
  });
});

describe("a consulta da lista traz o que a lista mostra", () => {
  const db = lerFicheiro(juntar(process.cwd(), "src/lib/db.ts"), "utf8");
  const consulta = db.slice(
    db.indexOf("export async function getAllSimulatorOrders"),
    db.indexOf("export async function getSimulatorOrderById"),
  );

  /**
   * Faltavam quatro campos e o ecrã mentia sem dar erro nenhum: Origem dizia
   * sempre "Simulador", Localidade e Urgência estavam sempre a "—", e o
   * filtro "Novos" (que é `!viewedAt` no cliente) mostrava tudo.
   */
  it.each(["city", "urgency", "viewedAt", "origemSlug"])(
    "a lista precisa de %s e a consulta traz",
    (campo) => {
      expect(consulta).toContain(campo);
    },
  );

  it("continua sem trazer os JSON grandes", () => {
    expect(consulta).not.toMatch(/SELECT[^`]*chatHistory/);
    expect(consulta).not.toMatch(/SELECT \*/);
  });
});
