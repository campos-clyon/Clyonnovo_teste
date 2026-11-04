import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as SITE from "./fotografias-da-carrinha";
import * as APP from "../../app-pro/src/lib/fotografias-da-carrinha";
import { LADO_MAXIMO as LADO_DO_SITE } from "./reduzir-imagem";
import { avisoDosItens, TABELA_DOS_ITENS_A_MAIS } from "./itens-a-mais";
import { PRECO_POR_ITEM } from "./precos-publicos";

/**
 * A PARTE DA APP CLYON PRO DAS DECISÕES d7, d9, d10 E d17 — 04-11-2026.
 *
 *   · d17 — a candidatura na app leva as fotografias da carrinha (de 1 a 4),
 *     e o perfil passa a «A minha carrinha», com no máximo 4;
 *   · d9  — a dívida de um pago em mão diz «sem IVA» quando não há IVA;
 *   · d7  — os itens a mais pela tabela das peças, vinda do site;
 *   · d10 — o aviso da guia onde ele propõe é o do site.
 *
 * Os ecrãs da app não correm aqui (são React Native): lê-se o código, como
 * nos outros testes da app, ancorado no que dura — o nome do campo, a rota,
 * a constante.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("d17 — a cópia da app é igual à do site", () => {
  it("os números e as frases das fotografias da carrinha", () => {
    expect(APP.MINIMO_DE_FOTOGRAFIAS_DA_CARRINHA).toBe(SITE.MINIMO_DE_FOTOGRAFIAS_DA_CARRINHA);
    expect(APP.MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA).toBe(SITE.MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA);
    expect(APP.ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA).toBe(SITE.ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA);
    expect(APP.AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA).toBe(SITE.AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA);
    expect(APP.MENSAGEM_SEM_FOTOGRAFIA).toBe(SITE.MENSAGEM_SEM_FOTOGRAFIA);
  });

  it("a candidatura reduz as fotografias ao mesmo lado do formulário do site", () => {
    expect(APP.LADO_DAS_FOTOGRAFIAS_DA_CANDIDATURA).toBe(LADO_DO_SITE);
    const F = ler("app-pro/src/componentes/Fotografias.tsx");
    expect(F).toMatch(/reduzirFotografiaDaCandidatura = \([^)]*\) =>\s*reduzir\(a, LADO_DAS_FOTOGRAFIAS_DA_CANDIDATURA\)/);
  });
});

describe("d17 — a candidatura na app manda as fotografias", () => {
  const REGISTO = semComentarios(ler("app-pro/src/app/registo.tsx"));

  it("o POST /api/parceiros/candidatura leva fotografiasDoVeiculo, com os endereços do envio", () => {
    const i = REGISTO.indexOf('pedir("/api/parceiros/candidatura", {');
    expect(i, "o envio da candidatura").toBeGreaterThan(-1);
    const corpo = REGISTO.slice(i, REGISTO.indexOf("semSessao: true", i));
    expect(corpo).toMatch(/fotografiasDoVeiculo: fotografias\b/);
  });

  it("cada fotografia sobe sem sessão, por multipart, para a rota da candidatura, reduzida a 1920 px", () => {
    expect(REGISTO).toMatch(
      /enviarFicheiro<[^>]*>\("\/api\/parceiros\/candidatura\/fotografias", \{\}, f, \{\s*semSessao: true,?\s*\}\)/,
    );
    expect(REGISTO).toMatch(/const f = await reduzirFotografiaDaCandidatura\(a\)/);
    // Sem sessão a sério: o envio não lê o token, e um 401 aí não faz sair ninguém.
    const API = ler("app-pro/src/lib/api.ts");
    expect(API).toMatch(/const tokenUsado = semSessao \? null : await lerToken\(\)/);
    expect(API).toMatch(/corpo\.append\("file", /);
    expect(API).toMatch(/return lerResposta<T>\(r, semSessao, tokenUsado\)/);
  });

  it("sem fotografia não envia, e o erro do campo «fotografias» aparece por baixo dele", () => {
    const i = REGISTO.indexOf("async function enviar()");
    expect(i).toBeGreaterThan(-1);
    const fim = REGISTO.indexOf("setAEnviar(true)", i);
    expect(fim).toBeGreaterThan(i);
    const enviar = REGISTO.slice(i, fim);
    expect(enviar).toMatch(/if \(fotografias\.length === 0\) \{\s*setErros\(\{ fotografias: MENSAGEM_SEM_FOTOGRAFIA \}\);\s*return;/);
    expect(REGISTO).toContain("erro={erros.fotografias}");
    expect(REGISTO).toMatch(/\{erro \? <Text style=\{\{ color: c\.mau \}\}>\{erro\}<\/Text> : null\}/);
  });

  it("o campo tem o rótulo e a ajuda do site, e no máximo 4", () => {
    expect(REGISTO).toContain("<TituloDaCaixa>{ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA} *</TituloDaCaixa>");
    expect(REGISTO).toContain("{AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA}");
    expect(REGISTO).toMatch(/const restam = MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA - fotografias\.length - aJuntar;/);
    // Enquanto uma sobe, a candidatura espera por ela.
    expect(REGISTO).toMatch(/ocupado=\{aEnviar \|\| aJuntar > 0\}/);
  });
});

describe("d17 — o perfil: «A minha carrinha», no máximo 4", () => {
  const PERFIL = semComentarios(ler("app-pro/src/app/conta/perfil.tsx"));

  it("o máximo é o da candidatura, 4 — e já não 6", () => {
    expect(PERFIL).toMatch(/const MAXIMO_DE_FOTOS_DA_VIATURA = MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA;/);
    expect(APP.MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA).toBe(4);
    expect(PERFIL).not.toMatch(/MAXIMO_DE_FOTOS_DA_VIATURA = \d/);
    expect(PERFIL).toMatch(/const restam = MAXIMO_DE_FOTOS_DA_VIATURA - fotos\.length;/);
  });

  it("quem já tem 5 ou 6 não perde nenhuma: só não junta mais, e a frase diz quantas tem", () => {
    // O perfil não tira fotografias por conta própria: só o «×» de cada uma.
    expect(PERFIL.match(/"\/api\/profissionais\/foto-viatura", \{ metodo: "DELETE"/g) ?? []).toHaveLength(1);
    expect(PERFIL).toContain("Já tem {fotos.length} fotografias. Apague uma para acrescentar outra.");
    // A mesma frase do painel.
    expect(ler("src/app/profissionais/painel/Perfil.tsx")).toContain(
      "Já tem {fotos.length} fotografias. Apague uma para acrescentar outra.",
    );
  });
});

describe("d9 — a dívida de um pago em mão, com e sem IVA, como no painel", () => {
  const PAINEL = ler("src/app/profissionais/painel/Carteira.tsx");
  const CARTEIRA = ler("app-pro/src/app/(app)/carteira.tsx");
  const DIVIDA = CARTEIRA.slice(CARTEIRA.indexOf("function Divida("), CARTEIRA.indexOf("function Campo("));

  it("as duas frases do painel estão na app, à letra", () => {
    const frases = [...PAINEL.matchAll(/`(O cliente pagou-lhe \$\{euros\(d\.recebidoDoCliente\)\} em mão, (?:com|sem) IVA\.[^`]*)`/g)].map(
      (m) => m[1],
    );
    expect(frases, "as frases com e sem IVA no painel").toHaveLength(2);
    for (const f of frases) expect(DIVIDA).toContain(f);
    // Com IVA só quando há IVA.
    expect(DIVIDA).toMatch(/\{d\.iva > 0\s*\? `O cliente pagou-lhe \$\{euros\(d\.recebidoDoCliente\)\} em mão, com IVA\./);
  });

  it("a frase de antes, que dizia «com IVA» com o IVA a zero, saiu", () => {
    expect(DIVIDA).not.toContain("em dinheiro, com IVA");
  });

  it("os botões de pagar ficam como estavam", () => {
    expect(DIVIDA).toContain('<Botao titulo="Gerar referência Multibanco"');
    expect(DIVIDA).toContain('<Botao titulo="Pagar por MB WAY"');
  });
});

describe("d7 — os itens a mais pela tabela das peças, vinda do site", () => {
  it("o aviso da app é o avisoDosItens do site, e diz a tabela", () => {
    const AVISOS = ler("app-pro/src/componentes/AvisosDoValor.tsx");
    expect(AVISOS).toContain('import { avisoDosItens } from "../../../src/lib/itens-a-mais";');
    expect(AVISOS).toContain('avisoDosItens(base, "profissional")');
    const aviso = avisoDosItens("total", "profissional");
    expect(aviso).toContain(TABELA_DOS_ITENS_A_MAIS);
    expect(aviso).toContain(`pequena ${PRECO_POR_ITEM.pequeno} €`);
    expect(aviso).toContain(`grande ${PRECO_POR_ITEM.grande} €`);
  });

  it("nenhum ecrã da app escreve à mão o preço de antes por item", () => {
    const ficheiros = (d: string): string[] =>
      readdirSync(join(process.cwd(), d)).flatMap((n) => {
        const p = `${d}/${n}`;
        return statSync(join(process.cwd(), p)).isDirectory() ? ficheiros(p) : /\.tsx?$/.test(n) ? [p] : [];
      });
    const comPrecoAntigo = ficheiros("app-pro/src").filter((f) =>
      /32\s*€[^\n]{0,20}(por item|a mais)/i.test(semComentarios(ler(f))),
    );
    expect(comPrecoAntigo).toEqual([]);
  });
});

describe("d10 — o aviso da guia onde ele propõe é o do site", () => {
  it("o 409 com «avisos» abre a caixa com o título e o texto da ficha do site", () => {
    const DETALHE = ler("app-pro/src/app/trabalho/[id].tsx");
    expect(DETALHE).toContain('import { FICHA_DO_AVISO } from "../../../../src/lib/avisos-antes-de-cotar";');
    expect(DETALHE).toMatch(/err\.estado === 409 && Array\.isArray\(lista\) && lista\.length > 0/);
    expect(DETALHE).toContain("`${ficha.titulo}. ${ficha.corpo}`");
  });
});
