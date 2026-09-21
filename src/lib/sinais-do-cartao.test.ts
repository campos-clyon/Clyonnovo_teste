import { describe, it, expect } from "vitest";
import {
  valorNoCartao,
  bomPorKmDe,
  paraOsSinaisDe,
  type Separador,
} from "@/app/profissionais/painel/sinais-do-cartao";
import type { Pedido } from "@/app/profissionais/painel/tipos";
import type { SugestaoParaOProfissional } from "@/lib/sugestao-para-o-profissional";
import { porQuilometro, sinaisDoTrabalho } from "./sinais-do-trabalho";

/**
 * O QUE O CARTÃO MOSTRA, E CONTRA O QUE O COMPARA — a correr, e não a ler.
 *
 * Este ficheiro existe por uma medição. Enquanto estas três funções viveram
 * dentro de `Trabalhos.tsx` — que começa por `"use client"` e exporta só o
 * componente — nenhum teste lhes conseguia chamar, e o que havia em vez disso
 * eram asserções sobre o TEXTO do ficheiro.
 *
 * Contaram-se dez maneiras diferentes de partir a `bomPorKmDe`. Nove passavam
 * nos 295 testes que lêem esse ficheiro E no compilador — incluindo devolver
 * `s.custoKm`, que é precisamente o erro de unidades que esta alteração
 * existiu para recusar. Cada uma dessas nove tem aqui em baixo um teste que a
 * apanha, pelo valor e não pelas palavras.
 */

/** O que estas funções realmente lêem de um pedido. O resto é enchimento. */
type OQueContaNoPedido = {
  valorDaClyon?: number | null;
  sugestao?: SugestaoParaOProfissional | null;
  distanciaKm: number | null;
  recebeSeAceitar: number | null;
};

const PEDIDO_VAZIO = {
  negociacaoId: 1,
  pedidoId: 320,
  estado: "aberta",
  fase: "a_negociar",
  diasAteLibertar: null,
  provaJson: null,
  propostas: null,
  actualizadoEm: "2026-09-21T10:00:00.000Z",
  execucaoEnviadaEm: null,
  confirmadoEm: null,
  pagoEm: null,
  avaliadoEm: null,
  arquivadoEm: null,
  estrelas: null,
  valorAcordado: null,
  serviceType: "recolha_moveis",
  city: "Algueirão",
  urgency: "flexible",
  description: null,
  filesJson: null,
  floor: null,
  hasElevator: null,
  parkingDistance: null,
  precisaFatura: false,
  precisaGuiaTransporte: false,
  querPagar: null,
  recebeSeFechado: null,
  morada: null,
  contactoNome: null,
  contactoTelefone: null,
} satisfies Omit<Pedido, keyof OQueContaNoPedido>;

const umPedido = (c: OQueContaNoPedido): Pedido => ({ ...PEDIDO_VAZIO, ...c });

/**
 * Uma sugestão com números DISTINTOS uns dos outros, de propósito.
 *
 * `custoMinimo` (100) e `recebeSePropuser` (150) têm de ser diferentes, senão
 * trocar um pelo outro no código não muda resultado nenhum e o teste não vale
 * nada. `custoKm` (0,80) idem — é o número que o pedido literal do dono
 * mandava usar, e que não se pode confundir com os outros.
 */
const umaSugestao = (c: Partial<SugestaoParaOProfissional> = {}): SugestaoParaOProfissional =>
  ({
    horas: 2,
    pessoas: 3,
    custoHoraPessoa: 10,
    custoKm: 0.8,
    kmDeCarro: 20,
    custoCombustivel: 16,
    custoPessoal: 60,
    custosFixos: 23.83,
    seguroDeRisco: 4.56,
    riscoPercent: 6,
    custoMinimo: 100,
    margem: 0.5,
    precoSugerido: 159.57,
    recebeSePropuser: 150,
    lucroEstimado: 50,
    porCarga: false,
    comOsSeusCustos: true,
    semDistancia: false,
    pressupostos: [],
    ...c,
  }) satisfies SugestaoParaOProfissional;

describe("o número que o cartão põe em cima", () => {
  it("nos novos é o da CLYON, e a conta dele é o suplente", () => {
    const comONosso = umPedido({
      valorDaClyon: 329,
      sugestao: umaSugestao(),
      distanciaKm: 15.4,
      recebeSeAceitar: 200,
    });
    expect(valorNoCartao(comONosso, "novos")).toBe(329);

    // Sem o nosso, entra a conta dele — e não o que o cliente quer pagar.
    const semONosso = umPedido({
      valorDaClyon: null,
      sugestao: umaSugestao(),
      distanciaKm: 15.4,
      recebeSeAceitar: 200,
    });
    expect(valorNoCartao(semONosso, "novos")).toBe(150);

    // E sem nenhum dos dois, o cartão fica com o do cliente (o `null` daqui
    // faz o espalhamento condicional não escrever nada por cima).
    expect(
      valorNoCartao(umPedido({ distanciaKm: 15.4, recebeSeAceitar: 200 }), "novos"),
    ).toBeNull();
  });

  it("fora dos novos não manda nada — e isso é o que salva o €/km", () => {
    /*
     * A ARMADILHA QUE ISTO GUARDA.
     *
     * Em `paraOsSinaisDe` o espalhamento é condicional. Escrito sem a
     * condição — `recebeSeAceitar: emCima` — apagaria com `null` o valor do
     * cliente em todos os separadores que não são «novos», e é em
     * «negociação» que o €/km e o «bem pago» ainda têm de aparecer. O
     * compilador não apanha isso: `recebeSeAceitar` é `number | null`.
     */
    const p = umPedido({ valorDaClyon: 329, distanciaKm: 10, recebeSeAceitar: 200 });
    for (const s of ["negociacao", "contratados", "terminados", "recusados", "arquivados"] as Separador[]) {
      expect(valorNoCartao(p, s)).toBeNull();
      expect(paraOsSinaisDe(p, s).recebeSeAceitar).toBe(200);
      expect(porQuilometro(paraOsSinaisDe(p, s))).toBe(20);
    }
    // E nos novos é o da CLYON que passa a mandar nos sinais.
    expect(paraOsSinaisDe(p, "novos").recebeSeAceitar).toBe(329);
  });
});

describe("a fronteira de «bem pago» feita com os custos dele", () => {
  const base = {
    valorDaClyon: 300,
    distanciaKm: 10,
    recebeSeAceitar: 200,
  };

  it("é o que ele receberia se propusesse — a dividir pela distância de IDA", () => {
    /*
     * 150 € a 10 km dá 15 €/km. Três coisas ficam presas neste número:
     *
     *   · é `recebeSePropuser` (150) e não `custoMinimo` (100) — 15 e não 10;
     *   · é `distanciaKm` e não ida e volta — 15 e não 7,5;
     *   · é a conta inteira e não `custoKm` (0,80), que era o pedido literal
     *     e o erro de unidades que esta alteração recusou.
     */
    const p = umPedido({ ...base, sugestao: umaSugestao() });
    expect(bomPorKmDe(p, "novos")).toBe(15);
  });

  it("sem sugestão, sem custos dele ou sem distância, vale a fronteira da casa", () => {
    // Cada uma destas devolve null, e `limiarDeBomPago` cai nos 12 €/km
    // medidos na base de dados.
    expect(bomPorKmDe(umPedido({ ...base, sugestao: null }), "novos")).toBeNull();
    expect(
      bomPorKmDe(umPedido({ ...base, sugestao: umaSugestao({ comOsSeusCustos: false }) }), "novos"),
    ).toBeNull();
    expect(
      bomPorKmDe(umPedido({ ...base, sugestao: umaSugestao({ semDistancia: true }) }), "novos"),
    ).toBeNull();
    // Sem distância medida não há divisão possível.
    expect(
      bomPorKmDe(umPedido({ ...base, distanciaKm: null, sugestao: umaSugestao() }), "novos"),
    ).toBeNull();
  });

  it("quando o número em cima JÁ É a conta dele, não se compara com ela própria", () => {
    /*
     * Nos «novos» sem valor da CLYON, o cartão mostra `recebeSePropuser`. A
     * fronteira também seria `recebeSePropuser`. Igual a si próprio, o
     * distintivo acendia em todos esses cartões e deixava de dizer nada.
     */
    const semONosso = umPedido({ ...base, valorDaClyon: null, sugestao: umaSugestao() });
    expect(bomPorKmDe(semONosso, "novos")).toBeNull();
    // Mas noutro separador o número em cima é o do cliente, e aí compara-se.
    expect(bomPorKmDe(semONosso, "negociacao")).toBe(15);
  });

  it("e é isto que chega aos sinais, sem intermediários", () => {
    /*
     * A ligação entre a fronteira e o distintivo, ponta a ponta: 300 € a
     * 10 km são 30 €/km, acima dos 15 dele — acende. Com uma fronteira de
     * 40 €/km, já não.
     */
    const p = umPedido({ ...base, sugestao: umaSugestao() });
    expect(paraOsSinaisDe(p, "novos").bomPorKm).toBe(15);
    expect(sinaisDoTrabalho(paraOsSinaisDe(p, "novos")).map((s) => s.chave)).toContain("bem_pago");

    const caro = umPedido({ ...base, sugestao: umaSugestao({ recebeSePropuser: 400 }) });
    expect(paraOsSinaisDe(caro, "novos").bomPorKm).toBe(40);
    expect(sinaisDoTrabalho(paraOsSinaisDe(caro, "novos")).map((s) => s.chave))
      .not.toContain("bem_pago");
  });

  it("uma fronteira dele abaixo da medida não acende o que a casa não acendia", () => {
    /*
     * O caso que quase passou. Um profissional de custos baixos tem uma
     * fronteira de 3,6 €/km; o trabalho rende 8 €/km. Pela conta dele isto
     * era «bem pago» — mas 8 €/km está dentro da família comum que os 12 da
     * casa foram medidos para não marcar, e o distintivo passaria a estar em
     * quase todos os cartões. Ver `limiarDeBomPago`.
     */
    const barato = umPedido({
      valorDaClyon: 80,
      distanciaKm: 10,
      recebeSeAceitar: 80,
      sugestao: umaSugestao({ recebeSePropuser: 36 }),
    });
    expect(bomPorKmDe(barato, "novos")).toBe(3.6);
    expect(sinaisDoTrabalho(paraOsSinaisDe(barato, "novos")).map((s) => s.chave))
      .not.toContain("bem_pago");
  });
});
