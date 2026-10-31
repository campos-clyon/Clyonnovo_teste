import { describe, it, expect } from "vitest";
import {
  type EstadoDaRecolha,
  perguntaDo,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  resumo,
} from "./whatsapp-recolha";
import { O_QUE_ELA_FAZ, PERGUNTA_ANOTADA } from "./voz-da-vitoria";
import { passoDaPergunta } from "./reler-a-conversa";

/**
 * A CONVERSA DO TOMÉ — 13-10-2026, às 17:35 de Lisboa (18:35 na captura), já
 * com a Vitória. O dono, a ver a conversa:
 *
 * O caso é verdadeiro; o nome, a morada, o código postal e a hora são
 * INVENTADOS (o repositório é público — 31-10-2026, d1).
 *
 *   «Ela não precisa de dizer "Muito prazer". (…) Não quero que cite a
 *   Miragem nem dê explicações sobre a factura: apenas pergunte se deseja. A
 *   assistente deve informar que irá apenas recolher as informações do pedido
 *   para os colegas avaliarem e darem o orçamento.»
 *
 * E o que a conversa mostrou: «Vocês também vendem?» levou «Peço desculpa,
 * não apanhei bem»; «Não quero vender só doar» foi lido como um não à factura.
 */

const AGORA = new Date("2026-10-13T16:35:00Z");

const MENSAGENS = [
  "Cama de casal 4 gavetas",
  "Tomé Castanhal",
  "Nossa morada\nRua arquiteto Bernardo Telhado sobral n 5 3.ºB\n2845-321 amora",
  "Sem elevador",
  "Vocês também vendem ?",
  "20 metros da porta",
  "Sábado às 10h da manhã",
  "Não quero vender só doar",
];

function falaComOTome() {
  let estado: EstadoDaRecolha = recolhaNova();
  const disse: string[] = [];
  const estados: EstadoDaRecolha[] = [];
  MENSAGENS.forEach((m, i) => {
    const r = responderNaRecolha(estado, m, AGORA, i > 0, false, { fotos: 2 });
    estado = r.estado;
    disse.push(r.resposta);
    estados.push(r.estado);
  });
  return { estado, disse, estados };
}

describe("a conversa do Tomé", () => {
  it("a Vitória diz logo ao que vem: anotar o pedido e enviá-lo aos profissionais verificados, que dão o preço deles", () => {
    const { disse } = falaComOTome();
    expect(disse[0]).toContain("Aqui é a Vitória, assistente online da CLYON");
    expect(disse[0]).toContain(O_QUE_ELA_FAZ);
    expect(O_QUE_ELA_FAZ).toMatch(/anotar o seu pedido e enviá-lo aos parceiros verificados da sua zona, que lhe respondem com o preço deles/);
  });

  it("sem «Muito prazer» — agradece o nome, e segue", () => {
    const { disse } = falaComOTome();
    expect(disse.join("\n")).not.toMatch(/Muito prazer/);
    expect(disse[1]).toMatch(/^Obrigada, Tomé!/);
  });

  it("a morada lê-se sem o «Nossa morada»", () => {
    const { estados } = falaComOTome();
    const d = estados[2].dados;
    expect(d.address).toMatch(/^Rua arquiteto Bernardo Telhado sobral n 5/);
    expect(d.floor).toBe("3");
    expect(d.postalCode).toBe("2845-321");
  });

  it("«Vocês também vendem?» fica anotada para a equipa — sem «não apanhei»", () => {
    const { disse, estados } = falaComOTome();
    expect(disse[4]).toContain(PERGUNTA_ANOTADA);
    expect(disse[4]).not.toMatch(/não apanhei/);
    expect(estados[4].passo).toBe("estacionamento");
  });

  it("«20 metros da porta» é estacionar perto, e não a medida de um móvel", () => {
    const { estados } = falaComOTome();
    expect(estados[5].dados.parkingDistance).toBe("near");
    expect(estados[5].dados.description ?? "").not.toContain("20 metros");
  });

  it("a fatura pergunta-se com o IVA que se aplica — sem a Miragem e sem o NIF", () => {
    /*
     * Até 17-10-2026 era só «Deseja factura?». O dono, depois da Odete
     * perguntar «Sem fatura é o mesmo valor?»: «quero que essa resposta
     * venha com a % do IVA que será aplicado».
     */
    const { disse, estados } = falaComOTome();
    expect(estados[6].passo).toBe("fatura");
    expect(disse[6]).toMatch(/Deseja fatura\? \(aplica-se IVA de 23%\)$/);
    expect(disse.join("\n")).not.toMatch(/Miragem|NIF/);
    expect(perguntaDo("fatura", {})).toBe("Deseja fatura? (aplica-se IVA de 23%)");
  });

  it("«Não quero vender só doar» não é um não à factura — fica no pedido, e a pergunta segue", () => {
    const { estados, disse } = falaComOTome();
    expect(estados[7].dados.precisaFatura).toBeUndefined();
    expect(estados[7].dados.description).toContain("Não quero vender só doar");
    expect(disse[7]).toMatch(/fica anotado[\s\S]*Deseja fatura\?/);
  });

  it("e pelo caminho do Gemini também", () => {
    const { estados } = falaComOTome();
    const pergunta = responderComCompreensao(
      { passo: "estacionamento", dados: { ...estados[3].dados } },
      { intencao: "informar", campos: {} },
      AGORA,
      { texto: "Vocês também vendem ?" },
    );
    expect(pergunta.resposta).toContain(PERGUNTA_ANOTADA);
    const doar = responderComCompreensao(
      { passo: "fatura", dados: { ...estados[6].dados } },
      { intencao: "informar", campos: {} },
      AGORA,
      { texto: "Não quero vender só doar" },
    );
    expect(doar.estado.dados.precisaFatura).toBeUndefined();
    expect(doar.estado.dados.description).toContain("só doar");
  });

  it("o resumo diz a factura como se perguntou", () => {
    const { estados } = falaComOTome();
    const r = resumo({ ...estados[7].dados, precisaFatura: true });
    expect(r).toContain("Fatura: sim (com IVA de 23%)");
    expect(r).not.toMatch(/NIF|Miragem/);
    expect(resumo({ ...estados[7].dados, precisaFatura: false })).toContain("Fatura: não");
  });

  it("a pergunta nova reconhece-se no fio", () => {
    expect(passoDaPergunta("Perfeito, fica anotado. Deseja factura?")).toBe("fatura");
    // A de 17-10-2026 também — o fio guarda as duas.
    expect(passoDaPergunta("Perfeito, fica anotado. Deseja fatura? (aplica-se IVA de 23%)")).toBe("fatura");
    expect(passoDaPergunta("Peço desculpa, não percebi bem: deseja fatura? (aplica-se IVA de 23%)")).toBe("fatura");
  });
});
