import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eDoNovoModelo, trabalhoClyonDoModeloAntigo, trabalhoClyonDoNovoModelo } from "./novo-modelo";
import { clientePagouOTrabalhoClyon, libertacaoMaisCedo, negociacaoNoNovoModelo } from "./taxa-a-passar-a-clyon";
import { botoesDaFaseDoTrabalhoClyon } from "./botoes-das-fases";
import { faltaPagarAoProfissional } from "./dinheiro-do-trabalho";
import { dividaACobrar } from "./pago-em-mao";
import { mensagemDeAdjudicacao, valorDoBlocoDoNovoModelo } from "./mensagem-de-adjudicacao";
import { TAXAS_DE_ORIGEM } from "./taxas-plataforma";

/*
 * d58 (CEO e dono, 17-11-2026) — UM TRABALHO CLYON QUE O CLIENTE JÁ PAGOU À
 * CLYON FICA NO MODELO ANTIGO, SEJA QUAL FOR A DATA.
 *
 * Um Trabalho CLYON criado depois de 15-11 cujo cliente pagou à CLYON (MB WAY)
 * mostrava a conta do modelo novo («o cliente paga ao profissional», «taxa por
 * receber do parceiro»). O dinheiro está com a CLYON: é a CLYON que paga ao
 * profissional. Números inventados; relógio: datas explícitas.
 */

const AGORA = new Date("2026-11-20T12:00:00Z");
const CRIADO_A_16 = "2026-11-16 10:00:00";
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

const CONFIRMADO = { confirmadoEm: new Date("2026-11-17T15:00:00Z"), pagoEm: null, execucaoEnviadaEm: new Date("2026-11-17T12:00:00Z") };
const mbwayDoCliente = {
  estado: "pago",
  metodo: "mbway",
  parte: "trabalho",
  criadoEm: new Date("2026-11-17T13:20:00Z"),
  pagoEm: new Date("2026-11-17T13:26:00Z"),
};
/** A referência da taxa do profissional no modelo de 15-11: nasce depois de libertado. */
const referenciaDoProfissional = {
  estado: "pago",
  metodo: "multibanco",
  parte: "trabalho",
  criadoEm: new Date("2026-11-17T15:00:05Z"),
  pagoEm: new Date("2026-11-18T09:00:00Z"),
};

describe("(1) a regra — o cliente pagou o Trabalho CLYON à CLYON", () => {
  it("o MB WAY do cliente antes de o trabalho se libertar conta", () => {
    expect(clientePagouOTrabalhoClyon([mbwayDoCliente], CONFIRMADO)?.toISOString()).toBe("2026-11-17T13:26:00.000Z");
  });

  it("a referência da taxa do profissional (criada depois de libertado) NÃO conta", () => {
    expect(clientePagouOTrabalhoClyon([referenciaDoProfissional], CONFIRMADO)).toBeNull();
  });

  it("transferência ou numerário anotados à mão contam; os do profissional («pro_*», abatimento, quitação, pago ao profissional) não", () => {
    const tarde = { estado: "pago", parte: "trabalho", criadoEm: new Date("2026-11-19T10:00:00Z"), pagoEm: new Date("2026-11-19T10:00:00Z") };
    expect(clientePagouOTrabalhoClyon([{ ...tarde, metodo: "transferencia" }], CONFIRMADO)).not.toBeNull();
    expect(clientePagouOTrabalhoClyon([{ ...tarde, metodo: "numerario" }], CONFIRMADO)).not.toBeNull();
    for (const metodo of ["pro_transferencia", "pro_mbway", "pro_numerario", "abatimento", "quitacao", "ao_profissional"]) {
      expect(clientePagouOTrabalhoClyon([{ ...tarde, metodo }], CONFIRMADO)).toBeNull();
    }
  });

  it("a parte «divida», um pendente ou um sem data não contam", () => {
    expect(clientePagouOTrabalhoClyon([{ ...mbwayDoCliente, parte: "divida" }], CONFIRMADO)).toBeNull();
    expect(clientePagouOTrabalhoClyon([{ ...mbwayDoCliente, estado: "pendente" }], CONFIRMADO)).toBeNull();
    expect(clientePagouOTrabalhoClyon([{ ...mbwayDoCliente, pagoEm: null }], CONFIRMADO)).toBeNull();
  });

  it("o limite é o mais cedo da libertação: a confirmação, o pagamento ao profissional, ou o prazo depois de dado por feito", () => {
    expect(libertacaoMaisCedo({})).toBeNull();
    expect(libertacaoMaisCedo(CONFIRMADO)?.toISOString()).toBe("2026-11-17T15:00:00.000Z");
    // Libertado pelo prazo (7 dias) e confirmado depois: o limite fica no prazo.
    expect(
      libertacaoMaisCedo({ execucaoEnviadaEm: "2026-11-16T10:00:00Z", confirmadoEm: "2026-11-25T10:00:00Z" })?.toISOString(),
    ).toBe("2026-11-23T10:00:00.000Z");
  });
});

describe("(2) criado a 16-11: com pagamento do cliente à CLYON → antigo; sem → novo", () => {
  it("as perguntas únicas do modelo", () => {
    const comPagamento = { ofertaClyon: "fixo", pedidoCriadoEm: CRIADO_A_16, clientePagouAClyonEm: mbwayDoCliente.pagoEm };
    const semPagamento = { ofertaClyon: "fixo", pedidoCriadoEm: CRIADO_A_16 };
    expect(trabalhoClyonDoModeloAntigo(comPagamento, AGORA)).toBe(true);
    expect(trabalhoClyonDoNovoModelo(comPagamento, AGORA)).toBe(false);
    expect(eDoNovoModelo(comPagamento, AGORA)).toBe(false);
    expect(trabalhoClyonDoModeloAntigo(semPagamento, AGORA)).toBe(false);
    expect(trabalhoClyonDoNovoModelo(semPagamento, AGORA)).toBe(true);
    expect(eDoNovoModelo(semPagamento, AGORA)).toBe(true);
  });

  it("com os pagamentos lidos (acesso ao pagamento, faturas, adjudicação, referências)", () => {
    const l = { ofertaClyon: "fixo", pedidoCriadoEm: CRIADO_A_16, fechadoEm: CONFIRMADO.confirmadoEm, trabalho: CONFIRMADO };
    expect(negociacaoNoNovoModelo(l, [mbwayDoCliente], AGORA)).toBe(false);
    expect(negociacaoNoNovoModelo(l, [], AGORA)).toBe(true);
    // O parceiro do modelo novo que já passou a taxa continua no novo.
    expect(negociacaoNoNovoModelo(l, [referenciaDoProfissional], AGORA)).toBe(true);
    // Uma negociação normal (sem Trabalho CLYON) não muda: um MB WAY depois do corte não a passa ao antigo.
    expect(negociacaoNoNovoModelo({ ...l, ofertaClyon: null }, [mbwayDoCliente], AGORA)).toBe(true);
  });

  it("no antigo: os botões do antigo, por pagar ao profissional, e sem cobrança ao profissional", () => {
    const b = botoesDaFaseDoTrabalhoClyon("confirmada", false);
    expect(b.valoresParaPagamento).toBe(true);
    expect(
      faltaPagarAoProfissional({ clientePagouEm: mbwayDoCliente.pagoEm, confirmadoEm: CONFIRMADO.confirmadoEm, comoEntrou: "mbway" }),
    ).toBe(true);
    // Sem dívida em dinheiro (o antigo) nem registo «pago ao profissional»: nada a cobrar ao profissional.
    expect(
      dividaACobrar(
        { negociacaoId: 1, formaDePagamento: null, dividaEmDinheiro: null, acordado: 100, taxas: TAXAS_DE_ORIGEM },
        [{ ...mbwayDoCliente, id: 1, valor: 123, valorPago: 123, trid: null } as never],
      ),
    ).toBeNull();
  });
});

describe("(3) todos os sítios que decidem o modelo do Trabalho CLYON perguntam o pagamento do cliente", () => {
  it("a base lê-o num sítio só (`trabalhosClyonDasNegociacoes`) e as listas passam-no", () => {
    expect(ler("src/lib/trabalho-clyon-na-base.ts")).toContain("clientePagouAClyonEm: clientePagouOTrabalhoClyon(");
    const servidor = ler("src/lib/novo-modelo-no-servidor.ts");
    expect(servidor.match(/clientePagouAClyonEm: (c|n)\.clientePagouAClyonEm \?\? null/g)?.length).toBe(3);
  });

  it("o cartão, a carteira (pagoPelaClyon), o acesso ao pagamento, as Carteiras, a vista do cliente e a retenção", () => {
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain("clientePagouAClyonEm: clientePagouAClyonEm(o)");
    expect(ler("src/lib/carteira-do-profissional.ts")).toContain(
      "pagoPelaClyon: trabalhoClyonDoModeloAntigo({ ofertaClyon: l.ofertaClyon, pedidoCriadoEm, clientePagouAClyonEm }, agora)",
    );
    expect(ler("src/lib/acesso-ao-pagamento.ts")).toContain("trabalho: linha,");
    expect(ler("src/app/api/admin/carteiras/route.ts")).toContain("(trabalhoClyon && !doNovoModelo.has(Number(l.negociacaoId)))");
    expect(ler("src/lib/negociacao-na-vista.ts")).toContain("clientePagouAClyonEm: (n.clientePagouAClyonEm as Date | string | null | undefined) ?? null");
    expect(ler("src/app/pedido/[token]/VistaDoPedido.tsx")).toContain("clientePagouAClyonEm,");
    expect(ler("src/lib/regras-novas-na-base.ts")).toContain("clientePagouAClyonEm: clientePagouOTrabalhoClyon(");
    expect(ler("src/lib/regras-novas-da-retencao.ts")).toContain("clientePagouAClyonEm: n.clientePagouAClyonEm ?? null");
  });
});

describe("(4) a mensagem de adjudicação do modelo novo", () => {
  const base = {
    cliente: "Cliente Teste",
    quando: null,
    servico: "recolha_monos",
    empresa: "Parceiro de Teste",
  };
  const formas = (novoModelo: Parameters<typeof valorDoBlocoDoNovoModelo>[0] & { formas: ["transferencia"] }) => ({
    comDadosDoDono: false,
    referencias: [],
    link: "https://clyon.pt/pedido/abc",
    novoModelo,
  });

  it("«Paga diretamente à empresa …», ou «ao parceiro» sem nome — nunca «a <nome>»", () => {
    const m = mensagemDeAdjudicacao({ ...base, formas: formas({ total: 123, semIva: 100, formas: ["transferencia"] }) }, AGORA);
    expect(m).toContain("Paga diretamente à empresa Parceiro de Teste, no fim do trabalho");
    const sem = mensagemDeAdjudicacao({ ...base, empresa: null, formas: formas({ total: 123, semIva: 100, formas: ["transferencia"] }) }, AGORA);
    expect(sem).toContain("Paga diretamente ao parceiro, no fim do trabalho");
    expect(m).not.toMatch(/Paga diretamente a [A-Z]/);
  });

  it("por carga, o valor é de uma carga, × o número de cargas", () => {
    expect(valorDoBlocoDoNovoModelo({ total: 123, semIva: 100, base: "carga" })).toBe(
      // d63: a frase única da base, com o exemplo das cargas.
      "O valor é 100 € + IVA (123 €) por carga. O número de cargas é confirmado consigo no local, pela equipa, antes de começar. Por exemplo: 1 carga = 123 €; 2 cargas = 246 €. Já com a taxa da plataforma.",
    );
    const m = mensagemDeAdjudicacao({ ...base, formas: formas({ total: 123, semIva: 100, base: "carga", formas: ["transferencia"] }) }, AGORA);
    expect(m).not.toContain("O total é");
  });

  it("por hora: o valor de uma hora e a estimativa; com as horas confirmadas, o total", () => {
    expect(
      valorDoBlocoDoNovoModelo({ total: 246, semIva: 200, base: "hora", porHora: { semIva: 50, total: 61.5 } }),
    ).toBe(
      "O valor é 50 €/h + IVA (61,50 €/h), com mínimo de 3 horas. As horas contam-se no dia e o total fica na folha que valida no fim. Já com a taxa da plataforma. A estimativa é 200 € + IVA = 246 €.",
    );
    expect(valorDoBlocoDoNovoModelo({ total: 246, semIva: 200, base: "hora", porHora: null })).toBe(
      "O total é 200 € + IVA = 246 €, já com a taxa da plataforma.",
    );
  });

  it("pelo trabalho todo, como sempre", () => {
    expect(valorDoBlocoDoNovoModelo({ total: 123, semIva: 100 })).toBe("O total é 100 € + IVA = 123 €, já com a taxa da plataforma.");
  });

  it("o servidor manda a base e, por hora com as horas por confirmar, o valor de uma hora", () => {
    const adj = ler("src/app/api/admin/negociacoes/adjudicacao/route.ts");
    expect(adj).toContain("base: lerBase(n.baseDoPreco),");
    expect(adj).toContain("acesso.trabalho.porHora && !acesso.trabalho.porHora.horasConfirmadas");
  });
});
