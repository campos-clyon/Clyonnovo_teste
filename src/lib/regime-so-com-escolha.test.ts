import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { regimeParaOEcra } from "./perfil-fiscal";
import { resumoDosDadosParaReceber } from "./dados-para-receber";
import { ONDE_O_REGIME_FOI_CONFIRMADO_SEM_ESCOLHA } from "./regime-por-confirmar-na-base";

/*
 * d19, 13-11-2026 — o regime de IVA só fica confirmado com uma escolha dele,
 * e a lista dos Profissionais diz quantos dos quatro dados para receber cada um tem.
 */

const raiz = join(__dirname, "..", "..");
const ler = (f: string) => readFileSync(join(raiz, f), "utf8");
// A regra ancorada ao início da linha (ver tirar-comentarios-sem-comer-codigo.test.ts).
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("o GET do perfil não devolve «isento» por omissão", () => {
  it("só o regime confirmado sai; por confirmar sai vazio", () => {
    expect(regimeParaOEcra({ regimeIva: "isento", regimeIvaConfirmadoEm: null })).toBe("");
    expect(regimeParaOEcra({ regimeIva: "normal", regimeIvaConfirmadoEm: null })).toBe("");
    expect(regimeParaOEcra({ regimeIva: undefined })).toBe("");
    expect(regimeParaOEcra({ regimeIva: "isento", regimeIvaConfirmadoEm: "2026-11-13T10:00:00Z" })).toBe("isento");
    expect(regimeParaOEcra({ regimeIva: "normal", regimeIvaConfirmadoEm: new Date() })).toBe("normal");
  });

  it("a rota usa-o, e já não tem o «?? \"isento\"»", () => {
    const rota = semComentarios(ler("src/app/api/profissionais/perfil/route.ts"));
    expect(rota).toMatch(/regimeIva:\s*regimeParaOEcra\(p\)/);
    expect(rota).not.toMatch(/regimeIva\s*\?\?\s*["']isento["']/);
  });
});

describe("sem escolha não há carimbo", () => {
  it("actualizarPerfilDoProfissional só carimba com confirmarRegime", () => {
    const db = ler("src/lib/db.ts");
    const i = db.indexOf("export async function actualizarPerfilDoProfissional(");
    expect(i).toBeGreaterThan(-1);
    const fim = db.indexOf("\nexport ", i + 10);
    const corpo = semComentarios(db.slice(i, fim));
    const carimbos = corpo.match(/regimeIvaConfirmadoEm = UTC_TIMESTAMP\(\)/g) ?? [];
    expect(carimbos).toHaveLength(1);
    expect(corpo).toMatch(
      /if \(colunas\.includes\("regimeIva"\) && opcoes\.confirmarRegime === true\) \{\s*quedas\.push\("regimeIvaConfirmadoEm = UTC_TIMESTAMP\(\)"\);/,
    );
  });

  it("a rota só confirma quando o corpo traz confirmarRegime: true, e passa-o à base", () => {
    const rota = semComentarios(ler("src/app/api/profissionais/perfil/route.ts"));
    expect(rota).toMatch(/confirmarRegime = corpo\.confirmarRegime === true/);
    expect(rota).toMatch(/actualizarPerfilDoProfissional\(sessao\.providerId, mudancas, \{ confirmarRegime \}\)/);
  });

  it("o painel só manda confirmarRegime depois de ele tocar num regime", () => {
    const painel = semComentarios(ler("src/app/profissionais/painel/Perfil.tsx"));
    expect(painel).toMatch(/regimeEscolhido \? \{ confirmarRegime: true \} : \{\}/);
    expect(painel).toMatch(/setRegimeEscolhido\(true\)/);
    // E nunca o regime «tal e qual» do ecrã, que podia ser o de omissão.
    expect(painel).not.toMatch(/^\s*regimeIva: dados\.regimeIva,\s*$/m);
  });
});

describe("a reposição a «por confirmar»", () => {
  const fonte = semComentarios(ler("src/lib/regime-por-confirmar-na-base.ts"));

  it("só os «isento» carimbados que não vieram da inscrição", () => {
    expect(ONDE_O_REGIME_FOI_CONFIRMADO_SEM_ESCOLHA).toMatch(/regimeIvaConfirmadoEm IS NOT NULL/);
    expect(ONDE_O_REGIME_FOI_CONFIRMADO_SEM_ESCOLHA).toMatch(/regimeIva = 'isento'/);
    expect(ONDE_O_REGIME_FOI_CONFIRMADO_SEM_ESCOLHA).toMatch(/TIMESTAMPDIFF\(SECOND, createdAt, regimeIvaConfirmadoEm\)/);
  });

  it("actualiza uma coluna, nunca apaga, com cópia e uma vez só", () => {
    expect(fonte).not.toMatch(/DELETE\s+FROM/i);
    expect(fonte).toMatch(/UPDATE providers SET regimeIvaConfirmadoEm = NULL, updatedAt = updatedAt/);
    expect(fonte).toMatch(/INSERT IGNORE INTO copiaDoRegimeAntesDaD19/);
    expect(fonte).toMatch(/INSERT INTO migracoesFeitas \(nome\) VALUES/);
    // Conta antes de mudar.
    expect(fonte.indexOf("SELECT COUNT(*)")).toBeGreaterThan(-1);
    expect(fonte.indexOf("SELECT COUNT(*)")).toBeLessThan(fonte.indexOf("UPDATE providers SET"));
  });

  it("corre no arranque, fora do build", () => {
    const inst = ler("src/instrumentation.ts");
    const build = inst.indexOf('process.env.NEXT_PHASE !== "phase-production-build"');
    expect(build).toBeGreaterThan(-1);
    expect(inst.indexOf("reporRegimesSemEscolha")).toBeGreaterThan(build);
  });
});

describe("«Dados para receber» nos Profissionais", () => {
  const completo = {
    iban: "PT50000000000000000000000",
    ibanTitular: "Nome",
    mbway: "912345678",
    regimeIva: "isento",
    regimeIvaConfirmadoEm: "2026-11-13T10:00:00Z",
  };

  it("conta os quatro, e o regime só confirmado", () => {
    expect(resumoDosDadosParaReceber(completo)).toEqual({ tem: 4, de: 4, falta: [] });
    expect(resumoDosDadosParaReceber({ ...completo, regimeIvaConfirmadoEm: null })).toEqual({
      tem: 3,
      de: 4,
      falta: ["regime"],
    });
    expect(resumoDosDadosParaReceber({}).tem).toBe(0);
  });

  it("a rota lê a confirmação e conta com o IBAN inteiro; ao browser vai encurtado", () => {
    const rota = semComentarios(ler("src/app/api/admin/profissionais/route.ts"));
    expect(rota).toMatch(/regimeIva, regimeIvaConfirmadoEm,/);
    expect(rota).toMatch(/dadosParaReceber: resumoDosDadosParaReceber\(p\)/);
    expect(rota).toMatch(/iban: typeof p\.iban === "string" && p\.iban \? ibanEncurtado\(p\.iban\) : ""/);
  });

  it("o painel tem a coluna, o filtro e o total n/N completos", () => {
    const painel = ler("src/components/admin/AdminProfissionaisPanel.tsx");
    expect(painel).toMatch(/\{ id: "dados_para_receber", nome: "Dados para receber" \}/);
    expect(painel).toMatch(/Dados para receber: \{p\.dadosParaReceber\.tem\}\/\{p\.dadosParaReceber\.de\}/);
    expect(painel).toMatch(/\{contagens\.dados_completos\}\/\{contagens\.dados_de\} completos/);
  });
});
