import { describe, it, expect } from "vitest";
import {
  validarValorDesejado,
  vistaDoProfissional,
  CAMPOS_VISIVEIS_AO_PROFISSIONAL,
  VALOR_MAXIMO_ACEITE,
  VALOR_MINIMO_ACEITE,
} from "./pedido-valores";

describe("validarValorDesejado", () => {
  it("aceita um valor normal", () => {
    const r = validarValorDesejado(80);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.valorDesejadoCliente).toBe(80);
  });

  // Um teclado português escreve 80,50 e não 80.50. Rejeitar a vírgula era
  // rejeitar a forma normal de escrever um valor em euros.
  it("aceita vírgula decimal", () => {
    const r = validarValorDesejado("80,50");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valores.valorDesejadoCliente).toBe(80.5);
  });

  it("arredonda aos cêntimos", () => {
    const r = validarValorDesejado(80.005);
    if (r.ok) expect(r.valores.valorDesejadoCliente).toBe(80.01);
  });

  it("recusa valor em falta", () => {
    for (const v of [null, undefined, "", "   "]) {
      const r = validarValorDesejado(v);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erros[0].campo).toBe("valorDesejadoCliente");
    }
  });

  it("recusa texto que não é número", () => {
    expect(validarValorDesejado("oitenta").ok).toBe(false);
  });

  it("recusa zero e negativos", () => {
    expect(validarValorDesejado(0).ok).toBe(false);
    expect(validarValorDesejado(-50).ok).toBe(false);
  });

  it("recusa abaixo do mínimo e acima do tecto", () => {
    expect(validarValorDesejado(VALOR_MINIMO_ACEITE - 1).ok).toBe(false);
    expect(validarValorDesejado(VALOR_MAXIMO_ACEITE + 1).ok).toBe(false);
  });

  it("aceita exactamente nos limites", () => {
    expect(validarValorDesejado(VALOR_MINIMO_ACEITE).ok).toBe(true);
    expect(validarValorDesejado(VALOR_MAXIMO_ACEITE).ok).toBe(true);
  });
});

describe("vistaDoProfissional", () => {
  const pedidoCompleto = {
    id: 42,
    serviceType: "recolha_moveis",
    description: "Um sofá de 3 lugares",
    city: "Amadora",
    address: "Rua das Flores, 12, 3.º Dto",
    contactName: "Ana Silva",
    contactPhone: "912345678",
    contactEmail: "ana@exemplo.pt",
    valorDesejadoCliente: 80,
    notasInternas: "cliente já reclamou uma vez",
    acessoTokenHash: "abc123",
    status: "publicado",
  };

  it("deixa passar o valor desejado", () => {
    expect(vistaDoProfissional(pedidoCompleto).valorDesejadoCliente).toBe(80);
  });

  it("não deixa passar a morada exacta nem o contacto", () => {
    const vista = vistaDoProfissional(pedidoCompleto) as Record<string, unknown>;
    expect(vista.address).toBeUndefined();
    expect(vista.contactName).toBeUndefined();
    expect(vista.contactPhone).toBeUndefined();
    expect(vista.contactEmail).toBeUndefined();
  });

  it("não deixa passar notas internas nem o hash do token", () => {
    const vista = vistaDoProfissional(pedidoCompleto) as Record<string, unknown>;
    expect(vista.notasInternas).toBeUndefined();
    expect(vista.acessoTokenHash).toBeUndefined();
  });

  // É a razão de a lista ser de permissões e não de exclusões: uma coluna nova
  // na tabela não pode passar a sair sozinha só porque ninguém se lembrou de a
  // acrescentar a uma lista de proibidos.
  it("um campo novo e desconhecido fica de fora por omissão", () => {
    const vista = vistaDoProfissional({
      ...pedidoCompleto,
      margemDeLucroInterna: 0.35,
      colunaQueAlguemAcrescentouAmanha: "segredo",
    }) as Record<string, unknown>;
    expect(vista.margemDeLucroInterna).toBeUndefined();
    expect(vista.colunaQueAlguemAcrescentouAmanha).toBeUndefined();
  });

  // O máximo privado deixou de existir como conceito. Se alguém o reintroduzir
  // numa coluna, este teste obriga a decidir de propósito que ele pode sair.
  it("nada com 'maximo' no nome sai, tirando a estimativa do motor", () => {
    const vista = vistaDoProfissional({
      ...pedidoCompleto,
      valorMaximoCliente: 150,
      estimateMax: 120,
    }) as Record<string, unknown>;
    expect(vista.valorMaximoCliente).toBeUndefined();
    expect(vista.estimateMax).toBe(120);
    expect(CAMPOS_VISIVEIS_AO_PROFISSIONAL).not.toContain("valorMaximoCliente");
  });

  it("omite campos ausentes em vez de os pôr a undefined", () => {
    const vista = vistaDoProfissional({ id: 1, serviceType: "mudanca" });
    expect(Object.keys(vista)).toEqual(["id", "serviceType"]);
  });
});
