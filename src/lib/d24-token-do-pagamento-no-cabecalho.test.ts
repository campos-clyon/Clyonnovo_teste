import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * d24 (10-11-2026) — O TOKEN DO PAGAMENTO VAI NO CABEÇALHO, e o link antigo
 * (`?token=`) continua a funcionar. Dados de teste.
 */

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  registarSemFalhar: vi.fn(async () => {}),
}));
vi.mock("@/lib/acesso-ao-pagamento", () => ({
  trabalhoQueSePodePagar: vi.fn(async () => ({ ok: false, erro: "Sem acesso (teste).", estado: 403 })),
}));
vi.mock("@/lib/cliente-auth", () => ({ sessaoDoCliente: vi.fn(async () => null) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));

import { GET } from "@/app/api/pagamentos/route";
import { trabalhoQueSePodePagar } from "@/lib/acesso-ao-pagamento";
import { CABECALHO_DO_TOKEN_DO_PAGAMENTO } from "./cabecalho-do-pagamento";

const tokenRecebido = () => (vi.mocked(trabalhoQueSePodePagar).mock.calls[0][2] as { token?: string }).token;

beforeEach(() => vi.clearAllMocks());

describe("o token do link do pagamento", () => {
  it("lê-se do cabeçalho", async () => {
    await GET(
      new NextRequest("https://clyon.pt/api/pagamentos?pedidoId=800&negociacaoId=900", {
        headers: { [CABECALHO_DO_TOKEN_DO_PAGAMENTO]: "token-de-teste" },
      }),
    );
    expect(tokenRecebido()).toBe("token-de-teste");
  });

  it("o link antigo, com ?token=, continua a funcionar", async () => {
    await GET(new NextRequest("https://clyon.pt/api/pagamentos?pedidoId=800&negociacaoId=900&token=token-antigo"));
    expect(tokenRecebido()).toBe("token-antigo");
  });

  it("com os dois, ganha o cabeçalho", async () => {
    await GET(
      new NextRequest("https://clyon.pt/api/pagamentos?pedidoId=800&negociacaoId=900&token=token-antigo", {
        headers: { [CABECALHO_DO_TOKEN_DO_PAGAMENTO]: "token-de-teste" },
      }),
    );
    expect(tokenRecebido()).toBe("token-de-teste");
  });

  it("o ecrã do pagamento já não o põe no endereço", () => {
    const ECRA = readFileSync(join(process.cwd(), "src/components/PagarTrabalho.tsx"), "utf8");
    expect(ECRA).toContain("const params = useRef(`pedidoId=${pedidoId}&negociacaoId=${negociacaoId}`);");
    expect(ECRA).toContain("[CABECALHO_DO_TOKEN_DO_PAGAMENTO]: token");
    expect(ECRA).toContain('{ cache: "no-store", headers: cabecalhos.current }');
    expect(ECRA).not.toContain("&token=${encodeURIComponent(token)}");
  });
});
