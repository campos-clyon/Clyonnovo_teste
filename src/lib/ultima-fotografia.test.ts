import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { guardarFotografia, lerFotografia, limparFotografias } from "./ultima-fotografia";

/**
 * O ecrã abre com o que mostrou da última vez.
 *
 * "isso deve ser instantâneo também para os profissionais e clientes"
 * — 16-09-2026.
 *
 * O ciclo automático já trazia as novidades sozinhas. Faltava o momento em que
 * o ecrã NASCE: a cada entrada, o componente vinha vazio e ficava na roda até
 * a API responder — um segundo de branco, todas as vezes, a caminho de mostrar
 * o que já lá tinha estado.
 */

const armazem = new Map<string, string>();

beforeEach(() => {
  armazem.clear();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (k: string) => armazem.get(k) ?? null,
      setItem: (k: string, v: string) => void armazem.set(k, v),
      removeItem: (k: string) => void armazem.delete(k),
      key: (i: number) => [...armazem.keys()][i] ?? null,
      get length() {
        return armazem.size;
      },
    },
  });
});

describe("guardar e ler", () => {
  it("o que se guarda é o que se lê", () => {
    guardarFotografia("teste", { pedidos: [1, 2, 3] });
    expect(lerFotografia<{ pedidos: number[] }>("teste")).toEqual({ pedidos: [1, 2, 3] });
  });

  it("sem nada guardado, devolve null — e o ecrã comporta-se como antes", () => {
    expect(lerFotografia("nunca-guardado")).toBeNull();
  });

  it("uma fotografia partida não rebenta o ecrã", () => {
    armazem.set("clyon:fotografia:torta", "{isto não é json");
    expect(lerFotografia("torta")).toBeNull();
  });
});

describe("sair leva a fotografia atrás", () => {
  it("limpa o que é nosso", () => {
    guardarFotografia("pro:painel", { nome: "Óscar" });
    guardarFotografia("cliente:pedidos", { orders: [] });
    limparFotografias();
    expect(lerFotografia("pro:painel")).toBeNull();
    expect(lerFotografia("cliente:pedidos")).toBeNull();
  });

  it("e não toca no que é dos outros", () => {
    armazem.set("outra-coisa", "fica");
    guardarFotografia("pro:painel", { nome: "Óscar" });
    limparFotografias();
    expect(armazem.get("outra-coisa")).toBe("fica");
  });
});

describe("um armazenamento que recusa não pode partir a página", () => {
  it("guardar cala-se", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
        key: () => null,
        length: 0,
      },
    });
    expect(() => guardarFotografia("x", { a: 1 })).not.toThrow();
  });
});

describe("quem sai limpa, e quem abre hidrata", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

  it("o painel do profissional abre com a fotografia", () => {
    const P = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");
    expect(P).toContain("lerFotografia<Fotografia>(CHAVE_DO_PAINEL)");
    expect(P).toContain("useState(guardado == null)");
    expect(P).toContain("guardarFotografia(CHAVE_DO_PAINEL");
  });

  it("e limpa-a ao sair", () => {
    expect(ler("src/app/profissionais/painel/PainelDoProfissional.tsx")).toContain(
      "limparFotografias();",
    );
  });

  it("a lista do cliente também, e só o primeiro ecrã", () => {
    const M = ler("src/app/conta/components/MeusPedidos.tsx");
    expect(M).toContain("lerFotografia<Fotografia>(CHAVE_DOS_PEDIDOS)");
    // Guardar outros filtros dava a lista errada por baixo do separador errado.
    expect(M).toContain('filter !== "todos" || page !== 1');
  });

  it("e os dois botões de sair do cliente limpam-na", () => {
    for (const f of [
      "src/app/conta/components/ContaSidebar.tsx",
      "src/app/conta/components/MenuMovel.tsx",
    ]) {
      expect(ler(f)).toContain("limparFotografias();");
    }
  });
});
