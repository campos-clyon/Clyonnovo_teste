import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { falaDoModeloAntigo } from "./palavras-do-modelo-antigo";
import { NOVO_MODELO_DESDE_POR_EXTENSO } from "./novo-modelo";

/**
 * OS TERMOS E A PRIVACIDADE DE 15-11-2026 — d10 (Jurídico; CEO e dono).
 *
 * As duas páginas desenham-se nos dois lados da data, com o relógio do modelo
 * (`relogio-do-modelo.ts`) a fingir o dia:
 *
 *   · a 14-11, nada do modelo novo — é a página de 12-11, tal e qual;
 *   · a 15-11, o texto novo, e as palavras do modelo antigo (a caução, o
 *     «cativo», a CLYON a receber ou a guardar o pagamento, o cliente a pagar à
 *     CLYON ou «pela plataforma») só dentro da caixa das regras anteriores, que
 *     continua a valer para os trabalhos já pagos à CLYON antes da data.
 */

// Nos testes o JSX das páginas sai como `React.createElement`.
(globalThis as { React?: typeof React }).React = React;

let agora = new Date("2026-11-14T12:00:00Z");
vi.mock("@/lib/relogio-do-modelo", () => ({ agoraDoModelo: () => agora }));
vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  taxasActuais: async () => ({ cliente: 0, profissional: 0.1 }),
}));

const texto = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");

/** A página sem a caixa das regras anteriores (a única que pode falar do antigo). */
const semAsRegrasAnteriores = (html: string) => html.replace(/<div data-regras-anteriores=""[\s\S]*?<\/div>/g, " ");

async function termos(): Promise<string> {
  const mod = await import("@/app/termos/page");
  return renderToStaticMarkup(await mod.default());
}
async function privacidade(): Promise<string> {
  const mod = await import("@/app/privacidade/page");
  return renderToStaticMarkup(React.createElement(mod.default));
}

describe("os Termos e a Privacidade nos dois lados de 15-11-2026", () => {
  beforeEach(() => {
    agora = new Date("2026-11-14T12:00:00Z");
  });

  it("a 14-11 os Termos são os de 12-11: nada do modelo novo", { timeout: 120_000 }, async () => {
    const html = await termos();
    const t = texto(html);
    expect(t).toContain("Última atualização: 12 de novembro de 2026.");
    expect(html).not.toContain("data-regras-anteriores");
    for (const novo of ["Em vigor desde", "valor em atraso", "Stand-by", "Paga diretamente ao parceiro", "duas faturas"]) {
      expect(t, novo).not.toContain(novo);
    }
    // O texto de sempre está lá.
    expect(t).toContain("Pela plataforma.");
    expect(t).toContain("Há fatura em todas as vendas.");
  });

  it("a 15-11 os Termos dizem o modelo novo, e o antigo só na caixa das regras anteriores", { timeout: 120_000 }, async () => {
    agora = new Date("2026-11-15T00:00:00Z");
    const html = await termos();
    const t = texto(html);
    expect(t).toContain(`Em vigor desde ${NOVO_MODELO_DESDE_POR_EXTENSO}`);
    expect(t).toContain("Paga diretamente ao parceiro que contratou.");
    expect(t).toContain("Cada trabalho tem duas faturas");
    expect(t).toContain("valor em atraso");
    expect(t).toContain("Stand-by.");
    expect(t).toContain("Pagar o valor em atraso");
    // O corte do código (CORTE_DO_MODELO = "ja_pago_a_clyon"): o que segue o antigo é o já pago à CLYON.
    expect(t).toContain("Os trabalhos já pagos à CLYON antes dessa data");
    expect(t).not.toContain("contratados antes de");
    // As regras anteriores não se apagam: ficam na caixa (§7, §7-A e §10).
    expect((html.match(/data-regras-anteriores/g) ?? []).length).toBe(3);
    expect(t).toContain("Se pagou por transferência, devolvemos por transferência");
    // Fora da caixa, nenhuma palavra do modelo antigo.
    const fora = texto(semAsRegrasAnteriores(html));
    expect(falaDoModeloAntigo(fora, "cliente")).toBeNull();
    expect(fora).not.toContain("Há fatura em todas as vendas.");
    expect(fora).not.toMatch(/em d[íi]vida/);
  });

  it("a 14-11 a Privacidade é a de 12-11; a 15-11, o IBAN ao cliente e o euPago só para a taxa", { timeout: 120_000 }, async () => {
    const antes = texto(await privacidade());
    expect(antes).toContain("Última atualização: 12 de novembro de 2026.");
    for (const novo of ["Em vigor desde", "Pagamento ao parceiro:", "valor em atraso", "O cliente que contrata um parceiro"]) {
      expect(antes, novo).not.toContain(novo);
    }

    agora = new Date("2026-11-15T09:00:00Z");
    const depois = texto(await privacidade());
    expect(depois).toContain(`Em vigor desde ${NOVO_MODELO_DESDE_POR_EXTENSO}`);
    expect(depois).toContain("Pagamento ao parceiro:");
    expect(depois).toContain("O cliente que contrata um parceiro");
    expect(depois).toContain("com que os parceiros pagam a taxa da plataforma");
    expect(depois).not.toContain("os pagamentos feitos pela plataforma são recebidos pela CLYON");
    expect(depois).not.toContain("referências das dívidas");
  });
});
