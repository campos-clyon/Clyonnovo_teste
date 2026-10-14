import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rascunhoParaGuardar, rascunhoValido, VALIDADE_DO_RASCUNHO_HORAS } from "./rascunho-do-simulador";
import { concluidosNaTerra, type TrabalhoConcluido } from "./trabalhos-recentes";

/*
 * O RASCUNHO DO SIMULADOR E OS TRABALHOS DE CADA TERRA — 14-10-2026
 * (auditoria de SEO, 30 dias).
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const AGORA = new Date("2026-10-14T12:00:00Z");

describe("o rascunho do simulador", () => {
  it("guarda o que a pessoa escreveu, sem as fotografias, e conta quantas eram", () => {
    const r = rascunhoParaGuardar(
      { precisaFatura: false, serviceType: "recolha_moveis", description: "Um sofá", files: [{}, {}] },
      "Rua X, Lisboa",
      AGORA,
    )!;
    expect(r.dados).toEqual({ precisaFatura: false, serviceType: "recolha_moveis", description: "Um sofá" });
    expect(r.fotos).toBe(2);
    expect(r.morada).toBe("Rua X, Lisboa");
  });

  it("não guarda um formulário em branco — o «não» do NIF vem de origem", () => {
    expect(rascunhoParaGuardar({ precisaFatura: false }, "", AGORA)).toBeNull();
    expect(rascunhoParaGuardar({ precisaFatura: false, receiver: { name: "" } }, " ", AGORA)).toBeNull();
  });

  it("vale três dias, e um estragado não vale nada", () => {
    const guardado = JSON.stringify(rascunhoParaGuardar({ serviceType: "mudanca" }, "", AGORA));
    const depois = (h: number) => new Date(AGORA.getTime() + h * 3600 * 1000);
    expect(rascunhoValido(guardado, depois(VALIDADE_DO_RASCUNHO_HORAS - 1))).not.toBeNull();
    expect(rascunhoValido(guardado, depois(VALIDADE_DO_RASCUNHO_HORAS + 1))).toBeNull();
    expect(rascunhoValido("{não é json", AGORA)).toBeNull();
    expect(rascunhoValido(null, AGORA)).toBeNull();
  });

  it("volta ao abrir, e apaga-se ao enviar", () => {
    const S = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(S).not.toContain("// Sempre limpar localStorage ao montar (F5 reseta o formulário)");
    expect(S).toContain("rascunhoValido<FormState>(localStorage.getItem(DRAFT_KEY), new Date())");
    expect(S).toMatch(/setSuccessOrderId\(resultado\.id\);[\s\S]{0,200}localStorage\.removeItem\(DRAFT_KEY\)/);
    expect(S).toContain("Recuperámos o que tinha começado a preencher.");
  });

  it("e o envio não espera pela análise mais de 12 segundos", () => {
    const S = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(S).toContain("setTimeout(() => limiteDaAnalise.abort(), 12_000)");
    expect(S).toContain("signal: limiteDaAnalise.signal,");
  });
});

describe("os trabalhos concluídos de cada terra", () => {
  const t = (cidade: string, servico = "recolha_moveis"): TrabalhoConcluido => ({ cidade, servico, quando: AGORA });

  it("contam os da terra, mesmo com a freguesia ou o concelho ao lado", () => {
    const lista = [t("Amora"), t("Amora, Seixal"), t("Seixal"), t("2845-513"), t("Lisboa")];
    expect(concluidosNaTerra(lista, "Amora")).toHaveLength(2);
    expect(concluidosNaTerra(lista, "Seixal")).toHaveLength(2);
    expect(concluidosNaTerra(lista, "Setúbal")).toHaveLength(0);
  });

  it("sem nomes, sem moradas, sem preços — e sem contas de teste", () => {
    const L = ler("src/lib/trabalhos-recentes.ts");
    expect(L).toContain("AND COALESCE(c.deTeste, 0) = 0");
    expect(L).toContain("!eContaDeTeste(");
    const C = ler("src/components/TrabalhosConcluidosNaTerra.tsx");
    expect(C).not.toMatch(/contactName|address|preco|valor/i);
    expect(ler("src/app/[...slug]/page.tsx")).toContain("<TrabalhosConcluidosNaTerra terra={city.name} />");
  });
});
