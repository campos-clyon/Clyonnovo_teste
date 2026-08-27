import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O que a rota do perfil promete tem de vir da consulta.
 *
 * "Porque é que sempre que salvo a morada base e saio e volto lá, ele está a
 * pedir novamente como se não tivesse salvo? Loop sem fim."
 *
 * A gravação funcionava. Fui à base e as coordenadas estavam lá, certas —
 * 38,6008 / −9,1374, que é Amora. O que faltava era a LEITURA: `baseLat` e
 * `baseLng` não estavam no SELECT, a rota devolvia `null`, e o ecrã concluía
 * «ainda não escolheu da lista». Todas as vezes, para sempre, sobre uma base
 * que estava correcta.
 *
 * O `mbway` tinha o mesmo problema, acrescentado umas horas antes.
 *
 * É A TERCEIRA VEZ NESTA SESSÃO COM ESTA FORMA EXACTA: um campo declarado na
 * resposta e ausente da consulta. Antes foi o andar e o elevador no painel do
 * profissional, e depois o valor de partida no editor de pedidos. Nenhuma
 * delas dá erro — o campo chega `undefined`, vira `null`, e o ecrã acredita.
 *
 * Este teste compara as duas listas e chumba quando divergem.
 */

const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
const ROTA = readFileSync(
  join(process.cwd(), "src/app/api/profissionais/perfil/route.ts"),
  "utf8",
);

/** As colunas que a consulta do perfil vai mesmo buscar. */
function colunasLidas(): string[] {
  const i = DB.indexOf("export async function perfilDoProfissional(");
  const abre = DB.indexOf("`SELECT", i);
  const fecha = DB.indexOf("FROM providers", abre);
  const sql = DB.slice(abre + 7, fecha);
  return sql
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(c));
}

/** Os campos que a resposta lê do resultado da consulta: `p.<campo>`. */
function camposUsados(): string[] {
  const i = ROTA.indexOf("return NextResponse.json({");
  const bloco = ROTA.slice(i, ROTA.indexOf("\n    });", i));
  return [...new Set([...bloco.matchAll(/\bp\.([a-zA-Z][a-zA-Z0-9_]*)/g)].map((m) => m[1]))];
}

describe("a consulta e a resposta dizem o mesmo", () => {
  it("nenhum campo é lido sem ter sido pedido", () => {
    const lidas = new Set(colunasLidas());
    const emFalta = camposUsados().filter((c) => !lidas.has(c));
    /*
     * Uma falha aqui significa: a rota promete o campo, o ecrã acredita nele,
     * e ele chega sempre vazio. Não dá erro em lado nenhum — é por isso que
     * precisa de um teste.
     */
    expect(emFalta, `campos lidos mas não pedidos: ${emFalta.join(", ")}`).toEqual([]);
  });

  it("as duas listas não estão vazias — o teste tem de estar a ver alguma coisa", () => {
    // Um teste que não encontra nada passa sempre, e é pior do que não existir.
    expect(colunasLidas().length).toBeGreaterThan(15);
    expect(camposUsados().length).toBeGreaterThan(15);
  });

  it("a base vem na consulta — foi este o loop sem fim", () => {
    const lidas = colunasLidas();
    expect(lidas).toContain("baseLat");
    expect(lidas).toContain("baseLng");
  });

  it("o MB WAY também, que entrou no mesmo dia e pelo mesmo caminho", () => {
    expect(colunasLidas()).toContain("mbway");
  });
});

describe("o ecrã acredita no que a rota lhe diz", () => {
  it("a base só está «confirmada» quando há coordenadas", () => {
    const CAMPO = readFileSync(
      join(process.cwd(), "src/app/profissionais/painel/MoradaDaBase.tsx"),
      "utf8",
    );
    // O ecrã não estava errado: dizia a verdade sobre o que recebia.
    expect(CAMPO).toContain("const confirmada = lat != null && lng != null;");
  });
});
