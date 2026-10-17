import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/**
 * «O botão "Ver todos" está com o texto descentralizado» — o dono, 17-10-2026.
 *
 * Os outros botões da faixa da inicial são `inline-flex items-center` com
 * 44 px de altura; o «Ver todos» não tinha nem uma coisa nem outra, esticava
 * até à altura da linha e o texto ficava lá em cima.
 */
describe("o «Ver todos» da inicial", () => {
  it("alinha o texto como os outros botões da faixa", () => {
    const inicial = ler("src/app/page.tsx");
    const classes = inicial.match(/href="\/simulador"\s*className="([^"]+)"\s*>\s*Ver todos/)?.[1] ?? "";
    for (const c of ["inline-flex", "items-center", "min-h-[44px]"]) expect(classes, c).toContain(c);
  });
});

/**
 * «Acrescente entidade e referência, que temos via euPago» — o dono,
 * 17-10-2026. O «Multibanco» do rodapé já era a referência do euPago, mas
 * lia-se como cartão; diz-se o que é, numa linha só.
 */
describe("os pagamentos do rodapé", () => {
  it("dizem que o Multibanco é por entidade e referência", () => {
    const rodape = ler("src/components/Footer.tsx");
    expect(rodape).toContain('nome: "Multibanco: entidade e referência"');
    expect(rodape).not.toContain('nome: "Multibanco" }');
  });
});
