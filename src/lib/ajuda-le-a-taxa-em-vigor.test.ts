import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERGUNTAS_DO_PROFISSIONAL, perguntasDoProfissional, taxasDaAjuda } from "./ajuda-plataforma";
import { TAXA_MAXIMA, type Taxas } from "./taxas-plataforma";
import { ANTES_DO_MODELO, DEPOIS_DO_MODELO } from "./relogio-dos-testes";

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

// d29: a data vai explícita — desde 15-11-2026 a resposta diz o modelo novo.
const quanto = (taxas: Taxas | null, agora: Date = ANTES_DO_MODELO) =>
  perguntasDoProfissional(taxas, agora).find((q) => q.pergunta === "Quanto é que a CLYON leva?")!.resposta;

describe("no modelo de 15-11-2026 a resposta lê a taxa da mesma forma", () => {
  it("diz a percentagem das taxas que recebe — e muda com elas", () => {
    expect(quanto({ cliente: 0, profissional: 0.11 }, DEPOIS_DO_MODELO)).toContain(
      "Nas negociações, a taxa da plataforma é 11 % do valor do trabalho, sem IVA; nos trabalhos ",
    );
    expect(quanto({ cliente: 0, profissional: 0.12 }, DEPOIS_DO_MODELO)).toContain("a taxa da plataforma é 12 % do valor do trabalho");
  });

  it("sem as taxas, nenhuma percentagem", () => {
    expect(quanto(null, DEPOIS_DO_MODELO)).not.toMatch(/\d\s?%/);
  });

  it("as outras respostas não mudam com a taxa", () => {
    const com = perguntasDoProfissional({ cliente: 0, profissional: 0.11 }, DEPOIS_DO_MODELO);
    const sem = perguntasDoProfissional(null, DEPOIS_DO_MODELO);
    expect(com.slice(1)).toEqual(sem.slice(1));
  });
});

describe("a resposta «Quanto é que a CLYON leva?» lê a taxa (modelo antigo)", () => {
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
    expect(PERGUNTAS_DO_PROFISSIONAL).toEqual(perguntasDoProfissional(null, ANTES_DO_MODELO));
  });

  it("as outras respostas não mudam com a taxa", () => {
    const com = perguntasDoProfissional({ cliente: 0, profissional: 0.11 }, ANTES_DO_MODELO);
    const sem = perguntasDoProfissional(null, ANTES_DO_MODELO);
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
    // Desde a d27 parte 3 (15-11-2026) o painel passa também o modelo que o servidor diz.
    expect(A).toMatch(/perguntasDoProfissional\(taxas[,)]/);
    expect(A).toContain("setNovoModelo(dados.novoModelo === true);");
    expect(A).not.toContain("PERGUNTAS_DO_PROFISSIONAL");
  });
});
