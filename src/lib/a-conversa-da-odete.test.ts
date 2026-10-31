import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  disseQueMandouFotografias,
  mensagemDePedidoRegistado,
  perguntaDo,
  recolhaNova,
  responderNaRecolha,
  resumo,
  type DadosDaRecolha,
  type EstadoDaRecolha,
} from "./whatsapp-recolha";
import { DESCRICAO_DAS_FOTOS } from "./leitor-da-recolha";
import { passoDaPergunta } from "./reler-a-conversa";

/**
 * A CONVERSA DA ODETE — 17-10-2026, pedido #446.
 *
 * O caso é verdadeiro; o nome, a morada, o código postal e a hora são
 * INVENTADOS (o repositório é público — 31-10-2026, d1).
 *
 * Abriu com duas fotografias de sacos de entulho e «Bom dia, no seguimento de
 * conversa telefónica, envio abaixo as fotos do entulho, para pedido de
 * orçamento.» Respondeu a tudo à primeira. E depois:
 *
 *   CLYON:   Perfeito, fica anotado. Deseja factura?
 *   ODETE:  Pode ser.
 *   …                (chega a proposta: 150,00 € + IVA = 184,50 €)
 *   ODETE:  Sem fatura é o mesmo valor?
 *
 * O dono: «quero que essa resposta venha com a % do IVA que será aplicado —
 * "Deseja fatura? (aplica-se IVA de 23%)"; se notar mais melhorias, pode
 * aplicar». As que a conversa mostrou: o resumo dizia-lhe «Descrição: Ver as
 * fotografias enviadas pelo cliente.», a falar dela na terceira pessoa; e no
 * fim pediu-lhe as fotografias que ela tinha mandado na primeira mensagem —
 * ao pedido não chegou nenhuma, só a legenda.
 *
 * Pelo caminho sem o Gemini a conversa sai quase palavra por palavra a dela,
 * e mostrou mais uma: «Aproximadamente 30 sacos» ia para o «Entulho:» e
 * outra vez para a «Descrição:».
 *
 * Horas da captura menos uma (ver a memória «esta máquina não está em
 * Lisboa»): ela escreveu às 11:10 de Lisboa.
 */

const AGORA = new Date("2026-10-17T11:10:00+01:00");

/** O que a Odete respondeu a cada pergunta, com as palavras dela. */
const RESPOSTAS_DA_ODETE: Array<[RegExp, string]> = [
  [/Com quem (estou a falar|tenho o gosto)/, "Odete"],
  [/morada|rua e (do|o) número/i, "Ria Dona Brites de Valdeira,  Número 15, 1° Direito, 2845-322 Amora"],
  [/código postal/, "2845-322 Amora"],
  [/Em que andar/, "1° Direito"],
  [/elevador/, "Não tem elevador"],
  [/carrinha|estacionar/, "Consegue encostar,  caso  haja estacionamento"],
  [/quanto entulho/, "Aproximadamente 30 sacos, penso eu"],
  [/Para quando/, "Com a maior urgência possível. Se possível, ainda hoje."],
  [/fa(c)?tura/, "Pode ser."],
];

function falaComAOdete() {
  const disse: string[] = [];
  let estado: EstadoDaRecolha = recolhaNova();
  const dizer = (texto: string, jaCumprimentou: boolean) => {
    const r = responderNaRecolha(estado, texto, AGORA, jaCumprimentou);
    estado = r.estado;
    disse.push(r.resposta);
  };

  // A legenda das fotografias — as fotografias, essas, não chegaram.
  dizer(
    "Bom dia, no seguimento de conversa telefónica, envio abaixo as fotos do entulho, para pedido de orçamento.",
    false,
  );
  for (let volta = 0; volta < 15 && estado.passo !== "confirmar"; volta++) {
    const pergunta = disse[disse.length - 1];
    const resposta = RESPOSTAS_DA_ODETE.find(([re]) => re.test(pergunta))?.[1];
    if (!resposta) throw new Error(`A Odete não sabe responder a: ${pergunta}`);
    dizer(resposta, true);
  }
  return { estado, disse };
}

const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("a conversa da Odete: a fatura com o IVA que se aplica", () => {
  it("a pergunta diz o IVA, como o dono a escreveu", () => {
    const { disse } = falaComAOdete();
    const pergunta = disse.find((m) => /fatura/i.test(m) && !/Confirme/.test(m));
    expect(pergunta).toMatch(/Perfeito, fica anotado\. Deseja fatura\? \(aplica-se IVA de 23%\)$/);
    expect(perguntaDo("fatura", {})).toBe("Deseja fatura? (aplica-se IVA de 23%)");
  });

  it("«Pode ser» é um sim — e o resumo devolve-lhe o IVA ao lado do sim", () => {
    const { estado, disse } = falaComAOdete();
    expect(estado.passo).toBe("confirmar");
    expect(estado.dados.precisaFatura).toBe(true);
    expect(disse[disse.length - 1]).toContain("Fatura: sim (com IVA de 23%)");
    expect(resumo({ ...estado.dados, precisaFatura: false })).toContain("Fatura: não");
    expect(resumo({ ...estado.dados, precisaFatura: false })).not.toContain("IVA");
  });

  it("a pergunta nova reconhece-se no fio, como as antigas", () => {
    expect(passoDaPergunta("Perfeito, fica anotado. Deseja fatura? (aplica-se IVA de 23%)")).toBe("fatura");
    expect(passoDaPergunta("Perfeito, fica anotado. Deseja factura?")).toBe("fatura");
  });
});

describe("a conversa da Odete: as fotografias que ela mandou", () => {
  it("«envio abaixo as fotos» fica dito, mesmo depois de a quantidade ocupar a descrição", () => {
    const { estado } = falaComAOdete();
    expect(estado.dados.fotosDitas).toBe(true);
    expect(disseQueMandouFotografias(estado.dados)).toBe(true);
  });

  it("e por isso, no fim, não se lhe pedem outra vez", () => {
    const { estado } = falaComAOdete();
    const fim = mensagemDePedidoRegistado(446, disseQueMandouFotografias(estado.dados), estado.dados.contactName);
    expect(fim).toMatch(/^Pedido #446 registado! Muito obrigada, Odete\./);
    expect(fim).not.toContain("Se tiver fotografias");
    // A quem não disse nada de fotografias, continua a pedir-se.
    expect(mensagemDePedidoRegistado(447, disseQueMandouFotografias({}), "Rui")).toContain("Se tiver fotografias");
  });

  it("é a marca que vai para a mensagem do registo, ao lado das que chegaram", () => {
    const negociacao = semComentarios(readFileSync(join(process.cwd(), "src/lib/whatsapp-negociacao.ts"), "utf8"));
    // Desde 23-10-2026 o registo vive em `registarARecolha` — com o SIM, ou sozinho.
    expect(negociacao).toMatch(
      /const comFotos = fotosNoPedido > 0 \|\| \(opcoes\.fotosNaConversa \?\? 0\) > 0 \|\| disseQueMandouFotografias\(dados\);\s*await enviarTextoWhatsApp\(\s*telefone,\s*mensagemDePedidoRegistado\(id, comFotos,/,
    );
    expect(negociacao).toContain("await registarARecolha(telefone, r.estado.dados, { fotosNaConversa: fotos });");
  });

  it("o resumo fala com ela, e não dela", () => {
    const dados: DadosDaRecolha = {
      serviceType: "recolha_moveis",
      contactName: "Odete",
      description: DESCRICAO_DAS_FOTOS,
    };
    const r = resumo(dados);
    expect(r).toContain("Descrição: as fotografias que enviou");
    expect(r).not.toContain("pelo cliente");
  });

  it("e no entulho não repete a quantidade como descrição", () => {
    const { disse } = falaComAOdete();
    const r = disse[disse.length - 1];
    expect(r).toContain("Entulho: Aproximadamente 30 sacos, penso eu");
    expect(r).not.toContain("Descrição: Aproximadamente 30 sacos");
  });
});
