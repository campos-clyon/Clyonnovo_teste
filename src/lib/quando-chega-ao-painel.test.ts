import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A data tem de fazer o caminho todo: SQL → rota → tipo → ecrã.
 *
 * É a quinta vez nesta base que um campo se perde a meio do caminho — andar e
 * elevador, `valorDesejadoCliente`, `baseLat`/`baseLng`, `mbway` — e o sintoma
 * é sempre o mesmo: alguém preenche uma coisa, a coisa grava-se, e o ecrã do
 * outro lado jura que ela não existe. Nenhum compilador apanha isto, porque
 * cada elo está certo sozinho.
 *
 * `pedidoCriadoEm` é o zero de "amanhã". Sem ele, `quandoEOTrabalho` cai no
 * ramo de suposição e volta a ler a palavra do cliente contra hoje — que é
 * precisamente o defeito que ela existe para corrigir. Falharia em silêncio.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/profissionais/meus-pedidos/route.ts");
const TIPOS = ler("src/app/profissionais/painel/tipos.ts");
const PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");

describe("o caminho da data até ao painel do profissional", () => {
  it("a consulta traz o dia do pedido", () => {
    expect(DB).toContain("o.createdAt AS pedidoCriadoEm");
  });

  it("a consulta traz a data marcada", () => {
    expect(DB).toContain("o.dataAgendada");
  });

  it("a rota entrega as duas com o nome que o ecrã espera", () => {
    expect(ROTA).toContain("dataAgendada:");
    expect(ROTA).toContain("criadoEm:");
    expect(ROTA).toContain("pedidoCriadoEm");
  });

  it("o tipo declara-as", () => {
    expect(TIPOS).toContain("dataAgendada?: string | null;");
    expect(TIPOS).toContain("criadoEm?: string | null;");
  });

  it("o ecrã usa a função, e não volta a inventar a conta", () => {
    expect(PAINEL).toContain('import { quandoEOTrabalho } from "@/lib/quando-e-o-trabalho";');
    // Uma na lista, uma no detalhe.
    expect(PAINEL).toContain("const quando = quandoEOTrabalho(p);");
    expect(PAINEL).toContain("const quandoDoPedido = quandoEOTrabalho(pedido);");
  });

  it("a palavra crua deixou de ser desenhada no painel", () => {
    /*
     * `URGENCIA` traduzia "tomorrow" para "Amanhã" e mais nada — sem saber de
     * que dia falava. Enquanto estiver importada aqui, alguém volta a usá-la.
     */
    expect(PAINEL).not.toContain("URGENCIA[");
  });

  it("o detalhe mostra o dia, a hora e o que falta combinar", () => {
    expect(PAINEL).toContain("quandoDoPedido.dia");
    expect(PAINEL).toContain("quandoDoPedido.hora");
    expect(PAINEL).toContain("quandoDoPedido.aviso");
  });

  it("um dia que já passou vai a vermelho nos dois sítios", () => {
    // Sem cor, ele lê "26 de agosto" e não repara que é do mês passado.
    expect(PAINEL).toContain("quando.passou ?");
    expect(PAINEL).toContain("quandoDoPedido.passou ?");
  });
});

describe("os sinais do cartão", () => {
  it("o ⚡ passa pela mesma função, e não pela palavra", () => {
    const SINAIS = ler("src/lib/sinais-do-trabalho.ts");
    expect(SINAIS).toContain('import { quandoEOTrabalho } from "./quando-e-o-trabalho";');
    expect(SINAIS).toContain("const quando = quandoEOTrabalho(t);");
    // A lista de palavras urgentes deixou de existir: era ela que mentia.
    expect(SINAIS).not.toContain("URGENTES");
  });
});
