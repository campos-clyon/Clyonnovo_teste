import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A BARRA DE PROCURA DA MESA.
 *
 * "Crie uma barra de pesquisa para que eu possa pesquisar com número, nome ou
 * pedido. Até mesmo por morada ou região." — 13-09-2026.
 *
 * A regra de correspondência tem testes a sério em `procurar-pedido.test.ts`.
 * Este ficheiro guarda o que só se vê no ecrã: que ela existe, que os dados que
 * ela procura chegam mesmo do servidor, e que não promete mais do que faz.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const DB = ler("src/lib/db.ts");

describe("a caixa existe e diz o que procura", () => {
  it("o texto da caixa nomeia os quatro caminhos que ele pediu", () => {
    expect(PAINEL).toContain("Procurar por número, nome, telefone, morada ou região");
    expect(PAINEL).toContain('aria-label="Procurar em toda a mesa"');
  });

  it("filtra as duas listas da mesa, e não só uma", () => {
    // Os pedidos com negociações e os que ainda estão por enviar são duas
    // listas diferentes, vindas de duas rotas diferentes.
    expect(PAINEL).toContain("const pedidosNaMesa = useMemo(");
    expect(PAINEL).toContain("const porPromoverNaMesa = useMemo(");
    expect(PAINEL).toContain("pedidos={porPromoverNaMesa}");
  });

  it("diz quantos encontrou, em vez de encolher a lista em silêncio", () => {
    expect(PAINEL).toContain("const encontrados = pedidosNaMesa.length + porPromoverNaMesa.length;");
    expect(PAINEL).toContain("Nenhum pedido com isso");
  });
});

describe("procura mesmo em toda a mesa", () => {
  /*
   * Era esta a objecção escrita no código, e é ela que justifica as duas
   * regras abaixo: «pô-la no topo da mesa prometia procurar em toda a mesa».
   * Uma barra no topo que só olhasse para o bloco escolhido, ou que saltasse
   * os blocos fechados, dava «não encontrei» sobre um pedido que está ali.
   */
  it("enquanto se procura, o filtro dos cartões cala-se", () => {
    expect(PAINEL).toContain("soOBloco && !aProcurar ? blocosDoModo.filter((b) => b.chave === soOBloco) : blocosDoModo");
  });

  it("um bloco fechado abre-se quando tem resultados", () => {
    // «Concluídos» e «Cancelados» nascem fechados, e é lá que muitas vezes
    // está o pedido que se anda a procurar.
    expect(PAINEL).toContain("const fechado = aProcurar");
    expect(PAINEL).toContain("? quantosNoBloco(b.chave) === 0");
  });

  it("o vazio da mesa não se confunde com o vazio da procura", () => {
    expect(PAINEL).toContain("soOBloco === null && !aProcurar && mostrar !== \"clyon\" && pedidos.length === 0");
  });
});

describe("os dados que ela procura chegam mesmo à mesa", () => {
  /*
   * A busca pode ser perfeita e não encontrar nada se o campo não vier do
   * servidor. A morada e o código postal nunca tinham vindo, e o telemóvel só
   * vinha numa das duas listas.
   */
  it("a consulta dos pedidos com negociações traz morada e código postal", () => {
    const i = DB.indexOf("export async function pedidosComNegociacoes");
    const corpo = DB.slice(i, i + 14000);
    expect(corpo).toContain("o.address, o.postalCode");
    expect(corpo).toContain("address: (p.address as string) ?? null");
    expect(corpo).toContain("postalCode: (p.postalCode as string) ?? null");
  });

  it("a dos pedidos por enviar traz telemóvel, morada e código postal", () => {
    const i = DB.indexOf("export async function pedidosPorPromover");
    const corpo = DB.slice(i, i + 4000);
    expect(corpo).toContain("o.contactPhone, o.address, o.postalCode");
  });

  it("e o painel sabe que os tem", () => {
    expect(PAINEL).toContain("/** A morada e o código postal — o que a busca do topo procura. */");
    expect(PAINEL).toContain("combinaComABusca");
  });
});
