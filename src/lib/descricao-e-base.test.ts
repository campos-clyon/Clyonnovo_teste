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

/*
 * O CÓDIGO SEM COMENTÁRIOS.
 *
 * O comentário que explica esta mudança cita as classes antigas —
 * `text-slate-700` — para dizer de onde viemos. Um teste que procure essa
 * classe no ficheiro inteiro encontra-a lá dentro e chumba uma correcção que
 * está feita.
 */
const SEM_COMENTARIOS = ECRA.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");

/** O bloco da descrição: do teste do `trim()` até ao texto dela. */
const DESCRICAO = (() => {
  const i = SEM_COMENTARIOS.indexOf("{pedido.description?.trim() ?");
  const j = SEM_COMENTARIOS.indexOf("{pedido.description}", i);
  return SEM_COMENTARIOS.slice(i, j);
})();

/** O que fica sem descrição: do fim do bloco de cima até ao fim do ramo. */
const SEM_DESCRICAO = (() => {
  const i = SEM_COMENTARIOS.indexOf("{pedido.description}");
  const j = SEM_COMENTARIOS.indexOf("propor.", i);
  return SEM_COMENTARIOS.slice(i, j);
})();

/** A lista de baixo — cidade, dia, factura. É contra esta que se destaca. */
const META = (() => {
  const i = SEM_COMENTARIOS.indexOf('<ul className="mt-3 space-y-1.5');
  return SEM_COMENTARIOS.slice(i, SEM_COMENTARIOS.indexOf("</ul>", i));
})();
const FORM = ler("src/app/plataforma/pedir/components/CompactOrderDetails.tsx");
const PERFIL = ler("src/app/api/profissionais/perfil/route.ts");
const DB = ler("src/lib/db.ts");

describe("a descrição do lado do profissional", () => {
  it("vê-se INTEIRA ao abrir o pedido — e já não cortada na lista", () => {
    /*
     * Esteve na lista, em duas linhas cortadas, e por uma boa razão: a lista
     * dizia o serviço, a cidade e o dinheiro, tudo menos o que ele ia fazer.
     *
     * Saiu a 12-09-2026: "remova a descrição, isso ele vê quando abrir o
     * pedido". Duas linhas de texto corrido no meio do cartão eram a mancha
     * onde o olho encalhava, e a fotografia — que passou de 80 para 112 px —
     * responde à mesma pergunta mais depressa do que o texto respondia.
     *
     * O que este teste guarda é o que sempre importou: que a descrição EXISTE
     * do lado dele, e que a falta dela é dita em vez de ser um espaço mudo.
     */
    expect(ECRA).toContain("{pedido.description}");
  });

  it("e quando não há, diz-se — em vez de deixar um espaço mudo", () => {
    // Sem descrição é informação também, e diz-lhe o que fazer a seguir.
    expect(ECRA).toContain("O cliente não escreveu uma descrição.");
  });

  /*
   * E VÊ-SE. "Vamos destacar melhor a descrição com uma cor diferente, está
   * muito sumido no meio de tudo." — 17-09-2026.
   *
   * Estar lá não chegava: saía em `text-sm text-slate-700`, um passo de
   * cinzento acima da lista de baixo e nem isso ao lado da caixa do acesso. A
   * frase que decide o preço lia-se como uma etiqueta. Uma informação que
   * ninguém lê custa o mesmo que uma informação que não existe.
   */
  it("tem painel próprio, na cor da marca — e não é mais um cinzento", () => {
    expect(DESCRICAO).toContain("border-acao");
    expect(DESCRICAO).toContain("text-tinta");
    expect(DESCRICAO).toContain("font-semibold");
    expect(DESCRICAO).not.toContain("text-slate-700");
  });

  it("e o que está à volta CONTINUA discreto — senão não há destaque nenhum", () => {
    /*
     * Destacar é uma diferença, não um volume. Se a lista de baixo subisse
     * com ela, voltávamos ao princípio com mais tinta gasta — e é assim que
     * um cartão fica todo a gritar e nada a dizer.
     *
     * A lista fica no cinzento de base. A EXCEPÇÃO é o dia, que já era
     * carregado antes desta mudança e por boa razão: uma recolha marcada para
     * amanhã decide se ele sequer pode propor. São dois destaques, e chegam.
     */
    expect(META).toContain('text-sm text-slate-600');
    expect(META).not.toContain("bg-[#EAF6F9]");
    expect(META).not.toContain("text-[15px]");
  });

  it("a falta de descrição fica âmbar, que é um aviso e não a marca", () => {
    // Aqui não há nada para ler: há uma coisa a fazer antes de propor um
    // valor. Duas mensagens diferentes não podem ter a mesma cor.
    expect(SEM_DESCRICAO).toContain("amber");
    expect(SEM_DESCRICAO).not.toContain("border-acao");
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
