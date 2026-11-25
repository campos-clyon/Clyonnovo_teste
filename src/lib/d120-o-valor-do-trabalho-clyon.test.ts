import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d120 — O TRABALHO CLYON DE VALOR FIXO NA CONVERSA (25-11-2026), o caso do
 * #558: a conta estava certa (100 € + IVA = 123 €) e a Vitória disse que «o
 * valor no sistema não bate certo». Números inventados.
 */

import { DIZ_QUE_NAO_BATE_CERTO, linhaDoTrabalhoClyonNaConversa, valoresBatem } from "./trabalho-clyon-na-conversa";
import { motivoParaBloquearOAgente } from "./vitoria-agente/guarda";
import { precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";
import { AVISO_AO_MODELO } from "./vitoria-agente/aviso-ao-modelo";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("valores iguais com e sem IVA não geram o «não bate certo»", () => {
  it("100 € + IVA e 123 € são o mesmo valor; 100 e 110 não", () => {
    expect(valoresBatem({ semIva: 100 }, { total: 123 })).toBe(true);
    expect(valoresBatem({ semIva: 100, total: 123 }, { semIva: 100, total: 123 })).toBe(true);
    expect(valoresBatem({ total: 123 }, { semIva: 100 })).toBe(true);
    expect(valoresBatem({ semIva: 100 }, { total: 110 })).toBe(false);
    expect(valoresBatem({ semIva: 100, total: 123 }, { semIva: 90, total: 110.7 })).toBe(false);
  });

  it("a revisão não deixa sair a frase do #558 — nem as desculpas por uma mensagem que estava certa", () => {
    const do558 =
      "A mensagem anterior dizia outra coisa e peço desculpa. Também vi que o valor no sistema não bate certo com o que lhe foi enviado antes. Vou pedir a uma pessoa da equipa que confirme.";
    expect(motivoParaBloquearOAgente(do558, [])).toMatch(/não bate certo/);
    for (const t of ["O valor não bate certo.", "O valor não corresponde ao que lhe enviámos.", "Peço desculpa pela mensagem anterior."]) {
      expect(DIZ_QUE_NAO_BATE_CERTO.test(t), t).toBe(true);
    }
    // A confirmação passa.
    expect(motivoParaBloquearOAgente("Sim, 100,00 € + IVA = 123,00 €, o total.", [100, 123])).toBeNull();
  });

  it("o aviso ao modelo: compara como deve e confirma", () => {
    expect(AVISO_AO_MODELO).toContain("«100 € + IVA» e «123 €» são o mesmo valor");
    expect(AVISO_AO_MODELO).toContain("Sim, 100 € + IVA = 123 €, o total");
    expect(AVISO_AO_MODELO).toContain("Nunca digas que um valor «não bate certo»");
  });
});

describe("o ecrã do pedido diz o preço do Trabalho CLYON — o mesmo da conta e da mensagem", () => {
  it("a linha: 100 € + IVA = 123 €, o total", () => {
    const preco = precoDaPropostaClyon({ valorFixo: 100, taxa: 0.1, precoAoCliente: null })!;
    expect(preco.semIva).toBe(100);
    expect(preco.total).toBe(123);
    expect(linhaDoTrabalhoClyonNaConversa({ pedidoId: 9558, parceiro: "Ecorecolha", preco })).toBe(
      "Pedido #9558: Trabalho CLYON com Ecorecolha — 100,00 € + IVA = 123,00 €, o total.",
    );
    expect(linhaDoTrabalhoClyonNaConversa({ pedidoId: 9558, preco, semFactura: true })).toBe("Pedido #9558: Trabalho CLYON — 100,00 €, o total, sem fatura.");
  });

  it("o ecrã que a Vitória lê usa o preço do Trabalho CLYON antes da conta da negociação", () => {
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    const ecra = NEG.slice(NEG.indexOf("export async function ecraDoPedido("));
    const clyon = ecra.indexOf("precoDaPropostaClyon({");
    const negociacao = ecra.indexOf("const acordado = Number(acordada.valorAcordado ?? 0);");
    expect(clyon).toBeGreaterThan(-1);
    expect(clyon).toBeLessThan(negociacao);
    expect(ecra.slice(clyon, negociacao)).toContain("linhaDoTrabalhoClyonNaConversa(");
  });
});
