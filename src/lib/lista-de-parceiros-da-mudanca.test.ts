import { describe, it, expect } from "vitest";
import {
  AVALIACOES_PARA_A_NOTA,
  KIT_POR_TIPOLOGIA,
  MAXIMO_DE_ESCOLHIDOS,
  ORDENACAO,
  TEXTOS_DA_LISTA,
  cartaoDoParceiro,
  horasDaMudanca,
  horasDoParceiro,
  ordenarCartoes,
  porqueFicaDeFora,
  resumoDaMudanca,
  type CandidatoDaMudanca,
  type ContextoDaMudanca,
} from "./lista-de-parceiros-da-mudanca";
import { congelarTarifa, valorDaMudanca, type TarifaDasMudancas } from "./conta-da-mudanca";
import { HORAS_POR_TIPOLOGIA } from "./tabela-das-mudancas";
import { prazoDeResposta } from "./prazo-de-resposta-do-parceiro";
import { instanteEmLisboa } from "./hora-de-lisboa";

/*
 * A LISTA DOS PARCEIROS DE UMA MUDANÇA — 10-11-2026 (fase 2). As horas com 2
 * pessoas, quem entra na lista, as contas do cartão, a ordem e o prazo de
 * resposta. Pura: sem base nem rede.
 */

const TARIFA: TarifaDasMudancas = {
  precoHora2: 40,
  precoHora3: 55,
  minimoHoras: 3,
  precoKm: 0.5,
  kmMinimo: 10,
  kmMaximo: 80,
  caixa: 2,
  cartaoMetro: null,
  filmeRolo: 10,
  plasticoBolhaRolo: 20,
  aparecerNaLista: true,
};

function candidato(mais: Partial<CandidatoDaMudanca> = {}): CandidatoDaMudanca {
  return {
    id: 7,
    nome: "Mudanças Exemplo",
    isActive: true,
    estado: "aprovado",
    categorias: ["mudancas"],
    raioKm: 50,
    emiteFatura: true,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
    contaDeTeste: false,
    verificado: true,
    fotografia: null,
    tarifa: TARIFA,
    notaMedia: 4.84,
    avaliacoes: 5,
    ...mais,
  };
}

const CTX: ContextoDaMudanca = {
  tipologia: "T2",
  desmontagem: false,
  pessoas: 2,
  kmPercurso: 20,
  formaDePagamento: "na_plataforma",
  cidade: "Seixal",
};

describe("as horas da mudança", () => {
  it("com 3 pessoas, a tabela de sempre; com 2, quatro terços à meia hora acima", () => {
    expect(horasDaMudanca("T0", false, 3)).toBe(HORAS_POR_TIPOLOGIA.T0);
    expect(horasDaMudanca("T4+", false, 3)).toBe(HORAS_POR_TIPOLOGIA["T4+"]);
    // As da especificação do Produto: itens/T0/T1/T2/T3/T4+ = 4 / 4 / 4 / 5,5 / 7 / 9,5.
    expect(["itens", "T0", "T1", "T2", "T3", "T4+"].map((t) => horasDaMudanca(t as never, false, 2))).toEqual([
      4, 4, 4, 5.5, 7, 9.5,
    ]);
  });

  it("a desmontagem soma uma hora, e o mínimo do parceiro manda por baixo", () => {
    expect(horasDaMudanca("T2", true, 2)).toBe(6.5);
    expect(horasDaMudanca("T2", true, 3)).toBe(5);
    expect(horasDoParceiro(4, 5)).toBe(5);
    expect(horasDoParceiro(5.5, 3)).toBe(5.5);
  });

  it("sem tipologia conta-se a casa mais pequena", () => {
    expect(horasDaMudanca(null, false, 2)).toBe(horasDaMudanca("itens", false, 2));
  });
});

describe("quem entra na lista — a elegibilidade COMPLETA e o que é só da lista", () => {
  it("um parceiro aprovado, activo, de mudanças, dentro do raio e com tarifa entra", () => {
    expect(porqueFicaDeFora(candidato(), 12, CTX)).toBeNull();
  });

  it.each([
    ["inactivo", { isActive: false }],
    ["por aprovar", { estado: "pendente" }],
    ["sem a categoria das mudanças", { categorias: ["recolhas"] }],
  ])("%s fica de fora pela regra de sempre", (_n, mais) => {
    expect(porqueFicaDeFora(candidato(mais as Partial<CandidatoDaMudanca>), 12, CTX)).toBe("nao_elegivel");
  });

  it("fora do raio da base, ou sem distância medida, fica de fora", () => {
    expect(porqueFicaDeFora(candidato(), 60, CTX)).toBe("nao_elegivel");
    expect(porqueFicaDeFora(candidato(), null, CTX)).toBe("nao_elegivel");
  });

  it("com dívida em atraso, fica de fora de um pedido em dinheiro (e só desse)", () => {
    expect(porqueFicaDeFora({ ...candidato(), dividaEmAtraso: true }, 12, { ...CTX, formaDePagamento: "dinheiro" })).toBe(
      "nao_elegivel",
    );
    expect(porqueFicaDeFora({ ...candidato(), dividaEmAtraso: true }, 12, CTX)).toBeNull();
  });

  it("uma conta de teste nunca aparece ao cliente", () => {
    expect(porqueFicaDeFora(candidato({ contaDeTeste: true }), 12, CTX)).toBe("conta_de_teste");
  });

  it("sem tarifa, ou com «aparecer na lista» desligado, fica de fora", () => {
    expect(porqueFicaDeFora(candidato({ tarifa: null }), 12, CTX)).toBe("sem_tarifa");
    expect(porqueFicaDeFora(candidato({ tarifa: { ...TARIFA, aparecerNaLista: false } }), 12, CTX)).toBe("fora_da_lista");
  });

  it("um percurso acima da distância máxima dele fica de fora", () => {
    expect(porqueFicaDeFora(candidato({ tarifa: { ...TARIFA, kmMaximo: 15 } }), 12, CTX)).toBe("longe_demais");
    expect(porqueFicaDeFora(candidato({ tarifa: { ...TARIFA, kmMaximo: 20 } }), 12, CTX)).toBeNull();
  });

  it("com 3 pessoas, quem não faz com 3 sai", () => {
    const sem3 = candidato({ tarifa: { ...TARIFA, precoHora3: null } });
    expect(porqueFicaDeFora(sem3, 12, { ...CTX, pessoas: 3 })).toBe("sem_equipa_de_3");
    expect(porqueFicaDeFora(sem3, 12, CTX)).toBeNull();
  });
});

describe("o cartão", () => {
  const agora = new Date("2026-11-10T10:00:00Z");
  const c = candidato();
  const cartao = cartaoDoParceiro({ ...c, tarifa: TARIFA }, CTX, "id-opaco", agora)!;

  it("o preço da hora com IVA e o sem IVA ao lado, nunca sozinho", () => {
    expect(cartao.precoHora[2].semIvaCent).toBe(4000);
    expect(cartao.precoHora[2].comIvaCent).toBe(4920);
    expect(cartao.precoHora[2].texto).toMatch(/49,20.*com IVA.*40,00.*sem IVA/);
    expect(cartao.precoHora[3]?.comIvaCent).toBe(6765);
    expect(cartao.fazComTres).toBe(true);
  });

  it("o material por unidade com IVA, sem taxa; o que ele não fornece não aparece", () => {
    const caixa = cartao.materiais.find((m) => m.chave === "caixa")!;
    expect(caixa.semIvaCent).toBe(200);
    expect(caixa.comIvaCent).toBe(246);
    expect(cartao.materiais.some((m) => m.chave === "cartaoMetro")).toBe(false);
  });

  it("a estimativa é a de valorDaMudanca, com as horas de 2 pessoas e os km do percurso", () => {
    const conta = valorDaMudanca(congelarTarifa(TARIFA, undefined, agora), { pessoas: 2, horas: 5.5, km: 20 });
    expect(conta.ok).toBe(true);
    if (!conta.ok) return;
    expect(cartao.horas).toBe(5.5);
    expect(cartao.estimativa.comIvaCent).toBe(conta.totalCent);
    expect(cartao.estimativa.semIvaCent).toBe(conta.semIvaCent);
    // 5,5 h × 40 + 20 km × 0,50 = 230,00 € sem IVA → 282,90 € com IVA.
    expect(conta.semIvaCent).toBe(23000);
    expect(conta.totalCent).toBe(28290);
  });

  it("o kit por alto vem da tabela de referência, só com o que ele fornece", () => {
    const kit = KIT_POR_TIPOLOGIA.T2;
    expect(cartao.kit.linhas.map((l) => [l.nome, l.quantidade])).toEqual([
      ["Caixas", kit.caixas],
      ["Filme", kit.filmeRolos],
      ["Plástico bolha", kit.plasticoBolhaRolos],
    ]);
    // 20 × 2 + 2 × 10 + 1 × 20 = 80 € sem IVA.
    expect(cartao.kit.total?.semIvaCent).toBe(8000);
    expect(cartao.estimativaComKit.semIvaCent).toBe(23000 + 8000);
    const t3 = cartaoDoParceiro({ ...c, tarifa: TARIFA }, { ...CTX, tipologia: "T3" }, "x", agora)!;
    expect(t3.kit.naoFornece).toEqual(["Cartão"]);
  });

  it("a nota só com 3 avaliações; antes, «Novo na CLYON»; a do Google ainda não", () => {
    expect(cartao.nota?.media).toBe(4.8);
    expect(cartao.novo).toBeNull();
    const novo = cartaoDoParceiro({ ...candidato({ avaliacoes: AVALIACOES_PARA_A_NOTA - 1 }), tarifa: TARIFA }, CTX, "y", agora)!;
    expect(novo.nota).toBeNull();
    expect(novo.novo).toBe("Novo na CLYON");
    expect(cartao.notaGoogle).toBeNull();
  });

  it("o selo só com as três confirmações", () => {
    expect(cartao.selo).toBe("Parceiro verificado");
    const sem = cartaoDoParceiro({ ...candidato({ verificado: false }), tarifa: TARIFA }, CTX, "z", agora)!;
    expect(sem.selo).toBeNull();
  });

  it("SEGURANÇA: o cartão não leva contactos, morada, número da base nem Google", () => {
    const texto = JSON.stringify(cartao);
    for (const chave of ["email", "telefone", "phone", "morada", "address", "providerId", "baseLat", "baseLng", "placeId"]) {
      expect(texto).not.toContain(`"${chave}"`);
    }
    expect(texto).not.toMatch(/google\.|maps\./i);
    expect(cartao.id).toBe("id-opaco");
  });
});

describe("a ordem e a frase «Como ordenamos»", () => {
  const agora = new Date("2026-11-10T10:00:00Z");
  const mk = (id: string, precoHora2: number, nota: number | null) =>
    cartaoDoParceiro({ ...candidato({ notaMedia: nota, avaliacoes: nota == null ? 0 : 5 }), tarifa: { ...TARIFA, precoHora2 } }, CTX, id, agora)!;

  it("estimativa crescente; no empate, a nota mais alta primeiro; sem nota por último", () => {
    const ordem = ordenarCartoes([mk("caro", 60, 5), mk("barato-sem-nota", 35, null), mk("barato-4", 35, 4), mk("barato-5", 35, 5)]);
    expect(ordem.map((c) => c.id)).toEqual(["barato-5", "barato-4", "barato-sem-nota", "caro"]);
  });

  it("os parâmetros vão na resposta, e ninguém paga para subir", () => {
    expect(ORDENACAO.criterio).toBe("estimativa_total_crescente");
    expect(ORDENACAO.desempate).toBe("nota_clyon_decrescente");
    expect(ORDENACAO.pago).toBe(false);
    expect(ORDENACAO.frase).toMatch(/Nenhum parceiro paga/);
  });
});

describe("os textos do ecrã", () => {
  it("o resumo diz a casa, o caminho e as horas", () => {
    expect(resumoDaMudanca("T2", "Seixal", "Almada", 5.5, 2)).toBe("T2 · Seixal → Almada · cerca de 5,5 h com 2 pessoas");
  });

  it("até 3, e as frases da especificação", () => {
    expect(MAXIMO_DE_ESCOLHIDOS).toBe(3);
    expect(TEXTOS_DA_LISTA.semParceiros).toBe("Ainda não temos parceiros de mudanças com preço para esta zona.");
    expect(TEXTOS_DA_LISTA.procurarMais).toBe("Pedir também à CLYON que procure mais parceiros");
    expect(TEXTOS_DA_LISTA.recomendaTres).toBe("Para T3 ou maior recomendamos 3 pessoas.");
  });
});

describe("o prazo de resposta do parceiro — 3 h entre as 8h e as 21h de Lisboa", () => {
  const em = (t: string) => instanteEmLisboa(t) as Date;

  it("a meio do dia, três horas", () => {
    expect(prazoDeResposta(em("2026-11-10T10:00")).toISOString()).toBe(em("2026-11-10T13:00").toISOString());
  });

  it("perto das 21h, o que falta passa para as 8h do dia seguinte", () => {
    expect(prazoDeResposta(em("2026-11-10T19:30")).toISOString()).toBe(em("2026-11-11T09:30").toISOString());
  });

  it("à noite e de madrugada, conta a partir das 8h", () => {
    expect(prazoDeResposta(em("2026-11-10T22:15")).toISOString()).toBe(em("2026-11-11T11:00").toISOString());
    expect(prazoDeResposta(em("2026-11-11T06:00")).toISOString()).toBe(em("2026-11-11T11:00").toISOString());
  });

  it("no Verão também (o relógio é o de Lisboa, não o do servidor)", () => {
    expect(prazoDeResposta(em("2026-07-01T20:00")).toISOString()).toBe(em("2026-07-02T10:00").toISOString());
  });
});
