import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { faixaDoValorEmAtraso, PAGAR_A_CLYON as PAGAR_A_CLYON_DA_APP, type NovoModeloDaCarteira } from "../../app-pro/src/lib/novo-modelo";
import { faixaDoValorAPassar, linhaDoValorAPassar, PAGAR_A_CLYON } from "./como-recebe-no-novo-modelo";
import { PAGAR_O_VALOR_EM_ATRASO } from "./valor-em-atraso";
import { dadosParaPagar, type VistoDoPagarAoParceiro } from "../../app-cliente/src/lib/pagar-ao-parceiro";
import { quantidadeCurta } from "../../app-cliente/src/lib/pagamento";

/*
 * A PARTE DAS APPS DE TRÊS DECISÕES DE 19-11-2026 (CEO e dono):
 *   d6 — a faixa do Início da app CLYON Pro é a que o servidor escreve
 *        (`novoModelo.faixa`), a mesma do painel; a app deixa de somar.
 *   d5 — com os dados de pagamento do parceiro por confirmar, a app de cliente
 *        não mostra o IBAN nem o MB WAY: só a frase do servidor.
 *   d8 — o texto à vista das duas apps na grafia do Acordo de 1990 e sem
 *        anglicismos (a regra da orquestra passou a ler as apps).
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

const AGORA = new Date("2026-11-19T12:00:00Z");
const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const dia = (iso: string | null) => (iso ? "DIA" : null);

const valor = (negociacaoId: number, total: number, prazoAte: string | null) => {
  const l = linhaDoValorAPassar({ total, prazoAte: prazoAte ? new Date(prazoAte) : null, paga: false }, AGORA);
  return {
    negociacaoId,
    pedidoId: null,
    total,
    iva: 2.3,
    taxa: total - 2.3,
    nasceuEm: null,
    prazoAte,
    multibanco: null,
    comReserva: false,
    estado: l.estado,
    linha: l.linha,
  };
};

/** A carteira como a rota a manda: a faixa feita pela mesma função que a rota usa. */
function carteira(valores: ReturnType<typeof valor>[], comFaixa = true): NovoModeloDaCarteira {
  return {
    emVigor: true,
    valorEmAtraso: 0,
    valores,
    standBy: null,
    dadosParaReceber: null,
    ...(comFaixa ? { faixa: faixaDoValorAPassar(valores, AGORA) } : {}),
  };
}

describe("d6) a faixa do Início da app CLYON Pro é a do painel", () => {
  it("1 trabalho: o título, o texto e o botão são os do servidor", () => {
    const nm = carteira([valor(1, 12.3, "2026-11-22T23:00:00Z")]);
    const app = faixaDoValorEmAtraso(nm, euros, dia, AGORA.getTime())!;
    const painel = nm.faixa!;
    expect({ titulo: app.titulo, texto: app.texto, botao: app.botao }).toEqual({
      titulo: painel.titulo,
      texto: painel.texto,
      botao: painel.botao,
    });
    expect(app.titulo).toBe("A passar à CLYON · 12,30 € até 22/11");
    expect(app.botao).toBe("Pagar a parte da CLYON");
    expect(app).toMatchObject({ standBy: false, emAtraso: false });
  });

  it("2 trabalhos: «X € de 2 trabalhos · o primeiro prazo é dd/mm», igual ao painel — a app não soma", () => {
    const nm = carteira([valor(1, 12.3, "2026-11-23T10:00:00Z"), valor(2, 12.3, "2026-11-21T10:00:00Z")]);
    const app = faixaDoValorEmAtraso(nm, euros, dia, AGORA.getTime())!;
    expect(app.titulo).toBe(nm.faixa!.titulo);
    expect(app.titulo).toBe("24,60 € de 2 trabalhos · o primeiro prazo é 21/11");
    expect(app.texto).toBe(nm.faixa!.texto);
    expect(app.botao).toBe(PAGAR_A_CLYON);
  });

  it("2 trabalhos, 1 em atraso: o botão do atraso e a cor do atraso", () => {
    const nm = carteira([valor(1, 10, "2026-11-18T10:00:00Z"), valor(2, 14.6, "2026-11-22T10:00:00Z")]);
    const app = faixaDoValorEmAtraso(nm, euros, dia, AGORA.getTime())!;
    expect(app.texto).toBe(nm.faixa!.texto);
    expect(app.botao).toBe(PAGAR_O_VALOR_EM_ATRASO);
    expect(app.emAtraso).toBe(true);
  });

  it("o servidor diz que não há faixa (null): a app não a inventa a partir dos valores", () => {
    const nm = { ...carteira([valor(1, 12.3, "2026-11-22T23:00:00Z")]), faixa: null };
    expect(faixaDoValorEmAtraso(nm, euros, dia, AGORA.getTime())).toBeNull();
  });

  it("um site antigo sem `faixa`: a conta de antes, com o botão novo e «suspensa»", () => {
    const f = faixaDoValorEmAtraso(carteira([valor(1, 12.3, "2026-11-22T23:00:00Z")], false), euros, dia, AGORA.getTime())!;
    expect(f.botao).toBe("Pagar a parte da CLYON");
    expect(f.texto).toMatch(/a conta fica suspensa até pagar\.$/);
  });

  it("o botão no prazo é a constante do site, e o componente desenha a faixa com a cor do atraso", () => {
    expect(PAGAR_A_CLYON_DA_APP).toBe(PAGAR_A_CLYON);
    const s = semComentarios(ler("app-pro/src/componentes/AvisosDoNovoModelo.tsx"));
    expect(s).toContain("faixaDoValorEmAtraso(nm, euros, diaCurto)");
    expect(s).toContain("valor.standBy || valor.emAtraso ? c.mauSuave : c.avisoSuave");
    expect(semComentarios(ler("app-pro/src/lib/novo-modelo.ts"))).not.toContain("Pagar à CLYON");
  });
});

describe("d5) os dados de pagamento por confirmar, na app de cliente", () => {
  const base: VistoDoPagarAoParceiro = {
    pagaAoParceiro: true,
    paraPagar: { iban: "PT50 0000 0000 0000 0000 0000 0", titular: "Exemplo", mbway: "MBWAY-DE-EXEMPLO" },
  };
  it("com `dadosPorConfirmar` não há IBAN nem MB WAY à vista, mesmo que venham", () => {
    expect(dadosParaPagar({ ...base, dadosPorConfirmar: true })).toBeNull();
    expect(dadosParaPagar({ ...base, dadosPorConfirmar: true, paraPagar: { iban: null, titular: null, mbway: null } })).toBeNull();
  });
  it("sem dados nenhuns, nada; com dados e sem retenção, os dados", () => {
    expect(dadosParaPagar({ pagaAoParceiro: true, paraPagar: { iban: null, titular: null, mbway: null } })).toBeNull();
    expect(dadosParaPagar(base)).toEqual(base.paraPagar);
  });
  it("o cartão lê os dados por `dadosParaPagar`, mostra `semDados` e só as opções que o servidor manda", () => {
    const s = semComentarios(ler("app-cliente/src/componentes/PagarAoParceiro.tsx"));
    expect(s).toContain("const p = dadosParaPagar(visto);");
    expect(s).toContain("{visto.semDados ?");
    expect(s).toContain("visto.opcoes.map(");
  });
});

describe("d8) a grafia do Acordo nas duas apps", () => {
  it("a regra d8 da orquestra lê o texto das duas apps", () => {
    const o = ler("src/lib/orquestra.test.ts");
    expect(o).toMatch(/const A_REGRA_D8_SE_APLICA = \(f: string\) =>\s*\(f\.startsWith\("src\/"\) \|\| f\.startsWith\("app-pro\/src\/"\) \|\| f\.startsWith\("app-cliente\/src\/"\)\)/);
  });
  it("a app de cliente escreve «Quantidade exata» e lê as duas grafias (os pedidos de antes têm «exacta»)", () => {
    expect(semComentarios(ler("app-cliente/src/lib/novo-pedido.ts"))).toContain("`Quantidade exata: ${");
    expect(quantidadeCurta("Quantidade exata: 5.")).toBe("5 itens");
    expect(quantidadeCurta("Quantidade exacta: 5.")).toBe("5 itens");
  });
  it("as frases pedidas pela ordem, já na forma nova", () => {
    expect(ler("app-pro/src/app/repor.tsx")).toContain('titulo="Enviar ligação"');
    expect(ler("app-cliente/src/app/pedido-do-link.tsx")).toContain("<Titulo>Esta ligação expirou</Titulo>");
    expect(ler("app-pro/src/app/conta/palavra-passe.tsx")).toContain('rotulo="Palavra-passe atual"');
    expect(ler("app-cliente/src/componentes/PalavraPasseDaConta.tsx")).toContain('rotulo="Palavra-passe atual"');
  });
});
