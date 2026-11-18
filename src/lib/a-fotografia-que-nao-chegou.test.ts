import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  eAUltimaDaRajada,
  eFotografiaFalhada,
  eMarcaDeImagem,
  fotografiasFalhadasDaRajada,
  imagensDaRajada,
  jaPediuParaReenviar,
  MARCA_DE_FOTOGRAFIA,
  MARCA_DE_FOTOGRAFIA_FALHADA,
  MARCA_DE_FOTOGRAFIA_FALHADA_ANTIGA,
  NOTA_DA_FOTOGRAFIA_NO_TELEMOVEL,
  textoDaRajada,
} from "./rajada-do-whatsapp";
import { PEDIR_PARA_REENVIAR_A_FOTOGRAFIA } from "./voz-da-vitoria";
import { passoDaPergunta } from "./reler-a-conversa";
import { fotosNoFio } from "./whatsapp-recolha";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { LICOES_DAS_CONVERSAS } from "./whatsapp-compreensao";

/**
 * A FOTOGRAFIA QUE NÃO CHEGOU — o teste da conversa (15-11-2026, decisão d34).
 *
 * Às 08h23 uma fotografia do WhatsApp não descarregou na ponte, e a Vitória
 * respondeu «Obrigada pelas imagens!»: o parceiro recebeu o pedido sem a
 * fotografia e o cliente ficou a achar que ela tinha sido vista. Agora a
 * fotografia falhada fica marcada e não se agradece.
 *
 * E JÁ NÃO SE PEDE PARA A REENVIAR — 18-11-2026 (continuação da d57). A ponte
 * deixou de descarregar todas as fotografias, e cada cliente ouvia o pedido e
 * reenviava a mesma, que falhava outra vez. Agora ao cliente não sai nada: a
 * conversa fica guardada com a nota para a equipa a ver no telemóvel.
 *
 * Os números e as frases deste teste são inventados.
 */

const TELEFONE = "351910000000";
/** O relógio verdadeiro, guardado antes de o de mentira entrar. */
const setTimeoutVerdadeiro = globalThis.setTimeout;

/* ── A base, o envio e o cérebro, de mentira ───────────────────────────── */

type Linha = { id: number; direccao: string; texto: string };
const mundo = {
  fio: [] as Linha[],
  enviadas: [] as string[],
  cerebro: [] as Array<{ texto: string; imagens?: number }>,
  notas: [] as Array<{ telefone: string; nota: string }>,
};
function gravar(direccao: string, texto: string): number {
  const id = mundo.fio.length + 1;
  mundo.fio.push({ id, direccao, texto });
  return id;
}

vi.mock("@/lib/db", () => ({
  carimbarPonte: async () => {},
  filaWhatsAppParaAPonte: async () => [],
  interromperNumeroWhatsApp: async () => {},
  marcarFilaWhatsAppEnviadas: async () => {},
  numeroBloqueadoWhatsApp: async () => false,
  numeroInterrompidoWhatsApp: async () => false,
  whatsappLigado: async () => true,
  registarMensagemWhatsApp: async (_t: string, direccao: string, texto: string) => gravar(direccao, texto),
  mensagensComIdDoNumeroWhatsApp: async () => mundo.fio.map((m) => ({ ...m })),
  comTrancaDoNumeroWhatsApp: async (_t: string, f: () => Promise<unknown>) => f(),
  anotarFotografiaNoTelemovelWhatsApp: async (telefone: string, nota: string) => {
    mundo.notas.push({ telefone, nota });
  },
}));
vi.mock("@/lib/whatsapp-cloud", () => ({
  ponteConfigurada: () => true,
  enviarTextoWhatsApp: async (_t: string, texto: string) => {
    mundo.enviadas.push(texto);
    gravar("out", texto);
    return true;
  },
}));
vi.mock("@/lib/whatsapp-negociacao", () => ({
  pedidosDoTelefone: async () => [],
  tratarMensagemDoCliente: async (_t: string, c: { texto: string; imagens?: number }) => {
    mundo.cerebro.push({ texto: c.texto, imagens: c.imagens });
  },
  guardarFotoDoClienteNoPedido: async () => {},
}));
vi.mock("@/lib/aviso-de-pedido-ao-profissional", () => ({ ePedidoParaParar: () => false }));

async function daPonte(corpo: Record<string, unknown>) {
  const { POST } = await import("@/app/api/whatsapp/ponte/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("http://localhost/api/whatsapp/ponte", {
    method: "POST",
    headers: { authorization: "Bearer segredo-de-teste", "content-type": "application/json" },
    body: JSON.stringify({ telefone: TELEFONE, ...corpo }),
  });
  return POST(req);
}

describe("a conversa: uma fotografia que não descarregou", () => {
  // Os módulos que a rota carrega a meio, já carregados: com a suite inteira a
  // correr, um import lento deixava o relógio de mentira a andar antes do tempo.
  beforeAll(async () => {
    await Promise.all([
      import("@/app/api/whatsapp/ponte/route"),
      import("@/lib/rajada-do-whatsapp"),
      import("@/lib/rajada-em-curso"),
      import("@/lib/voz-da-vitoria"),
      import("@/lib/db"),
      import("@/lib/whatsapp-cloud"),
      import("next/server"),
    ]);
  }, 60_000);

  beforeEach(() => {
    process.env.PONTE_WHATSAPP_SEGREDO = "segredo-de-teste";
    mundo.fio = [];
    mundo.enviadas = [];
    mundo.cerebro = [];
    mundo.notas = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /*
   * Desde a d57 (17-11-2026) o pedido espera ~20 s: o relógio é de mentira, e
   * anda um segundo de cada vez até as rotas acabarem (as esperas só começam
   * depois dos imports). `aMeio` corre enquanto as rotas esperam.
   */
  async function correr(corpos: Array<Record<string, unknown>>, aMeio?: (segundo: number) => void) {
    vi.useFakeTimers();
    let porAcabar = corpos.length;
    // Umas atrás das outras, como chegam da ponte: com o relógio parado, a poucos ms de distância.
    const rs: Array<Promise<Response>> = [];
    for (const c of corpos) {
      rs.push(
        daPonte(c).finally(() => {
          porAcabar -= 1;
        }),
      );
      await new Promise((r) => setTimeoutVerdadeiro(r, 50));
    }
    // E 10 ms de relógio verdadeiro entre cada segundo: os imports a meio da rota levam tempo a sério.
    // Até ao fim, por muitos segundos de mentira que leve: com a suite inteira a correr, os imports demoram.
    for (let i = 0; i < 2000 && porAcabar > 0; i++) {
      aMeio?.(i);
      await vi.advanceTimersByTimeAsync(1_000);
      await new Promise((r) => setTimeoutVerdadeiro(r, 10));
    }
    return Promise.all(rs);
  }

  it("não pede nada ao cliente: fica a marca e a nota para a equipa ver no telemóvel", async () => {
    const [r] = await correr([{ midia: "foto", imagemFalhou: true, texto: "" }]);
    expect(r.status).toBe(200);
    expect(mundo.fio[0]).toMatchObject({ direccao: "in", texto: MARCA_DE_FOTOGRAFIA_FALHADA });
    expect(mundo.enviadas).toEqual([]);
    expect(mundo.notas).toEqual([{ telefone: TELEFONE, nota: NOTA_DA_FOTOGRAFIA_NO_TELEMOVEL }]);
    // Sem palavras não há rajada: o cérebro nem é chamado.
    expect(mundo.cerebro).toEqual([]);
  }, 30_000);

  it("a ponte antiga (só «midia: foto») dá o mesmo — a «foto» sem bytes é sempre uma que falhou", async () => {
    await correr([{ midia: "foto", texto: "" }]);
    expect(mundo.fio[0].texto).toBe(MARCA_DE_FOTOGRAFIA_FALHADA);
    expect(mundo.enviadas).toEqual([]);
    expect(mundo.notas).toHaveLength(1);
  }, 30_000);

  it("três fotografias falhadas seguidas: nada ao cliente", async () => {
    await correr([
      { midia: "foto", imagemFalhou: true, texto: "" },
      { midia: "foto", imagemFalhou: true, texto: "" },
      { midia: "foto", imagemFalhou: true, texto: "" },
    ]);
    expect(mundo.enviadas).toEqual([]);
    expect(mundo.enviadas.join(" ")).not.toMatch(/reenvi|outra vez/i);
  }, 30_000);

  it("a legenda segue pela rajada como texto, sem contar a fotografia como vista", async () => {
    await correr([{ midia: "foto", imagemFalhou: true, texto: "Um sofá e um colchão" }]);
    expect(mundo.enviadas).toEqual([]);
    expect(mundo.cerebro).toEqual([{ texto: "Um sofá e um colchão", imagens: 0 }]);
  }, 30_000);

  it("[texto][falhada]: o texto que veio antes é lido, e não se pede a fotografia", async () => {
    await correr([{ texto: "Preciso de retirar um roupeiro de 4 módulos" }, { midia: "foto", imagemFalhou: true, texto: "" }]);
    expect(mundo.cerebro).toEqual([{ texto: "Preciso de retirar um roupeiro de 4 módulos", imagens: 0 }]);
    expect(mundo.enviadas).not.toContain(PEDIR_PARA_REENVIAR_A_FOTOGRAFIA);
  }, 30_000);

  /*
   * A FOTOGRAFIA COM LEGENDA EM INGLÊS — 18-11-2026. Uma fotografia de um
   * anúncio (código G0) com o pedido na legenda; a fotografia não abriu e não
   * saiu nada — nem a resposta. O pedido de reenvio esperava ~20 s dentro da
   * mesma função que respondia à legenda (Promise.all), e com o tradutor a
   * conta passava os 60 s da Vercel: morriam as duas. Agora a legenda é a
   * única coisa que corre, e chega ao cérebro tal como veio (texto inventado).
   */
  it("a legenda em inglês de uma fotografia que não abriu chega ao cérebro, e lê-se em inglês", async () => {
    const LEGENDA = "Hi! I need junk removal in Lisbon. Could you send me a quote? (G0) 200x81x5cm3";
    await correr([{ midia: "foto", imagemFalhou: true, texto: LEGENDA }]);
    expect(mundo.cerebro).toEqual([{ texto: LEGENDA, imagens: 0 }]);
    expect(mundo.enviadas).toEqual([]);
    expect(mundo.notas).toHaveLength(1);
    const { linguaAGuardar } = await import("./lingua-do-cliente");
    expect(linguaAGuardar(LEGENDA)).toBe("en");
  }, 30_000);

  it("a rota já não envia a frase do reenvio", () => {
    const ROTA = readFileSync(join(process.cwd(), "src/app/api/whatsapp/ponte/route.ts"), "utf8");
    expect(ROTA).not.toContain("PEDIR_PARA_REENVIAR_A_FOTOGRAFIA");
  });
});

describe("as regras, puras", () => {
  const FALHADA = MARCA_DE_FOTOGRAFIA_FALHADA;

  it("a fotografia falhada não é uma imagem: não se agradece nem conta para não a pedir no fim", () => {
    expect(eFotografiaFalhada(FALHADA)).toBe(true);
    // A marca de 15–18/11 ainda está nos fios desses dias.
    expect(eFotografiaFalhada(MARCA_DE_FOTOGRAFIA_FALHADA_ANTIGA)).toBe(true);
    expect(eMarcaDeImagem(MARCA_DE_FOTOGRAFIA_FALHADA_ANTIGA)).toBe(false);
    expect(eMarcaDeImagem(FALHADA)).toBe(false);
    const fio = [
      { id: 1, direccao: "in", texto: FALHADA },
      { id: 2, direccao: "in", texto: MARCA_DE_FOTOGRAFIA },
    ];
    expect(imagensDaRajada(fio)).toBe(1);
    expect(fotografiasFalhadasDaRajada(fio)).toBe(1);
    expect(fotosNoFio(fio)).toBe(1);
  });

  it("não é texto do cliente, e não cala o texto que veio antes", () => {
    const fio = [
      { id: 1, direccao: "in", texto: "Rua das Flores 1" },
      { id: 2, direccao: "in", texto: FALHADA },
    ];
    expect(textoDaRajada(fio)).toBe("Rua das Flores 1");
    // A falhada não espera por resposta: a rua responde por si.
    expect(eAUltimaDaRajada(1, fio)).toBe(true);
  });

  it("já se pediu? só as falhadas e as nossas mensagens desde o pedido", () => {
    const P = PEDIR_PARA_REENVIAR_A_FOTOGRAFIA;
    expect(jaPediuParaReenviar([{ id: 1, direccao: "in", texto: FALHADA }], P)).toBe(false);
    expect(
      jaPediuParaReenviar(
        [
          { id: 1, direccao: "in", texto: FALHADA },
          { id: 2, direccao: "out", texto: P },
          { id: 3, direccao: "in", texto: FALHADA },
        ],
        P,
      ),
    ).toBe(true);
    expect(
      jaPediuParaReenviar(
        [
          { id: 2, direccao: "out", texto: P },
          { id: 3, direccao: "in", texto: "ok" },
          { id: 4, direccao: "in", texto: FALHADA },
        ],
        P,
      ),
    ).toBe(false);
  });

  it("a frase é da Vitória: delicada, sem emoji, sem agradecer, e não é uma pergunta do pedido", () => {
    const P = PEDIR_PARA_REENVIAR_A_FOTOGRAFIA;
    expect(P).toMatch(/por favor\?$/);
    expect(P).not.toMatch(/obrigad/i);
    expect(P).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(P).not.toMatch(/\b(IA|virtual)\b/);
    expect(passoDaPergunta(P)).toBeNull();
    for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(P, l)).toBeTruthy();
  });

  it("o aviso ao modelo sabe que a fotografia falhada não se viu, e que não se pede outra vez", () => {
    expect(LICOES_DAS_CONVERSAS).toContain(`"${MARCA_DE_FOTOGRAFIA_FALHADA}"`);
    expect(LICOES_DAS_CONVERSAS).toContain('"[fotografia não descarregada]"');
    expect(LICOES_DAS_CONVERSAS).toMatch(/nunca agradeças imagens que não se viram/);
    expect(LICOES_DAS_CONVERSAS).toMatch(/NUNCA lhe peças para reenviar a fotografia/);
  });
});

describe("a ponte marca a fotografia que falhou e conta-as", () => {
  const PONTE = readFileSync(join(process.cwd(), "ponte-whatsapp/index.js"), "utf8");

  it("vai com «imagemFalhou: true» ao site", () => {
    const i = PONTE.indexOf("não descarregou — a página do WhatsApp Web mudou");
    const bloco = PONTE.slice(i, PONTE.indexOf("return;", i));
    expect(bloco).toContain("contarImagemQueFalhou();");
    expect(bloco).toContain('site("POST", { telefone, midia: "foto", imagemFalhou: true, texto: legenda })');
  });

  /*
   * 18-11-2026: a whatsapp-web.js 1.34.7 descarrega sem o mimetype e a página
   * nova recusa (InvalidMediaFileType). A ponte descarrega pela página COM o
   * mimetype, antes de tentar a da biblioteca — nas fotografias e nos áudios.
   */
  it("descarrega pela página com o mimetype, antes da biblioteca", () => {
    const i = PONTE.indexOf("async function descarregarPelaPagina(");
    const corpo = PONTE.slice(i, PONTE.indexOf("\n}\n", i));
    expect(corpo).toContain("downloadAndMaybeDecrypt({");
    expect(corpo).toContain("mimetype: m.mimetype,");
    const t = PONTE.indexOf("async function descarregarComTentativas(");
    const tentativas = PONTE.slice(t, PONTE.indexOf("\n}\n", t));
    expect(tentativas.indexOf("descarregarPelaPagina(msg)")).toBeGreaterThan(-1);
    expect(tentativas.indexOf("descarregarPelaPagina(msg)")).toBeLessThan(tentativas.indexOf("msg.downloadMedia()"));
    const a = PONTE.indexOf('msg.type === "ptt"');
    const audio = PONTE.slice(a, a + 600);
    expect(audio.indexOf("descarregarPelaPagina(msg)")).toBeLessThan(audio.indexOf("msg.downloadMedia()"));
  });

  it("a porta mostra as falhadas da semana", () => {
    expect(PONTE).toContain("imagensQueNaoDescarregaramNaSemana: imagensQueFalharamNaSemana(agora)");
    expect(PONTE).toContain("const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;");
  });
});
