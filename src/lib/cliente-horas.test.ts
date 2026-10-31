import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AS HORAS DO TRABALHO, DO LADO DO CLIENTE — 31-10-2026. O link do pedido (e
 * a /conta, que usa o mesmo ecrã) e a app de cliente mostram o bloco das
 * horas com «Confirmo as horas» e «Não concordo» (com o porquê), a diferença
 * paga-se com `parte: "diferenca"`, e os textos novos dizem «parceiro».
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const SITE = ler("src/app/pedido/[token]/HorasDoTrabalho.tsx");
const PROPOSTAS = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
const CONTA = ler("src/app/conta/components/OrderDetailModal.tsx");
const PAGAR = ler("src/components/PagarTrabalho.tsx");
const APP = ler("app-cliente/src/componentes/HorasDoTrabalho.tsx");
const APP_VISTA = ler("app-cliente/src/componentes/VistaDoPedido.tsx");
const APP_PAGAR = ler("app-cliente/src/componentes/Pagar.tsx");
const APP_LIB = ler("app-cliente/src/lib/pedidos.ts");

/** As strings e o texto do JSX, sem comentários — o que o cliente lê. */
function textos(fonte: string): string[] {
  const semComentarios = fonte.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");
  const aspas = [...semComentarios.matchAll(/"([^"\n]{3,})"|`([^`]{3,})`/g)].map((m) => m[1] ?? m[2]);
  const jsx = [...semComentarios.matchAll(/>([^<>{}\n]*[A-Za-zÀ-ú][^<>{}\n]*)</g)].map((m) => m[1].trim());
  return [...aspas, ...jsx].filter(Boolean);
}

describe("o link do pedido e a /conta", () => {
  it("o bloco das horas confirma e contesta, com o motivo", () => {
    expect(SITE).toContain('onAgir("confirmar_horas")');
    expect(SITE).toContain('onAgir("contestar_horas", motivo.trim())');
    expect(SITE).toContain('negociacao.accoes.includes("confirmar_horas")');
    expect(SITE).toContain("MOTIVO_MINIMO_DA_CONTESTACAO");
    expect(PROPOSTAS).toContain("<HorasDoTrabalho");
    expect(PROPOSTAS).toContain('...(accao === "contestar_horas" ? { motivo } : {})');
    // O «Sim, ficou feito» só quando a API o deixa (as horas confirmadas).
    expect(PROPOSTAS).toContain('{acordada.accoes.includes("confirmar") && (');
    // A /conta abre o mesmo ecrã.
    expect(CONTA).toContain("<PropostasRecebidas");
  });

  it("por hora, o preço diz por hora, com a estimativa e os materiais", () => {
    expect(PROPOSTAS).toContain('"Preço por hora"');
    expect(PROPOSTAS).toContain("acordada.preco.nota");
    expect(PROPOSTAS).toContain("n.materiaisTexto");
    expect(PROPOSTAS).toContain('sufixo={n.horas ? "/hora" : n.porCarga ? "/carga" : ""}');
  });

  it("a diferença das horas paga-se pela mesma porta, com parte: diferenca", () => {
    expect(PAGAR).toContain('...(parte === "diferenca" ? { parte: "diferenca" } : {})');
    expect(PAGAR).toContain('void pedir(qual, "diferenca")');
    expect(PAGAR).toContain("diferencaEmPalavras(d.aPagar, ivaIncluido)");
    expect(PAGAR).toContain("a CLYON devolve-lhe");
  });
});

describe("a app de cliente", () => {
  it("o bloco das horas confirma e contesta, com o motivo", () => {
    expect(APP).toContain('n.accoes.includes("confirmar_horas") && n.accoes.includes("contestar_horas")');
    expect(APP).toContain('void responder("confirmar_horas")');
    expect(APP).toContain('void responder("contestar_horas")');
    expect(APP).toContain("corpoDasHoras({ pedidoId, negociacaoId: n.id, accao, motivo })");
    expect(APP_LIB).toMatch(/accao: p\.accao, motivo: \(p\.motivo \?\? ""\)\.trim\(\)/);
    expect(APP_VISTA).toContain("<HorasDoTrabalho pedidoId={pedidoId} n={contratada} agir={agir} />");
  });

  it("a diferença paga-se com parte: diferenca", () => {
    expect(APP_LIB).toContain('...(p.parte === "diferenca" ? { parte: "diferenca" as const } : {})');
    expect(APP_PAGAR).toContain('void criar("mbway", "diferenca")');
    expect(APP_PAGAR).toContain('void criar("multibanco", "diferenca")');
  });
});

describe("ao cliente diz-se «parceiro»", () => {
  it("nenhum texto novo diz «profissional»", () => {
    for (const fonte of [SITE, APP]) {
      for (const t of textos(fonte)) expect(t).not.toMatch(/profissiona/i);
    }
    expect(SITE).toContain("parceiro");
    expect(APP).toContain("parceiro");
  });
});
