import { describe, it, expect } from "vitest";
import { CONTACTO_ESCONDIDO, filtrarContactos, pareceTelefone } from "./filtro-de-contactos";

/**
 * O FILTRO DE CONTACTOS — decisão 2a do dono (30-10-2026): nas conversas de
 * um pedido os contactos ficam tapados, também depois do pagamento.
 */

const tapa = (s: string) => filtrarContactos(s);
const tapado = (s: string) => expect(tapa(s).texto).toContain(CONTACTO_ESCONDIDO);
const intacto = (s: string) => {
  const r = tapa(s);
  expect(r.filtrada).toBe(false);
  expect(r.texto).toBe(s);
};

describe("telefones portugueses", () => {
  it.each([
    "ligue-me 912345678",
    "o meu é 912 345 678",
    "912.345.678",
    "912-345-678",
    "91 234 56 78",
    "+351 912 345 678",
    "+351912345678",
    "00351 912345678",
    "00 351 912 345 678",
    "fixo 213 456 789",
    "(+351) 960-000-432",
    "9 1 2 3 4 5 6 7 8",
  ])("tapa «%s»", (s) => {
    const r = tapa(s);
    expect(r.filtrada).toBe(true);
    expect(r.texto).not.toMatch(/\d{3}/);
  });

  it("por extenso", () => {
    tapado("nove um dois três quatro cinco seis sete oito");
    tapado("Nove, um, dois, tres, quatro, cinco, seis, sete, oito");
    tapado("9 um 2 3 quatro 5 6 7 8");
  });

  it("números estrangeiros com prefixo", () => {
    tapado("+33 6 12 34 56 78");
    tapado("0033612345678");
  });

  it("dois números na mesma frase saem os dois", () => {
    const r = tapa("912345678 ou 960000432");
    expect(r.texto).not.toMatch(/\d/);
  });

  it("o texto à volta fica", () => {
    const r = tapa("Olá, ligue para 912 345 678 amanhã.");
    expect(r.texto).toBe(`Olá, ligue para ${CONTACTO_ESCONDIDO} amanhã.`);
  });
});

describe("emails, links e @utilizador", () => {
  it.each([
    "escreva para joao.silva@gmail.com",
    "joao arroba gmail ponto com",
    "joao (at) gmail . com",
    "joao [at] sapo [dot] pt",
    "veja https://exemplo.pt/x",
    "www.exemplo.com",
    "exemplo.pt",
    "wa.me/351912345678",
    "o meu insta é @joao.mudancas",
    "segue-me (@joao_99)",
  ])("tapa «%s»", (s) => {
    expect(tapa(s).filtrada).toBe(true);
    expect(tapa(s).texto).toContain(CONTACTO_ESCONDIDO);
  });

  it("o endereço da CLYON passa", () => {
    intacto("Pode ver em clyon.pt");
    intacto("https://clyon.pt/conta");
  });

  it("marcas seguidas juntam-se numa só", () => {
    const r = tapa("912345678 / joao@gmail.com");
    expect(r.texto.split(CONTACTO_ESCONDIDO).length).toBe(2);
  });
});

describe("o que NÃO é contacto fica como está", () => {
  it.each([
    "O valor é 452,03 € com IVA (367,50 € sem IVA)",
    "Fica por 120€ e mais 50 €",
    "Pedido #483 e #484",
    "Dia 30/10/2026 às 10:00",
    "Dia 29-10-2026 10h30",
    "Código postal 1000-001 Lisboa",
    "3 m³ de entulho, 2 sofás e 10 sacos",
    "São 4 andares, 25 kg cada saco, 1,30 por km",
    "Entre 40 e 50 euros, mínimo 3h",
    "taxa de 11 %",
    "Ano 2026, 2027",
    "Um sofá, dois colchões e três cadeiras",
    "",
  ])("«%s»", (s) => intacto(s));
});

describe("o original guarda-se para a equipa", () => {
  it("original intacto, filtrada marcada", () => {
    const s = "liga 912345678";
    const r = tapa(s);
    expect(r.original).toBe(s);
    expect(r.filtrada).toBe(true);
    expect(r.texto).not.toContain("912345678");
  });

  it("pareceTelefone decide pelos dígitos", () => {
    expect(pareceTelefone("912 345 678")).toBe(true);
    expect(pareceTelefone("120 150")).toBe(false);
    expect(pareceTelefone("1500 2000")).toBe(false);
  });
});
