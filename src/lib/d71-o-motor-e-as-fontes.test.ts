import { afterEach, describe, expect, it } from "vitest";
import { calculateFastEstimate, manutencaoPelaGrelha, tipoDeTrabalhoDoTexto } from "./pricing-helper";
import {
  HORAS_COM_DUAS_PESSOAS,
  MINIMO_DA_MUDANCA,
  MINIMO_DA_MUDANCA_DUAS_PESSOAS,
  MINIMO_DA_MUDANCA_EM_TEXTO,
  MINIMO_DE_HORAS,
  PRECO_POR_HORA,
  PRECO_POR_HORA_DUAS_PESSOAS,
  TIPOLOGIAS,
  intervaloDeHoras,
  meioDoIntervalo,
  pessoasDoMotor,
} from "./tabela-das-mudancas";
import { lembrarPrecoPublico, precoPublicoDosCandidatos, SEM_PARCEIROS } from "./preco-publico-das-mudancas";
import type { CandidatoDaMudanca } from "./lista-de-parceiros-da-mudanca";
import type { TarifaDasMudancas } from "./conta-da-mudanca";
import { MANUTENCAO_POR_TIPO, MINIMO_DA_MANUTENCAO } from "./precos-publicos";
import { comIva } from "./quanto-custa";

/*
 * d71 (1) e (2) — 17-11-2026, o CEO e o dono.
 *   (1) o motor da mudança estima com 2 pessoas quando a tabela as oferece
 *       (era sempre com 3, e nunca dava menos de 3 h × 55 €), e o mínimo que diz
 *       é o do site: «mínimo 3 horas: … com 2 pessoas, … com 3». Com parceiros
 *       na lista, o preço continua a ser o da lista (d7);
 *   (2) o motor lê a grelha da manutenção da casa, a mesma do simulador.
 */

afterEach(() => lembrarPrecoPublico(SEM_PARCEIROS));

describe("d71 (1) — a mudança com 2 pessoas quando a tabela o permite", () => {
  it("o mínimo do motor é o que o site diz, com as duas equipas (o teste da orquestra)", async () => {
    lembrarPrecoPublico(SEM_PARCEIROS);
    expect(MINIMO_DA_MUDANCA_DUAS_PESSOAS).toBe(PRECO_POR_HORA_DUAS_PESSOAS * MINIMO_DE_HORAS);
    expect(MINIMO_DA_MUDANCA).toBe(PRECO_POR_HORA * MINIMO_DE_HORAS);
    expect(MINIMO_DA_MUDANCA_EM_TEXTO).toContain(`${MINIMO_DA_MUDANCA_DUAS_PESSOAS} € + IVA com 2 pessoas`);
    expect(MINIMO_DA_MUDANCA_EM_TEXTO).toContain(`${MINIMO_DA_MUDANCA} € + IVA com 3`);
    // A pequena mudança, sem nada: o mínimo com 2 pessoas (120 € + IVA), já não 165.
    const pequena = await calculateFastEstimate({ serviceType: "mudanca", tipologia: "itens" });
    expect(pequena.estimatedPriceWithoutVat).toBe(MINIMO_DA_MUDANCA_DUAS_PESSOAS);
    expect(pequena.estimatedPriceWithVat).toBe(comIva(MINIMO_DA_MUDANCA_DUAS_PESSOAS));
    expect(pequena.customerMessage).toContain("com 2 pessoas");
    // Um T3 só se faz com 3: nunca abaixo do mínimo com 3.
    const t3 = await calculateFastEstimate({ serviceType: "mudanca", tipologia: "T3" });
    expect(t3.estimatedPriceWithoutVat!).toBeGreaterThanOrEqual(MINIMO_DA_MUDANCA);
    expect(t3.customerMessage).toContain("com 3 pessoas");
  });

  it("a equipa sai da tabela: 2 onde HORAS_COM_DUAS_PESSOAS a tem, 3 onde não", () => {
    for (const t of TIPOLOGIAS) expect(pessoasDoMotor(t), t).toBe(HORAS_COM_DUAS_PESSOAS[t] ? 2 : 3);
    expect(pessoasDoMotor(null)).toBe(2);
  });

  it("um T1 sem parceiros na lista estima-se com 2 pessoas, à hora de 2", async () => {
    lembrarPrecoPublico(SEM_PARCEIROS);
    const e = await calculateFastEstimate({ serviceType: "mudanca", tipologia: "T1" });
    const iv = intervaloDeHoras("T1", false, 2);
    expect(e.estimatedPriceWithoutVat).toBe(meioDoIntervalo(iv) * PRECO_POR_HORA_DUAS_PESSOAS);
    expect(e.estimateMinWithoutVat!).toBeGreaterThanOrEqual(MINIMO_DA_MUDANCA_DUAS_PESSOAS);
    expect(e.assumptions.join(" ")).toContain("motorista e 1 ajudante");
  });

  it("com parceiros na lista o preço continua a ser o da lista (d7)", async () => {
    const tarifa: TarifaDasMudancas = {
      precoHora2: 42,
      precoHora3: 57,
      minimoHoras: 2,
      precoKm: 0.8,
      kmMinimo: 10,
      kmMaximo: 100,
      caixa: 2,
      cartaoMetro: 2,
      filmeRolo: 8,
      plasticoBolhaRolo: 15,
      aparecerNaLista: true,
    };
    const parceiro = {
      nome: "Parceiro inventado",
      contaDeTeste: false,
      verificado: true,
      tarifa,
      notaMedia: null,
      avaliacoes: 0,
      isActive: true,
      estado: "aprovado",
      categorias: ["mudanca"],
      raioKm: 50,
      emiteFatura: true,
      emiteGuiaTransporte: false,
      guiaVerificadaEm: null,
    } as unknown as CandidatoDaMudanca;
    lembrarPrecoPublico(precoPublicoDosCandidatos([parceiro]));
    const e = await calculateFastEstimate({ serviceType: "mudanca", tipologia: "T1" });
    expect(e.assumptions.join(" ")).toContain("Pela lista de parceiros");
    expect(e.customerMessage).toContain("ao preço do parceiro escolhido");
  });
});

describe("d71 (2) — a manutenção da casa pela grelha do simulador", () => {
  it("«trocar uma torneira» estima desde 57 € + IVA, e não 240 €", async () => {
    expect(tipoDeTrabalhoDoTexto("trocar uma torneira")).toBe("canalizacao");
    const e = await calculateFastEstimate({ serviceType: "manutencao_casa", description: "trocar uma torneira" });
    const celula = MANUTENCAO_POR_TIPO.canalizacao.uma_pequena;
    if (celula.tipo !== "faixa") throw new Error("a célula da torneira mudou");
    expect(e.estimateMinWithoutVat).toBe(MINIMO_DA_MANUTENCAO);
    expect(e.estimateMinWithoutVat).toBe(57);
    expect(e.estimateMaxWithoutVat).toBe(celula.ate);
    expect(e.estimatedPriceWithoutVat).not.toBe(240);
    expect(e.estimatedPriceWithoutVat!).toBeLessThanOrEqual(celula.ate);
    expect(e.pelaGrelha).toBe(true);
    // O sem IVA nunca sozinho no texto.
    expect(e.customerMessage).toMatch(/€ \+ IVA \([\d,.]+ € c\/IVA\)/);
    expect(e.assumptions.join(" ")).toContain(`(${comIva(57)} a ${comIva(celula.ate)} € c/IVA)`);
  });

  it("as respostas do simulador mandam sobre a descrição", () => {
    const f = manutencaoPelaGrelha({ serviceType: "manutencao_casa", tipoDeTrabalho: "pintura", quantoTrabalho: "uma_divisao", description: "torneira" });
    const c = MANUTENCAO_POR_TIPO.pintura.uma_divisao;
    if (c.tipo !== "faixa") throw new Error("a célula da pintura mudou");
    expect(f).toMatchObject({ de: c.de, ate: c.ate });
  });

  it("uma proposta com fotografias, ou nada que se perceba: o «desde» publicado, nunca o mínimo de zona", async () => {
    const e = await calculateFastEstimate({ serviceType: "manutencao_casa", description: "preciso de ajuda em casa", city: "Lisboa" } as never);
    expect(e.estimatedPriceWithoutVat).toBe(MINIMO_DA_MANUTENCAO);
    const p = manutencaoPelaGrelha({ serviceType: "manutencao_casa", tipoDeTrabalho: "electricidade", quantoTrabalho: "uma_divisao" });
    expect(p?.valor).toBe(MINIMO_DA_MANUTENCAO);
    expect(manutencaoPelaGrelha({ serviceType: "recolha_moveis" })).toBeNull();
  });
});
