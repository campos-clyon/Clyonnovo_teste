import { describe, it, expect } from "vitest";
import {
  ALERTA_NUMERO_PARTIDO,
  ALERTA_PALAVRA,
  CONTACTO_ESCONDIDO,
  filtrarContactos,
} from "./filtro-de-contactos";

/** Segurança M1 (30-10-2026): as formas fáceis de passar o filtro. */
describe("filtro de contactos — os contornos da Segurança (M1)", () => {
  const tapa = (s: string) => {
    const f = filtrarContactos(s);
    expect(f.filtrada, s).toBe(true);
    expect(f.texto).toContain(CONTACTO_ESCONDIDO);
    expect(f.texto).not.toMatch(/912|345|678/);
  };

  it("912345678€", () => tapa("912345678€"));
  it("ligue 912345678 kg", () => tapa("ligue 912345678 kg"));
  it("9h12 3h45 6h78", () => tapa("9h12 3h45 6h78"));
  it("dígitos de largura total", () => tapa("９１２３４５６７８"));
  it("9I2 345 678 (letra no lugar do 1)", () => tapa("9I2 345 678"));
  it("9l2 345 678 e 91O 345 678", () => {
    tapa("9l2 345 678");
    expect(filtrarContactos("21O 345 678").filtrada).toBe(true);
  });

  it("91234 e depois 5678 — na mesma mensagem: alerta para a equipa", () => {
    expect(filtrarContactos("91234 e depois 5678").alerta).toBe(ALERTA_NUMERO_PARTIDO);
  });
  it("91234 e depois 5678 — em mensagens seguidas do mesmo autor: alerta", () => {
    const f = filtrarContactos("5678", ["olá", "91234"]);
    expect(f.alerta).toBe(ALERTA_NUMERO_PARTIDO);
  });
  it("só as últimas 3 mensagens contam", () => {
    expect(filtrarContactos("5678", ["91234", "ok", "sim"]).alerta).toBeNull();
  });

  it("joao@gmail (sem terminação)", () => {
    const f = filtrarContactos("escreve para joao@gmail");
    expect(f.filtrada).toBe(true);
    expect(f.texto).not.toContain("joao");
  });
  it("@palavra sem terminação", () => {
    expect(filtrarContactos("sou o @joaosilva_lx").texto).not.toContain("joaosilva");
  });

  it("insta joaosilva_lx: não se tapa, mas marca para a equipa", () => {
    const f = filtrarContactos("insta joaosilva_lx");
    expect(f.filtrada).toBe(false);
    expect(f.texto).toBe("insta joaosilva_lx");
    expect(f.alerta).toBe(ALERTA_PALAVRA);
  });
  it.each(["manda whats", "tens zap?", "liga-me amanhã", "estou no telegram", "o meu instagram"])("sinal: %s", (s) => {
    expect(filtrarContactos(s).alerta).toBe(ALERTA_PALAVRA);
  });
});

describe("filtro de contactos — o que continua a passar", () => {
  it.each([
    "O valor é 350 € + IVA = 430,50 €",
    "Fica 1.250,00€ no total",
    "São 40€ por carga",
    "Dia 12/11/2026 às 9h30",
    "Entre as 14:00 e as 18h00",
    "Código postal 1100-148 Lisboa",
    "O pedido #483 está confirmado",
    "Pedido #1234567",
    "São 3 m3 e 120 kg, a 25 km",
    "Desconto de 10 %",
    "2 sofás, 3 cadeiras e 1 mesa no 4.º andar",
    "a sala tem 20 m2",
  ])("passa: %s", (s) => {
    const f = filtrarContactos(s);
    expect(f.filtrada, s).toBe(false);
    expect(f.texto).toBe(s);
    expect(f.alerta, s).toBeNull();
  });
});
