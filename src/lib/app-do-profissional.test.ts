import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O painel do profissional instala-se no telemóvel — um PWA, não uma app.
 *
 * Um ícone no ecrã inicial que abre os trabalhos dele a ecrã inteiro, sem
 * barra do browser. Sem loja, sem binário para manter, e sempre na versão do
 * último deploy — que é o que uma equipa de uma pessoa consegue sustentar.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const MANIFEST = JSON.parse(ler("public/app-profissionais.webmanifest")) as Record<string, unknown>;
const LAYOUT = ler("src/app/profissionais/layout.tsx");
const INSTALAR = ler("src/components/portal/InstalarNoTelemovel.tsx");
const PAINEL = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");

describe("o manifest da área do profissional", () => {
  it("abre no painel e fica confinado a /profissionais", () => {
    /*
     * O âmbito importa: instalar "o site CLYON" daria ao profissional um
     * atalho para a homepage de clientes. Confinado, navegar no painel fica
     * dentro da "app" e sair dela abre o browser normal.
     */
    expect(MANIFEST.start_url).toBe("/profissionais/painel");
    expect(MANIFEST.scope).toBe("/profissionais");
    expect(MANIFEST.display).toBe("standalone");
  });

  it("aponta a ícones que existem", () => {
    const icones = MANIFEST.icons as Array<{ src: string }>;
    for (const i of icones) {
      expect(() => ler(join("public", i.src)), `${i.src} não existe`).not.toThrow();
    }
  });

  it("o layout liga o manifest e o modo app do iPhone", () => {
    expect(LAYOUT).toContain('manifest: "/app-profissionais.webmanifest"');
    expect(LAYOUT).toContain("appleWebApp");
  });

  it("sem cache offline, de propósito", () => {
    /*
     * O sw.js existe — mas só para Web Push. Se algum dia ganhar um handler
     * de fetch com cache, o painel passa a poder mentir offline: pedidos
     * velhos com cara de actuais. Este teste é o alarme.
     */
    const SW = ler("public/sw.js");
    expect(SW).not.toContain('addEventListener("fetch"');
    expect(SW).not.toContain("caches.open");
  });
});

describe("a linha de instalar no menu", () => {
  it("existe no painel", () => {
    expect(PAINEL).toContain("<InstalarNoTelemovel />");
  });

  it("usa o diálogo nativo quando o browser o dá, guia visual quando não", () => {
    // O beforeinstallprompt pode nunca disparar (iPhone nunca o tem) — a
    // linha não pode depender dele para existir.
    expect(INSTALAR).toContain("beforeinstallprompt");
    expect(INSTALAR).toContain("Adicionar ao ecrã principal");
  });

  it("o guia é visual e só do aparelho da pessoa", () => {
    /*
     * No iPhone NÃO EXISTE forma programática de adicionar ao ecrã — nenhum
     * site consegue, por decisão da Apple. O tecto é um guia; a diferença
     * entre um bom e um mau é quem o consegue seguir. Passos numerados com os
     * ÍCONES VERDADEIROS desenhados — reconhecer em vez de ler — e só o
     * caminho do aparelho detectado, sem obrigar a escolher entre dois.
     */
    expect(INSTALAR).toContain("IconePartilharIos");
    expect(INSTALAR).toContain("IconeTresPontos");
    expect(INSTALAR).toContain('"ios" | "android" | "computador"');
    expect(INSTALAR).toContain("siga estes 3 passos");
  });

  it("desaparece quando já está instalada", () => {
    // Convidar a instalar o que já está instalado é ruído.
    expect(INSTALAR).toContain('matchMedia("(display-mode: standalone)")');
    expect(INSTALAR).toContain("if (instalado) return null;");
  });
});
