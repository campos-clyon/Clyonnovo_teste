import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O CLIENTE DEIXA DE VER A ESTIMATIVA DO MOTOR.
 *
 * "Vamos deixar de apresentar esse valor estimado para o cliente."
 * — 18-09-2026, sobre o pedido #342, que abria com «127,43 € · sem IVA» em
 * corpo grande.
 *
 * Aquele número não era de ninguém: saía do motor de preços a partir do
 * formulário, antes de existir proposta nenhuma e antes sequer de a morada
 * estar confirmada — o próprio histórico do pedido dizia «confirmar a morada
 * antes de fechar o preço». Mas isso lê-se três ecrãs abaixo, e o que fica na
 * cabeça é o número do topo. Quando as propostas chegam a 180 €, quem ancorou
 * nos 127 lê um aumento em vez de um preço.
 *
 * E é uma conversa que não é nossa: a CLYON liga clientes a profissionais e
 * não faz as recolhas. Quem decide o preço são os dois.
 *
 * ⚠️ O QUE FICA são números que ALGUÉM DECIDIU — o valor acordado com o
 * profissional, e o `precoFinal` que a CLYON envia ao aprovar um pedido. O que
 * sai é só o palpite da máquina.
 *
 * O motor continua a calcular, e o backoffice continua a ver: era esse o
 * desenho desde o princípio — «estimativa (para o backoffice) — nunca mostrada
 * ao cliente», diz o simulador. Estes três ecrãs eram o furo.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/*
 * O código sem comentários. Os comentários desta mudança explicam de onde
 * viemos e falam da estimativa; um teste que a procure no ficheiro inteiro
 * encontra-a lá dentro e chumba uma correcção que está feita.
 */
const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const DETALHE = semComentarios(ler("src/app/conta/components/OrderDetailModal.tsx"));
const LISTA = semComentarios(ler("src/app/conta/components/MeusPedidos.tsx"));
const LINK = semComentarios(ler("src/app/pedido/[token]/VistaDoPedido.tsx"));

describe("os três ecrãs do cliente não mostram a estimativa", () => {
  const ECRAS: Array<[string, string]> = [
    ["o detalhe do pedido, na conta", DETALHE],
    ["a lista de pedidos, na conta", LISTA],
    ["a página do link que ele recebe", LINK],
  ];

  for (const [nome, ecra] of ECRAS) {
    it(`${nome}`, () => {
      for (const campo of ["estimateTotal", "estimateMin", "estimateMax"]) {
        expect(ecra, `${nome} não pode desenhar ${campo}`).not.toContain(campo);
      }
    });
  }
});

describe("mas os valores que alguém decidiu continuam lá", () => {
  it("o acordado com o profissional é o que manda", () => {
    /*
     * A ordem importa: o acordado ganha ao `precoFinal`. Já houve um caso em
     * que o cabeçalho mostrava um número e o bloco do acordo, três
     * centímetros abaixo, mostrava outro.
     */
    expect(DETALHE).toContain(
      "const preco = naPlataforma.valor ?? order.precoFinalIva ?? order.precoFinal;",
    );
    expect(LISTA).toContain(
      "const preco = plataforma.valor ?? o.precoFinalIva ?? o.precoFinal;",
    );
  });

  it("e o valor que o CLIENTE indicou é dele, não é nosso", () => {
    // É o ponto de partida das propostas e foi ele que o escreveu. Tirá-lo
    // seria tirar-lhe a única referência que ele próprio pôs no pedido.
    expect(LINK).toContain("O valor que indicou");
  });
});

describe("e o lugar onde o número estava não fica em branco", () => {
  it("o detalhe diz de onde é que o valor vai vir", () => {
    /*
     * Um canto vazio no sítio mais visível do ecrã lê-se como «falta carregar
     * alguma coisa». A frase responde à pergunta que ele veio fazer — quanto
     * vai custar — e diz quem é que a vai responder.
     */
    expect(DETALHE).toContain("O valor vem nas propostas dos profissionais");
  });

  it("e a página do link deixou de prometer um número nosso", () => {
    expect(LINK).not.toContain("A nossa estimativa");
    /*
     * Com os espaços arrumados: uma frase dentro de JSX quebra onde o
     * formatador quiser, e prender um teste a essa quebra é prendê-lo à
     * largura da linha em vez de ao que lá está escrito.
     */
    expect(LINK.replace(/\s+/g, " ")).toContain("nós não pomos aqui nenhum valor nosso");
  });
});

describe("o motor continua a calcular para dentro de casa", () => {
  it("o simulador guarda a estimativa, e diz para quem ela é", () => {
    // Não se apagou nada da base: o backoffice usa-a para conferir uma
    // proposta que lhe pareça fora do sítio, e as métricas contam com ela.
    const SIMULADOR = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(SIMULADOR).toContain("nunca mostrada ao cliente");
  });

  it("e o profissional continua a vê-la — é ele que precisa de um ponto de partida", () => {
    // A lista de campos que chegam ao profissional é outra decisão, e outra
    // pessoa: ele vai propor um valor, e propor às cegas é como nascem as
    // propostas que depois não se aguentam à porta do cliente.
    const CAMPOS = ler("src/lib/pedido-valores.ts");
    expect(CAMPOS).toContain('"estimateTotal"');
  });
});
