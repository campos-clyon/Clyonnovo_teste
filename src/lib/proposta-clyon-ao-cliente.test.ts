import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { linkDaPropostaClyon, mensagemDaPropostaClyon, precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";

/**
 * A PROPOSTA DE UM TRABALHO CLYON, NO WHATSAPP DO CLIENTE — 08-10-2026.
 *
 * *«Crie um link que leva para o WhatsApp do cliente com uma mensagem com a
 * nossa proposta e valor final para pagar.»*
 *
 * O que se guarda: que o número a pagar é o com IVA, dito com o sem IVA ao
 * lado como em todo o site; que um trabalho sem preço ao cliente não manda
 * proposta nenhuma; e que o link só sai para um telemóvel que se perceba.
 */

// 8 de outubro, 10:00 em Lisboa — «Bom dia».
const AGORA = new Date("2026-10-08T09:00:00.000Z");

/** O #420 da captura: 330 € sem IVA, taxa de 20 %, o pro recebe 264 €. */
const T420 = {
  cliente: "João Rodrigues",
  telefone: "351961671460",
  servico: "recolha_moveis",
  localidade: "Lisboa",
  quando: "2026-10-12T09:00:00.000Z",
  valorFixo: 330,
  taxa: 0.2,
  precoAoCliente: 330,
};

describe("o preço", () => {
  it("num trabalho com taxa, o valor é o preço ao cliente sem IVA, e o IVA vai por cima", () => {
    const p = precoDaPropostaClyon(T420)!;
    expect(p.semIva).toBe(330);
    expect(p.iva).toBeCloseTo(75.9, 2);
    expect(p.total).toBeCloseTo(405.9, 2);
    expect(p.aPagar).toBe(p.total);
  });

  it("nos antigos o valor era o do pro: conta o preço ao cliente escrito à parte", () => {
    expect(precoDaPropostaClyon({ valorFixo: 150, taxa: null, precoAoCliente: 200 })!.total).toBeCloseTo(246, 2);
  });

  it("e sem ele não há proposta — não se inventa o preço de ninguém", () => {
    expect(precoDaPropostaClyon({ valorFixo: 150, taxa: null, precoAoCliente: null })).toBeNull();
    expect(linkDaPropostaClyon({ ...T420, taxa: null, precoAoCliente: null }, AGORA)).toBeNull();
  });
});

describe("a mensagem", () => {
  const texto = mensagemDaPropostaClyon({ ...T420, preco: precoDaPropostaClyon(T420)! }, AGORA);

  it("cumprimenta pelo primeiro nome e diz quem fala", () => {
    expect(texto.startsWith("Bom dia, João. Aqui é a CLYON.")).toBe(true);
    expect(texto).not.toContain("Rodrigues");
  });

  it("diz o quê, onde e quando", () => {
    expect(texto).toContain("A nossa proposta para a recolha de móveis em Lisboa, para segunda-feira, 12 de outubro, às 10:00:");
  });

  it("o valor final é o com IVA, com o sem IVA ao lado — nunca o sem IVA sozinho", () => {
    expect(texto).toContain("330,00 € + IVA = 405,90 € — é o valor final a pagar, já com IVA.");
  });

  it("sem link do site, como a mensagem das propostas desde 03-10-2026", () => {
    expect(texto).not.toMatch(/https?:\/\//);
    expect(texto).toContain("é só responder a esta mensagem");
  });

  it("um dia que já passou não se põe na proposta", () => {
    const antiga = mensagemDaPropostaClyon(
      { ...T420, quando: "2026-10-01T09:00:00.000Z", preco: precoDaPropostaClyon(T420)! },
      AGORA,
    );
    expect(antiga).toContain("A nossa proposta para a recolha de móveis em Lisboa:");
    expect(antiga).not.toContain("1 de outubro");
  });
});

describe("o link", () => {
  it("abre a conversa do cliente com a mensagem escrita, e diz o total ao botão", () => {
    const r = linkDaPropostaClyon(T420, AGORA)!;
    expect(r.link.startsWith("https://wa.me/351961671460?text=")).toBe(true);
    expect(decodeURIComponent(r.link.split("?text=")[1])).toContain("405,90 €");
    expect(r.total).toBeCloseTo(405.9, 2);
  });

  it("um telefone que não se percebe não dá link — não se adivinha a quem vai o preço", () => {
    expect(linkDaPropostaClyon({ ...T420, telefone: "12345" }, AGORA)).toBeNull();
    expect(linkDaPropostaClyon({ ...T420, telefone: null }, AGORA)).toBeNull();
  });
});

describe("o botão, no cartão do trabalho", () => {
  const PAGINA = readFileSync(join(process.cwd(), "src/components/admin/AdminTrabalhosClyonPanel.tsx"), "utf8").replace(
    /\r\n/g,
    "\n",
  );

  it("é um link para outro separador, e não um window.open que o browser bloqueia", () => {
    const i = PAGINA.indexOf("href={proposta.link}");
    expect(i).toBeGreaterThan(-1);
    const a = PAGINA.slice(PAGINA.lastIndexOf("<a", i), PAGINA.indexOf(">", i));
    expect(a).toContain('target="_blank"');
    expect(a).toContain('rel="noopener noreferrer"');
    expect(PAGINA).toContain("Enviar proposta ao cliente · {euros(proposta.total)}");
  });

  it("usa o dia marcado com o pro, ou o pedido — e num cancelado não aparece", () => {
    expect(PAGINA).toContain("linkDaPropostaClyon({ ...t, quando: a?.dataCombinada ?? t.dataAgendada }, new Date())");
    expect(PAGINA).toMatch(/r\.fase === "cancelada"\s*\?\s*null/);
  });
});
