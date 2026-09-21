import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * REDISTRIBUIR, À VISTA — E UMA NEGOCIAÇÃO MORTA DEIXA DE TRANCAR O PEDIDO.
 *
 * "Eu quero redistribuir esse pedido, mude o botão «Ficha e distribuição»
 *  para fazer isso." — 21-09-2026, sobre o #355.
 *
 * O botão já existia e só aparecia quando NINGUÉM tinha sido notificado. No
 * caso comum — chegou a oito, dois responderam, nenhum serve — o dono não o
 * via. E, mesmo que o visse, carregar não fazia nada: a distribuição saltava
 * quem já tinha uma negociação, fosse ela viva ou MORTA, e no #355 todos os
 * oito tinham. «Continua sem chegar a ninguém.»
 *
 * Duas coisas mudam, e a segunda é a que vale dinheiro: o botão fica à vista
 * em qualquer estado, e uma negociação morta — perdeu para outro — deixa de
 * contar como «já tem». Quem disse que não (desistida) continua em paz.
 *
 * E UMA TERCEIRA, que é um travão: um pedido FECHADO não se redistribui. O
 * cron já tinha essa regra por escrito; a rota não a tinha, e o botão passou
 * a estar onde um pedido fechado o mostra.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PAINEL = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
const ROTA = semComentarios(ler("src/app/api/admin/negociacoes/redistribuir/route.ts"));
const DISTRIBUIR = semComentarios(ler("src/lib/distribuir-pedido.ts"));

describe("o botão está à vista em qualquer estado", () => {
  it("«Ficha e distribuição» deixou de existir; «Redistribuir» chama a mesma função de sempre", () => {
    expect(PAINEL).not.toContain("Ficha e distribuição");
    // Duas ocorrências: a de sempre (quando ninguém foi notificado) e a nova.
    const chamadas = [...PAINEL.matchAll(/onClick=\{\(\) => redistribuir\(p\.id\)\}/g)];
    expect(chamadas.length).toBe(2);
  });

  it("e a ficha continua a um clique — não se tira um caminho para dar outro", () => {
    expect(PAINEL).toContain("onClick={() => setAEditar(p.id)}");
  });
});

describe("um pedido fechado não se redistribui", () => {
  it("a rota recusa com o nome de quem o tem, e diz o que fazer", () => {
    const i = ROTA.indexOf("export async function POST(");
    const corpo = ROTA.slice(i);
    expect(corpo).toContain('n.estado === "acordada"');
    expect(corpo).toContain("fechada.profissionalNome");
    expect(corpo).toContain("status: 409");
    // A recusa vem ANTES de distribuir — não é um aviso depois do estrago.
    expect(corpo.indexOf('n.estado === "acordada"')).toBeLessThan(corpo.indexOf("distribuirPedido("));
  });
});

describe("quem «já tem» o pedido — três casos, e não são iguais", () => {
  const i = DISTRIBUIR.indexOf("const linhasExistentes = ");
  const bloco = DISTRIBUIR.slice(i, DISTRIBUIR.indexOf("const receberam = ", i));

  it("viva não se toca; desistida fica em paz", () => {
    expect(i).toBeGreaterThan(-1);
    expect(bloco).toContain('new Set(["aberta", "aguarda_contratacao", "acordada"])');
    expect(bloco).toContain("jaTemViva.has(c.profissional.id) || disseQueNao.has(c.profissional.id)");
  });

  it("morta volta a receber — e é a linha dela que se reabre", () => {
    /*
     * Sem `reabrir` para essa linha, o `ON DUPLICATE KEY UPDATE` só fazia
     * `id = LAST_INSERT_ID(id)`: a linha continuava morta e o token novo não
     * era gravado. Ele recebia um email com um link que dava 404.
     */
    expect(bloco).toContain('n.estado === "morta"');
    expect(bloco).toContain("reabrir: reabrir || perdeuParaOutro.has(c.profissional.id)");
  });

  it("e já não existe o conjunto cego que trancava o pedido", () => {
    expect(DISTRIBUIR).not.toContain("const jaTemNegociacao = ");
  });
});
