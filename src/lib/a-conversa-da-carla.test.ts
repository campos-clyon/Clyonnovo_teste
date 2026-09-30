import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aberturaDaResposta,
  eUmaMoradia,
  interpretarQuando,
  jaCumprimentouNesteFio,
  jaDisseQueNaoCompra,
  querVenderBens,
  responderNaRecolha,
  simOuNao,
  simOuNaoNaFactura,
  recolhaNova,
  NAO_COMPRAMOS,
} from "./whatsapp-recolha";
import { estaAPerderAPaciencia } from "./cliente-a-perder-a-paciencia";
import { jaFoiDito } from "./nao-repetir";

/**
 * A CONVERSA DA CARLA — 30-09-2026, 12:21 às 12:50.
 *
 * Uma cliente escreveu «tenho alguns artigos para venda», mandou trinta e duas
 * fotografias, respondeu a treze perguntas durante vinte e cinco minutos, e no
 * fim tinha: um pedido de recolha PAGA registado em nome dela quando o que
 * queria era vender; uma marcação para uma hora que já tinha passado; três
 * perguntas suas sem resposta; a mesma frase repetida três vezes; e a conversa
 * a recomeçar do zero com «Bom dia! Aqui é a CLYON» depois de o pedido estar
 * registado.
 *
 * O dono olhou para a transcrição e escreveu uma palavra: «Corrija».
 *
 * Este ficheiro guarda os oito defeitos, um a um, com as frases dela. Não é
 * uma lista de casos inventados: é aquela conversa, e a garantia de que ela
 * não volta a correr assim.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** O ficheiro sem comentários: um teste não se pode dar por satisfeito com uma nota. */
function semNotas(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/* 12:44, hora de Lisboa, de uma quarta-feira. O instante exacto da mensagem. */
const QUANDO_ELA_ESCREVEU = new Date("2026-09-30T11:44:00Z");

describe("1. o pedido registado deixa de fazer dela uma cliente nova", () => {
  const DB = semNotas(ler("src/lib/db.ts"));
  const CEREBRO = semNotas(ler("src/lib/whatsapp-negociacao.ts"));

  it("gravar um passo da recolha não apaga o pedido que ela já criou", () => {
    /*
     * `guardarRecolhaWhatsApp` escrevia `pedidoId = NULL` em TODA a gravação.
     * Registado o #402, a mensagem seguinte começava uma recolha nova, essa
     * recolha gravava-se, e a gravação apagava o #402 da linha — ficando a
     * poder registar-lhe um segundo pedido pelo mesmo trabalho.
     */
    const i = DB.indexOf("INSERT INTO whatsappRecolhas");
    expect(i).toBeGreaterThan(-1);
    const upsert = DB.slice(i, DB.indexOf("`,", i));
    expect(upsert, "o upsert voltou a apagar o pedidoId").not.toMatch(/pedidoId\s*=\s*NULL/);
  });

  it("e há um sítio, um só, que diz «a partir daqui é outro pedido»", () => {
    expect(DB).toContain("export async function recomecarRecolhaWhatsApp");
    expect(CEREBRO).toContain("recomecarRecolhaWhatsApp");
  });

  it("uma recolha com pedido vivo responde pelo pedido, e não com um bom dia", () => {
    /*
     * A CAUSA DA FRASE DAS 12:48. `guardada.pedidoId != null` punha o estado a
     * null, e o ramo de «não há estado» é o do cliente desconhecido: manda
     * `perguntaDo("servico")`, que abre com «Bom dia! Aqui é a CLYON».
     *
     * Agora pergunta-se se o pedido está VIVO — pelo número dele, que é a
     * única leitura que não depende do formato do telefone.
     */
    const i = CEREBRO.indexOf("const pedidoDaConversa");
    expect(i, "a verificação do pedido desapareceu").toBeGreaterThan(-1);
    const bloco = CEREBRO.slice(i, i + 900);
    expect(bloco).toContain("getSimulatorOrderById");
    expect(bloco).toContain("responderAQuemJaTemPedido");
    /* E vem ANTES de se decidir o estado, senão não serve de nada. */
    expect(i).toBeLessThan(CEREBRO.indexOf("const estado: Estado | null"));
  });

  it("e essa resposta NÃO passa a conversa a uma pessoa", () => {
    /*
     * ⚠️ A TENTAÇÃO ERRADA, E A RAZÃO DE SER DESTA LINHA.
     *
     * Escalar parecia o gesto simpático. Mas `passarAUmaPessoa` chama
     * `interromperNumeroWhatsApp`, e essa marca NÃO caduca: até alguém lhe
     * tocar no backoffice, `podeOWhatsAppFalarCom` devolve falso e as
     * propostas dos profissionais nunca lhe chegam. Para lhe responder mais
     * depressa tirava-se-lhe o pedido.
     */
    const i = CEREBRO.indexOf("async function responderAQuemJaTemPedido");
    expect(i).toBeGreaterThan(-1);
    const corpo = CEREBRO.slice(i, CEREBRO.indexOf("\n}", i));
    expect(corpo, "voltou a calar o canal dela").not.toContain("passarAUmaPessoa");
    expect(corpo, "voltou a calar o canal dela").not.toContain("interromperNumeroWhatsApp");
  });
});

describe("2. a guarda contra repetições volta a estar viva", () => {
  /*
   * O DEFEITO MAIS CARO DOS OITO, porque sozinho explicava três sintomas.
   *
   * O guarda existia, estava na porta certa (`enviarTextoWhatsApp`) e nunca
   * disparou uma única vez: `criadoEm` é um DATETIME escrito pelo relógio do
   * MySQL e lido pelo mysql2 no fuso do processo (`Europe/Lisbon`), ou seja um
   * instante uma hora no passado no Verão. A janela que ele vigia são dez
   * minutos; o erro do relógio, sessenta.
   *
   * É o mesmo erro que já tinha feito o painel dizer «a ponte não vem há 1 h»
   * com a ponte viva.
   */
  const agora = new Date("2026-09-30T12:50:00Z");
  const umaHoraAtrasada = new Date("2026-09-30T11:49:00Z").toISOString();

  it("o carimbo uma hora atrasado deixava passar a repetição de há um minuto", () => {
    const so_carimbo = [{ direccao: "out", texto: "Com certeza.", criadoEm: umaHoraAtrasada }];
    /* Era isto que acontecia: a mensagem de há um minuto parecia ter uma hora. */
    expect(jaFoiDito("Com certeza.", so_carimbo, agora, 10 / 60)).toBe(false);
  });

  it("com a idade contada pela base, a mesma repetição é apanhada", () => {
    const comIdade = [
      { direccao: "out", texto: "Com certeza.", criadoEm: umaHoraAtrasada, haSegundos: 60 },
    ];
    expect(jaFoiDito("Com certeza.", comIdade, agora, 10 / 60)).toBe(true);
  });

  it("e o que é mesmo antigo continua a poder ser dito outra vez", () => {
    const velha = [
      { direccao: "out", texto: "Com certeza.", criadoEm: umaHoraAtrasada, haSegundos: 3 * 3600 },
    ];
    expect(jaFoiDito("Com certeza.", velha, agora, 10 / 60)).toBe(false);
  });

  it("as fotografias dela deixam de empurrar o que o assistente disse", () => {
    /*
     * A segunda metade do mesmo defeito: lia-se a conversa toda, vinte linhas
     * nos dois sentidos, e ela mandou DEZASSEIS fotografias de uma vez. As
     * vinte enchiam-se com as fotos, e a pergunta de há um minuto caía fora da
     * janela. Agora lêem-se vinte SAÍDAS.
     */
    const NUVEM = semNotas(ler("src/lib/whatsapp-cloud.ts"));
    expect(NUVEM).toContain("saidasDoNumeroWhatsApp");
    expect(NUVEM, "voltou a ler as duas direcções").not.toContain(
      "mensagensDoNumeroWhatsApp(para, 20)",
    );
  });
});

describe("3. a urgência dela deixa de virar uma hora que ela nunca disse", () => {
  it("«Tenho urgência estou de mudanças» não marca hora nenhuma", () => {
    /*
     * O resumo devolveu-lhe «Quando: quarta-feira, 30 de setembro às 12:00» —
     * uma hora inventada por `parede.getUTCHours() + 1`, e já passada quando
     * ela o leu. Ela respondeu «Mas 30 de setembro é hoje» e «E já são quase
     * 12h», e tinha razão nas duas.
     */
    const r = interpretarQuando("Tenho urgência estou de mudanças", QUANDO_ELA_ESCREVEU);
    expect(r.data).toBeNull();
    expect(r.urgency).toBe("today");
  });

  it("e nunca devolve uma data que já passou", () => {
    for (const frase of ["urgente", "hoje", "é para hoje", "o mais rápido"]) {
      const r = interpretarQuando(frase, QUANDO_ELA_ESCREVEU);
      if (r.data) {
        expect(r.data.getTime(), frase).toBeGreaterThanOrEqual(QUANDO_ELA_ESCREVEU.getTime());
      }
    }
  });

  it("mas uma hora DITA continua a valer, que é o que ele escreveu", () => {
    const r = interpretarQuando("hoje às 16h", QUANDO_ELA_ESCREVEU);
    expect(r.data).not.toBeNull();
    expect(r.urgency).toBe("today");
  });
});

describe("4. «Podemos evitar isso» é um não", () => {
  it("na pergunta da factura, que é onde ela o escreveu", () => {
    expect(simOuNaoNaFactura("Podemos evitar isso")).toBe("nao");
    for (const f of ["dispenso", "não é preciso", "sem factura", "prefiro evitar"]) {
      expect(simOuNaoNaFactura(f), f).toBe("nao");
    }
  });

  it("e o sim continua a ser sim", () => {
    for (const f of ["sim", "preciso de factura", "quero fatura com NIF"]) {
      expect(simOuNaoNaFactura(f), f).toBe("sim");
    }
  });

  it("⚠️ e a `simOuNao` de sempre NÃO foi alargada", () => {
    /*
     * «Evitar», «dispensar» e «não é preciso» só querem dizer NÃO quando a
     * pergunta é se ele PRECISA de alguma coisa. A mesma `simOuNao` responde a
     * «Há elevador?» e a «Dá para estacionar à porta?», e tem um ramo
     * permissivo no fim que, alargado, transformava leituras certas em erradas.
     *
     * Uma pergunta com vocabulário próprio lê-se com um leitor próprio.
     */
    expect(simOuNao("Podemos evitar isso")).toBeNull();
    expect(simOuNao("dispenso")).toBeNull();
  });
});

describe("5. uma moradia não tem elevador para perguntar", () => {
  it("reconhece-se pelas palavras dela", () => {
    expect(eUmaMoradia("É uma moradia,")).toBe(true);
    expect(eUmaMoradia("é uma vivenda")).toBe(true);
    expect(eUmaMoradia("casa térrea")).toBe(true);
  });

  it("⚠️ mas um r/c NÃO é uma moradia", () => {
    /*
     * `andarDoTexto` devolve "0" para os dois — e um r/c pode ser a loja do
     * res-do-chão de um prédio de seis andares, que tem elevador e pode até ser
     * preciso. Deduzir daí que não há elevador era trocar uma pergunta a mais
     * por um dado errado, que é pior.
     */
    expect(eUmaMoradia("r/c")).toBe(false);
    expect(eUmaMoradia("piso zero")).toBe(false);
    expect(eUmaMoradia("0")).toBe(false);
  });

  it("e depois de «É uma moradia», a pergunta seguinte não é a do elevador", () => {
    const estado = { passo: "andar" as const, dados: { serviceType: "recolha_moveis" } };
    const r = responderNaRecolha(estado, "É uma moradia, está tudo no piso zero");
    expect(r.estado.dados.hasElevator).toBe("no");
    expect(r.resposta.toLowerCase(), "voltou a perguntar pelo elevador").not.toContain("elevador");
  });
});

describe("6. ela queria VENDER, e a CLYON não compra", () => {
  it("as três frases dela são reconhecidas", () => {
    expect(querVenderBens("Bom dia tenho alguns artigos para venda.")).toBe(true);
    expect(querVenderBens("Quero vender estes artigos semi-novos e preciso de recolha")).toBe(true);
    expect(querVenderBens("E qual o valor para compra para os artigos que eu enviei")).toBe(true);
  });

  it("⚠️ E NUNCA, EM CASO NENHUM, EM «VENDA DE CASA»", () => {
    /*
     * O TESTE MAIS IMPORTANTE DESTE BLOCO.
     *
     * Metade dos pedidos da CLYON são esvaziar para vender o imóvel — herança,
     * mudança, escritura. O próprio exemplo da página de serviços é «Herdei um
     * T2 cheio e preciso de esvaziar para vender». Dizer a essa pessoa que não
     * compramos é responder a uma pergunta que ela não fez, e é o tipo de
     * resposta que a manda embora.
     *
     * Não apanhar quem queria vender custa uma conversa. Mandar este aviso a
     * quem está a esvaziar a casa da mãe custa o cliente.
     */
    for (const f of [
      "estou de mudanças por venda de casa, preciso de recolha",
      "esvaziamento para venda de imóvel",
      "a casa está à venda e preciso de esvaziar",
      "vou pôr a casa para venda, preciso de tirar os móveis",
      "Herdei um T2 cheio e preciso de esvaziar para vender. Ajudam?",
      "preciso de esvaziar uma arrecadação para venda",
      "o apartamento está para venda",
    ]) {
      expect(querVenderBens(f), f).toBe(false);
    }
  });

  it("⚠️ nem nas frases que o próprio site usa para descrever o negócio", () => {
    /*
     * Estas não são inventadas: saíram do `grep` do repositório, das páginas de
     * serviços e do blogue da CLYON. São a maneira como a casa fala dos seus
     * próprios clientes — e nenhuma delas pode disparar um aviso de que não
     * compramos.
     *
     * A última é uma freguesia da Amadora. A palavra «venda» aparece em sítios
     * que não têm nada a ver com vender.
     */
    for (const f of [
      "Está a fazer mudança, venda de casa ou herança",
      "Esvaziamento de imóvel para venda ou arrendamento",
      "Venda de casa com necessidade de esvaziamento rápido",
      "Há muitos casos em que o imóvel precisa de ser preparado para venda, aluguer ou remodelação",
      "Comece por percorrer todas as divisões e separar o que vai manter, doar, vender ou descartar",
      "vender móveis usados",
      "Falagueira-Venda Nova",
    ]) {
      expect(querVenderBens(f), f).toBe(false);
    }
  });

  it("o que se lhe diz é curto, é verdade, e não lhe fecha a porta", () => {
    expect(NAO_COMPRAMOS).toContain("não compra artigos");
    expect(NAO_COMPRAMOS).toContain("o cliente paga");
    /* Não decide por ela: a recolha continua em cima da mesa. */
    expect(NAO_COMPRAMOS).toContain("Se ainda assim quiser a recolha");
    expect(NAO_COMPRAMOS).toMatch(/falar com alguém/);
  });

  it("e diz-se UMA vez — a segunda cópia era o defeito de ontem", () => {
    const fio = [{ direccao: "out", texto: NAO_COMPRAMOS + "Com quem estou a falar?" }];
    expect(jaDisseQueNaoCompra(fio)).toBe(true);
    expect(jaDisseQueNaoCompra([{ direccao: "out", texto: "Com quem estou a falar?" }])).toBe(false);
    expect(jaDisseQueNaoCompra(null)).toBe(false);
  });

  it("sai colado à pergunta seguinte, e não em lugar dela", () => {
    /* O formulário não se interrompe: a decisão de continuar é dela. */
    const r = responderNaRecolha(recolhaNova(), "Quero vender estes artigos, e preciso de recolha");
    expect(r.resposta).toContain("não compra artigos");
    expect(r.resposta.length).toBeGreaterThan(NAO_COMPRAMOS.length);
  });
});

describe("7. um bom dia por conversa, e não dois", () => {
  it("sabendo que já se cumprimentou, não se cumprimenta outra vez", () => {
    const dados = { contactName: "Carla Tivoli" };
    expect(aberturaDaResposta(dados, "servico", "nome", QUANDO_ELA_ESCREVEU, true)).toBe("");
  });

  it("e sem saber, faz-se como sempre se fez", () => {
    const dados = { contactName: "Carla Tivoli" };
    expect(aberturaDaResposta(dados, "servico", "nome", QUANDO_ELA_ESCREVEU, false)).toContain(
      "Aqui é a CLYON",
    );
  });

  it("quem sabe é o fio, e não uma bandeira nos dados", () => {
    /*
     * Uma bandeira nos dados viajava com o pedido e era mais uma coisa a poder
     * ficar dessincronizada — o reparo que o comentário da função já fazia. O
     * fio já está lido para ir ao modelo; ver nele quem cumprimentou não custa
     * uma consulta a mais.
     */
    expect(jaCumprimentouNesteFio([{ direccao: "out", texto: "Bom dia! Aqui é a CLYON." }])).toBe(
      true,
    );
    expect(jaCumprimentouNesteFio([{ direccao: "in", texto: "Aqui é a CLYON" }])).toBe(false);
    expect(jaCumprimentouNesteFio([{ direccao: "out", texto: "Com quem estou a falar?" }])).toBe(
      false,
    );
    expect(jaCumprimentouNesteFio(undefined)).toBe(false);
  });
});

describe("8. quem diz que não lhe responderam fala com uma pessoa", () => {
  it("a frase dela, tal e qual", () => {
    expect(estaAPerderAPaciencia("Ainda não me respondeu se se o pagamento é feito na hora")).toBe(
      true,
    );
  });

  it("e as outras maneiras de dizer o mesmo", () => {
    for (const f of [
      "não me responderam",
      "já perguntei três vezes",
      "continuo sem resposta",
      "ainda não me disse quanto custa",
    ]) {
      expect(estaAPerderAPaciencia(f), f).toBe(true);
    }
  });

  it("⚠️ e uma pergunta normal continua a ser uma pergunta normal", () => {
    /*
     * Este ficheiro tira conversas ao assistente e entrega-as a pessoas. Um
     * sinal largo de mais enche a mesa da equipa de conversas que o assistente
     * sabia tratar, e ensina-a a ignorar a etiqueta.
     */
    for (const f of [
      "quanto custa uma recolha?",
      "não sei o código postal",
      "não tenho elevador",
      "não preciso de factura",
      "bom dia, queria um orçamento",
    ]) {
      expect(estaAPerderAPaciencia(f), f).toBe(false);
    }
  });
});
