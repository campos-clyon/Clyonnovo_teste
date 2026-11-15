import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  beforeEach(() => {
    process.env.PONTE_WHATSAPP_SEGREDO = "segredo-de-teste";
    mundo.fio = [];
    mundo.enviadas = [];
    mundo.cerebro = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pede para a reenviar, e nunca agradece imagens que não viu", async () => {
    const r = await daPonte({ midia: "foto", imagemFalhou: true, texto: "" });
    expect(r.status).toBe(200);
    expect(mundo.fio[0]).toMatchObject({ direccao: "in", texto: MARCA_DE_FOTOGRAFIA_FALHADA });
    expect(mundo.enviadas).toEqual([PEDIR_PARA_REENVIAR_A_FOTOGRAFIA]);
    expect(mundo.enviadas.join(" ")).not.toMatch(/obrigad[ao] pel[ao]s? (imagens|fotografias?)/i);
    // Sem palavras não há rajada: o cérebro nem é chamado.
    expect(mundo.cerebro).toEqual([]);
  });

  it("a ponte antiga (só «midia: foto») dá o mesmo — a «foto» sem bytes é sempre uma que falhou", async () => {
    await daPonte({ midia: "foto", texto: "" });
    expect(mundo.fio[0].texto).toBe(MARCA_DE_FOTOGRAFIA_FALHADA);
    expect(mundo.enviadas).toEqual([PEDIR_PARA_REENVIAR_A_FOTOGRAFIA]);
  });

  it("três fotografias falhadas seguidas levam UM pedido", async () => {
    await daPonte({ midia: "foto", imagemFalhou: true, texto: "" });
    await daPonte({ midia: "foto", imagemFalhou: true, texto: "" });
    await daPonte({ midia: "foto", imagemFalhou: true, texto: "" });
    expect(mundo.enviadas).toEqual([PEDIR_PARA_REENVIAR_A_FOTOGRAFIA]);
  });

  it("a legenda segue pela rajada como texto, sem contar a fotografia como vista", async () => {
    vi.useFakeTimers();
    const r = daPonte({ midia: "foto", imagemFalhou: true, texto: "Um sofá e um colchão" });
    await vi.advanceTimersByTimeAsync(60_000);
    await r;
    expect(mundo.enviadas[0]).toBe(PEDIR_PARA_REENVIAR_A_FOTOGRAFIA);
    expect(mundo.cerebro).toEqual([{ texto: "Um sofá e um colchão", imagens: 0 }]);
  });

  it("depois de ele escrever, uma nova falhada volta a pedir", async () => {
    await daPonte({ midia: "foto", imagemFalhou: true, texto: "" });
    gravar("in", "Já mandei");
    gravar("out", "Obrigada!");
    await daPonte({ midia: "foto", imagemFalhou: true, texto: "" });
    expect(mundo.enviadas.filter((t) => t === PEDIR_PARA_REENVIAR_A_FOTOGRAFIA)).toHaveLength(2);
  });
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
