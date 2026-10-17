import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «Finanças mostra notificações mas quando abro não vejo nada para olhar.» —
 * o dono, 17-10-2026.
 *
 * O selo das Finanças conta os trabalhos confirmados por transferir aos
 * profissionais desde a última vez (`contarNovidades`, «carteiras»). Essa
 * lista vive no separador «A pagar aos profissionais»; desde 14-10 as Finanças
 * abriam no Painel, onde ela não se vê. Agora, com novidades ao abrir, abre-se
 * esse separador, com o número nele e uma frase a dizer o que é.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MENU = ler("src/components/admin/LegacyAdminClient.tsx");
const GESTORA = ler("src/components/admin/financas/GestoraDeContas.tsx");

describe("o selo das Finanças leva à lista que conta", () => {
  it("o menu guarda o número antes de o apagar, e só ao mudar de secção", () => {
    const i = MENU.indexOf("const [novasAoAbrir, setNovasAoAbrir]");
    const efeito = MENU.slice(i, MENU.indexOf("}, [activeSection, token, marcarSeccaoVista", i));
    const guarda = efeito.indexOf("setNovasAoAbrir(");
    const apaga = efeito.indexOf("marcarSeccaoVista(activeSection)");
    expect(guarda).toBeGreaterThan(-1);
    expect(apaga).toBeGreaterThan(guarda);
    expect(efeito).toContain("seccaoJaContada.current !== activeSection");
    expect(MENU).toContain("<GestoraDeContas novasPorTransferir={novasAoAbrir.carteiras ?? 0} />");
  });

  it("com novidades, as Finanças abrem em «A pagar aos profissionais»", () => {
    expect(GESTORA).toContain('useState<Separador>(novasPorTransferir > 0 ? "profissionais" : "painel")');
    expect(GESTORA).toContain('if (novasPorTransferir > 0) setSeparador("profissionais");');
  });

  it("e dizem quantas são: no separador e numa frase por cima da lista", () => {
    expect(GESTORA).toContain('{s.id === "profissionais" && novasPorTransferir > 0 && (');
    expect(GESTORA).toContain("ficou por transferir ao profissional desde a última vez que abriu as Finanças");
  });

  it("sem novidades, abrem no Painel como sempre", () => {
    expect(GESTORA).toContain("export default function GestoraDeContas({ novasPorTransferir = 0 }");
  });
});
