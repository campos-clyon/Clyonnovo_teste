// relógio: datas explícitas (DEPOIS é uma data passada à função; nada lê a hora de hoje).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comoRecebeDoModelo, passosDoProfissional, passosDoProfissionalDoModelo } from "./como-funciona-para-o-profissional";

/**
 * d9 (27-11-2026): a CLYON Pro e o site dizem ao parceiro como recebe pelo mesmo
 * modelo — o que o servidor manda (`novoModelo`) na app, a data no site. No modelo
 * de 15-11-2026 o cliente paga ao parceiro: nenhum ecrã diz que o valor fica com
 * a CLYON, nem fala de levantamento.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const DEPOIS = new Date("2026-11-20T12:00:00Z");
const PROIBIDAS = [/o valor fica com a CLYON/i, /levantamento/i, /passa para a sua carteira/i, /fica retido/i];

describe("d9 — o «como funciona» do parceiro no modelo de 15-11", () => {
  it("nenhum passo nem «como recebe» diz que o valor fica com a CLYON, nem fala de levantamento", () => {
    const textos = [
      ...passosDoProfissionalDoModelo(true).map((p) => `${p.titulo} ${p.texto}`),
      ...comoRecebeDoModelo(true).map((r) => `${r.forma} ${r.texto}`),
      ...passosDoProfissional(DEPOIS).map((p) => `${p.titulo} ${p.texto}`),
    ];
    for (const t of textos) for (const re of PROIBIDAS) expect(t).not.toMatch(re);
  });

  it("o título do passo «recebe» já não diz «Recebe depois do trabalho feito»", () => {
    const recebe = passosDoProfissionalDoModelo(true).find((p) => p.chave === "recebe");
    expect(recebe?.titulo).toBe("O cliente paga-lhe diretamente, e a taxa da plataforma só existe se fechar");
    expect(recebe?.titulo).not.toContain("depois do trabalho feito");
    expect(recebe?.texto).toContain("O cliente paga-lhe diretamente");
  });

  it("os outros passos são os mesmos nos dois modelos", () => {
    const antes = passosDoProfissionalDoModelo(false);
    const depois = passosDoProfissionalDoModelo(true);
    expect(depois.map((p) => p.chave)).toEqual(antes.map((p) => p.chave));
    for (let i = 0; i < antes.length; i++) if (antes[i].chave !== "recebe") expect(depois[i]).toEqual(antes[i]);
  });

  it("a data e o servidor dão o mesmo", () => {
    expect(passosDoProfissional(DEPOIS)).toEqual(passosDoProfissionalDoModelo(true));
    expect(passosDoProfissional(new Date("2026-11-01T12:00:00Z"))).toBe(passosDoProfissionalDoModelo(false));
  });

  it("a app escolhe os passos pelo modelo do perfil, e as listas antigas já não se exportam", () => {
    const app = ler("app-pro/src/app/conta/como-funciona.tsx");
    expect(app).toContain("passosDoProfissionalDoModelo(perfil?.novoModelo != null)");
    expect(app).not.toMatch(/PASSOS_DO_PROFISSIONAL/);
    const fonte = ler("src/lib/como-funciona-para-o-profissional.ts");
    expect(fonte).not.toMatch(/export const (PASSOS_DO_PROFISSIONAL|COMO_RECEBE)\b/);
    expect(fonte).not.toMatch(/export function passoDaSeccao/);
  });
});
