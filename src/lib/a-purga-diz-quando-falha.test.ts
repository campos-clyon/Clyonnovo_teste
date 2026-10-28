import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cabecaDasFalhas, contactosAMeioEmPalavras, passoSecundario, resumoComAsFalhas } from "./passos-da-purga";

/**
 * A PURGA DIZ QUANDO UM PASSO FALHA — 27-10-2026 (decisão d7).
 *
 * Os passos secundários devolviam zero quando rebentavam, e o resumo da noite
 * dizia «nada apagado». Agora a falha vai à cabeça do resumo.
 */

describe("um passo que rebenta", () => {
  it("devolve o vazio, mas fica escrito com o nome e o motivo", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const falhas: string[] = [];
    const n = await passoSecundario(
      "contactos a meio",
      async () => {
        throw new Error("ER_LOCK_WAIT_TIMEOUT");
      },
      0,
      falhas,
    );
    expect(n).toBe(0);
    expect(falhas).toEqual(["contactos a meio: ER_LOCK_WAIT_TIMEOUT"]);
  });

  it("um passo que corre bem não deixa rasto", async () => {
    const falhas: string[] = [];
    expect(await passoSecundario("arquivo", async () => 3, 0, falhas)).toBe(3);
    expect(falhas).toEqual([]);
  });

  it("a falha vai à CABEÇA do resumo — nunca «nada apagado» sozinho", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const falhas: string[] = [];
    await passoSecundario("recolhas do WhatsApp", async () => Promise.reject(new Error("tabela partida")), null, falhas);
    const resumo = resumoComAsFalhas(falhas, "Purga correu: 0 elegíveis, nada apagado");
    expect(resumo.startsWith("ATENÇÃO — 1 passo(s) da purga falharam esta noite (recolhas do WhatsApp: tabela partida)")).toBe(true);
    expect(cabecaDasFalhas([])).toBe("");
  });

  it("os contactos a meio entram no resumo quando há algum", () => {
    expect(contactosAMeioEmPalavras(0, true, 30)).toBe("");
    expect(contactosAMeioEmPalavras(4, true, 30)).toContain("4 apagado(s)");
    expect(contactosAMeioEmPalavras(4, false, 30)).toContain("4 sairiam");
  });
});

describe("a rota da purga usa-os", () => {
  const rota = readFileSync(join(process.cwd(), "src/app/api/cron/purgar-pedidos/route.ts"), "utf8").replace(/\r\n/g, "\n");

  // Seis desde 28-10-2026 (d9): os erros da app aos 30 dias.
  it("os seis passos secundários correm por passoSecundario, e nenhum por .catch que devolve zero", () => {
    for (const nome of [
      "recolhas do WhatsApp",
      "fotografias pendentes do WhatsApp",
      "contactos a meio",
      "arquivo dos apagados",
      "eventos por apagar da agenda",
      "erros da app",
    ]) {
      expect(rota).toContain(`"${nome}",`);
    }
    expect(rota.match(/await passoSecundario\(/g)?.length).toBe(6);
    expect(rota).not.toMatch(/\.catch\(\(e\) => \{\s*console\.error\("\[cron\/purgar-pedidos\][^"]*"[^}]*return 0;/);
  });

  it("as regras novas que falham também contam, e o resumo leva as falhas à cabeça", () => {
    expect(rota).toContain("passosQueFalharam.push(`regras novas:");
    expect(rota).toContain("resumo: resumoComAsFalhas(passosQueFalharam,");
    expect(rota).toContain("passosQueFalharam.length === 0 &&");
    expect(rota).toContain("contactosEmPalavras +");
  });
});
