import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { combinaComABusca } from "./procurar-pedido";

/**
 * PROCURAR NOS TRABALHOS CLYON — 09-10-2026. «Coloque o sistema de pesquisar
 * em Trabalhos CLYON também.» A mesma caixa e a mesma regra das Negociações.
 */

const T = readFileSync(join(process.cwd(), "src/components/admin/AdminTrabalhosClyonPanel.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("a regra é a das Negociações", () => {
  const trabalho = {
    id: 424,
    contactName: "Ana Libório",
    contactPhone: "351918777325",
    address: "alto seixalinho",
    city: "Barreiro",
    serviceType: "recolha_monos",
    // Só quem aceitou ou ficou com ele — não os sete a quem foi oferecido.
    profissionais: ["Manuel Martins transportes", "TRSul"],
  };

  it("pelo número, o nome, os últimos dígitos, a região, o serviço e quem aceitou", () => {
    for (const termo of ["#424", "libório", "7325", "barreiro", "monos", "trsul"]) {
      expect(combinaComABusca(trabalho, termo)).toBe(true);
    }
    expect(combinaComABusca(trabalho, "revolution")).toBe(false);
    expect(combinaComABusca(trabalho, "#427")).toBe(false);
  });
});

describe("no painel dos Trabalhos CLYON", () => {
  it("a caixa e o filtro por profissional, por cima dos separadores", () => {
    expect(T).toContain('placeholder="Procurar por número, nome, telefone, morada ou região…"');
    expect(T).toContain('<option value="">Todos os profissionais</option>');
    expect(T.indexOf("Procurar por número")).toBeLessThan(T.indexOf('aria-label="Trabalhos CLYON por fase"'));
  });

  it("procura em todos os separadores, e os números contam o que se encontrou", () => {
    expect(T).toContain("encontrados.filter((t) => s.fases.includes(t.resumo.fase)),");
    expect(T).toContain("return combinaComABusca(");
  });

  it("quem está num trabalho é quem aceitou ou ficou com ele", () => {
    expect(T).toContain('return t.negociacoes.filter((n) => n.estado === "aguarda_contratacao" || n.estado === "acordada");');
    expect(T).toContain("profissionais: quem.map((n) => n.profissional),");
  });
});
