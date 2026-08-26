import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Duas coisas que ele apanhou a usar o site a sério.
 *
 * 1. "Torne a descrição sempre visível para os pros, e altamente recomendada
 *    para o cliente." A lista do profissional dizia o serviço, a cidade e o
 *    dinheiro — tudo menos o que ele ia fazer. E do lado do cliente o campo
 *    chamava-se "Mais alguma coisa? (opcional)", o enquadramento mais fraco
 *    que um campo pode ter.
 *
 * 2. "Fiz alterações no endereço base e os kms mantêm-se como antes." A base
 *    era geocodificada UMA vez, na inscrição, e nunca mais: mudar a morada
 *    trocava o texto e deixava as coordenadas antigas. Ele mudou de Palmela
 *    para a Amora e os quilómetros não mexeram.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ECRA = ler("src/app/profissionais/painel/Trabalhos.tsx");
const FORM = ler("src/app/plataforma/pedir/components/CompactOrderDetails.tsx");
const PERFIL = ler("src/app/api/profissionais/perfil/route.ts");
const DB = ler("src/lib/db.ts");

describe("a descrição do lado do profissional", () => {
  it("vê-se na lista, sem ter de abrir o pedido", () => {
    expect(ECRA).toContain("p.description?.trim() ?");
    expect(ECRA).toContain("WebkitLineClamp: 2");
  });

  it("e quando não há, diz-se — em vez de deixar um espaço mudo", () => {
    // Sem descrição é informação também, e diz-lhe o que fazer a seguir.
    expect(ECRA).toContain("Sem descrição — veja as fotografias ou pergunte à CLYON.");
    expect(ECRA).toContain("O cliente não escreveu uma descrição.");
  });
});

describe("a descrição do lado do cliente", () => {
  it("deixou de ser «opcional» e passou a ser pedida a sério", () => {
    // A etiqueta antiga, não a palavra: o comentário do código explica de
    // onde viemos e tem direito a citá-la.
    expect(FORM).not.toContain('Mais alguma coisa?{" "}');
    expect(FORM).not.toContain("(opcional)</span>");
    expect(FORM).toContain("Descreva o que precisa");
    expect(FORM).toContain("muito recomendado");
  });

  it("diz PORQUÊ — e o porquê é o dinheiro dele", () => {
    expect(FORM).toContain("mais baixas");
    expect(FORM).toContain("quem adivinha");
  });

  it("continua a NÃO ser obrigatória — obrigar só produz «asd»", () => {
    // Nada aqui pode impedir o envio: é um empurrão, não um portão.
    const bloco = FORM.slice(FORM.indexOf("Descreva o que precisa"));
    expect(bloco).not.toContain("required");
    expect(bloco).not.toContain("disabled");
  });
});

describe("mudar a morada base muda o ponto no mapa", () => {
  it("guardar a cidade volta a geocodificar", () => {
    const bloco = PERFIL.slice(
      PERFIL.indexOf('if ("cidade" in corpo)'),
      PERFIL.indexOf('if ("categorias" in corpo)'),
    );
    expect(bloco).toContain("geocodificarLocalidade(c)");
    expect(bloco).toContain("mudancas.baseLat");
    expect(bloco).toContain("mudancas.baseLng");
  });

  it("se o geocodificador falhar, fica sem ponto — não com o ponto velho", () => {
    // Melhor cair na regra das zonas do que medir distâncias desde uma casa
    // onde ele já não vive.
    const bloco = PERFIL.slice(
      PERFIL.indexOf('if ("cidade" in corpo)'),
      PERFIL.indexOf('if ("categorias" in corpo)'),
    );
    expect(bloco).toContain("base?.lat ?? null");
    expect(bloco).toContain("base?.lng ?? null");
  });

  it("e a base de dados aceita mesmo essas colunas", () => {
    // Estavam na lista de permitidas; faltava alguém escrever-lhes.
    const bloco = DB.slice(DB.indexOf("const permitidas = ["), DB.indexOf("];", DB.indexOf("const permitidas = [")));
    expect(bloco).toContain('"baseLat"');
    expect(bloco).toContain('"baseLng"');
  });
});
