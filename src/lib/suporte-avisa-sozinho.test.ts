import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O Suporte avisa sozinho, e conta o que o painel mostra.
 *
 * "enviei uma mensagem também como teste mas não recebi notificação no admin,
 * se eu atualizar o site e entrar em supp vejo mensagens novas (…) acho que
 * devo dar f5 para ver. Porém não devia ser assim, deve ser automático."
 * — 16-09-2026.
 *
 * Duas avarias diferentes no mesmo sítio:
 *
 * 1. O SELO contava `support_tickets`. A mensagem foi escrita DENTRO de um
 *    pedido, na conta do cliente — isso é uma conversa, não um ticket, e o
 *    menu nunca acendeu.
 * 2. O PAINEL não tinha ciclo de actualização. Era o único do backoffice sem
 *    ele: uma caixa de entrada que só mostrava o que havia quando a abriram.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const ROTA = ler("src/app/api/admin/suporte/conversas/route.ts");
const PAINEL = ler("src/components/admin/AdminConversasPanel.tsx");
const MENU = ler("src/components/admin/LegacyAdminClient.tsx");

describe("a rota sabe dizer quantos esperam por nós", () => {
  it("conta as conversas por responder", () => {
    expect(ROTA).toContain("const aEsperar = conversas.filter(porResponder).length");
  });

  it("e sabe responder só com o número, para o menu não arrastar a lista toda", () => {
    expect(ROTA).toContain('searchParams.get("so") === "contagem"');
    expect(ROTA).toContain("NextResponse.json({ aEsperar })");
  });
});

describe("o selo do menu conta o que o painel mostra", () => {
  it("vai buscar a contagem das conversas", () => {
    expect(MENU).toContain("/api/admin/suporte/conversas?so=contagem");
  });

  it("e NÃO soma as duas contagens — os tickets da app já lá estão dentro", () => {
    // Somá-las contava-os duas vezes, e um selo que exagera deixa de valer.
    expect(MENU).not.toMatch(/soTickets \+ Number\(dc\.aEsperar/);
    expect(MENU).toContain("Number(dc.aEsperar ?? soTickets)");
  });

  it("se a contagem falhar, fica a dos tickets — melhor incompleto do que nenhum", () => {
    expect(MENU).toContain("setTicketsPorTratar(soTickets)");
  });
});

describe("o painel actualiza-se sozinho", () => {
  it("usa o mesmo ciclo dos outros painéis", () => {
    expect(PAINEL).toContain('import { useAutoRefresh } from "@/components/admin/useAutoRefresh"');
    expect(PAINEL).toContain("useAutoRefresh(() => carregar(true)");
  });

  it("e pára enquanto se escreve uma resposta", () => {
    expect(PAINEL).toContain("paused: aEnviar");
  });

  it("o ciclo é silencioso: não pisca nem grita erros de rede", () => {
    expect(PAINEL).toContain("if (!silencioso) setACarregar(true)");
    expect(PAINEL).toContain('if (!silencioso) setErro("Erro de rede.")');
  });

  it("mas o botão Actualizar continua a ser barulhento", () => {
    // `onClick={carregar}` passava o evento do clique como primeiro argumento,
    // e o evento é truthy: o botão ficava silencioso sem ninguém pedir.
    expect(PAINEL).toContain("onClick={() => carregar()}");
    expect(PAINEL).not.toContain("onClick={carregar}");
  });
});
