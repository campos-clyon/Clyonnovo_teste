import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { contaDoTrabalhoClyon, emEuros } from "./conta-do-pagamento";
import {
  LINK_POR_GERAR,
  comOLink,
  mensagemDosValoresParaPagamento,
  oQueNaoPodeIr,
} from "./valores-para-pagamento";
import { TELEFONE_DA_CLYON_NACIONAL } from "./telefone-da-clyon";

/*
 * «ENVIAR VALORES PARA PAGAMENTO» — 05-11-2026 (decisão d19). *«Temos que ter
 * um botão para enviar os valores finais para pagamento; nesse botão devem ir
 * os dados para pagamento e a mensagem.»* E, dos dados: *«Só o link da
 * CLYON»* — o dono.
 */

const ler = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const CARTAO = ler("src/components/admin/TrabalhoClyon.tsx");
const BOTAO = ler("src/components/admin/EnviarValoresParaPagamento.tsx");
const ROTA = ler("src/app/api/admin/trabalhos-clyon/route.ts");
const BLOCO = ROTA.slice(
  ROTA.indexOf('if (accao === "valores_para_pagamento")'),
  ROTA.indexOf('if (accao === "ja_enviei")'),
);

// Um trabalho como o #524: 725 € sem IVA, taxa de 15 %, o cliente paga 891,75 €.
const CONTA = contaDoTrabalhoClyon({ valorFixo: 725, taxa: 0.15, precoAoCliente: null }, false)!;
const LINK = "https://clyon.pt/pedido/abc123";
const AGORA = new Date("2026-11-05T10:00:00Z");
const MENSAGEM = mensagemDosValoresParaPagamento(
  {
    pedidoId: 524,
    cliente: "Ana Teste",
    servico: "recolha_monos",
    localidade: "Almada",
    quando: "2026-11-07T09:00:00Z",
    base: "total",
    conta: CONTA,
    link: LINK,
  },
  AGORA,
);

describe("a mensagem leva os valores da conta e o link", () => {
  it("a conta do exemplo é a do #524", () => {
    expect(CONTA.total).toBe(891.75);
    expect(CONTA.semIva).toBe(725);
    expect(CONTA.iva).toBe(166.75);
  });

  it("os três valores saem da conta em degraus, e o total é o número a pagar", () => {
    expect(MENSAGEM).toContain(`Valor sem IVA: ${emEuros(CONTA.semIva)}`);
    expect(MENSAGEM).toContain(`IVA (23 %): ${emEuros(CONTA.iva)}`);
    expect(MENSAGEM).toContain(`Total a pagar, com IVA: ${emEuros(CONTA.total)}`);
  });

  it("o serviço, o n.º do pedido e o dia", () => {
    expect(MENSAGEM).toContain("Pedido n.º 524");
    expect(MENSAGEM).toMatch(/Recolha de monos em Almada/i);
    expect(MENSAGEM).toContain("Dia 7 de novembro de 2026");
  });

  it("o link do pedido, com as formas de pagamento que lá estão", () => {
    expect(MENSAGEM).toContain(LINK);
    expect(MENSAGEM).toContain("MB WAY, por Multibanco ou por transferência");
  });

  it("na pré-visualização, o marcador do link — e o servidor troca-o", () => {
    const previa = mensagemDosValoresParaPagamento({ pedidoId: 1, cliente: null, servico: null, localidade: null, quando: null, conta: CONTA }, AGORA);
    expect(previa).toContain(LINK_POR_GERAR);
    expect(comOLink(previa, LINK)).toContain(LINK);
    expect(comOLink(previa, LINK)).not.toContain(LINK_POR_GERAR);
    // Apagado ao editar: o link vai no fim.
    expect(comOLink("Total 891,75 €", LINK)).toContain(LINK);
  });

  it("por carga, diz-se, como na proposta", () => {
    const porCarga = mensagemDosValoresParaPagamento(
      { pedidoId: 2, cliente: null, servico: null, localidade: null, quando: null, base: "carga", conta: CONTA, link: LINK },
      AGORA,
    );
    expect(porCarga).toContain(`${emEuros(CONTA.total)} por carga`);
    expect(porCarga).toContain("POR CARGA");
  });
});

describe("só o link da CLYON: nada de dados de pessoas", () => {
  it("a mensagem não tem IBAN, «Revolut» nem um telefone de pessoa", () => {
    // «Multibanco» tem «iban» lá dentro: procura-se a palavra.
    expect(MENSAGEM).not.toMatch(/(?<![a-z])IBAN(?![a-z])/i);
    expect(MENSAGEM).not.toMatch(/revolut/i);
    expect(MENSAGEM).not.toMatch(/(?<!\d)9[1236](\s?\d){7}(?!\d)/);
    expect(oQueNaoPodeIr(MENSAGEM)).toBeNull();
  });

  it("e o servidor recusa-os numa mensagem editada", () => {
    expect(oQueNaoPodeIr("IBAN PT50 0000 0000 0000")).not.toBeNull();
    expect(oQueNaoPodeIr("Pode pagar pelo Revolut")).not.toBeNull();
    expect(oQueNaoPodeIr("MB WAY para o 912 345 678")).not.toBeNull();
    expect(oQueNaoPodeIr("MB WAY para o +351 960000123")).not.toBeNull();
    // O da CLYON pode ir.
    expect(oQueNaoPodeIr(`Dúvidas: ${TELEFONE_DA_CLYON_NACIONAL}`)).toBeNull();
  });

  it("os Métodos de pagamento das Configs não entram", () => {
    expect(ler("src/lib/valores-para-pagamento.ts")).not.toContain("metodos-de-pagamento");
    expect(BOTAO).not.toContain("metodosDePagamento");
    expect(BLOCO).not.toContain("metodosDePagamento");
  });

  it("voz de plataforma: «parceiro», nunca «profissional»", () => {
    expect(MENSAGEM).toContain("parceiro");
    expect(MENSAGEM).not.toMatch(/profissional/i);
  });
});

describe("o botão, no lugar do «Enviar pela CLYON»", () => {
  it("o «Enviar pela CLYON» já não existe no cartão", () => {
    expect(CARTAO).not.toContain("Enviar pela CLYON");
    expect(CARTAO).not.toContain("onEnviarProposta");
    expect(BOTAO).toContain("Enviar valores para pagamento");
    expect(CARTAO).toContain("<EnviarValoresParaPagamento");
  });

  it("só com o valor final, quem o faz e o cliente ainda por pagar", () => {
    expect(CARTAO).toContain("a && conta && t.telefone && !a.clientePagouEm && !a.pagoEm");
  });

  it("a equipa vê a mensagem e pode editá-la antes de sair", () => {
    expect(BOTAO).toContain("<textarea");
    expect(BOTAO).toContain('accao: "valores_para_pagamento", texto');
  });
});

describe("o servidor: a conta dele, o mesmo caminho de envio, e o histórico", () => {
  it("a conta sai da base, e o total tem de estar na mensagem", () => {
    expect(BLOCO).toContain("contaDoTrabalhoClyon(");
    expect(BLOCO).toContain("texto.includes(emEuros(conta.total))");
  });

  it("não se manda a quem já pagou", () => {
    expect(BLOCO).toContain("neg.clientePagouEm || neg.pagoAoProfissionalEm");
  });

  it("sai pelo WhatsApp da CLYON, com o número bloqueado respeitado", () => {
    expect(BLOCO.indexOf("await numeroBloqueadoWhatsApp(")).toBeLessThan(BLOCO.indexOf("enviarTextoManualWhatsApp"));
    // (O primeiro «retomarNumeroWhatsApp» é o import: conta a chamada.)
    expect(BLOCO.indexOf("enviarTextoManualWhatsApp(")).toBeLessThan(BLOCO.indexOf("await retomarNumeroWhatsApp("));
    expect(BLOCO).toContain("linkParaQuemFechou(");
    expect(BLOCO).toContain("oQueNaoPodeIr(texto)");
  });

  it("fica no histórico do pedido: quem e o valor", () => {
    expect(BLOCO).toContain("appendOrderHistory(pedidoId, { type: \"note\", by: por, message: resumo })");
    expect(BLOCO).toContain("por ${quem}");
    expect(BLOCO).toContain("emEuros(conta.total)");
  });
});
