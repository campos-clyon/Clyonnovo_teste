import { describe, it, expect } from "vitest";
import {
  validarValoresDoCliente,
  vistaDoProfissional,
  CAMPOS_VISIVEIS_AO_PROFISSIONAL,
  VALOR_MAXIMO_ACEITE,
  VALOR_MINIMO_ACEITE,
} from "./pedido-valores";

describe("validarValoresDoCliente", () => {
  it("aceita um par normal", () => {
    const r = validarValoresDoCliente(80, 150);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores.valorMinimoCliente).toBe(80);
      expect(r.valores.valorMaximoCliente).toBe(150);
    }
  });

  it("aceita mínimo igual ao máximo — quem sabe o que quer pagar não é erro", () => {
    const r = validarValoresDoCliente(100, 100);
    expect(r.ok).toBe(true);
  });

  // Um teclado português escreve 80,50 e não 80.50. Rejeitar a vírgula era
  // rejeitar a forma normal de escrever um valor em euros.
  it("aceita vírgula decimal", () => {
    const r = validarValoresDoCliente("80,50", "120,99");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores.valorMinimoCliente).toBe(80.5);
      expect(r.valores.valorMaximoCliente).toBe(120.99);
    }
  });

  it("arredonda aos cêntimos", () => {
    const r = validarValoresDoCliente(80.005, 120.999);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valores.valorMinimoCliente).toBe(80.01);
      expect(r.valores.valorMaximoCliente).toBe(121);
    }
  });

  it("recusa máximo abaixo do mínimo", () => {
    const r = validarValoresDoCliente(200, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0].campo).toBe("valorMaximoCliente");
  });

  it("recusa valores em falta", () => {
    const r = validarValoresDoCliente(null, undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros).toHaveLength(2);
  });

  it("recusa texto que não é número", () => {
    const r = validarValoresDoCliente("oitenta", "cento e vinte");
    expect(r.ok).toBe(false);
  });

  it("recusa zero e negativos", () => {
    expect(validarValoresDoCliente(0, 100).ok).toBe(false);
    expect(validarValoresDoCliente(-50, 100).ok).toBe(false);
  });

  it("recusa acima do tecto de sanidade", () => {
    expect(validarValoresDoCliente(10, VALOR_MAXIMO_ACEITE + 1).ok).toBe(false);
  });

  it("recusa abaixo do mínimo aceite", () => {
    expect(validarValoresDoCliente(VALOR_MINIMO_ACEITE - 1, 100).ok).toBe(false);
  });

  // Se os dois estiverem vazios não faz sentido acusar "o máximo é menor que o
  // mínimo" — a pessoa não escreveu nada, e a mensagem confundia mais do que
  // ajudava.
  it("não acusa a comparação quando falta um dos valores", () => {
    const r = validarValoresDoCliente(null, 50);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros.every((e) => !e.mensagem.includes("menor"))).toBe(true);
    }
  });
});

describe("vistaDoProfissional — o máximo nunca sai", () => {
  const pedidoCompleto = {
    id: 42,
    serviceType: "recolha_moveis",
    description: "Um sofá de 3 lugares",
    city: "Amadora",
    address: "Rua das Flores, 12, 3.º Dto",
    contactName: "Ana Silva",
    contactPhone: "912345678",
    contactEmail: "ana@exemplo.pt",
    valorMinimoCliente: 80,
    valorMaximoCliente: 150,
    notasInternas: "cliente já reclamou uma vez",
    acessoTokenHash: "abc123",
    status: "publicado",
  };

  it("deixa passar o mínimo", () => {
    expect(vistaDoProfissional(pedidoCompleto).valorMinimoCliente).toBe(80);
  });

  // A regra central do plano. Se este teste alguma vez falhar, a negociação
  // deixa de fazer sentido: ninguém propõe abaixo de um tecto que consegue ver.
  it("NUNCA deixa passar o máximo", () => {
    const vista = vistaDoProfissional(pedidoCompleto) as Record<string, unknown>;
    expect(vista.valorMaximoCliente).toBeUndefined();
    expect(Object.keys(vista).some((k) => /maxim/i.test(k) && k !== "estimateMax")).toBe(false);
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

  it("omite campos ausentes em vez de os pôr a undefined", () => {
    const vista = vistaDoProfissional({ id: 1, serviceType: "mudanca" });
    expect(Object.keys(vista)).toEqual(["id", "serviceType"]);
  });

  it("a lista de permissões não inclui nada do máximo", () => {
    expect(CAMPOS_VISIVEIS_AO_PROFISSIONAL).not.toContain("valorMaximoCliente");
  });
});
