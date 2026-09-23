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

  it("e o valor de arranque sai da página do cliente — é dos profissionais", () => {
    /*
     * ISTO ERA O CONTRÁRIO, e durou um dia.
     *
     * Na véspera guardava-se aqui que o «valor que indicou» ficava — «é o
     * ponto de partida das propostas e foi ele que o escreveu». No dia
     * seguinte, a ver o #298: "o valor que eu indiquei não deveria estar
     * visível para os clientes, apenas para os pros."
     *
     * Tem razão, e a razão vê-se no ecrã: lia-se «Contratou a TRSul, 350,00 €»
     * em cima e «O valor que indicou 340,00 €» em baixo — dois números para a
     * mesma pergunta, com dez euros de diferença e nada a dizer qual valia.
     * Aquele número serve para os profissionais fazerem propostas; devolvê-lo
     * ao cliente não lhe dizia nada de novo e dizia-lhe uma coisa errada.
     */
    expect(LINK).not.toContain("O valor que indicou");
    expect(LINK).not.toContain("valorDesejadoCliente");
  });

  it("nem pelo email — que lhe punha na boca um número nosso", () => {
    /*
     * O FURO QUE FICOU DE FORA, fechado a 22-09-2026.
     *
     * A página do pedido perdeu a estimativa a 18-09-2026, mas o email que a
     * acompanha continuava a dizer «Disse que quer pagar a partir de X». O
     * campo do valor é opcional e quase ninguém o preenche: nesses casos o X
     * era a NOSSA estimativa, e a frase atribuía-lhe uma coisa que ele nunca
     * escreveu nem viu.
     *
     * A frase fica para quem escreveu mesmo um número — aí é verdade.
     */
    const ROTA = semComentarios(ler("src/app/api/simulador/pedido/route.ts"));
    expect(ROTA).toContain("clienteIndicouValores && valoresParaGravar.valorDesejadoCliente");
  });

  it("e nos OUTROS dois emails também não — que era onde o furo ficava", () => {
    /*
     * `enviarLinkDoPedido` tem três chamadores, e o primeiro remendo só
     * apanhou um. Os outros dois eram os piores:
     *
     *   · `promover` manda o email que acompanha o arranque da negociação a
     *     sério, e o número que lá punha nunca era do cliente — era o que o
     *     assistente escreveu, ou a conta da CLYON;
     *   · `reenviar` lê a coluna `valorDesejadoCliente`, que guarda três
     *     coisas indistinguíveis. Não há como saber se o número é dele.
     *
     * Este teste não chega para ver o comportamento, mas chega para não
     * deixar o número voltar sem alguém escrever porquê.
     */
    for (const rota of [
      "src/app/api/admin/negociacoes/promover/route.ts",
      "src/app/api/admin/negociacoes/reenviar/route.ts",
    ]) {
      expect(semComentarios(ler(rota))).toContain("valorDesejadoCliente: null,");
    }
  });

  it("e o valor de arranque nunca leva IVA lá dentro", () => {
    /*
     * "Nós sempre vamos mostrar o valor sem IVA; caso o cliente deseje
     * factura será mais 23 %." — 22-09-2026.
     *
     * Este número é o que o profissional vê no cartão, por baixo da etiqueta
     * «já com a taxa, sem IVA». Vinha com imposto, e se ele o aceitasse o
     * imposto era somado outra vez pelo `contaDoCliente`.
     *
     * O `estimatedPriceWithVat` saiu da escolha — não ficou sequer como
     * último recurso, porque um último recurso é onde os defeitos voltam sem
     * ninguém dar por isso. A prova pelo VALOR está em
     * `valor-de-arranque.test.ts`; o que se guarda aqui é o nome que não
     * pode reaparecer no ficheiro.
     */
    const ARRANQUE = semComentarios(ler("src/lib/valor-de-arranque.ts"));
    expect(ARRANQUE).toContain("numeroUtil(estimativa.estimatedPriceWithoutVat) ??");
    expect(ARRANQUE).not.toContain("numeroUtil(estimativa.estimatedPriceWithVat)");
  });

  it("mas continua a chegar a quem faz as propostas", () => {
    // Sem ele, o profissional propõe às cegas — e é assim que nascem as
    // propostas que depois não se aguentam à porta do cliente.
    expect(ler("src/lib/pedido-valores.ts")).toContain('"valorDesejadoCliente"');
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

  it("e a página do link deixou de escrever números", () => {
    /*
     * Saíram os três, em dois dias: a estimativa do motor, o valor que o
     * cliente indicou, e a nota que explicava a origem dos dois. O dinheiro
     * que ele vê está todo no bloco das propostas, que tem a sua própria
     * conta e o seu próprio «sem IVA».
     *
     * A prova mais dura de que não sobrou nenhum: o formatador de euros desta
     * página foi apagado por não ter quem o chamasse.
     */
    expect(LINK).not.toContain("A nossa estimativa");
    expect(LINK).not.toContain("function euros(");
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
