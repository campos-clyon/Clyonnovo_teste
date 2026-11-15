import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * d39 (15-11-2026) — O VALOR ÚNICO NOS TERMOS DE 15-11. Para revisão de um
 * advogado. Onde se dizia que o cliente escolhe o parceiro, passa a dizer que
 * o parceiro é escolhido pelo cliente ou, quando o orçamento é enviado em
 * valor único, pela CLYON, entre os parceiros verificados que propuseram. Os
 * Termos de antes de 15-11 ficam como estavam.
 */

(globalThis as { React?: typeof React }).React = React;

let agora = new Date("2026-11-15T12:00:00Z");
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

async function termos(): Promise<string> {
  const mod = await import("@/app/termos/page");
  return texto(renderToStaticMarkup(await mod.default()));
}

describe("d39 — quem escolhe o parceiro, nos Termos", () => {
  it("a 15-11: o cliente ou, em valor único, a CLYON, entre os verificados que propuseram", { timeout: 120_000 }, async () => {
    agora = new Date("2026-11-15T12:00:00Z");
    const t = await termos();
    expect(t).toContain(
      "o parceiro, que é escolhido por si ou, quando o orçamento é enviado em valor único, pela CLYON, entre os parceiros verificados que propuseram. A CLYON não é parte nesse contrato.",
    );
    expect(t).toContain("sem a lista das propostas nem os nomes de quem as fez");
    expect(t).toContain("salvo quando o cliente nos pede que o façamos ou quando o orçamento é enviado em valor único");
    expect(t).not.toContain("o parceiro que escolher. A CLYON não é parte");
    expect(t).toContain("Última atualização: 15 de novembro de 2026.");
  });

  it("a 14-11 o texto de 12-11 fica tal e qual", { timeout: 120_000 }, async () => {
    agora = new Date("2026-11-14T12:00:00Z");
    const t = await termos();
    expect(t).toContain("O contrato de prestação de serviço é celebrado entre si e o parceiro que escolher. A CLYON não é parte nesse contrato.");
    expect(t).not.toContain("valor único");
    expect(t).not.toContain("Última atualização: 15 de novembro");
  });
});
