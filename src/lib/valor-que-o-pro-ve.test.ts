import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O NÚMERO GRANDE DO CARTÃO É O DA CLYON.
 *
 * "O valor que deve aparecer para os pros nos pedidos é o valor que colocamos
 * aqui" — 10-09-2026, apontando à caixa «conta CLYON» da mesa dos pedidos.
 *
 * Até aqui o cartão mostrava a conta feita PARA ELE — os quilómetros dele, os
 * custos dele, a margem dele — e o valor que a CLYON punha no pedido ficava
 * guardado sem ninguém do outro lado o ver. São dois números diferentes sobre
 * o mesmo trabalho, e o que manda é o nosso.
 *
 * A conta dele não desaparece: desce para letra pequena, onde responde à
 * pergunta que ela sempre respondeu bem — «isto compensa-me?» — sem se fazer
 * passar pelo preço do trabalho.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROTA = ler("src/app/api/profissionais/meus-pedidos/route.ts");
const CARTAO = ler("src/app/profissionais/painel/Trabalhos.tsx");
const TIPOS = ler("src/app/profissionais/painel/tipos.ts");

describe("a rota manda o valor da CLYON", () => {
  it("vai o LÍQUIDO dele, como todos os outros números do cartão", () => {
    /*
     * O cartão nunca mostra o bruto. Mandar aqui o valor do cliente sem a
     * taxa descontada punha um número maior ao lado de todos os outros, e o
     * profissional descobria a diferença ao receber.
     */
    expect(ROTA).toContain("valorDaClyon:");
    const bloco = ROTA.slice(ROTA.indexOf("valorDaClyon:"), ROTA.indexOf("valorDaClyon:") + 220);
    expect(bloco).toContain("quantoOProfissionalRecebe(Number(l.valorDesejadoCliente))");
  });

  it("sem valor no pedido, vai nulo — e não zero", () => {
    // Um zero lia-se como "este trabalho paga nada", que é uma mentira
    // diferente de "ainda não há valor".
    const bloco = ROTA.slice(ROTA.indexOf("valorDaClyon:"), ROTA.indexOf("valorDaClyon:") + 220);
    expect(bloco).toContain("l.valorDesejadoCliente != null");
    expect(bloco).toContain(": null,");
  });

  it("a conta feita para ele continua a ir — em segundo plano", () => {
    // O que muda é o lugar dela no ecrã, não a existência.
    expect(ROTA).toContain("sugestao: sugestaoSegura(");
    expect(TIPOS).toContain("valorDaClyon?: number | null;");
  });
});

describe("o cartão põe o nosso valor em cima", () => {
  it("o número grande é o da CLYON, e a conta dele é o suplente", () => {
    /*
     * A ordem do `??` é a regra inteira: o nosso primeiro, a conta dele só na
     * falta dele. Invertida, voltava tudo ao que estava.
     */
    expect(CARTAO).toContain("p.valorDaClyon ?? sugestaoAberta?.recebeSePropuser ?? null");
    expect(CARTAO).toContain("euros(fechado ? p.recebeSeFechado : (valorEmCima ?? p.recebeSeAceitar))");
  });

  it("os sinais e o €/km seguem o número que está à vista", () => {
    // Se o distintivo «bem pago» fosse calculado sobre um número que o cartão
    // não mostra, dizia «bem pago» ao lado de um valor que não o era.
    expect(CARTAO).toContain("valorEmCima != null ? { ...p, recebeSeAceitar: valorEmCima } : p");
  });

  it("cada número tem o seu nome", () => {
    /*
     * Chamar «sugestão» ao valor que a CLYON pôs convidava-o a descontá-lo;
     * chamar «valor CLYON» à conta feita para ele prometia um número que
     * ninguém lhe garantiu.
     */
    expect(CARTAO).toContain('p.valorDaClyon != null ? "valor CLYON" : "sugestão CLYON"');
  });

  it("a conta dele aparece só quando discorda da nossa", () => {
    // Repetir o mesmo número duas vezes na mesma linha não informa ninguém.
    expect(CARTAO).toContain("para os seus custos, sugeria");
    expect(CARTAO).toContain("Math.abs(sugestaoAberta.recebeSePropuser - p.valorDaClyon) >= 1");
  });

  it("num trabalho já fechado manda o valor fechado, e não o nosso", () => {
    // Depois do acordo o número é o que ficou combinado — o valor de partida
    // passou a história.
    expect(CARTAO).toContain("fechado ? p.recebeSeFechado");
    expect(CARTAO).toContain("{!fechado && valorEmCima != null && (");
  });
});
