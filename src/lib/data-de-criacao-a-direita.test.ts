import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corDaDataDeCriacao } from "./idade-do-pedido";

/**
 * AS DATAS DE CRIAÇÃO À DIREITA, EM DESTAQUE — 20-10-2026.
 *
 * *«Quero que coloque as datas de criação dos pedidos do lado direito em
 * destaque, e que deixemos na cor branca até 7 dias; depois de 7 dias a partir
 * da data atual as datas ficam vermelhas — isso apenas nos pedidos.»* — o dono.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const AGORA = new Date("2026-10-20T12:00:00Z");

describe("a cor", () => {
  it("a branco até 7 dias, a vermelho depois", () => {
    expect(corDaDataDeCriacao("2026-10-20T09:00:00Z", AGORA)).toBe("text-white");
    expect(corDaDataDeCriacao("2026-10-14T12:00:00Z", AGORA)).toBe("text-white");
    expect(corDaDataDeCriacao("2026-10-13T11:00:00Z", AGORA)).toBe("text-red-400");
    expect(corDaDataDeCriacao("2026-09-01T10:00:00Z", AGORA)).toBe("text-red-400");
  });

  it("lê a data como a base a guarda (UTC, sem fuso)", () => {
    expect(corDaDataDeCriacao("2026-10-14 12:00:00", AGORA)).toBe("text-white");
    expect(corDaDataDeCriacao("2026-10-12 12:00:00", AGORA)).toBe("text-red-400");
  });

  it("sem data que se perceba, fica a branco", () => {
    expect(corDaDataDeCriacao(null, AGORA)).toBe("text-white");
    expect(corDaDataDeCriacao("isto não é data", AGORA)).toBe("text-white");
  });
});

describe("onde aparece — só nos Pedidos", () => {
  it("na Mesa: nas negociações, à direita; no «Por decidir», no fim da linha", () => {
    const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(MESA).toContain("text-sm font-bold tabular-nums ${corDaDataDeCriacao(p.createdAt, new Date())}");
    expect(MESA).toContain("ml-auto whitespace-nowrap text-sm font-bold tabular-nums ${corDaDataDeCriacao(p.createdAt, agora)}");
    expect(MESA).not.toContain('{new Date(p.createdAt).toLocaleDateString("pt-PT")}');
  });

  it("nos de valor fixo, à direita por baixo do valor, e já não no meio da linha", () => {
    const T = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(T).toContain("mt-1 whitespace-nowrap text-sm font-bold tabular-nums ${corDaDataDeCriacao(t.criadoEm, new Date())}");
    expect(T).not.toContain("entrou {dataEHoraEmLisboa(entrou)}");
  });

  it("em «Todos os pedidos», a coluna da data", () => {
    expect(ler("src/components/admin/LegacyAdminClient.tsx")).toContain(
      "px-2 py-3.5 text-xs font-bold tabular-nums ${corDaDataDeCriacao(p.createdAt, new Date())}",
    );
  });
});
