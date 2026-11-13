import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as SITE from "./fotografias-da-carrinha";
import * as APP from "../../app-pro/src/lib/fotografias-da-carrinha";
import { LADO_MAXIMO as LADO_DO_SITE } from "./reduzir-imagem";
import { avisoDosItens, TABELA_DOS_ITENS_A_MAIS } from "./itens-a-mais";
import { PRECO_POR_ITEM } from "./precos-publicos";
import { faltaDaDivida, fraseDaDividaEmMao, linhasDasPartesDaDivida } from "./frases-da-divida";

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
    // Desde a d14 (13-11-2026) a resposta vem das duas vias (uploadAsync primeiro, fetch depois), já lida.
    expect(API).toMatch(/return tratarResposta<T>\(resposta\.estado, resposta\.corpo, semSessao, tokenUsado\)/);
  });

  it("sem fotografia não envia, e o erro do campo «fotografias» aparece por baixo dele", () => {
    const i = REGISTO.indexOf("async function enviar()");
    expect(i).toBeGreaterThan(-1);
    const fim = REGISTO.indexOf("setAEnviar(true)", i);
    expect(fim).toBeGreaterThan(i);
    const enviar = REGISTO.slice(i, fim);
    // Desde a d9 (12-11-2026): tudo o que falta de uma vez (errosDaCandidatura), e a caixa fica a vermelho.
    expect(enviar).toMatch(
      /const locais = errosDaCandidatura\(\{ nome, email, telefone, cidade, servicos, fotografias \}\);\s*if \(Object\.keys\(locais\)\.length > 0\) \{\s*formulario\.mostrarErros\(locais\);\s*return;/,
    );
    expect(ler("app-pro/src/lib/candidatura.ts")).toContain("if (c.fotografias.length === 0) erros.fotografias = MENSAGEM_SEM_FOTOGRAFIA;");
    expect(REGISTO).toContain('<CaixaComErro campo="fotografias">');
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

  /*
   * 11-11-2026: as frases saíram do painel para `frases-da-divida.ts` (a dívida
   * tem duas partes, e a frase lê a dívida inteira, não o que falta). A app
   * lê-as de lá desde a d3 — a tolerância de transição acabou: a app TEM de
   * chamar a lib, e não pode voltar a escrever a frase nem a escolhê-la pelo
   * que falta do IVA.
   */
  const PAINEL_SEM = semComentarios(PAINEL);
  const funcao = (codigo: string, nome: string) => {
    const i = codigo.indexOf(`function ${nome}(`);
    expect(i, `function ${nome}`).toBeGreaterThan(-1);
    const f = codigo.indexOf("\nfunction ", i + 1);
    return codigo.slice(i, f === -1 ? undefined : f);
  };

  it("as duas frases da app são as de frases-da-divida.ts, à letra", () => {
    expect(PAINEL).toContain("{fraseDaDividaEmMao(d)}");
    expect(DIVIDA).toContain("{fraseDaDividaEmMao(d)}");
    expect(CARTEIRA).toContain("{fraseDaDividaNoSaldo(d)}");
    expect(CARTEIRA).toContain('from "../../../../src/lib/frases-da-divida";');
    // Nem a frase à mão, nem a escolha pelo que falta do IVA, em todo o ecrã.
    expect(CARTEIRA).not.toContain("O cliente pagou-lhe");
    expect(CARTEIRA).not.toMatch(/\bd\.iva\b/);
    expect(CARTEIRA).not.toContain("em mão, sem IVA");
    // O caso que falhava: o IVA já pago (falta 0) num trabalho com IVA.
    const comOIvaPago = { recebidoDoCliente: 123, iva: 0, comissao: 11, ivaDaDivida: 23, comissaoDaDivida: 11 };
    expect(fraseDaDividaEmMao(comOIvaPago)).toContain("em mão, com IVA");
    expect(fraseDaDividaEmMao(comOIvaPago)).not.toContain("sem IVA");
  });

  it("as linhas das partes e o «falta» são os da lib, na app como no painel", () => {
    const daApp = funcao(CARTEIRA, "PartesDaDivida");
    const doPainel = funcao(PAINEL_SEM, "PartesDaDivida");
    for (const codigo of [daApp, doPainel]) {
      // As mesmas chamadas, com a dívida inteira, nos dois lados.
      expect(codigo).toContain("const linhas = linhasDasPartesDaDivida(d);");
      expect(codigo).toContain("const falta = faltaDaDivida(d);");
      expect(codigo).toContain("if (linhas.length === 0) return null;");
      // O texto vem inteiro da lib: uma linha por parte, e o que falta.
      expect(codigo).toContain("linhas.map((l) => (");
      expect(codigo).toContain("key={l.parte}");
      expect(codigo).toContain("{l.texto}");
      expect(codigo).toContain("{falta}");
      // Nenhum dos dois escreve o texto à mão.
      expect(codigo).not.toMatch(/Falta pagar|por pagar|pago a |Taxa da plataforma:|IVA:/);
    }
    // As linhas aparecem nas duas dívidas (com referência e só do saldo), nos dois lados.
    for (const codigo of [CARTEIRA, PAINEL_SEM]) {
      expect(funcao(codigo, "Divida")).toContain("<PartesDaDivida d={d} />");
      expect(funcao(codigo, "DividaNoSaldo")).toContain("<PartesDaDivida d={d} />");
    }
    // A parte por pagar distingue-se da paga, nos dois lados.
    expect(daApp).toContain("l.paga ? c.suave : c.aviso");
    expect(doPainel).toContain('l.paga ? "text-slate-500" : "font-medium text-amber-800"');
  });

  it("o tipo da app aceita o que a rota manda, e uma resposta antiga não parte o ecrã", () => {
    const CONTA = ler("app-pro/src/lib/conta.ts");
    const tipo = CONTA.slice(CONTA.indexOf("export type DividaDaCarteira = {"), CONTA.indexOf("export type LinhaDaCarteira"));
    expect(tipo).toContain("ivaDaDivida?: number;");
    expect(tipo).toContain("comissaoDaDivida?: number;");
    expect(tipo).toContain("porPagar?: number;");
    expect(tipo).toContain('partes?: { parte: "iva" | "taxa"; valor: number; paga: boolean; pagoEm?: string | null }[];');
    // Site antigo, sem `partes`: a frase cai no que falta e não há linhas nem «falta».
    const antiga = { recebidoDoCliente: 123, iva: 23, comissao: 11 };
    expect(fraseDaDividaEmMao(antiga)).toBe(
      "O cliente pagou-lhe 123,00 € em mão, com IVA. São da CLYON 23,00 € de IVA e 11,00 € de taxa da plataforma.",
    );
    expect(linhasDasPartesDaDivida(antiga)).toEqual([]);
    expect(faltaDaDivida(antiga)).toBeNull();
    // Com o IVA pago: as duas linhas e o que falta, como o painel as mostra.
    const d = {
      recebidoDoCliente: 123,
      iva: 0,
      comissao: 11,
      ivaDaDivida: 23,
      comissaoDaDivida: 11,
      porPagar: 11,
      partes: [
        { parte: "iva" as const, valor: 23, paga: true, pagoEm: "2026-11-05T12:00:00.000Z" },
        { parte: "taxa" as const, valor: 11, paga: false, pagoEm: null },
      ],
    };
    expect(linhasDasPartesDaDivida(d).map((l) => l.texto)).toEqual([
      "IVA: 23,00 € — pago a 05/11",
      "Taxa da plataforma: 11,00 € — por pagar",
    ]);
    expect(faltaDaDivida(d)).toBe("Falta pagar 11,00 € (a taxa da plataforma).");
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
