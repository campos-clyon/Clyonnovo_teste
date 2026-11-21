import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { trabalhoClyonDoModeloAntigo } from "./novo-modelo";
import { clientePagouOTrabalhoClyon, negociacaoNoNovoModelo } from "./taxa-a-passar-a-clyon";
import {
  PORQUE_NAO_DESFAZ,
  PORQUE_NAO_PASSA,
  ROTULO_DO_BOTAO,
  fraseDaPassagem,
  fraseDoDesfazer,
  lerHistorico,
  lerPassagem,
  lerPedidoDoClientePagaAClyon,
  porqueNaoDesfaz,
  porqueNaoPassa,
  ultimaPassagem,
  type EntradaDoHistorico,
  type TrabalhoParaAPassagem,
} from "./cliente-paga-a-clyon";
import { contaDoValorFinal } from "./valor-final-ao-cliente";
import { contaDaLinha } from "./conta-do-pagamento";
import type { Pagamento } from "./pagamentos-na-base";

/**
 * d82 (CEO e dono, 21-11-2026) — O CLIENTE PAGA À CLYON.
 *
 * Um Trabalho CLYON do modelo de 15-11 (o cliente paga ao parceiro, o parceiro
 * passa à CLYON a taxa e o IVA dela) em que o parceiro pede ao cliente que pague
 * à CLYON. O administrador passa-o ao caminho em que o cliente paga à CLYON (a
 * regra da d58), com motivo e com / sem fatura; pode desfazer-se enquanto o
 * cliente não pagou. Números de exemplo: 370,00 € sem IVA, taxa 15 %; relógio: datas explícitas.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const AGORA = new Date("2026-11-21T15:00:00Z");
const CRIADO_A_18 = "2026-11-18 19:03:01";
const FEITO = {
  execucaoEnviadaEm: new Date("2026-11-20T21:13:21Z"),
  confirmadoEm: new Date("2026-11-21T12:18:15Z"),
  pagoEm: null,
};
const PASSADO_EM = new Date("2026-11-21T14:00:00Z");

/** A referência da taxa do parceiro no modelo de 15-11 (nasce depois de libertado). */
const referenciaDaTaxa = {
  estado: "pendente",
  metodo: "multibanco",
  parte: "trabalho",
  criadoEm: new Date("2026-11-21T12:18:20Z"),
  pagoEm: null,
};

describe("(1) a passagem segue o caminho da d58", () => {
  it("sem a marca, um Trabalho CLYON de depois de 15-11 segue o modelo novo", () => {
    const novo = negociacaoNoNovoModelo(
      { ofertaClyon: "distribuida", pedidoCriadoEm: CRIADO_A_18, trabalho: FEITO, fechadoEm: null },
      [referenciaDaTaxa],
      AGORA,
    );
    expect(novo).toBe(true);
  });

  it("com a marca, conta como o pagamento do cliente à CLYON e fica no antigo — antes ou depois de feito", () => {
    expect(clientePagouOTrabalhoClyon([], { ...FEITO, clientePagaAClyonEm: PASSADO_EM })?.toISOString()).toBe(
      PASSADO_EM.toISOString(),
    );
    for (const trabalho of [{ ...FEITO, clientePagaAClyonEm: PASSADO_EM }, { clientePagaAClyonEm: PASSADO_EM }]) {
      const novo = negociacaoNoNovoModelo(
        { ofertaClyon: "distribuida", pedidoCriadoEm: CRIADO_A_18, trabalho, fechadoEm: null },
        [referenciaDaTaxa],
        AGORA,
      );
      expect(novo).toBe(false);
    }
  });

  it("um pagamento do cliente mais cedo do que a marca ganha (a data é a do primeiro)", () => {
    const mbway = { estado: "pago", metodo: "transferencia", parte: "trabalho", pagoEm: new Date("2026-11-21T10:00:00Z") };
    expect(clientePagouOTrabalhoClyon([mbway], { ...FEITO, clientePagaAClyonEm: PASSADO_EM })?.toISOString()).toBe(
      "2026-11-21T10:00:00.000Z",
    );
  });

  it("a dívida do parceiro desaparece: o trabalho passa a ser pago pela CLYON (a carteira pergunta isto)", () => {
    const clientePagouAClyonEm = clientePagouOTrabalhoClyon([referenciaDaTaxa], { ...FEITO, clientePagaAClyonEm: PASSADO_EM });
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "distribuida", pedidoCriadoEm: CRIADO_A_18, clientePagouAClyonEm }, AGORA)).toBe(true);
    const semMarca = clientePagouOTrabalhoClyon([referenciaDaTaxa], FEITO);
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "distribuida", pedidoCriadoEm: CRIADO_A_18, clientePagouAClyonEm: semMarca }, AGORA)).toBe(false);
  });

  it("a base lê a marca em todos os sítios do corte (Mesa, Pagamentos, Carteiras, carteira, retenção, acesso ao pagamento)", () => {
    expect(ler("src/lib/trabalho-clyon-na-base.ts")).toMatch(/clientePagaAClyonEm: r\.clientePagaAClyonEm/);
    expect(ler("src/lib/regras-novas-na-base.ts")).toMatch(/clientePagaAClyonEm: n\.clientePagaAClyonEm/);
    // O acesso ao pagamento passa a linha inteira (`SELECT n.*`) como `trabalho`.
    expect(ler("src/lib/acesso-ao-pagamento.ts")).toMatch(/trabalho: linha/);
    expect(ler("src/lib/db.ts")).toMatch(/ADD COLUMN clientePagaAClyonEm DATETIME NULL/);
  });
});

const podePassar: TrabalhoParaAPassagem = {
  estado: "acordada",
  trabalhoClyon: true,
  novoModelo: true,
  passadoEm: null,
  formaDePagamento: "na_plataforma",
  pagamentosPagos: 0,
  partesPagas: 0,
  pagoAoProfissionalEm: null,
  base: "carga",
};

describe("(2) quando passa, e quando não", () => {
  it("passa um Trabalho CLYON contratado do modelo novo, feito ou por fazer, sem nada pago", () => {
    expect(porqueNaoPassa(podePassar, { valorTotal: 370 })).toBeNull();
    expect(porqueNaoPassa({ ...podePassar, base: "total" }, { valorTotal: null })).toBeNull();
  });

  it("recusa o que não serve, com a razão escrita", () => {
    const casos: Array<[Partial<TrabalhoParaAPassagem>, keyof typeof PORQUE_NAO_PASSA]> = [
      [{ estado: "aberta" }, "nao_fechado"],
      [{ trabalhoClyon: false }, "nao_e_trabalho_clyon"],
      [{ passadoEm: PASSADO_EM }, "ja_passado"],
      [{ novoModelo: false }, "nao_e_do_novo_modelo"],
      [{ formaDePagamento: "dinheiro" }, "em_dinheiro"],
      [{ pagoAoProfissionalEm: PASSADO_EM }, "ja_pago_ao_profissional"],
      [{ pagamentosPagos: 1 }, "ja_ha_pagamento"],
      [{ partesPagas: 1 }, "partes_pagas"],
    ];
    for (const [mudanca, porque] of casos) {
      expect(porqueNaoPassa({ ...podePassar, ...mudanca }, { valorTotal: null })).toBe(porque);
      expect(PORQUE_NAO_PASSA[porque].length).toBeGreaterThan(5);
    }
    expect(porqueNaoPassa({ ...podePassar, base: "total" }, { valorTotal: 370 })).toBe("base_nao_e_por_carga");
  });

  it("desfaz-se enquanto o cliente não pagou e não se pagou ao profissional", () => {
    expect(porqueNaoDesfaz({ passadoEm: PASSADO_EM, pagamentosDoClientePagos: 0, pagoAoProfissionalEm: null })).toBeNull();
    expect(porqueNaoDesfaz({ passadoEm: null, pagamentosDoClientePagos: 0, pagoAoProfissionalEm: null })).toBe("nao_passado");
    expect(porqueNaoDesfaz({ passadoEm: PASSADO_EM, pagamentosDoClientePagos: 1, pagoAoProfissionalEm: null })).toBe("cliente_pagou");
    expect(porqueNaoDesfaz({ passadoEm: PASSADO_EM, pagamentosDoClientePagos: 0, pagoAoProfissionalEm: PASSADO_EM })).toBe(
      "ja_pago_ao_profissional",
    );
    expect(Object.values(PORQUE_NAO_DESFAZ).every((t) => t.length > 5)).toBe(true);
  });
});

describe("(3) o pedido: motivo obrigatório, a fatura sempre escolhida", () => {
  it("sem motivo, ou sem a escolha da fatura, não passa", () => {
    expect(lerPedidoDoClientePagaAClyon({ accao: "passar", negociacaoId: 1, fatura: "sem" }).ok).toBe(false);
    expect(lerPedidoDoClientePagaAClyon({ accao: "passar", negociacaoId: 1, motivo: "o parceiro pediu" }).ok).toBe(false);
    expect(lerPedidoDoClientePagaAClyon({ accao: "desfazer", negociacaoId: 1, motivo: " " }).ok).toBe(false);
    expect(lerPedidoDoClientePagaAClyon({ accao: "outra", negociacaoId: 1, motivo: "xpto" }).ok).toBe(false);
  });

  it("lê o pedido certo, com o valor total em vírgula", () => {
    const r = lerPedidoDoClientePagaAClyon({
      accao: "passar",
      negociacaoId: 3,
      motivo: "o parceiro pediu ao cliente que pagasse à CLYON",
      fatura: "sem",
      valorTotal: "370,00",
    });
    expect(r).toEqual({
      ok: true,
      pedido: {
        accao: "passar",
        negociacaoId: 3,
        motivo: "o parceiro pediu ao cliente que pagasse à CLYON",
        comFatura: false,
        valorTotal: 370,
        previsualizar: false,
      },
    });
  });
});

const trabalhoAntigo = (p: Record<string, unknown> = {}) => ({
  acordado: 370,
  taxas: { cliente: 0, profissional: 0.15 },
  modelo: "iva_incluido" as const,
  acrescimo: 0,
  formaDePagamento: "na_plataforma" as const,
  // Passado: segue o caminho em que o cliente paga à CLYON.
  novoModelo: false,
  porHora: null,
  reservaCent: 0,
  ...p,
});
const pendenteDaTaxa = {
  id: 200,
  negociacaoId: 9,
  pedidoId: 9,
  providerId: 6,
  metodo: "multibanco",
  estado: "cancelado",
  ambiente: "producao",
  valor: 68.27,
  comFactura: false,
  deTeste: false,
  valorPago: null,
  parte: "trabalho",
} as unknown as Pagamento;

describe("(4) as referências do cliente, com e sem fatura", () => {
  it("sem fatura, o valor final pede o valor sem IVA: 370,00 €", () => {
    const r = contaDoValorFinal(trabalhoAntigo({ semFactura: true }), [pendenteDaTaxa], "normal");
    expect(r.ok).toBe(true);
    if (!r.ok || r.conta.modo !== "referencia") throw new Error("devia ser uma referência");
    expect(r.conta.aPedir).toBe(370);
    expect(r.conta.iva).toBe(0);
    expect(r.conta.comFactura).toBe(false);
  });

  it("com fatura, o valor final pede o com IVA: 455,10 €", () => {
    const r = contaDoValorFinal(trabalhoAntigo({ semFactura: false }), [], "normal");
    if (!r.ok || r.conta.modo !== "referencia") throw new Error("devia ser uma referência");
    expect(r.conta.aPedir).toBe(455.1);
    expect(r.conta.semIva).toBe(370);
    expect(r.conta.comFactura).toBe(true);
  });

  it("antes de passar (modelo novo) não havia referência ao cliente: só os dados do parceiro", () => {
    const r = contaDoValorFinal(trabalhoAntigo({ novoModelo: true }), [], "normal");
    expect(r.ok && r.conta.modo).toBe("parceiro");
  });

  it("a conta em degraus: o cliente paga 370,00 €, a CLYON fica com 55,50 € e o profissional recebe 314,50 €", () => {
    const c = contaDaLinha(
      {
        valorAcordado: "370",
        taxaCliente: "0",
        taxaProfissional: "0.15",
        formaDePagamento: "na_plataforma",
        semFactura: 1,
        ofertaClyon: "distribuida",
        valorFixoClyon: "370",
        taxaClyon: "0.15",
        precoClienteClyon: "370",
        negociacaoCriadaEm: "2026-11-18T19:03:01Z",
      },
      false,
    );
    expect(c?.total).toBe(370);
    expect(c?.iva).toBe(0);
    expect(c?.profissional).toBe(314.5);
    expect(c?.taxas.reduce((s, t) => s + t.valor, 0)).toBe(55.5);
  });
});

describe("(5) o histórico: o antes guardado, e o desfazer que o repõe", () => {
  const antes: EntradaDoHistorico["antes"] = {
    semFactura: false,
    motivoSemFactura: null,
    taxaCliente: 0,
    taxaProfissional: 0.15,
    taxasComFacturaJson: null,
    base: "carga",
    valorFixoClyon: 370,
    precoClienteClyon: 370,
    valorAcordado: 370,
  };
  it("lê o histórico e encontra a última passagem", () => {
    const h: EntradaDoHistorico[] = [
      { accao: "passar", em: "2026-11-21T14:00:00Z", por: "A", motivo: "m1", antes, referenciasCanceladas: [] },
      { accao: "desfazer", em: "2026-11-21T14:10:00Z", por: "A", motivo: "m2", antes, referenciasCanceladas: [] },
      { accao: "passar", em: "2026-11-21T14:20:00Z", por: "A", motivo: "m3", antes: { ...antes, base: "total" }, referenciasCanceladas: [] },
    ];
    expect(ultimaPassagem(lerHistorico(JSON.stringify(h)))?.motivo).toBe("m3");
    expect(lerHistorico("não é json")).toEqual([]);
    expect(lerHistorico(null)).toEqual([]);
  });

  it("a passagem na linha", () => {
    expect(lerPassagem({ clientePagaAClyonEm: null })).toBeNull();
    expect(lerPassagem({ clientePagaAClyonEm: PASSADO_EM, clientePagaAClyonPor: "A", clientePagaAClyonMotivo: "m" })).toEqual({
      em: PASSADO_EM,
      por: "A",
      motivo: "m",
    });
  });

  it("as frases dizem o antes, o depois, as referências canceladas e o motivo", () => {
    const f = fraseDaPassagem({
      quem: "Equipa",
      motivo: "o parceiro pediu ao cliente que pagasse à CLYON",
      antes: { clientePagavaAoParceiro: 455.11, parceiroPassavaAClyon: 68.27, semFactura: false, base: "carga", valor: 370 },
      depois: { clientePaga: 370, comFatura: false, profissionalRecebe: 314.5, clyon: 55.5, base: "total", valor: 370 },
      referenciasCanceladas: 1,
    });
    expect(f).toContain("370,00 € (sem fatura)");
    expect(f).toContain("314,50 €");
    expect(f).toContain("55,50 €");
    expect(f).toContain("455,11 €");
    expect(f).toContain("68,27 €");
    expect(f).toContain("valor total");
    expect(f).toContain("ficou cancelada");
    expect(f).toContain("«o parceiro pediu ao cliente que pagasse à CLYON»");
    expect(fraseDoDesfazer({ quem: "Equipa", motivo: "engano", referenciasCanceladas: 2 })).toContain("As 2 referências");
  });

  it("o desfazer repõe a fatura, as taxas e o valor guardados no antes", () => {
    const base = ler("src/lib/cliente-paga-a-clyon-na-base.ts");
    const desfazer = base.slice(base.indexOf("export async function desfazerOClientePagaAClyon"));
    expect(desfazer).toMatch(/SET semFactura = \?, motivoSemFactura = \?, taxaCliente = \?, taxaProfissional = \?, taxasComFacturaJson = \?/);
    expect(desfazer).toMatch(/UPDATE simulatorOrders SET baseDoPreco = \?, valorFixoClyon = \?, precoClienteClyon = \?/);
    expect(desfazer).toMatch(/clientePagaAClyonEm = NULL/);
  });
});

describe("(6) só o administrador, e nada se apaga", () => {
  const rota = ler("src/app/api/admin/pagamentos/cliente-paga-a-clyon/route.ts");
  const base = ler("src/lib/cliente-paga-a-clyon-na-base.ts");
  const ecra = ler("src/components/admin/ClientePagaAClyon.tsx");

  it("a rota pede o administrador geral no GET e no POST", () => {
    expect(rota.match(/await requireAdminGeral\(req\)/g)?.length).toBe(2);
    expect(rota).not.toMatch(/requireAdmin\(req\)/);
  });

  it("o ecrã só aparece ao administrador, com um diálogo da página (sem confirm do navegador)", () => {
    expect(ecra).toMatch(/useEAdministrador\(\)/);
    expect(ecra).toMatch(/if \(!eAdministrador\) return null;/);
    expect(ecra).toMatch(/role="dialog"/);
    expect(ecra).not.toMatch(/window\.confirm|[^`]confirm\(\s*["`]/);
    expect(ROTULO_DO_BOTAO).toBe("O cliente paga à CLYON");
  });

  it("nada se apaga: as referências ficam canceladas com o motivo, e o histórico só cresce", () => {
    for (const f of [rota, base]) expect(f).not.toMatch(/\bDELETE\b/i);
    expect(base).toMatch(/UPDATE pagamentos SET estado = 'cancelado', erro = \? WHERE id = \? AND estado = 'pendente'/);
    expect(base).toMatch(/historico\.push\(/);
  });

  it("não envia nada a ninguém nem gera referências", () => {
    for (const f of [rota, base]) {
      expect(f).not.toMatch(/pedirPagamento|abrirPagamento|enviarWhatsApp|enviarTextoManualWhatsApp|Resend/);
    }
  });

  it("os botões estão nos Pagamentos e no cartão da Mesa / Trabalhos CLYON", () => {
    expect(ler("src/components/admin/AdminPagamentosPanel.tsx")).toMatch(/<ClientePagaAClyon/);
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toMatch(/<ClientePagaAClyon/);
  });
});
