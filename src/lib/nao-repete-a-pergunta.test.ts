import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jaFoiDito, MINUTOS_SEM_REPETIR_A_MESMA, type SaidaGravada } from "./nao-repetir";
import { simOuNao } from "./whatsapp-recolha";

/**
 * "O assistente continua a fazer perguntas repetidas." — 14-09-2026.
 *
 * Numa conversa só, com o cliente a responder pelo meio:
 *
 *   19:54  Qual é a morada? Rua e número - é por aí que o profissional...
 *   19:54  Qual é a morada? Rua e número - é por aí que o profissional...
 *   19:54  E o código postal, com a localidade?
 *   19:54  Desculpe, não apanhei. Com quem estou a falar?
 *   19:56  Com quem estou a falar?
 *   19:58  Com quem estou a falar?
 *
 * E, mais abaixo:
 *
 *   19:59  Dá para encostar a carrinha à porta, ou fica longe?
 *   19:59  Dá desde que tenha lugares livres
 *   19:59  Dá para estacionar à porta? Responda sim ou não.
 *
 * Ele respondeu com o verbo da pergunta — a forma mais natural de responder em
 * português — e levou de volta uma ordem para falar como uma máquina.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const AGORA = new Date("2026-09-14T19:58:00.000Z");
const PERGUNTA = "Com quem estou a falar?";
const saida = (texto: string, minutosAtras: number): SaidaGravada => ({
  direccao: "out",
  texto,
  criadoEm: new Date(AGORA.getTime() - minutosAtras * 60_000).toISOString(),
});

describe("a mesma pergunta não sai duas vezes seguidas", () => {
  const janela = MINUTOS_SEM_REPETIR_A_MESMA / 60;

  it("feita há dois minutos, não se repete", () => {
    expect(jaFoiDito(PERGUNTA, [saida(PERGUNTA, 2)], AGORA, janela)).toBe(true);
  });

  it("nem há quatro", () => {
    expect(jaFoiDito(PERGUNTA, [saida(PERGUNTA, 4)], AGORA, janela)).toBe(true);
  });

  /*
   * Passados os dez minutos volta a poder sair: uma pergunta por responder
   * pode ser repetida mais tarde — isso é insistir, e é legítimo. O que não é
   * legítimo é dizê-la outra vez enquanto a anterior ainda está no ecrã dele.
   */
  it("passada a janela, insistir é legítimo", () => {
    expect(jaFoiDito(PERGUNTA, [saida(PERGUNTA, 11)], AGORA, janela)).toBe(false);
  });

  it("dez minutos, e não as seis horas do ponto de situação", () => {
    expect(MINUTOS_SEM_REPETIR_A_MESMA).toBe(10);
  });

  it("uma pergunta diferente sai sempre", () => {
    expect(jaFoiDito("E o código postal, com a localidade?", [saida(PERGUNTA, 1)], AGORA, janela)).toBe(
      false,
    );
  });
});

describe("o guarda está na porta do cérebro, e não na da pessoa", () => {
  const CLOUD = ler("src/lib/whatsapp-cloud.ts");

  it("em enviarTextoWhatsApp — por onde passa tudo o que o assistente escreve", () => {
    const i = CLOUD.indexOf("export async function enviarTextoWhatsApp(");
    const corpo = CLOUD.slice(i, CLOUD.indexOf("export async function enviarTextoManualWhatsApp(", i));
    expect(corpo).toContain("MINUTOS_SEM_REPETIR_A_MESMA");
    expect(corpo).toContain("jaFoiDito(paraTeclado(texto)");
  });

  /*
   * O envio À MÃO não passa por aqui de propósito: se uma pessoa decidir
   * repetir-se, é uma decisão dela e ninguém lha tira.
   */
  it("o envio à mão do painel continua livre", () => {
    const i = CLOUD.indexOf("export async function enviarTextoManualWhatsApp(");
    const corpo = CLOUD.slice(i, i + 400);
    expect(corpo).not.toContain("jaFoiDito");
  });

  /*
   * Devolver `false` faria as reservas do assistente libertarem-se e tentarem
   * outra vez — um ciclo que só produzia mais cópias. E é verdade: a mensagem
   * ESTÁ no telemóvel dele.
   */
  it("engolir uma repetição conta como entregue", () => {
    const i = CLOUD.indexOf("export async function enviarTextoWhatsApp(");
    const corpo = CLOUD.slice(i, CLOUD.indexOf("export async function enviarTextoManualWhatsApp(", i));
    expect(corpo).toContain("return true;");
  });
});

describe("responder com o verbo da pergunta é responder", () => {
  it("«Dá desde que tenha lugares livres» é sim", () => {
    expect(simOuNao("Dá desde que tenha lugares livres")).toBe("sim");
  });

  for (const frase of ["Dá", "Pode ser", "Consegue", "Tem", "Há", "Cabe", "Sem problema"]) {
    it(`«${frase}» é sim`, () => {
      expect(simOuNao(frase)).toBe("sim");
    });
  }

  /*
   * O «não» manda sobre isto, e é testado ACIMA na função: «não dá» tem de
   * sair como «nao» antes de chegar à lista dos verbos.
   */
  it("«Não dá» continua a ser não", () => {
    expect(simOuNao("Não dá")).toBe("nao");
    expect(simOuNao("nao da lugares")).toBe("nao");
  });

  it("e o que não é resposta continua a não ser", () => {
    expect(simOuNao("Bom dia")).toBeNull();
    expect(simOuNao("Rua Foros de Amora, 91")).toBeNull();
  });
});
