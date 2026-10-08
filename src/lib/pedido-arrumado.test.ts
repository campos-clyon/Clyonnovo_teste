import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aindaPorFazer,
  aindaPorFazerSql,
  estadoParaOProfissional,
  estadoParaOProfissionalSql,
  pedidoArrumado,
} from "./pedido-arrumado";
import { resumoDaOferta, type NegociacaoDaOferta } from "./oferta-clyon";

/**
 * UM PEDIDO ARQUIVADO OU CANCELADO SAI DOS PROFISSIONAIS — 08-10-2026.
 *
 * «Quero que garanta que se o pedido foi cancelado ou arquivado pelo admin ou
 * assistentes ele seja removido dos pros ou vá directamente para recusados.»
 * O #418: o cliente desistiu e o trabalho continuava atribuído ao Revolution.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const corpoDe = (fonte: string, inicio: string) => {
  const i = fonte.indexOf(inicio);
  expect(i).toBeGreaterThan(-1);
  return fonte.slice(i, fonte.indexOf("\n}\n", i));
};

const dia = "2026-10-08T10:00:00.000Z";

describe("a regra", () => {
  it("cancelado, arquivado e rejeitado tiram o pedido dos profissionais; concluído não", () => {
    expect(pedidoArrumado("cancelado")).toBe(true);
    expect(pedidoArrumado("arquivado")).toBe(true);
    expect(pedidoArrumado("rejeitado")).toBe(true);
    expect(pedidoArrumado("concluido")).toBe(false);
    expect(pedidoArrumado("sem_assistente")).toBe(false);
    expect(pedidoArrumado(null)).toBe(false);
  });

  it("o #418: atribuído e por fazer, com o pedido cancelado, é um trabalho perdido", () => {
    expect(estadoParaOProfissional({ estado: "acordada" }, "cancelado")).toBe("morta");
    expect(estadoParaOProfissional({ estado: "acordada" }, "arquivado")).toBe("morta");
    expect(estadoParaOProfissional({ estado: "aberta" }, "arquivado")).toBe("morta");
    expect(estadoParaOProfissional({ estado: "aguarda_contratacao" }, "rejeitado")).toBe("morta");
    // Com o pedido vivo, nada muda.
    expect(estadoParaOProfissional({ estado: "acordada" }, "atribuido")).toBe("acordada");
    expect(estadoParaOProfissional({ estado: "aberta" }, null)).toBe("aberta");
  });

  it("o que já foi feito fica: arquivar um concluído não lhe tira o dinheiro", () => {
    expect(aindaPorFazer({ estado: "acordada", execucaoEnviadaEm: dia })).toBe(false);
    expect(aindaPorFazer({ estado: "acordada", confirmadoEm: dia })).toBe(false);
    expect(aindaPorFazer({ estado: "acordada", pagoEm: dia })).toBe(false);
    expect(estadoParaOProfissional({ estado: "acordada", confirmadoEm: dia, pagoEm: dia }, "arquivado")).toBe(
      "acordada",
    );
    // As que ele já tinha perdido continuam perdidas, e como estavam.
    expect(estadoParaOProfissional({ estado: "desistida" }, "cancelado")).toBe("desistida");
    expect(estadoParaOProfissional({ estado: "morta" }, "cancelado")).toBe("morta");
  });

  it("o SQL diz o mesmo que o TypeScript", () => {
    expect(aindaPorFazerSql()).toBe(
      "(estado IN ('aberta', 'aguarda_contratacao') OR " +
        "(estado = 'acordada' AND execucaoEnviadaEm IS NULL AND confirmadoEm IS NULL AND pagoEm IS NULL))",
    );
    expect(estadoParaOProfissionalSql("n.", "o.")).toBe(
      "CASE WHEN o.status IN ('cancelado', 'arquivado', 'rejeitado') AND " +
        "(n.estado IN ('aberta', 'aguarda_contratacao') OR " +
        "(n.estado = 'acordada' AND n.execucaoEnviadaEm IS NULL AND n.confirmadoEm IS NULL AND n.pagoEm IS NULL)) " +
        "THEN 'morta' ELSE n.estado END",
    );
  });
});

describe("ao arrumar o pedido", () => {
  const DB = ler("src/lib/db.ts");

  it("o «Arquivar» e o estado mudado à mão passam por updateSimulatorOrder", () => {
    const arquivar = semNotas(ler("src/app/api/admin/pedidos/[id]/reject/route.ts"));
    expect(arquivar).toContain("await updateSimulatorOrder(orderId, {");
    expect(arquivar).toContain('status: "arquivado",');
    expect(semNotas(ler("src/app/api/admin/pedidos/[id]/route.ts"))).toContain(
      "await updateSimulatorOrder(Number(id), body as Parameters<typeof updateSimulatorOrder>[1]);",
    );
  });

  it("e updateSimulatorOrder encerra as negociações ao arrumar, e repõe-nas ao sair do arquivo", () => {
    const corpo = semNotas(corpoDe(DB, "export async function updateSimulatorOrder("));
    const gravar = corpo.indexOf("await pool.execute(`UPDATE simulatorOrders SET ${sets} WHERE id = ?`, vals);");
    const fechar = corpo.indexOf("if (depois && !antes) await fecharNegociacoesDeUmPedidoArrumado(id);");
    expect(gravar).toBeGreaterThan(-1);
    expect(fechar).toBeGreaterThan(gravar);
    expect(corpo).toContain("else if (antes && !depois) await reabrirNegociacoesDeUmPedidoArrumado(id);");
    expect(corpo).toContain("const antes = pedidoArrumado(prevForNotify.status);");
    expect(corpo).toContain("const depois = pedidoArrumado(data.status);");
  });

  it("encerrar guarda a memória, e só toca no que está por fazer", () => {
    const corpo = corpoDe(DB, "export async function fecharNegociacoesDeUmPedidoArrumado(");
    expect(corpo).toContain("const onde = `WHERE pedidoId = ? AND ${aindaPorFazerSql()}`;");
    expect(corpo).toContain("`UPDATE negociacoes SET estadoAntesDeCancelar = estado, estado = 'morta' ${onde}`");
    const repor = corpoDe(DB, "export async function reabrirNegociacoesDeUmPedidoArrumado(");
    expect(repor).toContain("SET estado = estadoAntesDeCancelar, estadoAntesDeCancelar = NULL");
    expect(repor).toContain("WHERE pedidoId = ? AND estado = 'morta'");
  });

  it("o cliente que cancela pela página do orçamento também os encerra", () => {
    const corpo = corpoDe(DB, "export async function cancelarOrcamentoPeloCliente(");
    expect(corpo).toContain("await fecharNegociacoesDeUmPedidoArrumado(order.id)");
  });
});

describe("o que o profissional vê", () => {
  it("o painel lê como perdido o que está por fazer num pedido arrumado — também os de antes", () => {
    const corpo = corpoDe(ler("src/lib/db.ts"), "export async function negociacoesDoProfissional(");
    expect(corpo).toContain('${estadoParaOProfissionalSql("n.", "o.")} AS estado,');
    expect(corpo).not.toMatch(/SELECT n\.id, n\.pedidoId, n\.estado,/);
    expect(corpo).toContain("JOIN simulatorOrders o ON o.id = n.pedidoId");
  });

  it("e a página do link de email também", () => {
    expect(semNotas(ler("src/app/profissionais/pedidos/[token]/page.tsx"))).toContain(
      "estadoInicial={estadoParaOProfissional(negociacao, linha.status)}",
    );
  });

  it("uma negociação morta vai para os Recusados", () => {
    const T = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(T).toContain('if (p.estado === "desistida" || p.estado === "morta") return "recusados";');
  });
});

describe("os Trabalhos CLYON do backoffice", () => {
  const neg = (o: Partial<NegociacaoDaOferta>): NegociacaoDaOferta => ({
    negociacaoId: 1,
    providerId: 7,
    profissional: "Revolution",
    estado: "acordada",
    modo: "directa",
    atribuidaEm: dia,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    ...o,
  });

  it("o #418 cancelado sai de «Em curso» para «Cancelados», e não para «Ninguém aceitou»", () => {
    expect(resumoDaOferta([neg({})]).fase).toBe("atribuida");
    expect(resumoDaOferta([neg({})], "cancelado").fase).toBe("cancelada");
    // Já com as negociações encerradas, continua a dizer porquê.
    expect(resumoDaOferta([neg({ estado: "morta" })], "arquivado").fase).toBe("cancelada");
    expect(resumoDaOferta([neg({ estado: "morta" })]).fase).toBe("sem_ninguem");
  });

  it("o que já foi feito continua no seu sítio", () => {
    expect(resumoDaOferta([neg({ execucaoEnviadaEm: dia })], "arquivado").fase).toBe("por_confirmar");
    expect(resumoDaOferta([neg({ execucaoEnviadaEm: dia, confirmadoEm: dia })], "arquivado").fase).toBe(
      "confirmada",
    );
  });

  it("a rota passa o estado do pedido, e o painel tem o separador", () => {
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain(
      "resumo: resumoDaOferta(negociacoes, o.estadoDoPedido),",
    );
    const P = ler("src/components/admin/AdminTrabalhosClyonPanel.tsx");
    expect(P).toContain('id: "cancelados",');
    expect(P).toContain('fases: ["cancelada"],');
  });
});
