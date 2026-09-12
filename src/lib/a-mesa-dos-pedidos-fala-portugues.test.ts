import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tService, tUrgency } from "./translations";

/**
 * A MESA DOS PEDIDOS FALA PORTUGUÊS.
 *
 * "Esse painel deve estar inteiramente em pt-PT." — 12-09-2026, a olhar para
 * uma tabela onde se lia:
 *
 *   SERVIÇO        URGÊNCIA      STATUS
 *   recolha_moveis  This_week    Por atribuir
 *   esvaziamento_a… Flexible     Cancelado
 *
 * Três coisas diferentes na mesma linha. O serviço saía com o identificador
 * da base — traço baixo e cortado ao meio. A urgência saía em inglês, com um
 * `capitalize` por cima que lhe dava ar de palavra sem o ser. E a coluna
 * chamava-se «Status».
 *
 * As traduções já existiam em `translations.ts` e são usadas em todo o lado —
 * nas métricas, nos emails, no detalhe do pedido. Só esta tabela é que nunca
 * lá tinha ido.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const SHELL = ler("src/components/admin/LegacyAdminClient.tsx");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("os valores da base não chegam ao ecrã", () => {
  it("o serviço passa pelas traduções da casa", () => {
    expect(SHELL).toContain("return tService(value.trim());");
    expect(tService("recolha_moveis")).toBe("Recolha de móveis");
    expect(tService("esvaziamento_apartamento")).toBe("Esvaziamento de apartamento");
  });

  it("a urgência também — e sem o `capitalize` que a disfarçava", () => {
    /*
     * O `capitalize` era o pior da história: punha maiúscula em «this_week» e
     * deixava-o parecido com uma palavra escrita de propósito.
     */
    expect(SHELL).toContain("{tUrgency(p.urgency)}");
    expect(semNotas(SHELL)).not.toContain("font-semibold capitalize ${urgencyText");
    expect(tUrgency("this_week")).toBe("Esta semana");
    expect(tUrgency("flexible")).toBe("Flexível");
  });

  it("a coluna chama-se Estado, e não Status", () => {
    expect(SHELL).toContain('"Urgência", "Estado", "Origem"');
    expect(semNotas(SHELL)).not.toContain('"Urgência", "Status"');
  });

  it("o valor legado da mudança continua a ser lido", () => {
    // «moving» ainda existe em linhas antigas e o mapa das traduções não o
    // conhece — por isso o caso fica antes da tradução, e não em vez dela.
    const i = SHELL.indexOf("function normalizeServiceTypeLabel(");
    const corpo = SHELL.slice(i, i + 900);
    expect(corpo).toContain('v === "mudanca" || v === "moving"');
    expect(corpo.indexOf('"moving"')).toBeLessThan(corpo.indexOf("tService("));
  });
});

describe("as traduções já existiam — era esta tabela que não as usava", () => {
  it("um serviço que o mapa não conheça devolve-se tal e qual, e não vazio", () => {
    // Melhor um identificador à vista do que um traço onde havia informação.
    expect(tService("servico_que_nao_existe")).toBe("servico_que_nao_existe");
  });

  it("sem valor, um travessão", () => {
    expect(SHELL).toContain('if (!value) return "—";');
  });
});
