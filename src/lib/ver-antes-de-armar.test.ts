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
  it("a rota lê o registo — uma linha por noite, por páginas", () => {
    // Era `registoParaOBackoffice` com as últimas 20 linhas da purga, as de
    // cada pedido misturadas com os resumos. Desde 26-10-2026 (d32, G) é
    // `noitesDaPurga`: o resumo de cada noite (`pedido_expurgado` SEM
    // pedido), vinte de cada vez.
    expect(ROTA).toContain("noitesDaPurga(pagina, 20)");
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function noitesDaPurga(");
    expect(i).toBeGreaterThan(-1);
    expect(DB.slice(i, i + 1500)).toContain("acontecimento = 'pedido_expurgado' AND pedidoId IS NULL");
    expect(DB.slice(i, i + 1500)).toContain("OFFSET");
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
    /*
     * O ÚNICO POST DO ECRÃ É O INTERRUPTOR DAS REGRAS NOVAS (d32, 26-10-2026),
     * e esse não arma nada: escolhe que regras a purga segue QUANDO está
     * armada. A `PURGA_ARMADA` continua só na Vercel — a rota do interruptor
     * nem a menciona, e é só do administrador.
     */
    const posts = PAINEL.split('method: "POST"').length - 1;
    expect(posts).toBe(1);
    const i = PAINEL.indexOf('method: "POST"');
    expect(PAINEL.slice(Math.max(0, i - 200), i)).toContain('"/api/admin/retencao/interruptor"');
    const INTERRUPTOR = ler("src/app/api/admin/retencao/interruptor/route.ts");
    expect(INTERRUPTOR).toContain("requireAdminGeral(req)");
    expect(INTERRUPTOR).not.toContain("process.env");
    expect(INTERRUPTOR).not.toMatch(/PURGA_ARMADA\s*=/);
  });

  it("e o ensaio das regras novas nunca corre a sério a partir do ecrã", () => {
    const ENSAIO = ler("src/app/api/admin/retencao/ensaio/route.ts");
    expect(ENSAIO).toContain("regrasNovasDaNoite({ aSerio: false })");
    expect(ENSAIO).not.toContain("aSerio: true");
    expect(ENSAIO).not.toContain("export async function POST");
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
