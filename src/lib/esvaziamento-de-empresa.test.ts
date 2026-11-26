import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ESVAZIAMENTO_DE_EMPRESA,
  comOEspacoDaEmpresa,
  comOsPedidosDaEmpresa,
  linhaDoEspacoDaEmpresa,
} from "./esvaziamento-de-empresa";
import { NOMES_DOS_SERVICOS, SERVICE_CATEGORIES, SERVICOS_PUBLICOS, grupoDoServico, nomeDoServico } from "./service-categories";
import { perguntasDoServico } from "./simulador-por-categoria";
import { catalogoDaApp } from "./catalogo-da-app";
import { precoDeReferencia } from "./preco-de-referencia";
import { linhasDaCategoria } from "./pedido-por-categoria";
import { AINDA_NAO_NA_VITORIA, IDS_DA_LISTA } from "./servicos-da-vitoria";
import { servicoDaLigacao } from "./servico-na-ligacao";

/*
 * d43 — 15-11-2026. O tipo «armazém, escritório ou loja», da fonte única dos
 * nomes ao que a API devolve.
 */
const RAIZ = join(__dirname, "..", "..");
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");

describe("d43 — o esvaziamento de armazém, escritório ou loja", () => {
  it("o id e o nome, na fonte única, e no grupo dos esvaziamentos", () => {
    expect(ESVAZIAMENTO_DE_EMPRESA).toBe("esvaziamento_empresa");
    expect(NOMES_DOS_SERVICOS.esvaziamento_empresa).toBe("Esvaziamento de armazém, escritório ou loja");
    expect(nomeDoServico("esvaziamento_empresa")).toBe("Esvaziamento de armazém, escritório ou loja");
    expect(SERVICOS_PUBLICOS.some((c) => c.id === "esvaziamento_empresa")).toBe(true);
    expect(grupoDoServico("esvaziamento_empresa")).toBe("esvaziamentos");
    const c = SERVICE_CATEGORIES.find((x) => x.id === "esvaziamento_empresa")!;
    expect(c.description).toMatch(/parceiro/);
    expect(c.description).toMatch(/fatura com NIF/);
    expect(c.description).not.toMatch(/profissional|contentor|big ?bag/i);
  });

  it("sem preço publicado: cada parceiro orça o espaço", () => {
    expect(precoDeReferencia("esvaziamento_empresa")).toBeNull();
  });

  it("o simulador da app pergunta o espaço, a quantidade e o fora de horas, e o acesso", () => {
    const ids = perguntasDoServico("esvaziamento_empresa").map((p) => p.id);
    expect(ids.slice(0, 4)).toEqual(["espacoDaEmpresa", "volume", "quantidadeExacta", "foraDeHoras"]);
    expect(ids).toContain("floor");
  });

  it("a API (catálogo da app de cliente) devolve-o com o nome e as perguntas", () => {
    const s = catalogoDaApp().servicos.find((x) => x.id === "esvaziamento_empresa")!;
    expect(s.nome).toBe("Esvaziamento de armazém, escritório ou loja");
    expect(s.detalhes).toBe("esvaziamento");
    expect(s.precoReferencia).toBeNull();
    expect(s.perguntas.length).toBeGreaterThan(3);
  });

  it("as respostas ficam na descrição do pedido, com as mesmas linhas no site e na app", () => {
    expect(linhaDoEspacoDaEmpresa("armazem")).toBe("Espaço da empresa: Armazém.");
    const d = comOsPedidosDaEmpresa(comOEspacoDaEmpresa("Quantidade estimada: X.", "loja"), { foraDeHoras: true });
    expect(d.split("\n")[0]).toBe("Quantidade estimada: X.");
    expect(d).toContain("Espaço da empresa: Loja.");
    expect(d).toContain("Pedidos da empresa: fora de horas (à noite ou ao fim de semana).");
    expect(comOEspacoDaEmpresa(d, "escritorio").match(/Espaço da empresa/g)).toHaveLength(1);
    expect(linhasDaCategoria({ serviceType: "esvaziamento_empresa", espacoDaEmpresa: "loja", foraDeHoras: "sim" })).toEqual([
      "Espaço da empresa: Loja.",
      "Pedidos da empresa: fora de horas (à noite ou ao fim de semana).",
    ]);
  });

  it("o simulador do site mostra as perguntas e o seletor de volume; ?servico= abre-o", () => {
    const sim = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(sim).toContain("formData.serviceType === ESVAZIAMENTO_DE_EMPRESA && (");
    expect(sim).toContain('"esvaziamento_apartamento", ESVAZIAMENTO_DE_EMPRESA].includes(');
    expect(servicoDaLigacao("?servico=esvaziamento_empresa")).toBe("esvaziamento_empresa");
    expect(servicoDaLigacao("?servico=esvaziamento-empresa")).toBe("esvaziamento_empresa");
  });

  it("a Vitória já o oferece: a seguir à cave, e a manutenção da casa passa a 11 (I&D, d43)", () => {
    expect(AINDA_NAO_NA_VITORIA.has("esvaziamento_empresa")).toBe(false);
    expect(IDS_DA_LISTA.indexOf("esvaziamento_empresa")).toBe(IDS_DA_LISTA.indexOf("esvaziamento_cave") + 1);
    // E desde 26-11-2026 (d132) a montagem de móveis vem antes: a manutenção passa a 12.
    expect(IDS_DA_LISTA.indexOf("manutencao_casa")).toBe(11);
  });
});
