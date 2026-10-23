import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O NÚMERO E O NOME À FRENTE — 21-10-2026. *«Coloque o nome dos clientes
 * depois do número do pedido; a categoria, coloque-a em baixo — o número do
 * pedido e o nome do cliente com mais destaque.»* — o dono.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const T = ler("src/components/admin/TrabalhoClyon.tsx");
const M = ler("src/components/admin/AdminNegociacoesPanel.tsx");

describe("o número e o nome do cliente em destaque, a categoria em baixo", () => {
  it("nos de valor fixo", () => {
    expect(T).toContain('#{t.pedidoId} · {t.cliente || "Cliente sem nome"}');
    const titulo = T.indexOf('#{t.pedidoId} · {t.cliente || "Cliente sem nome"}');
    expect(T.indexOf("{maiuscula(servicoEmPalavras(t.servico))}", titulo)).toBeGreaterThan(titulo);
  });

  it("nas negociações, maiores, e a categoria em palavras", () => {
    // 15 px desde 23-10-2026 (a Mesa mais apertada) — continuam o maior texto da linha.
    expect(M).toContain('<span className="text-[15px] font-bold text-white">#{p.id}</span>');
    expect(M).toContain('<span className="truncate text-[15px] font-bold text-white">');
    expect(M).toContain('<span className="font-semibold text-slate-300">{nomeComMaiuscula(p.serviceType)}</span> · {p.city ?? "—"}');
    expect(M).not.toContain('{p.city ?? "—"} · {p.serviceType ?? "—"}');
  });

  it("no «Por decidir»", () => {
    expect(M).toContain('#{p.id} · {p.contactName || "Cliente sem nome"}');
    expect(M).not.toContain('#{p.id} · {p.serviceType ?? "—"}');
  });
});
