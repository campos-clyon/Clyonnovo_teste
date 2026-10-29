import { describe, it, expect } from "vitest";
import dados from "./traducoes-fixas-da-vitoria.json";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import {
  COMO_CHEGA_O_PRECO,
  deOutraForma,
  entregarQuemDesiste,
  explicarDeNovo,
  fechoDoPedidoAberto,
  FICA_SEM_EFEITO,
  LEMBRETE_DO_PRECO,
  LEMBRETE_DO_RESUMO,
  mensagemDePedidoRegistado,
  NOME_DE_OUTRA_FORMA,
  notaDoPrecoPara,
  O_IVA_ESTA_INCLUIDO,
  OBRIGADA_PELAS_IMAGENS,
  PASSO_A_ALGUEM_DA_EQUIPA,
  perguntaDo,
  perguntaParaContinuar,
  resumo,
  SALTO_DA_PERGUNTA,
  type DadosDaRecolha,
  type PassoDaRecolha,
} from "./whatsapp-recolha";
import {
  agradecimento,
  apresentacao,
  boasVindasDeVolta,
  CLARO_QUE_SIM,
  desculpasPeloAtendimento,
  EM_QUE_POSSO_AJUDAR,
  PERGUNTA_ANOTADA,
  respostaADisponibilidade,
  respostaAHora,
} from "./voz-da-vitoria";
import { COMO_FUNCIONA } from "./perguntas-frequentes-da-vitoria";
import { SERVICE_CATEGORIES } from "./service-categories";

/**
 * AS TRADUÇÕES FIXAS COBREM O QUE A VITÓRIA DIZ — 28-10-2026 (decisão d35).
 *
 * Quando o tradutor falha, sai a tradução fixa; sem ela, a conversa passa à
 * equipa. Este teste gera as frases A PARTIR DO CÓDIGO (as perguntas, o
 * resumo, a confirmação…) e exige a tradução nas três línguas: uma frase da
 * Vitória que mude em português chumba aqui até a tradução ser revista.
 */

const LINGUAS = ["en", "fr", "es"] as const;
const AGORA = new Date("2026-10-28T10:00:00Z");

const RECOLHA: DadosDaRecolha = { serviceType: "recolha_monos", contactName: "Oliver" };
const MUDANCA: DadosDaRecolha = { serviceType: "mudanca", contactName: "Oliver" };
const ENTULHO: DadosDaRecolha = { serviceType: "recolha_entulho" };

const PASSOS: PassoDaRecolha[] = [
  "servico", "nome", "morada", "codigoPostal", "moradaDestino", "codigoPostalDestino", "andar", "elevador",
  "estacionamento", "andarDestino", "elevadorDestino", "estacionamentoDestino", "entulhoQuantidade", "quando",
  "descricao", "fatura", "nif",
];

function todasAsMensagens(): string[] {
  const m: string[] = [];
  for (const d of [RECOLHA, MUDANCA, ENTULHO, { ...RECOLHA, floor: "2" }, { ...RECOLHA, postalCode: "1950-123" }, { ...RECOLHA, city: "Lisboa" }]) {
    for (const p of PASSOS) {
      m.push(perguntaDo(p, d, false, AGORA), perguntaDo(p, d, true, AGORA), deOutraForma(p, d), explicarDeNovo(p, d), perguntaParaContinuar(p, d));
    }
  }
  for (const s of ["Bom dia", "Boa tarde", "Boa noite"]) m.push(apresentacao(s, null), apresentacao(s, "Oliver"));
  for (const passo of ["nome", "morada", "codigoPostal", "andar", "elevador", "estacionamento", "entulhoQuantidade", "quando", "descricao", "fatura"]) {
    m.push(agradecimento(passo, "Oliver"));
  }
  m.push(
    mensagemDePedidoRegistado(512, false, "Oliver"),
    mensagemDePedidoRegistado(512, true, null),
    mensagemDePedidoRegistado(512, false, "Oliver", true),
    fechoDoPedidoAberto(512),
    COMO_CHEGA_O_PRECO,
    LEMBRETE_DO_PRECO,
    O_IVA_ESTA_INCLUIDO,
    notaDoPrecoPara("Quanto custa? É com IVA?", "andar", false, "mudanca").trim(),
    COMO_FUNCIONA,
    LEMBRETE_DO_RESUMO,
    `${CLARO_QUE_SIM} ${EM_QUE_POSSO_AJUDAR}`,
    PERGUNTA_ANOTADA,
    PASSO_A_ALGUEM_DA_EQUIPA,
    FICA_SEM_EFEITO,
    "De nada. Qualquer coisa, é só dizer.",
    "Percebi o que me disse. Vou passar isto a um colega para confirmar tudo consigo, e ele fala-lhe já de seguida.",
    entregarQuemDesiste({ passo: "andar", dados: RECOLHA }).resposta,
    desculpasPeloAtendimento(null),
    desculpasPeloAtendimento("Oliver"),
    boasVindasDeVolta(null),
    boasVindasDeVolta("Oliver"),
    respostaADisponibilidade(true),
    respostaADisponibilidade(false),
    respostaAHora(true),
    respostaAHora(false),
    `${SALTO_DA_PERGUNTA} ${perguntaParaContinuar("quando", RECOLHA)}`,
    NOME_DE_OUTRA_FORMA,
    OBRIGADA_PELAS_IMAGENS,
  );
  return m.filter(Boolean);
}

/** Resumos com as formas todas: mudança, entulho, r/c, cave, elevador pequeno, por confirmar, NIF. */
function resumos(): string[] {
  const base: DadosDaRecolha = {
    serviceType: "recolha_monos",
    contactName: "Oliver",
    address: "Rua dos Choupos Brancos 17",
    postalCode: "1950-123",
    city: "Lisboa",
    floor: "3",
    hasElevator: "yes",
    parkingDistance: "far",
    metrosAtePorta: 50,
    quandoTexto: "sexta de manhã",
    dataDesejada: "2026-10-30T09:00:00.000Z",
    description: "uma cama com colchão",
    precisaFatura: true,
  };
  return [
    resumo(base),
    resumo({ ...base, metrosAtePorta: null, parkingDistance: "near", floor: "0", lado: "Esq", precisaFatura: false }),
    resumo({ ...base, metrosAtePorta: null, parkingDistance: null, floor: "-1", hasElevator: "small", nifFactura: "123456789" }),
    resumo({ ...base, quandoComTodas: "sexta 30/10 ou sábado 31/10; no máximo domingo 1/11" }),
    resumo({ ...base, quandoTexto: "sexta às 10h", dataDesejada: "2026-10-30T10:00:00.000Z" }),
    resumo({ ...base, dataDesejada: null, quandoTexto: null, urgency: "this_week" }),
    resumo({ ...base, serviceType: "recolha_entulho", entulhoQuantidade: "20 sacos", description: "20 sacos" }),
    resumo({
      ...base,
      serviceType: "mudanca",
      moradaDestino: "Rua das Gaivotas Mansas 3",
      codigoPostalDestino: "2800-123",
      localidadeDestino: "Almada",
      andarDestino: "2",
      elevadorDestino: "no",
      estacionamentoDestino: "near",
      clienteCarrega: true,
    }),
  ];
}

describe("as traduções fixas cobrem o que a Vitória diz", () => {
  for (const lingua of LINGUAS) {
    it(`as perguntas, as respostas e a confirmação — em ${lingua}`, () => {
      const faltam = todasAsMensagens().filter((m) => traducaoFixa(m, lingua) == null);
      expect(faltam).toEqual([]);
    });

    it(`os resumos, com os campos — em ${lingua}`, () => {
      for (const r of resumos()) expect(traducaoFixa(r, lingua), r).not.toBeNull();
    });
  }

  it("o resumo em inglês: rótulos, valores e datas traduzidos; o que é do cliente fica", () => {
    const en = traducaoFixa(resumos()[0], "en") ?? "";
    expect(en).toContain("Service: Bulky items removal");
    expect(en).toContain("Name: Oliver");
    expect(en).toContain("Address: Rua dos Choupos Brancos 17, 1950-123, Lisboa");
    expect(en).toContain("Floor: 3, lift: yes, parking at the door: the van stays about 50 m away");
    expect(en).toContain("When: Friday, 30 October, in the morning");
    expect(en).toContain("Description: uma cama com colchão");
    expect(en).toContain("Invoice: yes (with 23% VAT)");
    expect(en).toContain("reply YES");
    const r2 = traducaoFixa(resumos()[1], "en") ?? "";
    expect(r2).toContain("Floor: ground floor Esq, lift: yes, parking at the door: yes");
    expect(r2).toContain("Invoice: no");
    expect(traducaoFixa(resumos()[4], "en")).toContain("When: Friday, 30 October at 10:00");
    expect(traducaoFixa(resumos()[5], "en")).toContain("When: this week");
  });

  it("os nomes dos serviços estão todos, nas três línguas", () => {
    const comTraducao = new Set((dados.servicos as string[][]).map((l) => l[0]));
    for (const c of SERVICE_CATEGORIES) expect(comTraducao.has(c.label), c.label).toBe(true);
    const lista = perguntaDo("servico", {}, true, AGORA);
    // A mudança é a 9 desde 29-10-2026 (a garagem, o sótão e a cave entraram antes dela).
    expect(traducaoFixa(lista, "es")).toContain("9. Mudanza");
  });

  it("uma frase sem tradução fixa devolve null — e então a mensagem não sai", () => {
    expect(traducaoFixa("Obrigada, fica anotado no pedido: «e o espelho da casa de banho».", "en")).toBeNull();
    expect(traducaoFixa("O profissional Joaquim propõe 120 €.", "fr")).toBeNull();
  });

  it("em português, ou sem língua, devolve o texto como veio", () => {
    expect(traducaoFixa("Olá!", "pt")).toBe("Olá!");
    expect(traducaoFixa("Olá!", null)).toBe("Olá!");
  });
});

describe("as traduções são revistas e seguem a voz da Vitória", () => {
  const todas = [
    ...(dados.frases as string[][]),
    ...(dados.moldes as string[][]),
    ...(dados.servicos as string[][]),
    ...(dados.rotulos as string[][]),
    ...(dados.valores as string[][]),
    ...(dados.moldesDeValor as string[][]),
  ];

  it("cada linha tem as quatro línguas, sem vazios", () => {
    for (const l of todas) {
      expect(l).toHaveLength(4);
      for (const s of l) expect(s.trim().length, l[0]).toBeGreaterThan(0);
    }
  });

  it("assistente online — nunca «IA», «virtual», «bot» ou «robot», em língua nenhuma", () => {
    for (const l of todas) {
      for (const s of l.slice(1)) {
        // «AI»/«IA» em maiúsculas (o «ai-je» francês não conta); o resto em qualquer caixa.
        expect(s, s).not.toMatch(/\b(AI|IA)\b/);
        expect(s, s).not.toMatch(/\b(virtual|virtuelle?|bot|robot|chatbot)\b/i);
      }
    }
  });
});
