import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * COBRA-SE AO FECHAR O NEGÓCIO, E NÃO SÓ NO FIM DO TRABALHO.
 *
 * "Após aceitar uma proposta deveria ter a opção de gerar referências para
 * pagamento dos valores." — 19-09-2026.
 *
 * O botão existia e funcionava — o admin gera a referência pedido a pedido —
 * mas vivia dentro do bloco que só aparece quando o trabalho está CONCLUÍDO.
 * Na prática: fechava-se o negócio com o cliente e não havia por onde lhe
 * pedir o dinheiro até alguém ir lá marcar o trabalho como feito.
 *
 * É no instante em que o negócio fecha que o valor deixa de mudar, e é aí que
 * se cobra: a CLYON recebe, guarda, e paga ao profissional depois de o
 * trabalho estar feito e confirmado. Esperar pelo fim para pedir o dinheiro é
 * ficar sem a garantia que o modelo inteiro assenta em ter.
 *
 * E O SERVIDOR JÁ ESTAVA PRONTO: `trabalhoQueSePodePagar` exige `acordada` e
 * um valor, e nunca exigiu `confirmadoEm`. Era só o ecrã a esconder o botão.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
const ACESSO = semComentarios(ler("src/lib/acesso-ao-pagamento.ts"));

describe("o bloco das contas aparece assim que o negócio fecha", () => {
  it("não espera pelo trabalho concluído", () => {
    expect(MESA).toContain("{acordada && acordada.valorAcordado != null && (");
    expect(MESA).not.toContain("{concluido && acordada && acordada.valorAcordado != null && (");
  });

  it("e o gerador de referências vem com ele", () => {
    /*
     * Fica ao lado das contas de propósito: a pergunta «quanto é que este
     * cliente tem a pagar» responde-se três linhas acima, e é essa conta que a
     * referência vai cobrar. Noutro ecrã era preciso trazer o número na cabeça.
     */
    const i = MESA.indexOf("{acordada && acordada.valorAcordado != null && (");
    const bloco = MESA.slice(i, MESA.indexOf("</div>\n        )}", i));
    expect(bloco).toContain("<GerarReferencia");
    expect(bloco).toContain("negociacaoId={acordada.id}");
  });

  it("e o título diz em que pé está, em vez de mentir", () => {
    // «Trabalho concluído com a TRSul» sobre um trabalho que ainda não
    // aconteceu seria o ecrã a dar por feito o que falta fazer.
    expect(MESA).toContain("falta o trabalho acontecer");
  });
});

describe("mas a avaliação continua a esperar pelo fim", () => {
  it("não se pede uma nota sobre um trabalho que ainda não aconteceu", () => {
    expect(MESA).toContain("{!concluido ? null : acordada.avaliadoEm ? (");
  });
});

describe("o servidor já deixava — era o ecrã que escondia", () => {
  it("basta estar acordada e ter valor", () => {
    expect(ACESSO).toContain('if (linha.estado !== "acordada")');
    expect(ACESSO).toContain("Este trabalho ainda não está fechado.");
  });

  it("e nunca exigiu o trabalho confirmado", () => {
    /*
     * A prova de que a mudança é só de ecrã: se a porta do servidor exigisse
     * `confirmadoEm`, mostrar o botão mais cedo era mostrar um botão que dava
     * erro — e é assim que se ensina uma pessoa a desconfiar de um ecrã.
     */
    const i = ACESSO.indexOf("function trabalhoQueSePodePagar");
    const j = ACESSO.indexOf("export async function", i + 10);
    const corpo = j === -1 ? ACESSO.slice(i) : ACESSO.slice(i, j);
    expect(corpo).not.toContain("confirmadoEm");
  });
});
