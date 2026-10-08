import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O CARTÃO «GERAL» DA MESA — 08-10-2026.
 *
 * *«Crie o botão "GERAL" e que venha por padrão em aberto, ele deve ficar em
 * primeiro, organize os botões e deixe-os com dimensões iguais.»*
 *
 * Só se vê no ecrã, por isso lê-se a fonte: o «Geral» é o primeiro cartão,
 * está escolhido quando não há bloco escolhido (o estado de partida), e os
 * cartões vivem numa grelha que lhes dá a todos o mesmo tamanho.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");

// A fila dos cartões: da grelha até ao fim do `.map` dos blocos.
const inicio = PAINEL.indexOf("grid-cols-[repeat(auto-fit,");
const FILA = PAINEL.slice(inicio, PAINEL.indexOf("        })}\n      </div>", inicio));

describe("o «Geral»", () => {
  it("vem antes dos cartões dos blocos", () => {
    expect(inicio).toBeGreaterThan(-1);
    const geral = FILA.indexOf("<p className={TITULO_DO_FILTRO}>Geral</p>");
    expect(geral).toBeGreaterThan(-1);
    expect(geral).toBeLessThan(FILA.indexOf("blocosDoModo.map((b) =>"));
  });

  it("vem escolhido por omissão: é o estado sem bloco escolhido, e é com ele que a mesa abre", () => {
    expect(FILA).toContain("aria-pressed={soOBloco === null}");
    expect(FILA).toContain("className={classeDoFiltro(soOBloco === null, false)}");
    expect(FILA).toContain("onClick={() => escolherBloco(null)}");
    expect(PAINEL).toContain("const [soOBloco, setSoOBloco] = useState<ChaveDoBloco | null>(null);");
  });

  it("conta o que os blocos deste modo contam, e nada mais", () => {
    expect(FILA).toContain("{blocosDoModo.reduce((soma, b) => soma + quantosNoBloco(b.chave), 0)}");
  });
});

describe("todos do mesmo tamanho", () => {
  it("uma grelha de colunas iguais e linhas iguais", () => {
    expect(PAINEL).toContain(
      '<div className="mb-6 mt-5 grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">',
    );
  });

  it("o «Geral» e os blocos usam o mesmo desenho, e o número fica em baixo", () => {
    expect(FILA).toContain("className={classeDoFiltro(escolhido, alarme)}");
    expect(PAINEL).toMatch(/function classeDoFiltro\(escolhido: boolean, alarme: boolean\): string \{\n\s+return `flex h-full flex-col justify-between/);
  });

  it("o «por ver» dos Concluídos vai ao lado do número, e não numa linha a mais", () => {
    expect(FILA).toMatch(
      /<span className=\{`text-xl font-bold \$\{b\.corDoNumero\}`\}>\{n\}<\/span>\n\s+\{b\.chave === "concluidos" && concluidosPorVer > 0 && \(\n\s+<span /,
    );
  });
});
