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
 * fotografia falhada fica marcada, não se agradece, e a Vitória pede com
 * delicadeza para a reenviar — uma vez, por muitas que falhem seguidas.
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

  it("pede para a reenviar (depois da espera), e nunca agradece imagens que não viu", async () => {
    const [r] = await correr([{ midia: "foto", imagemFalhou: true, texto: "" }]);
    expect(r.status).toBe(200);
    expect(mundo.fio[0]).toMatchObject({ direccao: "in", texto: MARCA_DE_FOTOGRAFIA_FALHADA });
    expect(mundo.enviadas).toEqual([PEDIR_PARA_REENVIAR_A_FOTOGRAFIA]);
    expect(mundo.enviadas.join(" ")).not.toMatch(/obrigad[ao] pel[ao]s? (imagens|fotografias?)/i);
    // Sem palavras não há rajada: o cérebro nem é chamado.
    expect(mundo.cerebro).toEqual([]);
  }, 30_000);

  it("não pede no instante: aos 10 s ainda não saiu nada", async () => {
    let aos10: string[] | null = null;
    await correr([{ midia: "foto", imagemFalhou: true, texto: "" }], (s) => {
      if (s === 10) aos10 = [...mundo.enviadas];
    });
    expect(aos10).toEqual([]);
    expect(mundo.enviadas).toEqual([PEDIR_PARA_REENVIAR_A_FOTOGRAFIA]);
  }, 30_000);

  it("se entretanto chegou a fotografia com os bytes, não se pede", async () => {
    await correr([{ midia: "foto", imagemFalhou: true, texto: "" }], (s) => {
      if (s === 5) gravar("in", MARCA_DE_FOTOGRAFIA);
    });
    expect(mundo.enviadas).toEqual([]);
  }, 30_000);

  it("a ponte antiga (só «midia: foto») dá o mesmo — a «foto» sem bytes é sempre uma que falhou", async () => {
    await correr([{ midia: "foto", texto: "" }]);
    expect(mundo.fio[0].texto).toBe(MARCA_DE_FOTOGRAFIA_FALHADA);
    expect(mundo.enviadas).toEqual([PEDIR_PARA_REENVIAR_A_FOTOGRAFIA]);
  }, 30_000);

  it("três fotografias falhadas seguidas levam UM pedido", async () => {
    await correr([
      { midia: "foto", imagemFalhou: true, texto: "" },
      { midia: "foto", imagemFalhou: true, texto: "" },
      { midia: "foto", imagemFalhou: true, texto: "" },
    ]);
    expect(mundo.enviadas).toEqual([PEDIR_PARA_REENVIAR_A_FOTOGRAFIA]);
  }, 30_000);

  it("a legenda segue pela rajada como texto, sem contar a fotografia como vista", async () => {
    await correr([{ midia: "foto", imagemFalhou: true, texto: "Um sofá e um colchão" }]);
    expect(mundo.enviadas[0]).toBe(PEDIR_PARA_REENVIAR_A_FOTOGRAFIA);
    expect(mundo.cerebro).toEqual([{ texto: "Um sofá e um colchão", imagens: 0 }]);
  }, 30_000);

  it("[texto][falhada][pedido de reenvio]: o texto que veio antes é lido (d57)", async () => {
    await correr([{ texto: "Preciso de retirar um roupeiro de 4 módulos" }, { midia: "foto", imagemFalhou: true, texto: "" }]);
    expect(mundo.cerebro).toEqual([{ texto: "Preciso de retirar um roupeiro de 4 módulos", imagens: 0 }]);
    expect(mundo.enviadas).toEqual([PEDIR_PARA_REENVIAR_A_FOTOGRAFIA]);
  }, 30_000);

  it("depois de ele escrever, uma nova falhada volta a pedir", async () => {
    await correr([{ midia: "foto", imagemFalhou: true, texto: "" }]);
    gravar("in", "Já mandei");
    gravar("out", "Obrigada!");
    await correr([{ midia: "foto", imagemFalhou: true, texto: "" }]);
    expect(mundo.enviadas.filter((t) => t === PEDIR_PARA_REENVIAR_A_FOTOGRAFIA)).toHaveLength(2);
  }, 30_000);
});

describe("as regras, puras", () => {
  const FALHADA = MARCA_DE_FOTOGRAFIA_FALHADA;

  it("a fotografia falhada não é uma imagem: não se agradece nem conta para não a pedir no fim", () => {
    expect(eFotografiaFalhada(FALHADA)).toBe(true);
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
    // A falhada já teve o seu pedido no instante: a rua responde por si.
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

  it("o aviso ao modelo sabe que a fotografia falhada não se viu", () => {
    expect(LICOES_DAS_CONVERSAS).toContain('"[fotografia não descarregada]"');
    expect(LICOES_DAS_CONVERSAS).toMatch(/nunca agradeças imagens que não se viram/);
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

  it("a porta mostra as falhadas da semana", () => {
    expect(PONTE).toContain("imagensQueNaoDescarregaramNaSemana: imagensQueFalharamNaSemana(agora)");
    expect(PONTE).toContain("const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;");
  });
});
