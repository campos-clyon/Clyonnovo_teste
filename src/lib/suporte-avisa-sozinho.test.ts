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
    /*
     * E SÓ AS QUE ESTÃO À VISTA — 17-09-2026, quando apareceu o apagar.
     *
     * Contar uma conversa que ele apagou era mandá-lo procurar por uma coisa
     * que não está na lista, e a única forma de calar o selo seria repô-la.
     */
    expect(ROTA).toContain(
      "const aEsperar = semOsApagados(conversas, apagados).filter(porResponder).length",
    );
  });

  it("e sabe responder só com os números, para o menu não arrastar a lista toda", () => {
    expect(ROTA).toContain('searchParams.get("so") === "contagem"');
    // O que importa é a saída antecipada: o menu pergunta de dois em dois
    // minutos e não tem de receber todas as mensagens de todas as conversas.
    expect(ROTA).toContain("porLer: totalPorLer(");
    expect(ROTA).not.toMatch(/=== "contagem"[\s\S]{0,400}conversas: visiveis/);
  });

  /*
   * ⚠️ O SELO CONTA O QUE ESTÁ POR LER — 18-09-2026.
   *
   * *«Aqui no supp deve aparecer notificação apenas das mensagens não lidas.»*
   *
   * São duas perguntas e as duas fazem falta, cada uma no seu sítio: POR LER
   * apaga-se ao abrir e é o selo; POR RESPONDER só se apaga respondendo e é o
   * ponto amarelo da lista. Um selo que fica aceso depois de se ter lido tudo
   * ensina em dois dias a ignorar o número.
   */
  it("e sabe dizer quantas mensagens estão por ler", () => {
    expect(ROTA).toContain("leiturasDoSuporte(colab.id)");
    expect(ROTA).toContain("totalPorLer(semOsApagados(conversas, apagados), marcas)");
  });
});

describe("o selo do menu conta o que o painel mostra", () => {
  it("vai buscar a contagem das conversas", () => {
    expect(MENU).toContain("/api/admin/suporte/conversas?so=contagem");
  });

  it("e NÃO soma as duas contagens — os tickets da app já lá estão dentro", () => {
    // Somá-las contava-os duas vezes, e um selo que exagera deixa de valer.
    expect(MENU).not.toMatch(/soTickets \+ Number\(dc\./);
  });

  /*
   * O número do menu é o das mensagens POR LER, e não o das que esperam
   * resposta. `aEsperar` fica como recurso: se uma versão antiga da rota ainda
   * não souber responder `porLer`, um selo aproximado é melhor do que nenhum.
   */
  it("o selo conta as mensagens por ler", () => {
    expect(MENU).toContain("Number(dc.porLer ?? dc.aEsperar ?? soTickets)");
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

  it("e já não há botão nenhum para carregar", () => {
    /*
     * ESTE TESTE GUARDAVA O BOTÃO. O botão saiu a 16-09-2026: "remova o botão
     * actualizar e garanta que essas informações sejam actualizadas a cada 10s
     * sem que o admin perceba."
     *
     * O que ele guardava por baixo continua a valer, e é por isso que não se
     * apaga: `onClick={carregar}` passava o evento do clique como primeiro
     * argumento, e o evento é truthy — o carregamento ficava silencioso sem
     * ninguém pedir. Se algum dia voltar um botão, que volte com os parênteses.
     */
    expect(PAINEL).not.toContain("onClick={carregar}");
    expect(PAINEL).not.toContain("RefreshCw");
  });

  it("e não traz cadência própria — o ritmo é o do backoffice inteiro", () => {
    // "Vamos unificar tudo, fazer tudo actualizar junto em 20s com um único."
    // O número vive em useAutoRefresh.ts, uma vez.
    expect(PAINEL).not.toContain("intervalMs");
  });
});
