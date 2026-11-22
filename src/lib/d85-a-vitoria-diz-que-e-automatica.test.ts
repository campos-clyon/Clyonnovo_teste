import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  apresentacao,
  desculpasPeloAtendimento,
  perguntaSeEUmaPessoa,
  QUEM_FALA,
  SE_PREFERIR_UMA_PESSOA,
  SOU_A_ASSISTENTE_AUTOMATICA,
} from "./voz-da-vitoria";
import { pedeUmaPessoa, recolhaNova, respostaAQuemPedeUmaPessoa, responderNaRecolha, PASSO_A_ALGUEM_DA_EQUIPA } from "./whatsapp-recolha";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { motivoParaBloquear } from "./licoes-da-vitoria";
import { motivoParaBloquearOAgente } from "./vitoria-agente/guarda";
import { AVISO_AO_MODELO } from "./vitoria-agente/aviso-ao-modelo";
import { rotuloDoAutor } from "./conversas-da-clyon";

/**
 * A VITÓRIA DIZ QUE É AUTOMÁTICA — 22-11-2026 (decisão d85, aprovada pelo
 * CEO e pelo dono). Um assistente para consumidores tem de dizer que é
 * automático (art. 50.º, n.º 1, do AI Act, e a política de utilização do
 * fornecedor do modelo). Era «assistente online, nem IA nem virtual»; é
 * «a assistente automática da CLYON», com a voz delicada de sempre, e oferece
 * logo uma pessoa da equipa. A quem pergunta, a verdade; fingir ser uma
 * pessoa nunca.
 */

const TARDE = new Date("2026-11-22T15:10:00Z");

describe("a apresentação diz que é automática, e oferece uma pessoa", () => {
  it("em português", () => {
    expect(QUEM_FALA).toBe("Aqui é a Vitória, a assistente automática da CLYON");
    expect(apresentacao("Boa tarde", "Ana")).toBe(
      "Boa tarde, Ana! Aqui é a Vitória, a assistente automática da CLYON 😊\n" +
        "Vou anotar o seu pedido e enviá-lo aos parceiros da sua zona, que lhe respondem com o preço deles. " +
        "Se preferir falar com uma pessoa da equipa, é só dizer.",
    );
    // Um emoji só, o do cumprimento.
    expect(apresentacao("Bom dia", null).match(/\p{Extended_Pictographic}/gu)).toHaveLength(1);
  });

  it("a primeira mensagem de uma conversa nova leva-a", () => {
    const r = responderNaRecolha(recolhaNova(), "Olá, boa tarde", TARDE, false);
    expect(r.resposta).toContain(QUEM_FALA);
    expect(r.resposta).toContain(SE_PREFERIR_UMA_PESSOA);
  });

  it("em inglês, francês e espanhol, pelas traduções fixas", () => {
    const ola = apresentacao("Boa tarde", null);
    expect(traducaoFixa(ola, "en")).toBe(
      "Good afternoon! This is Vitória, CLYON's automated assistant 😊\n" +
        "I'll note down your request and send it to the partners in your area, who will reply with their price. " +
        "If you'd rather speak to a person from the team, just let me know.",
    );
    expect(traducaoFixa(ola, "fr")).toContain("Ici Vitória, l'assistante automatique de CLYON 😊");
    expect(traducaoFixa(ola, "fr")).toContain("Si vous préférez parler à une personne de l'équipe, il suffit de me le dire.");
    expect(traducaoFixa(ola, "es")).toContain("Soy Vitória, la asistente automática de CLYON 😊");
    expect(traducaoFixa(ola, "es")).toContain("Si prefiere hablar con una persona del equipo, solo tiene que decírmelo.");
  });

  it("no que o cliente lê na conversa da app e do site", () => {
    expect(rotuloDoAutor("vitoria", "cliente")).toBe("Vitória, assistente automática");
  });
});

describe("a quem pergunta se fala com uma pessoa, a verdade", () => {
  const PERGUNTAS = [
    "É um robô?",
    "é uma pessoa?",
    "Estou a falar com uma pessoa?",
    "estou a falar com uma pessoa real?",
    "isto é automático?",
    "As respostas são automáticas?",
    "Are you a bot?",
    "Is this a real person?",
    "Vous êtes un robot ?",
    "¿Eres un bot?",
  ];

  it("reconhece a pergunta — e não confunde uma descrição com ela", () => {
    for (const p of PERGUNTAS) expect(perguntaSeEUmaPessoa(p), p).toBe(true);
    for (const p of ["Tenho um robô de cozinha para levar", "sofá para uma pessoa", "É uma pessoa que vai ou duas?", "O robô aspirador também vai"]) {
      expect(perguntaSeEUmaPessoa(p), p).toBe(false);
    }
  });

  it("diz que é a assistente automática, e passa a uma pessoa", () => {
    expect(SOU_A_ASSISTENTE_AUTOMATICA).toBe("Sou a Vitória, a assistente automática da CLYON — não sou uma pessoa.");
    const r = responderNaRecolha(recolhaNova(), "É um robô?", TARDE, true);
    expect(r.pedirPessoa).toBe(true);
    expect(r.resposta.startsWith(SOU_A_ASSISTENTE_AUTOMATICA)).toBe(true);
    expect(r.resposta).toContain("pessoa da CLYON");
    expect(respostaAQuemPedeUmaPessoa("Quero falar com alguém")).toBe(PASSO_A_ALGUEM_DA_EQUIPA);
  });

  it("a quem se queixa «estou a falar com um robô?», desculpa e a verdade", () => {
    const r = responderNaRecolha(recolhaNova(), "Estou a falar com um robô?", TARDE, true);
    expect(r.pedirPessoa).toBe(true);
    expect(r.resposta).toContain("Peço imensa desculpa");
    expect(r.resposta).toContain(SOU_A_ASSISTENTE_AUTOMATICA);
    expect(desculpasPeloAtendimento(null)).not.toContain("automática");
  });

  it("a resposta à oferta da apresentação passa a uma pessoa", () => {
    for (const t of ["Prefiro falar com uma pessoa", "prefiro uma pessoa", "Sim, uma pessoa da equipa, por favor"]) {
      expect(pedeUmaPessoa(t), t).toBe(true);
    }
    expect(pedeUmaPessoa("prefiro alguém que venha de manhã")).toBe(false);
  });

  it("em inglês, francês e espanhol, pelas traduções fixas", () => {
    const r = respostaAQuemPedeUmaPessoa("Are you a bot?");
    expect(traducaoFixa(r, "en")).toBe(
      "I'm Vitória, CLYON's automated assistant - I'm not a person. I'll pass the conversation to a person from CLYON, who will reply to you here as soon as possible.",
    );
    expect(traducaoFixa(r, "fr")).toContain("Je suis Vitória, l'assistante automatique de CLYON - je ne suis pas une personne.");
    expect(traducaoFixa(r, "es")).toContain("Soy Vitória, la asistente automática de CLYON - no soy una persona.");
  });
});

describe("a guarda deixa dizer a verdade, e bloqueia o contrário", () => {
  it("as lições e a resposta livre", () => {
    expect(motivoParaBloquear("Sou a assistente automática da CLYON.")).toBeNull();
    expect(motivoParaBloquear(SOU_A_ASSISTENTE_AUTOMATICA)).toBeNull();
    expect(motivoParaBloquear("Não, não sou uma pessoa: sou a assistente automática.")).toBeNull();
    expect(motivoParaBloquear("Sou uma pessoa, claro.")).toMatch(/passar por uma pessoa/);
    expect(motivoParaBloquear("Não sou um robô!")).toMatch(/Nega ser automática/);
    expect(motivoParaBloquear("Aqui é a Vitória, assistente online da CLYON.")).toMatch(/assistente automática/);
  });

  it("o agente", () => {
    expect(motivoParaBloquearOAgente(apresentacao("Boa tarde", null), [])).toBeNull();
    expect(motivoParaBloquearOAgente(respostaAQuemPedeUmaPessoa("É um robô?"), [])).toBeNull();
    expect(motivoParaBloquearOAgente("Sou uma pessoa da equipa.", [])).toMatch(/passar por uma pessoa/);
    expect(motivoParaBloquearOAgente("Não sou um bot, sou a Vitória.", [])).toMatch(/Nega ser automática/);
  });
});

describe("o aviso ao modelo", () => {
  it("sem a proibição de dizer que é automática; nunca fingir ser uma pessoa; oferecer uma pessoa", () => {
    expect(AVISO_AO_MODELO).not.toMatch(/Nunca digas que és uma intelig/);
    expect(AVISO_AO_MODELO).not.toContain("assistente online");
    expect(AVISO_AO_MODELO).toContain("a assistente automática da CLYON");
    expect(AVISO_AO_MODELO).toContain(SOU_A_ASSISTENTE_AUTOMATICA);
    expect(AVISO_AO_MODELO).toMatch(/Nunca finjas ser uma pessoa/);
    expect(AVISO_AO_MODELO).toContain(SE_PREFERIR_UMA_PESSOA);
  });

  it("e nenhum texto da Vitória ao cliente ainda diz «assistente online»", () => {
    for (const f of [
      "src/lib/voz-da-vitoria.ts",
      "src/lib/vitoria-agente/aviso-ao-modelo.ts",
      "src/lib/propor-licoes.ts",
      "src/lib/traduzir-para-o-cliente.ts",
      "src/lib/conversas-da-clyon.ts",
      "src/lib/textos-do-seguimento-da-app.ts",
      "src/lib/traducoes-fixas-da-vitoria.json",
    ]) {
      const codigo = readFileSync(join(process.cwd(), f), "utf8")
        .split(/\r?\n/)
        .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
        .join("\n");
      expect(codigo, f).not.toMatch(/assistente online|online assistant|assistante en ligne|asistente en línea/);
    }
  });
});
