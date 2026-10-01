import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «Quero que esse botão de enviar também dê a opção de escolher
 * individualmente as empresas/pros.» — 29-09-2026.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const LIB = semComentarios(ler("src/lib/distribuir-pedido.ts"));
const ROTA = semComentarios(ler("src/app/api/admin/negociacoes/promover/route.ts"));
const ALCANCE = semComentarios(ler("src/app/api/admin/negociacoes/alcance/route.ts"));
const PAINEL = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

describe("escolher a quem vai o pedido", () => {
  it("com lista, vai só aos escolhidos — e a regra não os filtra", () => {
    // Com UMA excepção desde 01-10-2026: num pedido em dinheiro, quem tem
    // dívida à CLYON em atraso não entra nem escolhido à mão («abater no saldo
    // + bloquear», decisão do dono) — a rota da proposta não o deixaria propor.
    expect(LIB).toContain(
      "if (soPara ? soPara.includes(c.profissional.id) && !bloqueado : r.elegivel) elegiveis.push(c);",
    );
    expect(LIB).toContain('const bloqueado = r.motivos.includes("divida_em_atraso");');
  });

  it("os escolhidos continuam a sair dos activos e aprovados", () => {
    // Um suspenso não recebe nada, escolhido ou não. Pelos activos COM a
    // dívida em atraso de cada um (01-10-2026).
    const i = LIB.indexOf("export async function distribuirPedido(");
    expect(LIB.slice(i, i + 1500)).toContain("await activosComDividas(forma)");
    const j = LIB.indexOf("async function activosComDividas(");
    expect(j).toBeGreaterThan(-1);
    expect(LIB.slice(j, j + 600)).toContain("await profissionaisActivos()");
  });

  it("o histórico não diz «fora do raio» a quem só não foi escolhido", () => {
    expect(LIB).toContain("nao_escolhido: candidatos.filter((c) => !soPara.includes(c.id)).length,");
    // E o escolhido que ficou de fora pela dívida diz-se com esse nome (01-10-2026).
    expect(LIB).toContain("divida_em_atraso: candidatos.filter(");
  });

  it("a rota recusa uma lista vazia em vez de promover para ninguém", () => {
    expect(ROTA).toContain("Escolha pelo menos um profissional.");
    expect(ROTA).toContain("{ soPara }");
  });

  it("a lista mostra todos os activos, com o porquê de cada um", () => {
    expect(ALCANCE).toContain("todos: r.todos");
    expect(PAINEL).toContain("<EscolherProfissionais");
    expect(PAINEL).toContain("body: JSON.stringify({ pedidoId, valor, profissionais })");
  });
});
