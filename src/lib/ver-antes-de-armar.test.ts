import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O REGISTO PERMANENTE ERA ESCRITO E NUNCA LIDO.
 *
 * "Também quero que garanta que os valores gerados pelos trabalhos concluídos
 * não sejam apagados" e, antes disso, "confere se está a ser criado um arquivo
 * com o histórico desses pedidos". Estava a ser criado. E havia TRÊS funções
 * para o consultar — `registoParaOBackoffice`, `registoDoCliente`,
 * `registoDoProfissional` — sem um único chamador em todo o repositório.
 *
 * Um histórico que ninguém consegue abrir é meio histórico: guarda-se «para um
 * processo judicial» e no dia do processo não há por onde lhe pegar.
 *
 * E era lá que a purga escrevia, todas as noites, o número de pedidos que
 * apagaria. Ou seja: a única coisa que era preciso ver ANTES de a armar era a
 * única que não se via.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROTA = ler("src/app/api/admin/retencao/route.ts");
const PAINEL = ler("src/components/admin/AdminRetencaoPanel.tsx");
const LEGACY = ler("src/components/admin/LegacyAdminClient.tsx");

describe("o registo passou a ter quem o leia", () => {
  it("a rota chama o leitor que existia e ninguém usava", () => {
    expect(ROTA).toContain("registoParaOBackoffice(");
    expect(ROTA).toContain('acontecimento: "pedido_expurgado"');
  });

  it("e está atrás da porta do backoffice", () => {
    expect(ROTA).toContain("requireAdmin(req)");
  });

  it("o ecrã aparece nas Configurações", () => {
    expect(LEGACY).toContain("<AdminRetencaoPanel />");
    expect(LEGACY).toContain("Retenção dos pedidos");
  });
});

describe("contar não é apagar", () => {
  /*
   * A rota corre a purga com `aSerio: false` — que conta e sai ANTES de tocar
   * em coisa alguma. Um ecrã que contasse a sério seria um botão de apagar sem
   * botão.
   */
  it("a contagem corre em modo seco, sempre", () => {
    expect(ROTA).toContain("aSerio: false");
  });

  it("e usa os dois prazos, como o cron", () => {
    expect(ROTA).toContain("DIAS_DE_RETENCAO_DOS_PEDIDOS");
    expect(ROTA).toContain("diasDosAbandonados: DIAS_PARA_OS_ABANDONADOS");
  });

  /*
   * NÃO HÁ BOTÃO DE ARMAR, E É DE PROPÓSITO. Arma-se numa variável de ambiente
   * com um redeploy pelo meio, e essa lentidão é a última coisa que separa uma
   * tarde má de uma base vazia.
   */
  it("não há forma de armar a purga a partir do ecrã", () => {
    expect(ROTA).not.toContain("export async function POST");
    expect(PAINEL).not.toContain("Armar");
    expect(PAINEL).not.toContain("method: \"POST\"");
  });
});

describe("o ecrã diz o que é preciso para decidir", () => {
  it("em que modo está, e como se muda", () => {
    expect(PAINEL).toContain("Modo seco — conta e não apaga nada");
    expect(PAINEL).toContain("A purga está");
    expect(PAINEL).toContain("PURGA_ARMADA=sim");
  });

  it("quantos, quantas fotografias, e o que fica para a noite seguinte", () => {
    expect(PAINEL).toContain("estado.elegiveis");
    expect(PAINEL).toContain("estado.fotografias");
    expect(PAINEL).toContain("estado.restantes");
  });

  /*
   * Os NÚMEROS dos pedidos, e não só a contagem: antes de armar uma coisa
   * irreversível, quem decide tem de poder abrir dois ou três e ver se são
   * mesmo o que pensa que são.
   */
  it("e quais são — para se poder ir ver um antes", () => {
    expect(ROTA).toContain("naMira: conta.naMira");
    expect(PAINEL).toContain("estado.naMira.map");
  });

  it("avisa que não tem volta", () => {
    expect(PAINEL).toContain("a purga não tem volta");
  });
});
