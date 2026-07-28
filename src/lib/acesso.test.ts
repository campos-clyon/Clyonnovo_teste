import { describe, it, expect } from "vitest";
import {
  ELEVATOR_VALUES, PARKING_VALUES,
  elevatorLabel, parkingLabel, isUnknownAccessValue, origemDoPedido,
} from "./acesso";
import { tFloor } from "./translations";

describe("vocabulário de acesso — o mesmo em todo o lado", () => {
  // O backoffice oferecia sim/nao e porta/proximo/medio/longe. Nada disso
  // existe nos dados: o campo mostrava sempre "Não informado", e gravar por
  // cima escrevia um valor que o motor de preços não sabia ler.
  it("os valores gravados são os do simulador e do formulário", () => {
    expect(ELEVATOR_VALUES).toEqual(["yes", "small", "no", "unknown"]);
    expect(PARKING_VALUES).toEqual(["door", "under_20m", "over_30m", "difficult", "unknown"]);
  });

  it("nenhum valor em português entrou no vocabulário", () => {
    for (const v of [...ELEVATOR_VALUES, ...PARKING_VALUES]) {
      expect(["sim", "nao", "porta", "proximo", "medio", "longe"]).not.toContain(v);
    }
  });

  // Os rótulos vivem em translations.ts — uma segunda tabela aqui seria a
  // duplicação que causou esta divergência.
  it("cada valor tem tradução", () => {
    for (const v of ELEVATOR_VALUES) expect(elevatorLabel(v)).toBeTruthy();
    for (const v of PARKING_VALUES) expect(parkingLabel(v)).toBeTruthy();
  });
});

describe("elevatorLabel / parkingLabel", () => {
  it("traduz o que conhece", () => {
    expect(elevatorLabel("small")).toBe("Sim, mas é pequeno");
    expect(parkingLabel("over_30m")).toBe("Mais de 30 metros");
  });

  // O dicionário conhece o legado; a lista de escrita é que não o oferece
  it("valores antigos continuam a ter tradução", () => {
    expect(elevatorLabel("sim")).toBe("Sim");
    expect(isUnknownAccessValue("sim", ELEVATOR_VALUES)).toBe(true);
  });

  it("vazio é ausência, não um rótulo", () => {
    expect(elevatorLabel("")).toBeNull();
    expect(elevatorLabel(null)).toBeNull();
    expect(parkingLabel(undefined)).toBeNull();
  });

  it("isUnknownAccessValue distingue vazio de estranho", () => {
    expect(isUnknownAccessValue("", ELEVATOR_VALUES)).toBe(false);
    expect(isUnknownAccessValue("yes", ELEVATOR_VALUES)).toBe(false);
    expect(isUnknownAccessValue("sim", ELEVATOR_VALUES)).toBe(true);
  });
});

describe("origemDoPedido — o formulário deixa de se disfarçar de simulador", () => {
  // O simulador grava origemPedido; o formulário da homepage grava _source.
  // O painel só lia o primeiro, e etiquetava tudo como "Simulador".
  it("reconhece o formulário da homepage", () => {
    const o = origemDoPedido(JSON.stringify({ _source: "hero_quote_form" }));
    expect(o.label).toBe("Formulário");
    expect(o.slug).toBe("hero_quote_form");
  });

  it("continua a reconhecer as origens do simulador", () => {
    expect(origemDoPedido(JSON.stringify({ origemPedido: "formulario_contactos" })).label).toBe("Contactos");
    expect(origemDoPedido(JSON.stringify({ origemPedido: "quero_contratar_header" })).label).toBe("Contratar");
  });

  it("origemPedido manda quando os dois existem", () => {
    const o = origemDoPedido(JSON.stringify({ origemPedido: "quero_contratar", _source: "hero_quote_form" }));
    expect(o.label).toBe("Contratar");
  });

  it("sem marca nenhuma continua a ser o simulador", () => {
    expect(origemDoPedido(JSON.stringify({ serviceType: "sofa" })).label).toBe("Simulador");
    expect(origemDoPedido(null).label).toBe("Simulador");
  });

  it("origem nova aparece crua em vez de ser lida como simulador", () => {
    expect(origemDoPedido(JSON.stringify({ _source: "campanha_natal" })).label).toBe("campanha_natal");
  });

  it("JSON estragado não rebenta a lista de pedidos", () => {
    expect(origemDoPedido("{isto não é json").label).toBe("Simulador");
  });
});

describe("origemDoPedido — o painel deixa de chamar simulador a tudo", () => {
  // O cabeçalho do detalhe dizia "#131 · Simulador" a um pedido de quatro
  // campos vindo da página de contactos. A equipa procurava dados que nunca
  // tinham sido pedidos.
  it("um contacto directo não é um pedido do simulador", () => {
    const o = origemDoPedido(JSON.stringify({ origemPedido: "formulario_contactos" }));
    expect(o.label).toBe("Contactos");
    expect(o.label).not.toBe("Simulador");
  });

  it("o slug serve para decidir o que mostrar no ecrã", () => {
    expect(origemDoPedido(JSON.stringify({ origemPedido: "formulario_contactos" })).slug)
      .toBe("formulario_contactos");
  });
});

describe("andar e elevador obrigatórios no formulário da homepage", () => {
  // Réplica da validação do passo 2. O que se protege aqui é a distinção
  // entre "não respondeu" e "respondeu rés-do-chão": enquanto o rés-do-chão
  // era o valor vazio, quem não escolhesse nada passava por ter respondido.
  function validaAcesso(f: { andar: string; elevador: string }): string[] {
    const erros: string[] = [];
    if (!f.andar) erros.push("andar");
    if (!f.elevador) erros.push("elevador");
    return erros;
  }

  it("recusa o formulário sem andar nem elevador", () => {
    expect(validaAcesso({ andar: "", elevador: "" })).toEqual(["andar", "elevador"]);
  });

  it("rés-do-chão é uma resposta, não uma ausência", () => {
    expect(validaAcesso({ andar: "0", elevador: "no" })).toEqual([]);
  });

  it("'não sei' continua a valer como resposta deliberada", () => {
    expect(validaAcesso({ andar: "3", elevador: "unknown" })).toEqual([]);
  });

  it("um dos dois em falta chega para recusar", () => {
    expect(validaAcesso({ andar: "2", elevador: "" })).toEqual(["elevador"]);
    expect(validaAcesso({ andar: "", elevador: "yes" })).toEqual(["andar"]);
  });

  // "0" é o rés-do-chão e o dicionário já o traduz — não inventámos valor novo
  it("o valor do rés-do-chão tem tradução", () => {
    expect(tFloor("0")).toBe("Rés-do-chão");
  });
});
