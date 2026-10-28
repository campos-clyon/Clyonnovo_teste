import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERGUNTAS_DO_PROFISSIONAL, perguntasDoProfissional, taxasDaAjuda } from "./ajuda-plataforma";
import { TAXA_MAXIMA, type Taxas } from "./taxas-plataforma";

/**
 * A AJUDA DOS PROFISSIONAIS DIZ A TAXA EM VIGOR — 28-10-2026 (d8).
 *
 * «Quanto é que a CLYON leva?» respondia com a percentagem escrita à mão.
 * /quero-ser-parceiro, /profissionais e os Termos já a liam das Configs
 * (`taxasActuais`): bastava mudar a taxa no backoffice para a ajuda — no
 * painel e na app CLYON Pro — ficar a dizer a antiga. Agora o painel recebe as
 * taxas de /api/profissionais/ajuda; sem elas, a resposta diz o nome da taxa,
 * sem número.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const quanto = (taxas: Taxas | null) =>
  perguntasDoProfissional(taxas).find((q) => q.pergunta === "Quanto é que a CLYON leva?")!.resposta;

describe("a resposta «Quanto é que a CLYON leva?» lê a taxa", () => {
  it("diz a percentagem das taxas que recebe — e muda com elas", () => {
    expect(quanto({ cliente: 0, profissional: 0.11 })).toContain(
      "Nas negociações, a CLYON fica com 11 % do valor do trabalho, sem IVA; nos trabalhos ",
    );
    expect(quanto({ cliente: 0, profissional: 0.12 })).toContain("a CLYON fica com 12 % do valor do trabalho");
    // As de origem (5 % ao cliente e 6 % ao profissional) dão 10,48 % do que o cliente paga.
    expect(quanto({ cliente: 0.05, profissional: 0.06 })).toContain("a CLYON fica com 10,48 % do valor do trabalho");
  });

  it("sem as taxas, diz o nome da taxa e número nenhum", () => {
    const r = quanto(null);
    expect(r).toContain("Nas negociações, a CLYON fica com a taxa da plataforma em vigor");
    expect(r).not.toMatch(/\d\s?%/);
    // A lista que a app CLYON Pro importa é esta, sem número.
    expect(PERGUNTAS_DO_PROFISSIONAL).toEqual(perguntasDoProfissional(null));
  });

  it("as outras respostas não mudam com a taxa", () => {
    const com = perguntasDoProfissional({ cliente: 0, profissional: 0.11 });
    const sem = perguntasDoProfissional(null);
    expect(com.map((q) => q.pergunta)).toEqual(sem.map((q) => q.pergunta));
    expect(com.slice(1)).toEqual(sem.slice(1));
  });
});

describe("as taxas que chegam da rota", () => {
  it("só passam inteiras e possíveis", () => {
    expect(taxasDaAjuda({ cliente: 0, profissional: 0.11 })).toEqual({ cliente: 0, profissional: 0.11 });
    for (const mau of [null, undefined, "11 %", {}, { cliente: 0 }, { cliente: "0", profissional: "0.11" }, { cliente: -0.01, profissional: 0.11 }, { cliente: 0, profissional: TAXA_MAXIMA + 0.01 }, { cliente: 0, profissional: Number.NaN }]) {
      expect(taxasDaAjuda(mau), JSON.stringify(mau)).toBeNull();
    }
  });

  it("a rota da ajuda manda as taxas de hoje com a lista", () => {
    const R = semNotas(ler("src/app/api/profissionais/ajuda/route.ts"));
    const get = R.slice(R.indexOf("export async function GET("), R.indexOf("export async function POST("));
    expect(get.length).toBeGreaterThan(100);
    expect(get).toContain("taxasActuais()");
    expect(get).toMatch(/return NextResponse\.json\(\{\s*taxas,/);
  });

  it("o painel usa as taxas da rota, e não a lista sem número", () => {
    const A = semNotas(ler("src/app/profissionais/painel/Ajuda.tsx"));
    expect(A).toContain("setTaxas(taxasDaAjuda(dados.taxas));");
    expect(A).toContain("perguntasDoProfissional(taxas)");
    expect(A).not.toContain("PERGUNTAS_DO_PROFISSIONAL");
  });
});
