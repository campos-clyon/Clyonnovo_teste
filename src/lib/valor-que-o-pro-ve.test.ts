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
/** Sem os comentários: o que eles CONTAM não pode fazer um teste passar. */
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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

describe("e o ecrã de dentro diz o MESMO que o cartão", () => {
  /*
   * "O valor sugerido pela CLYON foi de 350, não de 190,84 €." — 12-09-2026.
   *
   * O cartão da lista dizia 329 € com a etiqueta «valor CLYON». O ecrã de
   * dentro, sobre o MESMO pedido, dizia 190,84 € com «Valor sugerido pela
   * CLYON» por cima. Dois números, duas contas diferentes, e o nome de uma
   * colado à outra: o ecrã de dentro mostrava `sugestao.precoSugerido`, que é
   * a conta feita com os quilómetros e os custos DELE.
   *
   * A regra de 10-09-2026 é uma só, e vale nos dois sítios: o número grande é
   * o valor que a CLYON pôs no pedido.
   */
  it("o número grande do detalhe é o da CLYON, e a conta dele é o suplente", () => {
    expect(CARTAO).toContain("const daClyon = antesDePropor ? (pedido.valorDaClyon ?? null) : null;");
    expect(CARTAO).toContain("const emCima = daClyon ?? suaConta?.recebeSePropuser ?? null;");
    expect(CARTAO).toContain(
      "euros(fechado ? pedido.recebeSeFechado : (emCima ?? pedido.recebeSeAceitar))",
    );
  });

  it("o detalhe deixou de chamar «valor da CLYON» à conta feita para ele", () => {
    /*
     * Esta é a asserção que apanha a volta atrás. `precoSugerido` é o bruto da
     * conta DELE: se voltar a ser o número grande, o ecrã volta a dizer 190,84
     * onde a lista diz 329.
     */
    expect(semNotas(CARTAO)).not.toContain("sugestaoAntesDePropor.precoSugerido");
    expect(semNotas(CARTAO)).not.toContain("sugestaoAntesDePropor");
  });

  it("e quando o número grande é a conta dele, a etiqueta diz isso", () => {
    // Chamar «valor CLYON» a uma conta feita para ele prometia um número que
    // ninguém lhe garantiu — a mesma regra do cartão, nas mesmas palavras.
    expect(CARTAO).toContain('"Valor sugerido pela CLYON"');
    expect(CARTAO).toContain('"Sugestão da CLYON para si"');
  });

  it("a conta dele aparece em baixo, e só quando discorda", () => {
    expect(CARTAO).toContain("Math.abs(suaConta.recebeSePropuser - daClyon) >= 1");
  });
});
