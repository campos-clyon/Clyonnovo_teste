import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GUIA_POR_VERIFICAR_FRASE } from "./guia-antes-de-contratar";
import {
  DEPOIS_DE_NAO_SE_CONTRATAR,
  porqueNaoSeContrata,
} from "../../app-cliente/src/lib/pedidos";

/**
 * A GUIA ANTES DE CONTRATAR, NA APP DE CLIENTE — 04-11-2026 (d10.1, parte das
 * apps).
 *
 * A negociação da app traz `naoSeContrata` (`pedido-para-a-app.ts`): a frase
 * já escrita quando o parceiro tem a guia de resíduos por verificar num
 * trabalho que a exige; `null` quando nada impede. Como no site
 * (`PropostasRecebidas.tsx`), a proposta mostra-a por cima do «Contratar», e o
 * botão fica parado — antes, o cliente só via a recusa (409) depois de tocar.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a app lê naoSeContrata", () => {
  it("com a frase do site e algo para contratar, diz porquê e o que fazer", () => {
    expect(porqueNaoSeContrata({ accoes: ["aceitar", "desistir"], naoSeContrata: GUIA_POR_VERIFICAR_FRASE })).toBe(
      `Este parceiro ainda não tem a guia de resíduos verificada. ${DEPOIS_DE_NAO_SE_CONTRATAR}`,
    );
    expect(porqueNaoSeContrata({ accoes: ["contratar"], naoSeContrata: GUIA_POR_VERIFICAR_FRASE })).not.toBeNull();
  });

  it("sem frase (null, vazia, ou um site antigo que não a manda), nada impede", () => {
    expect(porqueNaoSeContrata({ accoes: ["aceitar"], naoSeContrata: null })).toBeNull();
    expect(porqueNaoSeContrata({ accoes: ["aceitar"], naoSeContrata: "  " })).toBeNull();
    expect(porqueNaoSeContrata({ accoes: ["aceitar"] })).toBeNull();
  });

  it("sem nada para contratar nesta proposta, não diz nada (como no site)", () => {
    expect(porqueNaoSeContrata({ accoes: ["desistir"], naoSeContrata: GUIA_POR_VERIFICAR_FRASE })).toBeNull();
  });

  it("a segunda frase é a do site, à letra", () => {
    const SITE = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(SITE).toContain(`{n.naoSeContrata} ${DEPOIS_DE_NAO_SE_CONTRATAR}`);
  });

  it("a API manda a frase da guia (a mesma que o site mostra)", () => {
    expect(ler("src/lib/pedido-para-a-app.ts")).toContain(
      "naoSeContrata: n.guiaPorVerificar === true ? GUIA_POR_VERIFICAR_FRASE : null",
    );
    expect(GUIA_POR_VERIFICAR_FRASE).toBe("Este parceiro ainda não tem a guia de resíduos verificada.");
  });
});

describe("a proposta mostra a frase e o «Contratar» fica parado", () => {
  const PROPOSTA = ler("app-cliente/src/componentes/Proposta.tsx");

  it("a frase vem de porqueNaoSeContrata, por cima do botão", () => {
    expect(PROPOSTA).toMatch(/const parado = porqueNaoSeContrata\(n\);/);
    const aviso = PROPOSTA.indexOf('{parado ? <Aviso tom="aviso" texto={parado} /> : null}');
    const botao = PROPOSTA.indexOf('<Botao titulo="Contratar"');
    expect(aviso).toBeGreaterThan(-1);
    expect(botao).toBeGreaterThan(aviso);
  });

  it("o botão de contratar fica desligado enquanto houver porquê", () => {
    // d25: também fica parado enquanto outra proposta está a ser contratada.
    expect(PROPOSTA).toMatch(/<Botao titulo="Contratar" aoCarregar=\{aoContratar\} ocupado=\{aContratar\} desligado=\{!!parado \|\| desligado\} \/>/);
  });

  it("o tipo da negociação conhece o campo", () => {
    expect(ler("app-cliente/src/lib/pedidos.ts")).toMatch(/naoSeContrata\?: string \| null;/);
  });
});
