import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  avisoDosDadosParaReceber,
  destinoDosDadosEmFalta,
  impedimentoDoErro,
  linhaDoPerfilFiscal,
  negociacoesDoValorEmAtraso,
  partesDoValorEmAtraso,
  passouDoPrazo,
  PAGAR_O_VALOR_EM_ATRASO as DA_APP,
  type NovoModeloDaCarteira,
} from "../../app-pro/src/lib/novo-modelo";
import { linhaDaFaturaDoParceiro, SO_PARA_ESTES_DADOS } from "../../app-cliente/src/lib/pagar-ao-parceiro";
import { estadoDosDadosParaReceber } from "./dados-para-receber";
import { perfilFiscalDoParceiro } from "./perfil-fiscal";
import { PAGAR_O_VALOR_EM_ATRASO } from "./valor-em-atraso";
import { PAGA_DIRETAMENTE_AO_PARCEIRO } from "./pagar-ao-parceiro";
import { negociacaoParaAVista } from "./negociacao-na-vista";
import { negociacaoParaAApp } from "./pedido-para-a-app";

/**
 * A PARTE DA ENGENHARIA — APPS DA d10 (o modelo de 15-11-2026): o cliente paga
 * ao parceiro, o profissional passa à CLYON a taxa da plataforma e o IVA dela.
 *
 * A regra que não se parte: AS APPS NÃO TÊM A DATA. Quem diz se o modelo vale é
 * o servidor (`novoModelo` na carteira, no perfil e em cada negociação;
 * `pagaAoParceiro` no pagamento; `/api/pagamentos/ao-parceiro`), que antes de
 * 15-11 manda `null`/falso — e cada bloco novo das apps só aparece com ele.
 * Os ecrãs (React Native) lêem-se, como nos outros testes das apps.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

function ficheirosEm(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(join(process.cwd(), pasta))) {
    const rel = `${pasta}/${nome}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) saida.push(...ficheirosEm(rel));
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(rel);
  }
  return saida;
}

const ANTES = new Date("2026-11-14T23:59:00Z");
const NO_DIA = new Date("2026-11-15T10:00:00Z");
const DEPOIS_DO_AVISO = new Date("2026-11-23T10:00:00Z");

describe("as apps não têm uma cópia da data", () => {
  it("nenhum ficheiro das duas apps importa novo-modelo.ts do site nem escreve 15-11 à mão", () => {
    for (const f of [...ficheirosEm("app-pro/src"), ...ficheirosEm("app-cliente/src")]) {
      const s = semComentarios(ler(f));
      expect(s, f).not.toMatch(/src\/lib\/novo-modelo["']/);
      expect(s, f).not.toMatch(/2026-11-15|NOVO_MODELO_DESDE|novoModeloEmVigor/);
    }
  });

  it("cada bloco novo só desenha com a resposta do servidor", () => {
    expect(ler("app-pro/src/componentes/AvisosDoNovoModelo.tsx")).toContain("if (!nm) return null;");
    expect(ler("app-pro/src/componentes/FaturaDoTrabalho.tsx")).toContain("if (!faturas?.novoModelo) return null;");
    expect(ler("app-pro/src/app/(app)/carteira.tsx")).toContain("dados.novoModelo && dados.novoModelo.valores.length > 0 ?");
    expect(ler("app-pro/src/app/conta/banco.tsx")).toContain("{perfil.novoModelo ? <AvisoDoNovoModelo");
    expect(ler("app-pro/src/app/conta/faturacao.tsx")).toContain("{perfil.novoModelo ? <PerfilFiscal");
    expect(ler("app-cliente/src/componentes/PagarAoParceiro.tsx")).toContain("if (!visto?.pagaAoParceiro) return null;");
    expect(ler("app-cliente/src/componentes/Pagar.tsx")).toContain("if (pg.pagaAoParceiro) return null;");
  });
});

describe("app Pro — os dados para receber, pela mesma regra do site", () => {
  const semDados = { iban: "", ibanTitular: "", mbway: "", regimeIva: "normal", regimeIvaConfirmadoEm: null, estado: "aprovado", aprovadoEm: "2026-10-01T10:00:00Z" };

  it("antes de 15-11 não há aviso; no dia, o aviso até 22-11; depois, o impedimento", () => {
    expect(avisoDosDadosParaReceber(estadoDosDadosParaReceber(semDados, ANTES))).toBeNull();
    const aviso = avisoDosDadosParaReceber(estadoDosDadosParaReceber(semDados, NO_DIA));
    expect(aviso?.impede).toBe(false);
    expect(aviso?.destino).toBe("/conta/banco");
    expect(aviso?.frase).toContain("22 de novembro de 2026");
    expect(avisoDosDadosParaReceber(estadoDosDadosParaReceber(semDados, DEPOIS_DO_AVISO))?.impede).toBe(true);
    expect(avisoDosDadosParaReceber({ estado: "completos" })).toBeNull();
    expect(avisoDosDadosParaReceber(null)).toBeNull();
  });

  it("só o regime em falta leva à Faturação; o resto ao IBAN e MB WAY", () => {
    expect(destinoDosDadosEmFalta(["regime"])).toBe("/conta/faturacao");
    expect(destinoDosDadosEmFalta(["iban", "regime"])).toBe("/conta/banco");
    expect(destinoDosDadosEmFalta([])).toBe("/conta/banco");
  });

  it("o perfil fiscal que ele vê é o que o cliente vê", () => {
    const pf = perfilFiscalDoParceiro({ regimeIva: "isento", regimeIvaConfirmadoEm: "2026-11-12", emiteGuiaTransporte: 1, guiaVerificadaEm: "2026-11-01" });
    expect(linhaDoPerfilFiscal(pf)).toBe("Fatura com isenção de IVA (art. 53.º) · Emite guia de resíduos");
    expect(linhaDaFaturaDoParceiro({ perfilFiscal: pf, total: null, pagarAoParceiroPor: null })).toBe(linhaDoPerfilFiscal(pf));
    expect(linhaDoPerfilFiscal(perfilFiscalDoParceiro({ regimeIva: "normal" }))).toBe("Tipo de fatura a confirmar");
  });
});

describe("app Pro — o stand-by ao aceitar ou propor", () => {
  it("o 403 do servidor dá o botão certo; outro erro não dá nada", () => {
    expect(impedimentoDoErro({ standBy: true, accao: PAGAR_O_VALOR_EM_ATRASO })).toEqual({ botao: "Pagar o valor em atraso", destino: "/carteira" });
    expect(impedimentoDoErro({ standBy: true })?.botao).toBe(PAGAR_O_VALOR_EM_ATRASO);
    expect(impedimentoDoErro({ faltamDadosParaReceber: true, falta: ["mbway"] })?.destino).toBe("/conta/banco");
    expect(impedimentoDoErro({ faltamDadosParaReceber: true, falta: ["regime"] })?.destino).toBe("/conta/faturacao");
    expect(impedimentoDoErro({ error: "Outra coisa" })).toBeNull();
    expect(DA_APP).toBe(PAGAR_O_VALOR_EM_ATRASO);
  });

  it("os nomes do 403 são os do servidor, e o ecrã do pedido usa-os", () => {
    const servidor = ler("src/lib/novo-modelo-no-servidor.ts");
    for (const campo of ["standBy: true", "accao: PAGAR_O_VALOR_EM_ATRASO", "faltamDadosParaReceber: true", "falta: dados.falta"]) {
      expect(servidor).toContain(campo);
    }
    const ecra = ler("app-pro/src/app/trabalho/[id].tsx");
    expect(ecra).toContain("setImpedimento(impedimentoDoErro(err.corpo));");
    expect((ecra.match(/<SaidaDoImpedimento impedimento=\{impedimento\} \/>/g) ?? []).length).toBe(2);
    expect(ecra).toContain("<AvisosDoNovoModelo />");
  });
});

describe("app Pro — o valor em atraso na carteira", () => {
  const nm: NovoModeloDaCarteira = {
    emVigor: true,
    valorEmAtraso: 36.9,
    valores: [
      { negociacaoId: 11, pedidoId: 501, total: 30.75, iva: 5.75, taxa: 25, nasceuEm: "2026-11-15T10:00:00Z", prazoAte: "2026-11-19T10:00:00Z", multibanco: null },
      { negociacaoId: 12, pedidoId: 502, total: 6.15, iva: 1.15, taxa: 5, nasceuEm: null, prazoAte: null, multibanco: null },
    ],
    standBy: null,
    dadosParaReceber: { estado: "completos" },
  };
  const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

  it("sai da lista antiga das dívidas e diz as duas partes", () => {
    expect([...negociacoesDoValorEmAtraso(nm)]).toEqual([11, 12]);
    expect(negociacoesDoValorEmAtraso(null).size).toBe(0);
    expect(partesDoValorEmAtraso(nm.valores[0], euros)).toBe("Taxa da plataforma 25,00 € + IVA 5,75 €");
  });

  it("o prazo é o do site: 4 dias, e sem prazo não passa", () => {
    expect(passouDoPrazo("2026-11-19T10:00:00Z", Date.parse("2026-11-19T09:59:00Z"))).toBe(false);
    expect(passouDoPrazo("2026-11-19T10:00:00Z", Date.parse("2026-11-19T10:01:00Z"))).toBe(true);
    expect(passouDoPrazo(null, Date.now())).toBe(false);
  });

  it("a carteira paga pela mesma rota do painel e lê os campos que a rota manda", () => {
    const ecra = ler("app-pro/src/app/(app)/carteira.tsx");
    expect(ecra).toContain('pedir("/api/profissionais/divida", { metodo: "POST", corpo: { negociacaoId: v.negociacaoId, metodo } })');
    expect(ecra).toContain("!doValorEmAtraso.has(d.negociacaoId)");
    const rota = ler("src/app/api/profissionais/carteira/route.ts");
    for (const campo of ["valorEmAtraso:", "valores,", "prazoAte:", "multibanco:", "standBy:", "dadosParaReceber:"]) expect(rota).toContain(campo);
  });

  it("nunca «valor em dívida» no que o profissional lê", () => {
    for (const f of ["app-pro/src/lib/novo-modelo.ts", "app-pro/src/componentes/AvisosDoNovoModelo.tsx", "app-pro/src/componentes/FaturaDoTrabalho.tsx"]) {
      expect(ler(f).toLowerCase(), f).not.toContain("em dívida");
    }
  });
});

describe("app Pro — a fatura dele no pedido", () => {
  it("sobe para a rota do site, com o id na query (é de lá que a rota o lê)", () => {
    expect(ler("app-pro/src/lib/novo-modelo.ts")).toContain("`/api/profissionais/trabalho/fatura?negociacaoId=${negociacaoId}`");
    expect(ler("src/app/api/profissionais/trabalho/fatura/route.ts")).toContain('req.nextUrl.searchParams.get("negociacaoId")');
    const f = ler("app-pro/src/componentes/FaturaDoTrabalho.tsx");
    expect(f).toContain("enviarFicheiro(ROTA_DA_FATURA(negociacaoId)");
    expect((ler("app-pro/src/componentes/TrabalhoContratado.tsx").match(/<FaturaDoTrabalho negociacaoId=\{t\.negociacaoId\} \/>/g) ?? []).length).toBe(2);
  });
});

describe("app de cliente — escolher, pagar ao parceiro e as duas faturas", () => {
  const linha = (x: Record<string, unknown> = {}) => ({
    id: 7,
    estado: "aberta",
    propostasJson: JSON.stringify([{ por: "profissional", valor: 100, criadaEm: "2026-11-14T09:00:00Z", estado: "pendente" }]),
    profissionalNome: "Parceiro",
    regimeIva: "normal",
    regimeIvaConfirmadoEm: "2026-11-12T10:00:00Z",
    createdAt: "2026-11-14T08:00:00Z",
    ...x,
  });

  it("antes de 15-11 a R5 é igual a hoje: sem novoModelo e a frase de sempre", () => {
    const n = negociacaoParaAApp(negociacaoParaAVista(linha(), { porCarga: false, agora: ANTES }), "total", ANTES);
    expect(n.novoModelo).toBeNull();
    expect(n.formaTexto).not.toBe(PAGA_DIRETAMENTE_AO_PARCEIRO);
  });

  it("a partir de 15-11: o tipo de fatura do parceiro para escolher, e «paga diretamente ao parceiro»", () => {
    const n = negociacaoParaAApp(negociacaoParaAVista(linha(), { porCarga: false, agora: NO_DIA }), "total", NO_DIA);
    expect(n.novoModelo?.perfilFiscal.fatura).toBe("Fatura com IVA");
    expect(n.formaTexto).toBe(PAGA_DIRETAMENTE_AO_PARCEIRO);
    expect(linhaDaFaturaDoParceiro(n.novoModelo)).toBe("Fatura com IVA");
    // Um Trabalho CLYON fica no modelo antigo.
    expect(negociacaoParaAApp(negociacaoParaAVista(linha({ ofertaClyon: "directa" }), { porCarga: false, agora: NO_DIA }), "total", NO_DIA).novoModelo).toBeNull();
  });

  it("o pagamento da R5 leva o pagaAoParceiro, e a escolha mostra a fatura", () => {
    expect(ler("src/lib/pedidos-do-cliente.ts")).toContain("pagaAoParceiro: e.pagaAoParceiro,");
    expect(ler("app-cliente/src/componentes/Proposta.tsx")).toContain("linhaDaFaturaDoParceiro(n.novoModelo)");
    expect(ler("app-cliente/src/componentes/VistaDoPedido.tsx")).toContain("<PagarAoParceiro pedidoId={pedidoId} negociacaoId={contratada.id}");
  });

  it("as frases são as do bloco do site, e o preço não se escreve na app (vem da R5)", () => {
    expect(ler("src/components/PagarAoParceiro.tsx")).toContain(SO_PARA_ESTES_DADOS);
    const bloco = semComentarios(ler("app-cliente/src/componentes/PagarAoParceiro.tsx"));
    expect(bloco).not.toContain("visto.conta");
    expect(bloco).toContain("{visto.frase}");
  });

  it("o cliente lê «parceiro», nunca «profissional», nos blocos novos", () => {
    for (const f of ["app-cliente/src/componentes/PagarAoParceiro.tsx", "app-cliente/src/lib/pagar-ao-parceiro.ts"]) {
      const textos = (semComentarios(ler(f)).match(/"[^"\n]*"|`[^`\n]*`/g) ?? []).join(" ").toLowerCase();
      expect(textos, f).not.toContain("profissional");
    }
  });
});
