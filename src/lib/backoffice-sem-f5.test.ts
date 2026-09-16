import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O backoffice deixa de precisar de F5.
 *
 * "sempre que quero ver as novidades tenho que ficar atualizando tudo, mas
 * isso não devia acontecer. Eu uso a Fixando às vezes e sempre que clico num
 * pedido ou chega algo para mim, ele mostra sem ter que atualizar tudo, como
 * no WhatsApp quando alguém envia mensagem." — 16-09-2026.
 *
 * Catorze dos dezasseis painéis não tinham ciclo nenhum: mostravam o que havia
 * quando foram abertos, e mais nada até alguém carregar em F5.
 *
 * ESTE TESTE É UMA CERCA. Não prende o intervalo nem o texto de nenhum painel
 * — prende a regra: um painel do backoffice que carregue dados actualiza-se
 * sozinho. Quem acrescentar o décimo sétimo painel descobre-o aqui, e não pelo
 * dono a queixar-se de que tem de actualizar tudo.
 */

const PASTA = join(process.cwd(), "src", "components", "admin");
const ler = (f: string) => readFileSync(join(PASTA, f), "utf8").replace(/\r\n/g, "\n");

/** Os painéis que vão buscar dados — os únicos a quem isto se aplica. */
const PAINEIS = readdirSync(PASTA)
  .filter((f) => /^Admin.*Panel\.tsx$/.test(f))
  .filter((f) => /const carregar = useCallback|const carregar = useCallback\(/.test(ler(f)));

describe("todos os painéis que carregam dados se actualizam sozinhos", () => {
  it("há painéis que chegue para valer a pena testar isto", () => {
    expect(PAINEIS.length).toBeGreaterThanOrEqual(12);
  });

  for (const f of PAINEIS) {
    it(`${f.replace("Admin", "").replace("Panel.tsx", "")} tem o ciclo`, () => {
      const fonte = ler(f);
      expect(fonte).toContain('from "@/components/admin/useAutoRefresh"');
      expect(fonte).toMatch(/useAutoRefresh\(\(\) => carregar\(true\)/);
    });

    it(`${f.replace("Admin", "").replace("Panel.tsx", "")}: o ciclo é silencioso`, () => {
      const fonte = ler(f);
      // Quem tem estado de carregamento tem de o saltar no ciclo automático:
      // senão o ecrã pisca de minuto a minuto e perde-se o que estava aberto.
      if (fonte.includes("setACarregar(true)")) {
        expect(fonte).toContain("if (!silencioso) setACarregar(true)");
      }
    });

    it(`${f.replace("Admin", "").replace("Panel.tsx", "")}: o botão Actualizar não passa o evento`, () => {
      /*
       * `onClick={carregar}` entrega o evento do clique como primeiro
       * argumento. Com o argumento `silencioso`, o evento é truthy — e o botão
       * fica mudo, sem estado de carregamento e sem erros.
       */
      expect(ler(f)).not.toContain("onClick={carregar}");
    });
  }
});
