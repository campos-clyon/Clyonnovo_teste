import { describe, it, expect } from "vitest";
import { COLUNAS_DO_REGISTO, valoresDoRegisto, type LinhaDoRegisto } from "./db";

/**
 * O registo permanente é a única tabela deste projecto que não se pode
 * corrigir depois. Uma linha errada fica errada para sempre — é essa a
 * definição de permanente — e a forma mais fácil de a escrever errada não é
 * um valor mau: é as duas listas paralelas ficarem com comprimentos
 * diferentes.
 *
 * Acrescenta-se uma coluna à lista de nomes, esquece-se a de valores, e o SQL
 * continua válido: passa a haver 23 nomes e 22 interrogações. O MySQL rejeita
 * essa, e nota-se. Mas ao contrário — 22 nomes e 23 valores — também rejeita.
 * O caso verdadeiramente mau é acrescentar nos dois sítios em POSIÇÕES
 * diferentes: os comprimentos batem, o SQL corre, e a partir daí o valor
 * acordado é gravado na coluna da taxa da CLYON. Ninguém dá por isso até
 * alguém somar as receitas de um ano.
 */

const MINIMA: LinhaDoRegisto = { acontecimento: "pedido_criado" };

const COMPLETA: LinhaDoRegisto = {
  acontecimento: "negociacao_fechada",
  pedidoId: 206,
  negociacaoId: 8,
  levantamentoId: 3,
  providerId: 2,
  clienteEmail: "  Ana@Gmail.COM ",
  clienteNome: "Ana Silva",
  providerNome: "Fred",
  autorTipo: "clyon",
  autorNome: "Wanderson",
  resumo: "Contratado por 200 €.",
  detalhe: { propostas: 2 },
  estadoAntes: "aberta",
  estadoDepois: "acordada",
  valor: 200,
  valorCliente: 220,
  valorProfissional: 190,
  taxaClyon: 10,
  servicoTipo: "recolha_moveis",
  zona: "Lisboa",
  visivelCliente: true,
  visivelProfissional: true,
};

describe("as duas listas do registo", () => {
  it("têm o mesmo comprimento", () => {
    expect(valoresDoRegisto(COMPLETA)).toHaveLength(COLUNAS_DO_REGISTO.length);
  });

  it("têm o mesmo comprimento também com a linha mais pobre possível", () => {
    // Uma linha sem nada preenchido tem de produzir a mesma quantidade de
    // valores — todos nulos. Se um `?? null` em falta fizesse desaparecer uma
    // posição, era aqui que se via.
    expect(valoresDoRegisto(MINIMA)).toHaveLength(COLUNAS_DO_REGISTO.length);
  });

  it("põem cada valor debaixo do nome certo", () => {
    const v = valoresDoRegisto(COMPLETA);
    const porNome = Object.fromEntries(COLUNAS_DO_REGISTO.map((c, i) => [c, v[i]]));

    expect(porNome.acontecimento).toBe("negociacao_fechada");
    expect(porNome.pedidoId).toBe(206);
    expect(porNome.negociacaoId).toBe(8);
    expect(porNome.providerId).toBe(2);
    // As quatro colunas de dinheiro, uma a uma. É a troca entre estas que
    // ninguém detectaria a olho.
    expect(porNome.valor).toBe(200);
    expect(porNome.valorCliente).toBe(220);
    expect(porNome.valorProfissional).toBe(190);
    expect(porNome.taxaClyon).toBe(10);
    expect(porNome.estadoAntes).toBe("aberta");
    expect(porNome.estadoDepois).toBe("acordada");
    expect(porNome.servicoTipo).toBe("recolha_moveis");
    expect(porNome.zona).toBe("Lisboa");
  });
});

describe("o que a linha faz aos valores antes de os gravar", () => {
  it("normaliza o email, porque é a chave do histórico do cliente", () => {
    const v = valoresDoRegisto(COMPLETA);
    const i = COLUNAS_DO_REGISTO.indexOf("clienteEmail");
    // "  Ana@Gmail.COM " e "ana@gmail.com" são a mesma pessoa e têm de dar a
    // mesma lista quando ela abrir o histórico.
    expect(v[i]).toBe("ana@gmail.com");
  });

  it("deixa o email a nulo em vez de gravar uma cadeia vazia", () => {
    const v = valoresDoRegisto({ acontecimento: "pedido_criado", clienteEmail: "" });
    expect(v[COLUNAS_DO_REGISTO.indexOf("clienteEmail")]).toBeNull();
  });

  it("serializa o detalhe em JSON", () => {
    const v = valoresDoRegisto(COMPLETA);
    expect(v[COLUNAS_DO_REGISTO.indexOf("detalheJson")]).toBe('{"propostas":2}');
  });

  it("grava o detalhe a nulo quando não há nenhum", () => {
    expect(valoresDoRegisto(MINIMA)[COLUNAS_DO_REGISTO.indexOf("detalheJson")]).toBeNull();
  });

  it("esconde a linha dos dois lados por omissão", () => {
    // Uma linha só chega ao cliente ou ao profissional se alguém disser que
    // sim. O contrário levava notas internas para dentro do painel deles.
    const v = valoresDoRegisto(MINIMA);
    expect(v[COLUNAS_DO_REGISTO.indexOf("visivelCliente")]).toBe(0);
    expect(v[COLUNAS_DO_REGISTO.indexOf("visivelProfissional")]).toBe(0);
  });

  it("corta os textos ao tamanho da coluna em vez de deixar a base rejeitar", () => {
    // `resumo` é VARCHAR(500). Uma descrição longa colada de um WhatsApp
    // rebentava a inserção — e o que se perdia era a linha inteira do registo,
    // não o excesso de texto.
    const v = valoresDoRegisto({ acontecimento: "pedido_editado", resumo: "x".repeat(900) });
    expect(String(v[COLUNAS_DO_REGISTO.indexOf("resumo")])).toHaveLength(500);
  });

  it("corta os nomes a 160", () => {
    const v = valoresDoRegisto({ acontecimento: "pedido_criado", clienteNome: "a".repeat(400) });
    expect(String(v[COLUNAS_DO_REGISTO.indexOf("clienteNome")])).toHaveLength(160);
  });
});
