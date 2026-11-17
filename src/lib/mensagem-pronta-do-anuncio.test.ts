import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canalCurtoDoPedido, canalDoPedido, origemDoCodigoDoPedido } from "./canal-do-pedido";
import {
  MENSAGEM_PRONTA_DO_ANUNCIO,
  eAFraseDoAnuncio,
  lerCodigoDeOrigem,
  origemDaConversa,
  separarCodigoDeOrigem,
} from "./codigo-de-origem";

/*
 * d67, 17-11-2026: a mensagem pronta do WhatsApp no anúncio do Google Ads leva
 * «(A0)», e a frase de abertura do anúncio sem código também conta como Google
 * Ads. O backoffice mostra «Origem: Google Ads».
 */
const FRASE = "Olá! Encontrei-vos no Google e quero um orçamento de recolha. Vou enviar fotos.";

describe("a mensagem pronta do anúncio (d67)", () => {
  it("é a frase da página do anúncio, com «(A0)» no fim", () => {
    expect(MENSAGEM_PRONTA_DO_ANUNCIO).toBe(`${FRASE} (A0)`);
    const landing = readFileSync("src/app/orcamento-recolha-lisboa/LandingClient.tsx", "utf8");
    expect(landing).toContain(`const MENSAGEM_DO_ANUNCIO = "${FRASE}";`);
    expect(separarCodigoDeOrigem(MENSAGEM_PRONTA_DO_ANUNCIO)).toEqual({ texto: FRASE, codigo: "A0" });
  });

  it("uma conversa com «(A0)» aparece «Origem: Google Ads»", () => {
    const codigo = origemDaConversa([{ direccao: "in", texto: MENSAGEM_PRONTA_DO_ANUNCIO }]);
    expect(codigo).toBe("A0");
    expect(`Origem: ${lerCodigoDeOrigem(codigo!)}`).toMatch(/^Origem: Google Ads/);
  });

  it("a frase do anúncio sem código também é Google Ads", () => {
    expect(origemDaConversa([{ direccao: "in", texto: FRASE }])).toBe("A0");
    expect(origemDaConversa([{ direccao: "in", texto: "olá, encontrei vos no google, quanto custa um sofá?" }])).toBe("A0");
    expect(eAFraseDoAnuncio("ENCONTREI-VOS NO GOOGLE")).toBe(true);
    expect(eAFraseDoAnuncio("Encontrei um sofá no Google")).toBe(false);
  });

  it("com código, vale o código — a página do anúncio junta o seu", () => {
    expect(origemDaConversa([{ direccao: "in", texto: `${FRASE} (A1)` }])).toBe("A1");
    expect(origemDaConversa([{ direccao: "in", texto: `${FRASE} (G1)` }])).toBe("G1");
    expect(origemDaConversa([{ direccao: "out", texto: FRASE }])).toBeNull();
    expect(origemDaConversa([{ direccao: "in", texto: "Tenho 2 poltronas" }])).toBeNull();
  });

  it("o pedido criado dessa conversa diz Google Ads", () => {
    const raw = JSON.stringify({ codigoDeOrigem: "A0" });
    expect(canalDoPedido(raw)).toBe("Google Ads");
    expect(origemDoCodigoDoPedido(raw)).toMatch(/^Google Ads/);
    expect(canalCurtoDoPedido({ codigoDeOrigem: "A0" })).toBe("Google Ads");
  });

  it("o painel do WhatsApp e o cartão do pedido escrevem «Origem: »", () => {
    const painel = readFileSync("src/components/admin/AdminWhatsAppPanel.tsx", "utf8");
    expect(painel).toContain("const lida = codigo ? lerCodigoDeOrigem(codigo) : null;");
    expect(painel).toContain(`<span className="font-semibold text-slate-300">Origem: </span>`);
    const cartao = readFileSync("src/components/admin/PedidoDetailModal.tsx", "utf8");
    expect(cartao).toContain("Origem: {origemDoCodigoDoPedido(order.rawOrderJson)}");
  });
});
