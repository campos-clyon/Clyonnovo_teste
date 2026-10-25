import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assistenteComSeccoesPodeChamar } from "./papel-do-painel";
import {
  MAXIMO_DE_RESULTADOS,
  origemDoPedido,
  procurarNasLinhas,
  seccaoDaOrigem,
  termoQueProcura,
  type LinhaParaProcurar,
} from "./procurar-em-todo-o-lado";

/**
 * PROCURAR EM TODO O LADO — 17-10-2026.
 *
 * *«As barras de pesquisa de toda a backoffice devem mostrar qualquer
 * trabalho, independente de onde foi gerado: Trabalhos CLYON, Negociações ou
 * pedidos directos no site.»* — o dono.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const linha = (id: number, extra: Partial<LinhaParaProcurar> = {}): LinhaParaProcurar => ({
  id,
  status: "pendente",
  contactName: `Cliente ${id}`,
  contactPhone: `91200${String(id).padStart(4, "0")}`,
  address: "Rua das Flores, 10",
  city: "Almada",
  serviceType: "recolha_moveis",
  valorFixoClyon: null,
  negociacoes: 0,
  profissional: null,
  createdAt: "2026-10-10 10:00:00",
  ...extra,
});

describe("de onde veio cada pedido, e onde se trata", () => {
  it("valor fixo é Trabalho CLYON; com mesa é Negociação; o resto é Pedido do site", () => {
    expect(origemDoPedido({ valorFixoClyon: "60.00", negociacoes: 3 })).toBe("trabalho_clyon");
    expect(origemDoPedido({ valorFixoClyon: null, negociacoes: 2 })).toBe("negociacao");
    expect(origemDoPedido({ valorFixoClyon: null, negociacoes: 0 })).toBe("pedido_do_site");
    // Os de valor fixo tratam-se na Mesa desde 20-10-2026.
    expect(seccaoDaOrigem("trabalho_clyon")).toBe("negociacoes_clyon");
    expect(seccaoDaOrigem("negociacao")).toBe("negociacoes_clyon");
    expect(seccaoDaOrigem("pedido_do_site")).toBe("pedidos");
  });
});

describe("a procura", () => {
  const linhas = [
    linha(450, { valorFixoClyon: 60, contactName: "Lúcia Valente" }),
    linha(448, { negociacoes: 2, contactName: "Noémia Brito", profissional: "TRSul" }),
    linha(45, { contactName: "Silvino Reis" }),
  ];

  it("«#450» é esse pedido e só esse — não o #45", () => {
    expect(procurarNasLinhas(linhas, "#450").map((r) => r.pedidoId)).toEqual([450]);
  });

  it("um nome, sem acentos, e o profissional que ficou com ele", () => {
    expect(procurarNasLinhas(linhas, "lucia").map((r) => r.pedidoId)).toEqual([450]);
    expect(procurarNasLinhas(linhas, "trsul").map((r) => r.pedidoId)).toEqual([448]);
  });

  it("cada resultado diz a origem e a secção", () => {
    const [r] = procurarNasLinhas(linhas, "#448");
    expect(r).toMatchObject({ origem: "negociacao", seccao: "negociacoes_clyon", profissional: "TRSul", cliente: "Noémia Brito" });
  });

  it("os mais recentes primeiro, e no máximo vinte", () => {
    const muitas = Array.from({ length: 30 }, (_, i) => linha(100 + i, { city: "Seixal" }));
    const r = procurarNasLinhas(muitas, "seixal");
    expect(r).toHaveLength(MAXIMO_DE_RESULTADOS);
    expect(r[0].pedidoId).toBe(129);
  });

  it("uma letra só não procura; duas letras ou um número sim", () => {
    expect(termoQueProcura("a")).toBe(false);
    expect(termoQueProcura("  ")).toBe(false);
    expect(termoQueProcura("#4")).toBe(true);
    expect(termoQueProcura("ru")).toBe(true);
    expect(procurarNasLinhas(linhas, "a")).toEqual([]);
  });
});

describe("as peças", () => {
  it("a rota só lê, e só a quem tem uma das secções com caixa de procura", () => {
    const rota = ler("src/app/api/admin/procurar/route.ts");
    expect(rota).toContain("const { err } = await requireAdmin(req);");
    expect(rota).not.toMatch(/export async function (POST|PATCH|DELETE|PUT)/);
    for (const s of ["pedidos", "negociacoes_clyon", "trabalhos_clyon", "agenda", "pagamentos", "carteiras"] as const) {
      expect(assistenteComSeccoesPodeChamar([s], "/api/admin/procurar", "GET"), s).toBe(true);
    }
    expect(assistenteComSeccoesPodeChamar(["leads"], "/api/admin/procurar", "GET")).toBe(false);
  });

  it("a parte que vai para o browser não leva a base", () => {
    expect(ler("src/lib/procurar-em-todo-o-lado.ts")).not.toContain('from "@/lib/db"');
    expect(ler("src/lib/procurar-em-todo-o-lado-na-base.ts")).toContain("procurarNasLinhas(linhas, termo)");
  });

  it("a caixa está por baixo da procura de cada ecrã de trabalhos", () => {
    const onde: Array<[string, string]> = [
      ["src/components/admin/LegacyAdminClient.tsx", 'seccao="pedidos" tema="claro"'],
      ["src/components/admin/AdminNegociacoesPanel.tsx", 'seccao="negociacoes_clyon"'],
      ["src/components/admin/AdminAgendaPanel.tsx", 'seccao="agenda"'],
      ["src/components/admin/AdminPagamentosPanel.tsx", 'seccao="pagamentos"'],
      ["src/components/admin/AdminCarteirasPanel.tsx", 'seccao="carteiras"'],
    ];
    for (const [f, marca] of onde) {
      const codigo = ler(f);
      expect(codigo, f).toContain("<NoutrosSitios");
      expect(codigo, f).toContain(marca);
    }
  });

  it("o botão leva ao ecrã certo, já com a procura feita", () => {
    const painel = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(painel).toContain("<ProcuraGlobalContext.Provider value={procuraGlobal}>");
    expect(painel).toContain('url.searchParams.set("procurar", procura);');
    expect(painel).toContain('const procurarParam = searchParams.get("procurar");');
    // Os ecrãs de destino leem o `?procurar=` ao abrir.
    for (const f of ["src/components/admin/AdminNegociacoesPanel.tsx"]) {
      expect(ler(f), f).toContain('new URLSearchParams(window.location.search).get("procurar")');
    }
  });

  it("a lista do Início também acha um pedido pelo número", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain("const numero = /^#?\\s*(\\d{1,9})$/.exec(filters.search.trim());");
    expect(db).toContain('"(id = ? OR contactName LIKE ? OR contactPhone LIKE ? OR address LIKE ? OR description LIKE ?)"');
  });
});
