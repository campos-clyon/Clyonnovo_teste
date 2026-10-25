import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Os concluídos na mesa de pedidos.
 *
 * "O pedido do Gilberto foi realizado e marcado como concluído — esses
 * trabalhos têm que estar na categoria concluídos, e caso o admin ainda não
 * tenha aberto deve ficar destacado; e caso abra deve ver todos os detalhes
 * de negociações e valores completo."
 *
 * O carimbo de "já vi" vive numa tabela do SITE (concluidosVistos) e não
 * numa coluna de simulatorOrders — o contrato dessa tabela é o da app antiga.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const ROTA = ler("src/app/api/admin/negociacoes/route.ts");

describe("a categoria Concluídos", () => {
  it("os concluídos saem das listas de trabalho e ganham prateleira própria", () => {
    expect(MESA).toContain('p.status === "concluido"');
    expect(MESA).toContain('activos.filter((p) => quemNegoceia(p) === "clyon")');
    expect(MESA).toContain("Trabalhos confirmados e fechados");
  });

  it("a listagem traz o status e o carimbo do visto", () => {
    expect(DB).toContain("v.vistoEm AS concluidoVistoEm");
    expect(DB).toContain("LEFT JOIN concluidosVistos v ON v.pedidoId = o.id");
  });
});

describe("o destaque de por ver", () => {
  it("um concluído nunca aberto fica em realce, e a contagem aparece no título", () => {
    expect(MESA).toContain("const porVer = concluido && !p.concluidoVistoEm;");
    expect(MESA).toContain("ring-2 ring-emerald-400/40");
    expect(MESA).toContain("por ver");
  });

  it("abrir É ver: o carimbo grava-se no servidor ao abrir, sem botão próprio", () => {
    expect(MESA).toContain('accao: "concluido_visto"');
    // Com o «orçamento enviado» ao lado, desde 21-10-2026.
    // E «enviar_pela_clyon» desde 23-10-2026 (as negociações enviam pela CLYON).
    expect(ROTA).toContain('["concluido_visto", "orcamento_enviado", "enviar_pela_clyon"].includes(String(corpo.accao))');
    expect(ROTA).toContain("marcarConcluidoComoVisto");
    expect(DB).toContain("CREATE TABLE IF NOT EXISTS concluidosVistos");
  });
});

describe("as contas completas ao abrir", () => {
  it("o resumo diz o acordado, o que o cliente paga, a taxa, o que o profissional recebe e a comissão", () => {
    expect(MESA).toContain("Trabalho concluído com");
    /*
     * COM AS TAXAS DA NEGOCIAÇÃO, e não as de hoje — 21-09-2026.
     *
     * Este teste fixava as três chamadas SEM taxas, ou seja, com as constantes
     * de hoje. Estava a guardar um defeito: num trabalho pago em dinheiro a
     * negociação grava `profissional: 0`, e a mesa dizia «recebe 112,80 €» a
     * quem recebe 120,00 € em mão. As três passam a levar `taxasDela`.
     */
    expect(MESA).toContain("const taxasDela = taxasDaNegociacao(acordada);");
    /*
     * Desde 15-10-2026 o resumo é a conta em degraus (`contaDaLinha`), que
     * faz as mesmas três contas com as taxas que a negociação congelou — as
     * que lhe chegam aqui, e não as de hoje.
     */
    expect(MESA).toContain("const conta = contaDaLinha(");
    expect(MESA).toContain("taxaCliente: acordada.taxaCliente,");
    expect(MESA).toContain("taxaProfissional: acordada.taxaProfissional,");
  });
});
