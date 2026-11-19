import { describe, it, expect } from "vitest";
import {
  outraVez,
  perguntaDo,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  type DadosDaRecolha,
  type EstadoDaRecolha,
  type PassoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";
import type { CamposCrus, Intencao } from "./whatsapp-compreensao";
import { responderAoTurno } from "./turno-da-recolha";
import { semFicarCalada, UM_COLEGA_RESPONDE, motivoDoSilencio } from "./nunca-calada";
import { soPedeOPreco, responderAoOrcamentoAMeio, PERGUNTA_DA_ZONA } from "./orcamento-a-meio";
import { lerAnuncioDeImovel, fraseDoAnuncio, linhaDoAnuncio, PERGUNTA_DO_ANUNCIO } from "./anuncio-de-imovel";
import { jaFoiDito, type SaidaGravada } from "./nao-repetir";
import { paraTeclado } from "./whatsapp-cloud";
import { passoDaPergunta } from "./reler-a-conversa";
import { descricaoParaOPedido } from "./pedido-da-recolha";

/**
 * A CONVERSA DO ANÚNCIO DA CASA — 16-11-2026 (decisão d48).
 *
 * Um cliente chegou pelo Google com o link do anúncio de um T3 na Mina de
 * Água (Amadora), disse que ia mandar fotografias, deu o nome e o acesso
 * («sem elevador, segundo piso, os sofás têm de ser desmanchados»). À
 * pergunta da morada respondeu «Orçamento»; ouviu «Peço desculpa, não apanhei
 * bem. Qual é a morada…» — a mesma pergunta — e ao segundo «Orçamento» não
 * ouviu nada: a resposta saía igual à anterior, e o envio engoliu-a por
 * repetida (`jaFoiDito`, 10 minutos), sem passar a conversa a ninguém.
 *
 * As frases são as dele; o nome («João Teste») e o número do anúncio são
 * INVENTADOS (repositório público). O dia é 16-11-2026, às 10h21 de Lisboa.
 */

const AGORA = new Date("2026-11-16T10:21:00Z");
const LINK = "https://www.kasas-portugal.com/imovel/apartamento-t3-com-boas-areas-na-mina-de-agua-amadora/99999999";
const PRIMEIRA = `Olá! Encontrei-vos no Google e quero um orçamento de recolha. Vou enviar fotos. (A1) estão neste site ${LINK}`;
const NOME = "João Teste";
const ACESSO = "Sem elevador segundo piso sofás terão de ser desmanchados para sair";

type Linha = SaidaGravada;

/** O fio como a base o devolve: o que sai fica na forma `paraTeclado`, com a idade contada pela base. */
function noFio(fio: Linha[], direccao: "in" | "out", texto: string) {
  fio.push({ direccao, texto: direccao === "out" ? paraTeclado(texto) : texto, criadoEm: "", haSegundos: 30 });
}

/**
 * Uma volta do cérebro como `recolherPedidoPorWhatsApp` a dá, pelas regras
 * (o caminho de quando o modelo não responde) ou com o que o modelo leu.
 */
async function turno(
  e: EstadoDaRecolha,
  texto: string,
  fio: Linha[],
  ditos: string[],
  modelo?: { intencao: Intencao; campos: CamposCrus },
): Promise<RespostaDaRecolha> {
  noFio(fio, "in", texto);
  const textos = [...ditos, texto];
  const jaExplicou = fio.some((m) => m.direccao === "out" && /o valor e dado pelos parceiros/i.test(m.texto.normalize("NFD").replace(/[̀-ͯ]/g, "")));
  const lida = await responderAoTurno(e, texto, AGORA, {
    textos,
    fotos: 0,
    jaExplicouOPreco: jaExplicou,
    lerOTexto: (est) =>
      modelo
        ? responderComCompreensao(est, modelo, AGORA, { texto, jaCumprimentou: true, ditosAntes: ditos.slice() })
        : responderNaRecolha(est, texto, AGORA, true, false, { ditosAntes: ditos.slice() }),
  });
  const r = semFicarCalada(lida, fio, AGORA, { passo: e.passo, texto });
  ditos.push(texto);
  // O que o envio deixaria sair: uma repetição dos últimos 10 minutos é engolida.
  if (r.resposta && !jaFoiDito(paraTeclado(r.resposta), fio, AGORA, 10 / 60)) noFio(fio, "out", r.resposta);
  return r;
}

describe("o link do anúncio — o que o endereço diz", () => {
  it("lê a tipologia, a terra e o concelho do próprio endereço", () => {
    const a = lerAnuncioDeImovel(PRIMEIRA);
    expect(a).toMatchObject({ portal: "kasas-portugal", tipologia: "T3", localidade: "Mina de Água", concelho: "Amadora" });
    expect(fraseDoAnuncio(a!)).toBe("Pelo anúncio, é um T3 na Mina de Água (Amadora).");
    expect(linhaDoAnuncio(a!)).toBe("Imóvel (pela ligação do anúncio que o cliente enviou): T3; Mina de Água, Amadora.");
  });

  it("os outros portais, a moradia e o andar", () => {
    expect(lerAnuncioDeImovel("https://www.imovirtual.com/pt/anuncio/apartamento-t2-2-andar-em-odivelas-ID1abc")).toMatchObject({
      portal: "imovirtual",
      tipologia: "T2",
      andar: "2",
      concelho: "Odivelas",
    });
    expect(lerAnuncioDeImovel("vejam supercasa.pt/venda-moradia-t4-cascais/i123456")).toMatchObject({
      moradia: true,
      tipologia: "T4",
      concelho: "Cascais",
    });
    // Sem nada no endereço: reconhece-se o anúncio, e não se inventa.
    const so = lerAnuncioDeImovel("https://www.idealista.pt/imovel/12345678/");
    expect(so).toEqual({ portal: "idealista" });
    expect(fraseDoAnuncio(so!)).toBe("Pela ligação, é o anúncio de uma casa.");
    // No OLX vende-se de tudo: só os imóveis contam.
    expect(lerAnuncioDeImovel("https://www.olx.pt/d/anuncio/sofa-3-lugares-IDabc.html")).toBeNull();
    expect(lerAnuncioDeImovel("https://www.clyon.pt/recolha-de-monos")).toBeNull();
  });

  it("a Vitória nunca diz que abriu ou viu o anúncio", () => {
    for (const a of [lerAnuncioDeImovel(PRIMEIRA)!, { portal: "idealista" }]) {
      expect(fraseDoAnuncio(a)).not.toMatch(/abri|vi o an[uú]ncio|li o an[uú]ncio|na p[aá]gina/i);
    }
  });
});

describe("«Orçamento» a meio da recolha", () => {
  it("as palavras do preço, sozinhas", () => {
    for (const f of ["Orçamento", "orçamento?", "Preço", "Quanto custa?", "Valor", "e o valor?", "Qual o preço?", "Quero o orçamento"]) {
      expect(soPedeOPreco(f), f).toBe(true);
    }
    for (const f of ["Rua das Flores 3, quanto custa?", "João", "Sem elevador segundo piso", "2700-000 Amadora"]) {
      expect(soPedeOPreco(f), f).toBe(false);
    }
  });

  it("sem zona nenhuma: explica numa frase e pede só a zona — a rua fica para depois", () => {
    const e: EstadoDaRecolha = { passo: "morada", dados: { serviceType: "recolha_moveis", contactName: "João" } };
    const r = responderAoOrcamentoAMeio(e, "Orçamento", AGORA)!;
    expect(r.resposta).toMatch(/O valor é dado pelos parceiros da sua zona/);
    expect(r.resposta).toMatch(/2 ou 3 fotografias/);
    expect(r.resposta.endsWith(PERGUNTA_DA_ZONA)).toBe(true);
    expect(passoDaPergunta(r.resposta)).toBe("codigoPostal");
    expect(r.estado.passo).toBe("codigoPostal");
    // A localidade sozinha chega para seguir.
    const depois = responderNaRecolha(r.estado, "Amadora", AGORA, true, false);
    expect(depois.estado.dados.city).toBe("Amadora");
    expect(["morada", "codigoPostal"]).not.toContain(depois.estado.passo);
  });
});

describe("a conversa do anúncio, pelas regras — nenhum turno fica sem resposta", () => {
  it("do link ao resto das perguntas, sem a morada pedida três vezes", async () => {
    const fio: Linha[] = [];
    const ditos: string[] = [];
    let e = recolhaNova();
    // A primeira: o modelo leu «recolha de móveis» (foi o que a Vitória anotou).
    const r1 = await turno(e, PRIMEIRA, fio, ditos, { intencao: "informar", campos: { servico: "recolha_moveis" } });
    e = r1.estado;
    expect(r1.resposta).toMatch(/Fica anotado: recolha de móveis\./);
    expect(r1.resposta.endsWith(`Pelo anúncio, é um T3 na Mina de Água (Amadora). ${PERGUNTA_DO_ANUNCIO}`)).toBe(true);
    expect(r1.resposta).not.toMatch(/abri|vi o an[uú]ncio/i);
    expect(e.dados.city).toBe("Amadora");

    // «João» não responde à pergunta do anúncio: lê-se como sempre (o nome), e a pergunta não se repete.
    const r2 = await turno(e, NOME, fio, ditos);
    e = r2.estado;
    expect(e.dados.contactName).toBe(NOME);
    expect(r2.resposta).not.toContain(PERGUNTA_DO_ANUNCIO);

    const r3 = await turno(e, ACESSO, fio, ditos);
    e = r3.estado;
    expect(r3.resposta.trim()).not.toBe("");

    // Agora os dois «Orçamento», onde ela se calou.
    const passoAntes = e.passo;
    const r4 = await turno(e, "Orçamento", fio, ditos);
    e = r4.estado;
    expect(r4.resposta).toMatch(/O valor é dado pelos parceiros da sua zona/);
    expect(r4.resposta).not.toMatch(/n[aã]o apanhei/i);
    if (passoAntes === "morada" || passoAntes === "codigoPostal") {
      expect(r4.resposta).toMatch(/Sigo com a zona \(Mina de Água, Amadora\)/);
    }
    expect(["morada", "codigoPostal"]).not.toContain(e.passo);

    const r5 = await turno(e, "Orçamento", fio, ditos);
    e = r5.estado;
    expect(r5.resposta.trim()).not.toBe("");
    expect(r5.resposta).not.toBe(r4.resposta);
    // E ele leu alguma coisa: ou a resposta saiu, ou a conversa passou a uma pessoa.
    expect(jaFoiDito(paraTeclado(r5.resposta), fio.slice(0, -1), AGORA, 10 / 60) === false || r5.pedirPessoa === true).toBe(true);

    // O terceiro «Orçamento», igual: a frase da vez já saiu — passa a um colega, com o motivo.
    const r6 = await turno(e, "Orçamento", fio, ditos);
    expect(r6.resposta.trim()).not.toBe("");
    if (r6.pedirPessoa) expect(r6.resposta).toBe(UM_COLEGA_RESPONDE);
  });

  it("o pedido leva o que o link diz, e regista-se com a zona sem a rua", async () => {
    const fio: Linha[] = [];
    const ditos: string[] = [];
    let e = recolhaNova();
    e = (await turno(e, PRIMEIRA, fio, ditos, { intencao: "informar", campos: { servico: "recolha_moveis" } })).estado;
    e = (await turno(e, NOME, fio, ditos)).estado;
    e = (await turno(e, "Orçamento", fio, ditos)).estado;
    expect(e.dados.soAZona).toBe(true);
    expect(e.dados.address ?? "").toBe("");
    expect(descricaoParaOPedido(e.dados)).toContain("Imóvel (pela ligação do anúncio que o cliente enviou): T3; Mina de Água, Amadora.");
  });

  it("«a casa toda» passa a esvaziamento de casa; «só alguns móveis» fica recolha", async () => {
    for (const [resposta, servico] of [
      ["A casa toda", "esvaziamento_casa"],
      ["Só alguns móveis", "recolha_moveis"],
    ] as const) {
      const fio: Linha[] = [];
      const ditos: string[] = [];
      let e = recolhaNova();
      e = (await turno(e, PRIMEIRA, fio, ditos, { intencao: "informar", campos: { servico: "recolha_moveis" } })).estado;
      const r = await turno(e, resposta, fio, ditos);
      expect(r.estado.dados.serviceType, resposta).toBe(servico);
      expect(r.estado.dados.aConfirmarEsvaziamento).toBeUndefined();
    }
  });
});

describe("nunca calada — a regra", () => {
  const e: EstadoDaRecolha = { passo: "morada", dados: { serviceType: "recolha_moveis", contactName: "João" } };

  it("o que ia ser engolido por repetido passa a um colega, com o motivo", () => {
    const fio: Linha[] = [];
    const repetida: RespostaDaRecolha = { estado: e, resposta: "Qual é a morada, por favor?" };
    noFio(fio, "out", repetida.resposta);
    const r = semFicarCalada(repetida, fio, AGORA, { passo: "morada", texto: "Orçamento" });
    expect(r.pedirPessoa).toBe(true);
    expect(r.resposta).toBe(UM_COLEGA_RESPONDE);
    expect(r.motivoDaEntrega).toBe("Cliente pede orçamento sem morada — a Vitória não conseguiu avançar; responder");
    expect(motivoDoSilencio("andar", "ahn")).toMatch(/o andar/);
  });

  it("uma resposta vazia também passa; uma nova sai como está; o registo segue", () => {
    expect(semFicarCalada({ estado: e, resposta: "" }, [], AGORA, { passo: "morada", texto: "xpto" }).pedirPessoa).toBe(true);
    const nova: RespostaDaRecolha = { estado: e, resposta: "Em que andar fica?" };
    expect(semFicarCalada(nova, [], AGORA, { passo: "morada", texto: "x" })).toBe(nova);
    const reg: RespostaDaRecolha = { estado: e, resposta: "", registar: true };
    expect(semFicarCalada(reg, [], AGORA, { passo: "confirmar", texto: "sim" })).toBe(reg);
  });

  it("à pessoa diz-se «colega da CLYON» — nunca IA, virtual ou robô", () => {
    expect(UM_COLEGA_RESPONDE).not.toMatch(/\b(IA|virtual|rob[oô]|bot)\b/i);
  });
});

describe("«não apanhei bem» nunca leva a mesma pergunta", () => {
  const PASSOS: PassoDaRecolha[] = [
    "nome", "morada", "codigoPostal", "andar", "elevador", "estacionamento", "quando", "descricao", "fatura", "nif",
  ];
  const dados: DadosDaRecolha = { serviceType: "recolha_moveis", contactName: "João" };

  it("a reformulação nunca contém a pergunta de sempre", () => {
    for (const p of PASSOS) {
      const pergunta = perguntaDo(p, dados, false, AGORA);
      expect(outraVez(p, dados), p).not.toContain(pergunta);
    }
  });

  it("na morada, a reformulação dá a saída da zona", () => {
    expect(outraVez("morada", dados)).toMatch(/diga-me só a zona/);
    expect(outraVez("morada", { ...dados, city: "Amadora" })).toMatch(/sigo só com a zona \(Amadora\)/);
    expect(passoDaPergunta(outraVez("morada", dados))).toBe("morada");
  });

  it("pelo modelo: a morada não percebida duas vezes nunca sai igual — a segunda passa a um colega", async () => {
    const fio: Linha[] = [];
    const ditos: string[] = [];
    let e: EstadoDaRecolha = { passo: "morada", dados: { serviceType: "recolha_moveis", contactName: "João", floor: "2", hasElevator: "no" } };
    noFio(fio, "out", perguntaDo("morada", e.dados, false, AGORA));
    const nada = { intencao: "informar" as Intencao, campos: {} };
    const r1 = await turno(e, "hmm", fio, ditos, nada);
    expect(r1.resposta).not.toContain(perguntaDo("morada", e.dados, false, AGORA));
    e = r1.estado;
    const r2 = await turno(e, "hmm", fio, ditos, nada);
    expect(r2.resposta.trim()).not.toBe("");
    if (r2.resposta === r1.resposta) throw new Error("saiu igual — o envio engolia-a");
  });
});
