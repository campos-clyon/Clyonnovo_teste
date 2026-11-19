import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/**
 * A VITÓRIA E OS AVISOS ESCREVEM NO ACORDO DE 1990 (d8, 19-11-2026).
 *
 * O que as pessoas lêem — as mensagens da Vitória, as traduções fixas, o aviso
 * ao modelo e os avisos automáticos ao profissional — usa a grafia do Acordo:
 * atividade, ação, atual, exato, eletricidade… e sem «stand-by», «link» nem
 * «feed». O teste lê só os textos (literais), não os comentários, os registos
 * da consola, o SQL nem as expressões que lêem o que o cliente escreve (essas
 * continuam a aceitar as duas grafias, de propósito).
 */

const LIB = join(process.cwd(), "src", "lib");

const DA_VITORIA_E_DOS_AVISOS = (f: string) =>
  f.endsWith(".ts") &&
  !f.endsWith(".test.ts") &&
  (/whatsapp|vitoria|^avisos?-|^aviso-|^textos-dos-avisos|^traduz|^mensagem-/.test(f) ||
    [
      "anuncio-de-imovel.ts",
      "propostas-sem-resposta.ts",
      "textos-do-seguimento-da-app.ts",
      "lista-da-play-e-o-profissional.ts",
      "lembrete-do-que-falta.ts",
      "prompt-do-orcamento.ts",
    ].includes(f));

const FORMAS_ANTIGAS =
  /\b(?:in)?activ(?:o|a|os|as|idade|idades|ar|ou)\b|\bacç|\bacepç|\bactua(?:l|is|lmente|liz\w*)\b|\bexact(?:o|a|os|as|amente)\b|electr(?!ão)|\bcorrecç|\bafect|\bstand[- ]?by\b|\blinks?\b|\bfeeds?\b/i;

function textosDe(fonte: string, nome: string): { linha: number; texto: string }[] {
  const sf = ts.createSourceFile(nome, fonte, ts.ScriptTarget.Latest, true);
  const fora: { linha: number; texto: string }[] = [];
  const naoSeLe = (n: ts.Node): boolean => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
      if (ts.isCallExpression(p)) {
        if (p.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
        const quem = p.expression.getText(sf);
        if (/^console\./.test(quem) || /^new RegExp|RegExp$/.test(quem)) return true;
      }
      if (ts.isNewExpression(p) && p.expression.getText(sf) === "RegExp") return true;
    }
    return false;
  };
  const andar = (n: ts.Node) => {
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      n.kind === ts.SyntaxKind.TemplateHead ||
      n.kind === ts.SyntaxKind.TemplateMiddle ||
      n.kind === ts.SyntaxKind.TemplateTail
    ) {
      const texto = (n as ts.LiteralLikeNode).text;
      const sql = /\b(SELECT|UPDATE|INSERT INTO|CREATE TABLE|ALTER TABLE)\b/.test(texto);
      // «exacto», «stand_by»: valores do código (tipos, chaves), não frases — nunca se mostram assim.
      const valorDoCodigo = /^[\w-]+$/.test(texto);
      if (!sql && !valorDoCodigo &&!naoSeLe(n) && FORMAS_ANTIGAS.test(texto)) {
        fora.push({ linha: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, texto: texto.slice(0, 120) });
      }
    }
    ts.forEachChild(n, andar);
  };
  andar(sf);
  return fora;
}

describe("a Vitória e os avisos no Acordo de 1990 (d8)", () => {
  const ficheiros = readdirSync(LIB).filter(DA_VITORIA_E_DOS_AVISOS);

  it("lê os ficheiros certos (a lista não ficou vazia por engano)", () => {
    expect(ficheiros).toContain("voz-da-vitoria.ts");
    expect(ficheiros).toContain("whatsapp-recolha.ts");
    expect(ficheiros).toContain("vitoria-aos-profissionais.ts");
    expect(ficheiros).toContain("textos-dos-avisos-ao-profissional.ts");
    expect(ficheiros.length).toBeGreaterThan(30);
  });

  it("nenhum texto que se lê tem a grafia antiga, «stand-by», «link» ou «feed»", () => {
    const achados: string[] = [];
    for (const f of ficheiros) {
      for (const a of textosDe(readFileSync(join(LIB, f), "utf8"), f)) achados.push(`${f}:${a.linha} ${a.texto}`);
    }
    expect(achados).toEqual([]);
  });

  it("as traduções fixas, na coluna do português, também", () => {
    const json = JSON.parse(readFileSync(join(LIB, "traducoes-fixas-da-vitoria.json"), "utf8")) as Record<string, unknown>;
    const achados: string[] = [];
    for (const lista of Object.values(json)) {
      if (!Array.isArray(lista)) continue;
      for (const linha of lista) {
        const pt = Array.isArray(linha) ? linha[0] : null;
        if (typeof pt === "string" && FORMAS_ANTIGAS.test(pt)) achados.push(pt);
      }
    }
    expect(achados).toEqual([]);
  });

  it("o detetor apanha as formas antigas (prova de que não passa às cegas)", () => {
    for (const antiga of ["a sua actividade", "a acção", "o valor actual", "o valor exacto", "electricidade", "conta em stand-by", "use o link", "o seu feed", "Livro de Reclamações Electrónico"]) {
      expect(FORMAS_ANTIGAS.test(antiga), antiga).toBe(true);
    }
    for (const nova of ["a sua atividade", "a ação", "o valor atual", "o valor exato", "eletricidade", "conta suspensa", "use a ligação", "a lista de pedidos", "a Electrão", "a secção"]) {
      expect(FORMAS_ANTIGAS.test(nova), nova).toBe(false);
    }
  });
});
