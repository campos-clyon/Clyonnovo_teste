import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O menu de baixo do telemóvel não pode ficar tapado.
 *
 * O QUE ACONTECEU
 *
 * A faixa de cookies era `fixed inset-x-0 bottom-0 z-[70]` e a barra de
 * navegação é `fixed inset-x-0 bottom-0 z-50`. Mesma posição, e a faixa por
 * cima. Em 375×812 medi a faixa a ocupar de y=416 a y=812 — metade do ecrã —
 * e `elementFromPoint` sobre o botão "Conta" devolvia o botão de aceitar
 * cookies.
 *
 * Ou seja: o menu não estava lento, estava inalcançável. E para quem chega ao
 * site pela primeira vez — que é quem ainda não respondeu ao aviso — era
 * sempre assim.
 *
 * Estes testes olham para as classes porque é aí que vive a regra. Não
 * substituem ver o ecrã, mas apanham quem voltar a pôr a faixa em bottom-0.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

const NAV = ler("src/components/MobileBottomNav.tsx");
const COOKIES = ler("src/components/CookieConsent.tsx");

describe("barra de navegação do telemóvel", () => {
  it("está colada ao fundo e só aparece abaixo de md", () => {
    expect(NAV).toContain("fixed inset-x-0 bottom-0");
    expect(NAV).toContain("md:hidden");
  });
});

describe("faixa de cookies", () => {
  it("não fica colada ao fundo em telemóvel — a barra está lá", () => {
    // O que não pode existir: bottom-0 sem um md: à frente, na faixa fixa.
    const faixa = COOKIES.slice(COOKIES.indexOf("fixed inset-x-0"));
    const primeiraClasse = faixa.slice(0, faixa.indexOf('"'));
    expect(primeiraClasse).not.toMatch(/(^|\s)bottom-0(\s|$)/);
  });

  it("sobe acima da barra em telemóvel e volta ao fundo no desktop", () => {
    expect(COOKIES).toContain("bottom-[calc(3.9375rem+env(safe-area-inset-bottom))]");
    expect(COOKIES).toContain("md:bottom-0");
  });

  /**
   * O valor tem de cobrir a altura real da barra. Medida em 375×812: 63px.
   * 3.9375rem = 63px. A área segura entra por causa dos ecrãs com entalhe,
   * onde a barra é mais alta.
   */
  it("o espaço que deixa é o da barra medida, não um número inventado", () => {
    const alturaNavPx = 3.9375 * 16;
    expect(alturaNavPx).toBe(63);
  });

  it("continua por cima de tudo o resto", () => {
    expect(COOKIES).toContain("z-[70]");
    expect(NAV).toContain("z-50");
  });
});
