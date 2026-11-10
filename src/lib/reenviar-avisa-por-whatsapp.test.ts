import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * REENVIAR AO PROFISSIONAL TAMBÉM AVISA POR WHATSAPP — 10-11-2026.
 * Quatro pedidos com 0 propostas: o aviso «Pedido novo» só nascia na
 * distribuição, com o interruptor desligado nesse momento. O reenvio repõe-no,
 * com as mesmas três fechaduras da distribuição.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("reenviar ao profissional", () => {
  const rota = ler("src/app/api/admin/negociacoes/reenviar/route.ts");

  it("repõe o aviso no WhatsApp com o link novo", () => {
    expect(rota).toContain("reporAvisoAoProfissional({");
    expect(rota).toMatch(/link: `\$\{baseUrl\}\/profissionais\/pedidos\/\$\{acesso\.token\}`/);
  });

  it("com as três fechaduras e só numa negociação aberta", () => {
    expect(rota).toContain('assistentePode("avisar_profissional")');
    expect(rota).toContain("Number(profissional?.whatsappAvisos) === 1");
    expect(rota).toContain("telemovelParaWhatsApp(");
    expect(rota).toContain('alvo.estado === "aberta"');
  });

  it("a distribuição diz quando falta a base da conta, e não a morada do pedido", () => {
    const d = ler("src/lib/distribuicao-do-pedido.ts");
    expect(d).toContain('sem_base: "a conta não tem a base marcada (Serviços e raio)"');
    expect(d).toMatch(/m === "sem_morada" && \(p\.baseLat == null \|\| p\.baseLng == null\)/);
  });
});
