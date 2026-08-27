import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O link do cliente, e como saber que morreu.
 *
 * "Continua a dar erro."
 *
 * E dava. Fui à base comparar o token que ele mandou à D. Sónia com o que lá
 * estava: não coincidia, e nenhum pedido tinha aquele resumo. O histórico do
 * #234 conta o resto — três gerações no mesmo dia (10:29, 10:34, 11:02) — e o
 * que ele copiou às 13:07 era anterior à última.
 *
 * O problema de fundo é o desenho: o texto do link não se recupera da base, só
 * o resumo criptográfico. O ecrã guarda-o em memória depois de o gerar, e a
 * partir daí não tem como saber que alguém o substituiu — por outro separador,
 * por um aviso de proposta, por um clique de há duas horas.
 *
 * A VALIDADE RESOLVE-O COM EXACTIDÃO. Cada token novo põe uma data nova (agora
 * mais trinta dias), por isso duas datas diferentes são dois tokens
 * diferentes. Guardando a data ao lado do texto, o ecrã compara-a com a da
 * base a cada actualização e sabe, sem margem, se o que tem na mão ainda abre.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PAINEL = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
const ROTA = ler("src/app/api/admin/negociacoes/reenviar/route.ts");
const DB = ler("src/lib/db.ts");

describe("a marca de versão", () => {
  it("a validade viaja da base até ao ecrã", () => {
    expect(DB).toContain("o.acessoTokenExpiraEm,");
    expect(DB).toContain("linkExpiraEm: (p.acessoTokenExpiraEm as Date) ?? null,");
    expect(PAINEL).toContain("linkExpiraEm: string | null;");
  });

  it("a rota devolve-a com o token, nos dois caminhos", () => {
    // Sem ela, o ecrã tinha o texto e nenhuma forma de o datar.
    expect((ROTA.match(/expiraEm: acesso\.expiraEm/g) ?? []).length).toBe(2);
  });

  it("o ecrã guarda-a ao lado do texto", () => {
    expect(PAINEL).toContain("const [versaoDoLink, setVersaoDoLink] = useState<Record<string, string>>({});");
    expect(PAINEL).toContain("setVersaoDoLink((v) => ({ ...v, [chave]: String(dados.expiraEm) }));");
  });
});

describe("um link substituído deixa de se poder copiar", () => {
  it("a caixa some e o aviso aparece quando as datas divergem", () => {
    expect(PAINEL).toContain("String(p.linkExpiraEm) !== versaoDoLink[chaveCliente]");
    expect(PAINEL).toContain("Este link já não serve — foi substituído entretanto.");
  });

  it("e diz o que fazer a seguir, que é a parte útil", () => {
    // Um aviso que não diz o remédio deixa a pessoa exactamente onde estava.
    expect(PAINEL).toContain("Link para o cliente");
    expect(PAINEL).toContain("mande o novo");
  });

  it("sem versão guardada, a caixa continua a aparecer", () => {
    /*
     * Um link gerado antes desta mudança não tem data ao lado. Escondê-lo
     * seria tratar «não sei» como «está morto» — e o mais provável é estar
     * vivo. Degrada para o comportamento antigo em vez de esconder o que
     * pode servir.
     */
    expect(PAINEL).toContain("!versaoDoLink[chaveCliente] ||");
    expect(PAINEL).toContain("!p.linkExpiraEm ||");
  });
});

describe("o que roda o token, e porquê", () => {
  it("um aviso de proposta a quem NÃO tem conta gera link novo", () => {
    // É legítimo: sem token não há como lhe mostrar a proposta. Mas mata o
    // anterior, e era por isso que o ecrã tinha de saber datá-lo.
    const AVISAR = ler("src/lib/avisar-da-proposta.ts");
    expect(AVISAR).toContain("substituirTokenDoPedido(dados.pedidoId, novo.hash, novo.expiraEm)");
  });

  it("quem não tem email nenhum não roda nada — vai por WhatsApp", () => {
    const AVISAR = semComentarios(ler("src/lib/avisar-da-proposta.ts"));
    const i = AVISAR.indexOf("if (!email) {");
    const bloco = AVISAR.slice(i, AVISAR.indexOf("return;", i));
    expect(bloco).toContain("propostaParaOWhatsApp");
    expect(bloco).not.toContain("substituirTokenDoPedido");
  });
});
