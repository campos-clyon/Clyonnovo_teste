import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  acessoAteARua,
  notaDosDegraus,
  PERGUNTA_DA_FATURA,
  perguntaParaContinuar,
  resumo,
  responderComCompreensao,
  responderNaRecolha,
  SALTO_DA_PERGUNTA,
  simOuNaoNaFactura,
  type EstadoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";
import { FICA_ANOTADO, naPerguntaEmCima, respostasAPergunta, semRepetirAPergunta } from "./nao-insistir";
import { comOValorFechado, fraseDoValorFechado, NOTA_DO_VALOR_FECHADO, pedeValorFechado } from "./valor-fechado-na-recolha";
import { fraseDaBase } from "./frase-da-base";
import { passoDaPergunta } from "./reler-a-conversa";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { DUAS_FATURAS_POR_TRABALHO_CURTA } from "./pagar-ao-parceiro";

/**
 * A CONVERSA DA MORADIA — 18-11-2026, decisão d69 (CEO e dono).
 *
 * O caso é verdadeiro (um esvaziamento numa moradia em Alfragide, hoje); o
 * nome e a morada são INVENTADOS — o repositório é público. Como aconteceu:
 *
 *   VITÓRIA: Obrigada! E em que andar é?
 *   CLIENTE: (fotografias) · É uma moradia · (fotografias)
 *   EQUIPA (à mão): Perfeito. E a carrinha consegue encostar à porta, ou fica um bocadinho longe?
 *   CLIENTE: Tem poucas escadas até à estrada
 *   VITÓRIA: Sem problema, essa pode ficar para depois. E a carrinha consegue
 *            encostar à porta, ou fica um bocadinho longe?            ← REPETIU
 *   CLIENTE: Como disse tem poucas escadas da porta até à estrada onde a carrinha estaciona
 *   VITÓRIA: Óptimo. Para quando precisa? …
 *   CLIENTE: Em princípio no final da próxima semana
 *   VITÓRIA: Perfeito, fica anotado. Deseja fatura? (aplica-se IVA de 23%)
 *   CLIENTE: É indiferente, quero saber o valor final sem alterações posteriores
 *   VITÓRIA: Sem problema, essa pode ficar para depois. […] Confirme, por favor  ← «Fatura: -»
 *
 * A recolha estava gravada no andar; a equipa perguntou a carrinha à mão; a
 * Vitória leu a resposta contra o andar, repetiu o andar e, ao «não
 * insistir», saltou-o — para a carrinha, que já estava respondida. E a
 * resposta dos degraus foi parar à descrição.
 */

const AGORA = new Date("2026-11-18T20:00:00Z");
const NOME = "Rosário"; // inventado
const MORADA = "Rua das Amendoeiras 7, Alto do Moinho"; // inventada

const PERGUNTA_DO_ANDAR = "Obrigada! E em que andar é?";
const CARRINHA_A_MAO = `${MARCA_DE_MAO} Perfeito. E a carrinha consegue encostar à porta, ou fica um bocadinho longe?`;
const DEGRAUS = "Tem poucas escadas até à estrada";
const COMO_DISSE = "Como disse tem poucas escadas da porta até à estrada onde a carrinha estaciona";
const INDIFERENTE = "É indiferente, quero saber o valor final sem alterações posteriores";

type Msg = { direccao: string; texto: string };

/** O estado gravado quando a equipa fez a pergunta da carrinha: ainda no andar. */
function noAndar(): EstadoDaRecolha {
  return {
    passo: "andar",
    dados: {
      serviceType: "esvaziamento_casa",
      contactName: NOME,
      address: MORADA,
      postalCode: "2610-999",
      city: "Alfragide",
      hasElevator: "no",
      fotosDitas: true,
      description: "Esvaziar o que falta da casa, que está nas fotografias",
    },
  };
}

function fioAteACarrinha(): Msg[] {
  return [
    { direccao: "out", texto: PERGUNTA_DO_ANDAR },
    { direccao: "in", texto: "[fotografia não descarregada]" },
    { direccao: "in", texto: "É uma moradia" },
    { direccao: "in", texto: "[fotografia não descarregada]" },
    { direccao: "out", texto: CARRINHA_A_MAO },
  ];
}

/** Um turno, pela ordem do `recolherPedidoPorWhatsApp`: a pergunta em cima, a leitura, não repetir, o valor fechado. */
function turno(estado: EstadoDaRecolha, fio: Msg[], texto: string, comModelo: boolean): RespostaDaRecolha {
  fio.push({ direccao: "in", texto });
  const e = naPerguntaEmCima(estado, fio);
  const lido = comModelo
    ? responderComCompreensao(e, { intencao: "informar", campos: {} }, AGORA, { texto, jaCumprimentou: true })
    : responderNaRecolha(e, texto, AGORA, true, false, {});
  const r = comOValorFechado(semRepetirAPergunta(lido, fio, texto), texto);
  if (r.resposta) fio.push({ direccao: "out", texto: r.resposta });
  return r;
}

describe.each([
  ["sem o modelo", false],
  ["com o modelo", true],
])("a conversa da moradia, %s", (_, comModelo) => {
  it("«Tem poucas escadas até à estrada» responde à carrinha: perto, os degraus anotados, e não se repete", () => {
    const fio = fioAteACarrinha();
    const r = turno(noAndar(), fio, DEGRAUS, comModelo);
    expect(r.estado.dados.parkingDistance).toBe("near");
    expect(r.estado.dados.acessoDito ?? "").toContain("poucos degraus até à estrada");
    expect(r.resposta).not.toContain(SALTO_DA_PERGUNTA);
    expect(r.resposta).not.toMatch(/carrinha/);
    expect(passoDaPergunta(r.resposta)).not.toBe("estacionamento");
    // Os degraus não são o que há para levar.
    expect(r.estado.dados.description ?? "").not.toMatch(/escadas/i);
  });

  it("o andar, perguntado e respondido («É uma moradia»), também não volta", () => {
    const fio = fioAteACarrinha();
    const r = turno(noAndar(), fio, DEGRAUS, comModelo);
    expect(passoDaPergunta(r.resposta)).not.toBe("andar");
    expect(r.resposta).not.toContain(SALTO_DA_PERGUNTA);
    expect(passoDaPergunta(r.resposta)).toBe("quando");
    // Quando a leitura ia voltar ao andar, a resposta dele fica escrita como veio.
    if (r.estado.dados.saltados?.includes("andar")) expect(r.estado.dados.acessoDito ?? "").toContain("Andar: É uma moradia");
  });

  it("e a conversa até ao resumo: «é indiferente» à fatura fica sem NIF, e o valor fechado fica anotado", () => {
    const fio = fioAteACarrinha();
    let r = turno(noAndar(), fio, DEGRAUS, comModelo);
    r = turno(r.estado, fio, "Em princípio no final da próxima semana", comModelo);
    expect(r.estado.passo).toBe("fatura");
    expect(r.resposta.endsWith(PERGUNTA_DA_FATURA)).toBe(true);
    r = turno(r.estado, fio, INDIFERENTE, comModelo);
    expect(r.estado.dados.precisaFatura).toBe(false);
    expect(r.estado.dados.notas ?? []).toContain(NOTA_DO_VALOR_FECHADO);
    expect(r.resposta.startsWith(fraseDoValorFechado("esvaziamento_casa"))).toBe(true);
    expect(r.resposta).not.toContain(SALTO_DA_PERGUNTA);
    expect(r.resposta).toContain("Confirme, por favor");
    expect(r.resposta).toContain("Fatura: sem NIF");
    expect(r.resposta).toContain("estacionar à porta: sim");
    // Nenhuma pergunta saiu duas vezes.
    const perguntas = fio.filter((m) => m.direccao === "out").map((m) => passoDaPergunta(m.texto.replace(MARCA_DE_MAO, "")));
    expect(new Set(perguntas).size).toBe(perguntas.length);
  });
});

describe("o acesso até à rua", () => {
  for (const frase of [
    DEGRAUS,
    COMO_DISSE,
    "A carrinha estaciona na estrada",
    "a carrinha estaciona na rua",
    "Estaciona à porta",
    "Tem de subir uns degraus",
    "há que descer 5 degraus",
    "Há estacionamento perto",
    "É uma moradia com escadas até à rua",
  ]) {
    it(`«${frase}» é perto`, () => {
      expect(acessoAteARua(frase)).toBe(true);
      const e: EstadoDaRecolha = { passo: "estacionamento", dados: { ...noAndar().dados, floor: "0" } };
      const r = responderNaRecolha(e, frase, AGORA, true, false, {});
      expect(r.estado.dados.parkingDistance).toBe("near");
      expect(passoDaPergunta(r.resposta)).not.toBe("estacionamento");
    });
  }

  it("o que não é perto não se lê como perto", () => {
    expect(acessoAteARua("A carrinha não estaciona à porta")).toBe(false);
    expect(acessoAteARua("Não há estacionamento perto")).toBe(false);
    expect(acessoAteARua("Rua das Flores 12")).toBe(false);
  });

  it("os degraus ficam escritos como ele os disse", () => {
    expect(notaDosDegraus(DEGRAUS)).toBe("poucos degraus até à estrada");
    expect(notaDosDegraus(COMO_DISSE)).toBe("poucos degraus até à estrada");
    expect(notaDosDegraus("São 12 degraus até à rua")).toBe("12 degraus até à rua");
    expect(notaDosDegraus("A carrinha estaciona à porta")).toBeNull();
  });
});

describe("nunca repetir uma pergunta respondida", () => {
  const nasCarrinha: EstadoDaRecolha = { passo: "estacionamento", dados: { ...noAndar().dados, floor: "0" } };
  const PERGUNTA = perguntaParaContinuar("estacionamento", nasCarrinha.dados);

  it("respondida e não percebida: fica como veio, e segue — com «fica anotado»", () => {
    const fio: Msg[] = [
      { direccao: "out", texto: PERGUNTA },
      { direccao: "in", texto: "Logo se vê com o vizinho" },
    ];
    const ia: RespostaDaRecolha = { estado: nasCarrinha, resposta: `Peço desculpa, não percebi bem: a carrinha consegue parar perto da porta?` };
    const r = semRepetirAPergunta(ia, fio);
    expect(r.resposta.startsWith(FICA_ANOTADO)).toBe(true);
    expect(r.resposta).not.toContain(SALTO_DA_PERGUNTA);
    expect(r.estado.passo).not.toBe("estacionamento");
    expect(r.estado.dados.parkingDistance).toBeNull(); // «a confirmar»
    expect(r.estado.dados.acessoDito).toContain("Estacionamento: Logo se vê com o vizinho");
  });

  it("uma pergunta dele é outra coisa: a pergunta repete-se, uma vez", () => {
    const fio: Msg[] = [
      { direccao: "out", texto: PERGUNTA },
      { direccao: "in", texto: "Quanto custa mais ou menos?" },
    ];
    const ia: RespostaDaRecolha = { estado: nasCarrinha, resposta: `O valor chega nas propostas. ${PERGUNTA}` };
    expect(semRepetirAPergunta(ia, fio)).toBe(ia);
    // À segunda, já não.
    const fio2: Msg[] = [...fio, { direccao: "out", texto: ia.resposta }, { direccao: "in", texto: "Ok, logo se vê" }];
    expect(semRepetirAPergunta(ia, fio2).resposta.startsWith(FICA_ANOTADO)).toBe(true);
  });

  it("as fotografias e as chamadas não são respostas", () => {
    const fio: Msg[] = [
      { direccao: "out", texto: PERGUNTA },
      { direccao: "in", texto: "[fotografia]" },
      { direccao: "in", texto: "[chamada]" },
    ];
    expect(respostasAPergunta("estacionamento", fio)).toEqual({ vezes: 1, respostas: [] });
  });

  it("a pergunta da equipa à mão conta como feita; a da Vitória por responder fica como estava", () => {
    expect(respostasAPergunta("estacionamento", fioAteACarrinha()).vezes).toBe(1);
    expect(naPerguntaEmCima(noAndar(), fioAteACarrinha()).passo).toBe("estacionamento");
    // Uma mensagem da equipa que não é pergunta não muda nada.
    expect(naPerguntaEmCima(noAndar(), [{ direccao: "out", texto: `${MARCA_DE_MAO} A carrinha chega às 9h.` }]).passo).toBe("andar");
  });
});

describe("a fatura pela regra de hoje (d30: duas faturas; d117: o IVA é o de cada proposta)", () => {
  it("a pergunta não dá a entender que sem fatura não há IVA", () => {
    expect(PERGUNTA_DA_FATURA).toBe("Quer o seu NIF na fatura? Se sim, diga-me o número.");
    expect(PERGUNTA_DA_FATURA).not.toMatch(/IVA|aplica-se/);
    expect(DUAS_FATURAS_POR_TRABALHO_CURTA).toMatch(/com IVA ou isento/);
    expect(passoDaPergunta(PERGUNTA_DA_FATURA)).toBe("fatura");
  });

  it("o site diz o mesmo", () => {
    const site = readFileSync(join(__dirname, "..", "app", "plataforma", "pedir", "components", "ValoresEFaturacao.tsx"), "utf8");
    expect(site).toContain("{O_NIF_E_OPCIONAL_E_O_IVA_DEPENDE}");
    expect(site).not.toMatch(/com ou sem NIF/);
  });

  for (const t of ["É indiferente", "tanto faz", "Como preferir", INDIFERENTE]) {
    it(`«${t}» é a opção por omissão (sem NIF)`, () => expect(simOuNaoNaFactura(t)).toBe("nao"));
  }

  it("o resumo diz como ficou, sem IVA nenhum à frente", () => {
    const d = { ...noAndar().dados, floor: "0", parkingDistance: "near", quandoTexto: "amanhã" };
    expect(resumo({ ...d, precisaFatura: true })).toContain("Fatura: com NIF");
    expect(resumo({ ...d, precisaFatura: false })).toContain("Fatura: sem NIF");
    expect(resumo({ ...d, precisaFatura: false })).not.toMatch(/IVA de 23/);
  });

  it("e tem tradução fixa nas três línguas", () => {
    for (const l of ["en", "fr", "es"] as const) {
      expect(traducaoFixa(PERGUNTA_DA_FATURA, l)).toBeTruthy();
      expect(traducaoFixa(fraseDoValorFechado("esvaziamento_casa"), l)).toBeTruthy();
    }
  });
});

describe("o valor fechado", () => {
  it("lê-se o pedido, e responde-se com a frase única da base total (d63)", () => {
    expect(pedeValorFechado(INDIFERENTE)).toBe(true);
    expect(pedeValorFechado("Quero um preço fechado")).toBe(true);
    expect(pedeValorFechado("Sem surpresas no dia, por favor")).toBe(true);
    expect(pedeValorFechado("Quanto custa?")).toBe(false);
    expect(fraseDoValorFechado("esvaziamento_casa")).toBe(
      `Fica anotado que quer o valor total. O valor que lhe enviamos é o total do trabalho. ${fraseDaBase("total", "esvaziamento_casa")}`,
    );
    // Sem prometer mais do que a frase da base.
    expect(fraseDoValorFechado("esvaziamento_casa")).not.toMatch(/garant|nunca muda|sem alterações/i);
  });

  it("anota-se uma vez só", () => {
    const r: RespostaDaRecolha = { estado: noAndar(), resposta: "Para quando precisa?" };
    const um = comOValorFechado(r, INDIFERENTE);
    const dois = comOValorFechado(um, INDIFERENTE);
    expect(dois.estado.dados.notas).toEqual([NOTA_DO_VALOR_FECHADO]);
    expect(dois.resposta).toBe(um.resposta);
  });
});

describe("quem chama", () => {
  const NEG = readFileSync(join(__dirname, "whatsapp-negociacao.ts"), "utf8");
  const PARADAS = readFileSync(join(__dirname, "recolhas-paradas.ts"), "utf8");
  it("a recolha usa a pergunta em cima, o não repetir com a mensagem de agora, e o valor fechado", () => {
    expect(NEG).toContain("naPerguntaEmCima(estado, fio)");
    expect(NEG).toContain("fio, texto)");
    expect(NEG).toContain("comOValorFechado(");
  });
  it("o salto dos 10 minutos também não cai numa pergunta já respondida", () => {
    expect(PARADAS).toContain("semRepetirAPergunta(saltarAPergunta(estado), fio)");
  });
});
