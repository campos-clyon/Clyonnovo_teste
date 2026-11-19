import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { acertoDoRegime, fraseDoTotalQueDesceu, ONDE_O_REGIME_SE_PODE_ACERTAR } from "./regime-acertado";
import { FRASES_DA_FATURA, perfilFiscalDoParceiro } from "./perfil-fiscal";
import { totalAoClienteDaNegociacao } from "./total-ao-cliente";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** Uma contratada congelada em «normal» (o regime estava por confirmar ao contratar). */
const contratada = {
  estado: "acordada",
  valorAcordado: "350.00",
  taxaCliente: "0.0000",
  taxaProfissional: "0.1000",
  regimeDoProfissional: "normal",
};

describe("d2 — o regime confirmado depois de contratar acerta o total (só desce)", () => {
  it("isento confirmado depois → o total desce e o regime passa a isento", () => {
    const antes = totalAoClienteDaNegociacao(contratada, 350)!;
    const a = acertoDoRegime(contratada, "isento")!;
    expect(a.desceu).toBe(true);
    expect(a.regimeDepois).toBe("isento");
    expect(a.totalAntes).toBe(antes.total);
    expect(a.totalDepois).toBeLessThan(a.totalAntes);
    expect(a.totalDepois).toBe(totalAoClienteDaNegociacao({ ...contratada, regimeDoProfissional: "isento" }, 350)!.total);
  });

  it("normal confirmado → fica igual", () => {
    const a = acertoDoRegime(contratada, "normal")!;
    expect(a.desceu).toBe(false);
    expect(a.regimeDepois).toBe("normal");
    expect(a.totalDepois).toBe(a.totalAntes);
  });

  it("nunca sobe: uma congelada em isento não passa a normal", () => {
    const a = acertoDoRegime({ ...contratada, regimeDoProfissional: "isento" }, "normal")!;
    expect(a.desceu).toBe(false);
    expect(a.regimeDepois).toBe("isento");
    expect(a.totalDepois).toBe(a.totalAntes);
  });

  it("sem regime congelado ou sem valor, não se mexe", () => {
    expect(acertoDoRegime({ ...contratada, regimeDoProfissional: null }, "isento")).toBeNull();
    expect(acertoDoRegime({ ...contratada, valorAcordado: null }, "isento")).toBeNull();
  });

  it("a frase do aviso diz o total de antes e o de agora", () => {
    const f = fraseDoTotalQueDesceu(700, { totalAntes: 430.5, totalDepois: 358.05 });
    expect(f).toContain("#700");
    expect(f).toContain("430,50 €");
    expect(f).toContain("358,05 €");
  });

  it("só as contratadas do modelo novo sem nada pago nem feito", () => {
    for (const c of [
      "n.contratadaEm IS NOT NULL",
      "n.ofertaClyon IS NULL",
      "n.pagoEm IS NULL",
      "n.pagamentoDeclaradoEm IS NULL",
      "n.execucaoEnviadaEm IS NULL",
      "n.feitoEm IS NULL",
      "n.confirmadoEm IS NULL",
    ]) {
      expect(ONDE_O_REGIME_SE_PODE_ACERTAR).toContain(c);
    }
    const base = ler("src/lib/regime-acertado-na-base.ts");
    expect(base).toContain("NOT EXISTS (SELECT 1 FROM faturasDoTrabalho");
    expect(base).toContain("NOT EXISTS (SELECT 1 FROM cobrancasAoProfissional");
    expect(base).toContain('acontecimento: "regime_acertado"');
    expect(base).toContain("totalAntes: acerto.totalAntes");
    expect(base).toContain("avisarOClienteDoPedido(pedidoId, \"preco_mudou\"");
  });

  it("o perfil (ao confirmar) e a ficha do backoffice chamam o acerto", () => {
    const perfil = ler("src/app/api/profissionais/perfil/route.ts");
    expect(perfil).toMatch(/if \(confirmarRegime\) \{\s*await acertarRegimeDasContratadas\(/);
    const ficha = ler("src/app/api/admin/profissionais/[id]/route.ts");
    expect(ficha).toMatch(/alteracoes\.regimeIva !== undefined\) \{\s*const acertos = await acertarRegimeDasContratadas\(/);
  });

  it("a confirmar, o cliente lê que o valor pode descer", () => {
    expect(FRASES_DA_FATURA.a_confirmar).toBe("Tipo de fatura a confirmar: se o parceiro for isento, o valor desce");
    expect(perfilFiscalDoParceiro({ regimeIva: "isento" }).fatura).toBe(FRASES_DA_FATURA.a_confirmar);
  });
});
