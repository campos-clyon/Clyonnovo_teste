import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HORAS_DE_LIMITE, MINUTOS_PARA_REGISTAR, MINUTOS_PARA_SALTAR, oQueFazerComARecolha } from "./recolhas-paradas";
import {
  explicarDeNovo,
  mensagemDePedidoRegistado,
  naoPercebeu,
  responderComCompreensao,
  responderNaRecolha,
  resumo,
  saltarAPergunta,
  SALTO_DA_PERGUNTA,
  type DadosDaRecolha,
} from "./whatsapp-recolha";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";

/**
 * AS RECOLHAS QUE PARAM, E OS TROPEÇÕES DA MAGDA — 23-10-2026.
 *
 * *«Se o cliente demorar mais de 10 minutos a responder a uma pergunta, que
 * ela passe para a próxima — já faça o que seria a próxima pergunta. E caso o
 * cliente não responda, não confirme os dados recolhidos no final do pedido,
 * que ele seja criado automaticamente após 30 minutos.»* — o dono.
 *
 * E na conversa da Magda (pedido #486): «Não entendi,» à pergunta da fatura
 * deu «Fatura: não» no resumo; «Não é uma casa completa» ficou anotado mas a
 * pergunta voltou seca; e «Quanto tempo para enviar o orçamento?» ficou sem
 * resposta.
 */

const MIN = 60;
const perguntaHa = (texto: string, segundos: number) => ({ direccao: "out", texto, haSegundos: segundos });
const MOVEIS: DadosDaRecolha = { serviceType: "recolha_moveis", contactName: "Magda Mota" };

describe("dez minutos sem resposta: passa-se à pergunta seguinte", () => {
  const naMorada = { passo: "morada" as const, dados: MOVEIS };

  it("aos 10 minutos salta; antes, espera", () => {
    expect(MINUTOS_PARA_SALTAR).toBe(10);
    expect(oQueFazerComARecolha(naMorada, perguntaHa("Qual é a morada?", 10 * MIN), SALTO_DA_PERGUNTA)).toBe("saltar");
    expect(oQueFazerComARecolha(naMorada, perguntaHa("Qual é a morada?", 9 * MIN), SALTO_DA_PERGUNTA)).toBe("nada");
  });

  it("a pergunta seguinte, com a morada e o código postal dela para depois", () => {
    const r = saltarAPergunta(naMorada);
    expect(r.resposta.startsWith(`${SALTO_DA_PERGUNTA} `)).toBe(true);
    expect(r.estado.dados.saltados).toEqual(["morada", "codigoPostal"]);
    expect(r.estado.passo).toBe("andar");
    expect(r.resposta).toContain("andar");
  });

  it("não salta duas seguidas — com o cliente calado, espera por ele", () => {
    const depois = saltarAPergunta(naMorada);
    expect(
      oQueFazerComARecolha(depois.estado, perguntaHa(depois.resposta, 15 * MIN), SALTO_DA_PERGUNTA),
    ).toBe("nada");
  });

  it("não salta o serviço, nem fala por cima da equipa, nem de quem falou por último", () => {
    expect(oQueFazerComARecolha({ passo: "servico", dados: {} }, perguntaHa("Em que posso ajudar?", 20 * MIN), SALTO_DA_PERGUNTA)).toBe("nada");
    expect(oQueFazerComARecolha(naMorada, perguntaHa(`${MARCA_DE_MAO} já lhe ligo`, 20 * MIN), SALTO_DA_PERGUNTA)).toBe("nada");
    expect(oQueFazerComARecolha(naMorada, { direccao: "in", texto: "um momento", haSegundos: 20 * MIN }, SALTO_DA_PERGUNTA)).toBe("nada");
    expect(oQueFazerComARecolha(naMorada, null, SALTO_DA_PERGUNTA)).toBe("nada");
  });

  it("nem acorda conversas paradas há mais de 6 horas", () => {
    expect(HORAS_DE_LIMITE).toBe(6);
    expect(oQueFazerComARecolha(naMorada, perguntaHa("Qual é a morada?", 7 * 3600), SALTO_DA_PERGUNTA)).toBe("nada");
  });

  it("a fatura saltada fica «—» no resumo, e não «não»", () => {
    const r = saltarAPergunta({ passo: "fatura", dados: { ...MOVEIS, quandoTexto: "daqui a uma semana" } });
    expect(resumo(r.estado.dados)).toContain("Fatura: —");
  });
});

describe("trinta minutos sem resposta ao resumo: o pedido regista-se sozinho", () => {
  const noResumo = { passo: "confirmar" as const, dados: MOVEIS };

  it("aos 30 minutos regista; antes, espera", () => {
    expect(MINUTOS_PARA_REGISTAR).toBe(30);
    expect(oQueFazerComARecolha(noResumo, perguntaHa("Já tenho tudo, muito obrigada! Confirme…", 30 * MIN), SALTO_DA_PERGUNTA)).toBe("registar");
    expect(oQueFazerComARecolha(noResumo, perguntaHa("Já tenho tudo…", 29 * MIN), SALTO_DA_PERGUNTA)).toBe("nada");
  });

  it("e diz-lhe porquê — começando sempre por «Pedido #N registado»", () => {
    const m = mensagemDePedidoRegistado(486, true, "Magda Mota", true);
    expect(m).toMatch(/^Pedido #486 registado! Muito obrigada, Magda\.\n\nComo não recebi resposta ao resumo, registei-o/);
  });

  it("o registo é o mesmo do SIM, e fica no histórico que foi sozinho", () => {
    const NEG = readFileSync(join(process.cwd(), "src/lib/whatsapp-negociacao.ts"), "utf8");
    expect(NEG).toContain("await registarARecolha(telefone, r.estado.dados, { fotosNaConversa: fotos });");
    expect(NEG).toContain("Registado sozinho pela Vitória: o cliente não respondeu ao resumo em 30 minutos.");
    const PARADAS = readFileSync(join(process.cwd(), "src/lib/recolhas-paradas.ts"), "utf8");
    expect(PARADAS).toContain("await registarARecolha(telefone, estado.dados, { sozinho: true });");
    expect(PARADAS).toContain("if (!(await db.podeOWhatsAppFalarCom(telefone))) continue;");
    const CRON = readFileSync(join(process.cwd(), "src/app/api/cron/assistente/route.ts"), "utf8");
    expect(CRON).toContain("const paradas = await correrAsRecolhasParadas().catch((e) => {");
  });
});

describe("os tropeções da Magda", () => {
  const AGORA = new Date("2026-10-23T10:59:00+01:00");
  const naFatura = { passo: "fatura" as const, dados: { ...MOVEIS, quandoTexto: "daqui a uma semana" } };

  it("«Não entendi» não é «não»: explica-se outra vez, e não se grava nada", () => {
    for (const t of ["Não entendi,", "não percebi", "Não entendi o preço", "Como assim?", "nao estou a perceber"]) {
      expect(naoPercebeu(t), t).toBe(true);
    }
    for (const t of ["Não", "Não, obrigada", "não preciso"]) expect(naoPercebeu(t), t).toBe(false);
    const b = responderNaRecolha(naFatura, "Não entendi,", AGORA, true);
    expect(b.estado.dados.precisaFatura).toBeUndefined();
    expect(b.resposta).toBe(explicarDeNovo("fatura", naFatura.dados));
    expect(b.resposta).toContain("com fatura, ao valor aplica-se IVA de 23%");
    // E pelo Gemini, diga o modelo o que disser.
    const g = responderComCompreensao(naFatura, { intencao: "informar", campos: { fatura: "não" } }, AGORA, {
      texto: "Não entendi,",
      jaCumprimentou: true,
    });
    expect(g.estado.dados.precisaFatura).toBeUndefined();
  });

  it("o que disse fora da pergunta fica anotado — e diz-se que ficou", () => {
    const r = responderComCompreensao(
      { passo: "nome", dados: { serviceType: "recolha_moveis" } },
      { intencao: "informar", campos: { descricao: "Não é uma casa completa" } },
      AGORA,
      { texto: "Não é uma casa completa", jaCumprimentou: true },
    );
    expect(r.estado.passo).toBe("nome");
    expect(r.resposta).toBe("Obrigada, fica anotado. Com quem tenho o gosto de falar?");
  });

  it("«Quanto tempo para enviar o orçamento?» tem resposta no registo", () => {
    expect(mensagemDePedidoRegistado(486, true, "Magda Mota")).toContain(
      "as propostas chegam-lhe por aqui em menos de 6 horas",
    );
  });
});
