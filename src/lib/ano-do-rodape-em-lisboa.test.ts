import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pecasEmLisboa } from "@/lib/hora-de-lisboa";

/*
 * O ANO DO RODAPÉ E O REACT #418 — 26-10-2026.
 *
 * O rodapé (componente do navegador, em todas as páginas públicas) fazia
 * `new Date().getFullYear()` ao desenhar-se: no fuso de quem olha e na hora da
 * visita, enquanto o HTML foi feito no servidor, antes. Num Chrome com o fuso
 * de Paris às 23h30 de 31 de Dezembro em Lisboa (já 1 de Janeiro em Paris), o
 * HTML dizia 2026 e o navegador 2027: «Minified React error #418» em /servicos
 * e /precos. Com o fuso de Lisboa, à mesma hora, não havia erro.
 *
 * Regra do dono: as horas e as datas do site são as de Lisboa, seja qual for o
 * fuso de quem vê. O ano conta-se uma vez, no servidor, na hora de Lisboa, e
 * vai ao rodapé por propriedade — o navegador recebe o número que está no HTML.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const FOOTER = semNotas(ler("src/components/Footer.tsx"));
const CHROME = semNotas(ler("src/components/SiteChrome.tsx"));
const LAYOUT = semNotas(ler("src/app/layout.tsx"));

describe("o ano do rodapé", () => {
  it("o rodapé não conta o ano no navegador", () => {
    expect(FOOTER).not.toMatch(/new Date\(/);
    expect(FOOTER).not.toMatch(/getFullYear\(/);
    expect(FOOTER).toMatch(/export default function Footer\(\{\s*ano\s*\}/);
    expect(FOOTER).toContain("© CLYON {ano}");
  });

  it("o layout conta-o no servidor, na hora de Lisboa, e passa-o ao rodapé", () => {
    expect(LAYOUT).toMatch(/const anoEmLisboa = pecasEmLisboa\(new Date\(\)\)\.ano;/);
    expect(LAYOUT).toMatch(/<SiteChrome anoEmLisboa=\{anoEmLisboa\}>/);
    expect(CHROME).toMatch(/<Footer ano=\{anoEmLisboa\} \/>/);
  });

  it("na passagem de ano vale Lisboa, não o fuso de quem olha", () => {
    // 31-12 às 23h30 em Lisboa (WET = UTC) — em Paris já é 1 de Janeiro.
    expect(pecasEmLisboa(new Date("2026-12-31T23:30:00Z")).ano).toBe(2026);
    // Meia-noite em Lisboa — ano novo, e só aqui.
    expect(pecasEmLisboa(new Date("2027-01-01T00:00:00Z")).ano).toBe(2027);
    // Em Paris (UTC+1) às 23h30 de 31-12 ainda é 31 em Lisboa (22h30).
    expect(pecasEmLisboa(new Date("2026-12-31T22:30:00Z")).ano).toBe(2026);
  });
});

describe("o resto do esqueleto público também não lê o relógio ao desenhar", () => {
  // O que está em todas as páginas públicas, à volta do conteúdo. Lidas as
  // horas, os dias ou o acaso aqui, o HTML e o navegador voltam a divergir.
  const ESQUELETO = [
    "src/components/SiteChrome.tsx",
    "src/components/Header.tsx",
    "src/components/Footer.tsx",
    "src/components/MobileBottomNav.tsx",
    "src/components/HeaderLocationSelector.tsx",
    "src/components/UserAvatar.tsx",
    "src/components/DeferredCookieConsent.tsx",
    "src/components/OrigemECliques.tsx",
    "src/components/PageViewTracker.tsx",
  ];

  it.each(ESQUELETO)("%s", (ficheiro) => {
    const fonte = semNotas(ler(ficheiro));
    expect(fonte).not.toMatch(/\.(getFullYear|getMonth|getDate|getDay|getHours|getMinutes)\(/);
    expect(fonte).not.toMatch(/Math\.random\(/);
    expect(fonte).not.toMatch(/new Date\(/);
  });
});
