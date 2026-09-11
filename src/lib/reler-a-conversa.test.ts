import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MARCA_DE_PEDIDO_REGISTADO,
  fioParaLeitura,
  guiaoDoFio,
  quandoOClienteFalouPelaUltimaVez,
  camposRecuperados,
  releituraDoFio,
} from "./reler-a-conversa";
import { fundirCampos, mensagemDePedidoRegistado, responderComCompreensao } from "./whatsapp-recolha";

/**
 * RELER A CONVERSA — continuar de onde parámos.
 *
 * "Quando clico em Recomeçar conversa ele devia ler as mensagens anteriores
 * para recomeçar de onde parámos." — 10-09-2026.
 *
 * O «Recomeçar do zero» apaga a recolha e pergunta o serviço a quem já o
 * disse. Isto lê o fio guardado, reconstrói o que ele respondeu, e pergunta só
 * o que falta.
 *
 * Três coisas podem correr mal aqui, e nenhuma é óbvia:
 *   1. o tempo — uma data velha lida contra hoje marca o dia errado;
 *   2. onde começa a conversa — o fio de um número é uma corda contínua;
 *   3. a intenção — um «sim» de há três dias não pode registar um pedido.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const RECOLHA = ler("src/lib/whatsapp-recolha.ts");
const COMPREENSAO = ler("src/lib/whatsapp-compreensao.ts");
const ROTA = ler("src/app/api/admin/whatsapp/route.ts");
const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");

const HOJE = new Date("2026-09-10T12:00:00.000Z");
const em = (dias: number, hora = 10) =>
  new Date(HOJE.getTime() - dias * 86_400_000).toISOString().replace(/T.*/, `T${String(hora).padStart(2, "0")}:00:00.000Z`);

const dele = (texto: string, criadoEm: string) => ({ direccao: "in", texto, criadoEm });
const nosso = (texto: string, criadoEm: string) => ({ direccao: "out", texto, criadoEm });

describe("os validadores são os MESMOS — não uma cópia", () => {
  it("responderComCompreensao passou a chamar fundirCampos", () => {
    /*
     * O TESTE QUE GUARDA A EXTRACÇÃO. Se alguém voltar a escrever o bloco à
     * mão dentro de responderComCompreensao, a releitura e a conversa viva
     * passam a ter dois conjuntos de validadores — e o dia em que um deles
     * for corrigido, o outro continua a aceitar o que o primeiro recusa.
     */
    expect(RECOLHA).toContain("export function fundirCampos(");
    /*
     * Sem o nome da variável dos campos: ela passou a ser `kk` quando a
     * leitura directa das perguntas fechadas entrou (o `simOuNao` que lê um
     * «Não» quando o modelo não percebe). O que este teste guarda é que a
     * fusão sai daqui e não de um bloco escrito à mão — não como se chama o
     * argumento do meio.
     */
    expect(RECOLHA).toMatch(/const d = fundirCampos\(estado\.dados, \w+, agora\);/);
  });

  it("os dois caminhos dão exactamente o mesmo resultado", () => {
    const campos = {
      servico: "recolha_moveis",
      nome: "Ana",
      morada: "Rua Sousa Viterbo 29",
      codigoPostal: "2845-513 Amora",
      andar: "3º",
      elevador: "não",
    };
    const pelaFusao = fundirCampos({}, campos, HOJE);
    const pelaConversa = responderComCompreensao(
      { passo: "servico", dados: {} },
      { intencao: "informar", campos },
      HOJE,
    );
    expect(pelaFusao).toEqual(pelaConversa.estado.dados);
  });

  it("fundir nunca empobrece — parte do que já lá estava", () => {
    // Um fio truncado ou uma falha do modelo não podem apagar dez campos e
    // escrever quatro.
    const antes = { serviceType: "mudanca", contactName: "Rui", address: "Rua X" };
    const depois = fundirCampos(antes, { nome: "Rui Silva" }, HOJE);
    expect(depois.serviceType).toBe("mudanca");
    expect(depois.address).toBe("Rua X");
    expect(depois.contactName).toBe("Rui Silva");
  });
});

describe("onde começa a conversa que interessa", () => {
  it("corta no último «Pedido #N registado.» — o que veio antes já foi", () => {
    /*
     * `whatsappMensagens` e uma corda contínua por número: nada separa o
     * pedido de Março do de Setembro. Sem este corte, a releitura ressuscita
     * a morada de um pedido fechado.
     */
    const fio = fioParaLeitura(
      [
        dele("quero tirar um sofá da Rua Velha 1", em(20)),
        nosso(mensagemDePedidoRegistado(200, false), em(19)),
        dele("agora é uma máquina de lavar, na Rua Nova 2", em(2)),
      ],
      HOJE,
    );
    expect(fio).toHaveLength(1);
    expect(fio[0].texto).toContain("Rua Nova 2");
  });

  it("a marca casa com a frase a sério — e não com uma parecida", () => {
    // Pinado contra a própria função, para o dia em que alguém a reescrever.
    expect(MARCA_DE_PEDIDO_REGISTADO.test(mensagemDePedidoRegistado(1, false))).toBe(true);
    expect(MARCA_DE_PEDIDO_REGISTADO.test("Pedido registado sem número")).toBe(false);
    expect(MARCA_DE_PEDIDO_REGISTADO.test("O seu Pedido #3 registado.")).toBe(false);
  });

  it("deita fora o que tem mais de 30 dias", () => {
    const fio = fioParaLeitura([dele("isto é de Julho", em(45)), dele("isto é de agora", em(1))], HOJE);
    expect(fio).toHaveLength(1);
    expect(fio[0].texto).toBe("isto é de agora");
  });

  it("sem marca e tudo recente, lê o fio inteiro", () => {
    const fio = fioParaLeitura([dele("a", em(3)), nosso("b", em(3)), dele("c", em(2))], HOJE);
    expect(fio).toHaveLength(3);
  });
});

describe("o guião que vai ao modelo", () => {
  it("leva as DUAS vozes e a data de cada linha", () => {
    /*
     * As perguntas do assistente são o que dá sentido às respostas curtas: um
     * «sim» sozinho não quer dizer nada; ao lado de «Há elevador no prédio?»
     * quer dizer tudo. E a data deixa ver que o «amanhã» é da semana passada.
     */
    const g = guiaoDoFio([nosso("Há elevador no prédio?", em(2)), dele("sim", em(2))]);
    expect(g).toContain("CLYON: Há elevador no prédio?");
    expect(g).toContain("CLIENTE: sim");
    expect(g).toMatch(/^\[\d{2}\/\d{2}\]/);
  });

  it("sabe quando o cliente falou pela última vez — e ignora o que nós dissemos", () => {
    const fio = [dele("olá", em(5)), nosso("bom dia", em(1))];
    const q = quandoOClienteFalouPelaUltimaVez(fio);
    expect(q?.toISOString()).toBe(em(5));
  });
});

describe("o quando envelhece — o guarda é em código, não no aviso ao modelo", () => {
  it("passadas 48 horas, um «amanhã» não se aproveita", () => {
    /*
     * `interpretarQuando` lê tudo como se tivesse sido escrito agora. Um
     * «amanhã» de há uma semana marcava trabalho para o dia errado, e ninguém
     * dava por isso — a data sai bem formada e com ar de certa.
     */
    const fio = [dele("pode ser amanhã de manhã", em(7))];
    const r = releituraDoFio({
      gravado: {},
      campos: { servico: "recolha_moveis", quando: "amanhã de manhã" },
      fio,
      agora: HOJE,
    });
    expect(r.dados.quandoTexto ?? null).toBeNull();
    expect(r.dados.dataDesejada ?? null).toBeNull();
    expect(r.dados.serviceType).toBe("recolha_moveis");
  });

  it("dentro das 48 horas aproveita-se, e conta-se a partir da frase", () => {
    const fio = [dele("sexta de manhã", em(1))];
    const r = releituraDoFio({
      gravado: {},
      campos: { quando: "sexta de manhã" },
      fio,
      agora: HOJE,
    });
    expect(r.dados.quandoTexto).toBe("sexta de manhã");
  });

  it("uma data que já passou é deitada fora, e o passo volta a faltar", () => {
    // Ele disse «segunda» na segunda passada: perguntar outra vez é a resposta
    // certa, e marcar a segunda que vem sem ele saber é a errada.
    const fio = [dele("segunda", em(1))];
    const r = releituraDoFio({
      gravado: { dataDesejada: em(30), quandoTexto: "há um mês", urgency: "flexible" },
      campos: {},
      fio,
      agora: HOJE,
    });
    expect(r.dados.dataDesejada).toBeNull();
    expect(r.dados.quandoTexto).toBeNull();
  });
});

describe("a frase da retoma", () => {
  it("diz o que já se sabe, e não volta a cumprimentar", () => {
    /*
     * Uma segunda saudação a meio da conversa é o defeito que o ramo do
     * «recomeçar» já existia para evitar.
     */
    const r = releituraDoFio({
      gravado: {},
      campos: { servico: "recolha_moveis", morada: "Rua Nova 2" },
      fio: [dele("recolha de móveis na Rua Nova 2", em(1))],
      agora: HOJE,
    });
    expect(r.mensagem).toContain("Já reli a nossa conversa");
    expect(r.mensagem).toContain("Não precisa de repetir nada");
    expect(r.mensagem).not.toContain("Bom dia");
    expect(r.mensagem).not.toContain("Aqui é a CLYON");
  });

  it("com tudo respondido, o que vai é o resumo", () => {
    const r = releituraDoFio({
      gravado: {
        serviceType: "recolha_moveis",
        contactName: "Ana",
        address: "Rua Nova 2",
        postalCode: "2845-513",
        city: "Amora",
        floor: "3",
        hasElevator: "no",
        parkingDistance: "near",
        quandoTexto: "sexta",
        description: "um sofá",
        precisaFatura: false,
      },
      campos: {},
      fio: [dele("sim", em(1))],
      agora: HOJE,
    });
    expect(r.completo).toBe(true);
    expect(r.mensagem).toContain("Confirme, por favor");
  });

  it("diz que campos recuperou, para o relatório do painel", () => {
    expect(camposRecuperados({ serviceType: "mudanca" }, { serviceType: "mudanca", contactName: "Ana" })).toEqual(["contactName"]);
    expect(camposRecuperados({ contactName: "Ana" }, { contactName: "Ana" })).toEqual([]);
  });
});

describe("a intenção não viaja do fio para os dados", () => {
  it("compreenderFio devolve SÓ campos", () => {
    /*
     * Um «sim» de há três dias não pode registar um pedido, um «quero falar
     * com uma pessoa» de há uma semana não pode entregar a conversa outra vez,
     * e um «recomeçar» dito a meio não pode apagar o que ele disse a seguir.
     */
    expect(COMPREENSAO).toContain("export async function compreenderFio(");
    expect(COMPREENSAO).toContain("Promise<CamposCrus | null>");
    expect(COMPREENSAO).toContain("NÃO devolvas intenção nenhuma");
    const corpo = COMPREENSAO.slice(COMPREENSAO.indexOf("export async function compreenderFio("));
    expect(corpo).toContain("return bom.campos;");
    expect(corpo).not.toContain("intencao");
  });

  it("mantém a escada de tempos que já existia — 18 s e 10 s", () => {
    // Um fio é maior do que uma mensagem, mas quem espera é a mesma pessoa.
    const corpo = COMPREENSAO.slice(COMPREENSAO.indexOf("export async function compreenderFio("));
    expect(corpo).toContain("18");
    expect(corpo).toContain("10");
  });
});

describe("as guardas da rota", () => {
  it("recusa reler uma recolha que já deu pedido", () => {
    /*
     * `guardarRecolhaWhatsApp` faz `ON DUPLICATE KEY UPDATE ... pedidoId =
     * NULL`: escrever por cima ressuscitava uma recolha fechada, e a mensagem
     * seguinte do cliente voltava a cair na recolha em vez das propostas.
     */
    const bloco = ROTA.slice(ROTA.indexOf('accao === "relerConversa"'));
    expect(bloco).toContain("guardada?.pedidoId != null");
    expect(bloco).toContain("já deu o pedido #");
  });

  it("recusa quando o número já tem pedido a andar", () => {
    const bloco = ROTA.slice(ROTA.indexOf('accao === "relerConversa"'));
    expect(bloco).toContain("pedidosDoTelefone(telefone)");
    expect(bloco).toContain("activos.length > 0");
  });

  it("sem confirmar, NÃO escreve nada", () => {
    const bloco = ROTA.slice(ROTA.indexOf('accao === "relerConversa"'));
    const previsao = bloco.indexOf("corpo.confirmar !== true");
    expect(previsao).toBeGreaterThan(-1);
    // A gravação vem toda DEPOIS da saída da pré-visualização.
    expect(previsao).toBeLessThan(bloco.indexOf("guardarRecolhaWhatsApp(telefone"));
  });

  it("limpa da fila o que era do passo antigo", () => {
    // Senão sai uma pergunta velha dois minutos depois da retoma.
    const bloco = ROTA.slice(ROTA.indexOf('accao === "relerConversa"'));
    expect(bloco).toContain("limparFilaWhatsAppDoNumero(telefone)");
  });

  it("diz a verdade sobre o envio, e não um verde mentiroso", () => {
    // Pela ponte, `enviarTextoWhatsApp` devolve true só por ter posto na fila;
    // e com a conversa entregue a uma pessoa o portão cala-a.
    const bloco = ROTA.slice(ROTA.indexOf('accao === "relerConversa"'));
    expect(bloco).toContain("enviada: saiu");
    expect(bloco).toContain("a mensagem não saiu");
  });
});

describe("o painel mostra antes de mandar", () => {
  it("o botão relê sem confirmar, e só o segundo gesto envia", () => {
    expect(PAINEL).toContain("Reler e continuar");
    expect(PAINEL).toContain("void reler(l.telefone, false)");
    expect(PAINEL).toContain("void reler(l.telefone, true)");
    expect(PAINEL).toContain("Confirmar e enviar");
  });

  it("mostra o que recuperou e a frase que ia sair", () => {
    expect(PAINEL).toContain("releitura.recuperados.join");
    expect(PAINEL).toContain("{releitura.mensagem}");
  });

  it("avisa que um campo inventado passa nos validadores na mesma", () => {
    expect(PAINEL).toContain("passa nos validadores na mesma");
  });
});
