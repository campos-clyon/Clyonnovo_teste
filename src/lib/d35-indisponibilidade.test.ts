import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INDISPONIVEL_NESTE_DIA,
  cruzarComOPedido,
  indisponibilidadeParaAApi,
  janelaDoPedido,
  lerIndisponibilidade,
  notaDeIndisponibilidade,
  trabalhosEmCima,
  type Indisponibilidade,
} from "./indisponibilidade";

/** d35 — 15-11-2026: a indisponibilidade do profissional. Cada regra tem o seu teste. */

const RAIZ = join(__dirname, "..", "..");
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8");
const agora = new Date("2026-11-15T10:00:00Z"); // domingo, 10:00 em Lisboa (Inverno)

const marcada = (p: Parameters<typeof lerIndisponibilidade>[0], quando = agora): Indisponibilidade => {
  const r = lerIndisponibilidade(p, quando);
  if (!r.ok) throw new Error(r.erro);
  return { id: 1, providerId: 7, ...r.valor };
};

describe("marcar: dia inteiro, vários dias, ou horas — em hora de Lisboa", () => {
  it("um dia inteiro vai da meia-noite à meia-noite de Lisboa", () => {
    const i = marcada({ dia: "2026-11-20" });
    expect(i.diaInteiro).toBe(true);
    expect(i.inicioEm.toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect(i.fimEm.toISOString()).toBe("2026-11-21T00:00:00.000Z");
  });

  it("no Verão a meia-noite de Lisboa é às 23:00 UTC do dia antes", () => {
    const i = marcada({ dia: "2027-07-01" });
    expect(i.inicioEm.toISOString()).toBe("2027-06-30T23:00:00.000Z");
  });

  it("vários dias seguidos: o último conta inteiro", () => {
    const i = marcada({ dia: "2026-11-20", ate: "2026-11-22" });
    expect(i.fimEm.toISOString()).toBe("2026-11-23T00:00:00.000Z");
    expect(indisponibilidadeParaAApi(i)).toMatchObject({ dia: "2026-11-20", ate: "2026-11-22", inicio: null, texto: "20/11 a 22/11" });
  });

  it("umas horas de um dia", () => {
    const i = marcada({ dia: "2026-11-20", inicio: "14:00", fim: "18:00" });
    expect(i.diaInteiro).toBe(false);
    expect(indisponibilidadeParaAApi(i)).toMatchObject({ inicio: "14:00", fim: "18:00", texto: "20/11, das 14:00 às 18:00" });
  });

  it("recusa o que não faz sentido", () => {
    expect(lerIndisponibilidade({ dia: "2026-11-14" }, agora).ok).toBe(false); // passou
    expect(lerIndisponibilidade({ dia: "2026-02-30" }, agora).ok).toBe(false);
    expect(lerIndisponibilidade({ dia: "2026-11-20", ate: "2026-11-19" }, agora).ok).toBe(false);
    expect(lerIndisponibilidade({ dia: "2026-11-20", ate: "2027-02-01" }, agora).ok).toBe(false); // > 60 dias
    expect(lerIndisponibilidade({ dia: "2026-11-20", inicio: "18:00", fim: "14:00" }, agora).ok).toBe(false);
    expect(lerIndisponibilidade({ dia: "2026-11-20", inicio: "14:00" }, agora).ok).toBe(false);
    expect(lerIndisponibilidade({ dia: "2026-11-20", ate: "2026-11-21", inicio: "14:00", fim: "16:00" }, agora).ok).toBe(false);
    expect(lerIndisponibilidade({ dia: "2026-11-15" }, agora).ok).toBe(true); // hoje pode-se
  });
});

describe("a distribuição: data certa não vai, data vaga vai com a nota", () => {
  const dia20 = marcada({ dia: "2026-11-20" });
  const tarde20 = marcada({ dia: "2026-11-20", inicio: "14:00", fim: "18:00" });

  it("data com hora dentro do período → indisponível", () => {
    const j = janelaDoPedido({ dataAgendada: "2026-11-20T15:00:00Z" }, agora);
    expect(cruzarComOPedido(j, [tarde20])).toMatchObject({ estado: "indisponivel", texto: INDISPONIVEL_NESTE_DIA });
    expect(cruzarComOPedido(j, [dia20]).estado).toBe("indisponivel");
  });

  it("as 2 horas do trabalho contam: às 13:00, com as 14–18 marcadas, cruza", () => {
    const j = janelaDoPedido({ dataAgendada: "2026-11-20T13:00:00Z" }, agora);
    expect(cruzarComOPedido(j, [tarde20]).estado).toBe("indisponivel");
    const cedo = janelaDoPedido({ dataAgendada: "2026-11-20T09:00:00Z" }, agora);
    expect(cruzarComOPedido(cedo, [tarde20]).estado).toBe("livre");
  });

  it("só o dia (00:00 de Lisboa): o dia inteiro marcado bloqueia; umas horas só avisam", () => {
    const j = janelaDoPedido({ dataAgendada: "2026-11-20T00:00:00Z" }, agora);
    expect(j).toMatchObject({ tipo: "certa", comHora: false });
    expect(cruzarComOPedido(j, [dia20]).estado).toBe("indisponivel");
    expect(cruzarComOPedido(j, [tarde20]).estado).toBe("nota");
  });

  it("«amanhã» é um dia certo, contado do dia do pedido", () => {
    const j = janelaDoPedido({ urgency: "amanha", criadoEm: "2026-11-19T10:00:00Z" }, agora);
    expect(cruzarComOPedido(j, [dia20]).estado).toBe("indisponivel");
  });

  it("«esta semana», «na próxima semana» e sem data → vai, com a nota", () => {
    for (const urgency of ["esta_semana", "proxima_semana", null]) {
      const j = janelaDoPedido({ urgency, criadoEm: "2026-11-15T10:00:00Z" }, agora);
      expect(j.tipo).toBe("vaga");
      const c = cruzarComOPedido(j, [dia20]);
      expect(c.estado, String(urgency)).toBe("nota");
      expect(c.texto).toMatch(/^Tem indisponibilidade nesses dias/);
    }
  });

  it("fora da janela, nada", () => {
    const j = janelaDoPedido({ dataAgendada: "2026-11-25T10:00:00Z" }, agora);
    expect(cruzarComOPedido(j, [dia20]).estado).toBe("livre");
    expect(notaDeIndisponibilidade({ dataAgendada: "2026-11-25T10:00:00Z" }, [dia20], agora)).toBeNull();
  });

  it("um trabalho marcado em cima do período pede confirmação", () => {
    const t = { inicio: new Date("2026-11-20T10:00:00Z"), fim: new Date("2026-11-20T12:00:00Z") };
    expect(trabalhosEmCima(dia20, [t])).toHaveLength(1);
    expect(trabalhosEmCima(tarde20, [t])).toHaveLength(0);
  });
});

describe("as ligações: distribuição, backoffice, painel e API", () => {
  it("a distribuição tira os indisponíveis — só quando a regra decide (não nos escolhidos à mão pela equipa)", () => {
    const s = ler("src/lib/distribuir-pedido.ts");
    expect(s).toMatch(/if \(!soPara \|\| exigirElegibilidade\) \{\s*const cruzamentos = await cruzamentosDoPedido\(/);
    expect(s).toMatch(/\?\.estado === "indisponivel"\) \{\s*elegiveis\.splice\(i, 1\);/);
    expect(s).toContain('indisponivel: "marcaram-se indisponíveis nesse dia"');
  });

  it("o backoffice mostra, não bloqueia — no alcance, no Atribuir directamente e no formulário da oferta", () => {
    expect(ler("src/lib/distribuir-pedido.ts")).toMatch(/t\.indisponibilidade = c \?/);
    expect(ler("src/app/api/admin/negociacoes/alcance/route.ts")).toMatch(/avaliarAlcance\(\{\s*pedidoId,/);
    const rota = ler("src/app/api/admin/indisponibilidades/route.ts");
    expect(rota).toContain("await requireAdmin(req)");
    for (const f of ["src/components/admin/AtribuirDirectamente.tsx", "src/components/admin/FormularioDaOferta.tsx"]) {
      const c = ler(f);
      expect(c, f).toContain("/api/admin/indisponibilidades?pedidoId=");
      expect(c, f).toContain("indisponível neste dia");
    }
  });

  it("a API do profissional: o providerId vem da sessão, e desmarcar só apaga o que é dele", () => {
    const rota = ler("src/app/api/profissionais/indisponibilidades/route.ts");
    expect(rota).toContain("sessaoActivaDoProfissional(tokenDoProfissional(req))");
    expect(rota).toContain("export async function GET");
    expect(rota).toContain("export async function POST");
    expect(rota).toContain("export async function DELETE");
    expect(rota).toContain("precisaConfirmar: true");
    const base = ler("src/lib/indisponibilidades-na-base.ts");
    expect(base).toContain("DELETE FROM indisponibilidades WHERE id = ? AND providerId = ?");
    expect(base).toContain("CREATE TABLE IF NOT EXISTS indisponibilidades");
  });

  it("o painel: marcar e desmarcar na Agenda, e a nota nos pedidos por decidir", () => {
    expect(ler("src/app/profissionais/painel/Agenda.tsx")).toContain("<Indisponibilidades />");
    expect(ler("src/app/profissionais/painel/Indisponibilidades.tsx")).toContain("window.confirm(");
    expect(ler("src/app/api/profissionais/meus-pedidos/route.ts")).toContain("indisponibilidadeNoPedido:");
    expect(ler("src/app/profissionais/painel/Trabalhos.tsx")).toContain("pedido.indisponibilidadeNoPedido");
  });

  it("apagar a conta apaga a agenda dele", () => {
    expect(ler("src/lib/db.ts")).toContain('DELETE FROM indisponibilidades WHERE providerId = ?');
  });
});
