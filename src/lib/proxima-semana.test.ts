import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { quandoEOTrabalho } from "./quando-e-o-trabalho";
import { interpretarQuando } from "./whatsapp-recolha";
import { taxaPorUrgencia } from "./taxa-agendamento";

/**
 * «PRÓXIMA SEMANA» — 10-10-2026. «Para Data e hora desejada vamos colocar
 * mais opções, ex.: essa semana ou na próxima.»
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const SABADO = "2026-10-10T10:00:00.000Z";

describe("a janela da próxima semana, no painel do profissional", () => {
  it("pedido a um sábado: de segunda 12 a domingo 18 de outubro", () => {
    const q = quandoEOTrabalho({ urgency: "next_week", criadoEm: SABADO }, new Date(SABADO));
    expect(q.curto).toBe("Próxima semana");
    expect(q.dia).toContain("12 de outubro");
    expect(q.dia).toContain("18 de outubro");
    expect(q.origem).toBe("janela");
    expect(q.passou).toBe(false);
    expect(q.hora).toBeNull();
  });

  it("quando essa semana chega, lê-se «esta semana»; quando passa, passou", () => {
    expect(quandoEOTrabalho({ urgency: "next_week", criadoEm: SABADO }, new Date("2026-10-14T10:00:00Z")).curto).toBe(
      "Esta semana",
    );
    const depois = quandoEOTrabalho({ urgency: "next_week", criadoEm: SABADO }, new Date("2026-10-19T10:00:00Z"));
    expect(depois.curto).toBe("Passou");
    expect(depois.passou).toBe(true);
  });

  it("pedido a uma segunda, é a segunda seguinte; a um domingo, é a de amanhã", () => {
    const segunda = quandoEOTrabalho({ urgency: "next_week", criadoEm: "2026-10-12T10:00:00Z" }, new Date("2026-10-12T10:00:00Z"));
    expect(segunda.dia).toContain("19 de outubro");
    const domingo = quandoEOTrabalho({ urgency: "next_week", criadoEm: "2026-10-11T10:00:00Z" }, new Date("2026-10-11T10:00:00Z"));
    expect(domingo.dia).toContain("12 de outubro");
  });

  it("um dia combinado continua a ganhar à janela", () => {
    const q = quandoEOTrabalho(
      { urgency: "next_week", criadoEm: SABADO, dataCombinada: "2026-10-15T09:00:00Z" },
      new Date(SABADO),
    );
    expect(q.origem).toBe("combinada");
  });
});

describe("o preço e as palavras", () => {
  it("sem taxa de urgência, como «esta semana»", () => {
    expect(taxaPorUrgencia("next_week")).toBe(0);
    expect(taxaPorUrgencia("this_week")).toBe(0);
  });

  it("o assistente do WhatsApp percebe «próxima semana» e «semana que vem»", () => {
    const agora = new Date(SABADO);
    expect(interpretarQuando("na próxima semana", agora)).toEqual({ data: null, urgency: "next_week" });
    expect(interpretarQuando("pode ser na semana que vem", agora)).toEqual({ data: null, urgency: "next_week" });
    expect(interpretarQuando("esta semana", agora)).toEqual({ data: null, urgency: "this_week" });
  });

  it("e todos os que dizem a urgência por palavras a sabem dizer", () => {
    for (const [ficheiro, texto] of [
      ["src/lib/translations.ts", 'next_week: "Próxima semana"'],
      ["src/lib/email-profissional.ts", 'next_week: "Próxima semana"'],
      ["src/lib/mensagem-whatsapp.ts", 'next_week: "para a próxima semana"'],
      ["src/lib/whatsapp-recolha.ts", 'next_week: "na próxima semana"'],
      ["src/app/pedido/[token]/VistaDoPedido.tsx", 'next_week: "Próxima semana"'],
      ["src/app/profissionais/painel/tipos.ts", 'next_week: "Próxima semana"'],
    ]) {
      expect(ler(ficheiro), ficheiro).toContain(texto);
    }
    for (const ficheiro of ["src/components/admin/PedidoDetailModal.tsx", "src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx"]) {
      expect(ler(ficheiro).match(/<option value="next_week"/g) ?? []).toHaveLength(2);
    }
  });
});

describe("no «Registar pedido»", () => {
  const R = ler("src/components/admin/RegistarPedido.tsx");

  it("os atalhos por cima do dia e hora, com a próxima semana", () => {
    const atalhos = R.slice(R.indexOf("const QUANDO_SEM_DIA"), R.indexOf("];", R.indexOf("const QUANDO_SEM_DIA")));
    for (const id of ["today", "tomorrow", "this_week", "next_week", "flexible"]) expect(atalhos).toContain(`id: "${id}"`);
    expect(atalhos).toContain('rotulo: "Próxima semana"');
  });

  it("um atalho apaga o dia, e um dia apaga o atalho", () => {
    expect(R).toContain('muda("urgency", o.id);\n                    muda("dataDesejada", "");');
    expect(R).toContain('if (e.target.value) muda("urgency", "flexivel");');
  });
});
