import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PedidoParaOAssistente } from "./db";
import { PRAZO_DA_PROPOSTA_HORAS } from "./negociacao";
import {
  DIAS_DE_NOVIDADE,
  HORAS_ATE_ESTRANHAR_O_SILENCIO,
  aindaENovidade,
  chaveDaAceitacao,
  chaveDaProposta,
  chaveDoFecho,
  comoTratar,
  diaEmLisboa,
  eParaAEquipa,
  esperaResposta,
  novidadeAContar,
  novidadesDoPedido,
  textoDoLembrete,
  type Novidade,
} from "./assistente-automatico";
import {
  CAPACIDADES,
  ESCADA_DOS_LEMBRETES,
  FICHA_DA_CAPACIDADE,
  TOQUES_NO_MAXIMO,
  deveTocar,
  eCapacidade,
  esgotou,
  horaDeFalar,
  horasAteAoToqueSeguinte,
  interruptoresNaDuvida,
  interruptoresPorOmissao,
} from "./assistente-interruptores";

/**
 * O ASSISTENTE AUTOMÁTICO DA CLYON.
 *
 * "Quero que o bot do WhatsApp seja um assistente da CLYON automático que faça
 * a gestão de conversas, trabalhos e clientes. Sempre que tenha novidade deve
 * informar o cliente. Caso o cliente não responda, deve reenviar mensagens para
 * garantir que o pedido fique finalizado. E cada uma dessas ferramentas deve ter
 * a opção de o admin parar, caso esteja a cometer erros." — 12-09-2026.
 *
 * O que este ficheiro guarda, por ordem do que custa se estiver errado:
 *
 *   1. que a mesma novidade NÃO sai duas vezes — a chave é a única defesa, e é
 *      construída em dois sítios que têm de concordar à letra;
 *   2. que o assistente não insiste sem fim nem de madrugada;
 *   3. que cada capacidade tem interruptor, e que o geral manda sobre todos;
 *   4. que as mensagens falam como gente: sem SIM/NÃO, sem identificadores da
 *      base, e sem tratar por "senhor" um nome cujo género ninguém guardou.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CEREBRO = ler("src/lib/assistente-automatico.ts");
const NEGOCIACAO = ler("src/lib/whatsapp-negociacao.ts");
const DB = ler("src/lib/db.ts");
const CRON = ler("src/app/api/cron/assistente/route.ts");
const ROTA = ler("src/app/api/admin/whatsapp/assistente/route.ts");
const PAINEL = ler("src/components/admin/AdminAssistenteAutoPanel.tsx");

/** Uma tarde de quinta-feira em Lisboa. Hora de falar com toda a gente. */
const TARDE = new Date("2026-09-17T14:00:00Z");
/** Três da manhã em Lisboa. Ninguém fala com ninguém. */
const MADRUGADA = new Date("2026-09-17T02:00:00Z");

function pedido(o: Partial<PedidoParaOAssistente> = {}): PedidoParaOAssistente {
  return {
    id: 501,
    contactName: "João Ribeiro",
    contactPhone: "912345678",
    serviceType: "recolha_moveis",
    status: "atribuido",
    createdAt: new Date("2026-09-17T09:00:00Z"),
    dataAgendada: null,
    negociacoes: [],
    ...o,
  };
}

function negociacao(o: Partial<PedidoParaOAssistente["negociacoes"][number]> = {}) {
  return {
    id: 77,
    estado: "aberta",
    valorAcordado: null,
    propostasJson: null,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    dataCombinada: null,
    avaliadoEm: null,
    profissionalNome: "Fred",
    regimeIva: null,
    actualizadaEm: new Date("2026-09-17T13:00:00Z"),
    ...o,
  };
}

function propostaDoPro(valor: number, criadaEm = "2026-09-17T13:00:00Z") {
  return JSON.stringify([{ por: "profissional", valor, criadaEm, estado: "pendente" }]);
}

const tudoLigado = () => true;
const tudoParado = () => false;

/* ────────────────────────────────────────────────────────────────────────── */

describe("as novidades que ele tem para contar", () => {
  it("a proposta nova, com o valor do profissional E o que o cliente paga", () => {
    /*
     * O exemplo que o dono deu: «o senhor acaba de receber uma proposta do
     * Fred no valor de 150 s/IVA». Falta-lhe uma coisa, e é a que gera
     * telefonemas: 150 não é o que ele paga. Com a taxa da CLYON são 157,50 €,
     * e é esse o número que ele vai ver na factura.
     */
    const n = novidadesDoPedido(
      pedido({ negociacoes: [negociacao({ propostasJson: propostaDoPro(150) })] }),
      TARDE,
    );
    const p = n.find((x) => x.especie === "proposta_nova")!;
    expect(p).toBeTruthy();
    expect(p.texto).toContain("150,00 €");
    expect(p.texto).toContain("157,50 €");
    expect(p.texto).toContain("Fred");
    expect(p.capacidade).toBe("propostas");
  });

  it("o serviço vai em palavras, e nunca o identificador da base", () => {
    const n = novidadesDoPedido(
      pedido({ negociacoes: [negociacao({ propostasJson: propostaDoPro(150) })] }),
      TARDE,
    );
    for (const x of n) {
      expect(x.texto).not.toContain("recolha_moveis");
      expect(x.texto).not.toContain("undefined");
      expect(x.texto).not.toContain("null");
    }
  });

  it("uma proposta com mais de 48 horas já não é novidade nenhuma", () => {
    // O prazo da proposta é de 48 h. Passado isso ela não espera por ninguém,
    // e anunciá-la seria mandar o cliente responder a uma coisa morta.
    const n = novidadesDoPedido(
      pedido({
        negociacoes: [negociacao({ propostasJson: propostaDoPro(150, "2026-09-14T13:00:00Z") })],
      }),
      TARDE,
    );
    expect(n.find((x) => x.especie === "proposta_nova")).toBeUndefined();
  });

  it("uma proposta do CLIENTE não é novidade para o cliente", () => {
    const n = novidadesDoPedido(
      pedido({
        negociacoes: [
          negociacao({
            propostasJson: JSON.stringify([
              { por: "cliente", valor: 200, criadaEm: "2026-09-17T13:00:00Z", estado: "pendente" },
            ]),
          }),
        ],
      }),
      TARDE,
    );
    expect(n.find((x) => x.especie === "proposta_nova")).toBeUndefined();
  });

  it("o profissional aceitou: falta a palavra dele", () => {
    const n = novidadesDoPedido(
      pedido({
        negociacoes: [negociacao({ estado: "aguarda_contratacao", valorAcordado: "200.00" })],
      }),
      TARDE,
    );
    const a = n.find((x) => x.especie === "pro_aceitou")!;
    expect(a.texto).toContain("200,00 €");
    expect(a.texto).toContain("210,00 €");
    expect(a.chave).toBe(chaveDaAceitacao(77, 200));
  });

  it("fechado, dia marcado, trabalho feito, agradecimento e avaliação", () => {
    const comum = { estado: "acordada", valorAcordado: "300.00" };
    const so = (p: PedidoParaOAssistente) =>
      novidadesDoPedido(p, TARDE).map((x) => x.especie);

    expect(so(pedido({ negociacoes: [negociacao(comum)] }))).toContain("fechado");

    expect(
      so(
        pedido({
          negociacoes: [negociacao({ ...comum, dataCombinada: new Date("2026-09-20T09:00:00Z") })],
        }),
      ),
    ).toContain("dia_marcado");

    expect(
      so(
        pedido({
          negociacoes: [
            negociacao({ ...comum, execucaoEnviadaEm: new Date("2026-09-17T11:00:00Z") }),
          ],
        }),
      ),
    ).toContain("trabalho_feito");

    expect(
      so(
        pedido({
          negociacoes: [
            negociacao({
              ...comum,
              execucaoEnviadaEm: new Date("2026-09-15T11:00:00Z"),
              confirmadoEm: new Date("2026-09-16T11:00:00Z"),
            }),
          ],
        }),
      ),
    ).toEqual(expect.arrayContaining(["agradecimento", "avaliacao"]));
  });

  it("a avaliação só no dia seguinte, e nunca a quem já avaliou", () => {
    const base = {
      estado: "acordada",
      valorAcordado: "300.00",
      execucaoEnviadaEm: new Date("2026-09-16T11:00:00Z"),
      confirmadoEm: new Date("2026-09-17T11:00:00Z"),
    };
    // Confirmado há três horas: o obrigado sai, o pedido de avaliação não.
    const cedo = novidadesDoPedido(pedido({ negociacoes: [negociacao(base)] }), TARDE).map(
      (x) => x.especie,
    );
    expect(cedo).toContain("agradecimento");
    expect(cedo).not.toContain("avaliacao");

    // E quem já avaliou não é chateado outra vez.
    const jaAvaliou = novidadesDoPedido(
      pedido({
        negociacoes: [
          negociacao({
            ...base,
            confirmadoEm: new Date("2026-09-15T11:00:00Z"),
            avaliadoEm: new Date("2026-09-16T11:00:00Z"),
          }),
        ],
      }),
      TARDE,
    ).map((x) => x.especie);
    expect(jaAvaliou).not.toContain("avaliacao");
  });

  it("a véspera é a véspera — não o próprio dia nem a semana toda", () => {
    const amanha = new Date("2026-09-18T09:00:00Z");
    const daquiATresDias = new Date("2026-09-20T09:00:00Z");
    const comData = (d: Date) =>
      novidadesDoPedido(
        pedido({
          negociacoes: [
            negociacao({ estado: "acordada", valorAcordado: "300.00", dataCombinada: d }),
          ],
        }),
        TARDE,
      ).map((x) => x.especie);
    expect(comData(amanha)).toContain("vespera");
    expect(comData(daquiATresDias)).not.toContain("vespera");
  });

  it("um trabalho já feito não leva lembrete de véspera", () => {
    // A prova já entrou. Lembrar a véspera de um trabalho feito é dizer ao
    // cliente que ninguém está a olhar para o pedido dele.
    const especies = novidadesDoPedido(
      pedido({
        negociacoes: [
          negociacao({
            estado: "acordada",
            valorAcordado: "300.00",
            dataCombinada: new Date("2026-09-18T09:00:00Z"),
            execucaoEnviadaEm: new Date("2026-09-17T11:00:00Z"),
          }),
        ],
      }),
      TARDE,
    ).map((x) => x.especie);
    expect(especies).not.toContain("vespera");
  });

  it("sem telefone não há nada a contar — é por aí que ele fala", () => {
    expect(
      novidadesDoPedido(
        pedido({
          contactPhone: null,
          negociacoes: [negociacao({ propostasJson: propostaDoPro(150) })],
        }),
        TARDE,
      ),
    ).toEqual([]);
  });
});

describe("o pedido sem uma única proposta", () => {
  it("ao fim de dois dias, alguém tem de saber", () => {
    const n = novidadesDoPedido(
      pedido({
        createdAt: new Date("2026-09-14T09:00:00Z"),
        negociacoes: [negociacao({ id: 1 }), negociacao({ id: 2 })],
      }),
      TARDE,
    );
    const a = n.find((x) => x.especie === "sem_propostas")!;
    expect(a).toBeTruthy();
    expect(a.texto).toContain("#501");
    expect(HORAS_ATE_ESTRANHAR_O_SILENCIO).toBe(48);
  });

  it("e esse aviso é para a EQUIPA, nunca para o cliente", () => {
    /*
     * Um pedido sem propostas é um problema de OFERTA, não de conversa.
     * Resolve-se falando com os profissionais ou baixando o valor de partida.
     * Dizer ao cliente "ainda ninguém respondeu" três dias seguidos é
     * anunciar-lhe que a plataforma está vazia.
     */
    expect(eParaAEquipa("sem_propostas")).toBe(true);
    expect(eParaAEquipa("proposta_nova")).toBe(false);
    const a = novidadesDoPedido(
      pedido({ createdAt: new Date("2026-09-14T09:00:00Z"), negociacoes: [negociacao()] }),
      TARDE,
    ).find((x) => x.especie === "sem_propostas")!;
    // Não leva saudação nem tratamento: não é uma mensagem para ninguém ler
    // no WhatsApp.
    expect(a.texto).not.toContain("Boa tarde");
  });

  it("nas primeiras 48 horas cala-se: ainda é cedo", () => {
    const n = novidadesDoPedido(
      pedido({ createdAt: new Date("2026-09-17T09:00:00Z"), negociacoes: [negociacao()] }),
      TARDE,
    );
    expect(n.find((x) => x.especie === "sem_propostas")).toBeUndefined();
  });

  it("com uma proposta, ou com o negócio fechado, o alerta desaparece", () => {
    const velho = new Date("2026-09-10T09:00:00Z");
    const comProposta = novidadesDoPedido(
      pedido({
        createdAt: velho,
        negociacoes: [negociacao({ propostasJson: propostaDoPro(150) })],
      }),
      TARDE,
    );
    expect(comProposta.find((x) => x.especie === "sem_propostas")).toBeUndefined();

    const fechado = novidadesDoPedido(
      pedido({ createdAt: velho, negociacoes: [negociacao({ estado: "acordada" })] }),
      TARDE,
    );
    expect(fechado.find((x) => x.especie === "sem_propostas")).toBeUndefined();
  });
});

describe("uma novidade de cada vez, e só as recentes", () => {
  it("um pedido com meia dúzia de transições por contar manda UMA mensagem", () => {
    /*
     * É o cenário do primeiro dia: liga-se o interruptor e os pedidos que já
     * lá estão têm o fecho, o dia marcado, o trabalho feito e o agradecimento
     * todos por contar. Mandar as quatro seria estrear o assistente com uma
     * rajada a cada cliente — e desligá-lo antes do almoço.
     */
    const cheio = pedido({
      negociacoes: [
        negociacao({
          estado: "acordada",
          valorAcordado: "300.00",
          dataCombinada: new Date("2026-09-18T09:00:00Z"),
          execucaoEnviadaEm: new Date("2026-09-17T11:00:00Z"),
        }),
      ],
    });
    expect(novidadesDoPedido(cheio, TARDE).length).toBeGreaterThan(1);
    const escolhidas = novidadeAContar(cheio, TARDE, tudoLigado);
    expect(escolhidas).toHaveLength(1);
    // A fase mais adiantada ganha: o trabalho está feito, e é isso que
    // interessa agora — não o fecho de anteontem.
    expect(escolhidas[0].especie).toBe("trabalho_feito");
  });

  it("o alerta da equipa não compete com a mensagem do cliente", () => {
    const p = pedido({
      createdAt: new Date("2026-09-10T09:00:00Z"),
      negociacoes: [negociacao({ propostasJson: propostaDoPro(150) })],
    });
    // Com proposta não há alerta; sem proposta não há mensagem ao cliente.
    // Quando os dois existirem, saem os dois — são canais diferentes.
    const soAlerta = novidadeAContar(
      pedido({ createdAt: new Date("2026-09-10T09:00:00Z"), negociacoes: [negociacao()] }),
      TARDE,
      tudoLigado,
    );
    expect(soAlerta.map((x) => x.especie)).toEqual(["sem_propostas"]);
    expect(novidadeAContar(p, TARDE, tudoLigado).map((x) => x.especie)).toEqual(["proposta_nova"]);
  });

  it("história não é novidade: passados sete dias, cala-se", () => {
    const antiga: Novidade = {
      especie: "proposta_nova",
      chave: "x",
      capacidade: "avisar",
      pedidoId: 1,
      negociacaoId: 1,
      telefone: "912345678",
      nome: "João",
      texto: "",
      quando: new Date("2026-09-01T10:00:00Z"),
    };
    expect(aindaENovidade(antiga, TARDE)).toBe(false);
    expect(aindaENovidade({ ...antiga, quando: new Date("2026-09-16T10:00:00Z") }, TARDE)).toBe(
      true,
    );
    expect(DIAS_DE_NOVIDADE).toBe(7);
  });

  it("com a capacidade parada não sai nada, mesmo havendo novidade", () => {
    const p = pedido({ negociacoes: [negociacao({ propostasJson: propostaDoPro(150) })] });
    expect(novidadesDoPedido(p, TARDE).length).toBeGreaterThan(0);
    expect(novidadeAContar(p, TARDE, tudoParado)).toEqual([]);
  });

  it("cada capacidade trava só o que é dela", () => {
    const p = pedido({
      negociacoes: [
        negociacao({
          estado: "acordada",
          valorAcordado: "300.00",
          execucaoEnviadaEm: new Date("2026-09-17T11:00:00Z"),
        }),
      ],
    });
    // Só "avisar": o trabalho feito é de "acompanhar", por isso sobra o fecho.
    const soAvisar = novidadeAContar(p, TARDE, (c) => c === "avisar");
    expect(soAvisar.map((x) => x.especie)).toEqual(["fechado"]);
    // Só "acompanhar": sobra o trabalho feito.
    const soAcompanhar = novidadeAContar(p, TARDE, (c) => c === "acompanhar");
    expect(soAcompanhar.map((x) => x.especie)).toEqual(["trabalho_feito"]);
  });
});

describe("a mesma novidade nunca sai duas vezes", () => {
  it("a chave da proposta conta as propostas, e não olha ao relógio", () => {
    /*
     * A chave é construída em DOIS sítios: aqui, quando o cron descobre a
     * proposta sozinho, e em `propostaParaOWhatsApp`, quando ela é gravada e a
     * mensagem sai logo. Se as duas não derem a mesma string, o cliente ouve
     * tudo a dobrar.
     *
     * Contar as propostas e não usar a data é de propósito: uma DATETIME que o
     * MySQL devolva sem milissegundos dava duas chaves para a mesma proposta.
     */
    expect(chaveDaProposta(77, 1)).toBe("proposta:77:1");
    expect(chaveDaProposta(77, 2)).not.toBe(chaveDaProposta(77, 1));
    const n = novidadesDoPedido(
      pedido({ negociacoes: [negociacao({ propostasJson: propostaDoPro(150) })] }),
      TARDE,
    ).find((x) => x.especie === "proposta_nova")!;
    expect(n.chave).toBe(chaveDaProposta(77, 1));
  });

  it("os dois caminhos do envio imediato usam as funções das chaves", () => {
    expect(NEGOCIACAO).toContain("chaveDaProposta(dados.negociacaoId, quantas)");
    expect(NEGOCIACAO).toContain("chaveDaAceitacao(dados.negociacaoId, dados.valor)");
    expect(NEGOCIACAO).toContain("chaveDoFecho(alvo.negociacaoId)");
    // E nenhum deles escreve a chave à mão.
    expect(semNotas(NEGOCIACAO)).not.toContain('"proposta:"');
    expect(semNotas(NEGOCIACAO)).not.toContain("`proposta:${");
  });

  it("reserva-se ANTES de falar — a chave única é a única defesa", () => {
    /*
     * Dois crons sobrepostos é uma coisa que a Vercel permite. Falar primeiro
     * e registar depois deixava a janela em que os dois mandam a mesma
     * novidade ao mesmo cliente.
     */
    const i = CEREBRO.indexOf("for (const n of novidadeAContar(");
    const bloco = CEREBRO.slice(i, i + 2600);
    expect(bloco.indexOf("reservarAvisoDoAssistente")).toBeLessThan(
      bloco.indexOf("enviarTextoWhatsApp"),
    );
    expect(DB).toContain("UNIQUE KEY uq_chave (chave)");
  });

  it("se a mensagem não sair, a chave é libertada", () => {
    // A conversa pode estar entregue a uma pessoa, o número bloqueado, ou o
    // canal em baixo. Guardar a chave nesse caso fazia desta novidade uma que
    // NUNCA mais seria contada, e o cliente ficava sem saber da proposta dele.
    const i = CEREBRO.indexOf("const saiu = await enviarTextoWhatsApp(n.telefone, n.texto)");
    expect(CEREBRO.slice(i, i + 900)).toContain("libertarAvisoDoAssistente(id)");
  });

  it("uma avaria da base não cala uma proposta — repete-se antes de silenciar", () => {
    /*
     * `jaExistia` separa "já foi contado" (cala-te) de "a base não respondeu"
     * (fala à mesma). Com um null a dizer as duas coisas, uma avaria calava a
     * proposta de um cliente para sempre.
     */
    expect(DB).toContain("jaExistia: boolean");
    const i = NEGOCIACAO.indexOf("async function podeContarPelaPrimeiraVez(");
    const corpo = NEGOCIACAO.slice(i, NEGOCIACAO.indexOf("async function libertarSeNaoSaiu("));
    expect(corpo).toContain("if (jaExistia) return { podeFalar: false, id: null };");
    expect(corpo).toContain("return { podeFalar: true, id: null };");
  });

  it("o duplicado reconhece-se pelo CODIGO, e nao so pelo texto do MySQL", () => {
    // O texto muda com a versao e com o idioma do servidor. Num servidor que
    // responda noutra lingua, "Duplicate entry" nunca casa - e um aviso
    // repetido passava a ser lido como avaria, a cada passagem.
    const i = DB.indexOf("export async function reservarAvisoDoAssistente(");
    const corpo = DB.slice(i, i + 2400);
    expect(corpo).toContain('e?.code === "ER_DUP_ENTRY"');
    expect(corpo).toContain("e?.errno === 1062");
  });

  it("o envio imediato tambem liberta a chave quando a mensagem nao sai", () => {
    /*
     * A reserva e feita antes do envio - tem de ser, senao dois caminhos falam
     * ao mesmo tempo. Mas o envio pode nao acontecer: a conversa esta entregue
     * a uma pessoa, o numero esta bloqueado, o canal caiu. Deixar a reserva de
     * pe fazia desta proposta uma que nunca mais seria anunciada a ninguem - e
     * ainda por cima com lembretes sobre uma mensagem que o cliente nunca
     * recebeu.
     */
    expect(NEGOCIACAO).toContain("async function libertarSeNaoSaiu(");
    expect(NEGOCIACAO).toContain("return libertarSeNaoSaiu(primeira.id, saiu);");
    // Nos DOIS caminhos do envio imediato.
    const quantas = NEGOCIACAO.split("libertarSeNaoSaiu(primeira.id, saiu)").length - 1;
    expect(quantas).toBe(2);
  });
});

describe("insistir tem limite, e o limite é dito", () => {
  it("três toques no máximo, com a escada a crescer", () => {
    expect(TOQUES_NO_MAXIMO).toBe(3);
    expect(ESCADA_DOS_LEMBRETES.pro_aceitou).toEqual([24, 48, 72]);
    expect(horasAteAoToqueSeguinte("pro_aceitou", 0)).toBe(24);
    expect(horasAteAoToqueSeguinte("pro_aceitou", 3)).toBeNull();
    expect(esgotou("pro_aceitou", 3)).toBe(true);
    expect(esgotou("pro_aceitou", 2)).toBe(false);
  });

  it("os lembretes de uma proposta cabem DENTRO da vida dela", () => {
    /*
     * A escada da proposta tinha [24, 48, 72] e era uma ficcao. Uma proposta
     * MORRE as 48 horas, e a partir dai o assistente deixa de a ver como
     * novidade e fecha o aviso. O segundo toque so chegaria as 72 h - quando ja
     * nao havia proposta nenhuma sobre que insistir. Na pratica saia UM
     * lembrete, e os outros dois eram um numero escrito num ficheiro.
     */
    expect(ESCADA_DOS_LEMBRETES.proposta_nova).toEqual([12, 24]);
    const somaDosToques = ESCADA_DOS_LEMBRETES.proposta_nova.reduce((a, b) => a + b, 0);
    expect(somaDosToques).toBeLessThan(PRAZO_DA_PROPOSTA_HORAS);
  });

  it("o trabalho por confirmar pára aos dois: aos sete dias liberta-se sozinho", () => {
    // Insistir depois disso não muda nada — o caminho da libertação por prazo
    // já existe e corre todos os dias.
    expect(ESCADA_DOS_LEMBRETES.trabalho_feito).toEqual([24, 48]);
    expect(esgotou("trabalho_feito", 2)).toBe(true);
  });

  it("nunca de madrugada — um lembrete às 3 da manhã perde o cliente e o número", () => {
    expect(horaDeFalar(TARDE)).toBe(true);
    expect(horaDeFalar(MADRUGADA)).toBe(false);
    // 21:30 em Lisboa (Setembro é UTC+1): já é tarde de mais.
    expect(horaDeFalar(new Date("2026-09-17T20:30:00Z"))).toBe(false);
    // 09:30 em Lisboa: já se pode.
    expect(horaDeFalar(new Date("2026-09-17T08:30:00Z"))).toBe(true);
  });

  it("a hora é a de LISBOA, e não a do servidor", () => {
    /*
     * A Vercel corre em UTC. Em Setembro isso é uma hora de diferença — um
     * lembrete das 21h30 de Lisboa passava pelo guarda por o servidor achar
     * que eram 20h30.
     */
    expect(CEREBRO + ler("src/lib/assistente-interruptores.ts")).toContain(
      'timeZone: "Europe/Lisbon"',
    );
    expect(diaEmLisboa(new Date("2026-09-17T23:30:00Z"))).toBe("2026-09-18");
  });

  it("o relógio manda: sem as horas passadas, não toca", () => {
    const ha2horas = new Date(TARDE.getTime() - 2 * 3600_000);
    const ha30horas = new Date(TARDE.getTime() - 30 * 3600_000);
    expect(deveTocar("proposta_nova", 0, ha2horas, TARDE)).toBe(false);
    expect(deveTocar("proposta_nova", 0, ha30horas, TARDE)).toBe(true);
    // E de madrugada nunca, por muito atrasado que esteja.
    expect(deveTocar("proposta_nova", 0, ha30horas, MADRUGADA)).toBe(false);
  });

  it("uma avaria da base nunca volta a ligar um interruptor que o dono desligou", () => {
    /*
     * `interruptoresDoAssistente` devolvia os valores de FABRICA quando a
     * leitura falhava - e dois desses nascem ligados. O dono desligava o
     * "fechar" porque o assistente andava a fechar negocios errados, o MySQL
     * tinha um soluco, e o assistente voltava a fechar negocios errados sem
     * ninguem ter carregado em nada. Um travao que se solta sozinho quando
     * alguma coisa corre mal nao e um travao.
     */
    expect(DB).toContain("let ultimosInterruptores: Record<string, boolean> | null = null;");
    expect(DB).toContain("return ultimosInterruptores ?? interruptoresNaDuvida();");
    // E quem carrega no botao apaga a memoria, senao ela mentia a seguir.
    const i = DB.indexOf("export async function definirInterruptorDoAssistente(");
    expect(DB.slice(i, i + 1400)).toContain("ultimosInterruptores = null;");
  });

  it("«a tabela esta vazia» e «nao sei o que la esta» nao sao a mesma coisa", () => {
    /*
     * A memoria e por PROCESSO, e a Vercel tem varios. Um processo frio que
     * nunca conseguiu ler nao tem memoria nenhuma, e antes caia nos valores de
     * fabrica -- com o "fechar" LIGADO. Ou seja: o dono desligava o fecho
     * porque o assistente andava a ler mal as frases, um processo frio nao
     * conseguia ler o interruptor, e fechava um negocio de centenas de euros
     * por omissao.
     *
     * Na duvida sobre dinheiro, a conversa passa para uma pessoa. E uma
     * resposta pior, e nunca um erro caro.
     */
    const instalacao = interruptoresPorOmissao();
    const duvida = interruptoresNaDuvida();
    expect(instalacao.fechar).toBe(true);
    expect(duvida.fechar).toBe(false);
    // O que e so conversa continua: o silencio e o pior erro numa conversa.
    expect(duvida.recolher).toBe(true);
    expect(duvida.propostas).toBe(true);
    expect(FICHA_DA_CAPACIDADE.fechar.mexeEmDinheiro).toBe(true);
    // E as que nascem paradas continuam paradas na duvida.
    expect(duvida.avisar).toBe(false);
    expect(duvida.insistir).toBe(false);
  });

  it("uma espécie sem escada nunca leva lembrete nenhum", () => {
    /*
     * O agradecimento é uma NOTÍCIA, não uma pergunta. Sem esta separação
     * ficava para sempre na lista dos que não responderam, e três dias depois
     * a conversa era entregue a uma pessoa por o cliente não ter agradecido de
     * volta.
     */
    expect(esperaResposta("agradecimento")).toBe(false);
    expect(esperaResposta("fechado")).toBe(false);
    expect(esperaResposta("proposta_nova")).toBe(true);
    expect(deveTocar("agradecimento", 0, new Date("2026-01-01T10:00:00Z"), TARDE)).toBe(false);
    // E fecha-se no instante em que sai.
    expect(CEREBRO).toContain('if (!esperaResposta(n.especie)) await db.fecharAvisoDoAssistente(id, "informado");');
  });

  it("ao fim da escada, o assistente despede-se e passa a conversa", () => {
    const i = CEREBRO.indexOf("if (esgotou(especie, a.toques)) {");
    const bloco = CEREBRO.slice(i, i + 1400);
    expect(bloco).toContain('fecharAvisoDoAssistente(a.id, "esgotou")');
    expect(bloco).toContain("interromperNumeroWhatsApp");
    // Uma recolha a meio arruma-se: não chegou a haver pedido nem dinheiro,
    // e não há nada que uma pessoa possa fazer com ela.
    expect(bloco).toContain("arquivarConversaWhatsApp");
  });

  it("quem respondeu deixa de levar lembretes — e isso é o PRIMEIRO passo", () => {
    // Insistir com quem já respondeu é o erro que mais depressa custa o número.
    const i = CEREBRO.indexOf("resumo.correu = true;");
    const bloco = CEREBRO.slice(i, i + 900);
    expect(bloco).toContain("fecharAvisosComResposta()");
    expect(bloco.indexOf("fecharAvisosComResposta")).toBeLessThan(
      bloco.indexOf("pedidosParaOAssistente"),
    );
    expect(DB).toContain("m.direccao = 'in'");
    expect(DB).toContain("COALESCE(a.ultimoToqueEm, a.enviadoEm)");
  });

  it("um aviso cuja realidade mudou fecha-se em vez de gerar um lembrete", () => {
    /*
     * O cliente pode ter aceitado pelo site, ou o profissional ter desistido.
     * A mesma derivação que descobre novidades serve para descobrir o que já
     * não faz sentido — não há duas regras a discordar.
     */
    expect(CEREBRO).toContain("const vivas = new Map<string, Novidade>();");
    expect(CEREBRO).toContain('await db.fecharAvisoDoAssistente(a.id, "resolvido");');
  });

  it("mas um pedido que ficou FORA da janela não dá nada por resolvido", () => {
    /*
     * "A chave desapareceu do mapa" dizia duas coisas: o estado mudou, ou o
     * pedido nem foi olhado — por ser antigo, por ter sido cancelado, ou por a
     * passagem ter batido no tecto. Tratar as duas da mesma maneira desligava
     * os lembretes de um cliente que continuava à espera, sem nada o dizer.
     */
    expect(CEREBRO).toContain("const pedidosVistos = new Set<number>();");
    expect(CEREBRO).toContain("const visto = a.pedidoId != null && pedidosVistos.has(a.pedidoId);");
    expect(CEREBRO).toContain("if (!visto) continue;");
  });

  it("o tecto de cada passagem é dito em voz alta quando é atingido", () => {
    // Um limite silencioso lê-se como "estava tudo visto", e é assim que se
    // descobre tarde de mais que metade dos clientes nunca foi avisada.
    expect(CEREBRO).toContain("export const PEDIDOS_POR_PASSAGEM = 300;");
    expect(CEREBRO).toContain("if (pedidos.length >= PEDIDOS_POR_PASSAGEM) {");
    expect(CEREBRO).toContain("console.warn(");
  });

  it("os lembretes mudam de palavras, e o último despede-se", () => {
    const um = textoDoLembrete("proposta_nova", "João", 0, TARDE)!;
    const dois = textoDoLembrete("proposta_nova", "João", 1, TARDE)!;
    const tres = textoDoLembrete("proposta_nova", "João", 2, TARDE)!;
    expect(um).not.toBe(dois);
    expect(dois).not.toBe(tres);
    for (const t of [um, dois, tres]) expect(t).toContain("João");
    // O terceiro abre a porta de saída em vez de voltar a bater nela.
    expect(tres.toLowerCase()).toContain("fico por aqui");
    // Sem nome, não se inventa um.
    expect(textoDoLembrete("proposta_nova", "", 0, TARDE)).not.toContain("undefined");
  });
});

describe("os seis interruptores", () => {
  it("existem os sete, e cada um diz o que pára", () => {
    expect(CAPACIDADES).toEqual([
      "recolher",
      "propostas",
      "avisar",
      "fechar",
      "insistir",
      "acompanhar",
      "agradecer",
    ]);
    for (const c of CAPACIDADES) {
      expect(FICHA_DA_CAPACIDADE[c].titulo).toBeTruthy();
      expect(FICHA_DA_CAPACIDADE[c].oQuePara.length).toBeGreaterThan(20);
    }
    expect(eCapacidade("avisar")).toBe(true);
    expect(eCapacidade("apagar_tudo")).toBe(false);
    // `__semeado` é a marca da instalação, e não uma capacidade: ninguém a
    // pode ligar pelo painel nem ela aparece na lista.
    expect(eCapacidade("__semeado")).toBe(false);
  });

  it("o que JÁ funcionava nasce ligado; o que é novo nasce parado", () => {
    /*
     * O plano dizia "todos começam desligados". Três destas capacidades já
     * correm hoje — a recolha pela conversa, o aviso de uma proposta nova, e o
     * fecho por WhatsApp. Pô-las a nascer desligadas não era prudência: era
     * desligar em silêncio três coisas a funcionar, e descobri-lo pelo primeiro
     * cliente que ficasse sem resposta.
     */
    const p = interruptoresPorOmissao();
    expect(p.recolher).toBe(true);
    expect(p.propostas).toBe(true);
    expect(p.fechar).toBe(true);
    expect(p.avisar).toBe(false);
    expect(p.insistir).toBe(false);
    expect(p.acompanhar).toBe(false);
    expect(p.agradecer).toBe(false);
  });

  it("o interruptor das propostas trava mesmo as DUAS mensagens que promete travar", () => {
    /*
     * A ficha do "avisar" dizia que travava as propostas e não travava
     * nenhuma: o caminho imediato sai de `propostaParaOWhatsApp` no instante
     * em que a proposta é gravada, e nunca perguntava nada a ninguém. Um botão
     * que diz que pára uma coisa e não a pára é pior do que não existir.
     *
     * E as duas mensagens — a imediata e a que a passagem apanha quando a
     * imediata falha — obedecem ao MESMO botão. Debaixo de botões diferentes,
     * desligar um deixava a outra a falar dez minutos depois.
     */
    const i = NEGOCIACAO.indexOf("async function podeContarPelaPrimeiraVez(");
    const corpo = NEGOCIACAO.slice(i, NEGOCIACAO.indexOf("async function libertarSeNaoSaiu("));
    expect(corpo).toContain('if (!(await assistentePode("propostas"))) return { podeFalar: false, id: null };');
    const p = novidadesDoPedido(
      pedido({ negociacoes: [negociacao({ propostasJson: propostaDoPro(150) })] }),
      TARDE,
    ).find((x) => x.especie === "proposta_nova")!;
    expect(p.capacidade).toBe("propostas");
    const a = novidadesDoPedido(
      pedido({
        negociacoes: [negociacao({ estado: "aguarda_contratacao", valorAcordado: "200.00" })],
      }),
      TARDE,
    ).find((x) => x.especie === "pro_aceitou")!;
    expect(a.capacidade).toBe("propostas");
  });

  it("com o botão em baixo não se reserva chave nenhuma", () => {
    // Guardar a marca de uma conversa que não houve fechava a porta a contá-la
    // mais tarde, quando o botão voltasse a subir.
    const i = NEGOCIACAO.indexOf("async function podeContarPelaPrimeiraVez(");
    const corpo = NEGOCIACAO.slice(i, NEGOCIACAO.indexOf("async function libertarSeNaoSaiu("));
    expect(corpo.indexOf('assistentePode("propostas")')).toBeLessThan(
      corpo.indexOf("reservarAvisoDoAssistente({"),
    );
  });

  it("na primeira passagem NÃO sai mensagem nenhuma — semeia-se e cala-se", () => {
    /*
     * No instante em que as capacidades novas se ligam há meses de pedidos na
     * base, e todos eles são — à letra da derivação — novidades por contar.
     * A estreia seria uma rajada sobre coisas que os clientes já sabem há
     * semanas, e o botão vermelho era carregado antes do almoço.
     */
    expect(DB).toContain("export async function semearOAssistente(");
    expect(DB).toContain("INSERT IGNORE INTO assistenteInterruptores");
    // A marca tem chave primária: duas passagens sobrepostas não semeiam as duas.
    expect(DB).toContain("return Number(r.affectedRows ?? 0) === 1;");
    const i = CEREBRO.indexOf("if (await db.semearOAssistente()");
    expect(i).toBeGreaterThan(-1);
    const bloco = CEREBRO.slice(i, i + 1200);
    expect(bloco).toContain('fecharAvisoDoAssistente(id, "antes_do_assistente")');
    expect(bloco).toContain("return resumo;");
    expect(bloco).not.toContain("enviarTextoWhatsApp");
    // E vem ANTES de se contar seja o que for.
    expect(i).toBeLessThan(CEREBRO.indexOf("// ── 1. Contar as novidades"));
  });

  it("o interruptor geral manda sobre todos — senão o botão vermelho mente", () => {
    const i = DB.indexOf("export async function assistentePode(");
    const corpo = DB.slice(i, i + 400);
    expect(corpo).toContain("if (!(await whatsappLigado())) return false;");
    // E a passagem inteira pára à porta.
    expect(CEREBRO).toContain("if (!(await db.whatsappLigado())) {");
  });

  it("o fecho de um negócio passa pelo interruptor, e não cala o cliente", () => {
    /*
     * Um travão que engole a intenção do cliente é pior do que não existir:
     * ele disse que sim e ninguém lhe respondeu. Com "fechar" em baixo, a
     * conversa passa para uma pessoa E ele fica a saber.
     */
    const i = NEGOCIACAO.indexOf("async function fecharPeloCliente(");
    const corpo = NEGOCIACAO.slice(i, i + 900);
    expect(corpo).toContain('if (!(await assistentePode("fechar")))');
    expect(corpo).toContain("passarAUmaPessoa(telefone");
    expect(NEGOCIACAO.indexOf('async function recusarPeloCliente(')).toBeGreaterThan(-1);
    const rec = NEGOCIACAO.slice(
      NEGOCIACAO.indexOf("async function recusarPeloCliente("),
      NEGOCIACAO.indexOf("async function recusarPeloCliente(") + 400,
    );
    expect(rec).toContain('assistentePode("fechar")');
  });

  it("ao passar a conversa, fala-se ANTES de fechar o portão", () => {
    // `enviarTextoWhatsApp` pergunta ao portão, e o portão fecha-se com a
    // entrega. Pela ordem errada, a mensagem é engolida sem erro nenhum.
    const i = NEGOCIACAO.indexOf("async function passarAUmaPessoa(");
    const bloco = NEGOCIACAO.slice(i, i + 700);
    expect(bloco.indexOf("enviarTextoWhatsApp")).toBeLessThan(
      bloco.indexOf("interromperNumeroWhatsApp("),
    );
  });

  it("com a recolha parada, o assistente não inventa uma resposta a dizer que não responde", () => {
    const i = NEGOCIACAO.indexOf('if (!(await assistentePode("recolher"))) return;');
    expect(i).toBeGreaterThan(-1);
    // A mensagem dele já ficou registada pelo webhook antes de aqui chegar,
    // por isso aparece na mesa do painel como qualquer outra conversa.
    expect(NEGOCIACAO.slice(i, i + 200)).toContain("recolherPedidoPorWhatsApp");
  });
});

describe("fica escrito que foi o assistente", () => {
  it("o fecho e a recusa dizem quem os fez, e com que acontecimento", () => {
    /*
     * Quando ele fecha, está a executar a decisão do cliente — mas quem
     * interpretou a frase foi um modelo de linguagem. No dia de um desacordo,
     * a diferença entre "carregou no botão" e "escreveu uma frase que o
     * assistente leu como sim" é a história toda.
     */
    expect(NEGOCIACAO).toContain('"negociacao_fechada",\n    "assistente",');
    expect(NEGOCIACAO).toContain('"negociacao_desistida",\n    "assistente",');
    expect(DB).toContain('| "assistente" | null;');
  });

  it("o vocabulário do registo ganhou o alerta à equipa, e nada mais", () => {
    expect(DB).toContain('| "assistente_alerta"');
    expect(CEREBRO).toContain('acontecimento: "assistente_alerta"');
  });

  it("há como desfazer um fecho, durante 24 horas", () => {
    expect(DB).toContain("export const HORAS_PARA_DESFAZER = 24;");
    expect(DB).toContain("export async function desfazerFechoDoAssistente(");
    const i = DB.indexOf("export async function desfazerFechoDoAssistente(");
    const corpo = DB.slice(i, i + 4200);
    expect(corpo).toContain("if (!alvo.aTempo)");
    expect(corpo).toContain("interromperNumeroWhatsApp");
    // E o retrato é tirado ANTES de se mexer em nada.
    const f = NEGOCIACAO.indexOf("async function fecharPeloCliente(");
    const fecho = NEGOCIACAO.slice(f, f + 3200);
    expect(fecho.indexOf("const outras = ")).toBeLessThan(
      fecho.indexOf("encerrarOutrasNegociacoes("),
    );
  });

  it("mas NAO se desfaz um trabalho que ja andou", () => {
    /*
     * Com a prova enviada, a confirmacao dada ou o dinheiro levantado,
     * desfazer nao e uma correccao: e apagar trabalho feito. A negociacao
     * voltaria a "aberta" com o valor acordado a NULL, e o profissional via a
     * carteira dele encolher por causa de um botao do backoffice.
     */
    const i = DB.indexOf("export async function desfazerFechoDoAssistente(");
    const corpo = DB.slice(i, i + 4200);
    expect(corpo).toContain("n.execucaoEnviadaEm != null || n.confirmadoEm != null || n.pagoEm != null");
    expect(corpo).toContain('if (n.estado !== "acordada")');
    // E o guarda vem ANTES de qualquer escrita.
    expect(corpo.indexOf("execucaoEnviadaEm != null")).toBeLessThan(
      corpo.indexOf("beginTransaction()"),
    );
  });

  it("desfazer e tudo-ou-nada, e repoe cada negociacao no estado que tinha", () => {
    // Sao quatro escritas. Um desfazer que corra metade deixava uma negociacao
    // aberta com as irmas mortas, e ninguem saberia qual das metades passou.
    const i = DB.indexOf("export async function desfazerFechoDoAssistente(");
    const corpo = DB.slice(i, i + 4200);
    expect(corpo).toContain("await conn.beginTransaction();");
    expect(corpo).toContain("await conn.commit();");
    expect(corpo).toContain("await conn.rollback()");
    expect(corpo).toContain("conn.release();");
    // Cada irma volta ao estado DELA, e nao todas a "aberta".
    expect(corpo).toContain('[e.estado || "aberta", id]');
    expect(DB).toContain("export type NegociacaoEncerrada = { id: number; estado: string };");
    expect(NEGOCIACAO).toContain('.map((n) => ({ id: Number(n.id), estado: String(n.estado) }));');
  });

  it("a janela das 24 horas e medida por UM relogio, o da base", () => {
    /*
     * `enviadoEm` e escrito pelo CURRENT_TIMESTAMP do MySQL. Compara-lo com o
     * Date.now() do Node e misturar dois relogios que podem estar em fusos
     * diferentes, e uma hora de diferenca transforma a janela em 23 ou em 25 -
     * e a de 25 e a que deixa desfazer o que ja nao devia.
     */
    const i = DB.indexOf("export async function fechosDesfaziveis(");
    const corpo = DB.slice(i, i + 2600);
    expect(corpo).toContain("HOUR) AS aTempo");
    expect(corpo).toContain("aTempo: Number(r.aTempo) === 1,");
    expect(corpo).not.toContain("Date.now()");
  });
});

describe("o cron, e o botão de correr agora", () => {
  it("falha fechada sem CRON_SECRET — é um endereço que manda mensagens a clientes", () => {
    expect(CRON).toContain("process.env.CRON_SECRET");
    expect(CRON).toContain("status: 503");
    expect(CRON).toContain("status: 401");
    expect(CRON).toContain("if (!secret)");
  });

  it("está declarado no vercel.json, senão nunca corre e nada avisa", () => {
    const vercel = JSON.parse(ler("vercel.json")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const meu = vercel.crons.find((c) => c.path === "/api/cron/assistente");
    expect(meu).toBeTruthy();
    // De dez em dez minutos: as novidades que ele conta são sobre dinheiro à
    // espera de resposta, e uma proposta que fica um dia por anunciar é uma
    // proposta perdida para quem respondeu primeiro.
    expect(meu!.schedule).toBe("*/10 * * * *");
  });

  it("o .env.example não esconde o que o desliga", () => {
    const env = ler(".env.example");
    expect(env).toMatch(/^CRON_SECRET=/m);
    expect(env).toContain("/api/cron/assistente");
  });

  it("não escreve uma linha por passagem vazia no registo permanente", () => {
    // Cento e quarenta e quatro linhas por dia a dizer "zero" enterravam as
    // poucas que interessam — e este registo é permanente.
    expect(CRON).toContain("if (mexeu > 0) {");
  });

  it("o botão «correr agora» é a MESMA passagem, com as mesmas guardas", () => {
    expect(ROTA).toContain('accao === "correrAgora"');
    expect(ROTA).toContain("correrOAssistente()");
    expect(PAINEL).toContain('accao: "correrAgora"');
  });

  it("ler é de quem tem a secção; MEXER é só do administrador", () => {
    // Um interruptor que muda o que a plataforma diz a clientes reais, e um
    // "não era isto" que desfaz um negócio, são decisões do dono.
    expect(ROTA).toContain("requireAdmin(req)");
    expect(ROTA).toContain("requireAdminGeral(req)");
    expect(ROTA).toContain('podeMexer: colab.papel === "admin"');
    expect(PAINEL).toContain("!estado.podeMexer");
  });

  it("o ecrã do assistente não pesa na mesa do WhatsApp", () => {
    /*
     * A rota do painel já faz sete consultas em paralelo e é refrescada de
     * trinta em trinta segundos por cada separador aberto. Este separador
     * quase nunca está aberto — e só pede os dados quando alguém o abre.
     */
    expect(PAINEL).toContain("if (!ready || !aberto) return;");
    const MESA = ler("src/app/api/admin/whatsapp/route.ts");
    expect(MESA).not.toContain("avisosDoAssistente");
    expect(ler("src/components/admin/AdminWhatsAppPanel.tsx")).toContain(
      "<AdminAssistenteAutoPanel />",
    );
  });

  it("uma passagem não rebenta a meio por causa de uma mensagem", () => {
    // Um cron que rebenta deixa metade dos clientes avisados e metade não, e
    // na passagem seguinte não há como saber onde ficou.
    const i = CEREBRO.indexOf("export async function correrOAssistente(");
    const corpo = CEREBRO.slice(i);
    expect(corpo).toContain(".catch(() => false)");
    expect(corpo).toContain(".catch(() => [])");
  });
});

describe("fala como gente", () => {
  const todasAsMensagens = () => {
    const cenarios: PedidoParaOAssistente[] = [
      pedido({ negociacoes: [negociacao({ propostasJson: propostaDoPro(150) })] }),
      pedido({
        negociacoes: [negociacao({ estado: "aguarda_contratacao", valorAcordado: "200.00" })],
      }),
      pedido({
        negociacoes: [
          negociacao({
            estado: "acordada",
            valorAcordado: "300.00",
            dataCombinada: new Date("2026-09-18T09:00:00Z"),
          }),
        ],
      }),
      pedido({
        negociacoes: [
          negociacao({
            estado: "acordada",
            valorAcordado: "300.00",
            execucaoEnviadaEm: new Date("2026-09-16T11:00:00Z"),
            confirmadoEm: new Date("2026-09-15T11:00:00Z"),
          }),
        ],
      }),
    ];
    return cenarios
      .flatMap((p) => novidadesDoPedido(p, TARDE))
      .filter((n) => !eParaAEquipa(n.especie))
      .map((n) => n.texto);
  };

  it("nenhuma mensagem ensina o cliente a responder SIM ou NÃO", () => {
    /*
     * "Não deve usar sim ou não nem caracteres especiais, apenas frases e
     * textos — o Gemini deve entender o contexto." — 12-09-2026. Ensinar o
     * cliente a falar por palavras-chave é a conversa de máquina que se quer
     * acabar.
     */
    for (const t of todasAsMensagens()) {
      expect(t).not.toContain("responda SIM");
      expect(t).not.toContain("responda NÃO");
      expect(t).not.toMatch(/\bSIM\b/);
      expect(t).not.toMatch(/\bNÃO\b/);
    }
  });

  it("nem usa a tipografia de livro que denuncia a máquina", () => {
    // As aspas angulares, os travessões longos e os pontos médios ninguém os
    // escreve num telemóvel. `paraTeclado` limpa-os à saída, mas não se
    // escrevem de propósito para que a limpeza seja rede e não muleta.
    for (const t of todasAsMensagens()) {
      expect(t).not.toMatch(/[«»·…]/);
    }
  });

  it("começa por uma saudação a sério, conforme a hora", () => {
    const tarde = novidadesDoPedido(
      pedido({ negociacoes: [negociacao({ propostasJson: propostaDoPro(150) })] }),
      TARDE,
    )[0];
    expect(tarde.texto.startsWith("Boa tarde, João.")).toBe(true);
    const manha = novidadesDoPedido(
      pedido({
        createdAt: new Date("2026-09-17T06:00:00Z"),
        negociacoes: [negociacao({ propostasJson: propostaDoPro(150, "2026-09-17T07:00:00Z") })],
      }),
      new Date("2026-09-17T08:30:00Z"),
    )[0];
    expect(manha.texto.startsWith("Bom dia, João.")).toBe(true);
  });

  it("nunca trata por «senhor» — ninguém guardou o género de ninguém", () => {
    /*
     * O exemplo que o dono deu dizia "senhor João". A base guarda o nome e não
     * guarda o género: "Sr." num nome que seja de uma senhora é uma falta de
     * educação que uma máquina não tem desculpa para cometer, e acontece à
     * primeira Maria.
     */
    expect(comoTratar("Maria Silva", TARDE)).toBe("Boa tarde, Maria.");
    expect(comoTratar("João Ribeiro", TARDE)).toBe("Boa tarde, João.");
    for (const t of todasAsMensagens()) {
      expect(t).not.toContain("Sr.");
      expect(t).not.toContain("Sra.");
      expect(t).not.toMatch(/\bsenhor\b/i);
    }
  });

  it("sem nome, cumprimenta na mesma e não deixa um buraco", () => {
    expect(comoTratar(null, TARDE)).toBe("Boa tarde.");
    expect(comoTratar("  ", TARDE)).toBe("Boa tarde.");
  });

  it("o agradecimento não pede nada — a avaliação vem à parte", () => {
    /*
     * Juntar "e avalie-nos" ao obrigado transforma um gesto numa cobrança. É a
     * diferença entre uma empresa que agradece e uma que cobra um favor por
     * ter feito o trabalho que lhe pagaram.
     */
    const n = novidadesDoPedido(
      pedido({
        negociacoes: [
          negociacao({
            estado: "acordada",
            valorAcordado: "300.00",
            execucaoEnviadaEm: new Date("2026-09-14T11:00:00Z"),
            confirmadoEm: new Date("2026-09-15T11:00:00Z"),
          }),
        ],
      }),
      TARDE,
    );
    const obrigado = n.find((x) => x.especie === "agradecimento")!;
    const avaliacao = n.find((x) => x.especie === "avaliacao")!;
    expect(obrigado.texto.toLowerCase()).not.toContain("avali");
    expect(obrigado.texto.toLowerCase()).not.toContain("estrela");
    expect(avaliacao.texto).toBeTruthy();
    expect(obrigado.chave).not.toBe(avaliacao.chave);
  });

  it("nenhum valor sai sem vir das contas da casa", () => {
    // Um preço inventado é uma promessa que o profissional não cumpre. Todos
    // os números destas mensagens vêm de `contaDoCliente` ou da proposta real.
    expect(CEREBRO).toContain('from "./taxas-plataforma"');
    expect(CEREBRO).toContain("contaDoCliente(valor, regimeDeIva(regimeIva)).total");
  });

  it("as chaves são estáveis e distintas entre espécies", () => {
    expect(chaveDoFecho(9)).toBe("fechado:9");
    expect(chaveDaAceitacao(9, 100)).not.toBe(chaveDoFecho(9));
    expect(chaveDaProposta(9, 1)).not.toBe(chaveDoFecho(9));
  });
});

describe("o que o assistente fez fica à vista", () => {
  it("o painel mostra a frase que saiu, e não só a espécie", () => {
    // Sem isto, "parar caso esteja a cometer erros" obriga alguém a ler
    // conversas uma a uma até encontrar o erro.
    expect(PAINEL).toContain("ESPECIE_EM_PALAVRAS");
    expect(PAINEL).toContain("{a.texto}");
    expect(DB).toContain("export async function guardarTextoDoAviso(");
    expect(DB).toContain("export async function avisosDoAssistente(");
  });

  it("os identificadores da base não vão para o ecrã", () => {
    const i = PAINEL.indexOf("const ESPECIE_EM_PALAVRAS");
    const mapa = PAINEL.slice(i, PAINEL.indexOf("};", i));
    for (const especie of ["proposta_nova", "trabalho_feito", "sem_propostas"]) {
      expect(mapa).toContain(`${especie}:`);
    }
    expect(PAINEL).toContain("PORQUE_FECHOU");
  });

  it("desfazer avisa do que leva com ele antes de levar", () => {
    expect(PAINEL).toContain("window.confirm(");
    expect(PAINEL).toContain("Não era isto");
  });

  it("a tabela dos avisos não cresce para sempre", () => {
    expect(DB).toContain("export async function limparAvisosVelhos(");
    expect(DB).toContain("INTERVAL 60 DAY");
    expect(CEREBRO).toContain("limparAvisosVelhos()");
  });
});
