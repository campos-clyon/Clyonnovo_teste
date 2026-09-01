import { describe, it, expect } from "vitest";
import { mensagemDeConvite, primeiroNome } from "./mensagem-de-convite";
import { TAXA_PROFISSIONAL } from "./taxas-plataforma";
import { MINIMO_PARA_LEVANTAR } from "./carteira";

/**
 * A mensagem que se manda a um profissional para ele se candidatar.
 *
 * "Crie também uma mensagem já com o link para enviar e convidar novos
 * parceiros."
 *
 * O que estes testes guardam não é o estilo: é que a mensagem não faça
 * promessas que o produto não cumpre, e que os números não envelheçam.
 */

const LINK = "https://clyon.pt/profissionais/inscricao";

describe("o tratamento", () => {
  it("trata pelo primeiro nome", () => {
    // "Olá, Transportes Silva Lda" não é uma pessoa a falar com outra.
    expect(primeiroNome("Transportes Silva Lda")).toBe("Transportes");
    expect(mensagemDeConvite({ nome: "João Pedro Silva", link: LINK })).toContain("Olá, João!");
  });

  it("sem nome, cumprimenta na mesma", () => {
    // Melhor do que um espaço em branco onde devia estar uma pessoa.
    for (const n of [null, undefined, "", "   "]) {
      expect(mensagemDeConvite({ nome: n, link: LINK })).toContain("Olá!");
    }
  });

  it("uma inicial solta não é um nome", () => {
    // "Olá, J!" lê-se pior do que "Olá!".
    expect(primeiroNome("J. Silva")).toBeNull();
  });
});

describe("os números vêm das constantes, não da cabeça de quem escreve", () => {
  /*
   * É a razão de isto ser uma função e não um texto colado no painel. Uma
   * comissão ditada de cabeça com um número a mais é uma promessa que alguém
   * vai cobrar — e a mensagem foi enviada, não se corrige depois.
   */
  it("a comissão é a do motor", () => {
    const m = mensagemDeConvite({ link: LINK });
    expect(m).toContain(`${Math.round(TAXA_PROFISSIONAL * 100)} %`);
  });

  it("o mínimo do levantamento também", () => {
    const m = mensagemDeConvite({ link: LINK });
    expect(m).toContain(`${MINIMO_PARA_LEVANTAR} €`);
  });
});

describe("o que a mensagem TEM de dizer", () => {
  const m = mensagemDeConvite({ link: LINK, nome: "Ana" });

  it("leva o link, inteiro", () => {
    expect(m).toContain(LINK);
  });

  it("diz que candidatar-se é gratuito e que não se paga por contacto", () => {
    // É a primeira pergunta de quem já foi queimado por portais de leads.
    expect(m).toContain("gratuito");
    expect(m).toMatch(/não paga por contacto/i);
  });

  it("avisa que há uma análise pelo meio, ANTES do link", () => {
    /*
     * Se ele souber disto só depois de preencher tudo, lê-se como um travão
     * que ninguém anunciou. E o que vem depois do link, numa mensagem de
     * WhatsApp, não se lê.
     */
    expect(m).toMatch(/analisamos/i);
    expect(m.search(/analisamos/i)).toBeLessThan(m.indexOf(LINK));
  });

  it("diz que o dinheiro fica garantido", () => {
    expect(m).toContain("cativo");
  });
});

describe("o que a mensagem NÃO pode fazer", () => {
  const m = mensagemDeConvite({ link: LINK });

  it("a CLYON não diz que faz o trabalho", () => {
    /*
     * Regra de voz do site: quem recolhe, transporta e esvazia é o
     * profissional. Uma mensagem de recrutamento que diga "nós fazemos
     * recolhas" está a dizer-lhe que vai trabalhar para um concorrente.
     */
    expect(m).not.toMatch(/n[óo]s (recolhemos|transportamos|esvaziamos|fazemos o trabalho)/i);
  });

  it("não promete volume de trabalho", () => {
    // Não controlamos quantos pedidos aparecem na zona dele. Prometer "muitos
    // pedidos" é a promessa que ele vai cobrar à primeira semana parada.
    expect(m).not.toMatch(/muitos pedidos|garantimos.*(pedidos|trabalho)|trabalho garantido/i);
  });

  it("não inventa prazo de resposta", () => {
    // Não há nenhum na plataforma. Escrever "respondemos em 24 horas" era
    // criar uma expectativa que só uma pessoa disponível pode cumprir.
    expect(m).not.toMatch(/\d+\s*(horas|dias)\s*(úteis)?\s*(para|a)\s*(responder|resposta)/i);
  });
});

describe("o prazo do link, quando existe", () => {
  it("um convite pessoal diz quantos dias dura", () => {
    // Um link que morre sem aviso é um profissional que tenta na semana
    // seguinte, encontra uma página morta e conclui que desistimos dele.
    const m = mensagemDeConvite({ link: LINK, diasDeValidade: 7 });
    expect(m).toContain("7 dias");
  });

  it("um dia escreve-se no singular", () => {
    expect(mensagemDeConvite({ link: LINK, diasDeValidade: 1 })).toContain("1 dia.");
  });

  it("o link ABERTO não fala de prazo nenhum, porque não tem", () => {
    // Inventar-lhe um prazo era dizer-lhe para se despachar sem razão.
    const m = mensagemDeConvite({ link: LINK });
    expect(m).not.toMatch(/dura|expirar/i);
  });
});

describe("a assinatura", () => {
  it("vai assinada por quem convida", () => {
    // Uma mensagem de WhatsApp sem nome, de um número desconhecido, a pedir o
    // NIF, lê-se como burla.
    expect(mensagemDeConvite({ link: LINK, deQuem: "Wanderson" })).toContain("— Wanderson, CLYON");
  });

  it("sem nome de quem convida, não deixa um travessão pendurado", () => {
    for (const q of [null, undefined, "", "  "]) {
      expect(mensagemDeConvite({ link: LINK, deQuem: q })).not.toMatch(/—\s*,/);
    }
  });
});

describe("o tratamento é por «você», do princípio ao fim", () => {
  /*
   * Regra de voz do site. A primeira versão desta mensagem escorregou uma vez
   * — "Preenche a candidatura" no meio de "Você responde", "Não paga" e "É
   * você que escolhe". Numa mensagem curta, a troca de tratamento a meio nota-se.
   */
  it("não trata ninguém por tu", () => {
    const m = mensagemDeConvite({ link: LINK, nome: "Ana", deQuem: "Wanderson" });
    expect(m).not.toMatch(/\b(preenche|recebes|podes|tens|escolhes|paga-?te|contigo|teu|tua)\b/i);
  });
});
