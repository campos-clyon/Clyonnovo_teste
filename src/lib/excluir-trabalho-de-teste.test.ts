import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * EXCLUIR UM TRABALHO QUE NÃO ERA A SÉRIO.
 *
 * *«Esse trabalho 200 foi um teste, quero excluir.»* — 01-10-2026.
 *
 * O #200 aparecia nos Pagamentos como «por receber», sem cliente: o pedido já
 * tinha sido apagado e a negociação fechada ficou órfã. «Apagar pedido» recusa
 * um trabalho fechado e por confirmar, e esse é um guarda que não se desarma
 * por um botão qualquer.
 *
 * Este botão passa-o, e só porque troca a guarda por outra mais estreita:
 * nenhum dinheiro se moveu. É isso que aqui se guarda — que a verificação está
 * do lado da base, que vem ANTES de apagar, e que ninguém mais passa por cima
 * do guarda de dentro.
 *
 * ⚠️ ESTE FICHEIRO LÊ O CÓDIGO. Apagar precisa da base; o que se pode garantir
 * sem ela é a ordem e as condições.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const DB = semNotas(ler("src/lib/db.ts"));
const PAGAMENTOS = semNotas(ler("src/lib/pagamentos-na-base.ts"));
const ROTA = semNotas(ler("src/app/api/admin/pagamentos/excluir/route.ts"));
const PAINEL = semNotas(ler("src/components/admin/AdminPagamentosPanel.tsx"));

/** O corpo de uma função exportada, até à próxima. */
function corpoDe(fonte: string, nome: string): string {
  const i = fonte.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não encontrada`).toBeGreaterThan(-1);
  const fim = fonte.indexOf("\nexport ", i + 10);
  return fonte.slice(i, fim > -1 ? fim : undefined);
}

describe("a guarda é o dinheiro, verificada na base", () => {
  const EXCLUIR = corpoDe(DB, "excluirTrabalho");

  it("olha para as três pontas, em todas as negociações do pedido", () => {
    expect(EXCLUIR).toContain("WHERE n.pedidoId = ?");
    // A CLYON já pagou ao profissional.
    expect(EXCLUIR).toContain("n.pagoEm != null");
    // O cliente pagou, foi reembolsado, ou tem uma referência viva — nas contas
    // reais; as de teste não contam (01-10-2026, ver abaixo).
    expect(EXCLUIR).toContain("await pagamentosQuePrendem(idsReais)");
    // O livro não se reescreve: um movimento prende o trabalho.
    expect(EXCLUIR).toContain("SELECT COUNT(*) AS n FROM movimentosDaCarteira");
  });

  it("e recusa ANTES de apagar", () => {
    const recusa = EXCLUIR.indexOf("throw new TrabalhoComDinheiro(");
    const apaga = EXCLUIR.indexOf("await deleteSimulatorOrder(");
    expect(recusa).toBeGreaterThan(-1);
    expect(apaga).toBeGreaterThan(recusa);
    for (const verificacao of [
      "n.pagoEm != null",
      "pagamentosQuePrendem(idsReais)",
      "SELECT COUNT(*) AS n FROM movimentosDaCarteira",
    ]) {
      expect(EXCLUIR.indexOf(verificacao), verificacao).toBeLessThan(recusa);
    }
  });

  it("apaga pelo caminho de sempre — com arquivo e retrato no registo", () => {
    expect(EXCLUIR).toContain("motivo: contexto.motivo");
    expect(EXCLUIR).toContain("mesmoComTrabalhoEmCurso: true");
  });

  it("o que prende do lado dos pagamentos: pago, devolvido, ou uma referência ainda viva", () => {
    const PRENDEM = corpoDe(PAGAMENTOS, "pagamentosQuePrendem");
    expect(PRENDEM).toContain("negociacaoPaga IS NOT NULL");
    expect(PRENDEM).toContain("estado IN ('pago', 'reembolsado')");
    expect(PRENDEM).toContain("estado = 'pendente' AND (expiraEm IS NULL OR expiraEm > NOW())");
    // Ler, só: as tentativas antigas ficam como história do euPago.
    expect(PRENDEM).not.toMatch(/\b(DELETE|UPDATE)\b/);
  });
});

describe("ninguém mais desarma o guarda de dentro", () => {
  function fontes(dir: string, acc: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) fontes(caminho, acc);
      else if (/\.tsx?$/.test(nome) && !/\.test\./.test(nome)) acc.push(caminho);
    }
    return acc;
  }

  it("só excluirTrabalho passa `mesmoComTrabalhoEmCurso`", () => {
    const quem = fontes(join(process.cwd(), "src")).filter((f) =>
      /mesmoComTrabalhoEmCurso:\s*true/.test(semNotas(readFileSync(f, "utf8"))),
    );
    expect(quem.map((f) => f.replace(process.cwd(), "").split("\\").join("/"))).toEqual([
      "/src/lib/db.ts",
    ]);
    expect(DB.match(/mesmoComTrabalhoEmCurso:\s*true/g)).toHaveLength(1);
    expect(corpoDe(DB, "excluirTrabalho")).toContain("mesmoComTrabalhoEmCurso: true");
  });
});

describe("a rota", () => {
  it("só o administrador, e com motivo", () => {
    expect(ROTA).toContain("await requireAdminGeral(req)");
    expect(ROTA).not.toContain("requireAdmin(req)");
    expect(ROTA).toContain("motivo.length < 3");
  });

  it("a recusa por dinheiro diz porquê, com 409", () => {
    expect(ROTA).toMatch(/instanceof TrabalhoComDinheiro\)\s*\{\s*return NextResponse\.json\(\{ error: e\.message \}, \{ status: 409 \}\)/);
  });
});

describe("o ecrã", () => {
  const ECRA = PAINEL.slice(PAINEL.indexOf("function ExcluirTrabalho("));

  it("não mostra o botão onde já houve dinheiro — a não ser numa conta de teste", () => {
    expect(ECRA).toContain(
      "if (!t.contaDeTeste && (t.clientePagouEm || t.pagoEm || pagouAoProfissional(t))) {",
    );
    const semDinheiro = ECRA.indexOf("Não se exclui: neste trabalho já entrou ou saiu dinheiro.");
    const botao = ECRA.indexOf("Excluir este trabalho…");
    expect(semDinheiro).toBeGreaterThan(-1);
    expect(botao).toBeGreaterThan(semDinheiro);
  });

  it("pede motivo e confirmação, e chama a rota", () => {
    expect(ECRA).toContain("motivo.trim().length >= 3");
    expect(ECRA).toContain("window.confirm(");
    expect(ECRA).toContain("Não se desfaz");
    expect(PAINEL).toContain('agir(t, "/api/admin/pagamentos/excluir", { motivo })');
  });
});

/*
 * CONTAS DE TESTE, SEM RESTRIÇÃO, E VÁRIOS DE UMA VEZ — 01-10-2026.
 *
 * «O Fred é uma conta teste, não deve ser levada a sério; quero poder excluir
 * tudo sem restrição, posso marcar todos e excluir.» Só para contas de teste
 * — escolha do dono: nas reais, o dinheiro continua a proteger.
 */
describe("as contas de teste", () => {
  const EXCLUIR = corpoDe(DB, "excluirTrabalho");

  it("nascem a zero, e só o administrador as marca", () => {
    expect(DB).toContain(
      "ALTER TABLE providers ADD COLUMN contaDeTeste TINYINT(1) NOT NULL DEFAULT 0",
    );
    const ROTA_PRO = semNotas(ler("src/app/api/admin/profissionais/[id]/route.ts"));
    const i = ROTA_PRO.indexOf('if (typeof corpo.contaDeTeste === "boolean") {');
    expect(i).toBeGreaterThan(-1);
    expect(ROTA_PRO.slice(i, i + 300)).toContain('colab.papel !== "admin"');
  });

  it("o dinheiro só trava nas negociações de contas REAIS", () => {
    expect(EXCLUIR).toContain("COALESCE(p.contaDeTeste, 0) AS contaDeTeste");
    expect(EXCLUIR).toContain("for (const n of reais) {");
    expect(EXCLUIR).toContain("await pagamentosQuePrendem(idsReais)");
    expect(EXCLUIR).not.toContain("pagamentosQuePrendem(ids)");
  });

  it("depois de apagar, leva o livro e os recebimentos à mão — e deixa os do euPago", () => {
    const apaga = EXCLUIR.indexOf("await deleteSimulatorOrder(");
    const livro = EXCLUIR.indexOf("DELETE FROM movimentosDaCarteira WHERE negociacaoId IN");
    const recebidos = EXCLUIR.indexOf("DELETE FROM pagamentos");
    expect(livro).toBeGreaterThan(apaga);
    expect(recebidos).toBeGreaterThan(apaga);
    // Só os anotados à mão: os do euPago são dinheiro que passou mesmo.
    expect(EXCLUIR).toContain("AND metodo IN ('transferencia', 'numerario', 'ao_profissional')");
    // E só os das contas de teste.
    expect(EXCLUIR.slice(apaga)).toContain("if (deTeste.length > 0) {");
  });

  it("a rota exclui vários de uma vez, cada um por si, e diz quais ficaram", () => {
    expect(ROTA).toContain("Array.isArray(corpo.negociacaoIds)");
    expect(ROTA).toContain("ids.length > 50");
    expect(ROTA).toContain("recusados.push({ negociacaoId: id, motivo: e.message });");
    expect(ROTA).toContain("return NextResponse.json({ ok: true, apagados, recusados });");
  });

  it("o ecrã deixa marcar cada um, os de um grupo, ou os da lista toda", () => {
    expect(PAINEL).toContain("Marcar os {actual.linhas.length} desta lista");
    expect(PAINEL).toMatch(/marcar\(\s*sg\.linhas\.map\(\(t\) => t\.negociacaoId\),/);
    expect(PAINEL).toContain("onMarcar={(v) => marcar([t.negociacaoId], v)}");
    expect(PAINEL).toContain("Excluir marcados");
    expect(PAINEL).toContain("negociacaoIds: lista.map((t) => t.negociacaoId)");
  });
});
