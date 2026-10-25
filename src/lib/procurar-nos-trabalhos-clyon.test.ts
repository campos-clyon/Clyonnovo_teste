import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { combinaComABusca } from "./procurar-pedido";

/**
 * PROCURAR NOS TRABALHOS CLYON — 09-10-2026. «Coloque o sistema de pesquisar
 * em Trabalhos CLYON também.» A mesma caixa e a mesma regra das Negociações.
 */

const T = readFileSync(join(process.cwd(), "src/components/admin/TrabalhoClyon.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("a regra é a das Negociações", () => {
  const trabalho = {
    id: 907,
    contactName: "Ana Modelo",
    contactPhone: "351910000325",
    address: "rua das flores",
    city: "Moita",
    serviceType: "recolha_monos",
    // Só quem aceitou ou ficou com ele — não os sete a quem foi oferecido.
    profissionais: ["Transportes Modelo", "TransTeste"],
  };

  it("pelo número, o nome, os últimos dígitos, a região, o serviço e quem aceitou", () => {
    for (const termo of ["#907", "modelo", "0325", "moita", "monos", "transteste"]) {
      expect(combinaComABusca(trabalho, termo)).toBe(true);
    }
    expect(combinaComABusca(trabalho, "inexistente")).toBe(false);
    expect(combinaComABusca(trabalho, "#908")).toBe(false);
  });
});

describe("o #428 «não existia» — 14-10-2026", () => {

  it("na Mesa, já não diz que está noutro sítio: está lá, e a procura encontra-o", () => {
    // Desde 20-10-2026 os de valor fixo vivem na Mesa (a Mesa e os Trabalhos CLYON num só).
    const N = readFileSync(join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(N).toContain('const r3 = await fetch(`/api/admin/trabalhos-clyon?outros=0${tudo ? "&tudo=1" : ""}`, {');
    expect(N).not.toContain("Nos Trabalhos CLYON, que não aparecem nesta mesa:");
    const filtro = N.slice(N.indexOf("const clyonNaMesa = useMemo("), N.indexOf("const clyonPorBloco"));
    expect(filtro).toContain("combinaComABusca(");
    expect(filtro).toContain("profissionais: quem.map((n) => n.profissional),");
  });
});
