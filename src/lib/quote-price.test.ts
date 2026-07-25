import { describe, it, expect } from "vitest";
import {
  displayPrice, isBelowFloor, withVat, eur, gatePrice, hasUsablePrice,
  firstPositive, legacyPriceText, legacyHasPrice, orcamentoDoPedido,
} from "./quote-price";

// Regra central da NOTA-BRIDGE-MOTOR §3.1: total = 0 já não significa
// "sem preço". Estes testes existem para impedir que o painel volte a
// mostrar 0 € em pedidos que têm valor.

describe("displayPrice — price_status firme", () => {
  it("usa o total quando está preenchido", () => {
    const r = displayPrice({ total: 249, estimate_min: 196, estimate_max: 249, price_status: "firme" });
    expect(r.kind).toBe("fechado");
    expect(r.text).toBe("249 € + IVA");
    expect(r.value).toBe(249);
    expect(r.needsReview).toBe(false);
  });

  it("cai para estimate_min quando o total vem a 0 — NÃO mostra 0 €", () => {
    const r = displayPrice({ total: 0, estimate_min: 199, estimate_max: 199, price_status: "firme" });
    expect(r.kind).toBe("fechado");
    expect(r.text).toBe("199 € + IVA");
    expect(r.value).toBe(199);
  });

  it("lê final_price/estimated_price quando não há total (service_requests)", () => {
    expect(displayPrice({ final_price: 300, price_status: "firme" }).value).toBe(300);
    expect(displayPrice({ estimated_price: 150, price_status: "firme" }).value).toBe(150);
    // final_price tem precedência
    expect(displayPrice({ final_price: 300, estimated_price: 150, price_status: "firme" }).value).toBe(300);
  });
});

describe("displayPrice — intervalo e revisão", () => {
  it("mostra o intervalo, não o total a 0", () => {
    const r = displayPrice({ total: 0, estimate_min: 196, estimate_max: 249, price_status: "intervalo" });
    expect(r.kind).toBe("intervalo");
    expect(r.text).toBe("196 – 249 € + IVA");
    expect(r.min).toBe(196);
    expect(r.max).toBe(249);
    expect(r.needsReview).toBe(false);
  });

  it("revisão mostra o intervalo e sinaliza decisão humana", () => {
    const r = displayPrice({ total: 0, estimate_min: 400, estimate_max: 800, price_status: "revisao" });
    expect(r.kind).toBe("revisao");
    expect(r.text).toBe("400 – 800 € + IVA");
    expect(r.needsReview).toBe(true);
    expect(r.label).toMatch(/revis/i);
  });

  it("valor de conta é o ponto médio do intervalo", () => {
    expect(displayPrice({ estimate_min: 100, estimate_max: 200, price_status: "intervalo" }).value).toBe(150);
  });

  it("estado diz intervalo mas faltam extremos — usa o total se existir", () => {
    const r = displayPrice({ total: 180, price_status: "intervalo" });
    expect(r.text).toBe("180 € + IVA");
    expect(r.value).toBe(180);
  });
});

describe("displayPrice — cotações anteriores ao motor (price_status NULL)", () => {
  it("comportamento antigo: total positivo é o preço", () => {
    const r = displayPrice({ total: 220, price_status: null });
    expect(r.kind).toBe("fechado");
    expect(r.text).toBe("220 € + IVA");
  });

  it("total 0 e sem estado = legado sem preço", () => {
    const r = displayPrice({ total: 0, price_status: null });
    expect(r.kind).toBe("legado");
    expect(r.value).toBeNull();
    expect(r.text).toMatch(/sem preço/i);
  });

  it("linha inexistente não rebenta", () => {
    expect(displayPrice(null).kind).toBe("legado");
    expect(displayPrice(undefined).value).toBeNull();
  });
});

describe("displayPrice — o caso do teste ponta a ponta da nota", () => {
  // 3 roupeiros + 2 cómodas, 3.º sem elevador, sem fotos, Rio de Mouro:
  // 199 € [196–249] intervalo (motor determinístico)
  it("199 € [196–249] intervalo mostra o intervalo", () => {
    const r = displayPrice({
      total: 199, estimate_min: 196, estimate_max: 249, price_status: "intervalo",
    });
    expect(r.text).toBe("196 – 249 € + IVA");
    expect(r.kind).toBe("intervalo");
  });
});

describe("aceita valores em texto (vindos de JSON/numeric do Postgres)", () => {
  it("converte strings numéricas", () => {
    const r = displayPrice({ total: "0", estimate_min: "196.00", estimate_max: "249.00", price_status: "intervalo" });
    expect(r.min).toBe(196);
    expect(r.max).toBe(249);
  });

  it("ignora lixo não numérico", () => {
    expect(displayPrice({ total: "abc", price_status: null }).kind).toBe("legado");
  });
});

describe("gatePrice / hasUsablePrice — validar operações", () => {
  // Bloquear por estimated_price é PIOR do que mostrar 0 €: impede o operador
  // de avançar um pedido que já tem preço, e obriga-o a inventar um valor que
  // passa a divergir da cotação e de pricing_outcomes.
  it("não bloqueia um pedido cujo preço vive só no intervalo", () => {
    const row = { estimated_price: null, estimate_min: 196, estimate_max: 249, price_status: "intervalo" };
    expect(hasUsablePrice(row)).toBe(true);
    expect(gatePrice(row)).toBe(196); // extremo inferior — o mais conservador
  });

  it("não bloqueia quando a coluna antiga vem a 0 mas há intervalo", () => {
    const row = { estimated_price: 0, estimate_min: 199, estimate_max: 199, price_status: "firme" };
    expect(hasUsablePrice(row)).toBe(true);
    expect(gatePrice(row)).toBe(199);
  });

  it("bloqueia mesmo quando não há preço nenhum", () => {
    expect(hasUsablePrice({ estimated_price: null, price_status: null })).toBe(false);
    expect(hasUsablePrice({ estimated_price: 0, price_status: null })).toBe(false);
    expect(gatePrice({ estimated_price: 0, price_status: null })).toBeNull();
    expect(hasUsablePrice(null)).toBe(false);
  });

  it("usa o extremo inferior, não o ponto médio, para decidir", () => {
    // displayPrice devolve o médio (222.5) para exibição; o gate é conservador
    const row = { estimate_min: 196, estimate_max: 249, price_status: "intervalo" };
    expect(displayPrice(row).value).toBe(222.5);
    expect(gatePrice(row)).toBe(196);
  });

  it("respeita o fluxo antigo (price_status NULL com total)", () => {
    expect(gatePrice({ estimated_price: 220, price_status: null })).toBe(220);
    expect(hasUsablePrice({ final_price: 300, price_status: null })).toBe(true);
  });
});

describe("orcamentoDoPedido — o campo que EDITA estimated_price mostra-o", () => {
  // Regressão real: o campo mostrava gatePrice(), que prefere final_price.
  // O operador escrevia 333, gravava com sucesso, e via 270 de volta ao
  // recarregar — parecia que a gravação falhava quando não falhava.
  it("mostra estimated_price mesmo quando final_price é diferente", () => {
    const row = { estimated_price: 333, final_price: 270, price_status: null };
    expect(orcamentoDoPedido(row)).toBe(333);
    // gatePrice continua a preferir o acordado — é a diferença que causava o bug
    expect(gatePrice(row)).toBe(270);
  });

  it("cai para o valor do motor enquanto ninguém definiu orçamento", () => {
    expect(orcamentoDoPedido({ estimated_price: null, estimate_min: 196, estimate_max: 249, price_status: "intervalo" })).toBe(196);
    expect(orcamentoDoPedido({ estimated_price: 0, final_price: 270, price_status: null })).toBe(270);
  });

  it("sem preço nenhum devolve null (campo vazio, não zero)", () => {
    expect(orcamentoDoPedido({ estimated_price: null, price_status: null })).toBeNull();
    expect(orcamentoDoPedido(null)).toBeNull();
  });

  it("gravar e recarregar mantém o valor escrito", () => {
    const antes = { estimated_price: 270, final_price: 270, price_status: null };
    const escrito = 333;
    expect(String(orcamentoDoPedido(antes))).not.toBe(String(escrito)); // há alteração a enviar
    const depois = { ...antes, estimated_price: escrito };
    expect(orcamentoDoPedido(depois)).toBe(escrito); // e o campo mostra-a
  });
});

describe("fluxo legado (MySQL) — firstPositive / legacyPriceText", () => {
  // "0.00" é uma string truthy: `if (!v)` deixava passar zeros e as cadeias
  // `??` paravam no primeiro valor não-nulo mesmo sendo 0, com o intervalo
  // estimateMin/Max declarado no tipo e nunca consultado.
  it("firstPositive salta zeros e strings de zero", () => {
    expect(firstPositive("0.00", "0", 150)).toBe(150);
    expect(firstPositive(null, undefined, "", 0, "220.50")).toBe(220.5);
    expect(firstPositive(0, "0.00", null)).toBeNull();
  });

  it("mostra o intervalo quando os totais vêm a zero", () => {
    const o = { estimateTotal: "0.00", precoFinal: null, estimateMin: "196", estimateMax: "249" };
    expect(legacyPriceText(o)).toBe("196 – 249 €");
  });

  it("prefere o valor fechado quando existe", () => {
    const o = { estimateTotal: "180", precoFinal: "200", estimateMin: "150", estimateMax: "250" };
    expect(legacyPriceText(o)).toBe("200 €");
  });

  it("c/IVA usa precoFinalIva quando pedido", () => {
    const o = { precoFinalIva: "246", precoFinal: "200", estimateTotal: "180" };
    expect(legacyPriceText(o, { withVat: true })).toBe("246 €");
    expect(legacyPriceText(o)).toBe("200 €");
  });

  it("intervalo degenerado (min = max) mostra um só valor", () => {
    expect(legacyPriceText({ estimateMin: "199", estimateMax: "199" })).toBe("199 €");
  });

  it("sem nenhum valor positivo devolve null (o ecrã mostra —)", () => {
    expect(legacyPriceText({ estimateTotal: "0.00", precoFinal: "0" })).toBeNull();
    expect(legacyPriceText({})).toBeNull();
    expect(legacyPriceText(null)).toBeNull();
    expect(legacyHasPrice({ estimateTotal: "0" })).toBe(false);
    expect(legacyHasPrice({ estimateMin: "196", estimateMax: "249" })).toBe(true);
  });
});

describe("isBelowFloor — defesa contra aprovar com prejuízo", () => {
  it("detecta preço abaixo do piso do motor", () => {
    expect(isBelowFloor(150, 180)).toBe(true);
    expect(isBelowFloor(200, 180)).toBe(false);
    expect(isBelowFloor(180, 180)).toBe(false); // igual ao piso não é prejuízo
  });

  it("devolve null quando não há piso conhecido (trace ausente)", () => {
    expect(isBelowFloor(150, null)).toBeNull();
    expect(isBelowFloor(150, undefined)).toBeNull();
    expect(isBelowFloor(null, 180)).toBeNull();
  });

  it("aceita valores em texto", () => {
    expect(isBelowFloor("150", "180.50")).toBe(true);
  });
});

describe("IVA e formatação", () => {
  it("IVA de 23% só na apresentação", () => {
    expect(withVat(100)).toBe(123);
    expect(withVat(199)).toBe(244.77);
  });

  it("formata inteiros sem decimais e não-inteiros com dois", () => {
    expect(eur(199)).toBe("199");
    expect(eur(199.5)).toBe("199,50");
    expect(eur(249.99)).toBe("249,99");
  });
});
