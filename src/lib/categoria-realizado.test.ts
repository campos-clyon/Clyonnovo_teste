import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A categoria "Realizado" do painel de pedidos.
 *
 * O botão "Realizado" já existia e punha o estado — mas um pedido concluído
 * CONTINUAVA na lista dos activos: só "arquivado" era tratado à parte. A lista
 * dos activos é a lista do que há para fazer, e um trabalho feito, confirmado
 * e pago não é trabalho por fazer.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PAINEL = ler("src/components/admin/LegacyAdminClient.tsx");
const DB = ler("src/lib/db.ts");

describe("o filtro", () => {
  it("um pedido concluído só aparece na categoria dele", () => {
    expect(PAINEL).toContain('if (p.status === "concluido") return filtro === "concluido";');
  });

  it("o total de activos desconta os realizados", () => {
    expect(PAINEL).toContain('(pedidosCounts["concluido"] ?? 0)');
  });

  it("há um chip Realizados no cabeçalho, com contagem", () => {
    expect(PAINEL).toContain("Ver pedidos realizados");
  });
});

describe("as contagens", () => {
  it("o servidor conta arquivados e concluídos", () => {
    // O chip "Arquivados" mostrava sempre zero: ninguém contava.
    expect(DB).toContain("END) as arquivado");
    expect(DB).toContain("END) as concluido");
  });
});

describe("o automático", () => {
  it("confirmar o trabalho fecha o pedido", () => {
    /*
     * O pedido segue o trabalho: confirmado o trabalho, o pedido está
     * realizado. Sem isto, cada confirmação exigia lembrar-se de ir ao outro
     * painel carregar em "Realizado" — e ninguém se lembra sempre.
     */
    const corpo = DB.slice(
      DB.indexOf("export async function confirmarExecucao"),
      DB.indexOf("export async function libertarTrabalhosPorPrazo"),
    );
    expect(corpo).toContain("SET status = 'concluido'");
    // Sem desfazer arrumações: quem arquivou decidiu onde o pedido vive.
    expect(corpo).toContain("NOT IN ('cancelado', 'arquivado')");
  });

  it("a libertação por prazo fecha os pedidos dela também", () => {
    const corpo = DB.slice(DB.indexOf("export async function libertarTrabalhosPorPrazo"));
    expect(corpo.slice(0, 3000)).toContain("SET status = 'concluido'");
  });
});
