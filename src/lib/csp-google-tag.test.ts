import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O GOOGLE TAG PRECISA DE MANDAR IMAGENS, E NÃO SÓ DE CARREGAR.
 *
 * O `www.googletagmanager.com` estava no script-src e no connect-src, mas não
 * no img-src: o gtag carregava e os pings dele em forma de imagem morriam na
 * política (visto na consola a 25-10-2026). A lista vem da página do Google
 * sobre CSP para o Google Ads (developers.google.com/tag-platform/security/
 * guides/csp) — só o que ela pede, sem curingas largos.
 */

const CFG = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

function diretiva(nome: string): string[] {
  const i = CFG.indexOf(`"${nome} `);
  expect(i, `${nome} não encontrado`).toBeGreaterThan(-1);
  const fim = CFG.indexOf('"', i + 1);
  expect(fim).toBeGreaterThan(i);
  return CFG.slice(i + 1, fim).split(/\s+/).slice(1);
}

// img-src da secção «Google Ads (Conversion, Remarketing, or Conversion
// Linker tag)». O googleads.g.doubleclick.net cabe no *.doubleclick.net que já
// lá estava; o www.google.<país> é o de Portugal.
const IMG_DO_GOOGLE_ADS = [
  "https://www.googletagmanager.com",
  "https://www.googleadservices.com",
  "https://pagead2.googlesyndication.com",
  "https://www.google.com",
  "https://www.google.pt",
];

describe("CSP — o Google tag do Ads", () => {
  it("o img-src deixa sair os pings do gtag", () => {
    const img = diretiva("img-src");
    for (const host of IMG_DO_GOOGLE_ADS) {
      expect(img, host).toContain(host);
    }
    // googleads.g.doubleclick.net
    expect(img).toContain("https://*.doubleclick.net");
  });

  it("sem curingas largos no img-src", () => {
    const img = diretiva("img-src");
    for (const fonte of img) {
      expect(fonte, fonte).not.toBe("*");
      expect(fonte, fonte).not.toBe("https:");
      expect(fonte, fonte).not.toMatch(/^https:\/\/\*\.(google|googletagmanager)\.[a-z]+$/);
    }
  });

  it("o gtag continua a carregar e a enviar", () => {
    expect(diretiva("script-src")).toContain("https://www.googletagmanager.com");
    expect(diretiva("connect-src")).toContain("https://www.googletagmanager.com");
  });
});
