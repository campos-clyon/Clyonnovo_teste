import { describe, it, expect } from "vitest";
import { propor, aceitar, type Negociacao } from "./negociacao";

/**
 * Uma recusa tem duas obrigações: dizer o que se passa, e dizer por onde se sai.
 *
 * Aconteceu a sério, no pedido #228: o valor de partida saiu alto (121,43 €
 * por uma cómoda), o profissional aceitou-o, e do outro lado o cliente só
 * tinha 30 €. Ao tentar contrapropor, o site respondia "Já tem uma proposta
 * à espera de resposta" — que era FALSO: não havia proposta dele nenhuma à
 * espera; o que havia era um profissional que já tinha dito que sim.
 *
 * Quem leu aquilo concluiu, com razão, que o site estava avariado.
 */

const AGORA = new Date("2026-08-26T15:00:00Z");

function comPropostaDoCliente(valor: number): Negociacao {
  return {
    estado: "aberta",
    valorAcordado: null,
    propostas: [{ por: "cliente", valor, criadaEm: AGORA, estado: "pendente" }],
  };
}

describe("quando o profissional já aceitou", () => {
  const aceite = aceitar(comPropostaDoCliente(121.43), "profissional", AGORA);
  const n = aceite.ok ? aceite.negociacao : null;

  it("a negociação fica à espera de ser fechada", () => {
    expect(n).not.toBeNull();
    expect(n!.estado).toBe("aguarda_contratacao");
  });

  it("contrapropor é recusado — mas a recusa diz PORQUÊ, e com o valor", () => {
    const r = propor(n!, "cliente", 30, AGORA);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toContain("já aceitou");
    expect(r.erro).toContain("121,43 €");
    // E a saída, dita: desistir e voltar a enviar com o valor certo.
    expect(r.erro).toContain("desistir");
    // O que nunca mais pode aparecer aqui: a frase que mentia.
    expect(r.erro).not.toContain("Já tem uma proposta à espera");
  });
});

describe("as outras recusas também dizem a verdade", () => {
  it("com a nossa proposta pendente, a espera é do outro lado", () => {
    const r = propor(comPropostaDoCliente(100), "cliente", 30, AGORA);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toContain("espere que o outro lado responda");
  });

  it("uma negociação terminada diz que terminou", () => {
    const morta: Negociacao = { estado: "desistida", valorAcordado: null, propostas: [] };
    const r = propor(morta, "cliente", 30, AGORA);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toBe("Esta negociação terminou.");
  });

  it("e um trabalho fechado diz que está fechado", () => {
    const feita: Negociacao = { estado: "acordada", valorAcordado: 100, propostas: [] };
    const r = propor(feita, "cliente", 30, AGORA);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toBe("Este trabalho já está fechado.");
  });
});
