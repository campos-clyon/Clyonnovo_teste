import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VALOR_UNICO_PELA_CLYON } from "./agir-como-cliente";
import { negociacoesParaOCliente } from "./negociacoes-para-o-cliente";
import { QUEM_FAZ_NO_VALOR_UNICO, valorUnicoComIva, valorUnicoParaOCliente } from "./valor-unico-ao-cliente";
import { textoDaEspera, type RespostaDoPedido } from "../../app-cliente/src/lib/pedidos";
import {
  ACEITAR,
  mensagemDeAceitar,
  PARA_ACEITAR,
  valorUnicoDe,
  valorUnicoParaMostrar,
} from "../../app-cliente/src/lib/valor-unico";

/**
 * A PARTE DA APP DE CLIENTE DA d39 — 15-11-2026. Num pedido com o valor único,
 * a rota do pedido (R5) só deixa sair a contratada e manda
 * `pedido.valorUnico: { titulo, valor, quemFaz }`. A app mostra esse cartão:
 *
 *   1. paridade — o que a rota manda chega ao ecrã tal como vem (o valor com o
 *      IVA e o sem IVA ao lado, a frase de quem faz);
 *   2. nunca «ainda sem propostas» com o valor único, e sem lista de parceiros;
 *   3. «Aceitar» não aceita na app (o servidor recusa-o): abre a conversa com a
 *      CLYON com o SIM, a mesma frase do site;
 *   4. «parceiro» no que o cliente lê (regra n), e a app Pro fica igual.
 */

const cru = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

const VISTA = "app-cliente/src/componentes/VistaDoPedido.tsx";

function resposta(pedido: Partial<RespostaDoPedido["pedido"]>, negociacoes: Array<{ estado: string }> = []) {
  return {
    pedido: { estadoTexto: "À espera de propostas", trabalhoClyon: false, ...pedido } as RespostaDoPedido["pedido"],
    negociacoes: negociacoes as unknown as RespostaDoPedido["negociacoes"],
    textos: { aindaSemPropostas: "Ainda sem propostas — os parceiros têm até amanhã." },
  };
}

describe("d39 na app de cliente — o valor único", () => {
  it("o que a rota manda chega ao cartão tal como vem: o valor com o IVA ao lado, nunca o sem IVA sozinho", () => {
    const daRota = valorUnicoParaOCliente(140, "total");
    expect(daRota.valor).toBe(valorUnicoComIva(140));
    expect(daRota.valor).toMatch(/\+ IVA = /);
    expect(valorUnicoDe({ valorUnico: daRota })).toEqual(daRota);
    expect(daRota.quemFaz).toBe(
      "Quem faz é um parceiro verificado da sua zona — quando aceitar, dizemos-lhe quem é, o dia e como pagar.",
    );
    expect(daRota.quemFaz).toBe(QUEM_FAZ_NO_VALOR_UNICO);
  });

  it("sem o campo, ou com ele partido, não há cartão (um site antigo, os outros pedidos)", () => {
    for (const v of [undefined, null, {}, { titulo: "x", valor: "" , quemFaz: "y" }, { titulo: 1, valor: "2", quemFaz: "3" }, "texto"]) {
      expect(valorUnicoDe({ valorUnico: v })).toBeNull();
    }
  });

  it("a rota manda o valorUnico só enquanto a CLYON não escolheu, e só deixa sair a contratada", () => {
    const rota = semNotas("src/lib/pedidos-do-cliente.ts");
    expect(rota).toMatch(/valorUnico: \(\(\) => \{ const v = valorUnicoDaLinha\([^)]*\)\.valorUnicoCliente\); return v != null && !contratado && !trabalhoClyon \? valorUnicoParaOCliente\(v, base\) : null;/);
    const linhas = [
      { id: 1, estado: "aberta", propostasJson: "[]", ofertaClyon: 0 },
      { id: 2, estado: "acordada", propostasJson: "[]", ofertaClyon: 0 },
    ];
    expect(negociacoesParaOCliente(linhas, false, 140).map((n) => n.id)).toEqual([2]);
  });

  it("com o valor único, nunca «ainda sem propostas»; sem ele, a frase da rota como antes", () => {
    const v = valorUnicoParaOCliente(140, "total");
    expect(textoDaEspera(resposta({ valorUnico: v }))).toBeNull();
    expect(textoDaEspera(resposta({ valorUnico: null }))).toBe("Ainda sem propostas — os parceiros têm até amanhã.");
  });

  it("o cartão só enquanto a CLYON não escolheu: sem contratada, fora de um Trabalho CLYON, com o pedido em aberto", () => {
    const v = valorUnicoParaOCliente(140, "total");
    expect(valorUnicoParaMostrar(resposta({ valorUnico: v }))).toEqual(v);
    expect(valorUnicoParaMostrar(resposta({ valorUnico: v }, [{ estado: "acordada" }]))).toBeNull();
    expect(valorUnicoParaMostrar(resposta({ valorUnico: v, trabalhoClyon: true }))).toBeNull();
    expect(valorUnicoParaMostrar(resposta({ valorUnico: v, estadoTexto: "Cancelado" }))).toBeNull();
    expect(valorUnicoParaMostrar(resposta({ valorUnico: null }))).toBeNull();
  });

  it("«Aceitar» é responder SIM à CLYON — a frase do site, e o servidor recusa aceitar pela app", () => {
    expect(ACEITAR).toBe("Aceitar");
    expect(cru("src/app/pedido/[token]/VistaDoPedido.tsx")).toContain(PARA_ACEITAR);
    expect(VALOR_UNICO_PELA_CLYON).toContain(PARA_ACEITAR);
    expect(mensagemDeAceitar(512)).toMatch(/^SIM\b/);
    expect(mensagemDeAceitar(512)).toContain("#512");
  });

  it("o ecrã do pedido: o cartão com os textos da rota e o botão para o WhatsApp da CLYON, e sem a pílula do estado", () => {
    const s = semNotas(VISTA);
    expect(s).toContain("const valorUnico = valorUnicoParaMostrar(r);");
    expect(s).toContain("{valorUnico.titulo}");
    expect(s).toContain("{valorUnico.valor}");
    expect(s).toContain("{valorUnico.quemFaz}");
    expect(s).toContain("{PARA_ACEITAR}");
    expect(s).toContain('<Botao titulo={ACEITAR} tipo="whatsapp" aoCarregar={() => whatsappDaClyon(mensagemDeAceitar(p.id))} />');
    expect(s).toContain("{momento || valorUnico ? null : <Etiqueta texto={p.estadoTexto} />}");
    // Nenhuma aceitação inventada: o cartão não chama a rota das acções.
    const cartao = s.slice(s.indexOf("{valorUnico ? ("), s.indexOf("{espera ? ("));
    expect(cartao).not.toMatch(/agir\(|ROTA_DAS_ACCOES|pedirComConta/);
    // As propostas só com elas em aberto — a rota não as manda com o valor único.
    expect(s).toContain("{!p.trabalhoClyon && !contratada && propostas.length > 0 ? (");
  });

  it("«parceiro» no que o cliente lê (regra n), e a lib da app não leva a do site", () => {
    const textos = [PARA_ACEITAR, ACEITAR, mensagemDeAceitar(1), valorUnicoParaOCliente(140, "total").quemFaz].join(" ");
    expect(textos).not.toMatch(/profissiona/i);
    expect(cru("app-cliente/src/lib/valor-unico.ts")).not.toMatch(/from "\.\.\/\.\.\/\.\.\/src\//);
  });
});
