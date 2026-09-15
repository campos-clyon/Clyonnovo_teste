import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UMA PESSOA, UMA MENSAGEM POR PASSAGEM.
 *
 * "Assistente disparou mensagens repetidas." — 15-09-2026.
 *
 * A CLAUDIA recebeu TRÊS vezes, às 15:41, a mesma frase, palavra por palavra:
 *
 *   «CLAUDIA, a proposta que lhe mandei continua à espera de si. Diga-me se
 *    lhe serve, ou que valor lhe faria sentido, que eu falo com o profissional.»
 *
 * A causa: o ciclo dos lembretes corre um AVISO de cada vez, e o pedido #288
 * dela tinha três propostas — Manuel Martins (340 €), Nova Recolha (320 €) e
 * TRSul (220 €). Três avisos, criados quase à mesma hora, a chegar ao mesmo
 * degrau da escada na mesma passagem. Cada um mandou o seu lembrete — e o
 * texto nem nomeia a proposta, por isso saíram três frases idênticas.
 *
 * O lembrete é PARA A PESSOA, não para a linha da tabela.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const AUTO = ler("src/lib/assistente-automatico.ts");

/** O bloco que insiste, que é onde isto se decide. */
const INSISTIR = AUTO.slice(
  AUTO.indexOf("// ── 2. Insistir com quem não respondeu"),
  AUTO.indexOf("// ── 3. As recolhas paradas a meio"),
);

describe("o mesmo número não leva duas mensagens na mesma passagem", () => {
  it("há uma memória de quem já foi lembrado", () => {
    expect(INSISTIR).toContain("jaLembradosNestaPassagem");
    expect(INSISTIR).toContain("new Set<string>()");
  });

  it("e quem já lá está é saltado ANTES de se compor o texto", () => {
    /*
     * Antes de compor e antes de enviar: compor uma mensagem para a deitar
     * fora é trabalho a mais, mas enviá-la é a avaria.
     */
    const i = INSISTIR.indexOf("jaLembradosNestaPassagem.has(quem)");
    const j = INSISTIR.indexOf("const texto = textoDoLembrete(");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(j);
  });

  it("só entra na memória DEPOIS de a mensagem sair mesmo", () => {
    // Marcá-lo antes calava os outros avisos dela por causa de um envio que
    // falhou — e ela ficava sem lembrete nenhum.
    const i = INSISTIR.indexOf("const saiu = await enviarTextoWhatsApp");
    const j = INSISTIR.indexOf("jaLembradosNestaPassagem.add(quem)");
    expect(j).toBeGreaterThan(i);
  });
});

describe("saltar NÃO gasta um degrau da escada", () => {
  it("quem é saltado não leva toque nenhum", () => {
    /*
     * O cuidado que não é óbvio. Marcar o toque de um aviso que nunca chegou a
     * mandar nada gastava um degrau numa mensagem que ela não recebeu — e ao
     * fim de dois avisos por fechar a escada esgotava-se sem que uma única
     * frase tivesse sido dita. Depois, «não responde a 2 lembretes», e a
     * conversa era entregue a uma pessoa por causa de mensagens que nunca
     * saíram.
     */
    const i = INSISTIR.indexOf("if (jaLembradosNestaPassagem.has(quem)) continue;");
    expect(i).toBeGreaterThan(-1);
    // Entre a decisão de saltar e o `continue` não há marcação nenhuma.
    const antes = INSISTIR.slice(i - 400, i);
    expect(antes).not.toContain("marcarToqueDoAssistente");
  });
});

describe("o toque conta para todos os avisos da mesma espécie dela", () => {
  it("marcam-se todos, e não só o que enviou", () => {
    /*
     * A frase que saiu vale pelas três propostas: não nomeia nenhuma, e quem a
     * lê responde sobre o pedido e não sobre uma linha da nossa tabela. Contar
     * o toque só num deixava os outros dois a tentar de dez em dez minutos —
     * a mesma avaria com outro relógio.
     */
    expect(INSISTIR).toContain("const daMesmaEspecie = abertos.filter(");
    expect(INSISTIR).toContain("for (const o of daMesmaEspecie) await db.marcarToqueDoAssistente(o.id)");
  });

  it("agrupa por ESPÉCIE também, e não só por número", () => {
    // «A proposta continua à espera» e «o trabalho está feito?» são coisas
    // diferentes: um toque numa não pode gastar a escada da outra.
    expect(INSISTIR).toContain("o.especie === a.especie");
  });

  it("e o resumo diz quantos avisos aquela mensagem cobriu", () => {
    // Sem isto, o registo dizia «1 lembrete» e havia três linhas a andar.
    expect(INSISTIR).toContain("daMesmaEspecie.length > 1");
  });
});

describe("o mesmo telemóvel escrito de duas maneiras é uma pessoa só", () => {
  it("compara-se pelos últimos nove dígitos", () => {
    /*
     * O mesmo número chega às vezes com indicativo e outras sem. Comparar o
     * texto cru fazia de uma pessoa duas — e duas pessoas recebem duas
     * mensagens, que é exactamente o que isto existe para evitar.
     */
    expect(AUTO).toContain("function soDigitosDoTelefone");
    expect(AUTO).toContain('.replace(/[^0-9]/g, "").slice(-9)');
  });
});
