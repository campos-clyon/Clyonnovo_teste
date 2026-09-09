import { describe, it, expect } from "vitest";
import {
  parametrosDoMapa,
  sugerirParaOProfissional,
  type ParametrosDeCusto,
} from "./sugestao-para-o-profissional";

/**
 * A sugestão calculada para o profissional que está a ver o pedido.
 *
 * "Vamos usar dados reais do profissional que está a ver o pedido para
 * calcular individualmente esses valores." Os quilómetros são os dele, e os
 * custos, se os tiver definido, também.
 */

const CLYON: ParametrosDeCusto = {
  custoKm: 0.5,
  custoHoraPessoa: 9,
  numPessoas: 3,
  overhead: 17,
  margem: 0.4,
};

const recolha = {
  serviceType: "recolha_moveis",
  description: "Um sofá",
  floor: "0",
  hasElevator: "yes",
  parkingDistance: "near",
};

describe("a conta, com os números da CLYON", () => {
  it("segue a fórmula do simulador: combustível + pessoal + fixos, × (1 + margem)", () => {
    // 25 km só ida → 50 km ida e volta × 0,50 = 25 €; 1 h × 3 × 9 = 27 €; 17 € fixos.
    // 69 € × 1,4 = 96,60 € — o mesmo exemplo que o backoffice mostra.
    const s = sugerirParaOProfissional(recolha, 25, CLYON);
    expect(s.horas).toBe(1);
    expect(s.kmDeCarro).toBe(50);
    expect(s.custoCombustivel).toBe(25);
    expect(s.custoPessoal).toBe(27);
    expect(s.custosFixos).toBe(17);
    expect(s.custoMinimo).toBe(69);
    expect(s.precoSugerido).toBe(96.6);
    expect(s.comOsSeusCustos).toBe(false);
    expect(s.semDistancia).toBe(false);
  });

  it("o que ele recebe é o preço sugerido já sem a taxa, e o lucro é sobre isso", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON);
    // 96,60 − 6 % = 90,80; 90,80 − 69 = 21,80.
    expect(s.recebeSePropuser).toBe(90.8);
    expect(s.lucroEstimado).toBe(21.8);
  });

  it("sem distância, o combustível fica a zero e diz-se", () => {
    const s = sugerirParaOProfissional(recolha, null, CLYON);
    expect(s.kmDeCarro).toBeNull();
    expect(s.custoCombustivel).toBe(0);
    expect(s.semDistancia).toBe(true);
    expect(s.pressupostos.join(" ")).toContain("sem distância conhecida");
  });

  it("numa mudança conta o percurso entre as moradas, não a ida e volta à base", () => {
    const s = sugerirParaOProfissional(
      { serviceType: "mudanca", percursoKm: 12, floor: "1", hasElevator: "yes" },
      40,
      CLYON,
    );
    expect(s.kmDeCarro).toBe(12);
    expect(s.custoCombustivel).toBe(6);
  });

  it("a etiqueta «por carga» acompanha o pedido", () => {
    expect(sugerirParaOProfissional({ ...recolha, baseDoPreco: "carga" }, 10, CLYON).porCarga).toBe(true);
    expect(sugerirParaOProfissional({ ...recolha, baseDoPreco: "total" }, 10, CLYON).porCarga).toBe(false);
  });
});

describe("a conta, com os números DELE", () => {
  it("o custo por km, a hora e a equipa do perfil mandam sobre a referência", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON, {
      custoKm: 0.4,
      custoHoraPessoa: 10,
      pessoasNaEquipa: 2,
    });
    expect(s.custoCombustivel).toBe(20); // 50 × 0,40
    expect(s.custoPessoal).toBe(20); // 1 h × 2 × 10
    expect(s.pessoas).toBe(2);
    expect(s.comOsSeusCustos).toBe(true);
    expect(s.pressupostos.join(" ")).toContain("que definiu no seu perfil");
  });

  it("um campo a null no perfil cai na referência da CLYON, campo a campo", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON, { custoKm: null, pessoasNaEquipa: 2 });
    expect(s.custoKm).toBe(0.5);
    expect(s.pessoas).toBe(2);
    expect(s.comOsSeusCustos).toBe(true);
  });

  it("aceita vírgula decimal, que é o que um teclado português escreve", () => {
    const s = sugerirParaOProfissional(recolha, 25, CLYON, { custoKm: Number("0,45".replace(",", ".")) });
    expect(s.custoKm).toBe(0.45);
  });
});

describe("a linha do pedido vira campos da conta", () => {
  it("lê as colunas e, do JSON do formulário, os campos que só alguns serviços têm", async () => {
    const { pedidoParaSugestaoDaLinha } = await import("./sugestao-para-o-profissional");
    const p = pedidoParaSugestaoDaLinha({
      serviceType: "mudanca",
      floor: "2",
      hasElevator: "no",
      parkingDistance: "near",
      description: "Casa T2",
      baseDoPreco: "total",
      rawOrderJson: JSON.stringify({
        entulhoState: "chao",
        entulhoQuantidade: "30",
        movingDistance: { distanceKm: 18.4 },
        destinationAccess: { floor: "3", hasElevator: "yes", parkingDistance: "far" },
      }),
    });
    expect(p.serviceType).toBe("mudanca");
    expect(p.entulhoEstado).toBe("chao");
    expect(p.entulhoQuantidade).toBe("30");
    expect(p.percursoKm).toBe(18.4);
    expect(p.andarDestino).toBe("3");
    expect(p.elevadorDestino).toBe("yes");
    expect(p.estacionamentoDestino).toBe("far");
    expect(p.baseDoPreco).toBe("total");
  });

  it("um JSON estragado não impede a conta — sai só com as colunas", async () => {
    const { pedidoParaSugestaoDaLinha } = await import("./sugestao-para-o-profissional");
    const p = pedidoParaSugestaoDaLinha({ serviceType: "recolha_moveis", rawOrderJson: "{nope" });
    expect(p.serviceType).toBe("recolha_moveis");
    expect(p.percursoKm).toBeNull();
    expect(p.entulhoQuantidade).toBeNull();
  });
});

describe("os parâmetros vêm do mapa do simulador", () => {
  it("lê as chaves certas e cai nos valores de referência quando faltam", () => {
    const p = parametrosDoMapa({
      custo_km: 0.55,
      custo_hora_pessoa: 10,
      num_pessoas_equipa: 2,
      overhead_por_servico: 20,
      margem_lucro: 0.5,
    });
    expect(p).toEqual({ custoKm: 0.55, custoHoraPessoa: 10, numPessoas: 2, overhead: 20, margem: 0.5 });
    expect(parametrosDoMapa({})).toEqual({ custoKm: 0.5, custoHoraPessoa: 9, numPessoas: 3, overhead: 17, margem: 0.4 });
  });
});
