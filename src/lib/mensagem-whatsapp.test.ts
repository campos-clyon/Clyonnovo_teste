import { describe, it, expect } from "vitest";
import { mensagemWhatsApp, primeiroNome, rotuloServico } from "./mensagem-whatsapp";

describe("primeiroNome", () => {
  it("trata a pessoa pelo primeiro nome", () => {
    expect(primeiroNome("Lucilia reis")).toBe("Lucilia");
    expect(primeiroNome("  natália  fernandes ")).toBe("Natália");
  });

  /**
   * Escrever "Lucília" quando ela escreveu "Lucilia" é corrigir a pessoa.
   * Pomos maiúscula na primeira letra e mais nada.
   */
  it("não inventa acentos que a pessoa não escreveu", () => {
    expect(primeiroNome("Lucilia")).toBe("Lucilia");
  });

  it("sem nome, não devolve lixo", () => {
    expect(primeiroNome(null)).toBe("");
    expect(primeiroNome("   ")).toBe("");
  });
});

describe("rotuloServico", () => {
  it("nunca mostra o nome interno da base ao cliente", () => {
    expect(rotuloServico("recolha_moveis")).toBe("recolha de móveis");
    expect(rotuloServico("esvaziamento_apartamento")).toBe("esvaziamento de apartamento");
  });

  it("um tipo desconhecido pelo menos perde os underscores", () => {
    expect(rotuloServico("recolha_especial_xpto")).toBe("recolha especial xpto");
    expect(rotuloServico(null)).toBe("serviço");
  });
});

describe("mensagemWhatsApp", () => {
  // O pedido real da Lucília, #186
  const base = {
    id: 186,
    contactName: "Lucilia reis",
    serviceType: "recolha_moveis",
    address: "Rua Professor Simões Raposo",
    city: "Lisboa",
    urgency: "this_week",
    fotosRecebidas: 0,
  };

  it("usa o que foi recolhido, em vez da frase genérica", () => {
    const m = mensagemWhatsApp(base);
    expect(m).toContain("Olá Lucilia");
    expect(m).toContain("recolha de móveis");
    expect(m).toContain("#186");
    expect(m).toContain("Rua Professor Simões Raposo");
    expect(m).toContain("esta semana");
  });

  it("nunca deixa passar o nome interno do serviço", () => {
    expect(mensagemWhatsApp(base)).not.toContain("recolha_moveis");
  });

  /**
   * Foi o que aconteceu com a Lucília: a mensagem automática não pedia fotos,
   * e a seguir foram duas mensagens à pressa a pedi-las.
   */
  it("sem fotos, pede-as — é isso que decide o orçamento", () => {
    const m = mensagemWhatsApp(base);
    expect(m.toLowerCase()).toContain("fotos");
  });

  it("se as fotos falharam a subir, diz que reparou e pede-as de volta", () => {
    const m = mensagemWhatsApp({ ...base, fotosNaoEnviadas: 5 });
    expect(m).toContain("5 fotos");
    expect(m).toContain("não chegaram");
  });

  it("com fotos recebidas, não as volta a pedir", () => {
    const m = mensagemWhatsApp({ ...base, fotosRecebidas: 3 });
    expect(m.toLowerCase()).not.toContain("pode enviar-nos aqui algumas fotos");
  });

  it("o preço só aparece quando existe", () => {
    expect(mensagemWhatsApp(base)).not.toContain("€");
    expect(mensagemWhatsApp({ ...base, precoFinalIva: "167.99" })).toContain("167,99 €");
  });

  /**
   * A morada gravada costuma já trazer a localidade. "Ericeira, Mafra,
   * Lisboa, Portugal, Lisboa" é o que sai de juntar os dois campos sem pensar.
   */
  it("não repete a localidade quando ela já vem na morada", () => {
    const m = mensagemWhatsApp({
      ...base,
      address: "Ericeira, Mafra, Lisboa, Portugal",
      city: "Lisboa",
    });
    expect(m).toContain("Ericeira, Mafra, Lisboa, Portugal");
    expect(m.match(/Lisboa/g)?.length).toBe(1);
  });

  it("com pouca informação, encurta em vez de dizer 'não indicado'", () => {
    const m = mensagemWhatsApp({ id: 9, serviceType: "mudanca" });
    expect(m).toContain("Olá, é da CLYON.");
    expect(m).toContain("mudança (#9)");
    expect(m).not.toContain("undefined");
    expect(m).not.toContain("null");
    expect(m).not.toMatch(/,\s*\./);
  });
});
