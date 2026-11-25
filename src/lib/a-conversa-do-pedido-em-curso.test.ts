import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aEquipaFalouHaPouco,
  assuntoDoPedido,
  avisoDePedidoNovo,
  comOAvisoDePedidoNovo,
  decidirNoPedidoEmCurso,
  eAPerguntaDeAbertura,
  eSoCortesia,
  faseDoPedido,
  HORAS_SEM_PISAR_A_EQUIPA,
  A_EQUIPA_A_ESCREVER_CALA_A_VITORIA,
  PASSEI_A_EQUIPA,
  pedeServicoNovo,
  pedidoPrincipal,
  pedidoRegistadoNaConversa,
  quaseIgual,
  repeteAUltima,
  respostaDasFotografias,
  respostaDoEstado,
  type PedidoEmCurso,
} from "./pedido-em-curso";
import { mensagemDePedidoRegistado, perguntaDo, perguntaParaContinuar } from "./whatsapp-recolha";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";

/**
 * A VITÓRIA ANTES DO PEDIDO NOVO — 21-11-2026 (decisão d73). Três conversas
 * verdadeiras, com os números dos pedidos, os nomes e as horas INVENTADOS (o
 * repositório é público); as frases dos clientes ficam como foram escritas.
 *
 *   A. (setembro) pedido registado com «Acho que sim»; depois «As fotografias
 *      já enviei» e «Quando é apresentado o orçamento» → a Vitória recomeçou
 *      do zero e mandou a mesma pergunta duas vezes seguidas.
 *   B. (20-11) trabalho feito, valor final por pagar, a cliente reclama do
 *      valor → «Para registar o pedido, diga-me só que serviço é…».
 *   C. (21-11) cliente antiga, já pagou um trabalho, pede um orçamento novo; a
 *      equipa responde-lhe à mão → a Vitória não se pode meter.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const NEG = ler("src/lib/whatsapp-negociacao.ts");
const CLOUD = ler("src/lib/whatsapp-cloud.ts");
const ROTA = ler("src/app/api/admin/whatsapp/route.ts");
const PARADAS = ler("src/lib/recolhas-paradas.ts");

const pedido = (p: Partial<PedidoEmCurso> & { id: number }): PedidoEmCurso => ({
  status: "pendente",
  servico: "recolha_moveis",
  fotos: 0,
  haDias: 0,
  negociacoes: [],
  valorFinalPorPagar: false,
  pago: false,
  clyon: false,
  ...p,
});

const corpoDe = (fonte: string, inicio: string, fim: string) => {
  const i = fonte.indexOf(inicio);
  expect(i).toBeGreaterThan(-1);
  const j = fonte.indexOf(fim, i + inicio.length);
  expect(j).toBeGreaterThan(i);
  return fonte.slice(i, j);
};

describe("caso A — o pedido registado não recomeça, e o estado diz-se pelo pedido", () => {
  // O pedido #4101 acabado de registar, com as três fotografias dele.
  const registado = pedido({ id: 4101, fotos: 3 });
  const fio = [
    { direccao: "out", texto: "Pedido #4101 - resumo... Está tudo certo?", haSegundos: 400 },
    { direccao: "in", texto: "Acho que sim", haSegundos: 380 },
    { direccao: "out", texto: mensagemDePedidoRegistado(4101, true, "Teófilo"), haSegundos: 370 },
    { direccao: "in", texto: "As fotografias já enviei", haSegundos: 60 },
  ];

  it("o fio sabe que há um pedido registado nesta conversa", () => {
    expect(pedidoRegistadoNaConversa(fio)).toBe(4101);
    expect(pedidoRegistadoNaConversa(fio.slice(0, 2))).toBeNull();
  });

  it("«As fotografias já enviei» → ficaram no pedido; nunca a pergunta de abertura", () => {
    const d = decidirNoPedidoEmCurso({ texto: "As fotografias já enviei", pedidos: [registado], abertos: true });
    expect(d).toEqual({ tipo: "responder", pedidoId: 4101, texto: respostaDasFotografias(registado) });
    expect(d.tipo === "responder" && d.texto).toContain("ficaram no pedido #4101");
    expect(d.tipo === "responder" && eAPerguntaDeAbertura(d.texto)).toBe(false);
  });

  it("«Quando é apresentado o orçamento» → o estado real: registado e a ser conferido, ou já nos parceiros", () => {
    const d = decidirNoPedidoEmCurso({ texto: "Quando é apresentado o orçamento", pedidos: [registado], abertos: true });
    expect(d.tipo).toBe("responder");
    expect(d.tipo === "responder" && d.texto).toBe(respostaDoEstado(registado));
    expect(respostaDoEstado(registado)).toContain("O pedido #4101 já está registado");

    const enviado = pedido({ id: 4101, status: "enviado", fotos: 3 });
    expect(respostaDoEstado(enviado)).toBe(
      "O pedido #4101 já está registado e foi enviado aos parceiros; as propostas chegam-lhe por aqui.",
    );
    // Com propostas à espera, o estado é o ecrã das propostas.
    const comPropostas = pedido({ id: 4101, status: "enviado", negociacoes: [{ estado: "aberta", propostaPendente: true }] });
    expect(decidirNoPedidoEmCurso({ texto: "Já há propostas?", pedidos: [comPropostas], abertos: true })).toEqual({
      tipo: "ecra",
      pedidoId: 4101,
    });
  });

  it("as duas respostas não são a mesma — nem quase", () => {
    const a = respostaDasFotografias(registado)!;
    const b = respostaDoEstado(registado)!;
    expect(quaseIgual(a, b)).toBe(false);
  });

  it("as perguntas de abertura que ele ouviu reconhecem-se — e não saem depois de um pedido registado", () => {
    expect(eAPerguntaDeAbertura("Diga-me o que precisa de levar ou fazer, à vontade e pelas suas palavras.")).toBe(true);
    expect(
      eAPerguntaDeAbertura(
        "Com todo o gosto! Diga-me o que precisa de levar ou fazer, e em que zona — por exemplo «tenho um sofá e um colchão para tirar, em Cascais».",
      ),
    ).toBe(true);
    expect(eAPerguntaDeAbertura(perguntaDo("servico", {}, false))).toBe(true);
    expect(eAPerguntaDeAbertura(perguntaParaContinuar("servico", {}))).toBe(true);
    expect(eAPerguntaDeAbertura(perguntaDo("morada", { serviceType: "recolha_moveis" }, false))).toBe(false);
    expect(eAPerguntaDeAbertura(PASSEI_A_EQUIPA)).toBe(false);
  });

  it("a recolha passa à equipa em vez de recomeçar — nas duas saídas que levam a abertura", () => {
    const recolha = corpoDe(NEG, "export async function recolherPedidoPorWhatsApp(", "export async function registarARecolha(");
    expect(recolha).toContain("d73.pedidoRegistadoNaConversa(fio)");
    expect(recolha).toContain("passarAUmaPessoa(telefone, d73.motivoDeNaoRecomecar(registadoAqui), d73.PASSEI_A_EQUIPA)");
    // A primeira mensagem (a pergunta do serviço) e a seguinte (o «Com todo o gosto! Diga-me…»).
    expect(recolha.match(/await naoRecomecar\(/g)?.length).toBe(2);
    expect(recolha.indexOf("if (await naoRecomecar(primeira)) return;")).toBeLessThan(
      recolha.indexOf("d73.comOAvisoDePedidoNovo(primeira, novoAParteDe)"),
    );
  });

  it("na conversa de quem tem pedido aberto, o estado e as fotografias vêm antes da negociação e das perguntas do site", () => {
    const corpo = NEG.slice(NEG.indexOf("export async function tratarMensagemDoCliente("));
    const d73 = corpo.indexOf('decidirNoPedidoEmCurso({ texto: conteudo.texto, pedidos: await emCurso(), abertos: true })');
    expect(d73).toBeGreaterThan(-1);
    expect(d73).toBeLessThan(corpo.indexOf("AS PERGUNTAS QUE O SITE JÁ RESPONDE, E O QUE NÃO É PARA FAZER"));
    expect(d73).toBeLessThan(corpo.indexOf("await traduzirParaAMaquina(conteudo.texto.trim(), pedidos)"));
    // E o «ponto de situação» diz o estado do pedido, quando se sabe.
    const ponto = corpo.slice(corpo.indexOf('if (percebida === "ponto_de_situacao") {'));
    expect(ponto.slice(0, 600)).toContain("respostaDoEstado(principal)");
  });
});

describe("caso B — o trabalho feito com valor por pagar não é um cliente novo", () => {
  const feito = pedido({
    id: 4102,
    status: "concluido",
    haDias: 2,
    negociacoes: [{ estado: "acordada", propostaPendente: false }],
    valorFinalPorPagar: true,
  });

  it("a fase é «por pagar», e o pedido conta (fechado há dois dias)", () => {
    expect(faseDoPedido(feito)).toBe("por_pagar");
    expect(pedidoPrincipal([feito])?.id).toBe(4102);
    // Fechado há mais de 30 dias e já pago, já não é «o pedido dela».
    expect(pedidoPrincipal([pedido({ id: 4000, status: "concluido", haDias: 45, pago: true })])).toBeNull();
  });

  it("a reclamação do valor passa à equipa com a frase curta — nunca «diga-me só que serviço é»", () => {
    const d = decidirNoPedidoEmCurso({
      texto: "Boa tarde, este valor não foi o que combinámos, está muito caro",
      pedidos: [feito],
      abertos: false,
    });
    expect(d).toEqual({
      tipo: "equipa",
      pedidoId: 4102,
      motivo: "Pedido #4102 (com valor por pagar): o cliente reclama do valor — responder",
      texto: PASSEI_A_EQUIPA,
    });
    expect(PASSEI_A_EQUIPA).toBe("Obrigada, já passei à equipa, que lhe responde em breve.");
  });

  it("as imagens dela (um comprovativo, uma fotografia) e o que não se percebe também vão à equipa", () => {
    expect(decidirNoPedidoEmCurso({ texto: "", imagens: 1, pedidos: [feito], abertos: false }).tipo).toBe("equipa");
    expect(decidirNoPedidoEmCurso({ texto: "Boa tarde", pedidos: [feito], abertos: false }).tipo).toBe("equipa");
    expect(decidirNoPedidoEmCurso({ texto: "Já paguei por transferência", pedidos: [feito], abertos: false }).tipo).toBe("equipa");
  });

  it("um pedido cancelado há pouco não prende ninguém: o que não for sobre ele segue a recolha de sempre", () => {
    const cancelado = pedido({ id: 4103, status: "cancelado", haDias: 3 });
    expect(decidirNoPedidoEmCurso({ texto: "Olá", pedidos: [cancelado], abertos: false })).toEqual({ tipo: "seguir" });
  });

  it("a reclamação lê-se antes de tudo o que leria um «não» ou abriria um pedido novo", () => {
    const corpo = NEG.slice(NEG.indexOf("export async function tratarMensagemDoCliente("));
    const reclamacao = corpo.indexOf("if (reclamaDoValor(conteudo.texto)) {");
    expect(reclamacao).toBeGreaterThan(-1);
    expect(reclamacao).toBeLessThan(corpo.indexOf("const pedidos = await pedidosDoTelefone(telefone);"));
    expect(reclamacao).toBeLessThan(corpo.indexOf("ciclosComLembreteDoTelefone(telefone)"));
    // Sem pedido aberto, a decisão vem antes da recolha de um pedido novo.
    const semPedido = corpo.slice(corpo.indexOf("if (pedidos.length === 0) {"));
    expect(semPedido.indexOf("abertos: false")).toBeGreaterThan(-1);
    expect(semPedido.indexOf("abertos: false")).toBeLessThan(semPedido.indexOf("await recolherPedidoPorWhatsApp("));
  });

  it("os pedidos em curso lêem-se da base com os fechados dos últimos 30 dias, o valor final e o pagamento", () => {
    const base = ler("src/lib/pedido-em-curso-na-base.ts");
    expect(base).toContain("INTERVAL ${DIAS_DE_UM_PEDIDO_FECHADO} DAY");
    expect(base).toContain("FROM valoresFinaisEnviados WHERE pedidoId = ?");
    expect(base).toContain("FROM pagamentos");
  });
});

describe("caso C — a equipa está a responder: a Vitória não se mete", () => {
  const h = 3600;
  const fio = [
    { direccao: "in", texto: "Boa tarde, queria um orçamento para retirar um roupeiro", haSegundos: 3 * h },
    { direccao: "out", texto: `${MARCA_DE_MAO} Boa tarde! Claro, consegue mandar uma fotografia?`, haSegundos: 2 * h },
    { direccao: "in", texto: "Sim, já envio", haSegundos: 30 },
  ];

  // d116 (25-11-2026): a equipa a escrever já não cala a Vitória — só o «*» (pausa-da-vitoria.ts).
  it("desde a d116 a resposta à mão já não cala a Vitória — nem há 2 horas, nem há 13", () => {
    expect(HORAS_SEM_PISAR_A_EQUIPA).toBe(12);
    expect(A_EQUIPA_A_ESCREVER_CALA_A_VITORIA).toBe(false);
    expect(aEquipaFalouHaPouco(fio)).toBe(false);
    const antigo = fio.map((m) => (m.direccao === "out" ? { ...m, haSegundos: 13 * h } : m));
    expect(aEquipaFalouHaPouco(antigo)).toBe(false);
  });

  it("o «Já respondi» (também o da resposta pelo backoffice) também já não a cala (d116)", () => {
    const semMao = fio.filter((m) => m.direccao === "in");
    expect(aEquipaFalouHaPouco(semMao)).toBe(false);
    expect(aEquipaFalouHaPouco(semMao, { respondidaHaSegundos: h })).toBe(false);
    expect(aEquipaFalouHaPouco(fio, { devolvidaHaSegundos: 5 * h })).toBe(false);
  });

  it("a guarda vem logo à porta, antes de qualquer resposta; e o cron das recolhas paradas também a respeita", () => {
    const corpo = NEG.slice(NEG.indexOf("export async function tratarMensagemDoCliente("));
    const guarda = corpo.indexOf("if (aEquipaFalouHaPouco(fioDaEquipa, daEquipa)) {");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(corpo.indexOf("const daRua = await lerARespostaDaRua(telefone, conteudo.texto);"));
    expect(guarda).toBeLessThan(corpo.indexOf("reclamaDoAtendimento(conteudo.texto)"));
    const depois = corpo.slice(guarda, guarda + 600);
    expect(depois).toContain("return;");
    expect(depois).not.toContain("enviarTextoWhatsApp");
    expect(PARADAS).toContain("if (aEquipaFalouHaPouco(fio, await aEquipaNaConversa(telefone)");
  });

  it("responder pelo backoffice grava o «Já respondi»; «Devolver ao site» e «Enviar pela CLYON» gravam a devolução", () => {
    const responder = corpoDe(ROTA, 'if (accao === "responder") {', 'if (accao === "enviarPelaClyon") {');
    expect(responder.match(/marcarRespondidaWhatsApp\(telefone, true\)/g)?.length).toBe(2);
    const pelaClyon = corpoDe(ROTA, 'if (accao === "enviarPelaClyon") {', 'if (accao === "recebida") {');
    expect(pelaClyon).toContain("marcarDevolvidaWhatsApp(telefone)");
    const retomar = corpoDe(ROTA, 'case "retomar": {', "return null;");
    expect(retomar).toContain("marcarDevolvidaWhatsApp(telefone)");
  });

  it("com a equipa calada, o orçamento novo da cliente antiga é um pedido novo — e diz-se", () => {
    const pago = pedido({ id: 4104, status: "concluido", haDias: 10, pago: true, servico: "mudanca" });
    const texto = "Boa tarde, queria um orçamento para retirar um roupeiro e um colchão";
    expect(assuntoDoPedido(texto)).toBeNull();
    expect(pedeServicoNovo(texto, pago)).toBe(true);
    expect(decidirNoPedidoEmCurso({ texto, pedidos: [pago], abertos: false })).toEqual({ tipo: "pedido_novo", de: 4104 });
    expect(avisoDePedidoNovo(4104)).toBe("Fica como um pedido novo, à parte do pedido #4104.");
    const comAviso = comOAvisoDePedidoNovo("Boa tarde! Aqui é a Vitória, assistente online da CLYON.\n\nQual é a morada?", 4104);
    expect(comAviso.split("\n\n")[1]).toBe(avisoDePedidoNovo(4104));
  });
});

describe("nunca repetir — a mesma mensagem, ou quase, não sai duas vezes seguidas", () => {
  const ABERTURA_1 = "Diga-me o que precisa de levar ou fazer, e em que zona.";
  const ABERTURA_2 = "Diga-me o que precisa de levar ou fazer, e em que zona — por exemplo «tenho um sofá para tirar».";

  it("igual e quase igual contam; perguntas diferentes não", () => {
    expect(quaseIgual(ABERTURA_1, ABERTURA_1)).toBe(true);
    expect(quaseIgual("Qual é a morada? Basta a rua e o número.", "Qual é a morada?  Basta a rua e o número!")).toBe(true);
    expect(quaseIgual("Qual é a morada?", "Há elevador no prédio?")).toBe(false);
    expect(quaseIgual("Obrigada!", "Obrigada, Ana!")).toBe(false);
    // A mesma com pouco à volta é a mesma.
    expect(quaseIgual(`Com todo o gosto! ${ABERTURA_1}`, ABERTURA_1)).toBe(true);
    // O resumo corrigido (a morada nova) é a correcção que ele pediu — sai.
    const resumo = (rua: string) =>
      `Serviço: recolha de móveis\nNome: Teófilo\nMorada: ${rua}, 2800-000, Almada\nAndar: 2, elevador: sim\nFatura: não\n\nEstá tudo certo?`;
    expect(quaseIgual(`Corrigido: a morada.\n\n${resumo("Rua das Gaivotas Mansas 9")}`, resumo("Rua dos Lirios 4"))).toBe(false);
  });

  it("só conta a ÚLTIMA que saiu, e só se foi da Vitória", () => {
    expect(repeteAUltima(ABERTURA_1, [{ direccao: "out", texto: ABERTURA_1 }])).toBe(true);
    expect(repeteAUltima(ABERTURA_1, [{ direccao: "out", texto: ABERTURA_1 }, { direccao: "out", texto: "Qual é a morada?" }])).toBe(false);
    expect(repeteAUltima(ABERTURA_1, [{ direccao: "out", texto: `${MARCA_DE_MAO} ${ABERTURA_1}` }])).toBe(false);
    expect(repeteAUltima(ABERTURA_2, [{ direccao: "out", texto: ABERTURA_2 }])).toBe(true);
  });

  it("uma cortesia repetida cala-se, sem passar à equipa", () => {
    expect(eSoCortesia("De nada. Qualquer coisa, é só dizer.")).toBe(true);
    expect(eSoCortesia("Qual é a morada?")).toBe(false);
  });

  it("na porta do cérebro, a responder ao cliente, a repetição passa à equipa — antes da guarda que a engolia calada", () => {
    const porta = corpoDe(CLOUD, "export async function enviarTextoWhatsApp(", "export async function enviarTextoManualWhatsApp(");
    const d73 = porta.indexOf("d73.repeteAUltima(paraTeclado(texto), ultimas)");
    expect(d73).toBeGreaterThan(-1);
    expect(d73).toBeLessThan(porta.indexOf("jaFoiDito(paraTeclado(texto)"));
    const bloco = porta.slice(d73, d73 + 700);
    expect(bloco).toContain("enviarTextoPorCanal(para, d73.PASSEI_A_EQUIPA");
    expect(bloco).toContain("interromperNumeroWhatsApp(telefoneParaWhatsApp(para), d73.MOTIVO_DE_NAO_REPETIR)");
    expect(porta.slice(porta.indexOf("NUNCA REPETIR"), d73)).toContain("mesmoNumero(rajada.telefone, para)");
  });
});
