import { describe, it, expect } from "vitest";
import {
  MAX_DESCRICAO,
  MAX_ANEXOS,
  MAX_NOME_DE_ANEXO,
  MAX_MENSAGENS_DO_HISTORICO,
  MAX_TEXTO_DE_MENSAGEM,
  limitarCorpoDoPedido,
} from "./limites-do-pedido";
import { readFileSync } from "node:fs";

describe("limites do pedido do simulador", () => {
  it("corta a descrição, os anexos e o histórico", () => {
    const order: Record<string, unknown> = {
      description: "a".repeat(MAX_DESCRICAO + 500),
      files: Array.from({ length: MAX_ANEXOS + 10 }, () => ({ name: "n".repeat(MAX_NOME_DE_ANEXO + 50), url: "x" })),
    };
    const hist = Array.from({ length: MAX_MENSAGENS_DO_HISTORICO + 20 }, () => ({
      role: "user",
      content: "m".repeat(MAX_TEXTO_DE_MENSAGEM + 100),
    }));
    const r = limitarCorpoDoPedido(order, hist);
    expect((r.order.description as string).length).toBe(MAX_DESCRICAO);
    const files = r.order.files as Array<{ name: string }>;
    expect(files).toHaveLength(MAX_ANEXOS);
    expect(files[0].name.length).toBe(MAX_NOME_DE_ANEXO);
    const h = r.chatHistory as Array<{ content: string }>;
    expect(h).toHaveLength(MAX_MENSAGENS_DO_HISTORICO);
    expect(h[0].content.length).toBe(MAX_TEXTO_DE_MENSAGEM);
  });

  it("deixa passar um pedido normal sem mexer", () => {
    const r = limitarCorpoDoPedido(
      { description: "Sofá e colchão no 3.º andar", files: [{ name: "foto.jpg", url: "u" }] },
      [{ role: "user", content: "olá" }],
    );
    expect(r.order.description).toBe("Sofá e colchão no 3.º andar");
    expect(r.chatHistory).toEqual([{ role: "user", content: "olá" }]);
  });

  it("a rota aplica os limites antes de ler o pedido", () => {
    const src = readFileSync("src/app/api/simulador/pedido/route.ts", "utf8").replace(/\r/g, "");
    const i = src.indexOf("limitarCorpoDoPedido(");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(src.indexOf("problemaDoTelefone(order"));
    expect(src).toContain("chatJson: historico ?");
  });
});
