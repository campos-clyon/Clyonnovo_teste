import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { avisoDaBase } from "./base-do-preco";
import { fraseDaBaseAoProfissional } from "./frase-da-base";
import { diasPorExtenso } from "./varios-dias";
import { registoRealEmPalavras } from "./registo-real";
import {
  aindaNaoEOUltimoDia,
  avisoDaBaseDoTrabalho,
  cargasEscritas,
  diasParaMostrar,
  REGISTE_AS_CARGAS,
  registoRealParaMostrar,
  SO_NO_ULTIMO_DIA,
} from "../../app-pro/src/lib/trabalhos";

/*
 * A PARTE DAS APPS DA d63, d64 E d67 — 18-11-2026 (ordem do CEO com o sim do dono).
 *
 *   d63: na app Pro, contratado, a frase da base para ele (`fraseDaBaseAoProfissional`
 *        da API) no lugar do `avisoDaBase`; antes do aceite, o de sempre.
 *   d64: os dias do trabalho e as cargas de cada dia (`cargas-do-dia`); o «Está
 *        feito» desligado antes do último dia, com a frase do painel. Na app de
 *        cliente, `diasDoTrabalhoTexto` como vem.
 *   d67: o registo real (só leitura) nas duas apps, pela frase da API.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários de bloco e de linha inteira: o que se afirma é sobre o código. */
const codigo = (p: string) =>
  ler(p)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("d63 na app Pro: a frase da base depois do aceite", () => {
  const frase = fraseDaBaseAoProfissional("carga", 360) as string;

  it("contratado e com a frase da API, mostra essa", () => {
    expect(avisoDaBaseDoTrabalho({ estado: "acordada", baseDoPreco: "carga", fraseDaBaseAoProfissional: frase })).toBe(frase);
    expect(frase).toContain("Confirme o número de cargas com o cliente no local");
  });

  it("antes do aceite, ou sem a frase (site antigo), o aviso de sempre", () => {
    expect(avisoDaBaseDoTrabalho({ estado: "em_negociacao" as never, baseDoPreco: "carga", fraseDaBaseAoProfissional: frase })).toBe(avisoDaBase("carga"));
    expect(avisoDaBaseDoTrabalho({ estado: "acordada", baseDoPreco: "carga" })).toBe(avisoDaBase("carga"));
    expect(avisoDaBaseDoTrabalho({ estado: "acordada", baseDoPreco: "total", fraseDaBaseAoProfissional: null })).toBeNull();
  });

  it("à hora com as horas confirmadas não diz nada (como o painel)", () => {
    expect(
      avisoDaBaseDoTrabalho({ estado: "acordada", baseDoPreco: "hora", fraseDaBaseAoProfissional: "x", porHora: { confirmadas: true } as never }),
    ).toBeNull();
  });

  it("os avisos do valor usam a regra, não o avisoDaBase directo", () => {
    const s = codigo("app-pro/src/componentes/AvisosDoValor.tsx");
    expect(s).toContain("avisoDaBaseDoTrabalho(t)");
    expect(s).not.toMatch(/avisoDaBase\(base\)/);
  });
});

describe("d64 na app Pro: os vários dias", () => {
  const dias = [
    { dia: "2026-11-16", inicio: "2026-11-16T09:00:00.000Z", cargasPrevistas: 2, cargasFeitas: 2 },
    { dia: "2026-11-17", inicio: "2026-11-17T09:00:00.000Z", cargasPrevistas: 2, cargasFeitas: null },
  ];

  it("as frases são as do painel", () => {
    expect(ler("src/app/profissionais/painel/Trabalhos.tsx")).toContain(SO_NO_ULTIMO_DIA);
    expect(ler("src/app/profissionais/painel/DiasDoTrabalho.tsx")).toContain(REGISTE_AS_CARGAS);
  });

  it("um dia só não desenha o bloco; vários sim", () => {
    expect(diasParaMostrar({ diasDoTrabalho: [dias[0]] })).toEqual([]);
    expect(diasParaMostrar({})).toEqual([]);
    expect(diasParaMostrar({ diasDoTrabalho: dias })).toHaveLength(2);
    expect(cargasEscritas(2.5)).toBe("2,5");
  });

  it("o «Está feito» só se desliga quando o site diz false", () => {
    expect(aindaNaoEOUltimoDia({ podeDarPorFeitoHoje: false })).toBe(true);
    expect(aindaNaoEOUltimoDia({ podeDarPorFeitoHoje: true })).toBe(false);
    expect(aindaNaoEOUltimoDia({})).toBe(false);
    const s = codigo("app-pro/src/componentes/TrabalhoContratado.tsx");
    expect(s).toContain("desactivado={pendente || aindaNaoEOUltimoDia(t)}");
    expect(s).toContain("texto={SO_NO_ULTIMO_DIA}");
    expect(s.match(/<DiasDoTrabalho t=\{t\} \/>/g)?.length).toBe(2);
  });

  it("as cargas vão à rota do site, com o dia AAAA-MM-DD, e o dia de hoje é o de Lisboa", () => {
    const s = codigo("app-pro/src/componentes/DiasDoTrabalho.tsx");
    expect(s).toContain('"/api/profissionais/trabalho/cargas-do-dia"');
    expect(s).toContain("corpo: { negociacaoId: t.negociacaoId, dia: d.dia, cargas }");
    expect(s).toContain("diaEmLisboa(new Date())");
    expect(s).toContain('podeRegistar = t.fase === "a_executar"');
    expect(s).not.toMatch(/Comecei|Acabei/);
  });
});

describe("d67: o registo real, só leitura", () => {
  const texto = registoRealEmPalavras([{ dia: "2026-11-17", inicio: "2026-11-17T13:00:00.000Z", fim: "2026-11-17T19:00:00.000Z", pausaMin: 60 }]);

  it("na app Pro, com maiúscula como a página do pedido; nada sem registo", () => {
    expect(texto.startsWith("feito a 17/11")).toBe(true);
    expect(registoRealParaMostrar({ registoRealTexto: texto })).toBe(texto.charAt(0).toUpperCase() + texto.slice(1));
    expect(registoRealParaMostrar({ registoRealTexto: null })).toBeNull();
    expect(registoRealParaMostrar({})).toBeNull();
    expect(codigo("app-pro/src/componentes/TrabalhoContratado.tsx").match(/registoRealParaMostrar\(t\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("na app de cliente, os dias e o registo como a API os manda", () => {
    const s = codigo("app-cliente/src/componentes/VistaDoPedido.tsx");
    expect(s).toContain('rotulo="Dias do trabalho" texto={p.diasDoTrabalhoTexto}');
    expect(s).toContain('rotulo="Trabalho feito" texto={comMaiuscula(p.registoRealTexto)}');
    const tipos = codigo("app-cliente/src/lib/pedidos.ts");
    expect(tipos).toMatch(/diasDoTrabalhoTexto\?: string \| null;/);
    expect(tipos).toMatch(/registoRealTexto\?: string \| null;/);
    // A API manda o texto já feito (o mesmo `diasPorExtenso` da página do pedido).
    expect(diasPorExtenso(["2026-11-16", "2026-11-17", "2026-11-18"])).toBe("de segunda, 16, a quarta, 18 de novembro");
  });
});

describe("d63 na app de cliente: as notas da base vêm da API", () => {
  it("a app não escreve a nota do preço nem «o volume a mais»", () => {
    for (const f of ["app-cliente/src/componentes/VistaDoPedido.tsx", "app-cliente/src/componentes/TrabalhoClyon.tsx", "app-cliente/src/componentes/Preco.tsx", "app-cliente/src/lib/pedidos.ts"]) {
      const s = codigo(f);
      expect(s, f).not.toMatch(/volume a mais/i);
      expect(s, f).not.toMatch(/POR CARGA/);
    }
    const s = codigo("app-cliente/src/componentes/VistaDoPedido.tsx");
    expect(s).toContain("p.avisos.map(");
  });
});
