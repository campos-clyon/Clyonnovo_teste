import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ACEITAR NA LISTA, SEM ABRIR O PEDIDO — 02-10-2026.
 *
 * *«Coloque a opção para mim aceitar no admin.»* — «Aceitar na lista». O botão
 * já existia dentro do pedido aberto; passa a estar também no cartão de cada
 * pedido à espera de resposta, um por profissional.
 *
 * ⚠️ Este ficheiro lê o código: o painel abre atrás de uma sessão.
 */

const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const PAINEL = semNotas(
  readFileSync(join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"), "utf8"),
);
const BOTAO = PAINEL.slice(
  PAINEL.indexOf("function AceitarNaLista("),
  PAINEL.indexOf("function RespostaDaClyon("),
);

describe("o botão", () => {
  it("vai pelo mesmo caminho do «Responder como CLYON» — em nome do cliente", () => {
    expect(BOTAO).toContain('fetch("/api/admin/negociacoes/agir"');
    expect(BOTAO).toContain('accao: contratar ? "contratar" : "aceitar"');
  });

  it("só sobre uma proposta do profissional, pendente e dentro do prazo", () => {
    expect(BOTAO).toContain(
      'x.estado === "pendente" && x.por === "profissional" && !expirou(x, agora)',
    );
    expect(BOTAO).toContain("if (!contratar && !pendente) return null;");
  });

  it("pergunta antes — fecha as outras negociações do pedido", () => {
    expect(BOTAO).toContain("window.confirm(");
    expect(BOTAO).toContain("as outras negociações deste pedido fecham");
  });
});

describe("no cartão", () => {
  it("aparece quando a bola está do nosso lado, um por profissional", () => {
    expect(PAINEL).toContain("{espera && !cancelado && !concluido && !feito && (");
    expect(PAINEL).toMatch(/aEsperarLista\.map\(\(n\) => \(\s*<AceitarNaLista/);
  });
});
