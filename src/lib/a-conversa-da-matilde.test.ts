import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ABERTURA_DO_QUE_FALTA,
  CHAVES_DAS_FALTAS,
  EQUIPA_DA_CLYON_NO_MODELO,
  mensagemDoQueFalta,
  PODE_RESPONDER_COM_O_QUE_FALTA,
  type ChaveDaFalta,
} from "./mensagem-do-que-falta";
import { textoDoArquivo, textoDoLembrete1, textoDoLembrete2, textoDoLembrete3 } from "./lembrete-do-que-falta";
import { eEnvioDeModelo, pedidoDoEnvioDeModelo } from "./envio-de-modelo";
import { aEquipaFalouHaPouco, haQuantoFalouAEquipa } from "./pedido-em-curso";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";
import {
  aVitoriaJaSeApresentou,
  DIAS_PARA_RESPONDER_AO_MODELO,
  estadoDeVoltaDoPrecisaInfo,
  lerARespostaAoQueFalta,
  oDiaParaOPedido,
  oQuandoParaAResposta,
  PEDIDO_FICA_COMPLETO,
  PODE_ENVIAR_O_QUE_FALTA,
  podeSairDoPrecisaInfo,
  respostaAoEnvioDeModelo,
  respostaAoQueFalta,
} from "./resposta-ao-que-falta";
import { camposParaOPedido, dadosDoPedido, oQueEDaConversa, responderNoPedidoAberto, pedidoNaConversa } from "./pedido-aberto-na-conversa";
import { descricaoOrganizada } from "./descricao-do-pedido";
import { primeiroPassoEmFalta } from "./whatsapp-recolha";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { deixouAnotadoParaUmaPessoa } from "./mesa-das-conversas";

/**
 * A CONVERSA DA MATILDE, OU DO «PEDIR O QUE FALTA» — 22-11-2026 (decisão d86,
 * CEO e dono). Pedido, nomes, horas e frases INVENTADOS (o repositório é
 * público); a forma do caso é a verdadeira.
 *
 * A equipa carregou em «Pedir o que falta» num pedido de recolha de móveis em
 * «precisa info»; saiu pelo WhatsApp da equipa a mensagem de modelo (as
 * fotografias, o estacionamento, o dia). A cliente respondeu catorze minutos
 * depois com tudo menos a fotografia — as medidas do sofá, o estacionamento
 * com condicionantes, «sexta-feira dia 27 a partir das 14h15» com
 * flexibilidade. A Vitória calou-se (a regra das 12 horas da d73, e a ponte
 * entregou a conversa a uma pessoa) e nada entrou no pedido.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
/* Só os comentários que começam a linha — ver a memória dos testes que lêem o código. */
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const NEG = semNotas(ler("src/lib/whatsapp-negociacao.ts"));
const PONTE = semNotas(ler("src/app/api/whatsapp/ponte/route.ts"));
const NA_BASE = semNotas(ler("src/lib/resposta-ao-que-falta-na-base.ts"));
const COMUM = semNotas(ler("src/lib/gravar-a-resposta-ao-que-falta.ts"));
const EM_CURSO = semNotas(ler("src/lib/pedido-em-curso.ts"));

const corpoDe = (fonte: string, inicio: string, fim: string) => {
  const i = fonte.indexOf(inicio);
  expect(i, inicio).toBeGreaterThan(-1);
  const j = fonte.indexOf(fim, i + inicio.length);
  expect(j, fim).toBeGreaterThan(i);
  return fonte.slice(i, j);
};

// Domingo, 22-11-2026, 15h30 em Lisboa (Inverno: Lisboa = UTC).
const AGORA = new Date("2026-11-22T15:30:00Z");
const PEDIDO = {
  id: 9001,
  status: "precisa_info",
  serviceType: "recolha_moveis",
  contactName: "Matilde Valdeira",
  contactPhone: "910000000",
  city: "Almada",
  floor: "2",
  hasElevator: "yes",
  description: "Sofá de 3 lugares",
};
const FALTAS: ChaveDaFalta[] = ["fotografias", "estacionamento", "data"];
const MODELO = mensagemDoQueFalta(PEDIDO, FALTAS, new Date("2026-11-22T15:16:00Z"));
const RESPOSTA = [
  "Boa tarde. O sofá tem 2,10 m de comprimento por 90 cm de profundidade e 80 cm de altura.",
  "Há estacionamento na rua mas com condicionantes, às vezes é preciso parar em segunda fila.",
  "Pode ser na sexta-feira dia 27 a partir das 14h15, tenho flexibilidade.",
].join("\n");

/** O fio como a base o devolve: o modelo saiu pela mão da equipa (a ponte põe a marca), ela respondeu 14 min depois. */
const FIO = [
  { direccao: "in", texto: "Olá, fiz um pedido no site (S2)", haSegundos: 9000 },
  { direccao: "out", texto: `${MARCA_DE_MAO} ${MODELO}`, haSegundos: 840 },
  { direccao: "in", texto: RESPOSTA, haSegundos: 5 },
];

describe("o envio de modelo reconhece-se pelos marcadores estáveis — e não é a equipa a conversar", () => {
  it("o «Pedir o que falta» tem as duas frases fixas e o número do pedido", () => {
    expect(MODELO).toContain(EQUIPA_DA_CLYON_NO_MODELO);
    expect(MODELO).toContain(PODE_RESPONDER_COM_O_QUE_FALTA);
    expect(MODELO).toContain("#9001");
    expect(pedidoDoEnvioDeModelo(MODELO)).toBe(9001);
    // Como chega ao fio: com a marca da ponte à frente, e com o «\r\n» do telemóvel.
    expect(pedidoDoEnvioDeModelo(`${MARCA_DE_MAO} ${MODELO}`)).toBe(9001);
    expect(pedidoDoEnvioDeModelo(`${MARCA_DE_MAO} ${MODELO.replace(/\n/g, "\r\n")}`)).toBe(9001);
  });

  it("os lembretes do que falta (d71) também são envios de modelo; o aviso de arquivo não pede nada", () => {
    expect(pedidoDoEnvioDeModelo(textoDoLembrete1(PEDIDO, FALTAS, AGORA))).toBe(9001);
    expect(pedidoDoEnvioDeModelo(textoDoLembrete2(PEDIDO, FALTAS, AGORA))).toBe(9001);
    expect(pedidoDoEnvioDeModelo(textoDoLembrete3(PEDIDO, FALTAS, AGORA))).toBe(9001);
    expect(eEnvioDeModelo(textoDoArquivo(PEDIDO, AGORA))).toBe(false);
  });

  it("uma mensagem da equipa escrita à mão, ou o modelo mexido, não é o modelo", () => {
    expect(eEnvioDeModelo(`${MARCA_DE_MAO} Boa tarde, já vi o seu pedido #9001, falta a fotografia.`)).toBe(false);
    expect(eEnvioDeModelo(`${MARCA_DE_MAO} ${MODELO.replace(PODE_RESPONDER_COM_O_QUE_FALTA, "Ligue-nos.")}`)).toBe(false);
    expect(eEnvioDeModelo(`${MARCA_DE_MAO} ${MODELO.replace(/#9001/g, "")}`)).toBe(false);
    expect(eEnvioDeModelo("")).toBe(false);
    expect(eEnvioDeModelo(null)).toBe(false);
  });

  it("sem silêncio da d73: o modelo de há 14 minutos não conta como a equipa a falar", () => {
    expect(haQuantoFalouAEquipa(FIO)).toBeNull();
    expect(aEquipaFalouHaPouco(FIO, {})).toBe(false);
  });

  it("com uma mensagem à mão da equipa DEPOIS do modelo, conta como a equipa a falar — mas desde a d116 já não cala a Vitória", () => {
    const comAMao = [...FIO.slice(0, 2), { direccao: "out", texto: `${MARCA_DE_MAO} Já agora, é rés-do-chão?`, haSegundos: 600 }, FIO[2]];
    expect(haQuantoFalouAEquipa(comAMao)).toBe(600);
    expect(haQuantoFalouAEquipa(FIO, 300)).toBe(300);
    // d116 (25-11-2026): a Vitória responde sempre; só o «*» a pausa.
    expect(aEquipaFalouHaPouco(comAMao, {})).toBe(false);
    expect(aEquipaFalouHaPouco(FIO, { respondidaHaSegundos: 300 })).toBe(false);
  });

  it("a ponte não entrega a conversa por causa do modelo — e o silêncio das 12 h ignora-o", () => {
    const interromper = corpoDe(PONTE, 'if (corpo.accao === "interromper") {', "oQueFazAMensagemDaEquipa(");
    expect(interromper).toContain("registarMensagemWhatsApp(telefone, \"out\", `${MARCA_DE_MAO} ${daMao}`)");
    expect(interromper).toContain("if (eEnvioDeModelo(daMao)) {");
    expect(interromper.indexOf("registarMensagemWhatsApp(")).toBeLessThan(interromper.indexOf("if (eEnvioDeModelo(daMao)) {"));
    expect(EM_CURSO).toContain("if (eEnvioDeModelo(m.texto)) continue;");
  });
});

describe("a resposta é ao último envio de modelo daquele pedido, desse número", () => {
  it("o modelo e, depois, a cliente: é a resposta ao pedido #9001", () => {
    expect(respostaAoEnvioDeModelo(FIO)).toEqual({ pedidoId: 9001 });
  });

  it("o agradecimento automático de uma fotografia pelo meio não conta como resposta da Vitória", () => {
    const comFoto = [...FIO.slice(0, 2), { direccao: "out", texto: "Recebi a fotografia — ficou anexada ao pedido #9001.", haSegundos: 60 }, FIO[2]];
    expect(respostaAoEnvioDeModelo(comFoto)).toEqual({ pedidoId: 9001 });
  });

  it("não é: a equipa escreveu à mão depois, a Vitória já respondeu, ninguém respondeu, ou passou uma semana", () => {
    expect(respostaAoEnvioDeModelo([...FIO.slice(0, 2), { direccao: "out", texto: `${MARCA_DE_MAO} Olá!`, haSegundos: 600 }, FIO[2]])).toBeNull();
    expect(respostaAoEnvioDeModelo([...FIO, { direccao: "out", texto: "Obrigada! Ficou anotado.", haSegundos: 2 }, { direccao: "in", texto: "Ok", haSegundos: 1 }])).toBeNull();
    expect(respostaAoEnvioDeModelo(FIO.slice(0, 2))).toBeNull();
    const antigo = [{ ...FIO[1], haSegundos: DIAS_PARA_RESPONDER_AO_MODELO * 86_400 + 60 }, FIO[2]];
    expect(respostaAoEnvioDeModelo(antigo)).toBeNull();
  });

  it("na conversa, a resposta ao modelo vem depois das queixas, da d73 e da d71, antes do aviso da data e de tudo o resto", () => {
    const corpo = NEG.slice(NEG.indexOf("export async function tratarMensagemDoCliente("));
    const d86 = corpo.indexOf("await responderAoEnvioDeModelo(telefone, conteudo.texto");
    expect(d86).toBeGreaterThan(-1);
    for (const antes of ["aEquipaFalouHaPouco(fioDaEquipa, daEquipa)", "reclamaDoAtendimento(conteudo.texto)", "estaAPerderAPaciencia(conteudo.texto)", "reclamaDoValor(conteudo.texto)", "lembreteEmAbertoDoTelefone(telefone)"]) {
      expect(corpo.indexOf(antes), antes).toBeGreaterThan(-1);
      expect(corpo.indexOf(antes), antes).toBeLessThan(d86);
    }
    expect(d86).toBeLessThan(corpo.indexOf("avisoDeDataRecente(telefone, HORAS_PARA_RESPONDER_AO_AVISO)"));
    expect(d86).toBeLessThan(corpo.indexOf("const pedidos = await pedidosDoTelefone(telefone);"));
    // Só um pedido deste número, aberto, e pelo caminho de sempre do pedido aberto.
    const r = corpoDe(NEG, "async function responderAoEnvioDeModelo(", "\n}\n");
    expect(r).toContain("(await pedidosDoTelefone(telefone)).includes(alvo.pedidoId)");
    expect(r).toContain("pedidoParaAVitoria(pedido)");
    expect(r).toContain("respostaAoModelo: true");
  });
});

describe("o que se grava no pedido", () => {
  const antes = dadosDoPedido(PEDIDO);
  const lido = lerARespostaAoQueFalta(antes, RESPOSTA, AGORA);

  it("o estacionamento vai para o campo (pelo validador de sempre) e as condicionantes para as notas", () => {
    expect(lido.dados.parkingDistance).toBe("near");
    expect(camposParaOPedido(PEDIDO, lido.dados)).toEqual({ parkingDistance: "easy" });
    expect(lido.dados.notas).toEqual([
      "Estacionamento: Há estacionamento na rua mas com condicionantes, às vezes é preciso parar em segunda fila.",
    ]);
  });

  it("o dia e a hora vão para o pedido; a flexibilidade fica nas notas", () => {
    expect(lido.dados.dataDesejada).toBe("2026-11-27T14:15:00.000Z");
    expect(lido.dados.quandoTexto).toBe("sexta-feira dia 27 a partir das 14h15, tenho flexibilidade.");
    expect(oDiaParaOPedido({ ...PEDIDO, dataAgendada: null, urgency: null }, lido.dados, AGORA)).toEqual({
      dataAgendada: new Date("2026-11-27T14:15:00.000Z"),
      urgency: "this_week",
    });
    const descricao = descricaoOrganizada(oQueEDaConversa(antes, lido.dados), {
      campos: { floor: "2", hasElevator: "yes", parkingDistance: "easy", dataAgendada: lido.dados.dataDesejada },
    });
    expect(descricao).toContain("2,10 m de comprimento por 90 cm de profundidade");
    expect(descricao).toContain("Notas (ditas pelo cliente):");
    expect(descricao).toContain("segunda fila");
    expect(descricao).toContain("tenho flexibilidade");
    // O dia já está no campo: não se repete por extenso na descrição (d84).
    expect(descricao).not.toContain("Quando:");
  });

  it("o que ficou anotado diz-se na resposta; a fotografia ainda falta", () => {
    expect(lido.anotado).toEqual(["descricao", "estacionamento", "data"]);
    expect(lido.perguntas).toEqual([]);
  });

  it("nada é apagado: o que o pedido já tinha fica, e o dia marcado não muda", () => {
    const cheio = { ...PEDIDO, parkingDistance: "difficult", dataAgendada: new Date("2026-11-30T09:00:00Z"), urgency: "flexible" };
    const d = dadosDoPedido(cheio);
    const r = lerARespostaAoQueFalta(d, RESPOSTA, AGORA);
    expect(r.dados.parkingDistance).toBe("far");
    expect(camposParaOPedido(cheio, r.dados)).toEqual({});
    expect(oDiaParaOPedido(cheio, r.dados, AGORA)).toEqual({});
    expect(r.dados.contactName).toBe("Matilde Valdeira");
    expect(r.dados.floor).toBe("2");
    expect(r.dados.hasElevator).toBe("yes");
  });

  it("o que não se percebe vai para as notas, dito pelo cliente — e o «sim» sozinho não vai", () => {
    const r = lerARespostaAoQueFalta(antes, "A vizinha do lado também tem a chave.", AGORA);
    expect(r.dados.notas).toEqual(["A vizinha do lado também tem a chave."]);
    expect(r.anotado).toEqual(["notas"]);
    expect(descricaoOrganizada(oQueEDaConversa(antes, r.dados))).toContain("Notas (ditas pelo cliente): A vizinha do lado também tem a chave.");
    expect(lerARespostaAoQueFalta(antes, "Sim", AGORA).anotado).toEqual([]);
    expect(lerARespostaAoQueFalta(antes, "Ok obrigada", AGORA).anotado).toEqual([]);
  });

  it("o andar e o elevador lêem-se; uma pergunta fica à parte, para se responder", () => {
    const semAndar = dadosDoPedido({ ...PEDIDO, floor: null, hasElevator: null });
    const r = lerARespostaAoQueFalta(semAndar, "Quanto custa? É um 3.º andar sem elevador.", AGORA);
    expect(r.dados.floor).toBe("3");
    expect(r.dados.hasElevator).toBe("no");
    expect(r.perguntas).toEqual(["Quanto custa?"]);
    expect(r.dados.notas ?? []).toEqual([]);
  });

  it("as fotografias que mande contam como anotadas", () => {
    expect(lerARespostaAoQueFalta(antes, "", AGORA, { imagens: 2 }).anotado).toEqual(["fotografias"]);
  });

  it("a base grava pelos caminhos de sempre, e só tira o pedido de «precisa info»", () => {
    const g = corpoDe(NEG, "async function gravarARespostaAoModelo(", "\n}\n");
    // d3 (23-11-2026): a leitura e a gravação são da função comum (WhatsApp, conta e app).
    expect(g).toContain("gravarARespostaAoQueFalta({");
    expect(COMUM).toContain("rq.lerARespostaAoQueFalta(x.dados, x.texto, agora, { imagens: x.imagens })");
    expect(COMUM).toContain("pa.camposParaOPedido(x.pedido, depois)");
    expect(COMUM).toContain("rq.oDiaParaOPedido(");
    expect(COMUM).toContain("nb.juntarAConversaNaDescricao(id, novos)");
    expect(COMUM).toContain("oPedidoFicouCompleto(id, x.canal)");
    expect(g).toContain("db.ligarRecolhaWhatsAppAoPedido(telefone, id)");
    expect(g.match(/await enviarTextoWhatsApp\(/g)?.length).toBe(1);
    expect(NA_BASE).toContain("UPDATE simulatorOrders SET status = ?, updatedAt = NOW() WHERE id = ? AND status = 'precisa_info'");
    expect(NA_BASE).toContain("oQueFaltaNoPedido(");
    // As queixas, as desistências e quem pede uma pessoa seguem o caminho de sempre.
    const ramo = corpoDe(NEG, "opcoes.respostaAoModelo &&", "if (gravou) return true;");
    for (const k of ["!r.pedirPessoa", "!r.novoPedido", "!r.trocaDeSitio", "!r.trocaPerguntada", "!r.segundaMoradaNova"]) expect(ramo).toContain(k);
  });

  it("uma desistência na resposta ao modelo vai à equipa, como sempre", () => {
    const dados = dadosDoPedido(PEDIDO);
    const r = responderNoPedidoAberto({ passo: primeiroPassoEmFalta(dados), dados }, "Quero cancelar o pedido, já não preciso", AGORA, {
      pedido: pedidoNaConversa(PEDIDO),
      primeira: true,
      colegaJaFalou: true,
      jaSeApresentou: false,
    });
    expect(r.pedirPessoa).toBe(true);
  });
});

describe("o pedido completo sai de «precisa info» pelo caminho de um pedido que a Vitória registou", () => {
  it("só o que esperava o «Pedir o que falta», e só sem faltas", () => {
    const pedido = `${ABERTURA_DO_QUE_FALTA}\n- Fotografias do que é para levar.`;
    expect(podeSairDoPrecisaInfo("precisa_info", pedido, [])).toBe(true);
    expect(podeSairDoPrecisaInfo("precisa_info", pedido, ["fotografias"])).toBe(false);
    expect(podeSairDoPrecisaInfo("precisa_info", "Pode confirmar se o sofá é de pele?", [])).toBe(false);
    expect(podeSairDoPrecisaInfo("sem_assistente", pedido, [])).toBe(false);
  });

  it("volta a «por atribuir», ou a «atribuído» se alguém o tem", () => {
    expect(estadoDeVoltaDoPrecisaInfo(null)).toBe("sem_assistente");
    expect(estadoDeVoltaDoPrecisaInfo(7)).toBe("atribuido");
  });

  it("a fotografia que faltava, mandada depois, também fecha o «precisa info»", () => {
    const fim = corpoDe(NEG, "let resposta = r.resposta;", "if (resposta) await enviarTextoWhatsApp(telefone, resposta);");
    expect(fim).toContain('=== "precisa_info"');
    expect(fim).toContain("oPedidoFicouCompleto(id)");
    expect(fim).toContain("PEDIDO_FICA_COMPLETO");
    // E vai para o pedido do modelo, agradecida pela Vitória (uma mensagem só).
    const foto = corpoDe(NEG, "export async function guardarFotoDoClienteNoPedido(", "\n}\n");
    expect(foto).toContain("respostaAoEnvioDeModelo(");
    expect(foto).toContain("doPedidoAberto ?? doModelo ??");
    // d98: e só quando se pode falar com o número (entregue à equipa, guarda calada).
    expect(foto).toMatch(/if \(doPedidoAberto == null && doModelo == null(?: && podeFalar)?\) \{/);
  });
});

describe("a resposta da Vitória — uma mensagem curta, na voz dela", () => {
  const lido = lerARespostaAoQueFalta(dadosDoPedido(PEDIDO), RESPOSTA, AGORA);
  const base = {
    pedidoId: 9001,
    nome: "Matilde",
    servico: "recolha_moveis",
    anotado: lido.anotado,
    quando: oQuandoParaAResposta(lido.dados),
    apresentar: !aVitoriaJaSeApresentou(FIO),
  };
  const comFalta = respostaAoQueFalta({ ...base, faltam: ["fotografias"] });
  const completa = respostaAoQueFalta({ ...base, faltam: [] });

  it("agradece, apresenta-se (o modelo foi da equipa), resume o que ficou e diz que falta a fotografia", () => {
    expect(aVitoriaJaSeApresentou(FIO)).toBe(false);
    expect(comFalta).toBe(
      [
        "Obrigada, Matilde! Aqui é a Vitória, a assistente automática da CLYON 😊",
        "Ficou anotado no seu pedido #9001:",
        "- O que é para levar",
        "- Estacionamento",
        "- Quando: sexta-feira, 27 de novembro, a partir das 14h15",
        "Ainda falta:",
        "- Fotografias",
        PODE_ENVIAR_O_QUE_FALTA,
      ].join("\n"),
    );
  });

  it("completo, diz o passo seguinte: a equipa confere e segue para os parceiros", () => {
    expect(completa.endsWith(PEDIDO_FICA_COMPLETO)).toBe(true);
    expect(completa).not.toContain("Ainda falta");
    // Já apresentada, não se apresenta outra vez.
    const fioComEla = [...FIO, { direccao: "out", texto: "Aqui é a Vitória, a assistente automática da CLYON 😊", haSegundos: 1 }];
    expect(respostaAoQueFalta({ ...base, apresentar: !aVitoriaJaSeApresentou(fioComEla), faltam: [] })).not.toContain("Vitória");
  });

  it("assistente automática, «parceiros», um emoji só — e a Mesa vê-a respondida", () => {
    for (const t of [comFalta, completa]) {
      expect(t).not.toMatch(/\b(IA|virtual|bot|robô)\b/i);
      expect(t).not.toMatch(/profissiona/i);
      expect(t).toContain("parceiros");
      expect([...t.matchAll(/\p{Extended_Pictographic}/gu)].length).toBeLessThanOrEqual(1);
      expect(deixouAnotadoParaUmaPessoa(t)).toBe(false);
    }
  });

  it("tem tradução fixa em inglês, francês e espanhol", () => {
    for (const lingua of ["en", "fr", "es"] as const) {
      expect(traducaoFixa(comFalta, lingua), lingua).not.toBeNull();
      expect(traducaoFixa(completa, lingua), lingua).not.toBeNull();
    }
    expect(traducaoFixa(comFalta, "en")).toContain("- When: Friday, 27 November, from 14h15");
    expect(traducaoFixa(comFalta, "en")).toContain("Still missing:\n- Photos");
  });

  it("tudo o que pode faltar, em todos os serviços, também tem tradução", () => {
    for (const servico of ["recolha_moveis", "recolha_monos", "recolha_entulho", "esvaziamento_casa", "mudanca", "manutencao_casa", "outro"]) {
      const t = respostaAoQueFalta({
        ...base,
        servico,
        anotado: ["descricao", "fotografias", "estacionamento", "andar", "elevador", "data", "notas"],
        faltam: [...CHAVES_DAS_FALTAS],
      });
      for (const lingua of ["en", "fr", "es"] as const) expect(traducaoFixa(t, lingua), `${servico} ${lingua}`).not.toBeNull();
    }
  });
});

describe("o ensaio em sombra da Vitória agente corre também nestes casos", () => {
  it("corre depois de cada mensagem tratada, tenha a Vitória respondido ou não", () => {
    const ponte = corpoDe(PONTE, "tratarMensagemDoCliente(telefone, { tipo: \"texto\", texto: junto, imagens, visto, videos })", "ensaioEmSombra(telefone)");
    expect(ponte).toContain("respondida = true;");
    // d92: e só quando responderam as regras (com a «conversa livre», o que o agente disse a sério já ficou no painel).
    expect(ponte).toContain("if (respondida && quemRespondeu === \"regras\") {");
  });
});
