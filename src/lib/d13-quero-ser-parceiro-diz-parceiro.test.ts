import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { O_QUE_A_CLYON_NAO_FAZ, passosDoProfissionalDoModelo } from "./como-funciona-para-o-profissional";

/**
 * REGRA (d13, 27-11-2026): a página /quero-ser-parceiro chama «parceiro» a quem
 * faz o trabalho — nunca «profissional». Vale para o texto que se vê: os
 * identificadores, os caminhos (/profissionais/entrar) e os comentários ficam.
 * Os passos e «o que a CLYON não faz» vêm de como-funciona-para-o-profissional.ts.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

function semComentarios(codigo: string): string {
  return codigo
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/** Tira o que não é texto visto: palavras que levam «profission» agarradas a identificadores e caminhos. */
function textoVisto(codigo: string): string {
  return semComentarios(codigo).replace(/[\w$./-]*[Pp]rofission[\w$./-]*/g, (m) => (/^profissionais?$/i.test(m) ? m : ""));
}

describe("/quero-ser-parceiro diz «parceiro»", () => {
  it("a página não escreve «profissional» no texto que se vê", () => {
    const visto = textoVisto(ler("src/app/quero-ser-parceiro/page.tsx"));
    expect(visto.match(/profissiona(l|is)/gi) ?? []).toEqual([]);
  });

  it("os passos e o «que a CLYON não faz» também não", () => {
    const textos = [
      ...passosDoProfissionalDoModelo(true).flatMap((p) => [p.titulo, p.texto]),
      ...passosDoProfissionalDoModelo(false).flatMap((p) => [p.titulo, p.texto]),
      ...O_QUE_A_CLYON_NAO_FAZ,
    ];
    for (const t of textos) expect(t).not.toMatch(/profissiona(l|is)/i);
  });

  it("o rodapé convida o parceiro, não o «profissional»", () => {
    expect(ler("src/components/Footer.tsx")).toContain("Sou parceiro");
  });
});
