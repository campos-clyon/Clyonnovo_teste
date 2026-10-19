import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * AS FOTOGRAFIAS DA VIATURA NA FICHA DO BACKOFFICE — 19-10-2026.
 *
 * A ajuda do perfil, no painel e na app, diz ao profissional «É assim que
 * sabemos o que cabe». Ninguém na CLYON as via sem ir à base: a rota da lista
 * não lia as colunas, e a ficha só tinha o tipo de viatura. O dono escolheu
 * «Sim, na ficha» — miniaturas que abrem em grande, para o administrador e
 * para os assistentes, só para ver.
 *
 * ⚠️ Este ficheiro lê o código: o painel abre atrás de uma sessão.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const ROTA = semNotas(ler("src/app/api/admin/profissionais/route.ts"));
const PAINEL = semNotas(ler("src/components/admin/AdminProfissionaisPanel.tsx"));

describe("a rota da lista", () => {
  it("lê as duas colunas, e junta-as como o perfil as junta", () => {
    /*
     * A lista, ou só a antiga quando o perfil é de antes de 19-09-2026: é o
     * `lerFotos` que decide. Sem a antiga, quem pôs a fotografia nessa altura
     * aparecia sem nenhuma.
     */
    const i = ROTA.indexOf("SELECT");
    const j = ROTA.indexOf("FROM providers", i);
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    const colunas = ROTA.slice(i, j);
    expect(colunas).toMatch(/\bfotosViaturaJson\b/);
    expect(colunas).toMatch(/\bfotoViaturaUrl\b/);
    expect(ROTA).toContain("fotosViatura: lerFotos(");
  });

  it("e manda a lista, não as colunas", () => {
    // O JSON em bruto seguia em duplicado no `...p`, em quinhentas linhas.
    expect(ROTA).toContain("({ fotosViaturaJson, fotoViaturaUrl, ...p }) =>");
  });
});

describe("a ficha", () => {
  it("mostra-as todas, em miniatura", () => {
    expect(PAINEL).toContain("fotosDaViatura.map(");
    expect(PAINEL).toContain("<Miniatura");
  });

  it("abrem em grande no visor partilhado, a começar pela que se tocou", () => {
    expect(PAINEL).toContain("<VisorDeFotos");
    expect(PAINEL).toContain("setAVer({ lista: fotosDaViatura, i })");
    expect(PAINEL).toContain("indiceInicial={aVer.i}");
  });

  it("e são só para ver: o painel não tira nem põe nenhuma", () => {
    // Quem as muda é o profissional, no perfil. O envio e o apagar vivem em
    // /api/profissionais/foto-viatura, e o painel não lhe toca.
    expect(PAINEL).not.toContain("foto-viatura");
    expect(PAINEL).not.toContain('type="file"');
  });
});
