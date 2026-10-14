import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deTerra, emTerra, emTerraNoInicio, paraTerra } from "./preposicao-da-terra";
import { RECOLHA_DA_CAMARA } from "./recolha-da-camara";
import { SERVICES } from "./seo-data";

/*
 * «EM MOITA» — 14-10-2026. As páginas de cidade punham «em» antes de todos os
 * nomes. Quem é de lá diz na Moita, no Barreiro, no Seixal.
 */
describe("a preposição de cada terra", () => {
  it("as que levam artigo", () => {
    expect(emTerra("Moita")).toBe("na Moita");
    expect(emTerra("Barreiro")).toBe("no Barreiro");
    expect(emTerra("Seixal")).toBe("no Seixal");
    expect(emTerra("Montijo")).toBe("no Montijo");
    expect(emTerra("Amadora")).toBe("na Amadora");
    expect(emTerra("Costa da Caparica")).toBe("na Costa da Caparica");
    expect(emTerra("Lumiar")).toBe("no Lumiar");
    expect(emTerra("Olivais")).toBe("nos Olivais");
    expect(emTerraNoInicio("Moita")).toBe("Na Moita");
    expect(paraTerra("Moita")).toBe("para a Moita");
    expect(paraTerra("Olivais")).toBe("para os Olivais");
    expect(paraTerra("Lisboa")).toBe("para Lisboa");
  });

  it("as outras ficam com «em»", () => {
    expect(emTerra("Lisboa")).toBe("em Lisboa");
    expect(emTerra("Setúbal")).toBe("em Setúbal");
    expect(emTerraNoInicio("Almada")).toBe("Em Almada");
  });

  it("e as regiões que as páginas nomeiam", () => {
    expect(emTerra("Margem Sul")).toBe("na Margem Sul");
    expect(deTerra("Grande Lisboa")).toBe("da Grande Lisboa");
  });

  it("bate com a forma que a recolha da câmara já escreve, concelho a concelho", () => {
    // «Câmara do Barreiro» foi corrigida à mão a 14-10-2026; as duas listas
    // não podem dizer coisas diferentes da mesma terra.
    const concelhos = Object.values(RECOLHA_DA_CAMARA);
    expect(concelhos.length).toBeGreaterThan(10);
    for (const c of concelhos) expect(deTerra(c.concelho), c.concelho).toBe(c.de);
  });
});

describe("o que a página de cidade diz a quem quer pedir", () => {
  const PAGINA = readFileSync(join(process.cwd(), "src/app/[...slug]/page.tsx"), "utf8");

  it("cada serviço tem uma acção, e não o nome curto", () => {
    for (const s of SERVICES) {
      expect(s.acao, s.slug).toMatch(/^(retirar|fazer|esvaziar) /);
    }
  });

  it("a mensagem do WhatsApp e o «Precisa de …?» usam a acção e a preposição", () => {
    // Diziam «Olá! Preciso de móveis em Moita» e «Precisa de entulho em Palmela?».
    expect(PAGINA).toContain("Olá! Preciso de ${service.acao} ${emTerra(city.name)}.");
    expect(PAGINA).toContain("Precisa de {service.acao} {emTerra(city.name)}?");
    expect(PAGINA).not.toContain("Preciso de ${service.shortName}");
  });

  it("tem um botão que liga, e não só um que leva aos contactos", () => {
    expect(PAGINA).toContain("href={`tel:${BUSINESS_PHONE}`}");
  });

  it("nenhum nome de terra leva «em» escrito à mão", () => {
    // Nem no modelo da página, nem no título e na descrição que o Google mostra.
    for (const f of [
      "src/app/[...slug]/page.tsx",
      "src/lib/titulos-seo.ts",
      "src/lib/descricoes-seo.ts",
      "src/app/regioes/[region]/page.tsx",
    ]) {
      const codigo = readFileSync(join(process.cwd(), f), "utf8");
      expect(codigo, f).not.toMatch(/\b[Ee]m \$?\{(city\.name|cityName|relatedCity\.name|regionLabel|regionData\.name)\}/);
    }
  });

  it("a FAQ não pergunta «Quanto custa recolha de…» sem artigo", () => {
    expect(PAGINA).not.toContain("Quanto custa ${serviceName.toLowerCase()}");
  });
});
