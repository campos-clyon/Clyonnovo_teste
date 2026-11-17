import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { botoesDaFaseDaMesa, botoesDaFaseDoTrabalhoClyon } from "./botoes-das-fases";
import {
  MENSAGEM_DE_CANCELAMENTO,
  mensagemDeAgradecimento,
  mensagemDeTrabalhoConcluido,
} from "./mensagens-das-fases";

/*
 * d55 (CEO e dono, 17-11-2026) — CADA FASE SÓ COM OS SEUS BOTÕES, e as
 * mensagens que faltavam. Os botões só abrem o WhatsApp de quem está ao
 * backoffice; nada sai sozinho.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("o cartão do Trabalho CLYON", () => {
  it("a proposta só antes de haver quem o faça — o #623, já feito, não a mostra", () => {
    for (const f of ["a_espera", "escolher", "sem_ninguem"] as const) expect(botoesDaFaseDoTrabalhoClyon(f, false).proposta).toBe(true);
    for (const f of ["atribuida", "por_confirmar", "confirmada", "paga", "cancelada"] as const) {
      expect(botoesDaFaseDoTrabalhoClyon(f, false).proposta).toBe(false);
      expect(botoesDaFaseDoTrabalhoClyon(f, true).proposta).toBe(false);
    }
  });

  it("contratado: a adjudicação; feito: confirmar, «trabalho concluído» e os dados para pagamento pelo modelo", () => {
    expect(botoesDaFaseDoTrabalhoClyon("atribuida", false)).toMatchObject({ adjudicacao: true, valoresParaPagamento: false });
    expect(botoesDaFaseDoTrabalhoClyon("por_confirmar", false)).toMatchObject({ adjudicacao: false, valoresParaPagamento: true, trabalhoConcluido: true });
    // No modelo de 15-11, os dados para pagamento são a adjudicação (pagar ao parceiro), nunca os «valores» à CLYON.
    expect(botoesDaFaseDoTrabalhoClyon("por_confirmar", true)).toMatchObject({
      adjudicacao: true,
      dadosParaPagamento: true,
      valoresParaPagamento: false,
      trabalhoConcluido: true,
    });
  });

  it("concluído: agradecimento; cancelado: a mensagem de cancelamento", () => {
    expect(botoesDaFaseDoTrabalhoClyon("confirmada", true)).toMatchObject({ agradecimento: true, valoresParaPagamento: false });
    expect(botoesDaFaseDoTrabalhoClyon("paga", false).agradecimento).toBe(true);
    expect(botoesDaFaseDoTrabalhoClyon("cancelada", false)).toMatchObject({ cancelamento: true, adjudicacao: false, proposta: false });
  });

  it("o cartão pergunta à regra", () => {
    const T = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(T).toContain("botoesDaFaseDoTrabalhoClyon(r.fase, novoModelo)");
    expect(T).toMatch(/!botoes\.proposta\s*\?\s*null/);
    expect(T).toContain("botoes.adjudicacao && a && !a.confirmadoEm");
    expect(T).toContain('rotulo={r.fase === "por_confirmar" ? "Enviar dados para pagamento" : undefined}');
  });
});

describe("a Mesa", () => {
  it("a adjudicação aparece depois de o trabalho estar dado por feito, como «dados para pagamento»", () => {
    const feito = botoesDaFaseDaMesa({ cancelado: false, concluido: false, acordada: { execucaoEnviadaEm: "2026-11-17T10:00:00Z", confirmadoEm: null } });
    expect(feito).toMatchObject({ adjudicacao: true, dadosParaPagamento: true, trabalhoConcluido: true });
    // Mesmo com o pedido já marcado concluído, enquanto não está confirmado.
    expect(botoesDaFaseDaMesa({ cancelado: false, concluido: true, acordada: { execucaoEnviadaEm: "2026-11-17T10:00:00Z", confirmadoEm: null } }).adjudicacao).toBe(true);
    expect(botoesDaFaseDaMesa({ cancelado: false, concluido: false, acordada: {} })).toMatchObject({ adjudicacao: true, dadosParaPagamento: false });
    expect(botoesDaFaseDaMesa({ cancelado: false, concluido: true, acordada: { confirmadoEm: "2026-11-17T10:00:00Z" } })).toMatchObject({ adjudicacao: false, agradecimento: true });
    expect(botoesDaFaseDaMesa({ cancelado: true, concluido: false, acordada: null })).toMatchObject({ cancelamento: true, adjudicacao: false });
    const M = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(M).toContain("if (!acordada || !fase.adjudicacao) return null;");
    expect(M).not.toContain("if (!acordada || acordada.confirmadoEm || cancelado) return null;");
  });
});

describe("as mensagens novas", () => {
  it("o cancelamento é o texto do dono, palavra por palavra", () => {
    expect(MENSAGEM_DE_CANCELAMENTO).toBe(
      [
        "Olá! Obrigado por nos ter dito. 🙏",
        "O seu pedido fica cancelado e não vai seguir para nenhum parceiro. Os dados que nos deu para este pedido serão apagados do nosso sistema, conforme a nossa Política de Privacidade.",
        "Se precisar de nós no futuro, basta fazer um pedido novo, pelo site clyon.pt ou por aqui, e a equipa analisa-o de raiz.",
        "Muito obrigado pela confiança, e até à próxima!",
        "Equipa CLYON",
      ].join("\n"),
    );
  });

  it("«trabalho concluído» e o agradecimento: parceiro, sem promessas proibidas, com o n.º do pedido", () => {
    const d = { pedidoId: 623, cliente: "Cliente Teste", parceiro: "Parceiro de Teste" };
    for (const m of [mensagemDeTrabalhoConcluido(d), mensagemDeAgradecimento(d)]) {
      expect(m).toContain("Olá, Cliente!");
      expect(m).toContain("n.º 623");
      expect(m).toContain("Parceiro de Teste");
      expect(m).not.toMatch(/profissional|próprio dia|contentor|big bag|Paga à CLYON/i);
    }
    expect(mensagemDeAgradecimento(d)).toContain("De 1 a 5");
    expect(mensagemDeTrabalhoConcluido({ pedidoId: 1, cliente: null })).toMatch(/^Olá! O parceiro deu por concluído/);
  });
});
