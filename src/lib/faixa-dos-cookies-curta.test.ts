import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A FAIXA DOS COOKIES CURTA NO TELEMÓVEL — 15-10-2026.
 *
 * Tinha título, três linhas e três botões empilhados: tapava quase meio ecrã,
 * e no /simulador era o maior bloco a aparecer — o «carregamento» (LCP)
 * contava-se por ela, aos 2,6–2,9 s num telemóvel lento. No telemóvel fica uma
 * linha, a ligação à política e os botões lado a lado; no computador, igual.
 */
const FAIXA = readFileSync(join(process.cwd(), "src/components/CookieConsent.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("a faixa dos cookies no telemóvel", () => {
  it("uma linha e a política, só abaixo dos 640 px; o texto de sempre a partir daí", () => {
    expect(FAIXA).toContain('<div className="sm:hidden">');
    expect(FAIXA).toContain("Cookies de análise e marketing, só se aceitar.");
    expect(FAIXA).toContain('<div className="hidden sm:block">\n                  <p className="text-base font-semibold text-white">');
    // A linha cabe numa só no telemóvel: menos de 50 caracteres.
    expect("Cookies de análise e marketing, só se aceitar.".length).toBeLessThan(50);
  });

  it("os botões lado a lado, com o nome inteiro para quem não vê", () => {
    expect(FAIXA).toContain('className="grid grid-cols-3 gap-2 sm:flex sm:flex-row sm:gap-3');
    for (const nome of ["Gerir cookies", "Recusar cookies opcionais", "Aceitar cookies", "Guardar preferências"]) {
      expect(FAIXA).toContain(`aria-label="${nome}"`);
    }
    // As classes site-btn-* estão fora das camadas: só com «!» se lhes muda o tamanho.
    expect(FAIXA).toMatch(/const BOTAO_DA_FAIXA = "!px-2 !py-2\.5 !text-xs/);
  });
});
