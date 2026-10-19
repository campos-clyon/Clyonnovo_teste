import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OS TRABALHOS CLYON COM OS RECURSOS DA MESA — 19-10-2026.
 *
 * *«Quero que implemente todos os recursos da Mesa das negociações em
 * Trabalhos CLYON.»* — o dono, que escolheu: o ecrã como a Mesa (cartões de
 * resumo que filtram e blocos), fora o que só existe porque o cliente negoceia
 * sozinho, e confirmar continua a dar o dinheiro por recebido.
 *
 * Fase 1: os cartões, os blocos e o «Salte para um».
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const T = ler("src/components/admin/AdminTrabalhosClyonPanel.tsx");

describe("os blocos", () => {
  it("são sete, pela ordem do que pede alguém, e os três do fim começam fechados", () => {
    const ids = [...T.slice(T.indexOf("const BLOCOS"), T.indexOf("function blocoDoTrabalho")).matchAll(/id: "([a-z]+)",/g)].map((m) => m[1]);
    expect(ids).toEqual(["feito", "precisa", "espera", "atribuidos", "concluidos", "cancelados", "arquivados"]);
    const bloco = (id: string) => {
      const i = T.indexOf(`id: "${id}",`);
      return T.slice(i, T.indexOf("},", i));
    };
    for (const id of ["concluidos", "cancelados", "arquivados"]) expect(bloco(id), id).toContain("fechadoPorOmissao: true,");
    for (const id of ["feito", "precisa", "espera", "atribuidos"]) expect(bloco(id), id).not.toContain("fechadoPorOmissao");
    expect(bloco("feito")).toContain('fases: ["por_confirmar"],');
    expect(bloco("precisa")).toContain('fases: ["escolher", "sem_ninguem"],');
  });

  it("abrem e fecham pelo título, que fica preso em cima, e a procura abre os que têm resultados", () => {
    expect(T).toContain("onClick={() => alternarBloco(b.id)}");
    expect(T).toContain('className="sticky top-0 z-10 flex w-full items-center gap-3');
    expect(T).toContain("(aProcurando && quantosEm(id) > 0 && !fechadosNaProcura.has(id))");
  });

  it("dentro de cada bloco, pelo número do pedido, do mais recente", () => {
    expect(T).toContain("].sort((x, y) => y.id - x.id),");
  });
});

describe("os cartões de resumo", () => {
  it("«Geral» e um por bloco; carregar filtra, outra vez mostra todos", () => {
    expect(T).toContain('{ id: null as Bloco | null, rotulo: "Geral", alarme: false, n: totalEncontrado }');
    expect(T).toContain("onClick={() => setFiltro((f) => (c.id === null || f === c.id ? null : c.id))}");
    expect(T).toContain("A mostrar só «{BLOCOS.find((b) => b.id === filtro)?.rotulo}»");
  });

  it("os que pedem alguém ficam em alarme quando têm trabalhos", () => {
    expect(T).toContain("const emAlarme = c.alarme && c.n > 0;");
  });
});

describe("«Salte para um»", () => {
  it("os feitos por confirmar e os que precisam de si, num clique abertos e à vista", () => {
    expect(T).toContain('const saltos = [...(porBloco.get("feito") ?? []), ...(porBloco.get("precisa") ?? [])]');
    expect(T).toContain("onClick={() => mostrarTrabalho(t)}");
    expect(T).toContain("document.getElementById(`trabalho-${id}`)?.scrollIntoView(");
    expect(T).toContain("<li id={`trabalho-${t.pedidoId}`}");
  });

  it("dizem porquê: quantos aceitaram, ninguém aceitou, ou diz que está feito", () => {
    expect(T).toContain('if (r.fase === "por_confirmar") return "diz que está feito";');
    expect(T).toContain('if (r.fase === "sem_ninguem") return "ninguém aceitou";');
  });
});

describe("o resto do topo, como na Mesa", () => {
  it("«actualizado há N min», e o aviso fecha-se", () => {
    expect(T).toContain("`actualizado há ${minutos} min`");
    expect(T).toContain('onClick={() => setAviso("")}');
  });
});
