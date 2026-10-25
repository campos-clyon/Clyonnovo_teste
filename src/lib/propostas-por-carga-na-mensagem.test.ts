import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mensagemDasPropostas,
  propostasParaOCliente,
  trabalhoFechado,
  SAO_PRECOS_POR_CARGA,
} from "./mensagem-das-propostas";

/**
 * POR CARGA, NA MENSAGEM DAS PROPOSTAS — 12-10-2026.
 *
 * *«O pedido está agendado por carga, mas a mensagem que o assistente gera não
 * fala isso, assim o cliente pensa que é o valor total final.»* — a Zélia,
 * pedido #375: «Nova Recolha: 315,00 € + IVA = 387,45 €», sem uma palavra de
 * carga.
 */

const negociacao = (profissional: string, valor: number, estado = "pendente") => ({
  estado,
  profissionalNome: profissional,
  propostasJson: JSON.stringify([
    { por: "profissional", valor, estado: "pendente", criadaEm: "2026-10-12T10:00:00Z" },
  ]),
  criadaEm: "2026-10-12T09:00:00Z",
});

const DA_ZELIA = [negociacao("Nova Recolha", 300), negociacao("TRSul", 350)];

describe("a mensagem das propostas num pedido por carga", () => {
  it("diz «por carga» em cada valor, e explica que o total depende das cargas", () => {
    const m = mensagemDasPropostas({
      nomeCliente: "Zélia Augusta Prates Viana Lopes",
      servico: "esvaziamento de apartamento",
      cidade: "Amadora",
      propostas: propostasParaOCliente(DA_ZELIA),
      base: "carga",
    });
    const linhas = m.split("\n").filter((l) => l.startsWith("Nova Recolha:") || l.startsWith("TRSul:"));
    expect(linhas).toHaveLength(2);
    for (const l of linhas) expect(l.endsWith("€ por carga")).toBe(true);
    expect(m).toContain(SAO_PRECOS_POR_CARGA);
    // A linha da carga vem antes da do IVA: é ela que muda o que os números querem dizer.
    expect(m.indexOf(SAO_PRECOS_POR_CARGA)).toBeLessThan(m.indexOf("O valor a pagar é o com IVA."));
  });

  it("pelo trabalho todo, fica como estava", () => {
    const m = mensagemDasPropostas({ propostas: propostasParaOCliente(DA_ZELIA), base: "total" });
    expect(m).not.toContain("por carga");
    expect(m).not.toContain(SAO_PRECOS_POR_CARGA);
  });

  it("e o trabalho já combinado também diz que é por carga", () => {
    const fechada = [negociacao("Nova Recolha", 300, "acordada")];
    const m = mensagemDasPropostas({
      propostas: [],
      fechado: trabalhoFechado(fechada),
      base: "carga",
    });
    expect(m).toMatch(/a pagar por carga\./);
    expect(m).toContain(SAO_PRECOS_POR_CARGA);
  });

  it("as Negociações passam a base do pedido à mensagem — nos dois sítios", () => {
    const PAINEL = readFileSync(join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"), "utf8");
    expect(PAINEL.split("base: lerBase(p.baseDoPreco),").length - 1).toBe(2);
  });
});
