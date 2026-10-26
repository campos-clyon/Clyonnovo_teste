import { describe, it, expect } from "vitest";
import {
  localidadeEResto,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  resumo,
  separarOAndarDaMorada,
  servicoDoTexto,
  type DadosDaRecolha,
  type EstadoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";
import type { CamposCrus } from "./whatsapp-compreensao";
import { juntarLeituras, passoDaPergunta, recolhaPeloFio } from "./reler-a-conversa";
import { camposDaRecolha, descricaoParaOPedido, O_CLIENTE_CARREGA, telefoneDaConversa } from "./pedido-da-recolha";
import { numeroParaWhatsApp } from "./link-de-whatsapp";
import { eResDoChao } from "./res-do-chao";
import { perguntaPelaHora, perguntaSeAceitam, respostaAoMaterial } from "./voz-da-vitoria";

/**
 * A CONVERSA DO TEODORO — 26-10-2026, decisão d24.
 *
 * O caso é verdadeiro; o nome, a morada e o telefone são INVENTADOS (o
 * repositório é público). O cliente mandou uma fotografia e escreveu, numa
 * mensagem só, o material, a data, a morada com o andar, o acesso entre
 * parênteses, o volume e três perguntas. A Vitória:
 *
 *   1. registou «recolha de entulho» — pela palavra que ele NEGOU («não é
 *      entulho de obras»); são embalagens, e um colchão: monos;
 *   2. perguntou «a carrinha consegue encostar à porta?», e ele respondeu que
 *      sim, e que eram eles a carregar — «os profissionais nem precisam de
 *      sair da viatura»; isso não ficou em lado nenhum;
 *   3. perguntou «quanto entulho é? Em sacos ou em m³», que ele já tinha dito;
 *   4. não respondeu às perguntas dele: se aceitam o material, e a hora.
 *
 * E o «Criar pedido desta conversa» do backoffice abriu com a localidade
 * cheia do resto da mensagem, o «R/C Esq» na morada, a descrição cortada a
 * meio da morada («…(29/10), Av. Vamos compactar…»), «Quantos sacos?» =
 * «0,7 m³», e o telefone de fora sem o «+».
 *
 * Testa-se pelos dois caminhos — o das regras (sem o modelo) e o do Gemini,
 * com o que o modelo podia ter lido —, e pelo formulário.
 */

const AGORA = new Date("2026-10-26T15:10:00Z"); // 15:10 em Lisboa (já na hora de Inverno)

const PRIMEIRA =
  "Preciso de recolha de resíduos de embalagens (cartão, plástico bolha, película, esferovite e um colchão insuflável; " +
  "não é entulho de obras) na quinta-feira (29/10), Av. Capitão Brás Lemos 43, R/C Esq, 1700-123 Lisboa " +
  "(pátio ao nível do chão, sem escadas nem elevador). Vamos compactar tudo, ficará cerca de 0,5 a 0,7 m³. " +
  "Aceitam este tipo de material? Qual o preço total com IVA e a janela horária na quinta? Obrigado!";

const NOME = "Teodoro";

const A_CARRINHA =
  "Sim, a carrinha pode estacionar mesmo à porta. Nós próprios carregamos tudo, os profissionais nem precisam de sair da viatura. " +
  "É essencialmente cartão e película plástica.";

const FATURA = "Não";

/** Um telefone de fora, como a ponte o dá: o número inteiro, sem o «+». Inventado. */
const TELEFONE = "447700900123";

type Fala = { estado: EstadoDaRecolha; disse: string[]; respostas: RespostaDaRecolha[] };

/** Pelas regras, sem o modelo. */
function semOModelo(): Fala {
  let estado = recolhaNova();
  const disse: string[] = [];
  const respostas: RespostaDaRecolha[] = [];
  [PRIMEIRA, NOME, A_CARRINHA, FATURA].forEach((texto, i) => {
    const r = responderNaRecolha(estado, texto, AGORA, i > 0, false, { fotos: 1 });
    estado = r.estado;
    disse.push(r.resposta);
    respostas.push(r);
  });
  return { estado, disse, respostas };
}

/**
 * Pelo Gemini — com o modelo a errar o serviço como o caminho errou («recolha
 * de entulho»), para provar que o que ele negou manda sobre o palpite.
 */
function comOModelo(): Fala {
  const leituras: Array<[string, CamposCrus]> = [
    [
      PRIMEIRA,
      {
        servico: "recolha_entulho",
        morada: "Av. Capitão Brás Lemos 43, R/C Esq, 1700-123 Lisboa",
        codigoPostal: "1700-123 Lisboa",
        andar: "r/c",
        elevador: "não",
        entulho: "0,5 a 0,7 m³",
        quando: "quinta-feira (29/10)",
        descricao: "Resíduos de embalagens compactados: cartão, plástico bolha, película, esferovite e um colchão insuflável.",
      },
    ],
    [NOME, { nome: NOME }],
    [A_CARRINHA, { estacionamento: "sim" }],
    [FATURA, { fatura: "não" }],
  ];
  let estado = recolhaNova();
  const disse: string[] = [];
  const respostas: RespostaDaRecolha[] = [];
  leituras.forEach(([texto, campos], i) => {
    const r = responderComCompreensao(estado, { intencao: "informar", campos }, AGORA, {
      texto,
      jaCumprimentou: i > 0,
      fotos: 1,
    });
    estado = r.estado;
    disse.push(r.resposta);
    respostas.push(r);
  });
  return { estado, disse, respostas };
}

const CAMINHOS: Array<[string, () => Fala]> = [
  ["sem o modelo", semOModelo],
  ["com o modelo", comOModelo],
];

describe.each(CAMINHOS)("a conversa do Teodoro, %s", (_, falar) => {
  it("1. «não é entulho de obras» não é entulho: são embalagens e um colchão — monos", () => {
    const { estado, disse } = falar();
    expect(estado.dados.serviceType).toBe("recolha_monos");
    expect(disse[0]).toContain("Fica anotado: recolha de monos.");
    expect(disse.join("\n")).not.toMatch(/recolha de entulho|quanto entulho|Entulho:/i);
  });

  it("2. lê tudo da primeira mensagem: o volume, a quinta 29/10, a morada e o rés-do-chão", () => {
    const d = falar().estado.dados;
    expect(d.volumeDito).toBe("0,5 a 0,7 m³");
    expect(new Date(d.dataDesejada!).toISOString().slice(0, 10)).toBe("2026-10-29");
    expect(d.address).toBe("Av. Capitão Brás Lemos 43");
    expect(d.postalCode).toBe("1700-123");
    expect(d.city).toBe("Lisboa");
    expect(d.floor).toBe("0");
    expect(d.lado).toBe("Esq");
  });

  it("3. a carrinha à porta e quem carrega ficam no pedido", () => {
    const d = falar().estado.dados;
    expect(d.parkingDistance).toBe("near");
    expect(d.clienteCarrega).toBe(true);
    expect(descricaoParaOPedido(d)).toContain(O_CLIENTE_CARREGA);
    expect(O_CLIENTE_CARREGA).toBe("O cliente carrega para a viatura.");
  });

  it("4. responde às duas perguntas dele, na voz da Vitória — e ao preço com a frase de sempre", () => {
    const primeira = falar().disse[0];
    expect(primeira).toContain("Aqui é a Vitória, assistente online da CLYON");
    expect(primeira).toContain("Sim, é material que os profissionais recolhem.");
    expect(primeira).toContain("O dia fica anotado, e o profissional combina a hora consigo.");
    expect(primeira).toContain("O valor é dado pelos profissionais da sua zona");
    expect(primeira).toContain("IVA incluído");
    // Nem «IA» nem «virtual», um emoji no máximo, e nada do que não se promete.
    expect(primeira).not.toMatch(/\bIA\b|virtual|intelig[eê]ncia artificial/i);
    expect([...primeira.matchAll(/\p{Extended_Pictographic}/gu)].length).toBeLessThanOrEqual(1);
    expect(primeira).not.toMatch(/pr[oó]prio dia|contentor|big ?bag/i);
    // E segue para o que falta: o nome.
    expect(primeira).toMatch(/Com quem tenho o gosto de falar\?$/);
  });

  it("5. não volta a perguntar o volume, a data, a descrição, nem o andar ou as escadas", () => {
    const { disse } = falar();
    const tudo = disse.join("\n");
    expect(tudo).not.toMatch(/quanto entulho|quantos sacos|metros cúbicos|em m³/i);
    expect(tudo).not.toMatch(/Para quando precisa|Em que andar|há elevador|escadas|Conte-me o que há/i);
    // O nome, a carrinha, a fatura — e o resumo. Mais nada.
    expect(disse.map((m) => passoDaPergunta(m))).toEqual(["nome", "estacionamento", "fatura", "confirmar"]);
  });

  it("6. a quem disse que carregam, diz-se que ficou anotado — e o resumo devolve tudo", () => {
    const { estado, disse } = falar();
    expect(disse[2]).toContain("Fica anotado que o carregamento até à viatura fica por sua conta.");
    expect(estado.passo).toBe("confirmar");
    const r = resumo(estado.dados);
    expect(r).toContain("Serviço: Recolha de monos");
    expect(r).toContain("Morada: Av. Capitão Brás Lemos 43, 1700-123, Lisboa");
    expect(r).toContain("Andar: r/c Esq · estacionar à porta: sim");
    expect(r).toContain("Volume: 0,5 a 0,7 m³");
    expect(r).toContain("Carregar para a viatura: fica por sua conta");
    expect(r).toContain("Quando: quinta-feira, 29 de outubro\n");
    expect(r).not.toContain("Entulho:");
  });
});

describe("a conversa do Teodoro: a descrição sem pedaços da morada", () => {
  it("leva o pedido inteiro e legível, sem a morada, as perguntas respondidas e o «Obrigado!»", () => {
    const d = semOModelo().estado.dados;
    expect(d.description).toBe(
      "Preciso de recolha de resíduos de embalagens (cartão, plástico bolha, película, esferovite e um colchão insuflável; " +
        "não é entulho de obras) na quinta-feira (29/10). Vamos compactar tudo, ficará cerca de 0,5 a 0,7 m³.",
    );
    expect(d.acessoDito).toContain("pátio ao nível do chão, sem escadas nem elevador");
  });

  it("e o «Quando» é só a data, sem o parêntese de antes", () => {
    expect(semOModelo().estado.dados.quandoTexto).toBe("na quinta-feira (29/10)");
  });
});

describe("a conversa do Teodoro: o formulário «Criar pedido desta conversa»", () => {
  /** O fio como o backoffice o relê — `recolhaPeloFio`, as regras de hoje. */
  function fio() {
    const { disse } = semOModelo();
    const em = AGORA.toISOString();
    return [PRIMEIRA, NOME, A_CARRINHA, FATURA].flatMap((texto, i) => [
      { direccao: "in", texto, criadoEm: em },
      { direccao: "out", texto: disse[i], criadoEm: em },
    ]);
  }

  /** O que ficou gravado no dia — com os campos misturados (o caso de 26-10-2026). */
  const GRAVADO: DadosDaRecolha = {
    serviceType: "recolha_entulho",
    address: "Av. Capitão Brás Lemos 43, R/C Esq",
    postalCode: "1700-123",
    city: "Lisboa (pátio ao nível do chão, sem escadas nem elevador). Vamos compactar tudo, ficará cerca de 0,5 a 0,7 m³. Aceitam e",
    floor: "0",
    entulhoQuantidade: "0,7 m³",
    description: "Preciso de recolha de resíduos de embalagens na quinta-feira (29/10), Av. Vamos compactar tudo",
  };

  it("cada campo no seu sítio", () => {
    const relida = recolhaPeloFio(fio() as never, AGORA).dados;
    const c = camposDaRecolha(TELEFONE, juntarLeituras(GRAVADO, relida));
    expect(c.serviceType).toBe("recolha_monos");
    // A localidade só com a localidade.
    expect(c.city).toBe("Lisboa");
    // A morada só com a rua e o número; o andar e o lado no andar.
    expect(c.address).toBe("Av. Capitão Brás Lemos 43");
    expect(c.floor).toBe("r/c Esq");
    expect(eResDoChao(c.floor)).toBe(true);
    expect(c.parkingDistance).toBe("easy");
    // Num monos não há «Quantos sacos?» — o volume vai na descrição.
    expect(c.entulhoQuantidade).toBeUndefined();
    expect(c.description).toContain("ficará cerca de 0,5 a 0,7 m³");
  });

  it("a descrição começa no pedido dele, sem a morada a meio, e diz quem carrega e o acesso", () => {
    const relida = recolhaPeloFio(fio() as never, AGORA).dados;
    const c = camposDaRecolha(TELEFONE, juntarLeituras(GRAVADO, relida));
    expect(c.description).toMatch(/^Preciso de recolha de resíduos de embalagens \(cartão/);
    expect(c.description).not.toMatch(/Av\.|1700-123|R\/C/);
    expect(c.description).toContain(O_CLIENTE_CARREGA);
    expect(c.description).toContain("Acesso (dito pelo cliente): pátio ao nível do chão, sem escadas nem elevador");
  });

  it("o telefone de fora fica com o «+», e o link do WhatsApp reconhece-o", () => {
    // Sem o «+», o link não o reconhecia: ficava sem botão. Desde 26-10-2026
    // também o reconhece sem o «+» — os pedidos antigos ficam servidos.
    expect(numeroParaWhatsApp(TELEFONE)).toBe("447700900123");
    const c = camposDaRecolha(TELEFONE, {});
    expect(c.contactPhone).toBe("+447700900123");
    expect(numeroParaWhatsApp(c.contactPhone)).toBe("447700900123");
    // Os portugueses ficam como estavam.
    expect(telefoneDaConversa("351912345678")).toBe("351912345678");
    expect(telefoneDaConversa("912345678")).toBe("912345678");
    expect(telefoneDaConversa("+44 7700 900123")).toBe("+44 7700 900123");
  });
});

describe("as peças do caso, uma a uma", () => {
  it("o que se nega não é o serviço, e as embalagens são monos — mas os móveis continuam móveis", () => {
    expect(servicoDoTexto("Recolha de embalagens, não é entulho de obras")).toBe("recolha_monos");
    expect(servicoDoTexto("não é de obras, são caixas de cartão e esferovite")).toBe("recolha_monos");
    expect(servicoDoTexto("sem entulho: só um colchão insuflável")).toBe("recolha_monos");
    expect(servicoDoTexto("dois colchões velhos")).toBe("recolha_monos");
    expect(servicoDoTexto("tenho um sofá e umas caixas para levar")).toBe("recolha_moveis");
    expect(servicoDoTexto("entulho de obras e algum cartão")).toBe("recolha_entulho");
    expect(servicoDoTexto("Recolha de 22 bigbags de 1T")).toBe("recolha_entulho");
  });

  it("e o modelo que diga «entulho» a quem o negou não leva a melhor", () => {
    const r = responderComCompreensao(
      recolhaNova(),
      { intencao: "informar", campos: { servico: "recolha_entulho" } },
      AGORA,
      { texto: "Não é entulho, são umas tralhas da garagem para deitar fora" },
    );
    expect(r.estado.dados.serviceType).toBe("recolha_monos");
    // Com entulho a sério na frase, fica o entulho.
    const obra = responderComCompreensao(
      recolhaNova(),
      { intencao: "informar", campos: { servico: "recolha_entulho" } },
      AGORA,
      { texto: "Não é só cartão: são 20 sacos de entulho" },
    );
    expect(obra.estado.dados.serviceType).toBe("recolha_entulho");
  });

  it("a localidade acaba na vírgula, no parêntese ou no fim da frase", () => {
    expect(localidadeEResto("Lisboa (pátio ao nível do chão, sem escadas nem elevador). Vamos compactar")).toEqual({
      localidade: "Lisboa",
      resto: "pátio ao nível do chão, sem escadas nem elevador. Vamos compactar",
    });
    expect(localidadeEResto("Lisboa, Portugal")).toEqual({ localidade: "Lisboa", resto: null });
    expect(localidadeEResto("S. Domingos de Rana").localidade).toBe("S. Domingos de Rana");
    expect(localidadeEResto("Paço de Arcos").localidade).toBe("Paço de Arcos");
  });

  it("a morada perde o andar, e só depois do número da porta", () => {
    expect(separarOAndarDaMorada("Av. Capitão Brás Lemos 43, R/C Esq")).toEqual({ rua: "Av. Capitão Brás Lemos 43", lado: "Esq" });
    expect(separarOAndarDaMorada("Rua 1º de Maio 12, 3º Dto")).toEqual({ rua: "Rua 1º de Maio 12", lado: "Dto" });
    expect(separarOAndarDaMorada("Rua das Flores 12, 2º Esq, Bloco B")).toEqual({ rua: "Rua das Flores 12, Bloco B", lado: "Esq" });
    expect(separarOAndarDaMorada("Rua 5 de março 14B")).toEqual({ rua: "Rua 5 de março 14B", lado: null });
  });

  it("as perguntas dele reconhecem-se — e ao material que não se recolhe nunca se diz que sim", () => {
    expect(perguntaSeAceitam("Aceitam este tipo de material?")).toBe(true);
    expect(perguntaSeAceitam("Levam esferovite?")).toBe(true);
    expect(perguntaSeAceitam("Vamos compactar tudo.")).toBe(false);
    expect(perguntaPelaHora("Qual o preço total com IVA e a janela horária na quinta?")).toBe(true);
    expect(perguntaPelaHora("A que horas podem vir?")).toBe(true);
    expect(perguntaPelaHora("Para quinta-feira de manhã.")).toBe(false);
    expect(respostaAoMaterial("Aceitam cartão e esferovite?")).toBe("Sim, é material que os profissionais recolhem.");
    expect(respostaAoMaterial("Levam umas telhas de fibrocimento e restos de tinta?")).toMatch(
      /^Sobre o amianto e as tintas, deixo anotado para a equipa confirmar consigo/,
    );
    expect(respostaAoMaterial("Levam cartão e uns químicos?")).not.toMatch(/^Sim/);
    expect(respostaAoMaterial("Aceitam isto?")).toBe("Quanto ao material, deixo anotado para a equipa confirmar consigo.");
  });

  it("a quem perguntou «Vocês recolhem…?» o «Fazemos, sim!» chega — sem um segundo sim", () => {
    const r = responderNaRecolha(recolhaNova(), "Vocês recolhem frigoríficos?", AGORA, false);
    expect(r.resposta).toContain("Fazemos, sim! Fica anotado: recolha de monos.");
    expect(r.resposta).not.toContain("Sim, é material");
    // Mas o que não se recolhe diz-se, mesmo aí.
    const amianto = responderNaRecolha(recolhaNova(), "Vocês recolhem entulho com fibrocimento?", AGORA, false);
    expect(amianto.resposta).toContain("Sobre o amianto, deixo anotado para a equipa confirmar consigo");
  });
});
