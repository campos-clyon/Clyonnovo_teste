import { afterEach, describe, it, expect } from "vitest";
import type { PedidoParaOAssistente } from "./db";
import { novidadesDoPedido } from "./assistente-automatico";
import { fraseDoLinkDoFecho } from "./link-de-quem-fecha-pelo-whatsapp";
import { respostaDoSiteOuDasLicoes, respostaPelasLicoes, licoesParaOModelo, type LicaoEmUso } from "./licoes-da-vitoria";
import { mensagemDasPropostas, propostasParaOCliente, trabalhoFechado } from "./mensagem-das-propostas";
import { oQueOSiteSabe } from "./o-que-o-site-sabe";
import {
  COMO_SE_PAGA_NO_WHATSAPP,
  OS_DADOS_DO_PARCEIRO_ESTAO_NO_PEDIDO,
  PAGA_AO_CONTRATADO,
  REGRAS_DO_PAGAMENTO_PARA_O_MODELO,
  SEM_PAGAMENTO_ADIANTADO,
} from "./o-pagamento-da-vitoria";
import { promessaDaForma } from "./pagamento-na-plataforma";
import { AS_DUAS_FATURAS, PAGA_DIRETAMENTE_AO_PARCEIRO } from "./pagar-ao-parceiro";
import { falaDoModeloAntigo } from "./palavras-do-modelo-antigo";
import { respostaFrequente } from "./perguntas-frequentes-da-vitoria";
import { COMO_SE_PAGA, FACTURA_EM_PALAVRAS, faturaEmPalavras } from "./seo-data";
import { QUEM_E_A_CLYON_NO_MODELO_ANTIGO, quemEACLYON } from "./whatsapp-compreensao";

/**
 * A VITÓRIA NO MODELO DE 15-11-2026 — d10 (CEO e dono, 12-11-2026).
 *
 * O teste da conversa, dos dois lados da data: até 14-11 diz o que diz hoje;
 * desde 15-11 explica que se paga ao parceiro, as duas faturas e que não há
 * nada adiantado — sem as palavras do modelo antigo (`palavras-do-modelo-antigo.ts`)
 * — e nunca diz o IBAN nem o MB WAY de um parceiro. Sem mensagens a ninguém.
 */

const ANTES = new Date("2026-11-14T23:59:00Z");
const DEPOIS = new Date("2026-11-15T10:00:00Z");

/** O que o cliente lê, sem nenhuma palavra do modelo antigo. */
const limpo = (texto: string) => expect(falaDoModeloAntigo(texto, "cliente")).toBeNull();

/** Um IBAN português ou um número de telemóvel escrito por extenso. */
const DADOS_DE_PAGAMENTO = /\bPT50\s?\d{4}|\b9[1236]\d[\s.]?\d{3}[\s.]?\d{3}\b/;

afterEach(() => {
  delete process.env.NOVO_MODELO_DATA_SIMULADA;
});

describe("«Como se paga?» — a frase pela data", () => {
  it("até 14-11, a de hoje", () => {
    expect(respostaFrequente("Como se paga?", ANTES)).toBe(COMO_SE_PAGA);
    expect(respostaFrequente("Posso pagar em dinheiro?", ANTES)).toBe(COMO_SE_PAGA);
  });

  it("desde 15-11: ao parceiro, as duas faturas, nada adiantado — e sem as palavras antigas", () => {
    for (const pergunta of ["Como se paga?", "Posso pagar em dinheiro?", "Aceitam MB Way?", "Quais são as formas de pagamento?"]) {
      const r = respostaFrequente(pergunta, DEPOIS)!;
      expect(r).toBe(COMO_SE_PAGA_NO_WHATSAPP);
      expect(r).toContain(PAGA_DIRETAMENTE_AO_PARCEIRO);
      expect(r).toContain(AS_DUAS_FATURAS);
      expect(r).toContain(SEM_PAGAMENTO_ADIANTADO);
      limpo(r);
    }
  });
});

describe("as perguntas do modelo novo — só desde 15-11", () => {
  it("a caução: até 14-11 vai para a equipa; desde 15-11 não há nada adiantado", () => {
    for (const pergunta of ["Tenho de pagar caução?", "É preciso deixar sinal?", "Pago adiantado?"]) {
      expect(respostaFrequente(pergunta, ANTES)).toBeNull();
      const r = respostaFrequente(pergunta, DEPOIS)!;
      expect(r).toContain(SEM_PAGAMENTO_ADIANTADO);
      expect(r).toContain(PAGA_DIRETAMENTE_AO_PARCEIRO);
      limpo(r);
    }
    // «sinal» sem pagar não é a caução.
    expect(respostaFrequente("Não tenho sinal aqui, ligo depois", DEPOIS)).toBeNull();
  });

  it("o IBAN e o MB WAY do parceiro: diz onde estão, e nunca os escreve", () => {
    for (const pergunta of ["Qual é o IBAN?", "Para que conta transfiro?", "Qual é o número de MB WAY dele?"]) {
      expect(respostaFrequente(pergunta, ANTES)).toBeNull();
      const r = respostaFrequente(pergunta, DEPOIS)!;
      expect(r).toContain(OS_DADOS_DO_PARCEIRO_ESTAO_NO_PEDIDO);
      expect(r).not.toMatch(DADOS_DE_PAGAMENTO);
      limpo(r);
    }
  });

  it("a fatura: desde 15-11, as duas", () => {
    expect(respostaFrequente("Passam fatura?", ANTES)).toBeNull();
    const r = respostaFrequente("Passam fatura?", DEPOIS)!;
    expect(r).toBe(faturaEmPalavras(DEPOIS));
    expect(r).toContain(AS_DUAS_FATURAS);
    expect(respostaFrequente("Quem emite a fatura?", DEPOIS)).toBe(faturaEmPalavras(DEPOIS));
    limpo(r);
  });
});

describe("o aviso ao modelo (o que o site sabe)", () => {
  it("até 14-11, o de hoje", () => {
    const t = oQueOSiteSabe(ANTES);
    expect(t).toContain(COMO_SE_PAGA);
    expect(t).toContain(FACTURA_EM_PALAVRAS);
    for (const r of REGRAS_DO_PAGAMENTO_PARA_O_MODELO) expect(t).not.toContain(r);
  });

  it("desde 15-11: o pagamento ao parceiro, as duas faturas, o IBAN só no pedido — sem as palavras antigas", () => {
    const t = oQueOSiteSabe(DEPOIS);
    expect(t).toContain(COMO_SE_PAGA_NO_WHATSAPP);
    expect(t).toContain(faturaEmPalavras(DEPOIS));
    for (const r of REGRAS_DO_PAGAMENTO_PARA_O_MODELO) expect(t).toContain(r);
    expect(t).not.toContain(COMO_SE_PAGA);
    limpo(t);
  });

  it("o que a CLYON é: até 14-11 guarda o pagamento; desde 15-11 o cliente paga ao parceiro", () => {
    expect(quemEACLYON(ANTES)).toBe(QUEM_E_A_CLYON_NO_MODELO_ANTIGO);
    expect(quemEACLYON(DEPOIS)).toMatch(/paga o trabalho diretamente ao parceiro/);
    expect(quemEACLYON(DEPOIS)).not.toMatch(/pagamento/);
    limpo(quemEACLYON(DEPOIS));
  });
});

describe("as lições que falam do dinheiro como antes", () => {
  const LICOES: LicaoEmUso[] = [
    {
      id: 1,
      pergunta: "Tenho de pagar a caução antes do trabalho?",
      respostaProposta: "Sim, paga a caução pela plataforma e o valor fica com a CLYON até confirmar.",
    } as LicaoEmUso,
    { id: 2, pergunta: "Levam também os cabides do roupeiro?", respostaProposta: "Levam, sim — diga-o no pedido." } as LicaoEmUso,
  ];

  it("até 14-11 valem; desde 15-11 a do dinheiro fica de fora, as outras continuam", () => {
    expect(respostaPelasLicoes("Tenho de pagar a caução antes do trabalho?", LICOES, ANTES)?.id).toBe(1);
    expect(respostaPelasLicoes("Tenho de pagar a caução antes do trabalho?", LICOES, DEPOIS)).toBeNull();
    expect(respostaPelasLicoes("Levam também os cabides do roupeiro?", LICOES, DEPOIS)?.id).toBe(2);
    expect(licoesParaOModelo(LICOES, ANTES)).toContain("caução");
    expect(licoesParaOModelo(LICOES, DEPOIS)).not.toContain("caução");
  });
});

describe("a data simulada — o relógio do modelo", () => {
  it("com NOVO_MODELO_DATA_SIMULADA a 15-11, a Vitória responde como a 15-11", () => {
    process.env.NOVO_MODELO_DATA_SIMULADA = "2026-11-15T10:00:00Z";
    const r = respostaDoSiteOuDasLicoes("Como é que se paga?", { contar: false })!;
    expect(r).toBe(COMO_SE_PAGA_NO_WHATSAPP);
    limpo(r);
    limpo(oQueOSiteSabe());
    process.env.NOVO_MODELO_DATA_SIMULADA = "2026-11-14T10:00:00Z";
    expect(respostaDoSiteOuDasLicoes("Como é que se paga?", { contar: false })).toBe(COMO_SE_PAGA);
  });
});

describe("as mensagens de um trabalho — o servidor diz o modelo", () => {
  it("promessaDaForma: no modelo novo, nada de referência para pagar à CLYON", () => {
    expect(promessaDaForma("na_plataforma", "iva_incluido").whatsappAntesDeAceitar).toMatch(/pagar à CLYON/);
    for (const forma of ["na_plataforma", "dinheiro"] as const) {
      const p = promessaDaForma(forma, "iva_incluido", true);
      limpo(p.whatsappAntesDeAceitar);
      limpo(p.whatsappConfirmar);
    }
  });

  it("o link do fecho: no modelo novo, ver como pagar ao parceiro — sem Multibanco", () => {
    const link = "https://clyon.pt/pedido/abc";
    expect(fraseDoLinkDoFecho("na_plataforma", link)).toMatch(/MB WAY ou Multibanco/);
    const novo = fraseDoLinkDoFecho("na_plataforma", link, true);
    expect(novo).not.toMatch(/Multibanco/);
    expect(novo).toMatch(/como pagar ao parceiro/);
    expect(novo).toContain(link);
    limpo(novo);
  });

  const NEG = {
    estado: "acordada",
    profissionalNome: "Fred",
    propostasJson: JSON.stringify([{ por: "profissional", valor: 200, criadaEm: "2026-11-15T09:00:00Z", estado: "aceite" }]),
    formaDePagamento: "na_plataforma",
    criadaEm: "2026-11-15T08:00:00Z",
  };
  const DADOS = { nomeCliente: "Ana Costa", servico: "Recolha de móveis", cidade: "Lisboa", propostas: [] };

  it("a mensagem do orçamento fechado: sem o servidor, a de hoje; no modelo novo, paga ao parceiro", () => {
    const hoje = mensagemDasPropostas({ ...DADOS, fechado: trabalhoFechado([NEG]) });
    expect(hoje).toMatch(/o parceiro só recebe depois dessa confirmação/);
    const novo = mensagemDasPropostas({ ...DADOS, fechado: trabalhoFechado([{ ...NEG, noNovoModelo: true }]) });
    expect(novo).toContain(PAGA_AO_CONTRATADO);
    expect(novo).not.toMatch(/o parceiro só recebe/);
    expect(novo).not.toMatch(DADOS_DE_PAGAMENTO);
    limpo(novo);
  });

  it("a lista de propostas: no modelo novo, diz que se paga ao parceiro", () => {
    const aberta = {
      ...NEG,
      estado: "aberta",
      propostasJson: JSON.stringify([{ por: "profissional", valor: 200, criadaEm: "2026-11-15T09:00:00Z", estado: "pendente" }]),
    };
    const hoje = mensagemDasPropostas({ ...DADOS, propostas: propostasParaOCliente([aberta]) });
    expect(hoje).not.toContain(PAGA_DIRETAMENTE_AO_PARCEIRO);
    const novo = mensagemDasPropostas({ ...DADOS, propostas: propostasParaOCliente([{ ...aberta, noNovoModelo: true }]) });
    expect(novo).toContain(PAGA_DIRETAMENTE_AO_PARCEIRO);
    limpo(novo);
  });
});

describe("o assistente automático — as novidades de um trabalho", () => {
  const TARDE = new Date("2026-11-16T14:00:00Z");
  function pedido(neg: Partial<PedidoParaOAssistente["negociacoes"][number]>): PedidoParaOAssistente {
    return {
      id: 901,
      contactName: "Ana Costa",
      contactPhone: "912345678",
      serviceType: "recolha_moveis",
      status: "atribuido",
      createdAt: new Date("2026-11-15T09:00:00Z"),
      dataAgendada: null,
      negociacoes: [
        {
          id: 88,
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
          actualizadaEm: new Date("2026-11-16T13:00:00Z"),
          criadaEm: new Date("2026-11-15T10:00:00Z"),
          formaDePagamento: "na_plataforma",
          ...neg,
        },
      ],
    };
  }
  const proposta = JSON.stringify([{ por: "profissional", valor: 150, criadaEm: "2026-11-16T13:00:00Z", estado: "pendente" }]);
  const texto = (p: PedidoParaOAssistente, especie: string) => novidadesDoPedido(p, TARDE).find((n) => n.especie === especie)?.texto ?? "";

  it("a proposta nova: sem a marca do servidor, a de hoje; no modelo novo, paga ao parceiro", () => {
    expect(texto(pedido({ propostasJson: proposta }), "proposta_nova")).toMatch(/pagar à CLYON/);
    const novo = texto(pedido({ propostasJson: proposta, noNovoModelo: true }), "proposta_nova");
    expect(novo).toContain(PAGA_DIRETAMENTE_AO_PARCEIRO);
    limpo(novo);
  });

  it("o fecho: no modelo novo, como paga, onde vê os dados dele, e as duas faturas", () => {
    const fechado = { estado: "acordada", valorAcordado: "200.00", propostasJson: proposta };
    expect(texto(pedido(fechado), "fechado")).not.toContain(PAGA_AO_CONTRATADO);
    for (const forma of ["na_plataforma", "dinheiro"]) {
      const novo = texto(pedido({ ...fechado, formaDePagamento: forma, noNovoModelo: true }), "fechado");
      expect(novo).toContain(PAGA_AO_CONTRATADO);
      expect(novo).not.toMatch(DADOS_DE_PAGAMENTO);
      limpo(novo);
    }
  });
});
