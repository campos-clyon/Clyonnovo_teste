import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AS_PROPOSTAS_EXPIRAM, estaExpirada, estaPrestesAExpirar } from "./negociacao";
import { PASSOS_DO_PROFISSIONAL } from "./como-funciona-para-o-profissional";
import { PERGUNTAS_DO_PROFISSIONAL } from "./ajuda-plataforma";

/**
 * O TEMPO SAIU DAS PROPOSTAS — 20-09-2026.
 *
 * "Remova o tempo, já que os pedidos vão ser apagados em 60 dias."
 *
 * O prazo de 48 horas existia para impedir que uma proposta ficasse viva para
 * sempre, e já havia quem tratasse disso: a purga apaga o pedido aos 60 dias, e
 * com ele a negociação inteira. Duas regras para o mesmo problema, e a mais
 * curta estava a fazer mal — o #320 tinha 322 €, 350 € e 329 € em cima da mesa
 * e dois deles já não se podiam aceitar, porque o cliente demorou quatro dias a
 * decidir.
 *
 * ⚠️ O QUE ESTE FICHEIRO DEFENDE: que o interruptor e os textos não se separem.
 * A mecânica ficou toda de pé atrás de `AS_PROPOSTAS_EXPIRAM`, pelo que voltar
 * atrás é escrever `true` numa linha — mas as frases que prometiam «48 horas
 * para responder» foram reescritas à mão e NÃO voltam com ela. Uma plataforma
 * que promete um prazo e não o cumpre é pior do que uma que não promete nada, e
 * o contrário — cumprir um prazo que já não promete a ninguém — é o bug que
 * deixou o #320 assim.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("o interruptor está desligado, e é dele que tudo depende", () => {
  it("as propostas não expiram", () => {
    expect(AS_PROPOSTAS_EXPIRAM).toBe(false);
  });

  it("e por isso nem a mais velha expira, nem se avisa de prazo nenhum", () => {
    const haCemDias = new Date("2026-06-12T10:00:00Z");
    const agora = new Date("2026-09-20T10:00:00Z");
    const p = { por: "cliente" as const, valor: 80, criadaEm: haCemDias, estado: "pendente" as const };
    expect(estaExpirada(p, agora)).toBe(false);
    expect(estaPrestesAExpirar(p, agora)).toBe(false);
  });

  it("as duas funções decidem pelo interruptor antes de olharem para as datas", () => {
    /*
     * Sem isto, bastava alguém corrigir uma delas e esquecer a outra para a
     * mesa voltar a oferecer o que o servidor recusa — que foi o 409 do #320.
     */
    const motor = semComentarios(ler("src/lib/negociacao.ts"));
    for (const nome of ["estaExpirada", "estaPrestesAExpirar"]) {
      const i = motor.indexOf(`export function ${nome}(`);
      expect(i, nome).toBeGreaterThan(-1);
      const corpo = motor.slice(i, motor.indexOf("\n}", i));
      expect(corpo, nome).toContain("if (!AS_PROPOSTAS_EXPIRAM) return false;");
    }
  });
});

describe("e ninguém promete às pessoas um prazo que não existe", () => {
  /*
   * As promessas em texto são o que dói: são lidas antes de a pessoa decidir, e
   * são a razão por que o cliente do #320 achou que tinha tempo. Ficam aqui
   * todas juntas — os passos, as perguntas e os ecrãs — porque foi por estarem
   * espalhadas que umas se corrigiram e outras não.
   */
  const PRAZO =
    /\b48 horas\b|horas para responder|a proposta expira|se a proposta expirar|se uma proposta expirar|o prazo acabar|dentro do prazo|prazo termina/i;

  it("o «como funciona» do profissional não fala de prazo", () => {
    for (const passo of PASSOS_DO_PROFISSIONAL) {
      expect(passo.texto, passo.chave).not.toMatch(PRAZO);
    }
  });

  it("nem as perguntas frequentes do profissional", () => {
    for (const q of PERGUNTAS_DO_PROFISSIONAL) {
      expect(q.resposta, q.pergunta).not.toMatch(PRAZO);
    }
  });

  it("nem os termos, nem os emails, nem a mesa do profissional", () => {
    for (const f of [
      "src/app/termos/page.tsx",
      "src/lib/email-proposta.ts",
      "src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx",
    ]) {
      expect(semComentarios(ler(f)), f).not.toMatch(PRAZO);
    }
  });

  it("e o relógio saiu do ecrã do profissional", () => {
    // Um número a correr para zero, num ecrã onde nada acontece a zero, ensina
    // a pessoa a desconfiar de tudo o resto que lá está escrito.
    const mesa = semComentarios(ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx"));
    expect(mesa).not.toContain("horasAteExpirar");
  });
});
