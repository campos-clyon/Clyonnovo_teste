import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { numeroParaWhatsApp, linkDeWhatsApp } from "./link-de-whatsapp";

/**
 * O orçamento tem de chegar ao telemóvel certo.
 *
 * "Coloque nessa tela a opção de enviar o orçamento direto para o cliente."
 * — 11-09-2026.
 *
 * O que se guarda aqui não é o formato do link: é que um número mal montado
 * não abre uma conversa com outra pessoa. O `wa.me` aceita nove dígitos sem se
 * queixar e leva-os a um número de outro país — a mensagem sai, parece enviada,
 * e o cliente nunca a recebe.
 */

describe("os números como as pessoas os escrevem", () => {
  it("nove dígitos são portugueses e levam o indicativo", () => {
    expect(numeroParaWhatsApp("966190556")).toBe("351966190556");
  });

  it("espaços, traços e parênteses não são o número", () => {
    expect(numeroParaWhatsApp("966 190 556")).toBe("351966190556");
    expect(numeroParaWhatsApp("966-190-556")).toBe("351966190556");
    expect(numeroParaWhatsApp(" (+351) 966 190 556 ")).toBe("351966190556");
  });

  it("o +351 e o 00351 chegam ao mesmo sítio", () => {
    expect(numeroParaWhatsApp("+351966190556")).toBe("351966190556");
    expect(numeroParaWhatsApp("00351966190556")).toBe("351966190556");
  });

  it("o que não se percebe fica de fora, e não se adivinha", () => {
    /*
     * Um número a menos é um telefonema. Um número errado é uma mensagem com o
     * orçamento de um cliente a cair no telemóvel de um estranho.
     */
    expect(numeroParaWhatsApp("12345")).toBeNull();
    expect(numeroParaWhatsApp("96619055612345")).toBeNull();
    expect(numeroParaWhatsApp("")).toBeNull();
    expect(numeroParaWhatsApp(null)).toBeNull();
    expect(numeroParaWhatsApp(undefined)).toBeNull();
    expect(numeroParaWhatsApp("não tem")).toBeNull();
  });
});

describe("o link leva o texto escrito", () => {
  it("monta o endereço com a mensagem codificada", () => {
    const l = linkDeWhatsApp("966190556", "Olá João, 150 € + IVA");
    expect(l).toContain("https://wa.me/351966190556?text=");
    expect(l).toContain(encodeURIComponent("Olá João, 150 € + IVA"));
  });

  it("sem número que sirva, não há link — o ecrã mostra outro caminho", () => {
    expect(linkDeWhatsApp(null, "seja o que for")).toBeNull();
  });
});

describe("a mesa manda o orçamento num gesto", () => {
  const PAINEL = readFileSync(
    join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"),
    "utf8",
  );

  it("o botão existe e faz o percurso todo: link, mensagem, conversa", () => {
    expect(PAINEL).toContain("Enviar orçamento");
    expect(PAINEL).toContain("async function enviarOrcamento");
    expect(PAINEL).toContain("mensagemDasPropostas(");
    expect(PAINEL).toContain("linkDeWhatsApp(p.contactPhone, texto)");
  });

  it("não aparece quando não há proposta nenhuma para mandar", () => {
    // Um botão que promete um orçamento e abre uma mensagem vazia é pior do
    // que não existir.
    expect(PAINEL).toContain("propostasParaOCliente(p.negociacoes).length > 0 && (");
  });

  it("não envia sozinho — o último toque é de uma pessoa", () => {
    /*
     * `window.open` leva-o para dentro do WhatsApp com o texto escrito. Nenhuma
     * mensagem sai em nome da casa sem alguém a ter lido.
     */
    expect(PAINEL).toContain("A mensagem não sai sozinha");
  });

  it("o telemóvel do cliente chega ao painel — sem ele não há para onde mandar", () => {
    const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
    const i = DB.indexOf("export async function pedidosComNegociacoes");
    // A função é longa: da assinatura ao mapeamento vão cerca de 140 linhas.
    const corpo = DB.slice(i, i + 14000);
    expect(corpo).toContain("o.contactPhone");
    expect(corpo).toContain("contactPhone: (p.contactPhone as string) ?? null");
  });
});
