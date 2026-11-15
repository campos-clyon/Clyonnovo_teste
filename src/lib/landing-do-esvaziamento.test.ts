import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import nextConfig from "../../next.config";
import {
  CAMINHO_INTERNO_DO_ESVAZIAMENTO,
  ENDERECO_DO_ESVAZIAMENTO_NA_LANDING,
  ESVAZIAMENTO_NA_LANDING,
  SERVICO_DO_ESVAZIAMENTO_NA_LANDING,
} from "./landing-do-esvaziamento";
import { servicoDaLigacao } from "./servico-na-ligacao";
import { PRECOS } from "./precos-publicos";

/*
 * d42 — 15-11-2026. A página do anúncio sem «Entulho» no título, e a versão
 * do esvaziamento por ?servico=esvaziamento.
 */
const RAIZ = join(__dirname, "..", "..");
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");
const LANDING = ler("src/app/orcamento-recolha-lisboa/LandingClient.tsx");

describe("d42 — o título da página do anúncio", () => {
  it("deixa de dizer «Entulho», no <title>, no H1 e na descrição, e cabe nos 60", async () => {
    const { metadata } = await import("@/app/orcamento-recolha-lisboa/page");
    expect(metadata.title).toBe("Recolha de Móveis, Monos e Esvaziamentos em Lisboa");
    expect(`${metadata.title} | CLYON`.length).toBeLessThanOrEqual(60);
    expect(String(metadata.description)).not.toMatch(/entulho/i);
    expect([...String(metadata.description)].length).toBeLessThanOrEqual(155);
    expect(String(metadata.openGraph?.description)).not.toMatch(/entulho/i);
    expect(LANDING).not.toContain("Recolha de Móveis, Monos e Entulho em Lisboa");
    expect(LANDING).toContain('"Recolha de Móveis, Monos e Esvaziamentos em Lisboa"');
  }, 120_000);
});

describe("d42 — a versão do esvaziamento", () => {
  it("o endereço do anúncio é o da página com ?servico=esvaziamento", () => {
    expect(SERVICO_DO_ESVAZIAMENTO_NA_LANDING).toBe("esvaziamento");
    expect(ENDERECO_DO_ESVAZIAMENTO_NA_LANDING).toBe("https://clyon.pt/orcamento-recolha-lisboa?servico=esvaziamento");
  });

  it("o next.config reescreve esse endereço para a página estática, antes dos ficheiros", async () => {
    const r = await nextConfig.rewrites!();
    expect(Array.isArray(r)).toBe(false);
    const antes = (r as { beforeFiles: Array<{ source: string; destination: string; has?: unknown }> }).beforeFiles;
    expect(antes).toContainEqual({
      source: "/orcamento-recolha-lisboa",
      has: [{ type: "query", key: "servico", value: SERVICO_DO_ESVAZIAMENTO_NA_LANDING }],
      destination: CAMINHO_INTERNO_DO_ESVAZIAMENTO,
    });
    // Os ficheiros da app Pro continuam lá.
    const depois = (r as { afterFiles: Array<{ source: string }> }).afterFiles.map((x) => x.source);
    expect(depois).toEqual(["/.well-known/assetlinks.json", "/.well-known/apple-app-site-association"]);
  });

  it("a página interna existe, fora do Google, com título ≤ 60 e descrição ≤ 155", async () => {
    const { metadata } = await import("@/app/orcamento-recolha-lisboa/esvaziamento/page");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(`${metadata.title} | CLYON`.length).toBeLessThanOrEqual(60);
    expect([...String(metadata.description)].length).toBeLessThanOrEqual(155);
    expect(String(metadata.description)).toContain("com IVA");
    expect(ler("src/app/orcamento-recolha-lisboa/esvaziamento/page.tsx")).toContain('<LandingClient variante="esvaziamento" />');
  }, 120_000);

  it("o primeiro ecrã: o título, o que está incluído (com a limpeza se pedida), 3 passos e «Pedir propostas»", () => {
    expect(ESVAZIAMENTO_NA_LANDING.titulo).toBe("Esvaziamento de casas e apartamentos — heranças, mudanças, arrendamento");
    expect(ESVAZIAMENTO_NA_LANDING.incluido.join(" ")).toMatch(/Desmontagem/);
    expect(ESVAZIAMENTO_NA_LANDING.incluido.join(" ")).toMatch(/Carregamento/);
    expect(ESVAZIAMENTO_NA_LANDING.incluido.join(" ")).toMatch(/recheio todo/);
    expect(ESVAZIAMENTO_NA_LANDING.incluido.join(" ")).toMatch(/Limpeza e lavagem no fim, se a pedir/);
    expect(ESVAZIAMENTO_NA_LANDING.passos).toHaveLength(3);
    expect(ESVAZIAMENTO_NA_LANDING.botao).toBe("Pedir propostas");
    expect(LANDING).toContain("<PassosDoEsvaziamento />");
    expect(LANDING).toContain("ESVAZIAMENTO_NA_LANDING.titulo");
  });

  it("o simulador abre no esvaziamento de casa", () => {
    expect(servicoDaLigacao(new URL(ESVAZIAMENTO_NA_LANDING.simulador, "https://clyon.pt").search)).toBe("esvaziamento_casa");
  });

  it("o «desde» vem da fonte, e o texto fala como plataforma", () => {
    expect(ESVAZIAMENTO_NA_LANDING.desde).toBe(PRECOS.esvaziamento_casa.minimo);
    const textos = [ESVAZIAMENTO_NA_LANDING.titulo, ...ESVAZIAMENTO_NA_LANDING.incluido, ...ESVAZIAMENTO_NA_LANDING.passos].join(" ");
    expect(textos).not.toMatch(/profissional|próprio dia|contentor|big ?bag|entulho/i);
    // A frase do WhatsApp começa como a do anúncio, para se contarem juntas.
    expect(ESVAZIAMENTO_NA_LANDING.mensagem.startsWith("Olá! Encontrei-vos no Google")).toBe(true);
  });
});
