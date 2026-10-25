import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerTokenDoComprovativo, mensagemDoComprovativo, tokenDoComprovativo } from "./comprovativo-do-trabalho";
import type { TrabalhoParaGerir } from "./trabalhos-para-gerir";

/**
 * ENVIAR O COMPROVATIVO AO CLIENTE — 24-10-2026. *«Coloque o botão enviar
 * comprovativo, que envia directamente ao cliente.»* — o dono, sobre o #464.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

beforeAll(() => {
  process.env.JWT_SECRET ||= "segredo-de-teste";
});

describe("o link assinado", () => {
  it("abre o comprovativo dele, e só o dele", () => {
    const t = tokenDoComprovativo(464, "cliente")!;
    expect(t).toMatch(/^464-c-[A-Za-z0-9_-]{24}$/);
    expect(lerTokenDoComprovativo(t)).toEqual({ negociacaoId: 464, para: "cliente" });
    // Mudar o número, ou o «para quem», não abre outro.
    expect(lerTokenDoComprovativo(t.replace("464-", "465-"))).toBeNull();
    expect(lerTokenDoComprovativo(t.replace("-c-", "-p-"))).toBeNull();
    expect(lerTokenDoComprovativo("464-c-xxxxxxxxxxxxxxxxxxxxxxxx")).toBeNull();
    expect(lerTokenDoComprovativo("lixo")).toBeNull();
  });
});

describe("a mensagem", () => {
  it("diz o pedido, o serviço, o valor e leva o link", () => {
    const t = {
      pedidoId: 464,
      cliente: "Abel Nogueira",
      servico: "recolha_entulho",
      conta: { total: 442.8 },
    } as unknown as TrabalhoParaGerir;
    const m = mensagemDoComprovativo(t, "https://clyon.pt/comprovativo/abc");
    expect(m).toContain("Olá, Abel! Aqui é a CLYON.");
    expect(m).toContain("comprovativo do pagamento do pedido n.º 464");
    expect(m).toContain("442,80 €");
    expect(m).toContain("https://clyon.pt/comprovativo/abc");
  });
});

describe("as peças", () => {
  it("a rota envia para o telefone do pedido, pelo WhatsApp da CLYON, depois de o cliente pagar", () => {
    const R = ler("src/app/api/admin/comprovativo/route.ts");
    const post = R.slice(R.indexOf("export async function POST"));
    expect(post).toContain('const r = await comprovativoDoTrabalho(negociacaoId, "cliente");');
    expect(post).toContain("const telefone = String(t.telefoneDoCliente ?? \"\");");
    expect(post).toContain("if (await numeroBloqueadoWhatsApp(telefone)) {");
    expect(post).toContain("enviarTextoManualWhatsApp(telefone, mensagemDoComprovativo(t, link))");
    expect(post).toContain("await appendOrderHistory(");
  });

  it("o link do cliente abre o PDF sem sessão, e não entra no Google", () => {
    const P = ler("src/app/comprovativo/[token]/route.ts");
    expect(P).toContain("const lido = lerTokenDoComprovativo(token);");
    expect(P).toContain('"Content-Disposition": \`inline; filename=');
    expect(P).toContain('"X-Robots-Tag": "noindex, nofollow"');
  });

  it("os botões no cartão de valor fixo e nos Pagamentos", () => {
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain(
      "{a?.confirmadoEm && t.telefone && <BotaoEnviarComprovativo negociacaoId={a.negociacaoId} pedidoId={t.pedidoId} />}",
    );
    expect(ler("src/components/admin/AdminPagamentosPanel.tsx")).toContain(
      "{t.recebido && t.telefoneDoCliente && <BotaoEnviarComprovativo negociacaoId={t.negociacaoId} pedidoId={t.pedidoId} />}",
    );
  });
});
