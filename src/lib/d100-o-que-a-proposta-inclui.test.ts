import { describe, expect, it } from "vitest";

/**
 * d100 — SÓ SE AFIRMA O QUE UMA PROPOSTA INCLUI COM UMA FERRAMENTA NESSA VOLTA (23-11-2026).
 *
 * Conversas e parceiros inventados (o repositório é público). O caso que
 * motivou a d100 (#664, antes da d97): a Vitória disse a sério que «as duas
 * propostas incluem a descida pelas escadas, a recolha e o transporte»,
 * tirado das regras gerais do site — e dois minutos depois foi perguntar ao
 * parceiro. Aqui:
 *  (a) o aviso ao modelo diz a regra;
 *  (b) a revisão (propor_resposta) recusa um «inclui / já conta com» sem
 *      o_que_o_servico_inclui nesta volta — em português, inglês, francês e
 *      espanhol —, e deixa passar o IVA, a regra geral, a pergunta e o
 *      «confirmo se…»;
 *  (c) o que o_que_o_servico_inclui devolveu fica no estado da volta e
 *      perguntar_ao_parceiro não o pergunta; as escadas, o andar e o
 *      elevador de uma recolha já estão incluídos.
 */

import { condicaoJaIncluida, motivoParaAfirmarOQueInclui, oQueOServicoInclui } from "./vitoria-agente/o-que-o-servico-inclui";
import { correrFerramenta, estadoNovo } from "./vitoria-agente/ferramentas";
import { CONVERSAS_DE_TESTE, ferramentasDoCaso, type CasoDeTeste } from "./vitoria-agente/conversas-de-teste";
import { AVISO_AO_MODELO } from "./vitoria-agente/aviso-ao-modelo";

const doze = CONVERSAS_DE_TESTE[11];
const RECOLHAS_TEJO = "Recolhas Tejo";
/** O mesmo caso, num esvaziamento (o «inclui» traz o desmontar). */
const esvaziamento: CasoDeTeste = { ...doze, pedido: { ...doze.pedido, serviceType: "esvaziamento_casa" } };
const aSerio = { aoVivo: true, aceitarLigado: true };

/* ── (a) O aviso ao modelo ─────────────────────────────────────────────── */

describe("(a) o aviso ao modelo", () => {
  it("diz que sobre uma proposta concreta só se afirma o que as ferramentas devolveram nesta volta", () => {
    expect(AVISO_AO_MODELO).toContain(
      "Sobre uma proposta concreta só afirmas o que propostas_vivas ou o_que_o_servico_inclui devolveram nesta volta; o resto, confirmas com o parceiro (perguntar_ao_parceiro).",
    );
    expect(AVISO_AO_MODELO).toMatch(/como regra geral \(«normalmente a proposta já conta com…»\), nunca como facto daquela proposta/);
  });
});

/* ── (b) A revisão recusa o «inclui» sem a ferramenta ──────────────────── */

describe("(b) a revisão: «inclui» só com o_que_o_servico_inclui nesta volta", () => {
  const AFIRMA = [
    "As duas propostas incluem a descida pelas escadas, a recolha e o transporte.",
    "Inclui, sim: a descida e o transporte.",
    "O valor já conta com a descida.",
    "A proposta da Recolhas Tejo inclui tudo.",
    "O transporte está incluído na proposta.",
    "Both offers include the stairs and the transport.",
    "Les deux propositions incluent la descente et le transport.",
    "Las dos propuestas incluyen la bajada y el transporte.",
  ];

  it("recusa a afirmação sem a ferramenta, e deixa-a passar com ela", () => {
    for (const t of AFIRMA) {
      expect(motivoParaAfirmarOQueInclui(t, false), t).toMatch(/o_que_o_servico_inclui/);
      expect(motivoParaAfirmarOQueInclui(t, true), t).toBeNull();
    }
  });

  it("deixa passar o IVA e a taxa, a regra geral, a pergunta, o «confirmo se…» e o que não afirma", () => {
    for (const t of [
      "As duas têm o IVA incluído no total; a da Sado Serviços passa fatura com IVA.",
      "O valor é 86,96 € com IVA (70,70 € sem IVA), IVA incluído.",
      "O total já inclui a taxa da plataforma e o IVA.",
      "Normalmente a proposta já conta com a descida e o transporte; confirmo com o parceiro para este pedido.",
      "Em regra, a recolha inclui a descida e o transporte.",
      "Vou confirmar com o parceiro se a proposta inclui a descida pelas escadas.",
      "Quer que eu veja se inclui a montagem?",
      "A limpeza fica registada no seu pedido, para o parceiro a incluir na proposta.",
      "O parceiro escolhido trata de tudo no dia combinado.",
    ]) {
      expect(motivoParaAfirmarOQueInclui(t, false), t).toBeNull();
    }
  });

  it("propor_resposta recusa sem o_que_o_servico_inclui, e aceita depois de a chamar na mesma volta", async () => {
    const deps = ferramentasDoCaso(doze);
    const e = estadoNovo();
    const texto = "As duas propostas incluem a descida pelas escadas e o transporte.";
    const antes = await correrFerramenta("propor_resposta", { texto }, deps, e);
    expect(antes.erro).toBe(true);
    expect(antes.resultado).toMatchObject({ aceite: false });
    expect(String(antes.resultado.motivo)).toMatch(/perguntar_ao_parceiro/);
    expect(e.respostaAceite).toBeNull();
    expect(e.recusadas).toHaveLength(1);

    await correrFerramenta("o_que_o_servico_inclui", { pedido: 674 }, deps, e);
    expect(e.incluidoNestaVolta).toContain("o transporte");
    const depois = await correrFerramenta("propor_resposta", { texto }, deps, e);
    expect(depois.resultado).toMatchObject({ aceite: true });
    expect(e.respostaAceite).toBe(texto);
  });

  it("uma volta nova começa sem o que se leu na anterior", () => {
    expect(estadoNovo().incluidoNestaVolta).toBeNull();
  });

  it("a mensagem ao passar à equipa passa pela mesma regra (sai a frase de sempre)", async () => {
    const e = estadoNovo();
    const r = await correrFerramenta(
      "passar_a_equipa",
      { motivo: "o cliente quer falar com uma pessoa", mensagem: "Claro! A proposta inclui a descida e o transporte; uma pessoa da equipa continua a conversa." },
      ferramentasDoCaso(doze),
      e,
    );
    expect(r.resultado).toMatchObject({ passado: true, mensagemAceite: false });
    expect(e.mensagemDeEquipa).toBeNull();
  });
});

/* ── (c) O que já se disse incluído não se pergunta ao parceiro ────────── */

describe("(c) o que o_que_o_servico_inclui devolveu não se pergunta ao parceiro", () => {
  it("numa recolha, as escadas, o andar e o elevador já estão incluídos; só a descida, ainda não", () => {
    for (const t of ["a descida pelas escadas", "sem elevador, está incluído?", "o andar conta?"]) {
      expect(condicaoJaIncluida(t, "recolha_monos"), t).toMatch(/^Sim, já está incluído/);
    }
    expect(condicaoJaIncluida("só a descida pelas escadas", "recolha_monos")).toBeNull();
  });

  it("com o que já se afirmou: o tema que lá está fica incluído; o que lá não está, pergunta-se", () => {
    const ditoNumEsvaziamento = oQueOServicoInclui("esvaziamento_casa").inclui;
    expect(condicaoJaIncluida("se desmontam o roupeiro", "esvaziamento_casa")).toBeNull();
    expect(condicaoJaIncluida("se desmontam o roupeiro", "esvaziamento_casa", ditoNumEsvaziamento)).toMatch(/já o disseste nesta conversa/);
    // Numa mudança o «inclui» é a carga, o transporte e a descarga: o lixo não está lá.
    const ditoNumaMudanca = oQueOServicoInclui("mudanca").inclui;
    expect(condicaoJaIncluida("a descarga no prédio novo", null, ditoNumaMudanca)).toMatch(/descarga/);
    expect(condicaoJaIncluida("levam o sofá velho para o lixo", "mudanca", ditoNumaMudanca)).toBeNull();
    // O que depende do parceiro continua a depender, mesmo que o tema já se tenha dito.
    expect(condicaoJaIncluida("só desmontam até quinta", "esvaziamento_casa", ditoNumEsvaziamento)).toBeNull();
  });

  it("perguntar_ao_parceiro: sem o_que_o_servico_inclui pergunta; depois dela, na mesma volta, não", async () => {
    const pergunta = { pedido: 674, escolha: RECOLHAS_TEJO, condicao: "se desmontam o roupeiro" };

    const semLer = estadoNovo();
    const r1 = await correrFerramenta("perguntar_ao_parceiro", pergunta, ferramentasDoCaso(esvaziamento, aSerio), semLer);
    expect(r1.resultado).toMatchObject({ perguntaPreparada: true });
    expect(semLer.pendente).toMatchObject({ tipo: "parceiro" });

    const lido = estadoNovo();
    const deps = ferramentasDoCaso(esvaziamento, aSerio);
    await correrFerramenta("o_que_o_servico_inclui", { pedido: 674 }, deps, lido);
    const r2 = await correrFerramenta("perguntar_ao_parceiro", pergunta, deps, lido);
    expect(r2.resultado).toMatchObject({ perguntaPreparada: false, jaIncluido: true });
    expect(String(r2.resultado.resposta)).toMatch(/desmontando/);
    expect(lido.pendente).toBeNull();
  });
});
