import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DADOS_DE_PAGAMENTO_A_CONFIRMAR,
  confirmacaoAindaVale,
  dadoDePagamentoEncurtado,
  dadosQueOClienteRecebe,
  porqueOsDadosEstaoPorConfirmar,
} from "./dados-de-pagamento-por-confirmar";
import { CAMPOS_SO_DO_ADMINISTRADOR } from "./edicao-profissional";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const contratadaEm = new Date("2026-11-16T10:00:00Z");
const parceiro = {
  contratadaEm,
  createdAt: new Date("2026-11-15T10:00:00Z"),
  iban: "PT50000201231234567890154",
  ibanTitular: "João Silva",
  name: "João Rui Silva",
  responsavel: null,
};

describe("d5 — os dados de pagamento por confirmar não chegam ao cliente", () => {
  it("IBAN mudado depois do contrato → por confirmar, até o administrador confirmar", () => {
    const mudado = { ...parceiro, ibanMudadoEm: new Date("2026-11-17T09:00:00Z") };
    expect(porqueOsDadosEstaoPorConfirmar(mudado)).toBe("mudaram");
    // Confirmado depois da mudança: o cliente volta a ver.
    expect(porqueOsDadosEstaoPorConfirmar({ ...mudado, dadosPagamentoConfirmadosEm: new Date("2026-11-17T10:00:00Z") })).toBeNull();
    // Mudou outra vez depois da confirmação: volta a ficar por confirmar.
    expect(confirmacaoAindaVale(new Date("2026-11-17T10:00:00Z"), new Date("2026-11-18T10:00:00Z"))).toBe(false);
  });

  it("dados de antes do contrato e titular que bate → o cliente vê", () => {
    expect(porqueOsDadosEstaoPorConfirmar({ ...parceiro, ibanMudadoEm: new Date("2026-11-14T09:00:00Z") })).toBeNull();
  });

  it("titular que não bate com o parceiro nem com a empresa → por confirmar", () => {
    expect(porqueOsDadosEstaoPorConfirmar({ ...parceiro, ibanTitular: "Maria Costa" })).toBe("titular");
    // Bate com o responsável da empresa.
    expect(porqueOsDadosEstaoPorConfirmar({ ...parceiro, name: "Recolhas Lda", ibanTitular: "Maria Costa", responsavel: "Maria Costa" })).toBeNull();
    // Só MB WAY, sem IBAN: o titular não conta.
    expect(porqueOsDadosEstaoPorConfirmar({ ...parceiro, iban: null, ibanTitular: null })).toBeNull();
  });

  it("por confirmar, o cliente não recebe IBAN, titular nem MB WAY", () => {
    const d = { iban: "PT50…", titular: "João Silva", mbway: "912345678" };
    expect(dadosQueOClienteRecebe(d, true)).toEqual({ iban: null, titular: null, mbway: null });
    expect(dadosQueOClienteRecebe(d, false)).toEqual(d);
  });

  it("o bloco «Pagar a …» tira os dados e diz a frase; o dinheiro no local fica", () => {
    const f = ler("src/lib/pagar-ao-parceiro-para-o-cliente.ts");
    expect(f).toContain("negociacoesComDadosPorConfirmar([t.negociacaoId])");
    expect(f).toContain("dadosQueOClienteRecebe(");
    expect(f).toContain("DADOS_DE_PAGAMENTO_A_CONFIRMAR");
    expect(DADOS_DE_PAGAMENTO_A_CONFIRMAR).toBe("A CLYON está a confirmar os dados de pagamento do parceiro; avisamo-lo aqui.");
  });

  it("a confirmação: coluna aditiva, rota só do administrador e com registo, botão na Mesa", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain("ALTER TABLE negociacoes ADD COLUMN dadosPagamentoConfirmadosEm DATETIME NULL DEFAULT NULL");
    const rota = ler("src/app/api/admin/negociacoes/dados-de-pagamento/route.ts");
    expect(rota).toContain("await requireAdminGeral(req)");
    expect(rota).toContain('acontecimento: "dados_de_pagamento_confirmados"');
    const mesa = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(mesa).toMatch(/eAdministrador && n\.dadosDePagamentoPorConfirmar/);
    expect(mesa).toContain("/api/admin/negociacoes/dados-de-pagamento");
  });

  it("no backoffice, mudar IBAN/titular/MB WAY fica no registo (encurtado) e manda o email ao parceiro", () => {
    const rota = ler("src/app/api/admin/profissionais/[id]/route.ts");
    expect(rota).toContain('acontecimento: "profissional_pagamento_mudado"');
    expect(rota).toContain("dadoDePagamentoEncurtado");
    expect(rota).not.toMatch(/split\(\/s\+\//);
    expect(rota).toContain("enviarEmailDosDadosDePagamento(");
  });

  it("o registo encurta: iniciais do titular (também com «s» no nome), IBAN e MB WAY nunca inteiros", () => {
    expect(dadoDePagamentoEncurtado("ibanTitular", "Sasha Silvestre dos Santos")).toBe("S. S. d. S.");
    expect(dadoDePagamentoEncurtado("ibanTitular", "  Rosa   Assis ")).toBe("R. A.");
    expect(dadoDePagamentoEncurtado("iban", "PT50000201231234567890154")).toBe("PT50 ···· 0154");
    expect(dadoDePagamentoEncurtado("mbway", "912345678")).toBe("···678");
    expect(dadoDePagamentoEncurtado("iban", "")).toBeNull();
  });

  it("regimeIva e emiteFatura só pelo administrador, com registo", () => {
    expect(CAMPOS_SO_DO_ADMINISTRADOR).toEqual(expect.arrayContaining(["regimeIva", "emiteFatura"]));
    const rota = ler("src/app/api/admin/profissionais/[id]/route.ts");
    expect(rota).toContain('acontecimento: "profissional_fiscal_mudado"');
  });
});
