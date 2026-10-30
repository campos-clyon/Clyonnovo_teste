import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O TECLADO NÃO TAPA O QUE SE ESCREVE (ordem do CEO com o sim do dono,
 * 30-10-2026). A app é edge-to-edge: o Android não encolhe a janela, e o
 * KeyboardAvoidingView com «undefined» no Android não fazia nada. Este teste
 * lê o código e chumba qualquer ecrã com campos de texto que fique sem a
 * protecção de componentes/Teclado.tsx.
 */

const RAIZ = process.cwd();
const SRC = join(RAIZ, "app-cliente", "src");
const semComentarios = (s: string) => s.replace(/\r/g, "").replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
function ficheiros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? ficheiros(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}
const FONTES = ficheiros(SRC).map((p) => ({ p, nome: relative(SRC, p).replace(/\\/g, "/"), s: semComentarios(readFileSync(p, "utf8")) }));
const TEM_CAMPO = /<TextInput\b|<Campo\b/;
const PROTEGIDO = /<Ecra\b|<Folha\b|<RolagemComTeclado\b/;

describe("o teclado não tapa os campos da app de cliente", () => {
  it("nenhum ScrollView vertical fora do Teclado.tsx (usa-se RolagemComTeclado)", () => {
    const maus = FONTES.filter((f) => f.nome !== "componentes/Teclado.tsx").flatMap((f) =>
      [...f.s.matchAll(/(?<!\w)<ScrollView\b[^>]*>/g)].filter((m) => !/\bhorizontal\b/.test(m[0])).map(() => f.nome),
    );
    expect(maus).toEqual([]);
  });

  it("nenhum KeyboardAvoidingView que no Android não faz nada", () => {
    expect(FONTES.filter((f) => /KeyboardAvoidingView/.test(f.s)).map((f) => f.nome)).toEqual([]);
  });

  it("o TextInput da app sobe o campo em foco para cima do teclado", () => {
    const texto = FONTES.find((f) => f.nome === "componentes/Texto.tsx")!.s;
    expect(texto).toContain("useLevarAoTeclado()");
    expect(texto).toMatch(/onFocus=\{\(e\) => \{\s*levarAoTeclado\(proprio\.current\)/);
    // Todos os campos passam pelo TextInput da app, nunca pelo de react-native.
    const directos = FONTES.filter((f) => f.nome !== "componentes/Texto.tsx" && /import[^;]*\bTextInput\b[^;]*from "react-native"/.test(f.s));
    expect(directos.map((f) => f.nome)).toEqual([]);
  });

  it("a rolagem soma a altura do teclado e as folhas sobem com ele", () => {
    const teclado = FONTES.find((f) => f.nome === "componentes/Teclado.tsx")!.s;
    expect(teclado).toContain("paddingBottom: fundoBase + alturaDoTeclado");
    expect(teclado).toContain('Keyboard.addListener(MOSTRAR');
    const ui = FONTES.find((f) => f.nome === "componentes/ui.tsx")!.s;
    expect(ui).toContain('justifyContent: "flex-end", paddingBottom: alturaDoTeclado');
    expect(ui).toContain("<RolagemComTeclado semFolgaDoTeclado");
  });

  it("todos os ficheiros com campos de texto estão protegidos (ou só são usados dentro de um ecrã protegido)", () => {
    const comCampos = FONTES.filter((f) => TEM_CAMPO.test(f.s) && f.nome !== "componentes/ui.tsx" && f.nome !== "componentes/Texto.tsx");
    expect(comCampos.length).toBeGreaterThan(5);
    const naoProtegidos: string[] = [];
    const visto = new Set<string>();
    // Um componente sem rolagem própria está protegido se todos os que o usam o estão (recursivo).
    const protegido = (f: (typeof FONTES)[number]): boolean => {
      if (PROTEGIDO.test(f.s)) return true;
      if (visto.has(f.p)) return true;
      visto.add(f.p);
      const nome = basename(f.p).replace(/\.tsx?$/, "");
      const quemUsa = FONTES.filter((o) => o.p !== f.p && [...o.s.matchAll(/from "(\.[^"]+)"/g)].some((m) => resolve(dirname(o.p), m[1]) === f.p.replace(/\.tsx?$/, "")));
      if (quemUsa.length === 0) return false;
      return quemUsa.every((o) => new RegExp(`<${nome}\\b`).test(o.s) ? protegido(o) : true);
    };
    for (const f of comCampos) if (!protegido(f)) naoProtegidos.push(f.nome);
    expect(naoProtegidos).toEqual([]);
  });

  it("nenhum Modal próprio com campos de texto (usa-se a Folha, que sobe com o teclado)", () => {
    const maus = FONTES.filter((f) => f.nome !== "componentes/ui.tsx" && /<Modal\b/.test(f.s) && TEM_CAMPO.test(f.s));
    expect(maus.map((f) => f.nome)).toEqual([]);
  });

  it("a barra de baixo flutuante esconde-se com o teclado aberto", () => {
    const barra = FONTES.find((f) => f.nome === "app/(app)/_layout.tsx")!.s;
    expect(barra).toMatch(/const alturaDoTeclado = useAlturaDoTeclado\(\);\s*if \(alturaDoTeclado > 0\) return null;/);
  });
});

describe("a app Pro tem a mesma protecção", () => {
  const PRO = join(RAIZ, "app-pro", "src");
  const fontes = ficheiros(PRO).map((p) => ({ nome: relative(PRO, p).split("\\").join("/"), s: semComentarios(readFileSync(p, "utf8")) }));
  it("nenhum ScrollView vertical nem KeyboardAvoidingView fora do Teclado.tsx", () => {
    const maus = fontes
      .filter((f) => f.nome !== "componentes/Teclado.tsx")
      .filter((f) => /KeyboardAvoidingView/.test(f.s) || [...f.s.matchAll(/(?<!\w)<ScrollView[^>]*>/g)].some((m) => !m[0].includes("horizontal")));
    expect(maus.map((f) => f.nome)).toEqual([]);
  });
  it("o TextInput da Pro sobe o campo em foco e a barra esconde-se com o teclado", () => {
    const texto = fontes.find((f) => f.nome === "componentes/Texto.tsx")!.s;
    expect(texto).toContain("levarAoTeclado(proprio.current)");
    expect(fontes.find((f) => f.nome === "app/(app)/_layout.tsx")!.s).toContain("tabBarHideOnKeyboard: true");
  });
});
