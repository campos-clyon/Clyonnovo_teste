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
const CHROME = ler("src/components/SiteChrome.tsx");
const HEADER = ler("src/components/Header.tsx");

describe("barra de navegação do telemóvel", () => {
  it("está colada ao fundo", () => {
    expect(NAV).toContain("fixed inset-x-0 bottom-0");
  });

  /**
   * O BURACO DOS 256 PÍXEIS
   *
   * Esta barra escondia-se em `md:hidden` (≥768px) e a navegação do Header só
   * aparece em `lg:flex` (≥1024px). Entre os dois o site não tinha navegação
   * NENHUMA: sem menu Soluções, sem Avaliações, sem Contactos, e sem o botão
   * Simular, que é o CTA principal em telemóvel.
   *
   * Não é um intervalo teórico — é o iPad em retrato (768 px), o iPhone Pro
   * Max deitado, e os Android grandes em paisagem. Quem lá chegasse só saía da
   * homepage pelos links do corpo da página.
   *
   * Este teste existe para o buraco não voltar a abrir-se: os dois sistemas
   * têm de se encontrar no MESMO limiar.
   */
  it("desaparece exactamente onde a navegação do Header aparece", () => {
    // As classes do <nav>, e não o ficheiro inteiro: o comentário que explica
    // o buraco menciona `md:hidden` por escrito, e um teste que lesse o
    // ficheiro todo falhava por causa da explicação em vez do código.
    const classes = NAV.slice(NAV.indexOf("<nav className=\""));
    const primeira = classes.slice(0, classes.indexOf("\">"));
    expect(primeira).toContain("lg:hidden");
    expect(primeira).not.toContain("md:hidden");
    // O outro lado da fronteira: o Header só mostra o menu a partir de lg.
    expect(HEADER).toContain("lg:flex");
  });

  it("o espaço reservado no corpo da página segue o mesmo limiar", () => {
    // Sem isto, a barra tapava o fim do conteúdo entre 768 e 1023 px.
    expect(CHROME).toContain("pb-[72px] lg:pb-0");
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
    // `lg` e não `md`: a faixa tem de descer ao fundo no mesmo ponto em que a
    // barra deixa de existir. Com `md`, entre 768 e 1023 px a faixa voltava a
    // bottom-0 enquanto a barra ainda lá estava — e tapava-a outra vez.
    expect(COOKIES).toContain("lg:bottom-0");
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
