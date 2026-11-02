import { describe, it, expect } from "vitest";
import { lerSeFoiPaga } from "./eupago";

/**
 * ⚠️ UMA VOGAL A SEPARAR UM PAGAMENTO DE UM CLIENTE.
 *
 * *«A euPago não mostra se realmente foi feito.»* — 22-09-2026.
 *
 * Mostrava. O Verificador Multibanco deles respondeu, sobre a referência
 * 104295830 e o identificador `clyon-site-4`:
 *
 *     Estado: **Paga**   ·   Valor: 42,00 €   ·   Paga em: 22/09/2026
 *
 * E a nossa leitura aceitava `pago`, `paid`, `1` e `true`. **`paga` não.**
 * Uma referência paga era lida como por pagar por causa do género da palavra
 * — e o profissional ficava à espera de dinheiro que já cá estava.
 *
 * A documentação do `multibanco/info` tem mais de dois anos e não diz o nome
 * do campo. Isto é o que substitui a documentação que não há.
 */

describe("o que o euPago responde quando já foi paga", () => {
  it("«paga», que é a palavra que o ecrã deles usa", () => {
    expect(lerSeFoiPaga({ estado: "0", estado_pagamento: "Paga" }).pago).toBe(true);
  });

  it("e as outras formas em que a mesma coisa pode vir", () => {
    for (const c of [
      { estado_pagamento: "pago" },
      { estado_pagamento: "PAID" },
      { estado_referencia: "Paga" },
      { pago: "1" },
      { pago: true },
      { pago: 1 },
      { paga: "sim" },
      { status: "paid" },
      { situacao: "Paga" },
    ]) {
      expect(lerSeFoiPaga(c).pago, JSON.stringify(c)).toBe(true);
    }
  });

  /*
   * O ecrã deles mostra «Paga em: 22/09/2026» ao lado do estado. Uma data de
   * pagamento preenchida é, por si só, a resposta.
   */
  it("uma data de pagamento preenchida chega", () => {
    expect(lerSeFoiPaga({ data_pagamento: "22/09/2026" }).pago).toBe(true);
    expect(lerSeFoiPaga({ paga_em: "2026-09-22 09:49:00" }).pago).toBe(true);
  });

  it("traz o valor, com vírgula ou com ponto", () => {
    expect(lerSeFoiPaga({ estado_pagamento: "paga", valor_pago: "42,00" }).valor).toBe(42);
    expect(lerSeFoiPaga({ estado_pagamento: "paga", valor: "42.00" }).valor).toBe(42);
    expect(lerSeFoiPaga({ estado_pagamento: "paga" }).valor).toBeNull();
  });

  it("diz que campo respondeu — para não se ficar a adivinhar", () => {
    expect(lerSeFoiPaga({ estado_pagamento: "Paga" }).porque).toContain("estado_pagamento");
  });
});

/**
 * ⚠️ NA DÚVIDA, NÃO ESTÁ PAGO — e a assimetria é de propósito.
 *
 * Um pagamento por confirmar fica pendente e alguém olha para ele. Um
 * pagamento dado por pago à toa manda um profissional trabalhar de graça, e
 * essa não se desfaz com um clique.
 */
describe("o que não se reconhece não é um sim", () => {
  it("por pagar é por pagar, escrito como for", () => {
    for (const c of [
      { estado_pagamento: "Por pagar" },
      { estado_pagamento: "pendente" },
      { estado_pagamento: "Não paga" },
      { pago: "0" },
      { pago: false },
      { status: "expired" },
    ]) {
      expect(lerSeFoiPaga(c).pago, JSON.stringify(c)).toBe(false);
    }
  });

  it("uma resposta sem campo nenhum que se reconheça não é um sim", () => {
    for (const c of [{}, null, undefined, { estado: "0", referencia: "104295830" }]) {
      const r = lerSeFoiPaga(c);
      expect(r.pago, JSON.stringify(c)).toBe(false);
      expect(r.porque).toContain("reconhe");
    }
  });

  /*
   * ⚠️ `estado` É O CÓDIGO DA API, e não o estado do pagamento. `"0"` quer
   * dizer «a consulta correu bem» — lê-lo como pagamento seria dar por pagas
   * todas as referências que se consultassem com sucesso.
   */
  it("o campo `estado` nunca é lido como estado do pagamento", () => {
    expect(lerSeFoiPaga({ estado: "0" }).pago).toBe(false);
    expect(lerSeFoiPaga({ estado: "1" }).pago).toBe(false);
    expect(lerSeFoiPaga({ estado: "true" }).pago).toBe(false);
  });

  /*
   * Datas vazias que os sistemas antigos escrevem em vez de deixar nulo. Uma
   * delas lida como data era um pagamento inventado.
   */
  it("uma data que não é data não conta", () => {
    for (const v of ["", "-", "0000-00-00", "0000-00-00 00:00:00", "null"]) {
      expect(lerSeFoiPaga({ data_pagamento: v }).pago, v).toBe(false);
    }
  });

  /*
   * ⚠️ NÃO SE PROCURA ATÉ ENCONTRAR UM «SIM».
   *
   * Um campo do estado que existe e diz outra coisa é uma RESPOSTA. Continuar
   * a varrer os outros campos à procura de algo afirmativo é exactamente como
   * se inventa um pagamento a partir de uma resposta que diz o contrário.
   */
  it("o primeiro campo que responde é o que vale", () => {
    const r = lerSeFoiPaga({ estado_pagamento: "Por pagar", status: "paid" });
    expect(r.pago).toBe(false);
    expect(r.porque).toContain("estado_pagamento");
  });
});

/**
 * A RESPOSTA REAL — 02-11-2026. O valor não vem no topo: vem na lista
 * `pagamentos`. Sem a ler, uma referência paga ficava «por confirmar» e o
 * cliente via-a por pagar.
 */
describe("a resposta real do multibanco/info (02-11-2026)", () => {
  const real = {
    entidade: "21921",
    referencia: "100000000",
    identificador: "clyon-site-1",
    estado: 0,
    estado_referencia: "paga",
    pagamentos: [
      {
        trid: 124000000,
        estado: "paga",
        valor: "1.23000",
        comissao: "0.66000",
        data_pagamento: "2026-11-02",
        hora_pagamento: "16:58:00",
      },
    ],
    sucesso: true,
    resposta: "OK",
  };

  it("está paga, com o valor, o trid e a comissão da lista", () => {
    const r = lerSeFoiPaga(real);
    expect(r.pago).toBe(true);
    expect(r.valor).toBe(1.23);
    expect(r.trid).toBe("124000000");
    expect(r.comissao).toBe(0.66);
  });

  it("só somam as linhas pagas", () => {
    const r = lerSeFoiPaga({
      ...real,
      pagamentos: [...real.pagamentos, { trid: 1, estado: "cancelada", valor: "9.00" }],
    });
    expect(r.valor).toBe(1.23);
  });

  it("uma linha paga sem valor legível não inventa valor", () => {
    const r = lerSeFoiPaga({ ...real, pagamentos: [{ trid: 1, estado: "paga", valor: "?" }] });
    expect(r.pago).toBe(true);
    expect(r.valor).toBeNull();
  });

  it("a lista não faz pagar o que o topo diz que não está", () => {
    expect(lerSeFoiPaga({ ...real, estado_referencia: "pendente" }).pago).toBe(false);
  });
});
