import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «PORQUE NÃO SALVA?» — 19-10-2026.
 *
 * O dono, com sete PATCH a 400 na consola ao carregar em «Guardar
 * alterações». A rota dizia porquê, mas a frase ia para o topo do painel,
 * fora de vista de quem está no fim do editor. Agora diz-se ao lado do botão,
 * e a rota deixa nos registos o campo que travou.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const PAINEL = ler("src/components/admin/AdminProfissionaisPanel.tsx");
const ROTA = ler("src/app/api/admin/profissionais/[id]/route.ts");

describe("o editor do profissional diz porque não gravou", () => {
  it("guarda a resposta da rota e mostra o motivo logo antes do botão", () => {
    expect(PAINEL).toContain("const r = await onGuardar({");
    expect(PAINEL).toContain("if (!r.ok) setErroAoGuardar(r.erro);");
    const motivo = PAINEL.indexOf("Não gravou: {erroAoGuardar}");
    const botao = PAINEL.indexOf("Guardar alterações", motivo);
    expect(motivo).toBeGreaterThan(-1);
    // O motivo vem antes do botão, no mesmo editor — e não no topo do painel.
    expect(botao - motivo).toBeGreaterThan(0);
    expect(botao - motivo).toBeLessThan(2500);
  });

  it("a rota regista o campo que travou, nos dados e no perfil", () => {
    expect(ROTA).toContain("recusado nos dados: ${validacao.erros.map((e) => e.campo).join(\", \")}");
    expect(ROTA).toContain("recusado no perfil: ${validacao.erros.map((e) => e.campo).join(\", \")}");
  });

  it("a fatura sem NIF grava com aviso no backoffice, e não com 400", () => {
    expect(ROTA).not.toContain('{ error: "Para emitir fatura é preciso o NIF." }, { status: 400 }');
    expect(ROTA).toContain("faturaSemNif = true;");
    expect(ROTA).toContain("Fica marcado «Emite fatura», mas sem NIF");
    expect(PAINEL).toContain('if (typeof dados.aviso === "string") setAviso(dados.aviso);');
  });
});
