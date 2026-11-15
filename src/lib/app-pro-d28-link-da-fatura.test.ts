import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enderecoDaFatura } from "../../app-pro/src/lib/novo-modelo";
import { ORIGEM_DO_SITE } from "../../app-cliente/src/lib/links";
import { ROTA_DA_FATURA } from "./faturas-do-trabalho-link";

/**
 * D28 NAS APPS — O LINK DA FATURA (15-11-2026).
 *
 * Desde a d28 o site manda as faturas do trabalho como link relativo da rota
 * de leitura (`/api/faturas-do-trabalho/<id>?ate=…&a=…`). O Android não abre um
 * caminho sem origem: a app Pro junta a do site (`SITE`, a mesma da API), como
 * a app de cliente já fazia com `abrirNoNavegador` (ORIGEM_DO_SITE).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("app Pro — a fatura abre-se com a origem do site", () => {
  const relativo = `${ROTA_DA_FATURA}/42?ate=abc123&a=${"x".repeat(32)}`;

  it("o link relativo da rota ganha a origem; o https antigo fica; o resto não abre", () => {
    expect(enderecoDaFatura(relativo, "https://clyon.pt")).toBe(`https://clyon.pt${relativo}`);
    expect(enderecoDaFatura(relativo, "https://clyon.pt/")).toBe(`https://clyon.pt${relativo}`);
    const antiga = "https://abc.public.blob.vercel-storage.com/f.pdf";
    expect(enderecoDaFatura(antiga, "https://clyon.pt")).toBe(antiga);
    expect(enderecoDaFatura(null, "https://clyon.pt")).toBeNull();
    expect(enderecoDaFatura("", "https://clyon.pt")).toBeNull();
    expect(enderecoDaFatura("//outro.site/x", "https://clyon.pt")).toBeNull();
    expect(enderecoDaFatura("http://outro.site/x", "https://clyon.pt")).toBeNull();
    expect(enderecoDaFatura("javascript:alert(1)", "https://clyon.pt")).toBeNull();
  });

  it("o ecrã abre o endereço com a origem, pela SITE da API, e não o url cru", () => {
    const F = semComentarios(ler("app-pro/src/componentes/FaturaDoTrabalho.tsx"));
    expect(F).toContain('import { enviarFicheiro, ErroDaApi, pedir, SITE } from "../lib/api";');
    expect(F).toContain("const endereco = enderecoDaFatura(url, SITE);");
    expect(F).toContain("Linking.openURL(endereco)");
    expect(F).not.toContain("Linking.openURL(url)");
  });
});

describe("app de cliente — as faturas já abrem pelo novo url", () => {
  it("abrirNoNavegador junta ORIGEM_DO_SITE a um caminho, e o bloco usa-o nas duas faturas", () => {
    expect(ORIGEM_DO_SITE).toBe("https://clyon.pt");
    const A = semComentarios(ler("app-cliente/src/lib/abrir.ts"));
    expect(A).toContain('caminhoOuEndereco.startsWith("https://") ? caminhoOuEndereco : `${ORIGEM_DO_SITE}${caminhoOuEndereco}`');
    const P = semComentarios(ler("app-cliente/src/componentes/PagarAoParceiro.tsx"));
    expect(P).toContain("abrirNoNavegador(visto.faturas?.doTrabalho?.url");
    expect(P).toContain("abrirNoNavegador(visto.faturas?.daTaxa?.url");
  });
});
