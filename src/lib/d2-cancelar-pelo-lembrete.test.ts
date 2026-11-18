import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/*
 * O TESTE DA CONVERSA DO «3» — d2 (CEO e dono, 18-11-2026), a parte do I&D.
 *
 * O «3» ao lembrete do orçamento já não cancela: pergunta «Confirma que quer
 * cancelar o pedido #N? Responda CANCELAR.», e só o CANCELAR cancela. Aqui
 * corre-se a conversa a sério (responderAoLembreteDoOrcamento), com a base
 * fingida pelo contrato de validade-do-orcamento-na-base.ts (pedir → à
 * espera → CANCELAR) e a porta das respostas pela regra verdadeira
 * (aUltimaSaidaE: a última mensagem que lhe saiu tem de ser o lembrete deste
 * pedido, ou a pergunta do CANCELAR dele). Nenhuma mensagem sai a ninguém:
 * o WhatsApp está fingido. Números INVENTADOS (o repositório é público).
 */

const estado = vi.hoisted(() => ({
  aEspera: false,
  cancelado: false,
  enviados: [] as string[],
  passadas: [] as string[],
  chamadas: [] as Array<{ f: string; texto?: string | null }>,
  confirmarFalha: false,
}));

vi.mock("@/lib/whatsapp-cloud", async (original) => ({
  ...(await original<typeof import("@/lib/whatsapp-cloud")>()),
  enviarTextoWhatsApp: vi.fn(async (_t: string, texto: string) => {
    estado.enviados.push(texto);
    return true;
  }),
  enviarBotoesWhatsApp: vi.fn(async (_t: string, texto: string) => {
    estado.enviados.push(texto);
    return true;
  }),
}));

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  interromperNumeroWhatsApp: vi.fn(async (_t: string, porque: string) => {
    estado.passadas.push(porque);
  }),
}));

vi.mock("@/lib/validade-do-orcamento-na-base", async () => {
  const regras = await import("./validade-do-orcamento");
  type R = { ok: true; estado: "pediu_confirmacao" | "a_espera_de_cancelar" | "cancelado"; porque?: string } | { ok: false; porque: string };
  const confirmar = async (pedidoId: number, _tel: string, texto: string): Promise<R> => {
    estado.chamadas.push({ f: "confirmar", texto });
    if (!regras.eConfirmacaoDoCancelamento(texto)) return { ok: false, porque: "a resposta não é o CANCELAR" };
    if (!estado.aEspera || estado.cancelado || estado.confirmarFalha) return { ok: false, porque: "não há pergunta do CANCELAR a valer para este pedido" };
    estado.cancelado = true;
    estado.aEspera = false;
    estado.enviados.push(`[cancelado #${pedidoId}]`);
    return { ok: true, estado: "cancelado" };
  };
  return {
    pararOCiclo: vi.fn(async () => {
      estado.chamadas.push({ f: "parar" });
    }),
    marcarCicloTerminado: vi.fn(async () => {
      estado.chamadas.push({ f: "terminado" });
      estado.aEspera = false;
    }),
    aceitarTrabalhoClyonPeloLembrete: vi.fn(async () => ({ ok: false, porque: "não usado aqui" })),
    confirmarCancelamentoPeloLembrete: vi.fn(confirmar),
    cancelarPeloLembrete: vi.fn(async (pedidoId: number, tel: string, texto?: string | null): Promise<R> => {
      estado.chamadas.push({ f: "cancelarPeloLembrete", texto });
      if (estado.cancelado) return { ok: false, porque: "sem ciclo da validade a correr para este pedido" };
      if (!estado.aEspera) {
        estado.aEspera = true;
        estado.enviados.push(regras.textoDaConfirmacaoDoCancelamento(pedidoId));
        return { ok: true, estado: "pediu_confirmacao" };
      }
      if (texto == null) return { ok: false, porque: "à espera do CANCELAR, sem o texto do cliente — confirmar à mão" };
      if (regras.eConfirmacaoDoCancelamento(texto)) return confirmar(pedidoId, tel, texto);
      return { ok: true, estado: "a_espera_de_cancelar", porque: "a resposta não é o CANCELAR" };
    }),
  };
});

import { responderAoLembreteDoOrcamento } from "./whatsapp-negociacao";
import { aUltimaSaidaE, textoDaConfirmacaoDoCancelamento, textoDoLembrete } from "./validade-do-orcamento";

const TEL = "351910000000";
const PEDIDO = 612;
const LEMBRETE = textoDoLembrete({ pedidoId: PEDIDO, nome: "Ana", servico: "recolha de monos", semIva: 100, total: 123, parceiro: null });

/** A porta de tratarMensagemDoCliente → ciclosComLembreteDoTelefone: só responde se a última saída é deste pedido. */
async function oClienteEscreve(texto: string): Promise<void> {
  const ultima = estado.enviados[estado.enviados.length - 1] ?? null;
  const responde = aUltimaSaidaE(ultima, PEDIDO);
  if (estado.cancelado) return;
  if (!(responde === "lembrete" || (estado.aEspera && responde === "confirmacao"))) return;
  await responderAoLembreteDoOrcamento(TEL, texto, [
    { pedidoId: PEDIDO, negociacaoId: 5, eClyon: false, valorUnico: false, parceiro: null, aEsperaDeCancelar: estado.aEspera },
  ]);
}

const PERGUNTA = textoDaConfirmacaoDoCancelamento(PEDIDO);

beforeEach(() => {
  estado.aEspera = false;
  estado.cancelado = false;
  estado.enviados = [LEMBRETE];
  estado.passadas = [];
  estado.chamadas = [];
  estado.confirmarFalha = false;
});
afterEach(() => vi.clearAllMocks());

describe("a conversa do «3» ao lembrete do orçamento (d2)", () => {
  it("«3» → só pergunta; nada se cancela e a conversa não passa à equipa", async () => {
    await oClienteEscreve("3");
    expect(estado.enviados.at(-1)).toBe(PERGUNTA);
    expect(PERGUNTA).toBe("Confirma que quer cancelar o pedido #612? Responda CANCELAR.");
    expect(estado.cancelado).toBe(false);
    expect(estado.passadas).toEqual([]);
    // O texto do cliente vai com a chamada.
    expect(estado.chamadas).toEqual([{ f: "cancelarPeloLembrete", texto: "3" }]);
  });

  it("«3» e depois «CANCELAR» → cancela, uma vez, sem passar à equipa", async () => {
    await oClienteEscreve("3");
    await oClienteEscreve("CANCELAR");
    expect(estado.cancelado).toBe(true);
    expect(estado.enviados.at(-1)).toBe("[cancelado #612]");
    expect(estado.chamadas.map((c) => c.f)).toEqual(["cancelarPeloLembrete", "confirmar"]);
    expect(estado.passadas).toEqual([]);
    // Um segundo CANCELAR já não encontra nada a que responder.
    await oClienteEscreve("CANCELAR");
    expect(estado.chamadas.filter((c) => c.f === "confirmar")).toHaveLength(1);
  });

  it("«3» de novo (ou «já não preciso») à espera → não cancela nem repete a pergunta", async () => {
    await oClienteEscreve("3");
    const depoisDaPergunta = estado.enviados.length;
    await oClienteEscreve("3");
    await oClienteEscreve("já não preciso");
    expect(estado.enviados.length).toBe(depoisDaPergunta);
    expect(estado.enviados.filter((t) => t === PERGUNTA)).toHaveLength(1);
    expect(estado.cancelado).toBe(false);
    expect(estado.passadas).toEqual([]);
    expect(estado.chamadas.filter((c) => c.f === "confirmar")).toHaveLength(0);
    // E o CANCELAR, a seguir, ainda cancela (a pergunta continua a ser a última saída).
    await oClienteEscreve("Cancelar o pedido 612");
    expect(estado.cancelado).toBe(true);
  });

  it("«cancel» e «annuler» (como o tradutor os põe) à espera → cancelam", async () => {
    for (const palavra of ["cancel", "annuler", "Cancel the request"]) {
      estado.aEspera = false;
      estado.cancelado = false;
      estado.enviados = [LEMBRETE];
      await oClienteEscreve("3");
      await oClienteEscreve(palavra);
      expect(estado.cancelado, palavra).toBe(true);
    }
  });

  it("o CANCELAR logo ao lembrete (sem a pergunta feita) → pergunta primeiro", async () => {
    await oClienteEscreve("CANCELAR");
    expect(estado.enviados.at(-1)).toBe(PERGUNTA);
    expect(estado.cancelado).toBe(false);
    expect(estado.chamadas.map((c) => c.f)).toEqual(["cancelarPeloLembrete"]);
  });

  it("um «3» que responde a outra pergunta → não toca no pedido", async () => {
    estado.enviados.push("Qual é o andar? Responda 1, 2 ou 3.");
    await oClienteEscreve("3");
    expect(estado.chamadas).toEqual([]);
    expect(estado.cancelado).toBe(false);
    // E à espera do CANCELAR, com outra pergunta pelo meio, o CANCELAR também não.
    estado.enviados = [LEMBRETE];
    await oClienteEscreve("3");
    estado.enviados.push("[à mão] Pedido #612: prefere de manhã? 1 sim, 3 não");
    await oClienteEscreve("CANCELAR");
    expect(estado.cancelado).toBe(false);
    expect(estado.chamadas.filter((c) => c.f === "confirmar")).toHaveLength(0);
  });

  it("o CANCELAR que não se faz (ok: false) passa à equipa", async () => {
    await oClienteEscreve("3");
    estado.confirmarFalha = true;
    await oClienteEscreve("CANCELAR");
    expect(estado.cancelado).toBe(false);
    expect(estado.passadas).toHaveLength(1);
    expect(estado.passadas[0]).toContain("#612");
    expect(estado.passadas[0]).toContain("cancelar à mão");
  });

  it("um «2» depois da pergunta segue o caminho de sempre: a contagem pára e passa à equipa", async () => {
    await oClienteEscreve("3");
    await oClienteEscreve("2");
    expect(estado.cancelado).toBe(false);
    expect(estado.chamadas.map((c) => c.f)).toEqual(["cancelarPeloLembrete", "parar"]);
    expect(estado.passadas[0]).toContain("tem dúvidas ou quer outra data");
  });
});

describe("no código da conversa", () => {
  const VITORIA = readFileSync("src/lib/whatsapp-negociacao.ts", "utf8").replace(/\r\n/g, "\n");
  const corpo = VITORIA.slice(
    VITORIA.indexOf("export async function responderAoLembreteDoOrcamento("),
    VITORIA.indexOf("async function fecharPeloCliente("),
  );
  it("o CANCELAR lê-se antes de lerRespostaAoLembrete, e o «3» leva o texto", () => {
    const cancelar = corpo.indexOf("base.confirmarCancelamentoPeloLembrete(c.pedidoId, telefone, texto)");
    expect(cancelar).toBeGreaterThan(-1);
    expect(corpo.indexOf("ciclos[0].aEsperaDeCancelar && regras.eConfirmacaoDoCancelamento(texto)")).toBeLessThan(cancelar);
    expect(cancelar).toBeLessThan(corpo.indexOf("regras.lerRespostaAoLembrete(texto)"));
    expect(corpo).toContain("base.cancelarPeloLembrete(c.pedidoId, telefone, texto)");
    expect(corpo).not.toContain("base.cancelarPeloLembrete(c.pedidoId, telefone)");
  });
});
