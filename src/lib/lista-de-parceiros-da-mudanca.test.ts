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
import { HORAS_COM_DUAS_PESSOAS, HORAS_COM_TRES_PESSOAS, TIPOLOGIAS } from "./tabela-das-mudancas";
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

describe("as horas da mudança — em intervalo (11-11-2026)", () => {
  it("com 3 pessoas: itens 3, T0 3–4, T1 4–5, T2 5–7, T3 7–9, T4+ 9–12", () => {
    expect(TIPOLOGIAS.map((t) => horasDaMudanca(t, false, 3))).toEqual([[3, 3], [3, 4], [4, 5], [5, 7], [7, 9], [9, 12]]);
    expect(TIPOLOGIAS.map((t) => HORAS_COM_TRES_PESSOAS[t])).toEqual([[3, 3], [3, 4], [4, 5], [5, 7], [7, 9], [9, 12]]);
  });

  it("com 2 pessoas: itens 3, T0 4–5, T1 5–6,5, T2 6,5–9; T3 e T4+ não se oferecem (contam como 3)", () => {
    expect(TIPOLOGIAS.map((t) => HORAS_COM_DUAS_PESSOAS[t])).toEqual([[3, 3], [4, 5], [5, 6.5], [6.5, 9], null, null]);
    expect(TIPOLOGIAS.map((t) => horasDaMudanca(t, false, 2))).toEqual([[3, 3], [4, 5], [5, 6.5], [6.5, 9], [7, 9], [9, 12]]);
  });

  it("a desmontagem soma por tipologia aos dois extremos: itens +0,5, T0 +1, T1 +1, T2 +1,5, T3 +2, T4+ +3", () => {
    expect(TIPOLOGIAS.map((t) => horasDaMudanca(t, true, 3))).toEqual([[3.5, 3.5], [4, 5], [5, 6], [6.5, 8.5], [9, 11], [12, 15]]);
    expect(horasDaMudanca("T2", true, 2)).toEqual([8, 10.5]);
  });

  it("o mínimo do parceiro manda por baixo, nos dois extremos", () => {
    expect(horasDoParceiro([3, 4], 5)).toEqual([5, 5]);
    expect(horasDoParceiro([3, 4], 3.5)).toEqual([3.5, 4]);
    expect(horasDoParceiro([5, 7], 3)).toEqual([5, 7]);
  });

  it("sem tipologia conta-se a casa mais pequena", () => {
    expect(horasDaMudanca(null, false, 2)).toEqual(horasDaMudanca("itens", false, 2));
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

  it("a estimativa é a de valorDaMudanca nos dois extremos do intervalo, com a proteção e os km do percurso", () => {
    const t = congelarTarifa(TARIFA, undefined, agora);
    // T2 com 2 pessoas: 6,5–9 h; a proteção do T2 é 3 rolos de filme + 1 rolo de cartão (ele não fornece cartão).
    const min = valorDaMudanca(t, { pessoas: 2, horas: 6.5, km: 20, materiais: { filmeRolos: 3 } });
    const max = valorDaMudanca(t, { pessoas: 2, horas: 9, km: 20, materiais: { filmeRolos: 3 } });
    if (!min.ok || !max.ok) throw new Error("conta");
    expect([cartao.horasMinimo, cartao.horasMaximo, cartao.horas]).toEqual([6.5, 9, 7.75]);
    expect(cartao.horasTexto).toBe("Entre 6,5 e 9 h com 2 pessoas");
    expect(cartao.estimativa.minimo).toEqual({ semIvaCent: min.semIvaCent, comIvaCent: min.totalCent });
    expect(cartao.estimativa.maximo).toEqual({ semIvaCent: max.semIvaCent, comIvaCent: max.totalCent });
    // 6,5 h × 40 + 20 km × 0,50 + 3 × 10 = 300 € sem IVA; 9 h → 400 €.
    expect([min.semIvaCent, max.semIvaCent]).toEqual([30000, 40000]);
    // Ordena-se pelo meio.
    expect(cartao.estimativa.comIvaCent).toBe(Math.round((min.totalCent + max.totalCent) / 2));
    // O Intl põe um espaço que não parte a linha antes do €.
    expect(cartao.estimativa.texto.replace(/\u00a0/g, " ")).toBe("Estimativa: 369–492 € com IVA (300–400 € sem IVA), com a proteção");
  });

  it("a proteção entra por omissão (só o que ele fornece); as caixas e o embalamento ficam à parte", () => {
    expect(cartao.protecao).toBe(cartao.kit);
    expect(cartao.protecao.linhas.map((l) => [l.nome, l.quantidade])).toEqual([["Filme", 3]]);
    expect(cartao.protecao.naoFornece).toEqual(["Cartão"]);
    expect(cartao.protecao.texto).toMatch(/^Proteção para um T2, já na estimativa: 3 rolos de filme — .* · não fornece: cartão$/);
    // T2: 45 caixas + 2 rolos de plástico bolha = 45 × 2 + 2 × 20 = 130 € sem IVA, por cima.
    expect(cartao.embalamento?.linhas.map((l) => [l.nome, l.quantidade])).toEqual([["Caixas", 45], ["Plástico bolha", 2]]);
    expect(cartao.embalamento?.total?.semIvaCent).toBe(13000);
    expect(cartao.estimativaComEmbalamento?.minimo.semIvaCent).toBe(30000 + 13000);
    expect(cartao.estimativaComEmbalamento?.texto.replace(/\u00a0/g, " ")).toMatch(/^Com caixas e embalamento: \d+–\d+ € com IVA \(430–530 € sem IVA\)$/);
    // A app publicada lê «Com o kit: …».
    expect(cartao.estimativaComKit.texto).toMatch(/, se também precisar de caixas e embalamento$/);
    // Alguns móveis não levam caixas.
    const itens = cartaoDoParceiro({ ...c, tarifa: TARIFA }, { ...CTX, tipologia: "itens" }, "i", agora)!;
    expect(itens.embalamento).toBeNull();
    expect(itens.estimativaComEmbalamento).toBeNull();
    // T3: filme 4 + cartão 10 m + bolha 1.
    const t3 = cartaoDoParceiro({ ...c, tarifa: TARIFA }, { ...CTX, tipologia: "T3" }, "x", agora)!;
    expect(t3.protecao.linhas.map((l) => [l.nome, l.quantidade])).toEqual([["Filme", 4], ["Plástico bolha", 1]]);
    expect(KIT_POR_TIPOLOGIA.T3).toEqual({ filmeRolos: 4, cartaoMetros: 10, plasticoBolhaRolos: 1 });
    expect(KIT_POR_TIPOLOGIA["T4+"]).toEqual({ filmeRolos: 6, cartaoMetros: 20, plasticoBolhaRolos: 1 });
  });

  it("num T3 ou maior, 2 pessoas pedidas contam como 3 — e o «2» leva o preço de 3 para a app publicada", () => {
    const t3 = cartaoDoParceiro({ ...c, tarifa: TARIFA }, { ...CTX, tipologia: "T3", pessoas: 2 }, "x", agora)!;
    expect(t3.pessoas).toBe(3);
    expect([t3.horasMinimo, t3.horasMaximo]).toEqual([7, 9]);
    expect(t3.horasTexto).toBe("Entre 7 e 9 h com 3 pessoas");
    expect(t3.precoHora[2].comIvaCent).toBe(t3.precoHora[3]?.comIvaCent);
    // Quem não faz com 3 não entra numa casa destas, mesmo com 2 pedidas.
    const sem3 = candidato({ tarifa: { ...TARIFA, precoHora3: null } });
    expect(porqueFicaDeFora(sem3, 12, { ...CTX, tipologia: "T3", pessoas: 2 })).toBe("sem_equipa_de_3");
    expect(porqueFicaDeFora(sem3, 12, { ...CTX, tipologia: "T2", pessoas: 2 })).toBeNull();
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

  it("estimativa crescente (o meio do intervalo); no empate, a nota mais alta primeiro; sem nota por último", () => {
    const ordem = ordenarCartoes([mk("caro", 60, 5), mk("barato-sem-nota", 35, null), mk("barato-4", 35, 4), mk("barato-5", 35, 5)]);
    expect(ordem.map((c) => c.id)).toEqual(["barato-5", "barato-4", "barato-sem-nota", "caro"]);
    // O meio decide: um mínimo mais baixo não passa à frente de um meio mais baixo.
    const a = { ...mk("a", 40, 5), estimativa: { ...mk("a", 40, 5).estimativa, comIvaCent: 500, minimo: { semIvaCent: 1, comIvaCent: 1 } } };
    const b = { ...mk("b", 40, 5), estimativa: { ...mk("b", 40, 5).estimativa, comIvaCent: 400 } };
    expect(ordenarCartoes([a, b]).map((x) => x.id)).toEqual(["b", "a"]);
    expect(ORDENACAO.frase).toMatch(/o meio do intervalo de horas/);
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
    expect(resumoDaMudanca("T2", "Seixal", "Almada", [6.5, 9], 2)).toBe("T2 · Seixal → Almada · entre 6,5 e 9 h com 2 pessoas");
    expect(resumoDaMudanca("T3", "Seixal", "Almada", [7, 9], 2)).toBe("T3 · Seixal → Almada · entre 7 e 9 h com 3 pessoas");
    expect(resumoDaMudanca("itens", "Seixal", null, [3, 3], 2)).toBe("Alguns móveis · Seixal · 3 h com 2 pessoas");
  });

  it("até 3, e as frases da especificação", () => {
    expect(MAXIMO_DE_ESCOLHIDOS).toBe(3);
    expect(TEXTOS_DA_LISTA.semParceiros).toBe("Ainda não temos parceiros de mudanças com preço para esta zona.");
    expect(TEXTOS_DA_LISTA.procurarMais).toBe("Pedir também à CLYON que procure mais parceiros");
    expect(TEXTOS_DA_LISTA.recomendaTres).toBe("Num T3 ou maior a mudança faz-se com 3 pessoas: as horas e os preços são para 3.");
    expect(TEXTOS_DA_LISTA.pedirEmbalamento).toBe("Também preciso de caixas e embalamento");
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
