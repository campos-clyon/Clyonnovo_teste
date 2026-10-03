import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comIvaNaResposta, desdobramentoDoIva, precoDoCliente, semEComIva } from "./preco-do-cliente";
import type { Taxas } from "./taxas-plataforma";

/**
 * O VALOR SEM IVA E O VALOR COM IVA — 03-10-2026.
 *
 * «Quero que mostre o valor sem IVA e o valor com IVA, para o cliente saber o
 * que está pagando, e também não coloque a mensagem do link e nem o link —
 * vamos fazer manualmente.»
 *
 * O que se guarda aqui: os dois números dizem-se juntos e somam certo; o que
 * se paga continua a ser um; e cada ecrã do cliente que dizia «IVA incluído»
 * passou a dizer de quanto é o sem IVA.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
// Só os comentários que começam a linha — os que vêm depois de código ficam.
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const NOVAS: Taxas = { cliente: 0.05, profissional: 0.0655 };

describe("as frases dos dois números", () => {
  it("350 € do profissional: 367,50 € sem IVA, 84,53 € de IVA, 452,03 € a pagar", () => {
    const conta = precoDoCliente(350, NOVAS, "iva_incluido");
    expect(desdobramentoDoIva(conta)).toBe("367,50 € + 84,53 € de IVA (23 %)");
    expect(semEComIva(conta)).toBe("367,50 € + IVA = 452,03 €");
    expect(conta.aPagar).toBe(452.03);
  });

  it("antes do corte, um número só — o sem IVA, como sempre", () => {
    const conta = precoDoCliente(350, NOVAS, "sem_iva");
    expect(semEComIva(conta)).toBe("367,50 €");
  });

  it("o sem IVA e o IVA somam o total, ao cêntimo, em qualquer valor", () => {
    /*
     * Dizer «294,00 € + 67,62 € de IVA» ao lado de «361,62 €» é pôr a conta à
     * frente dele: se não bater certo por um cêntimo, é isso que ele vê.
     */
    for (let centimos = 100; centimos <= 300_000; centimos += 7) {
      const conta = precoDoCliente(centimos / 100, NOVAS, "iva_incluido");
      const soma = Math.round(conta.semIva * 100) + Math.round(conta.iva * 100);
      expect(soma, `${centimos / 100} €`).toBe(Math.round(conta.total * 100));
    }
  });

  it("a pergunta diz «(com IVA)» só onde o preço o leva", () => {
    expect(comIvaNaResposta("iva_incluido")).toBe(" (com IVA)");
    expect(comIvaNaResposta("sem_iva")).toBe("");
  });
});

describe("os ecrãs do cliente dizem o sem IVA ao lado", () => {
  it("o cartão da proposta: o número grande é o que paga, e o sem IVA vai por baixo", () => {
    const ECRA = semComentarios(ler("src/app/pedido/[token]/PropostasRecebidas.tsx"));
    expect(ECRA).toContain("const contaEmCima = emCima != null ? precoDoCliente(emCima, taxasDela, modeloDela) : null;");
    expect(ECRA).toContain("{euros(contaEmCima.semIva)} sem IVA");
  });

  it("o trabalho fechado: sem IVA e IVA por cima do total a pagar", () => {
    const ECRA = semComentarios(ler("src/app/pedido/[token]/PropostasRecebidas.tsx"));
    const i = ECRA.indexOf("{euros(conta.semIva)}");
    const j = ECRA.indexOf("{euros(conta.iva)}");
    const total = ECRA.indexOf("Total a pagar");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(total).toBeGreaterThan(j);
  });

  it("a conta dele: o pedido diz o sem IVA ao lado do acordado", () => {
    const TIPOS = semComentarios(ler("src/app/conta/components/types.ts"));
    expect(TIPOS).toContain("precoDoCliente(acordado, taxasDaNegociacao(fechada), modeloDela).semIva");
    const MODAL = semComentarios(ler("src/app/conta/components/OrderDetailModal.tsx"));
    expect(MODAL).toContain("{formatarEuros(naPlataforma.valorSemIva)} sem IVA");
  });

  it("o email da proposta diz de que é feito o preço", () => {
    const EMAIL = semComentarios(ler("src/lib/email-proposta.ts"));
    expect(EMAIL).toContain("desdobramentoDoIva(p.semIvaEIva)");
    const AVISO = semComentarios(ler("src/lib/avisar-da-proposta.ts"));
    expect(AVISO).toContain("semIvaEIva: { semIva: conta.semIva, iva: conta.iva },");
  });

  it("o assistente diz o mesmo, ao fechar e na pergunta", () => {
    for (const f of ["src/lib/whatsapp-negociacao.ts", "src/lib/assistente-automatico.ts"]) {
      const s = semComentarios(ler(f));
      expect(s, f).toContain("desdobramentoDoIva(");
      expect(s, f).toContain("o valor que gostaria de pagar${comIvaNaResposta(modelo)}.");
    }
  });
});

describe("a mesa manda o orçamento sem link", () => {
  it("a mensagem que se copia da caixa também já não o leva", () => {
    const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    // Nenhuma chamada da mensagem passa um link — o tipo nem o aceita.
    expect(MESA).not.toMatch(/link: `\$\{typeof window/);
    const TIPO = semComentarios(ler("src/lib/mensagem-das-propostas.ts"));
    const i = TIPO.indexOf("export type DadosDaMensagem");
    expect(TIPO.slice(i, TIPO.indexOf("};", i))).not.toContain("link");
  });
});
