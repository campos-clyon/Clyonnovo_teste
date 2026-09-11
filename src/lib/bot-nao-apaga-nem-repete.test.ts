import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  leituraDirecta,
  perguntaPendente,
  responderComCompreensao,
  recolhaNova,
  type DadosDaRecolha,
} from "./whatsapp-recolha";
import { paraTeclado } from "./whatsapp-cloud";

/**
 * O ASSISTENTE DEIXA DE APAGAR O QUE A PESSOA JÁ DISSE.
 *
 * "Ele repete perguntas mesmo já tendo sido respondidas, usa caracteres
 * especiais sem precisar, e deixa conversas sem concluir." — 11-09-2026,
 * sobre conversas reais.
 *
 * O PIOR DELAS, e o que este ficheiro guarda:
 *
 *   CLYON:   Precisa de factura com NIF?
 *   CLIENTE: Não
 *   CLYON:   Desculpe, não apanhei. Precisa de factura com NIF?
 *   CLIENTE: Não preciso
 *   CLYON:   Está bem, fica sem efeito.            <- apagou o pedido INTEIRO
 *   CLIENTE: Não preciso é de factura o serviço preciso
 *   CLYON:   Bom dia! Aqui é a CLYON. Diga-me...   <- e recebeu-o como estranho
 *
 * Duas causas, e as duas estão corrigidas aqui. O aviso ao Gemini nunca
 * dizia qual era a pergunta em cima da mesa, e a definição de «cancelar»
 * dava-lhe «já não preciso» como exemplo. E `desistir` fazia um DELETE seco,
 * sem confirmação e sem volta.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const COMPREENSAO = ler("src/lib/whatsapp-compreensao.ts");
const NEGOCIACAO = ler("src/lib/whatsapp-negociacao.ts");

const T0 = new Date("2026-09-11T10:00:00.000Z");

/** Uma recolha com trabalho feito — o que a Sra. Ana tinha quando se perdeu. */
const COM_TRABALHO: DadosDaRecolha = {
  serviceType: "esvaziamento_casa",
  contactName: "Ana Almeida",
  address: "Rua Francisco Andrade 3",
  postalCode: "2765-094",
  city: "São João do Estoril",
  description: "duas camas, dois colchões, duas cómodas, uma estante",
};

describe("um DELETE não fica do outro lado de um palpite", () => {
  it("com trabalho feito, desistir PERGUNTA antes — e não apaga nada", () => {
    const r = responderComCompreensao(
      { passo: "fatura", dados: COM_TRABALHO },
      { intencao: "cancelar", campos: {} },
      T0,
      { texto: "Não preciso" },
    );
    expect(r.desistir).toBeFalsy();
    expect(r.resposta).toContain("quer mesmo desistir");
    // E o que já se sabe continua lá, inteiro.
    expect(r.estado.dados.serviceType).toBe("esvaziamento_casa");
    expect(r.estado.dados.address).toBe("Rua Francisco Andrade 3");
  });

  it("quem lê a resposta a essa pergunta é o CÓDIGO, não o modelo", () => {
    /*
     * O teste que fecha a porta. Se a confirmação voltar a depender de uma
     * etiqueta devolvida pelo Gemini, a falha volta — noutra frase que
     * ninguém previu.
     */
    const perguntado = { passo: "fatura" as const, dados: { ...COM_TRABALHO, aConfirmarDesistencia: true } };

    const sim = responderComCompreensao(perguntado, { intencao: "informar", campos: {} }, T0, {
      texto: "sim",
    });
    expect(sim.desistir).toBe(true);

    const cancelar = responderComCompreensao(perguntado, { intencao: "informar", campos: {} }, T0, {
      texto: "CANCELAR",
    });
    expect(cancelar.desistir).toBe(true);
  });

  it("uma resposta que não é SIM desfaz a pergunta e a conversa segue", () => {
    // Ele não queria desistir: queria dizer que não precisava de factura.
    const r = responderComCompreensao(
      { passo: "fatura", dados: { ...COM_TRABALHO, aConfirmarDesistencia: true } },
      { intencao: "informar", campos: {} },
      T0,
      { texto: "não preciso é de factura, o serviço preciso" },
    );
    expect(r.desistir).toBeFalsy();
    expect(r.estado.dados.aConfirmarDesistencia).toBeUndefined();
    expect(r.estado.dados.serviceType).toBe("esvaziamento_casa");
  });

  it("sem nada recolhido, desistir continua a ser imediato", () => {
    // Não há o que perder, e obrigar a confirmar seria ficar-lhe com a conversa.
    const r = responderComCompreensao(recolhaNova(), { intencao: "cancelar", campos: {} }, T0, {
      texto: "deixa estar",
    });
    expect(r.desistir).toBe(true);
  });

  it("o aviso ao modelo diz que na dúvida NÃO é cancelar", () => {
    expect(COMPREENSAO).toContain("Na dúvida NÃO é cancelar");
    // E deixou de lhe oferecer a frase do cliente como exemplo de desistência.
    expect(COMPREENSAO).not.toContain('"já não preciso"');
  });
});

describe("a pergunta em cima da mesa viaja com a mensagem", () => {
  it("o modelo passa a saber a que é que a pessoa está a responder", () => {
    expect(COMPREENSAO).toContain("A PERGUNTA QUE A CLYON ACABOU DE FAZER");
    expect(COMPREENSAO).toContain("perguntaPendente?: string");
    expect(NEGOCIACAO).toContain("const pendente = perguntaPendente(e.passo, e.dados as never);");
    expect(NEGOCIACAO).toContain("agora, pendente)");
  });

  it("a pergunta cabe numa linha — no passo do serviço não leva o bom dia", () => {
    // Num aviso ao modelo, a saudação e o exemplo são ruído.
    const p = perguntaPendente("servico", {});
    expect(p).not.toContain("Bom dia");
    expect(p.split("\n")).toHaveLength(1);
    expect(perguntaPendente("elevador", {}).split("\n")).toHaveLength(1);
  });
});

describe("as perguntas fechadas lêem-se sem modelo nenhum", () => {
  it("um «Não» à factura é lido, e já não dá «não apanhei»", () => {
    /*
     * `simOuNao("Não")` sempre soube ler isto. O caminho existia e nunca era
     * tentado, porque a função pura não recebia o texto cru.
     */
    expect(leituraDirecta("fatura", "Não")).toEqual({ fatura: "nao" });
    expect(leituraDirecta("elevador", "Sim tem elevador")).toEqual({ elevador: "sim" });
    expect(leituraDirecta("estacionamento", "sim dá para encostar")).toEqual({
      estacionamento: "sim",
    });
  });

  it("e a leitura directa manda sobre o silêncio do modelo", () => {
    const r = responderComCompreensao(
      { passo: "fatura", dados: COM_TRABALHO },
      { intencao: "informar", campos: {} },
      T0,
      { texto: "Não" },
    );
    expect(r.estado.dados.precisaFatura).toBe(false);
    expect(r.resposta).not.toContain("não apanhei");
  });

  it("as perguntas ABERTAS ficam de fora — de propósito", () => {
    /*
     * Uma leitura à letra no passo do nome transformava «Qual o valor?» no
     * nome do cliente, que é pior do que não perceber.
     */
    expect(leituraDirecta("nome", "Qual o valor?")).toBeNull();
    expect(leituraDirecta("morada", "Tem contacto telefónico???")).toBeNull();
    expect(leituraDirecta("descricao", "qualquer coisa")).toBeNull();
  });

  it("o andar só aceita o que se parece com um andar", () => {
    expect(leituraDirecta("andar", "2")).toEqual({ andar: "2" });
    expect(leituraDirecta("andar", "r/c")).toEqual({ andar: "r/c" });
    expect(leituraDirecta("andar", "3º")).toEqual({ andar: "3º" });
    // Uma frase inteira não é um andar — `andarDoTexto` devolvia-a tal e qual.
    expect(leituraDirecta("andar", "não sei bem, acho que é o segundo mas")).toBeNull();
  });

  it("o código postal só passa com quatro dígitos e três", () => {
    expect(leituraDirecta("codigoPostal", "2900-283")).toEqual({ codigoPostal: "2900-283" });
    expect(leituraDirecta("codigoPostal", "não sei")).toBeNull();
  });
});

describe("falar primeiro, interromper depois", () => {
  it("a despedida sai ANTES de o portão fechar", () => {
    /*
     * `enviarTextoWhatsApp` passa por `podeOWhatsAppFalarCom`, que devolve
     * falso para um número interrompido há um milissegundo. A mensagem era
     * engolida sem erro, e quem pediu para falar com uma pessoa ficava a
     * olhar para o silêncio — que é o pior fim possível para esse pedido.
     */
    const i = NEGOCIACAO.indexOf("if (r.pedirPessoa) {");
    const bloco = NEGOCIACAO.slice(i, NEGOCIACAO.indexOf("return;", i));
    expect(bloco.indexOf("enviarTextoWhatsApp")).toBeLessThan(
      bloco.indexOf("interromperNumeroWhatsApp"),
    );
  });

  it("e o mesmo quando o registo automático falha", () => {
    const i = NEGOCIACAO.indexOf("não consegui registar sozinho");
    const antes = NEGOCIACAO.slice(Math.max(0, i - 400), i);
    expect(antes).toContain("enviarTextoWhatsApp(");
    expect(antes).not.toContain("interromperNumeroWhatsApp(");
  });
});

describe("o teclado de quem está do outro lado", () => {
  it("as aspas angulares, os travessões e os pontos médios saem", () => {
    expect(paraTeclado("Por exemplo: «um sofá».")).toBe('Por exemplo: "um sofá".');
    expect(paraTeclado("Rua e número — é por aí")).toBe("Rua e número - é por aí");
    expect(paraTeclado("móveis · Rua X · sexta")).toBe("móveis, Rua X, sexta");
    expect(paraTeclado("a carregar…")).toBe("a carregar...");
  });

  it("os acentos ficam — «não» é português, «—» é tipografia", () => {
    expect(paraTeclado("Não há elevador, e a mudança é à quinta")).toBe(
      "Não há elevador, e a mudança é à quinta",
    );
  });

  it("aplica-se no ÚNICO sítio por onde tudo sai", () => {
    // Corrigir as trinta e tal frases uma a uma deixava sempre a próxima por
    // corrigir. Aqui apanha recolha, releitura e negociação, nos três canais.
    const CLOUD = ler("src/lib/whatsapp-cloud.ts");
    const i = CLOUD.indexOf("async function enviarTextoPorCanal(");
    expect(CLOUD.slice(i, i + 200)).toContain("texto = paraTeclado(texto);");
  });
});
