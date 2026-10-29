import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RODAPE_DO_PEDIDO,
  acessoDoPedido,
  atalhosDaContraproposta,
  fotografiasDoPedido,
  repeticaoEmPalavras,
  responderamEmPalavras,
  videosDoPedido,
} from "./pedido-completo-para-a-app";
import { noFiltro } from "./pedidos-do-cliente";

/** S22 — a R5 e a R4 completas (29-10-2026). */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("S22 — o pedido completo na app", () => {
  it("fotografias e vídeos à parte", () => {
    const f = JSON.stringify([
      { url: "https://a.public.blob.vercel-storage.com/x.jpg", type: "image/jpeg" },
      { url: "https://a.public.blob.vercel-storage.com/y.mp4", type: "video/mp4" },
      "https://a.public.blob.vercel-storage.com/z.MOV",
    ]);
    expect(fotografiasDoPedido(f)).toEqual(["https://a.public.blob.vercel-storage.com/x.jpg"]);
    expect(videosDoPedido(f)).toHaveLength(2);
    expect(fotografiasDoPedido("lixo")).toEqual([]);
  });

  it("o acesso em palavras, numa mudança dos dois lados", () => {
    expect(acessoDoPedido({ serviceType: "recolha_moveis", floor: "3", hasElevator: "no" })).toBe("3.º andar, sem elevador");
    expect(acessoDoPedido({ serviceType: "recolha_moveis", floor: "rés-do-chão", hasElevator: "no" })).toBe("rés-do-chão");
    expect(
      acessoDoPedido({
        serviceType: "mudanca",
        rawOrderJson: JSON.stringify({ originAccess: { floor: "2", hasElevator: "yes" }, destinationAccess: { floor: "moradia" } }),
      }),
    ).toBe("Origem: 2.º andar, com elevador · Destino: moradia");
  });

  it("a repetição, o rodapé, o «responderam» e os atalhos (os do site: 5 % e 10 % abaixo)", () => {
    expect(repeticaoEmPalavras("semanal")).toBe("Todas as semanas");
    expect(repeticaoEmPalavras("x")).toBeNull();
    expect(RODAPE_DO_PEDIDO).toMatch(/^O trabalho é feito pelo profissional que escolher\. A fatura é emitida pela /);
    expect(responderamEmPalavras(0)).toBeNull();
    expect(responderamEmPalavras(1)).toBe("1 profissional respondeu");
    expect(responderamEmPalavras(3)).toBe("3 profissionais responderam");
    expect(atalhosDaContraproposta(200)).toEqual([
      { valor: 190, texto: "190,00 €" },
      { valor: 180, texto: "180,00 €" },
    ]);
    expect(atalhosDaContraproposta(null)).toEqual([]);
    expect(ler("src/components/EscolherValor.tsx")).toContain("abaixo: [...PASSOS_DA_CONTRAPROPOSTA_DO_CLIENTE],");
  });

  it("os separadores da lista são os da conta, pela mesma tabela de estados", () => {
    expect(noFiltro("Concluído", "concluidos")).toBe(true);
    expect(noFiltro("Cancelado", "em_aberto")).toBe(false);
    expect(noFiltro("Tem propostas", "em_aberto")).toBe(true);
    expect(noFiltro("Cancelado", "todos")).toBe(true);
  });

  it("a R5 tira a linha do tempo e as duas entregas da mesma função do site", () => {
    const L = ler("src/lib/pedidos-do-cliente.ts");
    expect(L).toContain("const ecra = negociacaoParaOEcra(n, base, agora, pedido.id);");
    expect(L).toContain("historico: ecra.historico,");
    expect(L).toContain("emDuasEntregas: ecra.emDuasEntregas,");
    // A carteira e o sair de todos: só com sessão de cliente.
    for (const f of ["src/app/api/cliente/carteira/route.ts", "src/app/api/cliente/sair-de-todos/route.ts"]) {
      expect(ler(f)).toMatch(/const email = await emailDoCliente\(req\);\s+if \(!email\) return NextResponse\.json\(\{ ok: false, error: "Não autenticado" \}, \{ status: 401 \}\);/);
    }
  });
});
