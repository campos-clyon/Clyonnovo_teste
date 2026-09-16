import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O ASSISTENTE DEIXA DE RESPONDER A TUDO COM O RELATÓRIO TODO.
 *
 * Conversa real, 13-09-2026, pedido #311:
 *
 *   CLYON:   Manuel Martins transportes propõe 148,57 € (...)
 *            Diga-me se lhe serve, ou responda com o valor que gostaria de pagar.
 *   CLIENTE: Ok, obrigada
 *   CLYON:   Pedido #311 — propostas em cima da mesa:
 *            • Manuel Martins transportes: 148,57 € (à sua espera)
 *            • ...
 *
 * "Também não deve repetir informação."
 *
 * A causa era uma linha só, a última de `tratarMensagemDoCliente`: tudo o que
 * não fosse sim, não, um valor ou uma data reescrevia a mesa inteira. Essa
 * linha servia três coisas diferentes ao mesmo tempo — «não percebi», «tome o
 * seu ponto de situação» e «não tenho nada a dizer» — e as três saíam iguais.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");
const COMPREENSAO = ler("src/lib/whatsapp-compreensao.ts");

describe("um agradecimento não é uma pergunta", () => {
  it("a camada que percebe passou a distingui-los", () => {
    // Viviam os dois dentro de "nada", e "nada" acabava no ponto de situação.
    expect(COMPREENSAO).toContain('| "agradecer"');
    expect(COMPREENSAO).toContain('"agradecer" — agradece ou dá a conversa por arrumada');
    // E continua a ser uma das acções que o modelo pode devolver.
    expect(COMPREENSAO).toContain(
      '{ "accao": "fechar" | "recusar" | "contrapropor" | "marcar" | "falar_com_pessoa" | "agradecer" | "ponto_de_situacao" | "nada"',
    );
  });

  /*
   * A ARMADILHA DESTA SEPARAÇÃO, escrita no aviso ao modelo: «está bem,
   * fechamos» é um fecho e não um agradecimento. Confundi-los deixava um
   * negócio por fechar à espera de nada.
   */
  it("o aviso ao modelo separa «está bem» de «está bem, fechamos»", () => {
    expect(COMPREENSAO).toContain('"está bem, fechamos" é "fechar", não isto');
  });

  it("o cérebro responde-lhe com uma frase e cala-se", () => {
    expect(CEREBRO).toContain('if (percebida === "agradecer") {');
    expect(CEREBRO).toContain('"De nada. Qualquer coisa, é só dizer."');
    const i = CEREBRO.indexOf('if (percebida === "agradecer") {');
    const bloco = CEREBRO.slice(i, i + 400);
    // Nada de ecrã por baixo da frase: a razão de isto existir é não repetir.
    expect(bloco).not.toContain("ecraDoPedido");
    expect(bloco).toContain("return;");
  });
});

describe("quem pede uma pessoa recebe uma pessoa", () => {
  /*
   * "falar_com_pessoa" era lido, classificado — e depois seguia com o texto
   * original, que não casava com nada e acabava no ponto de situação. Quem
   * escrevia «posso falar com alguém?» recebia a lista de preços.
   */
  it("não cai no ponto de situação", () => {
    expect(CEREBRO).toContain('if (percebida === "falar_com_pessoa") {');
    expect(CEREBRO).toContain('passarAUmaPessoa(telefone, "Pediu para falar com uma pessoa")');
  });
});

describe("o ponto de situação só sai quando há situação", () => {
  it("sem nada à espera dele, o assistente diz uma linha em vez do relatório", () => {
    expect(CEREBRO).toContain("const pendentes = await alvosAccionaveis(pedidos);");
    expect(CEREBRO).toContain("if (pendentes.length === 0) {");
    expect(CEREBRO).toContain(
      "Está tudo a andar deste lado. Assim que houver novidades, sou eu a escrever-lhe.",
    );
  });

  /*
   * E QUANDO SAI, É O PEDIDO CERTO.
   *
   * Era `ecraDoPedido(pedidos[0])` — o primeiro da lista, que vem por ordem
   * decrescente de criação, ou seja o pedido mais RECENTE. Um cliente com dois
   * pedidos abertos levava sempre o ecrã do mesmo, mesmo que a proposta à
   * espera de resposta fosse do outro.
   */
  it("mostra o pedido que tem alguma coisa à espera, e não o mais recente", () => {
    expect(CEREBRO).toContain("mandarOEcra(telefone, pendentes[0].pedidoId)");
  });
});
