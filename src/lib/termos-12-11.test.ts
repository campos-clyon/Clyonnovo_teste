import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LIMITE_DA_TRANSFERENCIA } from "./transferencia-bancaria";
import { MAXIMO_DE_ESCOLHIDOS, ORDENACAO } from "./lista-de-parceiros-da-mudanca";
import { HORAS_PARA_RESPONDER, JANELA_DE_RESPOSTA } from "./prazo-de-resposta-do-parceiro";
import { TAXA_DAS_MUDANCAS_EM_PONTOS } from "./taxas-plataforma";
import { GUIA_NOS_TERMOS } from "./guia-de-residuos";

/**
 * OS TERMOS E A PRIVACIDADE DE 12-11-2026 (d5 e d6, textos do Jurídico).
 *
 * Os números saem SEMPRE das constantes que o site lê: um número escrito à mão
 * num contrato fica para trás no dia em que o código muda. Este teste exige as
 * constantes nos Termos e chumba os números escritos à mão nas frases novas.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const TERMOS = semNotas(ler("src/app/termos/page.tsx"));
const PRIVACIDADE = semNotas(ler("src/app/privacidade/page.tsx"));

/** O texto de uma secção dos Termos, da abertura <S id=…> à seguinte. */
function seccao(id: string): string {
  const i = TERMOS.indexOf(`<S id="${id}"`);
  expect(i, id).toBeGreaterThan(-1);
  const fim = TERMOS.indexOf("<S id=", i + 5);
  return TERMOS.slice(i, fim === -1 ? undefined : fim);
}

describe("os números dos Termos vêm das constantes", () => {
  it("a transferência (§7): LIMITE_DA_TRANSFERENCIA, e não «700 €» à mão", () => {
    const s = seccao("pagamento");
    expect(s).toContain("{eurosRedondos(LIMITE_DA_TRANSFERENCIA)} ou mais, com IVA.");
    expect(s).toContain("Por transferência bancária");
    expect(s).not.toContain(`${LIMITE_DA_TRANSFERENCIA} €`);
    expect(TERMOS).toContain('import { LIMITE_DA_TRANSFERENCIA } from "@/lib/transferencia-bancaria";');
  });

  it("as mudanças pela lista (§5-A): escolhidos, prazo, janela e ordem", () => {
    const s = seccao("mudancas-com-lista");
    expect(s).toContain("{MAXIMO_DE_ESCOLHIDOS}");
    expect(s).toContain("{HORAS_PARA_RESPONDER}");
    expect(s).toContain("{JANELA_DE_RESPOSTA.abre}h");
    expect(s).toContain("{JANELA_DE_RESPOSTA.fecha}h");
    expect(s).toContain("{ORDENACAO.frase}");
    expect(s).toContain("A folha nunca se confirma sozinha");
    expect(s).toContain("que ficam fixos");
    for (const mao of [`até ${MAXIMO_DE_ESCOLHIDOS} parceiros`, `${HORAS_PARA_RESPONDER} horas`, `${JANELA_DE_RESPOSTA.fecha}h`]) {
      expect(s, mao).not.toContain(mao);
    }
    expect(TERMOS).toContain('["mudancas-com-lista", "5-A. Mudanças com a lista de parceiros"]');
  });

  it("a taxa das mudanças (§6 e §10): TAXA_DAS_MUDANCAS_EM_PONTOS, só horas e km, material sem taxa com IVA", () => {
    const s6 = seccao("precos");
    expect(s6).toContain("{TAXA_DAS_MUDANCAS_EM_PONTOS}");
    expect(s6).toContain("O material\n            não tem taxa, mas leva IVA.");
    expect(s6).not.toContain(TAXA_DAS_MUDANCAS_EM_PONTOS);
    const s10 = seccao("profissionais");
    expect(s10).toContain("{TAXA_DAS_MUDANCAS_EM_PONTOS}");
    expect(s10).not.toContain(TAXA_DAS_MUDANCAS_EM_PONTOS);
  });

  it("§8: a folha confirma a mudança pela lista; o prazo dos 7 dias fica para o resto", () => {
    const s = seccao("execucao");
    expect(s).toContain("o trabalho só se confirma\n            quando o cliente confirma a folha (ponto 5-A).");
    expect(s).toContain("{DIAS_ATE_LIBERTAR_SOZINHO}");
  });

  it("§7-A: a devolução de uma transferência", () => {
    expect(seccao("cancelamento")).toContain("Se pagou por transferência, devolvemos por transferência");
  });

  it("§10: a guia (texto D), o «verificado», a dívida em partes e a ordem da lista (P2B)", () => {
    const s = seccao("profissionais");
    expect(s).toContain("{GUIA_NOS_TERMOS}");
    expect(GUIA_NOS_TERMOS).toContain("e-GAR");
    expect(GUIA_NOS_TERMOS).toContain("Portaria n.º 145/2017");
    expect(s).not.toContain("guia de acompanhamento");
    expect(s).toContain("{SELO_DO_CARTAO}");
    expect(s).toContain("Quem\n            confirma não é quem aprova.");
    expect(s).toContain("Pode pagá-los em separado.");
    expect(s).toContain("conta primeiro para o IVA, que é do Estado, e depois\n            para a taxa, começando pelos trabalhos mais antigos.");
    expect(s).toContain("{ORDENACAO.frase}");
    expect(s).toContain("{TEXTOS_DOS_PRECOS_DAS_MUDANCAS.interruptor}");
    expect(ORDENACAO.frase).toContain("Nenhum parceiro paga para aparecer mais acima.");
  });

  it("§2: a excepção diz o que o botão faz, e o nome vem da constante", () => {
    const s = seccao("o-que-e");
    expect(s).toContain("salvo quando o cliente nos\n            pede que o façamos");
    expect(s).toContain("«{DEIXAR_A_CLYON_ESCOLHER}»");
    expect(s).toContain("«{SAIDAS_DO_CLIENTE.pedirAClyon}»");
    expect(s).toContain("é o cliente quem aceita a proposta");
  });

  it("a data", () => {
    expect(TERMOS).toContain("Última atualização: 12 de novembro de 2026.");
  });
});

describe("a Privacidade fala da transferência, da folha e da lista", () => {
  it("as três, com o limite da constante", () => {
    expect(PRIVACIDADE).toContain("<strong>Pagamento por transferência:</strong>");
    expect(PRIVACIDADE).toContain("<strong>Folha da mudança:</strong>");
    expect(PRIVACIDADE).toContain("<strong>Lista das mudanças:</strong>");
    expect(PRIVACIDADE).toContain("{TEXTOS_DOS_PRECOS_DAS_MUDANCAS.interruptor}");
    expect(PRIVACIDADE).toContain("que pedimos no\n                    momento e não guardamos");
    expect(PRIVACIDADE).toContain("{LIMITE_EM_EUROS}");
    expect(PRIVACIDADE).not.toContain(`${LIMITE_DA_TRANSFERENCIA} €`);
  });

  it("a prova da guia, que só a administração vê", () => {
    expect(PRIVACIDADE).toContain("<strong>Guia de resíduos:</strong>");
    expect(PRIVACIDADE).toContain("que só a administração da CLYON vê");
  });

  it("a data", () => {
    expect(PRIVACIDADE).toContain("Última atualização: 12 de novembro de 2026.");
  });
});
