// relógio: datas explícitas — d3: as chamadas que tocam no modelo de 15-11 passam a data.
import { describe, expect, it } from "vitest";
import { congelarTarifa, type TarifaDasMudancas } from "./conta-da-mudanca";
import {
  contextoDaFolha,
  dinheiroDaFolha,
  folhaDeJson,
  folhaNoEcra,
  lerFolha,
  resumoDaFolha,
  type ContextoDaFolha,
  type CorpoDaFolha,
  type ModeloDaFolha,
} from "./folha-da-mudanca";
import { fazerAFolhaFinal } from "./folha-final";
import { totalAoCliente } from "./total-ao-cliente";
import { taxasDaNegociacao } from "./taxas-plataforma";
import type { RegimeDoProfissional } from "./pagamento-directo";
import { botaoConfirmo, textoDaPropostaMaisBaixa, textoDepoisDeConfirmar } from "./escolhidos-sem-resposta";
import { mudancaEscolhida } from "./mudanca-escolhida-pelo-cliente";
import { cartaoDoParceiro, type CandidatoDaMudanca, type ContextoDaMudanca } from "./lista-de-parceiros-da-mudanca";

/**
 * d3 (CEO e dono, 18-11-2026) — A FOLHA DA MUDANÇA NO MODELO DE 15-11.
 *
 * O contrato: a folha (o que o cliente confirma, o painel, a Mesa e a app Pro),
 * a folha final pela equipa e o valor final dizem o MESMO total, com o regime
 * de IVA do parceiro congelado na negociação. O caso da ordem: parceiro
 * isento, 4 h a 55 €/h, taxa de 10 % → 225,06 € (a folha dizia 270,60 €).
 */

const TARIFA: TarifaDasMudancas = {
  precoHora2: 55,
  precoHora3: 70,
  minimoHoras: 3,
  precoKm: 0.5,
  kmMinimo: 0,
  kmMaximo: 100,
  caixa: 2,
  cartaoMetro: null,
  filmeRolo: null,
  plasticoBolhaRolo: null,
  aparecerNaLista: true,
};
const REGRAS = Object.freeze({ taxa: 0.1, modo: "de_dentro" as const, materialComIva: true, iva: 0.23 });
const CONGELADA = congelarTarifa(TARIFA, REGRAS, new Date("2026-11-16T10:00:00Z"));
const AGORA = new Date("2026-11-18T14:00:00Z");

const modelo = (regime: RegimeDoProfissional): ModeloDaFolha => ({ novoModelo: true, regime });

function ctx(m: ModeloDaFolha | null): ContextoDaFolha {
  return { tarifa: CONGELADA, pessoasEscolhidas: 2, kmDoPercurso: 0, valorPorHoraAcordado: 55, diaPorOmissao: "2026-11-18", modelo: m };
}

function folha(corpo: CorpoDaFolha, m: ModeloDaFolha | null) {
  const r = lerFolha(corpo, ctx(m), AGORA);
  if (!r.ok) throw new Error(r.erro);
  return r.folha;
}

const QUATRO_HORAS: CorpoDaFolha = { inicio: "09:00", fim: "13:00", pessoas: 2, km: "0" };
const COM_CAIXAS: CorpoDaFolha = { ...QUATRO_HORAS, materiais: { caixas: 10 } };

/** O valor final depois de o cliente confirmar: o acordado e a taxa efectiva que a confirmação grava. */
function valorFinal(f: ReturnType<typeof folha>, regime: RegimeDoProfissional): number {
  const d = dinheiroDaFolha(f);
  return totalAoCliente(d.valorSemIva, taxasDaNegociacao({ taxaCliente: 0, taxaProfissional: d.taxaProfissional }), regime)!.total;
}

/** A folha final pela equipa, com o mesmo trabalho. */
function folhaFinal(regime: RegimeDoProfissional, materiais: Array<{ descricao: string; valor: string }> = []) {
  const r = fazerAFolhaFinal({
    corpo: { pessoas: 2, horas: "4", precoHora: "55", deslocacaoTipo: "km", km: "0", materiais },
    tarifa: CONGELADA,
    taxa: { daFolhaAnterior: null, trabalhoClyon: false, taxaClyon: null, tarifa: CONGELADA, taxaCliente: 0, taxaProfissional: 0.1 },
    modelo: { novoModelo: true, regime },
  });
  if (!r.ok) throw new Error(r.erro);
  return r.folha;
}

/** O formatarEuros usa o espaço que não parte (NBSP). */
const n = (t: string | null | undefined) => (t ?? "").replace(/ /g, " ");

const totalDoEcra = (texto: string) => Number(texto.split(" €")[0].replace(",", "."));

describe("d3 — folha = folha final = valor final, nos dois regimes", () => {
  it("o caso da ordem: isento, 4 h a 55 €/h, 10 % → 225,06 €", () => {
    const f = folha(QUATRO_HORAS, modelo("isento"));
    const ecra = folhaNoEcra(f, "cliente", 3);
    expect(ecra.totalTexto).toBe("225,06 € com IVA (220,00 € sem IVA)");
    expect(folhaFinal("isento").previa.total).toBe(225.06);
    expect(valorFinal(f, "isento")).toBe(225.06);
  });

  it("no regime normal, 270,60 €", () => {
    const f = folha(QUATRO_HORAS, modelo("normal"));
    expect(totalDoEcra(folhaNoEcra(f, "cliente", 3).totalTexto)).toBe(270.6);
    expect(folhaFinal("normal").previa.total).toBe(270.6);
    expect(valorFinal(f, "normal")).toBe(270.6);
  });

  for (const regime of ["normal", "isento"] as const) {
    it(`com material (${regime}): os três dizem o mesmo`, () => {
      const f = folha(COM_CAIXAS, modelo(regime));
      const daFolha = totalDoEcra(folhaNoEcra(f, "parceiro", 3).totalTexto);
      expect(daFolha).toBe(folhaFinal(regime, [{ descricao: "Caixas", valor: "20" }]).previa.total);
      expect(daFolha).toBe(valorFinal(f, regime));
    });
  }

  it("ao parceiro: «Fica consigo X; passa à CLYON Y (a taxa e o IVA dela)»", () => {
    const isento = folhaNoEcra(folha(QUATRO_HORAS, modelo("isento")), "parceiro", 3);
    expect(isento.recebeTexto).toBe("Fica consigo 198,00 €; passa à CLYON 27,06 € (a taxa e o IVA dela).");
    expect(isento.linhas.map((l) => l.rotulo)).toEqual(
      expect.arrayContaining(["IVA da taxa da plataforma (23 %)", "Total com IVA", "Taxa da plataforma", "Fica consigo", "Passa à CLYON"]),
    );
    const normal = folhaNoEcra(folha(QUATRO_HORAS, modelo("normal")), "parceiro", 3);
    expect(normal.recebeTexto).toBe("Fica consigo 243,54 €; passa à CLYON 27,06 € (a taxa e o IVA dela).");
    // Ao cliente nunca o que fica a cada um.
    const cliente = folhaNoEcra(folha(QUATRO_HORAS, modelo("isento")), "cliente", 3);
    expect(cliente.recebeTexto).toBeNull();
    expect(cliente.linhas.some((l) => l.rotulo === "Fica consigo" || l.rotulo === "Passa à CLYON")).toBe(false);
  });

  it("a folha gravada leva o modelo: quem só tem a folha (a app de cliente, o comprovativo) faz a mesma conta", () => {
    const f = folha(QUATRO_HORAS, modelo("isento"));
    const relida = folhaDeJson(JSON.stringify(f))!;
    expect(folhaNoEcra(relida, "cliente", 3).totalTexto).toBe("225,06 € com IVA (220,00 € sem IVA)");
    expect(resumoDaFolha(relida)).toContain("225,06 € com IVA (220,00 € sem IVA)");
  });

  it("o contexto da rota leva o modelo e o regime: o painel, a Mesa e a app Pro refazem a mesma conta", () => {
    const cru = {
      tarifaCongeladaJson: JSON.stringify(CONGELADA),
      pessoasEscolhidas: 2,
      kmDoPercurso: 0,
      valorPorHoraAcordado: 55,
      diaPorOmissao: "2026-11-18",
      novoModelo: true,
      regime: "isento",
    };
    const c = contextoDaFolha(cru)!;
    expect(c.modelo).toEqual({ novoModelo: true, regime: "isento" });
    const r = lerFolha(QUATRO_HORAS, c, AGORA);
    if (!r.ok) throw new Error(r.erro);
    expect(folhaNoEcra(r.folha, "parceiro", 3).totalTexto).toBe("225,06 € com IVA (220,00 € sem IVA)");
    // Sem os campos novos (a app de antes), a conta antiga.
    expect(contextoDaFolha({ ...cru, novoModelo: undefined, regime: undefined })!.modelo).toBeNull();
  });

  it("no modelo antigo nada muda: 270,60 € e o «Recebe» de sempre", () => {
    const f = folha(QUATRO_HORAS, null);
    const ecra = folhaNoEcra(f, "parceiro", 3);
    expect(ecra.totalTexto).toBe("270,60 € com IVA (220,00 € sem IVA)");
    expect(ecra.recebeTexto).toBe("Recebe 198,00 €, depois da taxa da plataforma.");
    expect(f.modelo).toBeUndefined();
  });

  it("o que se grava ao confirmar não muda (nenhum preço nem taxa muda)", () => {
    const a = dinheiroDaFolha(folha(COM_CAIXAS, modelo("isento")));
    const b = dinheiroDaFolha(folha(COM_CAIXAS, null));
    expect(a).toEqual(b);
  });
});

describe("d3 — o «Confirmo» e a lista de parceiros com o regime", () => {
  it("«Confirmo: faço por X/h + IVA», e com um parceiro isento «X/h (isento de IVA)»", () => {
    expect(n(botaoConfirmo(5500))).toBe("Confirmo: faço por 55,00 €/h + IVA");
    expect(n(botaoConfirmo(5500, "isento"))).toBe("Confirmo: faço por 55,00 €/h (isento de IVA)");
    expect(n(textoDepoisDeConfirmar(5500, 0.23, false, "isento"))).toContain("55,00 €/h (isento de IVA)");
    expect(n(textoDaPropostaMaisBaixa(5000, 0.23, "isento"))).toContain("50,00 €/h (isento de IVA)");
    expect(n(textoDepoisDeConfirmar(5500, 0.23, false))).toContain("55,00 €/h + IVA (67,65 €/h com IVA)");
  });

  it("o bloco «O cliente escolheu-o» diz a hora e a estimativa pelo regime", () => {
    const base = {
      tarifaCongeladaJson: JSON.stringify(CONGELADA),
      pessoasEscolhidas: 2,
      prazoRespostaEm: null,
      horas: 4,
      km: 0,
      jaRespondeu: false,
      estado: "aberta",
      propostasJson: "[]",
    };
    const isento = mudancaEscolhida({ ...base, modelo: modelo("isento") }, AGORA)!;
    expect(n(isento.horaTexto)).toBe("A sua hora: 55,00 €/h (isento de IVA)");
    expect(n(isento.primeiraResposta?.confirmar)).toBe("Confirmo: faço por 55,00 €/h (isento de IVA)");
    expect(n(isento.estimativa?.texto)).toContain("220,00 € sem IVA (225,06 € com IVA)");
    const antigo = mudancaEscolhida(base, AGORA)!;
    expect(n(antigo.primeiraResposta?.confirmar)).toBe("Confirmo: faço por 55,00 €/h + IVA");
    expect(n(antigo.estimativa?.texto)).toContain("220,00 € sem IVA (270,60 € com IVA)");
  });

  it("o cartão da lista: com um parceiro isento, o com IVA é só o da taxa", () => {
    const candidato = (regimeIva: string): CandidatoDaMudanca & { tarifa: TarifaDasMudancas } => ({
      id: 7,
      nome: "Mudanças Exemplo",
      isActive: true,
      estado: "aprovado",
      categorias: ["mudancas"],
      raioKm: 50,
      emiteFatura: true,
      emiteGuiaTransporte: false,
      guiaVerificadaEm: null,
      contaDeTeste: false,
      verificado: true,
      tarifa: TARIFA,
      notaMedia: null,
      avaliacoes: 0,
      regimeIva,
      regimeIvaConfirmadoEm: new Date("2026-11-12T10:00:00Z"),
    });
    const CTX: ContextoDaMudanca = { tipologia: "T1", desmontagem: false, pessoas: 2, kmPercurso: 10, formaDePagamento: "na_plataforma", cidade: "Lisboa" };
    const isento = cartaoDoParceiro(candidato("isento"), CTX, "a", AGORA)!;
    const normal = cartaoDoParceiro(candidato("normal"), CTX, "b", AGORA)!;
    expect(isento.precoHora[2].texto).toContain("parceiro isento de IVA");
    expect(isento.precoHora[2].semIvaCent).toBe(normal.precoHora[2].semIvaCent);
    expect(isento.precoHora[2].comIvaCent).toBeLessThan(normal.precoHora[2].comIvaCent);
    expect(isento.estimativa.comIvaCent).toBeLessThan(normal.estimativa.comIvaCent);
    expect(normal.precoHora[2].texto).not.toContain("isento");
  });
});
