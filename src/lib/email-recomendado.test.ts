import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O email passa a recomendado, e as duas cores separam o que impede do que custa.
 *
 * "O email não deve ser obrigatório mas recomendável. Os campos não preenchidos
 * devem ficar vermelhos; no caso dos recomendados devem ficar dourados."
 *
 * O email foi obrigatório por uma razão boa: a proposta chega por um link
 * enviado por email, e sem ele o cliente nunca chegava a saber que alguém
 * respondera — foi o que aconteceu ao #202. Entretanto isso deixou de ser
 * verdade: o cliente negoceia pelo WhatsApp, e o painel manda-lhe o link por
 * lá. A razão desapareceu e o obstáculo ficou.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const FORM = readFileSync(
  join(process.cwd(), "src/app/simulador/SimulatorThreePhaseForm.tsx"),
  "utf8",
);
const LIMPO = semComentarios(FORM);

describe("o email deixa de impedir", () => {
  it("não entra no que valida a fase 3", () => {
    const i = LIMPO.indexOf("const isPhase3Valid = () => {");
    const corpo = LIMPO.slice(i, LIMPO.indexOf("};", i));
    expect(corpo).not.toContain("emailValido");
    // O que continua a impedir: nome, telefone, urgência e a fatura.
    expect(corpo).toContain("formData.receiver?.name");
    expect(corpo).toContain("formData.receiver?.phone");
    expect(corpo).toContain("formData.urgency");
    expect(corpo).toContain('typeof formData.precisaFatura === "boolean"');
  });

  it("sai da lista do que falta preencher, e passa a uma lista própria", () => {
    // Misturar «não pode enviar sem isto» com «isto ia ajudar» ensina a pessoa
    // a não ler nenhuma das duas.
    const i = LIMPO.indexOf("const faltaNaFase3: string[] = [];");
    const bloco = LIMPO.slice(i, LIMPO.indexOf("const handleAnalyze", i));
    expect(bloco).toContain("const recomendadoNaFase3: string[] = [];");
    expect(bloco).toMatch(/recomendadoNaFase3\.push\("o email/);
    const obrigatorios = bloco.slice(0, bloco.indexOf("const recomendadoNaFase3"));
    expect(obrigatorios).not.toContain("emailValido");
  });

  it("o rótulo diz recomendado, e já não leva asterisco", () => {
    expect(LIMPO).toContain('<span className="font-semibold text-amber-700">(recomendado)</span>');
    expect(LIMPO).not.toContain(">Email *<");
  });

  it("a frase antiga saiu — já não é verdade que não haja outro caminho", () => {
    expect(LIMPO).not.toContain("não temos como lhe mostrar o que os profissionais respondem");
    expect(LIMPO).toContain("tratamos de si pelo telefone");
  });
});

describe("as duas cores", () => {
  it("vermelho para o que impede, dourado para o que custa", () => {
    expect(LIMPO).toContain("const VERMELHO =");
    expect(LIMPO).toContain("const DOURADO =");
    expect(LIMPO).toContain("border-red-500");
    expect(LIMPO).toContain("border-amber-500");
  });

  it("os obrigatórios da fase 3 ficam vermelhos, um a um", () => {
    for (const campo of ["semNome", "semTelefone", "semUrgencia", "semFatura"]) {
      expect(LIMPO).toContain(`const ${campo} =`);
      expect(LIMPO).toContain(`${campo} ?`);
    }
  });

  it("um email escrito e errado é vermelho; em falta é dourado", () => {
    // São coisas diferentes: um erro corrige-se, uma ausência é uma escolha.
    const i = LIMPO.indexOf('id="sim-email"');
    const bloco = LIMPO.slice(i, i + 1600);
    // Sem depender do fim de linha: em Windows o git reescreve os ficheiros
    // com CRLF ao mudar de ramo, e uma asserção presa a ele passa a falhar
    // sem que uma linha de código tenha mudado.
    expect(bloco).toMatch(/emailEscrito && !emailEstaBem\s*\?\s*VERMELHO/);
    expect(bloco).toContain("? DOURADO");
    expect(bloco).toContain("Pode enviar sem email");
  });

  it("nada se pinta antes de a pessoa tentar enviar", () => {
    // Marcar a vermelho um campo em que ninguém tocou é ralhar antes de a
    // pessoa fazer nada.
    expect(LIMPO).toContain("const emFalta = (vazio: boolean) => showValidationErrors && vazio;");
    expect(LIMPO).toContain("showValidationErrors={phase3Attempted}");
    expect(LIMPO).toContain("setPhase3Attempted(true);");
  });

  it("o vermelho é o mesmo nas duas fases", () => {
    // Duas intensidades leem-se como dois graus de gravidade.
    const i = LIMPO.indexOf("const errorBorderCls =");
    expect(LIMPO.slice(i, i + 160)).toContain("border-red-500");
  });

  it("a linha do que falta e a do que se perde são separadas", () => {
    expect(LIMPO).toContain("{!canAnalyze && faltaNaFase3.length > 0 && (");
    expect(LIMPO).toContain("{canAnalyze && recomendadoNaFase3.length > 0 && (");
    expect(LIMPO).toContain("Pode enviar, mas fica a faltar");
  });
});
