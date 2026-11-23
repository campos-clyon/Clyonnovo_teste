import { describe, it, expect } from "vitest";
import { mensagemWhatsApp, primeiroNome, rotuloServico } from "./mensagem-whatsapp";

describe("primeiroNome", () => {
  it("trata a pessoa pelo primeiro nome", () => {
    expect(primeiroNome("Amelia vaz")).toBe("Amelia");
    expect(primeiroNome("  glória  pinheiro ")).toBe("Glória");
  });

  /**
   * Escrever "Amélia" quando ela escreveu "Amelia" é corrigir a pessoa.
   * Pomos maiúscula na primeira letra e mais nada.
   */
  it("não inventa acentos que a pessoa não escreveu", () => {
    expect(primeiroNome("Amelia")).toBe("Amelia");
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
  // O pedido real da Amélia, #186
  const base = {
    id: 186,
    contactName: "Amelia vaz",
    serviceType: "recolha_moveis",
    address: "Rua Professor Augusto Valdeira",
    city: "Lisboa",
    urgency: "this_week",
    fotosRecebidas: 0,
  };

  it("usa o que foi recolhido, em vez da frase genérica", () => {
    const m = mensagemWhatsApp(base);
    expect(m).toContain("Olá Amelia");
    expect(m).toContain("recolha de móveis");
    expect(m).toContain("#186");
    expect(m).toContain("Rua Professor Augusto Valdeira");
    expect(m).toContain("esta semana");
  });

  it("nunca deixa passar o nome interno do serviço", () => {
    expect(mensagemWhatsApp(base)).not.toContain("recolha_moveis");
  });

  /**
   * Foi o que aconteceu com a Amélia: a mensagem automática não pedia fotos,
   * e a seguir foram duas mensagens à pressa a pedi-las.
   */
  it("sem fotos, pede-as — é isso que decide o orçamento", () => {
    const m = mensagemWhatsApp(base);
    expect(m.toLowerCase()).toContain("fotografias");
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

  /*
   * SEM PREÇO, E SEM A CLYON A ORÇAR — d91 (23-11-2026, 3.20). Quem dá o preço
   * são os parceiros; um valor manda-se pelo orçamento curto da Mesa.
   */
  it("nunca diz um preço, nem com o preço aprovado no pedido", () => {
    expect(mensagemWhatsApp(base)).not.toContain("€");
    expect(mensagemWhatsApp({ ...base, precoFinal: "160" })).not.toContain("€");
    expect(mensagemWhatsApp({ ...base, precoFinal: "160" })).not.toMatch(/orçamento é de/);
  });

  it("os parceiros dão o preço: sem «acertamos», sem «lhe dar um valor»", () => {
    const m = mensagemWhatsApp(base);
    expect(m).toContain(
      "Para os parceiros lhe darem um preço certo e sem surpresas no dia, pode enviar-nos por aqui 2 ou 3 fotografias do que é para levar?",
    );
    const perdidas = mensagemWhatsApp({ ...base, fotosNaoEnviadas: 2 });
    expect(perdidas).toContain("É com elas que os parceiros lhe dão um preço certo e sem surpresas no dia.");
    for (const t of [m, perdidas]) {
      expect(t).not.toMatch(/acertamos/);
      expect(t).not.toMatch(/lhe dar um valor/);
    }
  });

  it("começa por «é da equipa da CLYON», e nunca por «Aqui é a equipa da CLYON.» (a marca do «Pedir o que falta»)", () => {
    const m = mensagemWhatsApp(base);
    expect(m.startsWith("Olá Amelia, é da equipa da CLYON.")).toBe(true);
    expect(m).not.toContain("Aqui é a equipa da CLYON.");
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
    expect(m).toContain("Olá, é da equipa da CLYON.");
    expect(m).toContain("mudança (#9)");
    expect(m).not.toContain("undefined");
    expect(m).not.toContain("null");
    expect(m).not.toMatch(/,\s*\./);
  });
});
