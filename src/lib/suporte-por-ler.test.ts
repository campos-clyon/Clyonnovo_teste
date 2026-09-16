import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { porLer, porResponder, type ConversaDeSuporte } from "./conversas-de-suporte";

/**
 * O CONTADOR DE MENSAGENS POR LER, COMO NO WHATSAPP.
 *
 * "Já abri as 3 mensagens novas mas os pontos verdes ainda estão presentes."
 * — 16-09-2026.
 *
 * O ponto estava certo e respondia à pergunta errada. `porResponder` diz «a
 * bola está do nosso lado» e só se apaga quando se responde; isso é a fila de
 * trabalho. O que faltava era a notificação: «ainda não leu isto», que se apaga
 * ao abrir.
 *
 * As duas continuam a existir, e este ficheiro guarda que continuem SEPARADAS.
 * Juntá-las perde uma das duas: ou uma conversa lida deixa de aparecer na fila,
 * ou um contador nunca se apaga.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const conversa = (
  mensagens: Array<{ de: "eles" | "clyon"; quando: string }>,
): ConversaDeSuporte =>
  ({
    chave: "pedido:1",
    origem: "pedido",
    quem: "Alguém",
    contacto: null,
    assunto: null,
    pedidoId: 1,
    mensagens: mensagens.map((m, i) => ({ ...m, texto: `m${i}`, autor: null })),
  }) as unknown as ConversaDeSuporte;

describe("quantas estão por ler", () => {
  it("sem marca nenhuma, uma conversa nunca aberta está inteira por ler", () => {
    const c = conversa([
      { de: "eles", quando: "2026-09-16 10:00:00" },
      { de: "eles", quando: "2026-09-16 10:05:00" },
    ]);
    expect(porLer(c, null)).toBe(2);
    expect(porLer(c, undefined)).toBe(2);
  });

  it("o que nós escrevemos nunca conta", () => {
    // Uma resposta nossa não é uma mensagem por ler. Contá-la punha o contador
    // a subir sempre que alguém respondia.
    const c = conversa([
      { de: "eles", quando: "2026-09-16 10:00:00" },
      { de: "clyon", quando: "2026-09-16 10:01:00" },
      { de: "clyon", quando: "2026-09-16 10:02:00" },
    ]);
    expect(porLer(c, null)).toBe(1);
  });

  it("depois de aberta, fica a zero", () => {
    const c = conversa([
      { de: "eles", quando: "2026-09-16 10:00:00" },
      { de: "eles", quando: "2026-09-16 10:05:00" },
    ]);
    expect(porLer(c, "2026-09-16 10:06:00")).toBe(0);
  });

  it("e só conta as que chegaram DEPOIS de se ter lido", () => {
    // É isto que faz o número voltar a aparecer quando alguém escreve outra
    // vez, sem trazer de volta as que já se leram.
    const c = conversa([
      { de: "eles", quando: "2026-09-16 10:00:00" },
      { de: "eles", quando: "2026-09-16 11:00:00" },
      { de: "eles", quando: "2026-09-16 12:00:00" },
    ]);
    expect(porLer(c, "2026-09-16 10:30:00")).toBe(2);
  });

  it("uma mensagem exactamente na hora da marca conta como lida", () => {
    // A marca é gravada DEPOIS de a conversa abrir. Contar o empate como não
    // lida deixava o contador a um, para sempre, na última mensagem.
    const c = conversa([{ de: "eles", quando: "2026-09-16 10:00:00" }]);
    expect(porLer(c, "2026-09-16 10:00:00")).toBe(0);
  });

  it("uma marca ilegível vale o mesmo que nenhuma", () => {
    // O lado seguro do engano: mostrar de mais é incómodo, esconder uma
    // mensagem que ninguém viu é perder um cliente.
    const c = conversa([{ de: "eles", quando: "2026-09-16 10:00:00" }]);
    expect(porLer(c, "não é uma data")).toBe(1);
    expect(porLer(c, "")).toBe(1);
  });

  it("uma conversa sem mensagens conta zero, e não estoira", () => {
    expect(porLer(conversa([]), null)).toBe(0);
  });
});

describe("por ler e à espera de resposta são coisas diferentes", () => {
  it("lida, mas ainda à espera de nós", () => {
    /*
     * É o caso do ecrã: ele abriu as três, o contador foi a zero, e as
     * conversas continuam por responder. Se fossem a mesma coisa, abrir teria
     * tirado a conversa da fila de trabalho — e era pior do que o problema.
     */
    const c = conversa([{ de: "eles", quando: "2026-09-16 10:00:00" }]);
    expect(porLer(c, "2026-09-16 10:01:00")).toBe(0);
    expect(porResponder(c)).toBe(true);
  });

  it("respondida, mas com uma mensagem nova por ler", () => {
    // O contrário também existe: respondemos, ele escreveu outra vez, e nós
    // ainda não abrimos.
    const c = conversa([
      { de: "clyon", quando: "2026-09-16 10:00:00" },
      { de: "eles", quando: "2026-09-16 11:00:00" },
    ]);
    expect(porLer(c, "2026-09-16 10:30:00")).toBe(1);
    expect(porResponder(c)).toBe(true);
  });
});

describe("o ecrã", () => {
  const PAINEL = ler("src/components/admin/AdminConversasPanel.tsx");

  it("mostra o número, e não um ponto", () => {
    expect(PAINEL).toContain("porLer(c, lidas[c.chave])");
    expect(PAINEL).toContain("novas > 99");
  });

  it("marca como lida ao abrir", () => {
    expect(PAINEL).toContain("void marcarLida(c.chave)");
    expect(PAINEL).toContain('method: "PATCH"');
  });

  it("o contador desaparece no clique, sem esperar pela rede", () => {
    // Um badge que fica meio segundo depois do clique lê-se como «não
    // funcionou».
    const i = PAINEL.indexOf("const marcarLida");
    expect(i).toBeGreaterThan(-1);
    const corpo = PAINEL.slice(i, i + 700);
    expect(corpo.indexOf("setLidas(")).toBeLessThan(corpo.indexOf("fetch("));
  });

  it("não tem botão de actualizar", () => {
    // "Remova o botão actualizar e garanta que essas informações sejam
    // actualizadas a cada 10s sem que o admin perceba."
    expect(PAINEL).not.toContain("Actualizar\n");
    expect(PAINEL).not.toContain("RefreshCw");
  });

  it("actualiza-se sozinho, no pulso do backoffice inteiro", () => {
    // O ritmo vive em useAutoRefresh.ts e mais lado nenhum.
    expect(PAINEL).toContain("useAutoRefresh");
    expect(PAINEL).not.toContain("intervalMs");
  });

  it("e pára enquanto se escreve uma resposta", () => {
    // A lista não pode mudar por baixo de quem está a escrever.
    expect(PAINEL).toContain("paused: aEnviar");
  });
});

describe("os outros dois botões do Suporte", () => {
  it("saíram os três: as conversas, os tickets da app e a plataforma", () => {
    const AJUDA = ler("src/components/admin/AdminAjudaPanel.tsx");
    expect(AJUDA).not.toContain("RefreshCw");
    expect(AJUDA).toContain("useAutoRefresh");

    const ADMIN = ler("src/components/admin/LegacyAdminClient.tsx");
    const i = ADMIN.indexOf('activeSection === "suporte" && (');
    expect(i).toBeGreaterThan(-1);
    // Só a secção do suporte, e não o ficheiro todo: os outros ecrãs têm os
    // botões deles e não é disto que se trata.
    const seccao = ADMIN.slice(i, ADMIN.indexOf("Do centro de ajuda da app", i));
    expect(seccao).not.toContain("Actualizar");
  });

  it("e a lista de tickets ganhou o ciclo que o botão fazia à mão", () => {
    /*
     * Sem prender à secção aberta: o contador do menu tem de estar certo com
     * o Suporte fechado — é essa a razão de ele existir. A mesma batida serve
     * o contador e a lista, e deixam de poder discordar.
     */
    const ADMIN = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(ADMIN).toContain("carregarTickets(token, ticketsFiltro, true)");
    expect(ADMIN).toContain('enabled: Boolean(token) && podeVer("suporte")');
  });
});

describe("a marca de leitura é de cada pessoa", () => {
  it("guarda-se por colaborador, e não por conversa", () => {
    /*
     * Dois assistentes na mesma caixa têm cada um as suas mensagens por ler.
     * Partilhada, o primeiro a abrir escondia-a ao segundo — que é o contrário
     * do que um contador de não-lidas serve para fazer.
     */
    const DB = ler("src/lib/db.ts");
    expect(DB).toContain("CREATE TABLE IF NOT EXISTS suporteLido");
    expect(DB).toContain("PRIMARY KEY (colaboradorId, chave)");
  });

  it("a hora é a do servidor", () => {
    // As mensagens são gravadas com o relógio do servidor; um portátil dois
    // minutos adiantado marcava como lidas mensagens que ainda não chegaram.
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function marcarSuporteLido");
    expect(i).toBeGreaterThan(-1);
    expect(DB.slice(i, i + 900)).toContain("NOW()");
  });

  it("a rota recusa uma chave que não seja nossa", () => {
    const ROTA = ler("src/app/api/admin/suporte/conversas/route.ts");
    expect(ROTA).toContain("!chave || !lerChave(chave)");
  });
});
