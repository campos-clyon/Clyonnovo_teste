import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRASE_DO_ESTADO } from "./estado-do-pedido-ao-cliente";
import {
  PAGA_DIRETAMENTE_AO_PARCEIRO,
  PAGA_DIRETAMENTE_AO_PARCEIRO_CONTRATADO,
} from "./pagar-ao-parceiro";
import { cartaoDePagarSemConta, vistoParaQuemSoTemOLink } from "./pagar-so-com-o-link";
import { textoDaEspera } from "../../app-cliente/src/lib/pedidos";

/**
 * d4 (21-11-2026) — A app de cliente e o site com as mesmas frases no pedido.
 * (1) a app mostra a frase do estado tal e qual a rota a manda; (2) quem só tem o
 * link não recebe IBAN nem MB WAY; (3) depois de contratar a frase diz «contratou»;
 * (4) o site tem «Copiar» no IBAN e no MB WAY.
 */

const ler = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8").replace(/\r\n/g, "\n");

function resposta(estadoTexto: string, fraseDoEstado: string | null | undefined, extra: Record<string, unknown> = {}) {
  return {
    pedido: { estadoTexto, trabalhoClyon: false, valorUnico: null, ...extra },
    negociacoes: [],
    textos: { fraseDoEstado, aindaSemPropostas: "Ainda sem propostas — texto de antes." },
  } as unknown as Parameters<typeof textoDaEspera>[0];
}

describe("d4 (1) — a app mostra a frase do estado como a rota a manda", () => {
  it("as quatro frases do site saem iguais no cartão de espera", () => {
    for (const f of Object.values(FRASE_DO_ESTADO)) {
      expect(textoDaEspera(resposta("Em análise", f))).toBe(f);
    }
  });

  it("com o valor único aceite, a frase aparece (o cartão do valor não a esconde)", () => {
    const v = { titulo: "t", valor: "140,00 €", quemFaz: "q" };
    expect(textoDaEspera(resposta("Em análise", FRASE_DO_ESTADO.valor_unico_aceite, { valorUnico: v }))).toBe(FRASE_DO_ESTADO.valor_unico_aceite);
  });

  it("sem a frase (um site antigo) fica o de hoje; e nunca num pedido cancelado ou concluído", () => {
    expect(textoDaEspera(resposta("Em análise", undefined))).toBe("A CLYON está a rever o seu pedido.");
    expect(textoDaEspera(resposta("À espera de propostas", null))).toBe("Ainda sem propostas — texto de antes.");
    expect(textoDaEspera(resposta("Cancelado", FRASE_DO_ESTADO.a_conferir))).toBeNull();
    expect(textoDaEspera(resposta("Concluído", FRASE_DO_ESTADO.enviado))).toBeNull();
  });

  it("a app não repete a frase na pílula", () => {
    const v = ler("app-cliente", "src", "componentes", "VistaDoPedido.tsx");
    expect(v).toMatch(/momento \|\| valorUnico \|\| espera \? null : <Etiqueta/);
  });
});

describe("d4 (2) — o link sem conta não mostra os dados de pagamento", () => {
  it("o cartão diz o parceiro, o total e o caminho para criar conta", () => {
    const c = cartaoDePagarSemConta("Parceiro Exemplo", 452.03);
    expect(c.titulo).toBe("Pagar a Parceiro Exemplo · 452,03 €");
    expect(c.texto).toBe("Paga diretamente a Parceiro Exemplo. Para ver os dados de pagamento e registar o pagamento, crie a sua conta — leva um minuto.");
    expect(cartaoDePagarSemConta("Parceiro Exemplo", null).titulo).toBe("Pagar a Parceiro Exemplo");
  });

  it("a vista do convidado é uma lista própria: nem IBAN, nem titular, nem MB WAY", () => {
    const completo = {
      parceiro: "Parceiro Exemplo",
      conta: { total: 100 },
      paraPagar: { iban: "PT50000000000000000000000", titular: "X", mbway: "910000000" },
      opcoes: [{ id: "mbway" }],
      faturas: { frase: "f" },
    };
    const visto = JSON.stringify(vistoParaQuemSoTemOLink(completo));
    expect(visto).not.toMatch(/iban|PT50|mbway|910000000|titular|faturas/i);
    expect(vistoParaQuemSoTemOLink(completo).convidado).toBe(true);
  });

  it("a rota só dá os dados a quem entrou pela sessão da conta, e recusa o POST ao link", () => {
    const r = ler("src", "app", "api", "pagamentos", "ao-parceiro", "route.ts");
    expect(r).toMatch(/if \(!acesso\.trabalho\.porSessao\) return NextResponse\.json\(vistoParaQuemSoTemOLink\(visto\)\)/);
    expect(r).toMatch(/if \(!t\.porSessao\) return NextResponse\.json\(\{ ok: false, error: PAGAR_SO_COM_CONTA, convidado: true \}, \{ status: 403 \}\)/);
    const a = ler("src", "lib", "acesso-ao-pagamento.ts");
    expect(a).toMatch(/emailDoCliente: \(pedido\.contactEmail \?\? ""\)\.trim\(\)\.toLowerCase\(\) \|\| null,\n\s+porSessao,/);
  });

  it("a R5 do convidado leva o cartão e nunca o pagamento", () => {
    const l = ler("src", "lib", "pedidos-do-cliente.ts");
    const i = l.indexOf("export async function pedidoDoConvidadoParaAApp(");
    const corpo = l.slice(i).replace(/^\s*\/\/.*$/gm, "");
    expect(corpo).toContain("pagarSemConta,");
    expect(corpo).not.toMatch(/aoParceiro|paraPagar|iban|mbway/i);
  });

  it("a app desenha o cartão só no link sem conta", () => {
    const v = ler("app-cliente", "src", "componentes", "VistaDoPedido.tsx");
    expect(v).toMatch(/convidado && p\.pagarSemConta/);
  });
});

describe("d4 (3) — depois de contratar, «contratou»", () => {
  it("o bloco «Pagar a …» diz o parceiro que contratou, com o resto da frase igual", () => {
    expect(PAGA_DIRETAMENTE_AO_PARCEIRO_CONTRATADO).toContain("ao parceiro que contratou —");
    expect(PAGA_DIRETAMENTE_AO_PARCEIRO_CONTRATADO).not.toContain("que contratar");
    expect(PAGA_DIRETAMENTE_AO_PARCEIRO_CONTRATADO.replace("contratou", "contratar")).toBe(PAGA_DIRETAMENTE_AO_PARCEIRO);
    const p = ler("src", "lib", "pagar-ao-parceiro-para-o-cliente.ts");
    expect(p).toContain("frase: PAGA_DIRETAMENTE_AO_PARCEIRO_CONTRATADO,");
  });

  it("o «Quem somos» usa a constante, não uma cópia", () => {
    const s = ler("src", "app", "sobre-nos", "page.tsx");
    expect(s).toContain("const PAGA_COMO_PREFERIR_NO_NOVO_MODELO = PAGA_DIRETAMENTE_AO_PARCEIRO;");
  });
});

describe("d4 (4) — «Copiar» no site, como na app", () => {
  it("o IBAN e o MB WAY têm o botão", () => {
    const c = ler("src", "components", "PagarAoParceiro.tsx");
    expect(c.match(/<BotaoCopiar valor=/g)?.length).toBe(2);
    expect(c).toContain("navigator.clipboard.writeText");
  });
});
