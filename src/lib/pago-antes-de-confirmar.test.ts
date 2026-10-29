import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { faseDoTrabalho, faseParaOCliente, podeConfirmar } from "./trabalho";
import { negociacaoParaAVista } from "./negociacao-na-vista";
import { estadoDoPedidoParaOCliente, contratadoDaLinha } from "./pedido-para-a-app";

/**
 * BO27 — PAGAR AO PROFISSIONAL ANTES DE O CLIENTE CONFIRMAR NÃO FECHA O
 * TRABALHO PARA O CLIENTE (decisão do dono, 29-10-2026). Até ele confirmar,
 * continua por confirmar, pode confirmar, e não lhe chega aviso de «Concluído».
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const feito = new Date("2026-10-28T10:00:00Z");
const pago = new Date("2026-10-29T10:00:00Z");

describe("BO27", () => {
  it("para o cliente: pago e por confirmar continua por confirmar", () => {
    const t = { estado: "acordada", execucaoEnviadaEm: feito, confirmadoEm: null, pagoEm: pago };
    expect(faseDoTrabalho(t)).toBe("pago");
    expect(faseParaOCliente(t)).toBe("a_confirmar");
    // Depois de ele confirmar, o pago conta.
    expect(faseParaOCliente({ ...t, confirmadoEm: pago })).toBe("pago");
    expect(podeConfirmar({ ...t, pagoEm: null })).toBe(true);
  });

  it("a vista do cliente e o estado em palavras não dizem «Concluído» antes de ele confirmar", () => {
    const v = negociacaoParaAVista(
      { id: 1, estado: "acordada", valorAcordado: "100", propostasJson: "[]", execucaoEnviadaEm: feito, confirmadoEm: null, pagoEm: pago } as never,
      { porCarga: false, agora: new Date("2026-10-29T12:00:00Z") },
    );
    expect(v.fase).toBe("a_confirmar");
    const estado = estadoDoPedidoParaOCliente({
      status: "aprovado",
      trabalhoClyon: false,
      contratado: contratadoDaLinha({ fase: v.fase, profissionalNome: "Ana" }),
      comPropostas: 0,
      enviado: true,
    });
    expect(estado).not.toBe("Concluído");
  });

  it("marcar pago ao profissional não avisa o cliente", () => {
    const R = ler("src/app/api/admin/pagamentos/pago-ao-profissional/route.ts");
    expect(R).not.toMatch(/avisarCliente|avisarOClienteDoPedido|concluido_pela_clyon/);
    expect(ler("src/lib/avisos-ao-cliente.ts")).not.toContain("concluido_pela_clyon");
    // A confirmação do cliente não depende do pago.
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function confirmarExecucao(");
    expect(DB.slice(i, i + 3000)).not.toMatch(/pagoEm IS NULL/);
  });
});
