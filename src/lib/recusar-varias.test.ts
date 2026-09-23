import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerARespostaDirecta } from "./ler-a-resposta";

/**
 * RECUSAR VÁRIAS PROPOSTAS NUMA FRASE SÓ — e o que isso não pode fazer.
 *
 * "recusar 267,00, recusar 300,00, recusar 250,00, recusar 283,42" — o cliente
 * do pedido #357, a 23-09-2026 às 11:54. Um minuto antes, o assistente tinha
 * escrito «Tem 4 propostas em cima da mesa … Diga qual pelo valor — por
 * exemplo: recusar 267,00». Ele fez exactamente o que a mensagem ensinava,
 * quatro vezes, e levou de volta a mesma lista.
 *
 * ISTO MATA NEGOCIAÇÕES, e não há volta atrás. Por isso o que aqui se guarda
 * não é sobretudo que funcione: é o que ele tem de RECUSAR a fazer.
 */

const CEREBRO = readFileSync(
  join(process.cwd(), "src/lib/whatsapp-negociacao.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

/** Sem os comentários: o que eles CONTAM não pode fazer um teste passar. */
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CODIGO = semNotas(CEREBRO);

describe("o que a frase diz, antes de chegar ao cérebro", () => {
  it("a frase verdadeira dá os quatro valores", () => {
    expect(
      lerARespostaDirecta("recusar 267,00, recusar 300,00, recusar 250,00, recusar 283,42"),
    ).toEqual({ tipo: "nao_varias", valores: [267, 300, 250, 283.42] });
  });

  it("e nada que tenha outra intenção lá dentro vira uma recusa múltipla", () => {
    for (const frase of [
      "recusar 100, recusar 200, mas ligue-me antes",
      "recusar 100 e aceito 200",
      "queria recusar umas quantas",
      "nao 100",
    ]) {
      expect(lerARespostaDirecta(frase)?.tipo, frase).not.toBe("nao_varias");
    }
  });
});

describe("tudo ou nada — a regra que evita meter metade das propostas abaixo", () => {
  /*
   * A PROVA É POR TEXTO, e vale a pena dizer porquê em vez de fingir que não
   * se reparou. `tratarMensagemDoCliente` fala com a base, com o WhatsApp e
   * com o Gemini; testá-la a correr obriga a duplicar metade do módulo, e um
   * duplo que se engane ensina a confiar numa coisa errada.
   *
   * O que se guarda aqui é a FORMA da decisão — as três linhas de onde o
   * comportamento sai. Cada uma delas foi invertida à mão numa cópia e, sem
   * este ficheiro, os 3661 testes passavam todos.
   */
  it("um valor que não bate em NENHUMA proposta não recusa nada", () => {
    expect(CODIGO).toContain("const semNenhuma = casados.filter((c) => c.quais.length === 0);");
    expect(CODIGO).toContain("if (semNenhuma.length > 0 || casados.length === 0) {");
    expect(CODIGO).toContain("não recusei nenhuma");
  });

  it("um valor que bate em DUAS vai para uma pessoa, e não se adivinha", () => {
    /*
     * Dois pedidos com uma proposta de 300 € cada não se separam pelo valor,
     * e «Diga qual pelo valor» é o único vocabulário que o assistente
     * ensinou. Mandá-lo tentar outra vez era armar a armadilha seguinte: à
     * segunda a mensagem sai igual e o `jaFoiDito` engole-a, e o cliente fica
     * a falar sozinho.
     */
    expect(CODIGO).toContain("const empatados = casados.filter((c) => c.quais.length > 1);");
    expect(CODIGO).toContain("if (empatados.length > 0) {");
    const bloco = CODIGO.slice(
      CODIGO.indexOf("if (empatados.length > 0) {"),
      CODIGO.indexOf("if (semNenhuma.length > 0"),
    );
    expect(bloco).toContain("passarAUmaPessoa");
  });

  it("só se recusa quando cada valor bate em UMA e só uma", () => {
    expect(CODIGO).toContain("quais: alvos.filter((a) => Math.abs((a.valorNaMesa as number) - v) < 0.005)");
    expect(CODIGO).toContain("casados.map((c) => c.quais[0])");
  });
});

describe("uma escrita que rebenta não pode calar as outras", () => {
  /*
   * O BLOQUEANTE QUE A REVISÃO APANHOU, reproduzido por ela a correr: com uma
   * escrita a falhar a meio do ciclo, duas negociações ficavam mortas, duas
   * vivas, e o cliente não recebia mensagem nenhuma — a excepção subia até à
   * rota, que regista e devolve 200. No telemóvel dele continuava a lista das
   * quatro propostas.
   *
   * Era PIOR do que o que havia antes: recusar uma a uma falhava alto.
   */
  it("o ciclo apanha o que rebentar e conta-o na mensagem do fim", () => {
    const bloco = CODIGO.slice(
      CODIGO.indexOf("async function recusarVariasPeloCliente"),
      CODIGO.indexOf("type AlvoComValor"),
    );
    expect(bloco.length).toBeGreaterThan(0);
    expect(bloco).toContain("try {");
    /*
     * A OLHAR PARA DENTRO DO `catch`, e não só para a existência dele.
     *
     * A primeira versão deste teste procurava `catch (e) {` e `falhadas.push`
     * em qualquer sítio do bloco — e o `falhadas.push` do ramo `else` chegava
     * para o satisfazer. Trocar o corpo do `catch` por um `throw e` passava.
     * Medi-o, e é exactamente a falha que este ficheiro existe para impedir.
     */
    const dentroDoCatch = bloco.slice(bloco.indexOf("catch (e) {"), bloco.indexOf("}\n  }"));
    expect(dentroDoCatch).toContain("falhadas.push");
    expect(dentroDoCatch).not.toContain("throw");
    // E a mensagem final sai sempre: com o que correu e com o que não correu.
    expect(bloco).toContain("Não deu para recusar");
    expect(bloco).toContain("recusei");
  });

  it("a NOTA não derruba a recusa que já está gravada", () => {
    /*
     * A ordem importa: `gravarNegociacao` primeiro, e o `registarAccao`
     * dentro de um `catch` próprio. Ao contrário, um registo que rebente
     * fazia anunciar ao cliente que não tinha dado — sobre uma proposta que
     * já estava morta na base.
     */
    const bloco = CODIGO.slice(
      CODIGO.indexOf("async function recusarUmaNaBase"),
      CODIGO.indexOf("async function recusarPeloCliente"),
    );
    expect(bloco.indexOf("await gravarNegociacao")).toBeLessThan(bloco.indexOf("registarAccao"));
    expect(bloco.indexOf("registarAccao")).toBeGreaterThan(bloco.indexOf("try {"));
    expect(bloco).toContain("recusa gravada, a nota não");
  });

  it("o interruptor do backoffice continua a mandar", () => {
    // «Fechar desligado» vale para recusar uma e para recusar quatro.
    const bloco = CODIGO.slice(
      CODIGO.indexOf("async function recusarVariasPeloCliente"),
      CODIGO.indexOf("type AlvoComValor"),
    );
    expect(bloco).toContain('assistentePode("fechar")');
    expect(bloco).toContain("passarAUmaPessoa");
  });
});
