import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «Esse trabalho já foi concluído por outra empresa. Como é que o admin pode
 * marcar no painel para finalizar o pedido, e até editar a empresa?» —
 * 01-10-2026, sobre o #368: fechado com a Nova Recolha, feito por outra.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DB = semComentarios(ler("src/lib/db.ts"));
const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i).toBeGreaterThan(-1);
  return DB.slice(i, DB.indexOf("\nexport ", i + 10));
};

describe("trocar a empresa de um trabalho fechado", () => {
  const corpo = corpoDe("passarOTrabalhoAOutroProfissional");

  it("o negócio muda de mãos tal como estava — o cliente não vê outra conta", () => {
    expect(corpo).toContain("taxaCliente = ?, taxaProfissional = ?");
    expect(corpo).toContain("formaDePagamento = ?, acrescimoPagamento = ?, dataCombinada = ?");
    expect(corpo).toContain("antes.valorAcordado");
  });

  it("quem o tinha fica morta, e as duas mudanças vão juntas", () => {
    expect(corpo).toContain("UPDATE negociacoes SET estado = 'morta' WHERE id = ?");
    expect(corpo).toContain("beginTransaction()");
    expect(corpo).toContain("rollback()");
  });

  it("não se troca depois de confirmado ou pago — o dinheiro já tem dono", () => {
    expect(corpo).toContain("antes.confirmadoEm || antes.pagoEm");
  });

  it("as referências de pagamento acompanham o trabalho", () => {
    expect(corpo).toContain("UPDATE pagamentos SET negociacaoId = ?, providerId = ? WHERE negociacaoId = ?");
    expect(corpo).toContain("UPDATE pagamentos SET negociacaoPaga = ? WHERE negociacaoPaga = ?");
  });

  it("a rota é de admin e deixa escrito de quem para quem", () => {
    const ROTA = semComentarios(ler("src/app/api/admin/negociacoes/trocar-profissional/route.ts"));
    expect(ROTA).toContain("requireAdmin(req)");
    expect(ROTA).toContain("appendOrderHistory");
    expect(ROTA).toContain('acontecimento: "profissional_trocado"');
    expect(ler("src/lib/db.ts")).toContain('| "profissional_trocado"');
  });
});

describe("dar por feito sem a prova do profissional", () => {
  it("só escreve a entrega num trabalho fechado e ainda por entregar", () => {
    const corpo = corpoDe("darPorEntreguePelaClyon");
    expect(corpo).toContain("estado = 'acordada' AND execucaoEnviadaEm IS NULL");
  });

  it("a confirmação de sempre faz o resto — com as duas perguntas do pagamento", () => {
    const AGIR = semComentarios(ler("src/app/api/admin/negociacoes/agir/route.ts"));
    expect(AGIR).toContain("if (semProva) await darPorEntreguePelaClyon(negociacaoId, pedidoId);");
    expect(AGIR.indexOf("darPorEntreguePelaClyon(negociacaoId")).toBeLessThan(
      AGIR.indexOf("await confirmarExecucao(negociacaoId"),
    );
    expect(AGIR).toContain("sem a prova do profissional");
  });

  it("o painel mostra os dois botões só antes de confirmado", () => {
    const PAINEL = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
    expect(PAINEL).toContain("{!concluido && !acordada.confirmadoEm && (");
    expect(PAINEL).toContain("<TrocarProfissional");
    expect(PAINEL).toContain(
      "{!concluido && !acordada.execucaoEnviadaEm && clyonPodeConfirmar(p) && (",
    );
    expect(PAINEL).toContain('fetch("/api/admin/negociacoes/trocar-profissional"');
  });
});
