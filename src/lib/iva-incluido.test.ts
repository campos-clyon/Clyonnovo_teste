import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IVA_INCLUIDO_DESDE,
  IVA_INCLUIDO_DESDE_POR_EXTENSO,
  etiquetaDoPreco,
  modeloDaNegociacao,
  modeloDeHoje,
} from "./iva-incluido";
import {
  baseDoPrecoDoCliente,
  precoDoCliente,
  precoParaOCliente,
  precoPossivel,
  valorDaPropostaDoCliente,
} from "./preco-do-cliente";
import { comissaoDaClyon, quantoOProfissionalRecebe, type Taxas } from "./taxas-plataforma";
import { quotaDaClyon } from "./quota-da-clyon";
import {
  dividaDoProfissional,
  temDividaDoProfissional,
  valorEmNumerario,
} from "./divida-do-profissional";
import { excedeONumerario, taxasParaAForma, formaEmPalavras } from "./forma-de-pagamento";
import { quantoOClientePaga, quantoSePedeNesteTrabalho } from "./eupago";
import { aPagarAClyonDe, carteiraDe, dividasDe, type TrabalhoNaCarteira } from "./carteira";
import { faseDoDinheiro, ladoDoCliente } from "./dinheiro-do-trabalho";
import { totalEmPalavras, comFacturaEmPalavras } from "./conta-em-palavras";
import { valorDoPagamento } from "./pagamento-declarado";
import { promessaDaForma } from "./pagamento-na-plataforma";
import { mensagemDaReferencia } from "./mensagem-da-referencia";
import { textoDoTrabalhoConfirmado } from "./email-proposta";
import { nifDaFactura } from "./pedido-valores";
import { FACTURA_EM_PALAVRAS, NA_PROPOSTA_COM_IVA, NOTA_DE_PRECO } from "./seo-data";

/**
 * PREÇOS COM IVA INCLUÍDO — decisão do dono, 01-10-2026.
 *
 * "Preços com IVA INCLUÍDO: o cliente vê um número só por proposta, já com a
 *  taxa da CLYON e com 23 % de IVA. Ex.: profissional propõe 350 € → cliente
 *  vê 452,03 € (350 × 1,05 = 367,50; × 1,23 = 452,03) → profissional recebe
 *  327,08 € (como hoje) → CLYON fica com a sua quota sobre a base sem IVA
 *  (como hoje) → os 23 % são IVA."
 *
 * "PAGAMENTO EM DINHEIRO: o cliente paga ao profissional, no local, o preço
 *  COM IVA; o profissional fica a DEVER à CLYON o IVA + a comissão, e paga essa
 *  dívida por referência MB WAY/Multibanco, gerada quando o trabalho em
 *  dinheiro é confirmado."
 *
 * "TRANSIÇÃO: negociações abertas antes da entrada em vigor ficam no modelo
 *  antigo, para ninguém ver um preço mudar a meio."
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const NOVAS: Taxas = { cliente: 0.05, profissional: 0.0655 };
const COM = "iva_incluido" as const;
const DEPOIS = new Date("2026-10-05T10:00:00Z");
const ANTES = new Date("2026-09-28T10:00:00Z");

describe("o exemplo do dono, ao cêntimo", () => {
  it("350 € do profissional → o cliente vê 452,03 € → o profissional recebe 327,08 €", () => {
    const p = precoDoCliente(350, NOVAS, COM);
    expect(p.semIva).toBe(367.5);
    expect(p.iva).toBe(84.53);
    expect(p.total).toBe(452.03);
    expect(p.aPagar).toBe(452.03);
    expect(p.ivaIncluido).toBe(true);
    expect(precoParaOCliente(350, NOVAS, COM)).toBe(452.03);
    // Do lado do profissional nada muda.
    expect(quantoOProfissionalRecebe(350, NOVAS)).toBe(327.08);
  });

  it("a CLYON fica com a quota dela sobre a base SEM IVA — como hoje", () => {
    expect(comissaoDaClyon(350, NOVAS)).toBe(40.42);
    expect(Math.round(quotaDaClyon(NOVAS) * 10000) / 100).toBe(11);
  });

  it("antes do corte, o mesmo valor continua a dizer-se 367,50 € sem IVA", () => {
    const p = precoDoCliente(350, NOVAS, "sem_iva");
    expect(p.aPagar).toBe(367.5);
    expect(p.ivaIncluido).toBe(false);
    expect(p.total).toBe(452.03);
  });
});

describe("a data de corte decide, pela abertura da negociação", () => {
  it("é meia-noite de Lisboa de 2 de outubro de 2026 — e os Termos dizem a mesma", () => {
    expect(IVA_INCLUIDO_DESDE.toISOString()).toBe("2026-10-01T23:00:00.000Z");
    expect(IVA_INCLUIDO_DESDE_POR_EXTENSO).toBe("2 de outubro de 2026");
  });

  it("antes do corte, sem IVA; a partir dele, IVA incluído", () => {
    expect(modeloDaNegociacao(ANTES)).toBe("sem_iva");
    expect(modeloDaNegociacao(DEPOIS)).toBe(COM);
    expect(modeloDaNegociacao(new Date("2026-10-01T22:59:59Z"))).toBe("sem_iva");
    expect(modeloDaNegociacao(new Date("2026-10-01T23:00:00Z"))).toBe(COM);
    // Como texto, como chega de um JSON.
    expect(modeloDaNegociacao("2026-10-05T10:00:00.000Z")).toBe(COM);
  });

  it("sem data, o modelo antigo — ninguém vê um preço subir por um campo em falta", () => {
    expect(modeloDaNegociacao(null)).toBe("sem_iva");
    expect(modeloDaNegociacao(undefined)).toBe("sem_iva");
    expect(modeloDaNegociacao("lixo")).toBe("sem_iva");
  });

  it("sem negociação nenhuma, vale o de hoje", () => {
    expect(modeloDeHoje(ANTES)).toBe("sem_iva");
    expect(modeloDeHoje(DEPOIS)).toBe(COM);
  });

  it("a etiqueta junto do número diz qual é", () => {
    expect(etiquetaDoPreco(COM)).toBe("IVA incluído");
    expect(etiquetaDoPreco("sem_iva")).toBe("sem IVA");
  });

  it("reabrir uma negociação renova-lhe a data — é uma negociação a nascer outra vez", () => {
    const db = ler("src/lib/db.ts");
    const i = db.indexOf("export async function criarNegociacao(");
    expect(i).toBeGreaterThan(-1);
    const corpo = db.slice(i, db.indexOf("\nexport ", i + 1));
    expect(corpo).toContain("createdAt = CURRENT_TIMESTAMP");
    expect(semComentarios(corpo)).toContain(
      "taxasParaAForma(forma, await taxasParaUmaNegociacaoNova(), modeloDeHoje())",
    );
  });
});

describe("o que o cliente escreve é um preço com IVA e taxa", () => {
  it("452,03 € voltam a ser os 350 € do profissional", () => {
    expect(baseDoPrecoDoCliente(452.03, NOVAS, COM)).toBe(350);
    expect(valorDaPropostaDoCliente({ preco: "452,03" }, NOVAS, COM)).toBe(350);
  });

  it("«posso pagar 450» — o valor do profissional que lhe dá 450 € ou o de baixo", () => {
    const base = baseDoPrecoDoCliente(450, NOVAS, COM)!;
    const ficou = precoParaOCliente(base, NOVAS, COM);
    expect(ficou).toBeLessThanOrEqual(450);
    expect(450 - ficou).toBeLessThan(0.035);
    // E um cêntimo a mais do profissional já passava dos 450 €.
    expect(precoParaOCliente(Math.round(base * 100 + 1) / 100, NOVAS, COM)).toBeGreaterThan(450);
    expect(precoPossivel(450, NOVAS, COM)).toBe(ficou);
  });

  it("nenhum preço sobe com a volta, e nenhum desce mais de três cêntimos", () => {
    for (let preco = 1; preco <= 3000; preco++) {
      const ficou = precoPossivel(preco, NOVAS, COM)!;
      expect(ficou, String(preco)).toBeLessThanOrEqual(preco);
      expect(preco - ficou, String(preco)).toBeLessThan(0.035);
    }
  });

  it("o ecrã antigo, que manda `valor`, continua a mandar o valor do profissional", () => {
    expect(valorDaPropostaDoCliente({ valor: "350" }, NOVAS, COM)).toBe(350);
  });
});

describe("o euPago pede o que o cliente leu — o total com IVA", () => {
  it("com IVA incluído, com ou sem a caixa da factura, é sempre o total", () => {
    expect(quantoOClientePaga(350, NOVAS, COM, false)).toBe(452.03);
    expect(quantoOClientePaga(350, NOVAS, COM, true)).toBe(452.03);
    // Antes do corte, o de sempre.
    expect(quantoOClientePaga(350, NOVAS, "sem_iva", false)).toBe(367.5);
    expect(quantoOClientePaga(350, NOVAS, "sem_iva", true)).toBe(452.03);
  });

  it("pela plataforma quem paga é o cliente; em dinheiro com IVA, o profissional", () => {
    const t = { acordado: 350, taxas: NOVAS, acrescimo: 0, modelo: COM };
    expect(quantoSePedeNesteTrabalho({ ...t, formaDePagamento: "na_plataforma" }, false)).toEqual({
      valor: 452.03,
      quemPaga: "cliente",
    });
    expect(quantoSePedeNesteTrabalho({ ...t, formaDePagamento: "dinheiro" }, false)).toEqual({
      valor: 124.95,
      quemPaga: "profissional",
    });
    // Em dinheiro antes do corte: a parte da CLYON, ao cliente, como desde 21-09-2026.
    const antigas = taxasParaAForma("dinheiro", NOVAS, "sem_iva");
    expect(
      quantoSePedeNesteTrabalho(
        { acordado: 350, taxas: antigas, acrescimo: 0, modelo: "sem_iva", formaDePagamento: "dinheiro" },
        false,
      ),
    ).toEqual({ valor: 40.43, quemPaga: "cliente" });
  });

  it("os Pagamentos, com IVA incluído, contam sempre o total", () => {
    const c = precoDoCliente(350, NOVAS, COM);
    expect(valorDoPagamento(c, "sem_factura", COM)).toBe(452.03);
    expect(valorDoPagamento(c, null, COM)).toBe(452.03);
    expect(valorDoPagamento(c, "sem_factura", "sem_iva")).toBe(367.5);
  });
});

describe("em dinheiro: o cliente paga 452,03 € ao profissional, e ele deve 124,95 € à CLYON", () => {
  it("as taxas gravadas em dinheiro passam a ser as de sempre (com IVA incluído)", () => {
    expect(taxasParaAForma("dinheiro", NOVAS, COM)).toEqual(NOVAS);
    expect(taxasParaAForma("dinheiro", NOVAS, "sem_iva")).toEqual({ cliente: 0.1155, profissional: 0 });
    expect(taxasParaAForma("na_plataforma", NOVAS, COM)).toEqual(NOVAS);
  });

  it("a conta da dívida: IVA 84,53 € + comissão 40,42 € = 124,95 €", () => {
    const d = dividaDoProfissional(350, NOVAS);
    expect(d.recebidoDoCliente).toBe(452.03);
    expect(d.liquido).toBe(327.08);
    expect(d.iva).toBe(84.53);
    expect(d.comissao).toBe(40.42);
    expect(d.total).toBe(124.95);
    /*
     * O dono escreveu 124,96 € (40,43 € = 11 % de 367,50 €, arredondado para
     * cima). A comissão de sempre é 367,50 − 327,08 = 40,42 €, e com 124,96 €
     * o profissional ficava com 327,07 € em vez dos 327,08 € que lê em todos
     * os ecrãs. Ver a nota em `divida-do-profissional.ts`.
     */
  });

  it("ao cêntimo, sempre: o que o cliente deu = o líquido dele + o que deve à CLYON", () => {
    for (let c = 1000; c <= 300000; c += 37) {
      const v = c / 100;
      const d = dividaDoProfissional(v, NOVAS);
      expect(Math.round((d.liquido + d.total) * 100), String(v)).toBe(Math.round(d.recebidoDoCliente * 100));
      expect(Math.round((d.iva + d.comissao) * 100), String(v)).toBe(Math.round(d.total * 100));
    }
  });

  it("só há dívida em dinheiro e com IVA incluído", () => {
    expect(temDividaDoProfissional("dinheiro", COM)).toBe(true);
    expect(temDividaDoProfissional("dinheiro", "sem_iva")).toBe(false);
    expect(temDividaDoProfissional("na_plataforma", COM)).toBe(false);
    expect(temDividaDoProfissional(null, COM)).toBe(false);
  });

  it("o tecto do numerário mede o que passa de mão em mão — com IVA", () => {
    expect(valorEmNumerario(2500, NOVAS, COM)).toBe(3228.75);
    expect(excedeONumerario(valorEmNumerario(2500, NOVAS, COM))).toBe(true);
    expect(valorEmNumerario(2500, NOVAS, "sem_iva")).toBe(2500);
    expect(excedeONumerario(valorEmNumerario(2500, NOVAS, "sem_iva"))).toBe(false);
  });

  it("o que se diz ao cliente: uma entrega só, ao profissional, com IVA", () => {
    expect(formaEmPalavras("dinheiro", COM).cliente).toContain("já com IVA");
    expect(formaEmPalavras("dinheiro", COM).cliente).not.toContain("referência");
    expect(formaEmPalavras("dinheiro", "sem_iva").cliente).toContain("por referência");
    expect(totalEmPalavras(350, COM, NOVAS, "dinheiro")).toContain("pago em dinheiro ao profissional");
    expect(totalEmPalavras(350, COM, NOVAS, "dinheiro")).not.toContain("referência");
    expect(promessaDaForma("dinheiro", COM).whatsappAntesDeAceitar).toBe(
      formaEmPalavras("dinheiro", COM).cliente,
    );
    expect(promessaDaForma("dinheiro", "sem_iva").whatsappAntesDeAceitar).toBe(
      formaEmPalavras("dinheiro", "sem_iva").cliente,
    );
  });

  it("e ao profissional: recebe com IVA, entrega o IVA e a comissão por referência", () => {
    const p = formaEmPalavras("dinheiro", COM).profissional;
    expect(p).toContain("preço com IVA");
    expect(p).toContain("referência MB WAY ou Multibanco");
    expect(promessaDaForma("dinheiro", COM).proAoFechar).toContain(p);
  });
});

describe("a carteira do profissional: «A pagar à CLYON»", () => {
  const agora = new Date("2026-10-20T12:00:00Z");
  const emDinheiro = (p: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira => ({
    negociacaoId: 7,
    estado: "acordada",
    valorAcordado: 350,
    formaDePagamento: "dinheiro",
    taxaCliente: "0.0500",
    taxaProfissional: "0.0655",
    negociacaoCriadaEm: DEPOIS,
    execucaoEnviadaEm: new Date("2026-10-10T10:00:00Z"),
    confirmadoEm: new Date("2026-10-11T10:00:00Z"),
    ...p,
  });

  it("feito e por pagar: deve 124,95 € — e o recebido em mão é o líquido dele", () => {
    const t = [emDinheiro()];
    expect(aPagarAClyonDe(t, agora)).toBe(124.95);
    expect(dividasDe(t, agora)).toEqual([
      {
        negociacaoId: 7,
        total: 124.95,
        iva: 84.53,
        comissao: 40.42,
        recebidoDoCliente: 452.03,
        paga: false,
        // 01-10-2026, «abater no saldo + bloquear»: se foi paga com o saldo, e
        // quando nasceu (a confirmação) — é daí que se conta o prazo.
        abatida: false,
        abatidaNoLevantamento: null,
        nasceuEm: new Date("2026-10-11T10:00:00Z"),
      },
    ]);
    const c = carteiraDe(t, [], agora);
    expect(c.recebidoEmMao).toBe(327.08);
    // A dívida não mexe no disponível nem em mais nenhum número da carteira.
    expect(c.disponivel).toBe(0);
    expect(c.porCobrar).toBe(0);
  });

  it("paga a referência, deixa de dever", () => {
    expect(aPagarAClyonDe([emDinheiro({ dividaPagaEm: agora })], agora)).toBe(0);
  });

  it("por fazer ainda não deve nada — o cliente ainda não lhe pagou", () => {
    expect(aPagarAClyonDe([emDinheiro({ confirmadoEm: null, execucaoEnviadaEm: null })], agora)).toBe(0);
  });

  it("pelo prazo dos sete dias também — é confirmado como outro qualquer", () => {
    const peloPrazo = emDinheiro({ confirmadoEm: null, execucaoEnviadaEm: new Date("2026-10-01T23:30:00Z") });
    expect(aPagarAClyonDe([peloPrazo], agora)).toBe(124.95);
  });

  it("antes do corte não há dívida nenhuma — o cliente pagou a taxa por referência", () => {
    expect(
      aPagarAClyonDe(
        [emDinheiro({ negociacaoCriadaEm: ANTES, taxaCliente: "0.1155", taxaProfissional: "0.0000" })],
        agora,
      ),
    ).toBe(0);
  });

  it("e os Pagamentos do backoffice põem-na «por receber» até ele pagar", () => {
    const base = { formaDePagamento: "dinheiro", confirmadoEm: agora, dividaDoProfissional: 124.95 };
    expect(faseDoDinheiro(base)).toBe("a_receber");
    expect(ladoDoCliente(base)).toBe("por_receber");
    expect(faseDoDinheiro({ ...base, clientePagouEm: agora })).toBe("fechado");
    expect(ladoDoCliente({ ...base, clientePagouEm: agora })).toBe("recebido");
    // Sem dívida (antes do corte), o dinheiro em mão fecha-se com a confirmação.
    expect(faseDoDinheiro({ formaDePagamento: "dinheiro", confirmadoEm: agora })).toBe("fechado");
  });
});

describe("a referência e o email do profissional", () => {
  it("a mensagem diz o que a referência paga — não o trabalho dele", () => {
    const m = mensagemDaReferencia({
      pedidoId: 412,
      metodo: "multibanco",
      valor: 124.95,
      entidade: "12345",
      referencia: "123 456 789",
      cliente: "Rui Costa",
      paraOProfissional: true,
      comFactura: true,
    });
    expect(m).toContain("o IVA e a comissão da CLYON do pedido #412");
    expect(m).toContain("Valor: 124,95 €");
    expect(m).toContain("Boa tarde, Rui!");
    // A factura é da venda ao cliente; não se fala dela ao profissional.
    expect(m).not.toContain("Este valor já inclui");
  });

  it("o email da confirmação traz a conta e a referência", () => {
    const t = textoDoTrabalhoConfirmado({
      pedidoId: 412,
      liquido: 327.08,
      destino: "em_mao",
      divida: {
        recebidoDoCliente: 452.03,
        iva: 84.53,
        comissao: 40.42,
        total: 124.95,
        referencia: { entidade: "12345", referencia: "123456789", expiraEm: new Date("2026-10-14T12:00:00Z") },
      },
    });
    expect(t.assunto).toContain("entregue à CLYON o IVA e a comissão");
    expect(t.corpo).toContain("452,03 €");
    expect(t.corpo).toContain("327,08 €");
    expect(t.corpo).toContain("124,95 €");
    expect(t.corpo).toContain("84,53 € de IVA");
    expect(t.corpo).toContain("Referência <strong>123456789</strong>");
    expect(t.corpo).toContain("«A pagar à CLYON»");
  });

  it("sem referência (euPago em baixo), manda-o à carteira", () => {
    const t = textoDoTrabalhoConfirmado({
      pedidoId: 412,
      liquido: 327.08,
      destino: "em_mao",
      divida: { recebidoDoCliente: 452.03, iva: 84.53, comissao: 40.42, total: 124.95, referencia: null },
    });
    expect(t.corpo).toContain("está na sua carteira");
  });
});

describe("as frases do preço", () => {
  it("com IVA incluído não há linha «com factura acrescem»", () => {
    expect(comFacturaEmPalavras(350, COM, NOVAS)).toBe("");
    expect(totalEmPalavras(350, COM, NOVAS)).toBe("Valor com IVA incluído.");
    expect(totalEmPalavras(350, COM, NOVAS, "na_plataforma", "carga")).toBe(
      "Valor por carga, com IVA incluído.",
    );
    // Antes do corte, a de sempre.
    expect(comFacturaEmPalavras(350, "sem_iva", NOVAS)).toBe("Com factura acrescem 23 % de IVA: 452,03 €.");
  });
});

describe("o pedido: sai «precisa de factura?», fica o NIF", () => {
  it("o NIF guarda-se com nove dígitos, ou não se guarda", () => {
    expect(nifDaFactura("123456789")).toBe("123456789");
    expect(nifDaFactura("123 456 789")).toBe("123456789");
    expect(nifDaFactura(123456789)).toBe("123456789");
    expect(nifDaFactura("12345")).toBeNull();
    expect(nifDaFactura("")).toBeNull();
    expect(nifDaFactura(undefined)).toBeNull();
  });

  it("nenhum formulário diz que com factura o preço sobe", () => {
    for (const f of [
      "src/app/plataforma/pedir/components/ValoresEFaturacao.tsx",
      "src/app/simulador/SimulatorThreePhaseForm.tsx",
    ]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).not.toContain("acrescem 23 %");
      expect(codigo, f).toContain("NIF na factura");
    }
    expect(semComentarios(ler("src/lib/whatsapp-recolha.ts"))).not.toMatch(/SE_PEDIR_FACTURA =[^;]*acrescem/);
  });

  it("o NIF sai com o resto ao apagar a conta do cliente", () => {
    expect(ler("src/lib/db.ts")).toContain("ALTER TABLE simulatorOrders ADD COLUMN nifFactura");
    expect(ler("src/lib/db.ts")).toMatch(/contactEmail = NULL,\s*nifFactura = NULL/);
  });
});

describe("os textos públicos", () => {
  it("os preços de referência ficam sem IVA, com a nota do dono", () => {
    expect(NA_PROPOSTA_COM_IVA).toBe("Na proposta, o preço já vem com IVA incluído.");
    expect(NOTA_DE_PRECO.curta).toContain("Valores orientativos, sem IVA.");
    expect(NOTA_DE_PRECO.curta).toContain(NA_PROPOSTA_COM_IVA);
    expect(NOTA_DE_PRECO.completa).toContain(NA_PROPOSTA_COM_IVA);
    expect(FACTURA_EM_PALAVRAS).toContain("com IVA incluído");
    expect(FACTURA_EM_PALAVRAS).toContain("Há factura em todas as vendas");
    expect(FACTURA_EM_PALAVRAS).not.toContain("Se pedir factura, acrescem");
  });

  it("os Termos dizem o modelo novo e a frase de transição do dono", () => {
    const T = semComentarios(ler("src/app/termos/page.tsx"));
    expect(T).toMatch(/O preço de cada proposta é o que o cliente paga pelo trabalho, com\s+IVA incluído/);
    expect(T).toMatch(/Para pedidos com negociação aberta antes de \{IVA_INCLUIDO_DESDE_POR_EXTENSO\}/);
    expect(T).toMatch(/aplica-se o regime anterior: preço sem IVA e IVA só com factura\./);
    expect(T).toContain("Há factura em todas as vendas.");
  });
});

describe("as peças estão ligadas", () => {
  it("a confirmação gera a referência da dívida ANTES do email — nos quatro caminhos", () => {
    const AVISO = semComentarios(ler("src/lib/avisar-confirmacao.ts"));
    const gera = AVISO.indexOf("gerarReferenciaDaDivida(dados.negociacaoId");
    const email = AVISO.indexOf("await avisarTrabalhoConfirmado(");
    expect(gera).toBeGreaterThan(-1);
    expect(email).toBeGreaterThan(gera);
    for (const f of [
      "src/app/api/negociacao/[token]/route.ts",
      "src/app/api/users/me/negociacao/route.ts",
      "src/app/api/admin/negociacoes/agir/route.ts",
      "src/app/api/cron/libertar-por-prazo/route.ts",
    ]) {
      expect(ler(f), f).toContain("avisarProfissionalTrabalhoConfirmado(");
    }
  });

  it("a referência da dívida só se gera depois de feito, e a porta é a do backoffice", () => {
    const C = semComentarios(ler("src/lib/cobrar-divida-do-profissional.ts"));
    expect(C).toContain("if (!t.libertado)");
    expect(C).toContain("podeCobrarPeloBackoffice(conf.config)");
    expect(C).not.toContain("A_PLATAFORMA_COBRA");
  });

  it("o profissional só pede a referência de um trabalho dele", () => {
    const R = semComentarios(ler("src/app/api/profissionais/divida/route.ts"));
    expect(R).toContain("Number(linhas[0].providerId) !== sessao.providerId");
  });

  it("o cliente em dinheiro com IVA incluído não tem caixa de pagamento", () => {
    const R = semComentarios(ler("src/app/api/pagamentos/route.ts"));
    expect(R).toContain("!temDividaDoProfissional(acesso.trabalho.formaDePagamento, acesso.trabalho.modelo)");
    expect(R).toContain("if (temDividaDoProfissional(t.formaDePagamento, t.modelo))");
  });

  it("as consultas que decidem o preço lêem a data de abertura", () => {
    for (const [f, txt] of [
      ["src/app/api/admin/carteiras/route.ts", "n.createdAt AS negociacaoCriadaEm"],
      ["src/app/api/admin/pagamentos/route.ts", "n.createdAt AS negociacaoCriadaEm"],
      ["src/app/api/admin/pagamentos/recebido/route.ts", "n.createdAt"],
      ["src/app/api/admin/negociacoes/valor/route.ts", "n.createdAt"],
      ["src/app/api/users/me/orders/route.ts", "n.createdAt"],
      ["src/lib/db.ts", "n.createdAt AS criadaEm,"],
    ] as const) {
      expect(ler(f), f).toContain(txt);
    }
  });
});
