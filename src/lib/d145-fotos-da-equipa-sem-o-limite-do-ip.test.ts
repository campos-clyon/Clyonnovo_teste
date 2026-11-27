import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * d145 (27-11-2026): o backoffice sobe as fotografias do WhatsApp pela rota
 * pública do simulador, que trava a 10 lotes por IP em 5 minutos. A equipa
 * (com sessão válida) passa a ter um limite próprio, por colaborador; o
 * público mantém o de hoje. E o formulário, num 429, espera e tenta de novo.
 */

const colaborador = vi.hoisted(() => ({ atual: null as null | { id: number } }));

vi.mock("@/lib/admin-auth-helper", () => ({
  colaboradorComSessaoValida: async () =>
    colaborador.atual ? { ...colaborador.atual, nome: "Equipa", isAdmin: 1, papel: "admin" } : null,
}));
vi.mock("@/lib/cliente-auth", () => ({
  limitarPorContaDoCliente: async () => ({ erro: null }),
}));
// Sem armazenamento: quem passa o limite recebe 501, quem não passa recebe 429.
vi.mock("@/lib/blob-token", () => ({
  obterTokenDoBlob: () => ({ ok: false, motivo: "teste" }),
}));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));

function pedido(ip: string, autorizacao?: string) {
  return new NextRequest("http://localhost/api/simulador/upload-fotos", {
    method: "POST",
    headers: { "x-real-ip": ip, ...(autorizacao ? { authorization: autorizacao } : {}) },
  });
}

describe("d145 — a rota de fotografias e o limite", () => {
  beforeEach(() => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    colaborador.atual = null;
  });

  it("o público continua travado ao 11.º lote do mesmo IP em 5 minutos", async () => {
    const { POST } = await import("@/app/api/simulador/upload-fotos/route");
    const ip = `10.0.0.${Math.floor(Math.random() * 200)}-pub`;
    for (let i = 0; i < 10; i++) expect((await POST(pedido(ip))).status).toBe(501);
    const travado = await POST(pedido(ip));
    expect(travado.status).toBe(429);
    expect((await travado.json()).error).toContain("Demasiados envios");
  });

  it("a equipa não é travada pelo limite do IP, mesmo com o IP já esgotado", async () => {
    const { POST } = await import("@/app/api/simulador/upload-fotos/route");
    const ip = `10.0.1.${Math.floor(Math.random() * 200)}-escritorio`;
    for (let i = 0; i < 10; i++) await POST(pedido(ip));
    expect((await POST(pedido(ip))).status).toBe(429);

    colaborador.atual = { id: 900001 + Math.floor(Math.random() * 1000) };
    for (let i = 0; i < 40; i++) {
      expect((await POST(pedido(ip, "Bearer token-da-equipa"))).status).toBe(501);
    }
  });

  it("a equipa tem o seu próprio tecto, por colaborador (200 lotes / 5 min)", async () => {
    const { POST } = await import("@/app/api/simulador/upload-fotos/route");
    colaborador.atual = { id: 800001 + Math.floor(Math.random() * 1000) };
    for (let i = 0; i < 200; i++) await POST(pedido("10.0.2.1", "Bearer x"));
    expect((await POST(pedido("10.0.2.1", "Bearer x"))).status).toBe(429);
    // Outro colaborador, no mesmo IP, conta à parte.
    colaborador.atual = { id: colaborador.atual.id + 5000 };
    expect((await POST(pedido("10.0.2.1", "Bearer y"))).status).toBe(501);
  });
});

describe("d145 — num 429, esperar e tentar outra vez", () => {
  it("repete só o «demasiados envios», com esperas crescentes, e pára quando sobe", async () => {
    const { enviarComNovasTentativas, ESPERAS_ENTRE_TENTATIVAS_MS } = await import("./enviar-com-novas-tentativas");
    expect(ESPERAS_ENTRE_TENTATIVAS_MS).toEqual([...ESPERAS_ENTRE_TENTATIVAS_MS].sort((a, b) => a - b));
    const respostas = [
      { ok: false as const, motivo: "Demasiados envios", demasiados: true },
      { ok: false as const, motivo: "Demasiados envios", demasiados: true },
      { ok: true as const, ficheiro: { url: "https://x/f.jpg", name: "f.jpg", size: 1, type: "image/jpeg" } },
    ];
    const dormidas: number[] = [];
    const r = await enviarComNovasTentativas(async () => respostas.shift()!, {
      esperas: [10, 20, 40],
      dormir: async (ms) => void dormidas.push(ms),
    });
    expect(r.ok).toBe(true);
    expect(dormidas).toEqual([10, 20]);
  });

  it("outra falha volta logo, sem repetir", async () => {
    const { enviarComNovasTentativas } = await import("./enviar-com-novas-tentativas");
    let chamadas = 0;
    const r = await enviarComNovasTentativas(
      async () => (chamadas++, { ok: false as const, motivo: "formato não aceite" }),
      { esperas: [1, 2], dormir: async () => {} },
    );
    expect(r.ok).toBe(false);
    expect(chamadas).toBe(1);
  });

  it("desiste ao fim das esperas e devolve a falha", async () => {
    const { enviarComNovasTentativas } = await import("./enviar-com-novas-tentativas");
    let chamadas = 0;
    const r = await enviarComNovasTentativas(
      async () => (chamadas++, { ok: false as const, motivo: "Demasiados envios", demasiados: true }),
      { esperas: [1, 2, 3], dormir: async () => {} },
    );
    expect(r.ok).toBe(false);
    expect(chamadas).toBe(4);
  });
});

describe("d145 — o envio e o formulário", () => {
  const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

  it("o envio pela nossa função leva a sessão e marca o 429", () => {
    const E = ler("src/lib/enviar-ficheiro.ts");
    expect(E).toContain("return await pelaNossaFuncao(ficheiro, opcoes);");
    expect(E).toMatch(/fetch\("\/api\/simulador\/upload-fotos", \{[\s\S]*?headers: cabecalhosDoEnvio\(o\),/);
    expect(E).toContain("res.status === 429 ? { demasiados: true }");
  });

  it("o formulário do backoffice repete os 429 em vez de deixar «Falhou»", () => {
    const R = ler("src/components/admin/RegistarPedido.tsx");
    expect(R).toContain("enviarComNovasTentativas(");
    expect(R).toContain("() => enviarFicheiro(original, { autorizacao: token ? `Bearer ${token}` : null })");
  });
});
