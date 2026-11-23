import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * d85 — A ANTHROPIC NA POLÍTICA DE PRIVACIDADE, E O PRAZO DO REGISTO DA
 * VITÓRIA AGENTE (22-11-2026, Jurídico; CEO e dono).
 *
 *  - a purga da noite apaga `vitoriaAccoes` e `vitoriaEnsaios` aos
 *    DIAS_DE_RETENCAO_DOS_PEDIDOS dias, com o mesmo PURGA_ARMADA (a seco só
 *    conta), e nunca abaixo do que o custo do agente lê (32 dias);
 *  - a Política diz a Anthropic (secção 5), a transferência para fora da UE,
 *    o prazo do registo (secção 6, com a constante) e que a Vercel e o
 *    Railway correm em Singapura — nunca «na União Europeia»;
 *  - a condição da frase da secção 5: o telefone e o email do cliente nunca
 *    vão no pedido ao modelo.
 */

// Nos testes o JSX das páginas sai como `React.createElement`.
(globalThis as { React?: typeof React }).React = React;

const sqls = vi.hoisted(() => [] as string[]);
const fingida = vi.hoisted(() => ({ linhas: 3 }));
vi.mock("./vitoria-agente/na-base", () => ({
  garantirTabelas: async () => ({
    execute: async (sql: string) => {
      sqls.push(sql);
      return sql.startsWith("SELECT") ? [[{ n: fingida.linhas }], []] : [{ affectedRows: fingida.linhas }, []];
    },
  }),
}));
// O dia da página: depois de 15-11 (o modelo novo), no dia desta decisão.
vi.mock("@/lib/relogio-do-modelo", () => ({ agoraDoModelo: () => new Date("2026-11-22T12:00:00Z") }));
vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  taxasActuais: async () => ({ cliente: 0, profissional: 0.1 }),
}));

import { DIAS_DE_RETENCAO_DOS_PEDIDOS } from "./retencao";
import {
  DIAS_QUE_O_CUSTO_DO_AGENTE_LE,
  purgarRegistoDaVitoriaAgente,
  TABELAS_DO_REGISTO_DA_VITORIA_AGENTE,
} from "./vitoria-agente/purga-do-registo";
import { conversaAnonimizada } from "./vitoria-agente/anonimizar";
import { correrOAgente, type ClienteDoClaude } from "./vitoria-agente/cliente";
import type { DependenciasDasFerramentas, PedidoParaOAgente } from "./vitoria-agente/ferramentas";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários (só os que começam a linha, e os blocos JSX/JS). */
const semComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^\s*\/\/.*$/gm, "");
const texto = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");

/* ── A purga ─────────────────────────────────────────────────────────────── */

describe("a purga do registo da Vitória agente", () => {
  it("as duas tabelas, com o prazo da constante, na purga da noite e com o PURGA_ARMADA", () => {
    expect(TABELAS_DO_REGISTO_DA_VITORIA_AGENTE).toEqual(["vitoriaAccoes", "vitoriaEnsaios"]);
    const rota = semComentarios(ler("src/app/api/cron/purgar-pedidos/route.ts"));
    expect(rota).toContain('import("@/lib/vitoria-agente/purga-do-registo")');
    expect(rota).toContain("purgarRegistoDaVitoriaAgente(DIAS_DE_RETENCAO_DOS_PEDIDOS, { aSerio: armada })");
    // Dentro de um passo secundário: uma falha não estraga o resumo da noite.
    expect(rota).toMatch(/passoSecundario\(\s*"registo da Vitória agente"/);
    // E entra na conta do «nada para fazer».
    expect(rota).toContain("registoDaVitoriaAgente === 0");
  });

  it("a sério apaga as linhas com mais de 60 dias das duas tabelas; a seco só conta", async () => {
    sqls.length = 0;
    expect(await purgarRegistoDaVitoriaAgente(DIAS_DE_RETENCAO_DOS_PEDIDOS, { aSerio: true })).toBe(6);
    expect(sqls).toEqual([
      `DELETE FROM vitoriaAccoes WHERE criadoEm < NOW() - INTERVAL ${DIAS_DE_RETENCAO_DOS_PEDIDOS} DAY LIMIT 5000`,
      `DELETE FROM vitoriaEnsaios WHERE criadoEm < NOW() - INTERVAL ${DIAS_DE_RETENCAO_DOS_PEDIDOS} DAY LIMIT 5000`,
    ]);
    sqls.length = 0;
    expect(await purgarRegistoDaVitoriaAgente(DIAS_DE_RETENCAO_DOS_PEDIDOS, { aSerio: false })).toBe(6);
    expect(sqls.every((s) => s.startsWith("SELECT COUNT(*)"))).toBe(true);
    expect(sqls.some((s) => s.includes("DELETE"))).toBe(false);
  });

  it("o custo do agente (32 dias para trás) continua certo: o prazo nunca desce abaixo disso", async () => {
    expect(DIAS_DE_RETENCAO_DOS_PEDIDOS).toBeGreaterThanOrEqual(DIAS_QUE_O_CUSTO_DO_AGENTE_LE);
    expect(ler("src/lib/vitoria-agente/na-base.ts")).toContain(`INTERVAL ${DIAS_QUE_O_CUSTO_DO_AGENTE_LE} DAY`);
    sqls.length = 0;
    await purgarRegistoDaVitoriaAgente(7, { aSerio: true });
    expect(sqls[0]).toContain(`INTERVAL ${DIAS_QUE_O_CUSTO_DO_AGENTE_LE} DAY`);
  });
});

/* ── O telefone e o email nunca vão ao modelo ────────────────────────────── */

describe("o pedido ao modelo não leva o telefone nem o email do cliente", () => {
  it("nem na conversa, nem nas ferramentas (o pedido, os pedidos, a conversa, as propostas)", async () => {
    const TELEFONE = "+351 912 345 678";
    const EMAIL = "maria.exemplo@correio.pt";
    const pedido = {
      id: 501,
      serviceType: "recolha",
      status: "pendente",
      city: "Almada",
      contactName: "Maria Exemplo",
      contactPhone: "912345678",
      contactEmail: EMAIL,
      address: "Rua das Flores 12",
      postalCode: "2800-100",
      floor: "3",
      hasElevator: "sim",
      description: `Um sofá. Liguem para ${TELEFONE} ou escrevam para ${EMAIL}.`,
    } as unknown as PedidoParaOAgente;
    const quem = [{ contactName: "Maria Exemplo", address: "Rua das Flores 12" }];
    const fio = [
      { direccao: "in", texto: `Olá, sou a Maria Exemplo, o meu número é ${TELEFONE} e o email ${EMAIL}` },
      { direccao: "out", texto: `Obrigada! Enviámos o link para ${EMAIL}.` },
      { direccao: "in", texto: "Já há propostas?" },
    ];
    const deps: DependenciasDasFerramentas = {
      telefone: "351912345678",
      agora: new Date("2026-11-22T11:00:00Z"),
      pedidosDoTelefone: async () => [501],
      lerPedido: async (id) => (id === 501 ? pedido : null),
      lerConversa: async () => conversaAnonimizada(fio, quem),
      propostasDoPedido: async () => "Pedido #501:\n• Recolhas Teste: 61,50 € (à sua espera)",
      oQueOSiteSabe: () => "Serviços e preços de referência.",
    };
    const pedidos: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
    const respostas = [
      {
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "a", name: "pedidos_do_cliente", input: {} },
          { type: "tool_use", id: "b", name: "ler_pedido", input: { pedido: 501 } },
          { type: "tool_use", id: "c", name: "ler_conversa", input: { mensagens: 40 } },
          { type: "tool_use", id: "d", name: "propostas_vivas", input: { pedido: 501 } },
          { type: "tool_use", id: "e", name: "o_que_falta", input: { pedido: 501 } },
        ],
      },
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "f", name: "passar_a_equipa", input: { motivo: "teste" } }] },
      { stop_reason: "end_turn", content: [] },
    ];
    const cliente: ClienteDoClaude = {
      beta: {
        messages: {
          create: async (p) => {
            pedidos.push(JSON.parse(JSON.stringify(p)));
            const r = respostas.shift()!;
            return { id: "m", type: "message", role: "assistant", model: "claude-sonnet-5-5", usage: { input_tokens: 1, output_tokens: 1 }, ...r } as unknown as Anthropic.Beta.BetaMessage;
          },
        },
      },
    };
    const r = await correrOAgente(
      { conversa: conversaAnonimizada(fio, quem), pedidos: [501], agora: deps.agora },
      { cliente, ferramentas: deps, gastoETecto: async () => ({ gastoUsd: 0, tectoUsd: 10 }), registar: async () => {} },
    );
    expect(r.estado).toBe("equipa");
    expect(pedidos.length).toBeGreaterThanOrEqual(2);
    const tudo = JSON.stringify(pedidos);
    // As ferramentas responderam (o teste não passa por não terem corrido).
    expect(tudo).toContain("Almada");
    expect(tudo).toContain("Recolhas Teste");
    for (const proibido of ["912345678", "912 345 678", "351912345678", EMAIL, "correio.pt", "Maria Exemplo", "Rua das Flores", "2800-100"]) {
      expect(tudo, proibido).not.toContain(proibido);
    }
  });
});

/* ── A página ────────────────────────────────────────────────────────────── */

describe("a Política de Privacidade (d85)", () => {
  async function pagina(): Promise<string> {
    const mod = await import("@/app/privacidade/page");
    return renderToStaticMarkup(React.createElement(mod.default));
  }
  const seccao = (html: string, id: string) => {
    const i = html.indexOf(`id="${id}"`);
    expect(i, id).toBeGreaterThan(-1);
    const fim = html.indexOf("<section", i + 1);
    return texto(html.slice(i, fim > -1 ? fim : undefined));
  };

  it("a Anthropic e a transferência na secção 5; o prazo do registo na 6, com a constante", { timeout: 120_000 }, async () => {
    const html = await pagina();
    const cinco = seccao(html, "partilha");
    expect(cinco).toContain("Assistente do WhatsApp — Anthropic (Anthropic Ireland, Limited, e o grupo Anthropic nos Estados Unidos)");
    expect(cinco).toContain("Não recebe o seu número de telefone nem o seu email.");
    expect(cinco).toContain("Transferência para fora da União Europeia.");
    expect(cinco).toContain("(Decisão de Execução (UE) 2021/914)");
    expect(cinco.indexOf("Transferência para fora da União Europeia.")).toBeLessThan(cinco.indexOf("Não vendemos dados a terceiros"));
    const seis = seccao(html, "conservacao");
    expect(seis).toContain(`Registo do que a assistente do WhatsApp fez e os testes dela: ${DIAS_DE_RETENCAO_DOS_PEDIDOS} dias.`);
    const fonte = ler("src/app/privacidade/page.tsx");
    expect(fonte).toMatch(/os testes dela:<\/strong>\{" "\}\s*\{DIAS_DE_RETENCAO_DOS_PEDIDOS\} dias\./);
  });

  it("a Vercel e o Railway em Singapura, com as cláusulas-tipo — nunca «na União Europeia»", { timeout: 120_000 }, async () => {
    const t = texto(await pagina());
    expect(t).not.toMatch(/(Vercel|Railway)[^.]*na União Europeia/);
    expect(t).not.toContain("ambos na União Europeia");
    expect(t).toContain("correm em Singapura, fora da União Europeia");
    expect(t).toContain("acordos de tratamento de dados da Vercel e do Railway");
    // d6 (23-11-2026): o limitador de pedidos, nos Estados Unidos, também se diz.
    expect(t).toContain("O limitador de pedidos (que conta as tentativas por endereço, para travar abusos) corre nos Estados Unidos.");
    // O Google (Gemini) também diz a transferência.
    expect(t).toMatch(/O Google pode tratar estes dados nos Estados Unidos, ao abrigo das cláusulas contratuais-tipo/);
  });

  it("os outros pontos do Jurídico, a data, e as secções como estavam", { timeout: 120_000 }, async () => {
    const html = await pagina();
    const t = texto(html);
    expect(t).toContain("Última atualização: 23 de novembro de 2026.");
    expect(t).toContain("Conversas com a assistente do WhatsApp:");
    expect(t).toContain("através da Vitória, a nossa assistente automática");
    expect(t).toContain("sem nome, telefone, email, morada nem código postal");
    expect(t).toContain("É também nesta base que a assistente do WhatsApp responde às suas mensagens e anota o seu pedido.");
    expect(t).toContain("para testar a assistente do WhatsApp com conversas sem os dados que o identificam");
    expect(seccao(html, "direitos")).toContain("Falar com uma pessoa");
    expect(seccao(html, "app-pro")).toContain("e Anthropic , quando um cliente pergunta pelas propostas no WhatsApp");
    // Fase 4: as guardas do SIM/CANCELAR ainda não se publicam.
    expect(t).not.toMatch(/\bSIM\b|CANCELAR|500 €/);
    // A numeração não muda (a Google Play fala das secções 11 a 14).
    for (const [id, n] of [["app-pro", 11], ["apagar-conta", 12], ["app-cliente", 13], ["apagar-conta-cliente", 14]] as const) {
      expect(html).toMatch(new RegExp(`id="${id}"[^>]*>\\s*<h2[^>]*>${n}\\.`));
    }
  });
});
