import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  TIPOS_QUE_O_CLIENTE_VE,
  TIPOS_DA_CONVERSA_COM_O_CLIENTE,
  entradasParaOCliente,
  historicoParaOCliente,
  oClienteVeEsteTipo,
} from "./historico-para-o-cliente";
import OrderDetailModal from "@/app/conta/components/OrderDetailModal";
import type { Order } from "@/app/conta/components/types";

// Nos testes o JSX sai como `React.createElement`, e precisa do `React` à mão.
(globalThis as { React?: typeof React }).React = React;

/**
 * A ÁREA DO CLIENTE SÓ MOSTRA O QUE É PARA O CLIENTE — 26-10-2026 (d33).
 *
 * O histórico de um pedido é o diário da equipa. A conta mostrava tudo o que
 * não era conversa, e a API mandava-o inteiro ao browser. Agora é uma lista
 * fechada, no servidor e no ecrã; um tipo que nasça amanhã fica escondido.
 *
 * Os textos abaixo têm a forma das notas reais, com nomes inventados.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/* Só os comentários que começam a linha — ver a memória dos testes que lêem o código. */
function semNotas(s: string): string {
  return s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
}

const EQUIPA = { id: 7, nome: "Ana Teste", role: "assistente" };

const INTERNAS = [
  {
    type: "created",
    by: null,
    message:
      "Pedido registado no backoffice por Ana Teste (chegou por fora do site). Serviço: recolha. Valor de partida: 120 €.",
    createdAt: "2026-10-20 10:00:00",
  },
  {
    type: "note",
    by: EQUIPA,
    message: "Ana Teste pediu ao cliente, por WhatsApp, as informações em falta: fotografias, andar.",
    createdAt: "2026-10-20 10:05:00",
  },
  {
    type: "note",
    by: EQUIPA,
    message: "Lucro da CLYON escrito por Ana Teste: 12,34 € sem IVA.",
    createdAt: "2026-10-20 10:06:00",
  },
  {
    type: "assigned",
    by: null,
    message: "Pedido atribuído automaticamente a Ana Teste.",
    createdAt: "2026-10-20 10:07:00",
  },
  {
    type: "agenda",
    by: null,
    message: "A CLYON (Ana Teste) marcou o trabalho de Pro Teste para 21/10. ATENÇÃO: o trabalho já estava fechado.",
    createdAt: "2026-10-20 10:08:00",
  },
  {
    type: "valor_corrigido",
    by: null,
    message: "Valor corrigido: o profissional recebe 98,76 €.",
    createdAt: "2026-10-20 10:09:00",
  },
];

const DESCONHECIDA = {
  type: "tipo_que_ainda_nao_existe",
  by: EQUIPA,
  message: "Nota de um tipo novo que ninguém pôs na lista.",
  createdAt: "2026-10-20 10:10:00",
};

const PARA_O_CLIENTE = [
  {
    type: "info_requested",
    by: EQUIPA,
    message: 'Pedido de informação enviado ao cliente: "Pode mandar uma fotografia?"',
    createdAt: "2026-10-20 11:00:00",
  },
  {
    type: "client_reply",
    by: { id: 0, nome: "Cliente Teste", role: "cliente" },
    message: "Mando já.",
    createdAt: "2026-10-20 11:05:00",
  },
  {
    type: "message_to_client",
    by: EQUIPA,
    message: "Recebemos a fotografia, obrigada.",
    createdAt: "2026-10-20 11:10:00",
  },
  {
    type: "client_confirmed",
    by: null,
    message: "Cliente confirmou o orçamento através da página de confirmação.",
    createdAt: "2026-10-20 12:00:00",
  },
  {
    type: "client_rating",
    by: null,
    message: "Cliente avaliou o serviço com 5 estrela(s).",
    createdAt: "2026-10-22 12:00:00",
  },
];

const HISTORICO = JSON.stringify([...INTERNAS, DESCONHECIDA, ...PARA_O_CLIENTE]);

describe("a lista fechada", () => {
  it("é esta, e só esta — um tipo novo entra de propósito, com um teste", () => {
    expect([...TIPOS_QUE_O_CLIENTE_VE].sort()).toEqual(
      [
        "client_cancelled",
        "client_confirmed",
        "client_rating",
        "client_reply",
        "info_requested",
        "message_to_client",
      ].sort(),
    );
    // A conversa é parte da lista, não uma porta à parte.
    for (const t of TIPOS_DA_CONVERSA_COM_O_CLIENTE) expect(oClienteVeEsteTipo(t)).toBe(true);
  });

  it("os tipos da equipa ficam de fora — o «created» também, porque mistura tudo", () => {
    for (const t of ["created", "note", "agenda", "assigned", "accepted", "approved", "archived", "valor_corrigido", "aviso_aceite_pelo_profissional"]) {
      expect(oClienteVeEsteTipo(t), t).toBe(false);
    }
  });

  it("um tipo desconhecido, vazio ou que não é texto fica escondido", () => {
    expect(oClienteVeEsteTipo("tipo_que_ainda_nao_existe")).toBe(false);
    expect(oClienteVeEsteTipo("")).toBe(false);
    expect(oClienteVeEsteTipo(undefined)).toBe(false);
    expect(oClienteVeEsteTipo(42)).toBe(false);
    // Nem com outra caixa: a lista compara-se à letra.
    expect(oClienteVeEsteTipo("Client_Reply")).toBe(false);
  });
});

describe("o que sai do servidor para o cliente", () => {
  const saida = historicoParaOCliente(HISTORICO);
  const entradas = JSON.parse(saida ?? "[]") as Array<Record<string, unknown>>;

  it("as notas internas não saem", () => {
    expect(saida).not.toBeNull();
    for (const n of INTERNAS) expect(saida).not.toContain(n.message);
    expect(saida).not.toContain("Valor de partida");
    expect(saida).not.toContain("Pedido registado no backoffice");
    expect(saida).not.toContain("informações em falta");
    expect(saida).not.toContain("Lucro da CLYON");
  });

  it("o tipo desconhecido também não", () => {
    expect(saida).not.toContain(DESCONHECIDA.message);
    expect(saida).not.toContain(DESCONHECIDA.type);
  });

  it("os tipos permitidos continuam lá, pela ordem em que foram gravados", () => {
    expect(entradas.map((e) => e.type)).toEqual(PARA_O_CLIENTE.map((e) => e.type));
    expect(entradas.map((e) => e.message)).toEqual(PARA_O_CLIENTE.map((e) => e.message));
    expect(entradas.map((e) => e.createdAt)).toEqual(PARA_O_CLIENTE.map((e) => e.createdAt));
  });

  it("de quem escreveu só vai o nome — nunca o id nem o papel", () => {
    expect(entradas[0].by).toEqual({ nome: "Ana Teste" });
    expect(entradas[3].by).toBeNull();
    for (const e of entradas) expect(Object.keys(e).sort()).toEqual(["by", "createdAt", "message", "type"]);
    expect(saida).not.toContain('"role"');
    expect(saida).not.toContain('"id"');
  });

  it("sem nada para o cliente, não sai nada", () => {
    expect(historicoParaOCliente(JSON.stringify(INTERNAS))).toBeNull();
    expect(historicoParaOCliente(null)).toBeNull();
    expect(historicoParaOCliente("")).toBeNull();
    expect(historicoParaOCliente("{partido")).toBeNull();
    expect(historicoParaOCliente('{"type":"client_reply"}')).toBeNull();
  });

  it("um Trabalho CLYON não leva histórico nenhum (02-10-2026)", () => {
    expect(historicoParaOCliente(HISTORICO, { trabalhoClyon: 1 })).toBeNull();
    expect(historicoParaOCliente(HISTORICO, { trabalhoClyon: "1" })).toBeNull();
    expect(historicoParaOCliente(HISTORICO, { trabalhoClyon: true })).toBeNull();
    expect(historicoParaOCliente(HISTORICO, { trabalhoClyon: 0 })).toBe(saida);
    expect(historicoParaOCliente(HISTORICO, { trabalhoClyon: null })).toBe(saida);
  });

  it("entradas sem mensagem ou que não são objectos ficam de fora", () => {
    const sujo = JSON.stringify([null, 3, "x", { type: "client_reply", message: "   " }, PARA_O_CLIENTE[1]]);
    expect(entradasParaOCliente(sujo).map((e) => e.message)).toEqual(["Mando já."]);
  });
});

function pedido(historyJson: string | null): Order {
  return {
    id: 999,
    serviceType: "recolha",
    address: "Rua Inventada 1",
    city: "Lisboa",
    postalCode: null,
    status: "concluido",
    estimateMin: null,
    estimateMax: null,
    estimateTotal: null,
    precoFinal: null,
    precoFinalIva: null,
    mensagemCliente: null,
    description: null,
    scheduledDate: null,
    scheduledStartTime: null,
    createdAt: "2026-10-20T10:00:00Z",
    updatedAt: "2026-10-22T12:00:00Z",
    confirmadoPeloCliente: 1,
    canceladoPeloCliente: 0,
    recurrenceFrequency: null,
    recurringDiscountPercent: null,
    clientRating: 5,
    clientRatingComment: null,
    providerId: null,
    assignedToId: null,
    assignedToName: null,
    providerName: null,
    providerPhone: null,
    historyJson,
    urgency: null,
    floor: null,
    hasElevator: null,
    parkingDistance: null,
    distanceKm: null,
    distanceText: null,
    filesJson: null,
    negociacoes: [],
  };
}

describe("o ecrã da conta", () => {
  // O ecrã recebe o histórico CRU, como se tivesse chegado por outro caminho:
  // filtra-o outra vez pela mesma função.
  const html = renderToStaticMarkup(
    React.createElement(OrderDetailModal, { order: pedido(HISTORICO), onClose: () => {} }),
  ).replace(/<!-- -->/g, "");

  it("não mostra nenhuma nota interna nem o tipo desconhecido", () => {
    for (const n of INTERNAS) expect(html).not.toContain(n.message);
    expect(html).not.toContain("Valor de partida");
    expect(html).not.toContain("Lucro da CLYON");
    expect(html).not.toContain("informações em falta");
    expect(html).not.toContain(DESCONHECIDA.message);
  });

  it("mostra a conversa e o que o cliente fez", () => {
    expect(html).toContain("Pode mandar uma fotografia?");
    expect(html).toContain("Mando já.");
    expect(html).toContain("Recebemos a fotografia, obrigada.");
    expect(html).toContain("O que já aconteceu");
    expect(html).toContain("Cliente confirmou o orçamento através da página de confirmação.");
  });

  it("filtra pela função da lista fechada, e não por uma lista sua", () => {
    const M = semNotas(ler("src/app/conta/components/OrderDetailModal.tsx"));
    const corpo = M.slice(M.indexOf("function parseHistory("), M.indexOf("\n}\n", M.indexOf("function parseHistory(")));
    expect(corpo).toContain("return entradasParaOCliente(json);");
    expect(corpo).not.toContain("JSON.parse");
    expect(M).not.toContain("CONVERSATION_TYPES");
    expect(M).toContain(".filter((e) => !eDaConversaComOCliente(e.type))");
  });
});

describe("as portas do servidor", () => {
  it("a lista da conta (API) passa pela lista fechada", () => {
    // Desde 28-10-2026 (d10) a API e o SSR da conta passam pela mesma função.
    const R = semNotas(ler("src/app/api/users/me/orders/route.ts"));
    expect(R).toContain("orders: rows.map((r) => pedidoDaContaParaOEcra(r,");
    const P = semNotas(ler("src/lib/pedidos-da-conta.ts"));
    expect(P).toContain("historyJson: historicoParaOCliente(pedido.historyJson, { trabalhoClyon: pedido.trabalhoClyon })");
    // Depois do `...pedido`, que traz o cru — a chave de baixo é a que fica.
    const mapa = P.slice(P.indexOf("export function pedidoDaContaParaOEcra"));
    expect(mapa.indexOf("...pedido,")).toBeGreaterThan(0);
    expect(mapa.indexOf("historyJson: historicoParaOCliente(")).toBeGreaterThan(mapa.indexOf("...pedido,"));
  });

  it("o SSR da conta faz o mesmo", () => {
    const C = semNotas(ler("src/lib/conta-server.ts"));
    expect(C).toContain("(o.valorFixoClyon IS NOT NULL) AS trabalhoClyon");
    expect(C).not.toMatch(/o\.valorFixoClyon\s*(,|AS\b)/);
    expect(C).toContain("orders: rows.map((r) => pedidoDaContaParaOEcra(r,");
  });

  it("a resposta do cliente devolve a lista fechada, e não o histórico inteiro", () => {
    const R = semNotas(ler("src/app/api/users/me/orders/[id]/reply/route.ts"));
    expect(R).toContain("historyJson: historicoParaOCliente(");
    expect(R).toContain("(valorFixoClyon IS NOT NULL) AS trabalhoClyon");
    expect(R).not.toMatch(/historyJson:\s*\(updated as any\)\?\.historyJson\s*\?\?\s*null\s*\}/);
  });

  it("nenhum sítio do lado do cliente lê o historyJson sem a lista fechada", () => {
    // As pastas do cliente: a conta, a página do pedido por link e as rotas dele.
    const raizes = [
      "src/app/conta",
      "src/app/pedido",
      "src/app/api/users",
      "src/app/api/conta",
      "src/app/api/negociacao",
      "src/lib/conta-server.ts",
      "src/lib/pedidos-da-conta.ts",
    ];
    // Só declara a forma do pedido — não lê nem devolve nada.
    const soOTipo = new Set(["src/app/conta/components/types.ts"]);
    const ficheiros: string[] = [];
    const andar = (p: string) => {
      const abs = join(process.cwd(), p);
      if (statSync(abs).isDirectory()) {
        for (const f of readdirSync(abs)) andar(`${p}/${f}`);
      } else if (/\.(ts|tsx)$/.test(p) && !/\.test\.ts$/.test(p)) {
        ficheiros.push(p);
      }
    };
    for (const r of raizes) andar(r);
    expect(ficheiros.length).toBeGreaterThan(5);

    const semFiltro = ficheiros.filter((f) => {
      if (soOTipo.has(f)) return false;
      const s = semNotas(ler(f));
      if (!s.includes("historyJson")) return false;
      // `pedidoDaContaParaOEcra` (d10) passa o histórico pela lista fechada.
      return (
        !s.includes("historicoParaOCliente(") &&
        !s.includes("entradasParaOCliente(") &&
        !s.includes("pedidoDaContaParaOEcra(")
      );
    });
    expect(semFiltro).toEqual([]);
  });
});
