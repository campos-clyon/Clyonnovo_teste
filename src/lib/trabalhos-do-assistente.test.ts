import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detalheDaComissao } from "./assistentes";
import { paraCsv } from "@/components/admin/TrabalhosDoAssistente";

/**
 * *«Quero mais detalhes dos trabalhos feitos para saber quais trabalhos o
 * assistente fez, para justificar os valores.»* — 29-09-2026.
 *
 * O cartão da Miriam dizia «4 concluídos · 22,88 €» e calava-se sobre quais.
 *
 * ⚠️ O DETALHE TEM DE SOMAR EXACTAMENTE O MESMO QUE O CARTÃO. Um extracto que
 * dá 22,87 € ao lado de um total de 22,88 € é pior do que não ter extracto: é
 * a prova de que um dos dois está errado, entregue à pessoa a quem se paga.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a conta linha a linha", () => {
  it("só os concluídos contam, e com a percentagem da CLYON e a dela", () => {
    const r = detalheDaComissao(
      [
        { id: 1, status: "concluido", valorAcordado: "100.00" },
        { id: 2, status: "em_analise", valorAcordado: "300.00" },
      ],
      11,
      40,
    );
    expect(r.trabalhos[0]).toMatchObject({ conta: true, valor: 100, comissaoClyon: 11, comissaoAssistente: 4.4 });
    expect(r.trabalhos[1].conta).toBe(false);
    expect(r.trabalhos[1].comissaoAssistente).toBe(0);
    expect(r.totais).toEqual({ valorConcluido: 100, comissaoClyon: 11, comissaoAssistente: 4.4 });
  });

  /*
   * A MESMA ORDEM DO COALESCE do cartão: acordado → preço final → estimativa.
   * E diz qual foi, porque «de onde veio este valor?» é a primeira pergunta.
   */
  it("o valor vem de onde vem no cartão, e diz de onde", () => {
    const r = detalheDaComissao(
      [
        { id: 1, status: "concluido", valorAcordado: 80, precoFinal: 90, estimateTotal: 100 },
        { id: 2, status: "concluido", precoFinal: 90, estimateTotal: 100 },
        { id: 3, status: "concluido", estimateTotal: 100 },
        { id: 4, status: "concluido" },
      ],
      10,
      50,
    );
    expect(r.trabalhos.map((t) => [t.valor, t.fonteDoValor])).toEqual([
      [80, "acordado"],
      [90, "preco_final"],
      [100, "estimativa"],
      [0, "sem_valor"],
    ]);
    expect(r.totais.valorConcluido).toBe(270);
  });

  /*
   * O TOTAL NÃO É A SOMA DAS LINHAS ARREDONDADAS — é a conta do cartão: soma
   * dos valores primeiro, percentagens depois. Três trabalhos de 33,33 € a
   * 11 % dão 3,67 € cada arredondado (11,01 €), mas o cartão diz 11 € certos.
   * O total tem de ser o do cartão, e é esse que se paga.
   */
  it("o total é calculado como o cartão, e não somando cêntimos arredondados", () => {
    const r = detalheDaComissao(
      [1, 2, 3].map((id) => ({ id, status: "concluido", valorAcordado: "33.33" })),
      11,
      100,
    );
    const somaDasLinhas = r.trabalhos.reduce((s, t) => s + t.comissaoClyon, 0);
    expect(Math.round(somaDasLinhas * 100) / 100).toBe(11.01);
    expect(r.totais.comissaoClyon).toBe(11);
  });

  it("valores em texto da base não viram NaN", () => {
    const r = detalheDaComissao([{ id: 1, status: "concluido", valorAcordado: "", precoFinal: null, estimateTotal: "abc" }], 11, 40);
    expect(r.trabalhos[0].fonteDoValor).toBe("sem_valor");
    expect(r.totais.comissaoAssistente).toBe(0);
  });
});

/**
 * O CARTÃO E O DETALHE LÊEM A MESMA COISA.
 *
 * Se alguém mudar a ordem do COALESCE no cartão e não no detalhe, os dois
 * números passam a discordar em silêncio. Estes testes olham para o SQL dos
 * dois e exigem a mesma regra.
 */
describe("o detalhe e o cartão não se podem separar", () => {
  const LIB = ler("src/lib/assistentes.ts");

  it("o cartão usa acordado → preço final → estimativa", () => {
    expect(LIB).toContain("COALESCE(n.valorAcordado, o.precoFinal, o.estimateTotal, 0)");
  });

  it("os dois só contam negociações confirmadas pelo cliente", () => {
    const confirmadas = LIB.match(/WHERE (x\.)?confirmadoEm IS NOT NULL/g) ?? [];
    expect(confirmadas.length).toBe(2);
  });

  it("os dois escolhem os pedidos pelo mesmo responsável", () => {
    expect(LIB).toContain("WHERE o.assignedToId IN (");
    expect(LIB).toContain("WHERE o.assignedToId = ?");
  });

  it("é a mesma porta de administrador — um assistente não vê a comissão de outro", () => {
    const ROTA = ler("src/app/api/admin/assistentes/route.ts");
    const get = ROTA.slice(ROTA.indexOf("export async function GET"), ROTA.indexOf("export async function POST"));
    expect(get).toContain("requireAdminGeral(req)");
    expect(get.indexOf("requireAdminGeral")).toBeLessThan(get.indexOf("trabalhosDoAssistente("));
  });
});

describe("o extracto para mandar à pessoa", () => {
  const d = {
    nome: "MIRIAM",
    comissaoPercent: 40,
    comissaoClyonPercent: 11,
    trabalhos: [
      {
        pedidoId: 346, estado: "concluido", conta: true, cliente: 'Ana "Tó" Silva', servico: "recolha_moveis",
        cidade: "Linda-a-Velha", profissional: "TRSul", atribuidoEm: null, actualizadoEm: null,
        valor: 40, fonteDoValor: "acordado" as const, comissaoClyon: 4.4, comissaoAssistente: 1.76,
      },
    ],
    totais: { valorConcluido: 40, comissaoClyon: 4.4, comissaoAssistente: 1.76 },
  };

  /*
   * `;` e vírgula decimal e BOM: é assim que o Excel português abre o ficheiro
   * com os acentos certos e os números como números. Com `,` a separar
   * colunas, cada valor em euros partia-se em duas células.
   */
  it("abre bem no Excel português", () => {
    const csv = paraCsv(d);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"#346";"concluido";"sim"');
    expect(csv).toContain('"40,00"');
    expect(csv).toContain('"TOTAL"');
    expect(csv).toContain('"1,76"');
  });

  it("aspas no nome de um cliente não partem a linha", () => {
    expect(paraCsv(d)).toContain('"Ana ""Tó"" Silva"');
  });
});
