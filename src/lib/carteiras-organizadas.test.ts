import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { descritivoDaTransferencia, MAXIMO_DO_DESCRITIVO } from "./descritivo-da-transferencia";

/**
 * AS CARTEIRAS, ORGANIZADAS.
 *
 * *«Corrija e organize essa tela também, está tudo muito confuso e misturado,
 * não consigo ver de qual trabalho se trata os valores, deve ter mais
 * informações.»* — 01-10-2026.
 *
 * O que se transferia por cada trabalho estava numa linha cinzenta de onze
 * píxeis, «Acordado 190,00 € · ele recebe 178,60 €», com o botão «Já paguei»
 * do outro lado do ecrã. O total do cartão não aparecia como soma de nada.
 * Passou a ser uma tabela: o trabalho e o cliente, as datas, o valor do
 * trabalho, a taxa, o que se transfere — e o total no fundo.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** Sem os comentários que começam a linha — os `/*` dentro de strings ficam. */
function semNotas(s: string): string {
  return s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
}

const ROTA = semNotas(ler("src/app/api/admin/carteiras/route.ts"));
const PAINEL = semNotas(ler("src/components/admin/AdminCarteirasPanel.tsx"));

describe("o descritivo da transferência diz que trabalhos ela paga", () => {
  it("os números dos pedidos, um a um", () => {
    expect(descritivoDaTransferencia([361, 358, 330, 314, 393])).toBe("CLYON pedidos 361 358 330 314 393");
  });

  it("e nunca passa do que o banco aceita", () => {
    const muitos = Array.from({ length: 60 }, (_, i) => 1000 + i);
    const d = descritivoDaTransferencia(muitos);
    expect(d.length).toBeLessThanOrEqual(MAXIMO_DO_DESCRITIVO);
    /* Diz quantos são, e não corta a lista a meio em silêncio. */
    expect(d).toContain("60 trabalhos");
    expect(d).toContain("1000");
    expect(d).toContain("1059");
  });

  it("sem pedidos, não inventa nenhum", () => {
    expect(descritivoDaTransferencia([])).toBe("CLYON");
  });

  it("e está à mão no cartão de quem se vai pagar", () => {
    expect(PAINEL).toContain("Copiar descritivo");
    expect(PAINEL).toContain("descritivoDaTransferencia(c.porPagar.map((t) => t.pedidoId))");
  });
});

describe("cada trabalho traz a sua conta, e as suas datas", () => {
  it("a rota manda o que já lia e guardava para si", () => {
    for (const campo of ["feitoEm:", "clientePagaSemIva:", "taxaDescontada:", "forma:"]) {
      expect(ROTA, campo).toContain(campo);
    }
    expect(ROTA).toContain("precoParaOCliente(acordado, taxas)");
  });

  it("a taxa vem calculada ao cêntimo no servidor, e não subtraída no ecrã", () => {
    /*
     * 190 − 178,6 em vírgula flutuante dá 11,400000000000006. Feita no ecrã,
     * a subtracção aparecia assim numa linha de dinheiro.
     */
    expect(ROTA).toContain("taxaDescontada: Math.round((acordado - recebe) * 100) / 100");
    expect(PAINEL).not.toMatch(/valorAcordado\s*-\s*t\.recebe/);
  });

  it("a linha mostra as datas, o valor, a taxa e o que se transfere", () => {
    expect(PAINEL).toContain("Feito {diaCurto(t.feitoEm)}");
    expect(PAINEL).toContain("Confirmado {diaCurto(t.confirmadoEm)}");
    expect(PAINEL).toContain("à espera há {espera}");
    expect(PAINEL).toContain("cliente pagou {euros(t.clientePagaSemIva)}");
    expect(PAINEL).toContain("−{euros(t.taxaDescontada)}");
  });

  it("e um trabalho pago em dinheiro diz que não há nada a transferir", () => {
    expect(PAINEL).toContain("em dinheiro — nada a transferir");
  });
});

describe("é uma tabela, e o total é a soma do que está à vista", () => {
  it("com cabeçalho e colunas iguais em todas as linhas", () => {
    for (const coluna of ["Trabalho e cliente", "Datas", "Valor do trabalho", "Taxa CLYON", "A transferir"]) {
      expect(PAINEL, coluna).toContain(coluna);
    }
    expect(PAINEL).toContain("const COLUNAS =");
  });

  it("o total soma as linhas — não é lido de outro sítio", () => {
    /*
     * Se o número do fundo viesse do servidor, podia bater com o do cartão e não
     * com as linhas que se vêem por cima. Somado aqui, ou bate com o que está à
     * vista, ou vê-se que não bate.
     */
    expect(PAINEL).toContain("const totalRecebe = somar(lista.map((t) => t.recebe));");
  });

  it("os dois montes do cartão usam a MESMA tabela", () => {
    expect(PAINEL).toContain("<TabelaDeTrabalhos lista={c.porPagar} nome={c.nome} pagavel />");
    expect(PAINEL).toContain("<TabelaDeTrabalhos lista={c.porFinalizar} nome={c.nome} pagavel={false} />");
  });

  it("e o que ainda não se transfere diz isso, e não «a decorrer»", () => {
    /*
     * «A DECORRER · 5 TRABALHOS · 1945,80 €» por baixo de «1522,80 € por
     * transferir» eram dois totais lado a lado sem dizer qual era qual.
     */
    expect(PAINEL).toContain("Ainda não se transfere");
  });
});

/*
 * Havia aqui um teste a proibir `bg-cyan-*` neste painel: a regra
 * `[class*="bg-cyan-50"]` do globals.css casava com «bg-cyan-500» e pintava o
 * texto dos botões de azul-petróleo por cima do ciano. A regra foi corrigida no
 * mesmo dia (6f2b62e) e tem o seu próprio teste, `globals-ciano.test.ts`. O
 * hexadecimal que o painel usa ficou — é a mesma cor e não faz mal.
 */
describe("⚠️ e cabe no telemóvel", () => {
  it("o IBAN parte em vez de sair do cartão no telemóvel", () => {
    expect(PAINEL).toContain("min-w-0 flex-1 break-all font-mono");
    expect(PAINEL).toContain("mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2");
  });
});
