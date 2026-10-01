import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { totalEmPalavras, comFacturaEmPalavras } from "./conta-em-palavras";
import { textoDaMesa } from "./texto-da-mesa";
import { notaDaCargaParaOCliente } from "./base-do-preco";
import { lerARespostaDirecta } from "./ler-a-resposta";

/**
 * *«Porque a mensagem não é clara em relação ao valor de 300, que é por
 * carga?»* — 30-09-2026.
 *
 * A Carolina (#400) recebeu «TRSul propõe 300,00 €» e «fica em 315,00 € sem
 * IVA» num pedido marcado POR CARGA. Todos os ecrãs o diziam; a mensagem que
 * ela lê não dizia. Estes testes guardam que cada valor dito ao cliente leva a
 * unidade agarrada, e que o que ele responde com ela continua a ler-se.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("a conta dita ao cliente, por carga", () => {
  it("cada número leva a unidade — e o total de sempre não muda", () => {
    /*
     * Desde 29-09-2026 a frase já não repete o preço: quem chama di-lo antes,
     * já com a taxa (`preco-do-cliente.ts`). A unidade continua nos dois
     * sítios onde há número ou a falta dele se nota.
     */
    expect(totalEmPalavras(300, null, undefined, undefined, "carga")).toBe(
      "Valor por carga, sem IVA. Com factura acrescem 23 % de IVA: 387,45 € por carga.",
    );
    expect(totalEmPalavras(300, null)).toBe(
      "Valor sem IVA. Com factura acrescem 23 % de IVA: 387,45 €.",
    );
    expect(comFacturaEmPalavras(300, null, undefined, "carga")).toBe(
      "Com factura acrescem 23 % de IVA: 387,45 € por carga.",
    );
  });

  it("em dinheiro, as duas entregas dizem que são por carga", () => {
    const frase = totalEmPalavras(300, null, undefined, "dinheiro", "carga");
    expect(frase).toContain("Paga 300,00 € por carga em dinheiro ao profissional");
    expect(frase).toContain("15,00 € de taxa à CLYON por cada carga, por referência");
  });

  it("a nota só existe para o preço por carga", () => {
    expect(notaDaCargaParaOCliente("total")).toBeNull();
    expect(notaDaCargaParaOCliente("carga")).toContain("o total depende de quantas cargas forem");
  });

  it("a lista de propostas diz a unidade em cada linha, e acaba com a nota", () => {
    const t = textoDaMesa(
      400,
      [{ profissionalNome: "TRSul", valor: 300, aSuaEspera: true }],
      0,
      "carga",
    );
    expect(t).toContain("• TRSul: 300,00 € por carga (à sua espera)");
    expect(t).toContain(notaDaCargaParaOCliente("carga") as string);
    expect(
      textoDaMesa(400, [{ profissionalNome: "TRSul", valor: 300, aSuaEspera: true }], 0),
    ).not.toContain("por carga");
  });
});

describe("as mensagens ao cliente passam a base", () => {
  const WHATSAPP = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));
  const ASSISTENTE = semComentarios(ler("src/lib/assistente-automatico.ts"));
  const AVISAR = semComentarios(ler("src/lib/avisar-da-proposta.ts"));

  it("a proposta e a aceitação — a mensagem da Carolina", () => {
    // Uma para a proposta, outra para a aceitação — com o PREÇO DELE, já com
    // a taxa, desde 29-09-2026. O valor do profissional fica só no registo
    // interno do aviso.
    expect(WHATSAPP.match(/precoComBase\(euros\(preco\), dados\.base\)/g)?.length).toBe(2);
    expect(WHATSAPP.match(/precoComBase\(euros\(dados\.valor\), dados\.base\)/g)?.length).toBe(1);
    expect(WHATSAPP.match(/comNotaDaCarga\(dados\.base\)/g)?.length).toBe(2);
    expect(WHATSAPP.match(/tituloDeFechar\(preco, dados\.base\)/g)?.length).toBe(2);
    // O botão diz a unidade, e cabe nos 20 caracteres do WhatsApp.
    expect(WHATSAPP).toContain("€/carga");
    expect(WHATSAPP).toContain("junto.length <= 20");
  });

  it("o «Fechado com…» e o ecrã do pedido", () => {
    expect(WHATSAPP).toContain("comNotaDaCarga(alvo.base)");
    expect(WHATSAPP).toContain("textoDaMesa(pedidoId, propostas, aVer, base)");
  });

  it("quem avisa passa a base do pedido", () => {
    expect(AVISAR).toContain("const base = lerBase(pedido.baseDoPreco);");
    expect(AVISAR.match(/^\s*base,\s*$/gm)?.length).toBe(4);
  });

  it("e a passagem do assistente diz o mesmo que o caminho imediato", () => {
    expect(ASSISTENTE).toContain("const base = lerBase(p.baseDoPreco);");
    // A proposta, a aceitação e — desde 29-09-2026 — o «combinado» em dinheiro.
    expect(ASSISTENTE.match(/totalEmPalavras\([^)]*, base\)/g)?.length).toBe(3);
    expect(semComentarios(ler("src/lib/db.ts"))).toContain("o.createdAt, o.dataAgendada, o.baseDoPreco");
  });
});

describe("o que ele responde com a unidade continua a ler-se", () => {
  it("«aceito 300 por carga» é um sim de 300, e não uma empresa chamada «por carga»", () => {
    expect(lerARespostaDirecta("aceito 300 por carga")).toEqual({ tipo: "sim", valor: 300 });
    expect(lerARespostaDirecta("fechar 300 €/carga")).toEqual({ tipo: "sim", valor: 300 });
    expect(lerARespostaDirecta("recusar 300 por carga")).toEqual({ tipo: "nao", valor: 300 });
  });

  it("«250 por carga» sozinho é uma contraproposta — tem o seu leitor", () => {
    expect(lerARespostaDirecta("250 por carga")).toBeNull();
    expect(lerARespostaDirecta("250€/carga")).toBeNull();
  });

  it("várias recusas com a unidade também", () => {
    expect(lerARespostaDirecta("recusar 300 por carga, recusar 250 por carga")).toEqual({
      tipo: "nao_varias",
      valores: [300, 250],
    });
  });
});
