import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d117 — A PERGUNTA DO NIF NÃO DÁ A ENTENDER QUE O PREÇO É FIXO (25-11-2026).
 * O dono, sobre «O preço é o mesmo com ou sem NIF»: «pode ser com IVA 23 %».
 * O preço depende do parceiro (com IVA a 23 % ou isento).
 */

import { PERGUNTA_DA_FATURA } from "./whatsapp-recolha";
import { passoDaPergunta } from "./reler-a-conversa";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { O_NIF_E_OPCIONAL_E_O_IVA_DEPENDE } from "./pagar-ao-parceiro";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem as linhas de comentário (as que começam por //, /* ou *): fica o que se diz a alguém. */
const semComentarios = (s: string) =>
  s
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(l))
    .join("\n");

describe("a pergunta nova, nas quatro línguas", () => {
  it("«Quer o seu NIF na fatura? Se sim, diga-me o número.»", () => {
    expect(PERGUNTA_DA_FATURA).toBe("Quer o seu NIF na fatura? Se sim, diga-me o número.");
    expect(traducaoFixa(PERGUNTA_DA_FATURA, "en")).toBe("Would you like your tax number (NIF) on the invoice? If so, just tell me the number.");
    expect(traducaoFixa(PERGUNTA_DA_FATURA, "fr")).not.toBeNull();
    expect(traducaoFixa(PERGUNTA_DA_FATURA, "es")).not.toBeNull();
    expect(traducaoFixa("Peço desculpa, não fui clara! Cada trabalho tem a sua fatura. Pergunto só: quer o seu NIF na fatura?", "en")).not.toBeNull();
  });

  it("o reconhecimento lê a nova e a antiga (há conversas a meio com a antiga)", () => {
    expect(passoDaPergunta(PERGUNTA_DA_FATURA)).toBe("fatura");
    expect(passoDaPergunta("O preço é o mesmo com ou sem NIF: quer o seu NIF na fatura?")).toBe("fatura");
  });

  it("o site diz que o NIF é opcional e que o IVA vem em cada proposta", () => {
    expect(O_NIF_E_OPCIONAL_E_O_IVA_DEPENDE).toBe("O NIF na fatura é opcional. O IVA vem em cada proposta: 23 % ou isento, conforme o parceiro.");
    for (const p of ["src/app/plataforma/pedir/components/ValoresEFaturacao.tsx", "src/app/simulador/SimulatorThreePhaseForm.tsx"]) {
      expect(ler(p), p).toContain("{O_NIF_E_OPCIONAL_E_O_IVA_DEPENDE}");
    }
  });
});

describe("«o mesmo com ou sem NIF» não volta a aparecer em nada que o cliente leia", () => {
  it("nem no código (fora dos comentários e dos testes), nem nas traduções fixas", () => {
    const ficheiros = execSync("git ls-files src", { encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.(tsx?|json)$/.test(f) && !/\.test\.tsx?$/.test(f));
    const PROIBIDO = /(o\s+mesmo,?\s+com\s+ou\s+sem\s+NIF|com\s+ou\s+sem\s+NIF,?\s+o\s+preço\s+é\s+o\s+mesmo|the same,? with or without|le même,? avec ou sans|el mismo,? con o sin)/i;
    const achados: string[] = [];
    for (const f of ficheiros) {
      let texto: string;
      try {
        texto = ler(f);
      } catch {
        continue;
      }
      const lido = f.endsWith(".json") ? texto : semComentarios(texto);
      lido.split("\n").forEach((l, i) => {
        if (PROIBIDO.test(l)) achados.push(`${f}:${i + 1}`);
      });
    }
    expect(achados).toEqual([]);
  });
});
