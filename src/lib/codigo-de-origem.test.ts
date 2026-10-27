import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  codigoDeOrigem,
  comCodigoDeOrigem,
  lerCodigoDeOrigem,
  numeroDaPagina,
  origemDaConversa,
  separarCodigoDeOrigem,
} from "./codigo-de-origem";

/*
 * «Vamos tentar colocar uma forma bem subtil de dizer a origem, nem que seja
 * em números» — o dono, 22-10-2026.
 */
const agora = "2026-10-22T12:00:00.000Z";
const OLA = "Olá! Gostava de pedir um orçamento à CLYON.";

describe("o código de origem na mensagem do WhatsApp", () => {
  it("a letra diz por onde chegou", () => {
    expect(codigoDeOrigem({ utm_source: "google", utm_medium: "cpc", quando: agora }, "/orcamento-recolha-lisboa")).toBe("A1");
    expect(codigoDeOrigem({ utm_source: "google.com", utm_medium: "organic", quando: agora }, "/")).toBe("G2");
    expect(codigoDeOrigem({ utm_source: "l.facebook.com", utm_medium: "referral", quando: agora }, "/simulador")).toBe("F3");
    expect(codigoDeOrigem({ utm_source: "instagram.com", utm_medium: "referral", quando: agora }, "/precos")).toBe("I4");
    expect(codigoDeOrigem({ utm_source: "fixando.pt", utm_medium: "referral", quando: agora }, "/contactos")).toBe("O5");
    expect(codigoDeOrigem(null, "/recolha-de-sofas")).toBe("D6");
  });

  it("o número diz a página onde carregou", () => {
    expect(numeroDaPagina("/recolha-de-moveis-almada")).toBe(7);
    expect(numeroDaPagina("/blog/quanto-custa")).toBe(8);
    expect(numeroDaPagina("/avaliacoes")).toBe(9);
    expect(numeroDaPagina("/termos")).toBe(0);
    expect(numeroDaPagina("/?x=1")).toBe(2);
  });

  it("vai no fim da mensagem, uma vez só", () => {
    expect(comCodigoDeOrigem(OLA, "A1")).toBe(`${OLA} (A1)`);
    expect(comCodigoDeOrigem(`${OLA} (D2)`, "A1")).toBe(`${OLA} (A1)`);
  });

  it("a Vitória lê sem ele", () => {
    expect(separarCodigoDeOrigem(`${OLA} (A1)`)).toEqual({ texto: OLA, codigo: "A1" });
    expect(separarCodigoDeOrigem("Moro no 2º andar")).toEqual({ texto: "Moro no 2º andar", codigo: null });
    expect(lerCodigoDeOrigem("A1")).toMatch(/^Anúncio do Google · Página do anúncio/);
  });

  it("o clique junta-o só nas conversas com a CLYON, e o cérebro tira-o", () => {
    const cliques = readFileSync("src/components/OrigemECliques.tsx", "utf8");
    // O número vem da constante única (telefone-da-clyon.ts, 27-10-2026).
    expect(cliques).toContain("const NOSSO_WHATSAPP = TELEFONE_DA_CLYON_DIGITOS;");
    expect(cliques).toContain("if (!href.includes(NOSSO_WHATSAPP)) return;");
    const neg = readFileSync("src/lib/whatsapp-negociacao.ts", "utf8").replace(/\r\n/g, "\n");
    const inicio = neg.slice(neg.indexOf("export async function tratarMensagemDoCliente("));
    expect(inicio.indexOf("separarCodigoDeOrigem(conteudo.texto)")).toBeGreaterThan(0);
    expect(inicio.indexOf("separarCodigoDeOrigem(conteudo.texto)")).toBeLessThan(inicio.indexOf("const soImagens"));
  });
});

describe("a origem da conversa no backoffice", () => {
  it("vem da primeira mensagem do cliente com código", () => {
    expect(
      origemDaConversa([
        { direccao: "out", texto: "Olá (D2)" },
        { direccao: "in", texto: "Olá! Gostava de pedir um orçamento à CLYON. (G7)" },
        { direccao: "in", texto: "(A1)" },
      ]),
    ).toBe("G7");
    expect(origemDaConversa([{ direccao: "in", texto: "Tenho 2 poltronas" }])).toBeNull();
    const painel = readFileSync("src/components/admin/AdminWhatsAppPanel.tsx", "utf8");
    expect(painel).toContain("<OrigemDaConversa mensagens={mensagens} />");
  });
});
