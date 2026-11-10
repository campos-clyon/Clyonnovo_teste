import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fraseDaParteDaClyon, monteNasCarteiras, taxaDoPagoEmMao } from "./a-quem-foi-o-dinheiro";
import {
  movimentosDaPlataforma,
  type PagamentoAoProfissional,
  type RecebimentoDaPlataforma,
} from "./financas";
import {
  fraseDaCorreccao,
  lerCorreccaoDoPagamento,
  planoDaCorreccao,
  valoresDeReferencia,
  type PagamentoRegistado,
} from "./corrigir-pagamento-registado";
import { contaFecha } from "./conta-do-pagamento";
import { aPagarAClyonDe, dividasDe, type TrabalhoNaCarteira } from "./carteira";
import { bloqueioEmDinheiro } from "./bloqueio-por-divida";
import { dividaACobrar, dividaDoRegistoEmMao, eLinhaDaDividaEmMao, tridDoAbatimentoAParte } from "./pago-em-mao";
import { daMesmaConta, eDoCliente, lerParte } from "./parte-do-pagamento";

/*
 * DINHEIRO: NÃO PAGAR DUAS VEZES E CONTAS CERTAS NOS PAGOS EM MÃO — 04-11-2026
 * (decisão d9, dono). Valores inventados, menos os três casos que a ordem deu
 * para se perceber o que se pede (sem nomes: o repositório é público).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

describe("1. Carteiras: um pago em mão nunca entra no «A pagar»", () => {
  const feito = { confirmadoEm: "2026-10-30T10:00:00Z", pagoEm: null };

  it("um Trabalho CLYON pago em mão ao profissional (registado nos Pagamentos) fica «em mão», não «por pagar»", () => {
    // Combinado pela plataforma, como os Trabalhos CLYON; o cliente pagou ao parceiro.
    expect(monteNasCarteiras({ formaDePagamento: null, comoEntrou: "ao_profissional", ...feito })).toBe("em_mao");
    expect(monteNasCarteiras({ formaDePagamento: "plataforma", comoEntrou: "ao_profissional", ...feito })).toBe("em_mao");
    // Por fazer também: nunca vai parar ao «A pagar».
    expect(monteNasCarteiras({ formaDePagamento: null, comoEntrou: "ao_profissional", confirmadoEm: null })).toBe("em_mao");
  });

  it("combinado em dinheiro, também em mão", () => {
    expect(monteNasCarteiras({ formaDePagamento: "dinheiro", comoEntrou: null, ...feito })).toBe("em_mao");
  });

  it("os que o cliente pagou à CLYON seguem como antes: por pagar, pago ou por finalizar", () => {
    for (const comoEntrou of ["mbway", "multibanco", "transferencia", "numerario", null]) {
      expect(monteNasCarteiras({ formaDePagamento: null, comoEntrou, ...feito }), String(comoEntrou)).toBe("por_pagar");
    }
    expect(monteNasCarteiras({ formaDePagamento: null, comoEntrou: "transferencia", confirmadoEm: "x", pagoEm: "y" })).toBe("pago");
    expect(monteNasCarteiras({ formaDePagamento: null, comoEntrou: "mbway", confirmadoEm: null, pagoEm: null })).toBe("por_finalizar");
  });

  it("a rota das Carteiras pergunta como o cliente pagou também nos Trabalhos CLYON, e decide o monte pela regra", () => {
    const rota = semComentarios(ler("src/app/api/admin/carteiras/route.ts"));
    expect(rota).toContain('.filter((l) => l.negociacaoId != null && lerForma(l.formaDePagamento) !== "dinheiro")');
    expect(rota).not.toMatch(/ofertaClyon !== ""\),\s*\)\s*\.map\(\(l\) => Number\(l\.negociacaoId\)\)/);
    expect(rota).toContain("const monte = monteNasCarteiras({");
    expect(rota).toContain('if (monte === "em_mao") {');
    // E o «Já paguei» das Carteiras recusa-o no servidor (como os Pagamentos).
    expect(rota).toContain("LEFT JOIN pagamentos pg ON pg.negociacaoPaga = n.id");
    expect(rota).toMatch(/monteNasCarteiras\(\{ formaDePagamento: linha\.formaDePagamento, comoEntrou: linha\.comoEntrou \}\) === "em_mao"/);
  });
});

describe("2. Finanças (gestora): o pago em mão não é despesa da CLYON", () => {
  const SISTEMA = { clientes: 30, dividas_dos_profissionais: 31, pagamentos_aos_profissionais: 32, comissoes_eupago: 33 } as const;
  const onde = { contaPlataforma: 1, contaCaixa: 2, categoria: (s: keyof typeof SISTEMA) => SISTEMA[s] };
  const pago = (p: Partial<PagamentoAoProfissional>): PagamentoAoProfissional => ({
    negociacaoId: 1,
    pedidoId: 101,
    pagoEm: new Date("2026-10-28T10:00:00Z"),
    recebe: 72.09,
    profissional: "Parceiro A",
    contaDeTeste: false,
    formaDoTrabalho: null,
    comoEntrou: "mbway",
    ...p,
  });

  it("um trabalho pago em mão e outro pago pela CLYON: só o segundo sai da conta", () => {
    const fora = movimentosDaPlataforma(
      {
        recebimentos: [],
        pagosAosProfissionais: [
          // O cliente pagou-lhe em mão (registado «pago ao profissional»), e o pagoEm ficou marcado.
          pago({ negociacaoId: 1, pedidoId: 101, recebe: 81, comoEntrou: "ao_profissional" }),
          // O cliente pagou à CLYON, e a CLYON transferiu-lhe.
          pago({ negociacaoId: 2, pedidoId: 102, recebe: 120, comoEntrou: "transferencia" }),
        ],
        levantamentos: [],
      },
      onde,
    );
    expect(fora.map((m) => [m.id, m.tipo, m.valor])).toEqual([["auto:pago:2", "despesa", 120]]);
  });

  it("combinado em dinheiro, como antes, também não", () => {
    const fora = movimentosDaPlataforma(
      { recebimentos: [], pagosAosProfissionais: [pago({ formaDoTrabalho: "dinheiro", comoEntrou: "multibanco" })], levantamentos: [] },
      onde,
    );
    expect(fora).toEqual([]);
  });

  it("a dívida de um pago em mão paga pela referência do euPago é o profissional a pagar à CLYON", () => {
    const r: RecebimentoDaPlataforma = {
      id: 9,
      pedidoId: 103,
      metodo: "multibanco",
      valor: 24.21,
      valorPago: 24.21,
      comissaoEupago: null,
      pagoEm: "2026-11-05 10:00:00",
      ambiente: "producao",
      deTeste: false,
      contaDeTeste: false,
      formaDoTrabalho: null,
      trid: tridDoAbatimentoAParte(77),
      cliente: "Cliente B",
      profissional: "Parceiro A",
    };
    const [m] = movimentosDaPlataforma({ recebimentos: [r], pagosAosProfissionais: [], levantamentos: [] }, onde);
    expect(m.categoriaId).toBe(SISTEMA.dividas_dos_profissionais);
    expect(m.descricao).toBe("IVA e taxa da plataforma de Parceiro A — #103 (Multibanco)");
    expect(eLinhaDaDividaEmMao("abatimento-mao-77")).toBe(true);
    expect(eLinhaDaDividaEmMao("1234567")).toBe(false);
  });

  it("a base lê o método do pagamento que fecha cada trabalho pago ao profissional", () => {
    const base = ler("src/lib/financas-na-base.ts");
    expect(base).toContain("pg.metodo AS comoEntrou");
    expect(base).toContain("LEFT JOIN pagamentos pg ON pg.negociacaoPaga = n.id");
    expect(base).toContain("comoEntrou: (l.comoEntrou as string) ?? null,");
    expect(semComentarios(ler("src/lib/financas.ts"))).toContain("if (foiPagoEmMaoPor(p.formaDoTrabalho, p.comoEntrou)) continue;");
  });
});

/*
 * O caso da ordem: «na plataforma», 71,20 € sem IVA a 11 %, registado «sem
 * fatura» a 71,20 € — mas o cliente pagou 87,58 € com IVA.
 */
const CASO_SEM_FACTURA_ERRADO: PagamentoRegistado = {
  linha: {
    valorAcordado: "71.20",
    taxaCliente: "0",
    taxaProfissional: "0.11",
    formaDePagamento: "plataforma",
    semFactura: 1,
    motivoSemFactura: "o cliente não quis fatura",
    pagamentoParaQue: null,
    negociacaoCriadaEm: "2026-11-02T09:00:00Z",
    ofertaClyon: null,
  },
  metodo: "ao_profissional",
  valor: 71.2,
  pagoAoProfissionalEm: null,
  dividaFechadaCom: null,
};

describe("3. corrigir um pagamento em mão já registado — a fatura e o valor, com motivo", () => {
  it("lê o pedido: fatura obrigatória, valor em euros (com vírgula), motivo obrigatório", () => {
    expect(lerCorreccaoDoPagamento({ semFactura: false, valor: "87,58", motivo: "Pagou com IVA" })).toEqual({
      ok: true,
      pedido: { semFactura: false, valor: 87.58, motivo: "Pagou com IVA" },
    });
    expect(lerCorreccaoDoPagamento({ semFactura: false, valor: 87.58, motivo: "" }).ok).toBe(false);
    expect(lerCorreccaoDoPagamento({ semFactura: false, valor: 87.58, motivo: "  ok " }).ok).toBe(false);
    expect(lerCorreccaoDoPagamento({ valor: 87.58, motivo: "Pagou com IVA" }).ok).toBe(false);
    expect(lerCorreccaoDoPagamento({ semFactura: true, valor: "0", motivo: "Pagou com IVA" }).ok).toBe(false);
    expect(lerCorreccaoDoPagamento({ semFactura: true, valor: "abc", motivo: "Pagou com IVA" }).ok).toBe(false);
  });

  it("sem fatura a 71,20 € → com fatura a 87,58 €: IVA 16,38 €, taxa 7,83 € e o parceiro deve 24,21 €", () => {
    const p = planoDaCorreccao(CASO_SEM_FACTURA_ERRADO, { semFactura: false, valor: 87.58, motivo: "O cliente pagou com IVA" });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.muda).toEqual({ factura: true, valor: true });
    // Antes: sem IVA, só a taxa.
    expect(p.antes.dividaEmMao).toMatchObject({ iva: 0, comissao: 7.83, total: 7.83 });
    // Depois: a conta em degraus com os valores novos, e a dívida certa.
    expect(p.depois.conta).toMatchObject({ total: 87.58, iva: 16.38, clyon: 7.83, profissional: 63.37 });
    expect(contaFecha(p.depois.conta!)).toBe(true);
    expect(p.depois.dividaEmMao).toMatchObject({ recebidoDoCliente: 87.58, liquido: 63.37, iva: 16.38, comissao: 7.83, total: 24.21 });
    expect(p.depois.semFactura).toBe(false);
    expect(p.depois.declarado).toBe("com_factura");
    // Com fatura as taxas não mudam: o parceiro fica com o mesmo.
    expect(p.juntaAsTaxas).toBe(false);
    expect(p.depois.taxas).toEqual(p.antes.taxas);
  });

  it("o histórico diz quem, o antes, o depois, o motivo e a conta nova", () => {
    const p = planoDaCorreccao(CASO_SEM_FACTURA_ERRADO, { semFactura: false, valor: 87.58, motivo: "O cliente pagou com IVA" });
    if (!p.ok) throw new Error("devia corrigir");
    const frase = fraseDaCorreccao(p, { quem: "Administrador", motivo: "O cliente pagou com IVA", metodo: "ao_profissional" });
    expect(frase).toContain("corrigido por Administrador");
    expect(frase).toContain("fatura: sem fatura → com fatura");
    expect(frase).toContain("o cliente pagou ao profissional 71,20 € → 87,58 €");
    expect(frase).toContain("Motivo: «O cliente pagou com IVA»");
    expect(frase).toContain("IVA 16,38 €, taxa da plataforma 7,83 €; o profissional fica com 63,37 € e deve à CLYON 24,21 €");
    expect(frase).toContain("(antes: IVA 0,00 €, taxa da plataforma 7,83 €; o profissional fica com 63,37 € e deve à CLYON 7,83 €)");
  });

  it("declarado com fatura e marcado sem, com a dívida já quitada: corrige-se, e a diferença fica dita", () => {
    const quitado: PagamentoRegistado = {
      linha: { ...CASO_SEM_FACTURA_ERRADO.linha, valorAcordado: "70", pagamentoParaQue: "com_factura" },
      metodo: "ao_profissional",
      valor: 70,
      pagoAoProfissionalEm: null,
      dividaFechadaCom: 7.7,
    };
    const p = planoDaCorreccao(quitado, { semFactura: false, valor: 86.1, motivo: "Declarado com fatura" });
    if (!p.ok) throw new Error("devia corrigir");
    expect(p.depois.dividaEmMao?.total).toBe(23.8);
    expect(p.dividaFechadaCom).toBe(7.7);
    const frase = fraseDaCorreccao(p, { quem: "Administrador", motivo: "Declarado com fatura", metodo: "ao_profissional" });
    expect(frase).toContain("fatura: sem fatura (declarado com fatura) → com fatura");
    expect(frase).toContain("já estava fechada com 7,70 €: faltam 16,10 €");
  });

  it("só a declaração errada (transferência, marcada sem fatura e declarada com): alinha-se, e a conta não muda", () => {
    const transferencia: PagamentoRegistado = {
      linha: { ...CASO_SEM_FACTURA_ERRADO.linha, valorAcordado: "50", pagamentoParaQue: "com_factura" },
      metodo: "transferencia",
      valor: 50,
      pagoAoProfissionalEm: "2026-10-30T10:00:00Z",
    };
    const p = planoDaCorreccao(transferencia, { semFactura: true, valor: 50, motivo: "A declaração estava errada" });
    if (!p.ok) throw new Error("devia corrigir");
    expect(p.muda).toEqual({ factura: true, valor: false });
    expect(p.depois.declarado).toBe("sem_factura");
    expect(p.depois.conta?.total).toBe(p.antes.conta?.total);
    expect(p.depois.dividaEmMao).toBeNull();
  });

  it("passar a sem fatura junta as taxas, como no botão de sempre; com o profissional já pago pela CLYON, não", () => {
    const antigo: PagamentoRegistado = {
      linha: { ...CASO_SEM_FACTURA_ERRADO.linha, valorAcordado: "100", taxaCliente: "0.05", taxaProfissional: "0.06", semFactura: 0 },
      metodo: "transferencia",
      valor: 129.15,
      pagoAoProfissionalEm: null,
    };
    const p = planoDaCorreccao(antigo, { semFactura: true, valor: 100, motivo: "Não quis fatura" });
    if (!p.ok) throw new Error("devia corrigir");
    expect(p.juntaAsTaxas).toBe(true);
    expect(p.depois.taxas).toEqual({ cliente: 0, profissional: 0.11 });
    const jaPago = planoDaCorreccao({ ...antigo, pagoAoProfissionalEm: "2026-10-30" }, { semFactura: true, valor: 100, motivo: "Não quis fatura" });
    expect(jaPago).toEqual({ ok: false, porque: "pro_ja_pago" });
  });

  it("não se corrige o que o euPago confirmou, o combinado em dinheiro, nem o que já está assim", () => {
    const pedido = { semFactura: false, valor: 87.58, motivo: "O cliente pagou com IVA" };
    expect(planoDaCorreccao({ ...CASO_SEM_FACTURA_ERRADO, metodo: "multibanco" }, pedido)).toEqual({ ok: false, porque: "nao_registado_a_mao" });
    expect(planoDaCorreccao({ ...CASO_SEM_FACTURA_ERRADO, metodo: "quitacao" }, pedido)).toEqual({ ok: false, porque: "nao_registado_a_mao" });
    expect(
      planoDaCorreccao({ ...CASO_SEM_FACTURA_ERRADO, linha: { ...CASO_SEM_FACTURA_ERRADO.linha, formaDePagamento: "dinheiro" } }, pedido),
    ).toEqual({ ok: false, porque: "em_dinheiro" });
    expect(planoDaCorreccao(CASO_SEM_FACTURA_ERRADO, { semFactura: true, valor: 71.2, motivo: "Nada a mudar" })).toEqual({
      ok: false,
      porque: "nada_muda",
    });
  });

  it("o ecrã mostra o que a conta dá com e sem fatura, para quem corrige", () => {
    expect(valoresDeReferencia(CASO_SEM_FACTURA_ERRADO.linha)).toEqual({ comFactura: 87.58, semFactura: 71.2 });
  });

  it("a rota é só do administrador, grava numa transacção e escreve o histórico e o registo permanente", () => {
    const rota = semComentarios(ler("src/app/api/admin/pagamentos/corrigir-pagamento/route.ts"));
    expect(rota).toContain("await requireAdminGeral(req)");
    expect(rota).toContain("lerCorreccaoDoPagamento(corpo)");
    expect(rota).toContain("await appendOrderHistory(r.pedidoId, {");
    expect(rota).toContain('acontecimento: "pagamento_corrigido"');
    expect(rota).toMatch(/motivo: lido\.pedido\.motivo,\s*antes: retrato\(antes\),\s*depois: retrato\(depois\)/);
    const base = semComentarios(ler("src/lib/corrigir-pagamento-na-base.ts"));
    expect(base).toContain("await conn.beginTransaction();");
    expect(base).toContain("WHERE id = ? LIMIT 1 FOR UPDATE");
    expect(base).toContain("SET semFactura = ?, pagamentoParaQue = ?,");
    expect(base).toContain('UPDATE pagamentos SET valor = ?, valorPago = ? WHERE id = ?');
    // E o ecrã chama-a, também num trabalho fechado.
    const painel = semComentarios(ler("src/components/admin/AdminPagamentosPanel.tsx"));
    expect(painel).toContain('const ROTA_DA_CORRECCAO = "/api/admin/pagamentos/corrigir-pagamento";');
    expect(painel).toContain("{aberto && mexeNoDinheiro && t.correccao && (");
    expect(ler("src/lib/historico-do-pedido.ts")).toContain('pagamento_corrigido: "Pagamento registado corrigido"');
  });
});

/** Um trabalho da plataforma que o cliente pagou em mão, registado e confirmado. */
function emMao(extra: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira {
  return {
    negociacaoId: 77,
    estado: "acordada",
    valorAcordado: 71.2,
    taxaCliente: 0,
    taxaProfissional: 0.11,
    formaDePagamento: null,
    comoEntrou: "ao_profissional",
    valorQueEntrou: 87.58,
    execucaoEnviadaEm: "2026-11-03T15:00:00Z",
    confirmadoEm: "2026-11-03T16:00:00Z",
    pagoEm: null,
    clientePagouEm: "2026-11-03T21:00:00Z",
    negociacaoCriadaEm: "2026-11-02T09:00:00Z",
    ...extra,
  } as TrabalhoNaCarteira;
}

describe("4. na plataforma, pago em mão: a dívida na Carteira, com referência e os 7 dias", () => {
  const depois = new Date("2026-11-04T12:00:00Z");

  it("depois de confirmado, a dívida certa (IVA + taxa) aparece na Carteira, para pagar por referência", () => {
    const [d] = dividasDe([emMao()], depois);
    expect(d).toMatchObject({ negociacaoId: 77, total: 24.21, iva: 16.38, comissao: 7.83, recebidoDoCliente: 87.58, paga: false, aParte: true });
    // Já não é «só no saldo»: tem os botões da referência, como a do dinheiro.
    expect(d.descontaNoSaldo ?? false).toBe(false);
    expect(aPagarAClyonDe([emMao()], depois)).toBe(24.21);
  });

  it("antes de confirmado não há dívida; paga por qualquer caminho, deixa de estar por pagar", () => {
    expect(dividasDe([emMao({ confirmadoEm: null, execucaoEnviadaEm: null })], depois)).toEqual([]);
    expect(aPagarAClyonDe([emMao({ dividaPagaEm: "2026-11-05T10:00:00Z" })], depois)).toBe(0);
  });

  it("a mesma regra dos 7 dias: por pagar há mais de 7 dias, bloqueia os trabalhos em dinheiro", () => {
    expect(bloqueioEmDinheiro([emMao()], depois).bloqueado).toBe(false);
    const passou = new Date("2026-11-11T17:00:00Z");
    expect(bloqueioEmDinheiro([emMao()], passou)).toMatchObject({ bloqueado: true, total: 24.21 });
  });

  it("a cobrança: o caso, a dívida e a parte das referências — e paga é a linha à parte, por qualquer caminho", () => {
    const registo = { estado: "pago", metodo: "ao_profissional", valor: 87.58, valorPago: 87.58, parte: "trabalho", trid: null };
    const c = dividaACobrar(
      { negociacaoId: 77, formaDePagamento: null, dividaEmDinheiro: null, acordado: 71.2, taxas: { cliente: 0, profissional: 0.11 } },
      [registo],
    );
    expect(c).toMatchObject({ caso: "em_mao", parte: "divida", jaPaga: false, divida: { total: 24.21, iva: 16.38, comissao: 7.83 } });
    const paga = dividaACobrar(
      { negociacaoId: 77, formaDePagamento: null, dividaEmDinheiro: null, acordado: 71.2, taxas: { cliente: 0, profissional: 0.11 } },
      [registo, { estado: "pago", metodo: "multibanco", valor: 24.21, parte: "divida", trid: tridDoAbatimentoAParte(77) }],
    );
    expect(paga?.jaPaga).toBe(true);
    // Na plataforma, pago à CLYON: nada a cobrar ao profissional.
    expect(
      dividaACobrar(
        { negociacaoId: 5, formaDePagamento: null, dividaEmDinheiro: null, acordado: 100, taxas: { cliente: 0, profissional: 0.11 } },
        [{ estado: "pago", metodo: "mbway", valor: 123 }],
      ),
    ).toBeNull();
    // Em dinheiro, a de sempre (a parte da negociação).
    const dinheiro = dividaDoRegistoEmMao(100, { cliente: 0, profissional: 0.11 }, 123);
    expect(
      dividaACobrar(
        { negociacaoId: 6, formaDePagamento: "dinheiro", dividaEmDinheiro: dinheiro, acordado: 100, taxas: { cliente: 0, profissional: 0.11 } },
        [],
      ),
    ).toMatchObject({ caso: "dinheiro", parte: "trabalho", jaPaga: false });
  });

  it("as referências da dívida são à parte: nunca do cliente, e pagas não fecham a negociação outra vez", () => {
    expect(lerParte("divida")).toBe("divida");
    expect(lerParte("diferenca")).toBe("diferenca");
    expect(lerParte(null)).toBe("trabalho");
    expect(eDoCliente({ parte: "divida" })).toBe(false);
    expect(eDoCliente({ parte: "trabalho" })).toBe(true);
    const linhas = [{ parte: "trabalho" }, { parte: "divida" }, { parte: "diferenca" }];
    expect(daMesmaConta({ parte: "divida" }, linhas)).toEqual([{ parte: "divida" }]);
    expect(daMesmaConta({ parte: "trabalho" }, linhas)).toEqual([{ parte: "trabalho" }, { parte: "diferenca" }]);

    const base = ler("src/lib/pagamentos-na-base.ts");
    expect(base).toContain("negociacaoPaga = IF(parte IN ('diferenca', 'divida'), NULL, ?)");
    expect(base).toContain("trid = IF(parte = 'divida', ?, ?)");
    expect(base).toContain("tridDoAbatimentoAParte(negociacaoId),");
    expect(base).toContain("AND (parte = 'divida') = ?");
    const cobrar = semComentarios(ler("src/lib/cobrar-divida-do-profissional.ts"));
    expect(cobrar).toContain("const aCobrar = dividaACobrar(");
    expect(cobrar).toContain("parte: aCobrar.parte,");
    // O cliente nunca as vê, nem recebe o «pago» por elas.
    expect(semComentarios(ler("src/lib/pagamento-para-o-cliente.ts"))).toContain(
      "const linhas = (await pagamentosDaNegociacao(trabalho.negociacaoId)).filter(eDoCliente);",
    );
    const webhook = semComentarios(ler("src/app/api/pagamentos/webhook/route.ts"));
    // O aviso do «pago» é um só, para o webhook e para a conferência (10-11-2026, d26).
    expect(webhook).toContain("await avisarQueOPagamentoEntrou(p);");
    expect(semComentarios(ler("src/lib/avisar-pagamento-recebido.ts"))).toContain(
      'if (p.parte !== "divida") await avisarOClienteDoPedido(',
    );
    expect(webhook).toContain("pagamentoForaDeVigor(p, daMesmaConta(p, await pagamentosDaNegociacao(p.negociacaoId)))");
  });

  it("a confirmação gera a referência também num pago em mão; e o registo já confirmado também", () => {
    const aviso = semComentarios(ler("src/lib/avisar-confirmacao.ts"));
    expect(aviso).toContain("pagoAoProfissionalRegistado(n.formaDePagamento, lido.comoEntrou)");
    expect(aviso).toContain("dividaDoRegistoEmMao(valor, taxas, lido?.valorQueEntrou)");
    expect(aviso.indexOf("const emMao =")).toBeLessThan(aviso.indexOf("gerarReferenciaDaDivida(dados.negociacaoId"));
    const recebido = semComentarios(ler("src/app/api/admin/pagamentos/recebido/route.ts"));
    expect(recebido).toMatch(/if \(emMao\) \{\s*await gerarReferenciaDaDivida\(negociacaoId/);
    // A carteira do parceiro mostra a referência viva da dívida dele, e os botões (não «só no saldo»).
    expect(ler("src/app/api/profissionais/carteira/route.ts")).toContain('(!d.aParte || p.parte === "divida")');
  });
});

describe("5. as palavras: «quitada no acerto», e não «já está cobrada»", () => {
  const base = { formaDePagamento: null, comoEntrou: "ao_profissional", valorAcordado: 70, taxas: { cliente: 0, profissional: 0.11 }, valorQueEntrou: 70 };

  it("quitada no acerto de 01/11, sem entrar dinheiro", () => {
    const x = taxaDoPagoEmMao({ ...base, taxaAParteEm: "2026-11-01", taxaAParteComo: "quitacao", taxaAParteValor: 7.7 })!;
    expect(x).toMatchObject({ valor: 7.7, cobrada: true, como: "quitacao", fechadaCom: 7.7 });
    const f = fraseDaParteDaClyon(x, euros);
    expect(f).toBe("a parte da CLYON, 7,70 €, foi quitada no acerto de 01/11/2026, sem entrar dinheiro");
    expect(f).not.toContain("cobrada");
  });

  it("cada caminho com o seu nome, e por pagar diz por onde", () => {
    const como = (c: string) =>
      fraseDaParteDaClyon(taxaDoPagoEmMao({ ...base, taxaAParteEm: "2026-11-02", taxaAParteComo: c, taxaAParteValor: 7.7 })!, euros);
    expect(como("abatimento")).toContain("foi abatida no saldo do profissional");
    expect(como("pro_transferencia")).toContain("foi paga pelo profissional");
    expect(como("multibanco")).toContain("foi paga pelo profissional");
    expect(fraseDaParteDaClyon(taxaDoPagoEmMao(base)!, euros)).toBe(
      "a parte da CLYON, 7,70 €, está por pagar pelo profissional — pela referência na carteira dele, ou descontada no saldo",
    );
  });

  it("depois de uma correcção, se a conta já não bate com o que se fechou, diz-se a diferença", () => {
    const x = taxaDoPagoEmMao({ ...base, valorQueEntrou: 86.1, taxaAParteEm: "2026-11-01", taxaAParteComo: "quitacao", taxaAParteValor: 7.7 })!;
    expect(fraseDaParteDaClyon(x, euros)).toBe(
      "a parte da CLYON é 23,80 € pela conta de hoje; foi quitada no acerto de 01/11/2026 com 7,70 € (sem entrar dinheiro) — faltam 16,10 €, que não se acertam sozinhos",
    );
  });

  it("o ecrã dos Pagamentos usa a frase, e já não escreve «já está cobrada»", () => {
    const painel = semComentarios(ler("src/components/admin/AdminPagamentosPanel.tsx"));
    expect(painel).toContain("{fraseDaParteDaClyon(t.taxaEmMao, euros)}");
    expect(painel).not.toContain("já está cobrada");
    const gerir = ler("src/lib/trabalhos-para-gerir.ts");
    expect(gerir).toContain("ap.metodo AS taxaAParteComo");
    expect(gerir).toContain("taxaAParteComo: (l.taxaAParteComo as string) ?? null,");
  });
});
