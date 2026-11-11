import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * A NOTA DO GOOGLE NO CARTÃO DA APP DE CLIENTE — 11-11-2026.
 * A app mostra o que a rota escreveu (`notaGoogle.texto`), com a atribuição,
 * noutra linha da nota da CLYON; sem a atribuição, não mostra.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("a nota do Google na app de cliente", () => {
  it("o cartão mostra o texto da rota e a atribuição", () => {
    const s = ler("app-cliente/src/componentes/CartaoDoParceiro.tsx");
    expect(s).toContain("p.notaGoogle.texto");
    expect(s).toContain("p.notaGoogle.atribuicao");
  });

  it("sem a atribuição, a nota não entra", () => {
    const s = ler("app-cliente/src/lib/parceiros-da-mudanca.ts");
    expect(s).toContain("notaGoogle: textoDoGoogle && atribuicao ? { texto: textoDoGoogle, atribuicao } : null");
  });
});
