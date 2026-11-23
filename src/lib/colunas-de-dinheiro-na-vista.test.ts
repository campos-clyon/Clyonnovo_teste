import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * d1 (4) de 22/11/2026 — CADA COLUNA DE DINHEIRO DAS NEGOCIAÇÕES CHEGA ÀS DUAS VISTAS.
 *
 * O acordo final (d78) nasceu como uma coluna que o backoffice lia e a vista do
 * cliente não: o cliente via o botão de pagar e recebia um 409. Este teste
 * obriga cada coluna DECIMAL da tabela `negociacoes` a ser lida na vista do
 * cliente e na do profissional, ou a ter uma excepção escrita (e dita) abaixo.
 * Uma coluna nova sem uma coisa nem outra chumba aqui.
 */
const RAIZ = process.cwd();
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8");

/** Onde o cliente lê uma negociação e o seu dinheiro (o site, a conta e a app, que lê a mesma R5). */
const VISTA_DO_CLIENTE = [
  "src/lib/negociacao-na-vista.ts",
  "src/lib/pagamento-para-o-cliente.ts",
  "src/lib/acesso-ao-pagamento.ts",
  "src/lib/pedidos-do-cliente.ts",
  "src/lib/vista-do-pedido.ts",
];

/** Onde o profissional lê o seu trabalho (a lista e o trabalho aberto). */
const VISTA_DO_PROFISSIONAL = [
  "src/app/api/profissionais/meus-pedidos/route.ts",
  "src/app/api/profissionais/trabalho/route.ts",
];

type Lado = "cliente" | "profissional";

/** As colunas que um lado NÃO lê, de propósito, e porquê. */
const EXCEPCOES: Record<string, Partial<Record<Lado, string>>> = {
  taxaProfissional: { cliente: "a taxa do profissional é interna: o cliente vê só o total que paga (contaDoCliente)", profissional: "lê-se por taxasDaNegociacao (taxas-plataforma.ts), que as rotas chamam: vê o que recebe" },
  taxaCliente: { profissional: "o profissional não vê a taxa do cliente: vê o que recebe (quantoOProfissionalRecebe)" },
  acrescimoPagamento: { profissional: "o acréscimo da forma de pagamento é do cliente; o profissional vê o valor acordado" },
  acordoFinalCliente: { profissional: "d78: o profissional fica com o que já recebeu, sem nada a dever; a conta dele não muda" },
};

function colunasDeDinheiro(): string[] {
  const db = ler("src/lib/db.ts");
  const doCreate = /CREATE TABLE IF NOT EXISTS negociacoes \([\s\S]*?\n\s*\)/.exec(db)?.[0] ?? "";
  const nomes = new Set<string>();
  for (const m of doCreate.matchAll(/^\s*(\w+)\s+DECIMAL/gm)) nomes.add(m[1]);
  for (const m of db.matchAll(/ALTER TABLE negociacoes ADD COLUMN (\w+) DECIMAL/g)) nomes.add(m[1]);
  return [...nomes].sort();
}

const lerTodos = (fs: string[]) => fs.map(ler).join("\n");
const palavra = (t: string, c: string) => new RegExp(`\\b${c}\\b`).test(t);

describe("d1 (4) as colunas de dinheiro das negociações chegam à vista do cliente e à do profissional", () => {
  const colunas = colunasDeDinheiro();
  const cliente = lerTodos(VISTA_DO_CLIENTE);
  const profissional = lerTodos(VISTA_DO_PROFISSIONAL);

  it("encontra as colunas que há (a regra não corre às cegas)", () => {
    expect(colunas).toContain("valorAcordado");
    expect(colunas).toContain("acordoFinalCliente");
    expect(colunas.length).toBeGreaterThanOrEqual(8);
  });

  it("cada coluna é lida na vista do cliente, ou tem a excepção escrita", () => {
    const sem = colunas.filter((c) => !palavra(cliente, c) && !EXCEPCOES[c]?.cliente);
    expect(sem).toEqual([]);
  });

  it("cada coluna é lida na vista do profissional, ou tem a excepção escrita", () => {
    const sem = colunas.filter((c) => !palavra(profissional, c) && !EXCEPCOES[c]?.profissional);
    expect(sem).toEqual([]);
  });

  it("uma excepção só existe para uma coluna que existe, e que o lado de facto não lê", () => {
    for (const [c, lados] of Object.entries(EXCEPCOES)) {
      expect(colunas, `excepção de uma coluna que já não existe: ${c}`).toContain(c);
      if (lados.cliente) expect(palavra(cliente, c), `${c} já chega ao cliente: tira a excepção`).toBe(false);
      if (lados.profissional) expect(palavra(profissional, c), `${c} já chega ao profissional: tira a excepção`).toBe(false);
    }
  });

  it("o acordo final chega à vista do cliente com o valor e a frase (d1, 22/11)", () => {
    const t = ler("src/lib/pagamento-para-o-cliente.ts");
    expect(t).toContain("acordoFinal");
    expect(t).toContain("PAGUE_PELA_REFERENCIA_DA_CLYON");
    expect(ler("src/lib/palavras-do-pagamento.ts")).toContain("Pague pela referência que a CLYON lhe enviou");
    // A leitura do estado não é um pedido de pagamento: só ela passa `soParaVer`.
    expect(ler("src/app/api/pagamentos/route.ts").match(/soParaVer: true/g)?.length).toBe(1);
  });
});
