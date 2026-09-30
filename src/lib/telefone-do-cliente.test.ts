import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  problemaDoTelefone,
  telefoneDoClienteValido,
  juntarIndicativo,
  MENSAGENS_DO_TELEFONE,
} from "./telefone-do-cliente";

/**
 * O telefone de quem pede um orçamento — e o que o site aceita como tal.
 *
 * Os formulários públicos e as rotas deixavam passar qualquer texto. Para quem
 * não deixa email, o telefone é o único caminho até ele.
 */

describe("números portugueses", () => {
  it("nove dígitos a começar por 9, 2 ou 3, com ou sem indicativo e espaços", () => {
    for (const t of [
      "912345678",
      "912 345 678",
      "212 345 678",
      "300 123 456",
      "+351912345678",
      "+351 912 345 678",
      "00351 912 345 678",
      "351912345678",
      "912-345-678",
      " 912345678 ",
    ]) {
      expect(telefoneDoClienteValido(t), t).toBe(true);
    }
  });

  it("recusa os que não chegam a ser um número", () => {
    for (const t of ["12345", "812345678", "0912345678", "91234567", "9123456789"]) {
      expect(telefoneDoClienteValido(t), t).toBe(false);
    }
  });

  it("um +351 com o resto errado não passa por estrangeiro", () => {
    expect(problemaDoTelefone("+351 12345")).toBe(MENSAGENS_DO_TELEFONE.portugues);
    expect(problemaDoTelefone("+35112345678")).toBe(MENSAGENS_DO_TELEFONE.portugues);
  });

  it("sem indicativo, a mensagem lembra que os de fora levam o deles", () => {
    expect(problemaDoTelefone("20 7946 0958")).toBe(MENSAGENS_DO_TELEFONE.semIndicativo);
  });
});

describe("números de fora", () => {
  it("com + ou 00 e 8 a 15 dígitos", () => {
    for (const t of ["+44 20 7946 0958", "+447911123456", "0033 6 12 34 56 78", "+1 (415) 555-0132", "+55 11 91234 5678"]) {
      expect(telefoneDoClienteValido(t), t).toBe(true);
    }
  });

  it("recusa os curtos e os compridos demais", () => {
    expect(problemaDoTelefone("+44 1234")).toBe(MENSAGENS_DO_TELEFONE.estrangeiro);
    expect(problemaDoTelefone("+1234567890123456")).toBe(MENSAGENS_DO_TELEFONE.estrangeiro);
  });
});

describe("o que não é telefone", () => {
  it("vazio, letras e emails colados no sítio errado", () => {
    expect(problemaDoTelefone("")).toBe(MENSAGENS_DO_TELEFONE.falta);
    expect(problemaDoTelefone(null)).toBe(MENSAGENS_DO_TELEFONE.falta);
    expect(problemaDoTelefone("abc")).toBe(MENSAGENS_DO_TELEFONE.caracteres);
    expect(problemaDoTelefone("ana@exemplo.pt")).toBe(MENSAGENS_DO_TELEFONE.caracteres);
    expect(problemaDoTelefone("91234567a")).toBe(MENSAGENS_DO_TELEFONE.caracteres);
    expect(problemaDoTelefone("+351+351912345678")).toBe(MENSAGENS_DO_TELEFONE.caracteres);
  });

  it("não aceita mais do que a coluna guarda", () => {
    expect(problemaDoTelefone("+44 20 7946 0958            1234")).toBe(MENSAGENS_DO_TELEFONE.comprido);
  });
});

describe("juntarIndicativo — o formulário da página inicial", () => {
  it("junta os dois campos", () => {
    expect(juntarIndicativo("+351", "912 345 678")).toBe("+351912 345 678");
    expect(telefoneDoClienteValido(juntarIndicativo("+351", "912 345 678"))).toBe(true);
    expect(telefoneDoClienteValido(juntarIndicativo("+44", "7911 123456"))).toBe(true);
  });

  it("não duplica o indicativo de quem o escreveu no número", () => {
    expect(juntarIndicativo("+351", "+351 912 345 678")).toBe("+351 912 345 678");
    expect(juntarIndicativo("+351", "0044 7911 123456")).toBe("0044 7911 123456");
  });

  it("um indicativo sem o sinal de mais ganha-o", () => {
    expect(juntarIndicativo("44", "7911123456")).toBe("+447911123456");
    expect(juntarIndicativo("0044", "7911123456")).toBe("0044" + "7911123456");
  });
});

describe("as rotas públicas usam-no, e as outras não", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("o simulador, os contactos e a página inicial recusam com 400", () => {
    const PEDIDO = ler("src/app/api/simulador/pedido/route.ts");
    expect(PEDIDO).toContain("problemaDoTelefone(order.receiver?.phone)");
    const HERO = ler("src/app/api/hero-quote/route.ts");
    expect(HERO).toContain("problemaDoTelefone(telefoneFull)");
    const CONTACTO = ler("src/app/api/contact/route.ts");
    expect(CONTACTO).toContain("problemaDoTelefone(");
  });

  it("os formulários dizem o que está mal no próprio campo", () => {
    expect(ler("src/components/HeroQuoteForm.tsx")).toContain("problemaDoTelefone(");
    expect(ler("src/app/contactos/ContactosClient.tsx")).toContain("problemaDoTelefone(");
    expect(ler("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain("problemaDoTelefone(");
  });

  it("o backoffice e a ponte do WhatsApp ficam com a regra deles", () => {
    // Números que alguém confirmou ao telefone não passam por esta porta.
    expect(ler("src/app/api/admin/pedidos/criar/route.ts")).not.toContain("telefone-do-cliente");
    expect(ler("src/app/api/whatsapp/ponte/route.ts")).not.toContain("telefone-do-cliente");
  });
});
