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
    linha(450, { valorFixoClyon: 60, contactName: "Júlia Castanheira" }),
    linha(448, { negociacoes: 2, contactName: "Leónia Sobral", profissional: "TRSul" }),
    linha(45, { contactName: "Silvério Pinhal" }),
  ];

  it("«#450» é esse pedido e só esse — não o #45", () => {
    expect(procurarNasLinhas(linhas, "#450").map((r) => r.pedidoId)).toEqual([450]);
  });

  it("um nome, sem acentos, e o profissional que ficou com ele", () => {
    expect(procurarNasLinhas(linhas, "julia").map((r) => r.pedidoId)).toEqual([450]);
    expect(procurarNasLinhas(linhas, "trsul").map((r) => r.pedidoId)).toEqual([448]);
  });

  it("cada resultado diz a origem e a secção", () => {
    const [r] = procurarNasLinhas(linhas, "#448");
    expect(r).toMatchObject({ origem: "negociacao", seccao: "negociacoes_clyon", profissional: "TRSul", cliente: "Leónia Sobral" });
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
  it("a rota só lê, e não abre aos Leads", () => {
    const rota = ler("src/app/api/admin/procurar/route.ts");
    expect(rota).toContain("const { err, colab } = await requireAdmin(req);");
    expect(rota).not.toMatch(/export async function (POST|PATCH|DELETE|PUT)/);
    for (const s of ["pedidos", "negociacoes_clyon", "trabalhos_clyon", "agenda", "pagamentos", "carteiras"] as const) {
      expect(assistenteComSeccoesPodeChamar([s], "/api/admin/procurar", "GET"), s).toBe(true);
    }
    expect(assistenteComSeccoesPodeChamar(["leads"], "/api/admin/procurar", "GET")).toBe(false);
  });

  it("a parte que vai para o browser não leva a base", () => {
    expect(ler("src/lib/procurar-em-todo-o-lado.ts")).not.toContain('from "@/lib/db"');
    expect(ler("src/lib/procura-do-backoffice.ts")).not.toContain('from "@/lib/db"');
    // A leitura da base usa a mesma procura das listas (d79: em procura-do-backoffice-na-base.ts).
    expect(ler("src/lib/procura-do-backoffice-na-base.ts")).toContain("procurarNasLinhas(linhas, termo)");
  });

  it("o bloco «Em todo o backoffice» está uma vez, por baixo da secção (d79), e já não nos ecrãs", () => {
    const painel = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(painel).toContain("<ProcuraGlobalContext.Provider value={procuraGlobal}>");
    expect(painel.split("<EmTodoOBackoffice").length - 1).toBe(1);
    for (const f of [
      "src/components/admin/AdminNegociacoesPanel.tsx",
      "src/components/admin/AdminAgendaPanel.tsx",
      "src/components/admin/AdminPagamentosPanel.tsx",
      "src/components/admin/AdminCarteirasPanel.tsx",
    ]) {
      expect(ler(f), f).not.toContain("<NoutrosSitios");
    }
  });

  it("a lista de todos os pedidos também acha um pedido pelo número", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain("const numero = /^#?\\s*(\\d{1,9})$/.exec(filters.search.trim());");
    expect(db).toContain('"(id = ? OR contactName LIKE ? OR contactPhone LIKE ? OR address LIKE ? OR description LIKE ?)"');
    // E pelo telefone com ou sem +351, e pelo NIF (d79).
    expect(db).toContain("const digitos = digitosDoTermo(filters.search);");
  });
});
