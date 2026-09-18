import { describe, it, expect } from "vitest";
import { assuntoDoEmail, linkDoWhatsApp, mensagemDaReferencia } from "./mensagem-da-referencia";

/**
 * *«Vamos colocar apenas para o admin gerar as referências e enviar
 * individualmente para cada pedido.»* — 18-09-2026.
 *
 * O texto vai para um WhatsApp de um cliente. Uma entidade e uma referência
 * soltas numa mensagem parecem burla — e são tratadas como tal.
 */

const BASE = {
  pedidoId: 341,
  valor: 105,
  cliente: "Inês Filipa Gomes",
} as const;

describe("a mensagem do Multibanco", () => {
  const texto = mensagemDaReferencia({
    ...BASE,
    metodo: "multibanco",
    entidade: "12345",
    referencia: "123456789",
    expiraEm: new Date("2026-09-21T12:00:00Z"),
  });

  it("diz a que pedido pertence — senão parece burla", () => {
    expect(texto).toContain("#341");
    expect(texto).toContain("CLYON");
  });

  it("leva a entidade, a referência e o valor, cada um na sua linha", () => {
    expect(texto).toContain("Entidade: 12345");
    expect(texto).toContain("Referência: 123456789");
    expect(texto).toContain("Valor: 105,00 €");
    // Cada um sozinho na linha: é o que se copia, muitas vezes num telemóvel.
    for (const linha of ["Entidade: 12345", "Referência: 123456789"]) {
      expect(texto.split("\n")).toContain(linha);
    }
  });

  /*
   * ⚠️ Uma referência de valor fixo RECUSA qualquer outro montante, e o
   * homebanking não explica porquê. Sem este aviso, a mensagem seguinte é uma
   * chamada a perguntar o que se passou.
   */
  it("avisa que o valor tem de ser exacto", () => {
    expect(texto).toContain("valor exacto");
  });

  it("diz até quando vale", () => {
    expect(texto).toContain("21/09/2026");
  });

  it("trata o cliente pelo primeiro nome", () => {
    expect(texto.startsWith("Boa tarde, Inês!")).toBe(true);
  });

  it("e sem nome não fica com um espaço pendurado", () => {
    const t = mensagemDaReferencia({ ...BASE, cliente: null, metodo: "multibanco" });
    expect(t.startsWith("Boa tarde!")).toBe(true);
  });
});

describe("a mensagem do MB WAY", () => {
  const texto = mensagemDaReferencia({
    ...BASE,
    metodo: "mbway",
    telemovel: "912345678",
  });

  it("não fala de entidade nem de referência — não há nenhuma", () => {
    expect(texto).not.toContain("Entidade");
    expect(texto).not.toContain("Referência:");
  });

  /*
   * Os cinco minutos são do MB WAY e não nossos. Dizê-los evita a pergunta
   * «não recebi nada» de quem foi buscar o telemóvel a outra divisão.
   */
  it("diz o prazo de cinco minutos e o que fazer se falhar", () => {
    expect(texto).toContain("5 minutos");
    expect(texto).toContain("enviamos outra vez");
  });

  it("diz para que número foi", () => {
    expect(texto).toContain("912345678");
  });
});

describe("o que tem de estar em todas", () => {
  /*
   * Obrigação do contrato do euPago: *«informar os seus Consumidores de que os
   * pagamentos são processados pela Eupago»*.
   */
  it("nomeia o euPago", () => {
    for (const metodo of ["mbway", "multibanco"] as const) {
      expect(mensagemDaReferencia({ ...BASE, metodo })).toContain("processados pelo euPago");
    }
  });

  it("explica o IVA quando o valor o inclui", () => {
    const com = mensagemDaReferencia({ ...BASE, metodo: "multibanco", comFactura: true });
    const sem = mensagemDaReferencia({ ...BASE, metodo: "multibanco" });
    expect(com).toContain("factura");
    expect(sem).not.toContain("inclui o IVA");
  });
});

describe("o link do WhatsApp", () => {
  it("põe o indicativo de Portugal num número de nove dígitos", () => {
    expect(linkDoWhatsApp("912345678", "olá")).toBe("https://wa.me/351912345678?text=ol%C3%A1");
  });

  it("respeita o indicativo quando já lá está", () => {
    expect(linkDoWhatsApp("+351 912 345 678", "x")).toContain("wa.me/351912345678");
    expect(linkDoWhatsApp("+5511999998888", "x")).toContain("wa.me/5511999998888");
  });

  it("sem número não inventa link nenhum", () => {
    for (const mau of [null, undefined, "", "12345"]) {
      expect(linkDoWhatsApp(mau, "x"), String(mau)).toBeNull();
    }
  });

  it("a mensagem vai escapada — os acentos e as quebras de linha sobrevivem", () => {
    const l = linkDoWhatsApp("912345678", "Entidade: 1\nReferência: 2")!;
    expect(l).toContain("%0A");
    expect(decodeURIComponent(l.split("?text=")[1])).toContain("Referência: 2");
  });
});

describe("o assunto do email", () => {
  it("diz o meio e o pedido", () => {
    expect(assuntoDoEmail(341, "multibanco")).toBe("CLYON — Multibanco para o pedido #341");
    expect(assuntoDoEmail(7, "mbway")).toBe("CLYON — MB WAY para o pedido #7");
  });
});
