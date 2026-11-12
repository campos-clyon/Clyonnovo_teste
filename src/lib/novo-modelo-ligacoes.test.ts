import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dividasDe, foiPagoEmMao, type TrabalhoNaCarteira } from "./carteira";
import { camposDoPagamento } from "./carteira-do-profissional";
import { bloqueioEmDinheiro, standByDoNovoModelo } from "./bloqueio-por-divida";
import { quantoSePedeNesteTrabalho } from "./eupago";
import { taxaAPassarAClyon, negociacaoNoNovoModelo } from "./taxa-a-passar-a-clyon";
import { novoModeloNaVista } from "./negociacao-na-vista";
import { PAGAR_O_VALOR_EM_ATRASO } from "./valor-em-atraso";

/*
 * O MODELO DE 15-11-2026 (d10) LIGADO À CASA DE SEMPRE: a carteira, o stand-by,
 * o euPago, as rotas. E a prova de que HOJE nada muda.
 */

const HOJE = new Date("2026-11-12T15:00:00Z");
const DIA_16 = new Date("2026-11-16T10:00:00Z");
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

function trabalho(extra: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira {
  return {
    negociacaoId: 900,
    estado: "acordada",
    valorAcordado: 350,
    taxaCliente: 0,
    taxaProfissional: 0.1,
    formaDePagamento: "na_plataforma",
    confirmadoEm: "2026-11-16T09:00:00Z",
    execucaoEnviadaEm: "2026-11-16T08:00:00Z",
    negociacaoCriadaEm: "2026-11-15T12:00:00Z",
    clientePagouEm: null,
    noNovoModelo: true,
    ...extra,
  } as TrabalhoNaCarteira;
}

describe("a carteira no modelo novo", () => {
  it("ao fechar, nasce o valor em atraso: a taxa e o IVA dela (43,05 € em 350 € a 10 %)", () => {
    const [d] = dividasDe([trabalho()], DIA_16);
    expect(d.novoModelo).toBe(true);
    expect(d.total).toBe(43.05);
    expect(d.iva).toBe(8.05);
    expect(d.comissao).toBe(35);
    expect(d.paga).toBe(false);
  });

  it("o dinheiro está com ele (como no dinheiro) e não conta para o bloqueio antigo dos 7 dias", () => {
    expect(foiPagoEmMao(trabalho())).toBe(true);
    expect(bloqueioEmDinheiro([trabalho()], new Date("2026-12-30T00:00:00Z")).bloqueado).toBe(false);
  });

  it("4 dias depois de fechar ainda não; ao 5.º, stand-by; pago (webhook), normaliza", () => {
    expect(standByDoNovoModelo([trabalho()], new Date("2026-11-20T09:00:00Z")).emStandBy).toBe(false);
    expect(standByDoNovoModelo([trabalho()], new Date("2026-11-20T09:00:01Z")).emStandBy).toBe(true);
    expect(standByDoNovoModelo([trabalho({ dividaPagaEm: "2026-11-21T10:00:00Z" })], new Date("2026-11-22T00:00:00Z")).emStandBy).toBe(false);
  });

  it("sem a marca do modelo novo, tudo como antes", () => {
    const antigo = trabalho({ noNovoModelo: undefined });
    expect(dividasDe([antigo], DIA_16)).toEqual([]);
    expect(foiPagoEmMao(antigo)).toBe(false);
  });

  it("o pagamento da negociação, no modelo novo, é o do parceiro (fecha o valor em atraso)", () => {
    const pagos = new Map([[900, { pagoEm: new Date("2026-11-18T10:00:00Z"), metodo: "multibanco", valor: 43.05, levantamentoId: null }]]);
    const c = camposDoPagamento({ id: 900, formaDePagamento: "na_plataforma" }, pagos as never, true);
    expect(c.clientePagouEm).toBeNull();
    expect(c.dividaPagaEm).toEqual(new Date("2026-11-18T10:00:00Z"));
    const antes = camposDoPagamento({ id: 900, formaDePagamento: "na_plataforma" }, pagos as never);
    expect(antes.clientePagouEm).toEqual(new Date("2026-11-18T10:00:00Z"));
  });
});

describe("o corte, com os pagamentos lidos", () => {
  it("pago à CLYON antes de 15-11 fica no antigo; pago depois (o parceiro) não conta", () => {
    expect(negociacaoNoNovoModelo({}, [{ estado: "pago", pagoEm: "2026-11-10T10:00:00Z" }], DIA_16)).toBe(false);
    expect(negociacaoNoNovoModelo({}, [{ estado: "pago", pagoEm: "2026-11-17T10:00:00Z" }], DIA_16)).toBe(true);
    expect(negociacaoNoNovoModelo({}, [{ estado: "pendente", pagoEm: null }], DIA_16)).toBe(true);
    expect(negociacaoNoNovoModelo({}, [], HOJE)).toBe(false);
    expect(negociacaoNoNovoModelo({ ofertaClyon: "valor_fixo" }, [], DIA_16)).toBe(false);
  });
});

describe("o euPago pede ao parceiro só a fatura da taxa", () => {
  it("quantoSePedeNesteTrabalho", () => {
    const t = { acordado: 350, taxas: { cliente: 0, profissional: 0.1 }, acrescimo: 0, formaDePagamento: "na_plataforma", modelo: "iva_incluido" as const };
    expect(quantoSePedeNesteTrabalho({ ...t, novoModelo: true }, true)).toEqual({ valor: 43.05, quemPaga: "profissional" });
    expect(quantoSePedeNesteTrabalho(t, true).quemPaga).toBe("cliente");
    expect(taxaAPassarAClyon(1000, { cliente: 0, profissional: 0.1 })?.total).toBe(123);
  });
});

describe("o que o cliente vê ao escolher", () => {
  const linha = { id: 1, estado: "aberta", regimeIva: "isento", regimeIvaConfirmadoEm: "2026-11-13T00:00:00Z", propostasJson: JSON.stringify([{ por: "profissional", valor: 350, criadaEm: "x", estado: "activa" }]), taxaCliente: 0, taxaProfissional: 0.1 };
  it("hoje nada; a 15-11 o tipo de fatura e o total do parceiro isento (358,05 €)", () => {
    expect(novoModeloNaVista(linha, null, HOJE)).toBeNull();
    const v = novoModeloNaVista(linha, null, DIA_16);
    expect(v?.perfilFiscal.fatura).toBe("Fatura com isenção de IVA (art. 53.º)");
    expect(v?.total).toBe(358.05);
    expect(novoModeloNaVista({ ...linha, regimeIvaConfirmadoEm: null }, null, DIA_16)?.total).toBe(430.5);
    expect(novoModeloNaVista({ ...linha, ofertaClyon: "valor_fixo" }, null, DIA_16)).toBeNull();
  });
});

describe("as portas", () => {
  it("as duas rotas onde se propõe e aceita perguntam pelo modelo novo", () => {
    for (const f of ["src/app/api/profissionais/negociacao/route.ts", "src/app/api/negociacao/[token]/route.ts"]) {
      expect(ler(f), f).toContain("impedimentoDoNovoModelo(");
    }
    const imp = ler("src/lib/novo-modelo-no-servidor.ts");
    // Antes da data, sai antes de ir à base.
    expect(imp.indexOf("if (!novoModeloEmVigor(agora)) return null;")).toBeGreaterThan(-1);
    expect(imp.indexOf("if (!novoModeloEmVigor(agora)) return null;")).toBeLessThan(imp.indexOf("await perfilDoProfissional("));
    expect(imp).toContain("accao: PAGAR_O_VALOR_EM_ATRASO");
    expect(PAGAR_O_VALOR_EM_ATRASO).toBe("Pagar o valor em atraso");
  });

  it("o cliente não pede referência à CLYON num trabalho do modelo novo", () => {
    const r = ler("src/app/api/pagamentos/route.ts");
    expect(r.split("if (t.novoModelo)").length - 1).toBe(2);
    expect(ler("src/lib/pagamento-para-o-cliente.ts")).toContain("!trabalho.novoModelo");
  });

  it("a carteira só lê os pagamentos à luz do modelo novo depois da data", () => {
    const c = ler("src/lib/carteira-do-profissional.ts");
    expect(c).toContain("const vale = novoModeloEmVigor(agora);");
    expect(c).toContain("if (vale) {");
    const a = ler("src/lib/acesso-ao-pagamento.ts");
    expect(a).toContain("if (novoModeloEmVigor(agora)) {");
  });

  it("a data simulada só no relógio do servidor, e não em produção", () => {
    expect(ler("src/lib/novo-modelo.ts")).not.toContain("process.env");
    expect(ler("src/lib/relogio-do-modelo.ts")).toContain('process.env.VERCEL_ENV === "production"');
  });
});

describe("os ecrãs", () => {
  it("o simulador só muda a pergunta do pagamento a partir da data", () => {
    const v = ler("src/app/plataforma/pedir/components/ValoresEFaturacao.tsx");
    expect(v).toContain("pedidoNovoNoNovoModelo(new Date()) ?");
    expect(v).toContain("{PAGA_DIRETAMENTE_AO_PARCEIRO}");
  });

  it("o pedido, o painel e o backoffice só desenham o modelo novo quando o servidor o diz", () => {
    expect(ler("src/components/PagarAoParceiro.tsx")).toContain("if (!visto?.pagaAoParceiro) return null;");
    expect(ler("src/components/admin/FaturasDoTrabalho.tsx")).toContain("if (!token || !dados?.novoModelo) return null;");
    expect(ler("src/app/profissionais/painel/PainelDoProfissional.tsx")).toContain("carteira?.novoModelo?.standBy &&");
    expect(ler("src/app/pedido/[token]/PropostasRecebidas.tsx")).toContain("<PagarAoParceiro ");
  });
});
