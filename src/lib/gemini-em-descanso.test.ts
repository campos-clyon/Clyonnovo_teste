import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  eFaltaDeQuota,
  aindaDescansa,
  pôrADescansar,
  modelosAUsar,
  lerDescansos,
  MINUTOS_DE_DESCANSO,
} from "./gemini-em-descanso";

/**
 * "Vamos corrigi-lo de uma vez esse erro." — 14-09-2026, sobre isto:
 *
 *   [429 Too Many Requests] You exceeded your current quota, please check
 *   your plan and billing details.
 *
 * A escada de modelos já existia — o bom primeiro, o de reserva a seguir — mas
 * era percorrida do princípio a CADA mensagem. Com o `gemini-2.5-flash` sem
 * quota, cada frase de cada cliente gastava uma chamada condenada antes de
 * chegar ao modelo que ainda podia responder.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const AGORA = new Date("2026-09-14T19:00:00.000Z");
const O_429 =
  "[GoogleGenerativeAI Error]: Error fetching from ...gemini-2.5-flash:generateContent: " +
  "[429 Too Many Requests] You exceeded your current quota";

describe("só a falta de quota põe um modelo de castigo", () => {
  it("o 429 da Google, nas palavras dele", () => {
    expect(eFaltaDeQuota(O_429)).toBe(true);
    expect(eFaltaDeQuota("429 Too Many Requests")).toBe(true);
    expect(eFaltaDeQuota("You exceeded your current QUOTA")).toBe(true);
  });

  /*
   * Um tempo esgotado ou um JSON mal formado são problemas do momento e não
   * dizem nada sobre o modelo estar disponível daqui a um segundo. Pô-lo de
   * castigo por causa deles tirava do ar o bom modelo por causa de um soluço.
   */
  it("um tempo esgotado não é falta de quota", () => {
    expect(eFaltaDeQuota("demorou mais de 18 s")).toBe(false);
  });

  it("nem uma resposta mal formada, nem um erro qualquer", () => {
    expect(eFaltaDeQuota("respondeu, mas não em JSON que se leia")).toBe(false);
    expect(eFaltaDeQuota("500 Internal Server Error")).toBe(false);
  });
});

describe("o castigo dura, e passa", () => {
  it("quinze minutos — nem um dia, nem um minuto", () => {
    /*
     * Um 429 tanto pode ser o limite por MINUTO como o limite por DIA, e a
     * mensagem da Google não distingue os dois. Um descanso longo tratava um
     * engasgo de sessenta segundos como se fosse o dia perdido.
     */
    expect(MINUTOS_DE_DESCANSO).toBe(15);
  });

  it("enquanto dura, o modelo está de castigo", () => {
    const d = pôrADescansar({}, "gemini-2.5-flash", AGORA);
    expect(aindaDescansa(d, "gemini-2.5-flash", AGORA)).toBe(true);
    const daqui14 = new Date(AGORA.getTime() + 14 * 60_000);
    expect(aindaDescansa(d, "gemini-2.5-flash", daqui14)).toBe(true);
  });

  it("passado o tempo, volta sozinho", () => {
    const d = pôrADescansar({}, "gemini-2.5-flash", AGORA);
    const daqui16 = new Date(AGORA.getTime() + 16 * 60_000);
    expect(aindaDescansa(d, "gemini-2.5-flash", daqui16)).toBe(false);
  });

  it("os castigos velhos são varridos quando se põe um novo", () => {
    const velho = { "modelo-antigo": new Date(AGORA.getTime() - 3600_000).toISOString() };
    const d = pôrADescansar(velho, "gemini-2.5-flash", AGORA);
    expect(d["modelo-antigo"]).toBeUndefined();
  });

  it("uma data ilegível não cala um modelo para sempre", () => {
    expect(aindaDescansa({ x: "isto-nao-e-uma-data" }, "x", AGORA)).toBe(false);
  });
});

describe("a ordem por que se tentam", () => {
  const ESCADA = ["gemini-2.5-flash", "gemini-2.0-flash"];

  it("sem castigos, é a escada como está", () => {
    expect(modelosAUsar(ESCADA, {}, AGORA)).toEqual(ESCADA);
  });

  it("o que está sem quota vai para o fim", () => {
    const d = pôrADescansar({}, "gemini-2.5-flash", AGORA);
    expect(modelosAUsar(ESCADA, d, AGORA)).toEqual(["gemini-2.0-flash", "gemini-2.5-flash"]);
  });

  /*
   * Se todos estiverem de castigo tenta-se na mesma: mais vale uma chamada
   * condenada do que um assistente que decide sozinho não perceber ninguém.
   */
  it("com todos de castigo, nenhum é deitado fora", () => {
    let d = pôrADescansar({}, "gemini-2.5-flash", AGORA);
    d = pôrADescansar(d, "gemini-2.0-flash", AGORA);
    expect(modelosAUsar(ESCADA, d, AGORA).sort()).toEqual([...ESCADA].sort());
  });

  it("um modelo repetido na escada não se tenta duas vezes", () => {
    expect(modelosAUsar(["a", "a"], {}, AGORA)).toEqual(["a"]);
  });
});

describe("o que está guardado lê-se sem confiar", () => {
  it("vazio, estragado ou de outro feitio dá um mapa vazio", () => {
    expect(lerDescansos(null)).toEqual({});
    expect(lerDescansos("nao e json")).toEqual({});
    expect(lerDescansos("[1,2,3]")).toEqual({});
    expect(lerDescansos('{"a": 5}')).toEqual({});
  });

  it("e o que é bom passa", () => {
    expect(lerDescansos('{"m":"2026-09-14T19:15:00.000Z"}')).toEqual({
      m: "2026-09-14T19:15:00.000Z",
    });
  });
});

describe("ligado às duas leituras", () => {
  const COMPREENSAO = ler("src/lib/whatsapp-compreensao.ts");

  it("as duas percorrem a escada com os castigos aplicados", () => {
    expect(COMPREENSAO).toContain("async function escadaDeModelos(");
    const i = COMPREENSAO.indexOf("export async function compreenderResposta");
    expect(COMPREENSAO.slice(i)).toContain("await escadaDeModelos(modelName)");
    const j = COMPREENSAO.indexOf("export async function compreenderFioComMotivo");
    expect(COMPREENSAO.slice(j, i > j ? i : undefined)).toContain("escadaDeModelos(modelName)");
  });

  it("e as duas põem de castigo quem responde 429", () => {
    expect(COMPREENSAO).toContain("await porDeCastigo(modelo, r.motivo);");
    expect(COMPREENSAO).toContain("await porDeCastigo(modelo, msg);");
  });

  it("a memória do castigo nunca trava a leitura", () => {
    const i = COMPREENSAO.indexOf("async function porDeCastigo(");
    const corpo = COMPREENSAO.slice(i, i + 900);
    expect(corpo).toContain("try {");
    expect(corpo).toContain("catch {");
  });
});

describe("e o botão continua mesmo quando a leitura falha", () => {
  const ROTA = ler("src/app/api/admin/whatsapp/route.ts");

  /*
   * "Ao clicar em Reler e continuar ele deve ler tudo e continuar a conversa
   * de onde parou." Reler e continuar são duas coisas, e só a primeira precisa
   * do Gemini: o passo em que a recolha ficou está gravado. O botão devolvia
   * um erro e deixava a conversa onde estava — nem lia, nem continuava.
   */
  it("sem leitura, repete a pergunta do passo onde ficou", () => {
    expect(ROTA).toContain("if (!campos && guardada) {");
    expect(ROTA).toContain("perguntaDo(passo, dados, !compreensaoDisponivel())");
  });

  it("e diz que não releu — para ninguém pensar que os campos foram recuperados", () => {
    expect(ROTA).toContain("semLeitura: true");
    expect(ROTA).toContain("Não consegui reler");
  });

  it("um envio engolido não passa por sucesso", () => {
    // A conversa pode estar entregue a uma pessoa: aí o portão cala o envio,
    // e dizer «retomei» seria mentira.
    expect(ROTA).toContain("Não consegui reler nem falar com este número");
  });
});

describe("o modelo do assistente tem uma variável só dele", () => {
  const COMPREENSAO = ler("src/lib/whatsapp-compreensao.ts");

  /*
   * `GEMINI_MODEL` é lida por QUATRO sítios com feitios diferentes: o chat do
   * simulador quer o nome com prefixo (`google/gemini-2.0-flash`, como a porta
   * da Vercel os chama) e este quer o nome nu. Mudá-la para desencravar o
   * WhatsApp partia o simulador pelo caminho — e ninguém ligaria as duas
   * coisas.
   */
  it("WHATSAPP_GEMINI_MODEL manda, e GEMINI_MODEL continua a valer", () => {
    expect(COMPREENSAO).toContain(
      'modeloDoGemini(process.env.WHATSAPP_GEMINI_MODEL, process.env.GEMINI_MODEL)',
    );
  });

  it("e as três leituras usam-na", () => {
    const quantas = COMPREENSAO.split("modeloDoAssistente()").length - 1;
    // Uma na definição, três nos usos.
    expect(quantas).toBeGreaterThanOrEqual(4);
  });

  it("está documentada para quem for pô-la na Vercel", () => {
    expect(ler(".env.example")).toContain("WHATSAPP_GEMINI_MODEL=");
  });
});
