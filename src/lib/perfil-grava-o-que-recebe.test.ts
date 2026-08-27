import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O que a rota do perfil escreve tem de caber na lista que grava.
 *
 * "Eu preenchi todos os campos, inclusive o do MB WAY, mas aqui diz que não."
 *
 * E dizia bem. O `mbway` chegava a `actualizarPerfilDoProfissional` dentro do
 * objecto e era descartado, porque a lista de permitidos não o conhecia — e o
 * que não está na lista sai em SILÊNCIO. O ecrã dizia «Guardado às 15:52»
 * sobre um campo que nunca chegou à base.
 *
 * A lista existe por uma boa razão: as chaves vão para a lista de COLUNAS do
 * SQL, e uma consulta preparada parametriza valores, não identificadores. O
 * problema nunca foi o filtro — é o silêncio.
 *
 * É A QUARTA VEZ NESTA SESSÃO COM ESTA FORMA. Uma ponta manda um campo, a
 * outra deita-o fora sem se queixar:
 *
 *   · o andar e o elevador — a API anunciava-os, o SELECT não os pedia
 *   · o valor de partida — o formulário mandava, a lista de colunas descartava
 *   · a morada base — gravava bem, o SELECT não a lia
 *   · o MB WAY — chegava à função, a lista não o conhecia
 *
 * Nenhuma delas dá erro. É por isso que precisam de testes como este.
 */

const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
const ROTA = readFileSync(
  join(process.cwd(), "src/app/api/profissionais/perfil/route.ts"),
  "utf8",
);

/** As colunas que `actualizarPerfilDoProfissional` deixa mesmo gravar. */
function permitidas(): string[] {
  const i = DB.indexOf("export async function actualizarPerfilDoProfissional(");
  const abre = DB.indexOf("const permitidas = [", i);
  const fecha = DB.indexOf("];", abre);
  return [...DB.slice(abre, fecha).matchAll(/"([a-zA-Z][a-zA-Z0-9_]*)"/g)].map((m) => m[1]);
}

/** Os campos que a rota escreve no objecto que manda gravar. */
function escritos(): string[] {
  return [
    ...new Set([...ROTA.matchAll(/\bmudancas\.([a-zA-Z][a-zA-Z0-9_]*)\s*=/g)].map((m) => m[1])),
  ];
}

describe("nada do que a rota escreve se perde pelo caminho", () => {
  it("todos os campos escritos estão na lista de permitidos", () => {
    const lista = new Set(permitidas());
    const perdidos = escritos().filter((c) => !lista.has(c));
    /*
     * Uma falha aqui significa: o ecrã diz que guardou, e não guardou. Sem
     * erro, sem aviso, sem nada — só um campo que volta vazio da próxima vez.
     */
    expect(perdidos, `campos escritos mas não gravados: ${perdidos.join(", ")}`).toEqual([]);
  });

  it("as duas listas não estão vazias — o teste tem de estar a ver alguma coisa", () => {
    // Um teste que não encontra nada passa sempre, e é pior do que não existir.
    expect(permitidas().length).toBeGreaterThan(10);
    expect(escritos().length).toBeGreaterThan(10);
  });

  it("o MB WAY está lá — foi este que se perdeu", () => {
    expect(permitidas()).toContain("mbway");
  });

  it("continua a ser uma lista de permitidos, e não uma passagem livre", () => {
    // As chaves vão para a lista de colunas do SQL. Tirar o filtro para
    // resolver o silêncio seria trocar um campo perdido por uma porta aberta.
    const i = DB.indexOf("export async function actualizarPerfilDoProfissional(");
    const corpo = DB.slice(i, DB.indexOf("UPDATE providers", i));
    expect(corpo).toContain("permitidas.filter((c) => dados[c] !== undefined)");
  });

  it("o estado e a guia NÃO estão na lista — não se aprova a si próprio", () => {
    const lista = permitidas();
    expect(lista).not.toContain("estado");
    expect(lista).not.toContain("guiaVerificadaEm");
    expect(lista).not.toContain("isActive");
    expect(lista).not.toContain("passwordHash");
  });
});
