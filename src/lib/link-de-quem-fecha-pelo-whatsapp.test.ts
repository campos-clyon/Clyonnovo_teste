import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fraseDoLinkDoFecho, linkParaQuemFechou } from "./link-de-quem-fecha-pelo-whatsapp";
import { hashDeToken } from "./pedido-acesso";

/**
 * Quem fecha pelo WhatsApp recebe o link do pedido — 01-11-2026. Sem mensagens
 * a ninguém: a base e o envio são falsos.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const SITE = "https://clyon.pt";

describe("o link de quem fecha pelo WhatsApp", () => {
  it("sem conta: um token novo, guardado só em hash, e o link do pedido", async () => {
    const substituir = vi.fn(async () => {});
    const link = await linkParaQuemFechou(612, {
      emailDoPedido: async () => null,
      existeContaComEmail: async () => false,
      substituirTokenDoPedido: substituir,
      site: SITE,
    });
    expect(link).toMatch(/^https:\/\/clyon\.pt\/pedido\/[A-Za-z0-9_-]{43}$/);
    const token = link!.split("/").pop()!;
    expect(substituir).toHaveBeenCalledTimes(1);
    const [id, hash, expira] = substituir.mock.calls[0] as unknown as [number, string, Date];
    expect(id).toBe(612);
    expect(hash).toBe(hashDeToken(token));
    expect(hash).not.toContain(token);
    expect(expira.getTime()).toBeGreaterThan(Date.now());
  });

  it("com conta com o email do pedido: a conta, e o token não roda", async () => {
    const substituir = vi.fn(async () => {});
    const link = await linkParaQuemFechou(612, {
      emailDoPedido: async () => "cliente@exemplo.pt",
      existeContaComEmail: async () => true,
      substituirTokenDoPedido: substituir,
      site: SITE + "/",
    });
    expect(link).toBe("https://clyon.pt/conta");
    expect(substituir).not.toHaveBeenCalled();
  });

  it("se a base falhar, não lança: a mensagem sai sem link", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const link = await linkParaQuemFechou(612, {
      emailDoPedido: async () => null,
      existeContaComEmail: async () => false,
      substituirTokenDoPedido: async () => {
        throw new Error("DB not available");
      },
      site: SITE,
    });
    expect(link).toBeNull();
    erro.mockRestore();
  });

  it("a frase: pagar pela plataforma, ou só acompanhar em dinheiro — sempre «parceiro»", () => {
    const l = "https://clyon.pt/pedido/abc";
    const plataforma = fraseDoLinkDoFecho("na_plataforma", l);
    expect(plataforma).toContain("MB WAY ou Multibanco");
    expect(plataforma).toContain("confirmar a chegada do parceiro e o trabalho feito");
    expect(plataforma.endsWith(`\n${l}`)).toBe(true);
    const dinheiro = fraseDoLinkDoFecho("dinheiro", l);
    expect(dinheiro).not.toContain("MB WAY");
    expect(dinheiro).toContain("parceiro");
    for (const f of [plataforma, dinheiro]) { expect(f).not.toMatch(/profissional|virtual/i); expect(f).not.toMatch(/\bIA\b/); }
  });

  it("o «Fechado com…» da Vitória leva o link, no mesmo envio e depois do fecho", () => {
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    const i = NEG.indexOf("async function fecharPeloCliente(");
    const corpo = NEG.slice(i, NEG.indexOf("async function recusarUmaNaBase", i));
    expect(corpo).toContain("await linkParaQuemFechou(alvo.pedidoId,");
    expect(corpo).toContain("fraseDoLinkDoFecho(alvo.formaDePagamento, link, novo)");
    expect(corpo).toMatch(/O parceiro recebeu a morada e o seu contacto\.\$\{sobreODia\}\$\{doLink\}/);
    // O link só se gera depois de a negociação estar gravada como fechada.
    expect(corpo.indexOf("await gravarNegociacao(")).toBeLessThan(corpo.indexOf("await linkParaQuemFechou("));
    // Pelo caminho da Vitória (portão, tradução), não por um envio à parte.
    expect(corpo.slice(corpo.indexOf("await linkParaQuemFechou(")).indexOf("enviarTextoWhatsApp(")).toBeGreaterThan(-1);
  });
});
