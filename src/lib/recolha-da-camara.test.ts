import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONCELHO_DA_ZONA, CONSULTADAS_EM, RECOLHA_DA_CAMARA, recolhaDaCamara } from "./recolha-da-camara";
import { getAllCityServiceSlugs } from "./seo-data";

/**
 * A RECOLHA DA CÂMARA NAS PÁGINAS DE MONOS E DE ENTULHO — 07-10-2026.
 *
 * «Temos que melhorar essas páginas e torná-las mais fortes.» Cada página de
 * monos e de entulho passa a dizer como funciona o serviço do município —
 * pesquisado nas páginas oficiais das dezasseis câmaras, serviços
 * municipalizados e sistemas de resíduos, com a fonte guardada — e quando
 * compensa um profissional. O que estes testes guardam é a regra do ficheiro:
 * nada sem fonte oficial, e nada que fale pela CLYON.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const PAGINAS = getAllCityServiceSlugs().filter(
  (x) => x.service.slug === "recolha-monos" || x.service.slug === "recolha-entulho",
);

describe("cada página de monos e de entulho tem o seu concelho", () => {
  it("todas as zonas com página sabem de que concelho são", () => {
    expect(PAGINAS.length).toBeGreaterThan(40);
    const semConcelho = PAGINAS.filter((x) => !CONCELHO_DA_ZONA[x.city.slug]).map((x) => x.slug[0]);
    expect(semConcelho).toEqual([]);
  });

  it("e cada concelho tem as duas coisas: monos e entulho", () => {
    for (const concelho of new Set(Object.values(CONCELHO_DA_ZONA))) {
      const r = RECOLHA_DA_CAMARA[concelho];
      expect(r, concelho).toBeDefined();
      expect(r.monos?.texto, `${concelho} — monos`).toBeTruthy();
      expect(r.entulho?.texto, `${concelho} — entulho`).toBeTruthy();
    }
  });

  it("uma freguesia lê o concelho dela, e não outro", () => {
    expect(recolhaDaCamara("benfica")?.concelho).toBe("Lisboa");
    expect(recolhaDaCamara("queluz")?.concelho).toBe("Sintra");
    expect(recolhaDaCamara("costa-da-caparica")?.concelho).toBe("Almada");
    expect(recolhaDaCamara("corroios")?.concelho).toBe("Seixal");
    expect(recolhaDaCamara("zona-que-nao-existe")).toBeNull();
  });
});

describe("nada sem fonte oficial", () => {
  const blocos = Object.entries(RECOLHA_DA_CAMARA).flatMap(([concelho, r]) =>
    [r.monos, r.entulho].filter(Boolean).map((b) => ({ concelho, ...b! })),
  );

  it("cada bloco tem pelo menos uma fonte, em https e num site português", () => {
    for (const b of blocos) {
      expect(b.fontes.length, b.concelho).toBeGreaterThan(0);
      for (const f of b.fontes) {
        const u = new URL(f.url);
        expect(u.protocol, f.url).toBe("https:");
        expect(u.hostname.endsWith(".pt"), f.url).toBe(true);
        expect(f.nome.length, f.url).toBeGreaterThan(3);
      }
    }
  });

  it("a data em que se leram as fontes é uma data", () => {
    expect(CONSULTADAS_EM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("os textos falam do município, e não prometem nada em nome da CLYON", () => {
    for (const b of blocos) {
      // «Nós Sesimbra» é o nome da aplicação da Câmara, e não a CLYON a falar.
      expect(b.texto.replace("Nós Sesimbra", ""), b.concelho).not.toMatch(/CLYON|\bnós\b|\bnosso/i);
      // Frases inteiras, para ler numa página — e não notas de pesquisa.
      expect(b.texto.trim().endsWith("."), b.concelho).toBe(true);
      expect(b.texto, b.concelho).not.toContain("não confirmado");
    }
  });
});

describe("a página mostra-o", () => {
  const PAGINA = ler("src/app/[...slug]/page.tsx");

  it("só nas páginas de monos e de entulho", () => {
    expect(PAGINA).toContain('service.slug === "recolha-monos" || service.slug === "recolha-entulho"');
    expect(PAGINA).toContain("recolhaDaCamara(city.slug)");
  });

  it("com as fontes, a data em que foram lidas, e quando compensa um profissional", () => {
    expect(PAGINA).toContain("{daCamara.texto}");
    expect(PAGINA).toContain("daCamara.fontes");
    expect(PAGINA).toContain("CONSULTADAS_EM");
    expect(PAGINA).toContain("Quando compensa pedir a um profissional");
  });

  it("e a mesma resposta entra nas perguntas frequentes (o FAQPage do Google)", () => {
    expect(PAGINA).toContain("...(perguntaDaCamara ? [perguntaDaCamara] : []),");
  });

  it("o entulho de um profissional vai para operador licenciado, e não para o ecocentro", () => {
    // Os ecocentros da Valorsul e da Amarsul não recebem entulho.
    expect(PAGINA).toContain("O entulho que sai em {city.name} vai para um operador licenciado");
  });
});
