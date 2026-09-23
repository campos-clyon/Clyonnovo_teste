import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A PONTE PODE MORRER. CALAR-SE É QUE NÃO.
 *
 * 23-09-2026. A ponte emparelhou, trabalhou quatro minutos, e calou-se. Depois
 * outra vez, e outra. Sem erro, sem reinício, com o Railway a dizer `Active`,
 * e o painel do site a dizer «a ponte não vem há 1 h» sem ninguém saber de
 * quê. Nesse tempo todo o assistente continuou a escrever, e tudo ficou na
 * fila: seis mensagens que saíram no dia seguinte, duas delas a dizer «Boa
 * noite» ao meio-dia.
 *
 * A causa mais provável é uma definição do Railway — o *App Sleeping* —, e
 * essa não se corrige com código. O que se corrige é a ponte ser capaz de se
 * calar sem ninguém dar por isso. Passou a ter quatro defesas, e é o que este
 * ficheiro guarda.
 *
 * TESTA-SE POR TEXTO porque `index.js` é um processo com um Chromium dentro,
 * que corre noutra máquina e não é importável daqui. É pouco, e é mais do que
 * nenhum: cada uma destas linhas foi escrita por causa de uma avaria que já
 * aconteceu, e uma delas a desaparecer é essa avaria a poder voltar.
 */

const PONTE = readFileSync(join(process.cwd(), "ponte-whatsapp/index.js"), "utf8").replace(
  /\r\n/g,
  "\n",
);
/** Sem os comentários: o que eles CONTAM não pode fazer um teste passar. */
const CODIGO = PONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("as quatro defesas", () => {
  it("1. nenhum pedido ao site fica pendurado para sempre", () => {
    /*
     * O `fetch` não traz prazo nenhum. Um pedido que não responda deixava a
     * ronda a meio, e a tranca da ronda só se levanta no fim: todas as
     * seguintes desistiam em silêncio.
     */
    expect(CODIGO).toContain("signal: AbortSignal.timeout(PRAZO_DO_PEDIDO_MS)");
    expect(CODIGO).toMatch(/const PRAZO_DO_PEDIDO_MS = [\d_]+;/);
  });

  it("2. a tranca da ronda tem saída", () => {
    expect(CODIGO).toContain("if (presaHa < TRANCA_PRESA_MS) return;");
    expect(CODIGO).toContain("a soltar a tranca");
  });

  it("3. o relógio de guarda mata um processo que se cale", () => {
    expect(CODIGO).toContain("process.exit(1)");
    expect(CODIGO).toMatch(/const SEM_PULSO_MS = [\d *_]+;/);
    // E olha para as DUAS formas de se calar: sem falar com o site, e com um
    // envio preso no Chromium. A segunda foi a que a revisão apanhou: quebrar
    // a tranca fazia o site voltar a ser carimbado enquanto nada saía.
    expect(CODIGO).toContain("despachoPreso");
    expect(CODIGO).toContain("calada < SEM_PULSO_MS && despachoPreso < SEM_PULSO_MS");
  });

  it("4. há uma porta para lhe perguntar o estado", () => {
    expect(CODIGO).toContain("http\n  .createServer");
    expect(CODIGO).toContain(".listen(PORTA");
    expect(CODIGO).toContain("segundosDesdeAUltimaRonda");
  });
});

describe("e o que as defesas não podem fazer", () => {
  it("o pulso conta-se a partir do emparelhamento, e não do arranque", () => {
    /*
     * Se o contador nascesse com o processo, um emparelhamento demorado — e
     * este contentor já levou doze minutos a abrir o Chromium — punha a ponte
     * a nascer com dez minutos de atraso. O guarda matava-a no primeiro tique
     * depois de ela ligar, e outra vez, e outra vez.
     */
    expect(CODIGO).toContain("let ultimaRondaBoa = 0;");
    const ready = CODIGO.slice(CODIGO.indexOf('client.on("ready"'));
    expect(ready.slice(0, 200)).toContain("ultimaRondaBoa = Date.now();");
  });

  it("a porta do estado não pode matar a ponte", () => {
    /*
     * Um `EADDRINUSE` num servidor de diagnóstico não apanhado é o processo
     * a morrer. Um servidor que mata o que devia diagnosticar é a pior troca
     * possível.
     */
    expect(CODIGO).toContain('.on("error"');
    expect(CODIGO).toContain("sigo sem ela");
  });

  it("a raiz responde sempre 200, e é o /pronto que julga", () => {
    /*
     * São duas perguntas diferentes. O Railway usa a raiz para saber se o
     * contentor subiu, e durante o arranque esta ponte não está pronta e
     * demora um minuto ou mais. Um 503 aí é um deploy dado por falhado a meio
     * de um arranque que ia bem.
     */
    expect(CODIGO).toContain('startsWith("/pronto")');
    expect(CODIGO).toContain("julga && !corpo.ok ? 503 : 200");
  });

  it("o guarda espera muito mais do que uma paragem do site", () => {
    /*
     * Dez minutos, e não dois. Quando o site está em baixo a ronda falha ALTO
     * de cinco em cinco segundos e quem olha para os registos vê-o; o que o
     * guarda apanha é o silêncio. Um guarda impaciente põe o contentor a
     * reiniciar em ciclo, e cada volta paga o arranque do Chromium outra vez.
     */
    const m = CODIGO.match(/const SEM_PULSO_MS = ([\d *_]+);/);
    expect(m).not.toBeNull();
    const ms = Number(eval(m![1].replace(/_/g, ""))); // eslint-disable-line no-eval
    expect(ms).toBeGreaterThanOrEqual(5 * 60_000);
  });
});

describe("a imagem declara a porta", () => {
  it("o Dockerfile diz em que porta é que ela fala", () => {
    const DOCKER = readFileSync(join(process.cwd(), "ponte-whatsapp/Dockerfile"), "utf8");
    expect(DOCKER).toContain("EXPOSE 8080");
  });
});
