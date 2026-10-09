import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COR_DA_CONTA_DE_TESTE,
  CORES_DOS_PROFISSIONAIS,
  coresDosProfissionais,
  coresPelaOrdem,
} from "./cores-dos-profissionais";

/**
 * UMA COR POR PROFISSIONAL NOS PAGAMENTOS — 09-10-2026.
 *
 * «Vc deve separar com cores diferentes e deixar os nomes das empresas
 * destacados.»
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("a roda das cores", () => {
  it("sete tons da paleta do dono, todos diferentes, sem âmbar, esmeralda nem ardósia", () => {
    expect(CORES_DOS_PROFISSIONAIS).toHaveLength(7);
    const tons = CORES_DOS_PROFISSIONAIS.map((c) => c.linha);
    expect(new Set(tons).size).toBe(7);
    const tudo = JSON.stringify(CORES_DOS_PROFISSIONAIS);
    // Âmbar é «por receber», esmeralda é «pago», ardósia é a conta de teste.
    expect(tudo).not.toMatch(/ambar|esmeralda|ardosia/);
    expect(COR_DA_CONTA_DE_TESTE.linha).toBe("border-l-ardosia");
    // Cada cor usa o mesmo tom no grupo, no nome e na faixa da linha.
    for (const c of CORES_DOS_PROFISSIONAIS) {
      const tom = c.linha.replace("border-l-", "");
      expect(c.grupo).toBe(`border-${tom}/40 border-l-${tom} bg-${tom}/14`);
      expect(c.nome).toBe(`text-${tom}-texto`);
    }
  });

  it("pela ordem alfabética, como os grupos: seguidos nunca repetem, e o mesmo pro tem sempre a mesma", () => {
    const cores = coresDosProfissionais([
      { id: 13, nome: "Revolution" },
      { id: 11, nome: "Manuel Martins transportes" },
      { id: 12, nome: "Nova Recolha" },
      { id: 13, nome: "Revolution" },
      { id: 14, nome: "TRSul" },
    ]);
    expect(cores.size).toBe(4);
    expect(cores.get(11)).toBe(CORES_DOS_PROFISSIONAIS[0]);
    expect(cores.get(12)).toBe(CORES_DOS_PROFISSIONAIS[1]);
    expect(cores.get(13)).toBe(CORES_DOS_PROFISSIONAIS[2]);
    expect(cores.get(14)).toBe(CORES_DOS_PROFISSIONAIS[3]);
  });

  it("dois com o mesmo nome não ficam com a mesma cor — o id desempata", () => {
    const cores = coresDosProfissionais([
      { id: 8, nome: "Mudanças Silva" },
      { id: 5, nome: "Mudanças Silva" },
    ]);
    expect(cores.get(5)).not.toBe(cores.get(8));
  });
});

describe("no painel dos Pagamentos", () => {
  const P = ler("src/components/admin/AdminPagamentosPanel.tsx");

  it("o grupo de cada profissional é uma caixa da cor dele, com o nome grande", () => {
    expect(P).toContain('const corDoGrupo = agrupamento === "profissional" && sg.linhas[0] ? corDe(sg.linhas[0]) : null;');
    expect(P).toContain("? `mt-3 rounded-xl border border-l-4 p-3 ${corDoGrupo.grupo}`");
    expect(P).toContain("<span className={corDoGrupo ? `text-base font-bold ${corDoGrupo.nome}` : undefined}>");
  });

  it("as contas de teste ficam a cinzento e não gastam cor da roda", () => {
    expect(P).toContain("t.contaDeTeste ? COR_DA_CONTA_DE_TESTE : (coresDosPros.get(t.providerId) ?? null);");
    expect(P).toContain("actual.linhas.filter((t) => !t.contaDeTeste).map((t) => ({ id: t.providerId, nome: t.profissional })),");
  });

  it("cada linha leva a faixa e o nome na cor do profissional — também quando se separa por dia", () => {
    expect(P).toContain("cor={corDe(t)}");
    expect(P).toContain('} ${cor ? `border-l-4 ${cor.linha}` : ""}`}');
    expect(P).toContain('<span className={cor ? `font-semibold ${cor.nome}` : "text-slate-500"}>{t.profissional}:</span>');
  });
});

describe("nos Levantamentos e nas Carteiras — «faça o mesmo»", () => {
  it("pela ordem em que aparecem: seguidos nunca repetem, e o mesmo repete a cor dele", () => {
    const cores = coresPelaOrdem([13, 11, 13, 12]);
    expect(cores.size).toBe(3);
    expect(cores.get(13)).toBe(CORES_DOS_PROFISSIONAIS[0]);
    expect(cores.get(11)).toBe(CORES_DOS_PROFISSIONAIS[1]);
    expect(cores.get(12)).toBe(CORES_DOS_PROFISSIONAIS[2]);
  });

  it("os Levantamentos: o grupo de cada profissional na cor dele, e cada linha com a faixa e o nome", () => {
    const L = ler("src/components/admin/AdminLevantamentosPanel.tsx");
    expect(L).toContain("const coresDosPros = coresDosProfissionais(");
    expect(L).toContain('className={corDoGrupo ? `rounded-xl border border-l-4 p-3 ${corDoGrupo.grupo}` : undefined}');
    expect(L).toContain("<span className={corDoGrupo ? `text-base font-bold ${corDoGrupo.nome}` : undefined}>{g.titulo}</span>");
    expect(L).toContain('cor ? `border-l-4 ${cor.linha}` : ""');
  });

  it("as Carteiras: cada cartão na cor do profissional, pela ordem dos cartões, com o nome em destaque", () => {
    const C = ler("src/components/admin/AdminCarteirasPanel.tsx");
    expect(C).toContain("const coresDosPros = coresPelaOrdem([...comSaldo, ...aDecorrer, ...parados].map((c) => c.id));");
    expect(C).toContain('className={`rounded-2xl border ${cor ? `border-l-4 ${cor.grupo}` : "bg-slate-900"} ${');
    expect(C).toContain('} ${cor ? cor.nome : modo === "parado" ? "text-slate-300" : "text-white"}`}');
  });
});

describe("nos Trabalhos CLYON — «pedidos muito misturados, colocar cores separando»", () => {
  it("cada trabalho com a sua cor, pela ordem da lista, com o título em destaque", () => {
    const T = ler("src/components/admin/AdminTrabalhosClyonPanel.tsx");
    expect(T).toContain("const coresDosTrabalhos = coresPelaOrdem(actual.map((t) => t.pedidoId));");
    expect(T).toContain("cor={coresDosTrabalhos.get(t.pedidoId) ?? null}");
    expect(T).toContain('<li className={`rounded-2xl border p-4 ${cor ? `border-l-4 ${cor.grupo}` : "border-slate-800 bg-slate-900/60"}`}>');
    expect(T).toContain('<p className={`text-base font-bold ${cor ? cor.nome : "text-white"}`}>');
  });
});
