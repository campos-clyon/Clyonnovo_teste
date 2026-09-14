import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ATRASOS_SUGERIDOS,
  ATRASO_MAXIMO,
  CHAVE_DO_ATRASO,
  SEM_ATRASO,
  atrasoGuardado,
  atrasoPorExtenso,
  canalRespeitaOAtraso,
  lerAtraso,
  podeSairA,
} from "./assistente-tempo-de-resposta";

/**
 * O TEMPO DE RESPOSTA DO ASSISTENTE.
 *
 * "Quero adicionar configurações para o assistente, a primeira será tempo de
 * resposta, onde posso mudar o tempo que ele levará para responder às
 * mensagens enviadas." — 14-09-2026.
 *
 * Hoje responde no instante em que a mensagem chega. Duas coisas más de uma
 * vez: lê-se como máquina, e não deixa ninguém chegar primeiro — quem está no
 * painel vê a mensagem e o assistente já respondeu por cima.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DB = ler("src/lib/db.ts");
const CLOUD = ler("src/lib/whatsapp-cloud.ts");
const ROTA = ler("src/app/api/admin/whatsapp/assistente/route.ts");
const PAINEL = ler("src/components/admin/AdminAssistenteAutoPanel.tsx");
const PURO = ler("src/lib/assistente-tempo-de-resposta.ts");

describe("nasce a zero, que é o que o sistema já fazia", () => {
  it("sem nada guardado, responde já", () => {
    /*
     * Uma configuração nova que mude o comportamento de produção no dia em que
     * nasce é uma configuração que ninguém pediu. Zero é exactamente o que
     * acontecia ontem.
     */
    expect(SEM_ATRASO).toBe(0);
    expect(atrasoGuardado(null)).toBe(0);
    expect(atrasoGuardado(undefined)).toBe(0);
    expect(atrasoPorExtenso(0)).toBe("imediata");
  });

  it("o zero também está entre as opções do painel", () => {
    // Voltar atrás tem de ser um clique, e não apagar uma linha na base.
    expect(ATRASOS_SUGERIDOS[0]).toBe(0);
  });
});

describe("o que se aceita do painel", () => {
  it("números e textos de números", () => {
    expect(lerAtraso(30)).toBe(30);
    expect(lerAtraso("30")).toBe(30);
    expect(lerAtraso(" 45 ")).toBe(45);
    expect(lerAtraso(0)).toBe(0);
    expect(lerAtraso(29.6)).toBe(30);
  });

  it("recusa o que não é número, em vez de arredondar para alguma coisa", () => {
    /*
     * NULL E NÃO UM PALPITE. Um campo mal preenchido que virasse dez minutos
     * calava o assistente durante dez minutos e ninguém ligava uma coisa à
     * outra.
     */
    for (const mau of ["", "  ", "depressa", null, undefined, {}, NaN, Infinity]) {
      expect(lerAtraso(mau)).toBeNull();
    }
  });

  it("recusa o negativo e o que passa do tecto", () => {
    expect(lerAtraso(-1)).toBeNull();
    expect(lerAtraso(ATRASO_MAXIMO + 1)).toBeNull();
    expect(lerAtraso(ATRASO_MAXIMO)).toBe(ATRASO_MAXIMO);
    // Dez minutos. Acima disto já não é tempo de resposta, é deixar a pessoa
    // pendurada — e quem escreve a uma empresa e não tem resposta vai a outra.
    expect(ATRASO_MAXIMO).toBe(600);
  });

  it("mas o que JÁ está na base nunca impede a resposta", () => {
    // Um valor estragado — escrito à mão, ou de uma versão antiga — cai no
    // zero. O assistente responde; não se cala à espera de quem o conserte.
    expect(atrasoGuardado("lixo")).toBe(0);
    expect(atrasoGuardado(-5)).toBe(0);
    expect(atrasoGuardado(99999)).toBe(0);
  });
});

describe("dito por extenso", () => {
  it("segundos, minutos, e o singular certo", () => {
    expect(atrasoPorExtenso(1)).toBe("1 segundo");
    expect(atrasoPorExtenso(15)).toBe("15 segundos");
    expect(atrasoPorExtenso(60)).toBe("1 minuto");
    expect(atrasoPorExtenso(120)).toBe("2 minutos");
    expect(atrasoPorExtenso(90)).toBe("1 min 30 s");
  });
});

describe("a hora a que a resposta pode sair", () => {
  it("é agora mais os segundos", () => {
    const agora = new Date("2026-09-14T12:00:00Z");
    expect(podeSairA(agora, 30).toISOString()).toBe("2026-09-14T12:00:30.000Z");
    expect(podeSairA(agora, 0).getTime()).toBe(agora.getTime());
  });
});

describe("onde o atraso acontece — e onde não acontece", () => {
  it("na FILA, que é de onde a ponte vem buscar", () => {
    /*
     * A ponte não recebe a resposta: vem BUSCÁ-LA, de poucos em poucos
     * segundos. Basta a linha não ser entregue antes da hora e o atraso
     * acontece sozinho — sem ninguém a dormir à espera e sem cron novo.
     */
    expect(DB).toContain("enviarApartirDe");
    expect(DB).toContain("(enviarApartirDe IS NULL OR enviarApartirDe <= NOW())");
  });

  it("a conta da hora é do MySQL, e não do Node", () => {
    // Dois relógios na mesma decisão dão segundos a mais ou a menos que
    // ninguém liga ao relógio.
    expect(DB).toContain("NOW() + INTERVAL ? SECOND");
  });

  it("as linhas antigas nascem NULL, e NULL quer dizer «pode sair já»", () => {
    /*
     * Se a coluna nascesse com NOW(), uma fila cheia no momento da migração
     * ficava toda com a data da migração — e o significado de cada linha
     * passava a depender do dia em que o código subiu.
     */
    expect(DB).toContain("ADD COLUMN enviarApartirDe DATETIME NULL DEFAULT NULL");
  });

  it("quem põe na fila vai buscar o atraso, e falha para zero", () => {
    const i = CLOUD.indexOf("async function porNaFila(");
    const corpo = CLOUD.slice(i, i + 1200);
    expect(corpo).toContain("atrasoDeRespostaDoAssistente()");
    expect(corpo).toContain(".catch(() => 0)");
  });

  it("pela API da Meta não se aplica — e o painel diz-o", () => {
    /*
     * Ali a mensagem sai direta e não passa pela fila. Um número no ecrã a
     * prometer um atraso que não acontece é pior do que não haver número.
     */
    expect(canalRespeitaOAtraso("ponte")).toBe(true);
    expect(canalRespeitaOAtraso("manual")).toBe(true);
    expect(canalRespeitaOAtraso("meta")).toBe(false);
    expect(canalRespeitaOAtraso("nenhum")).toBe(false);
    expect(ROTA).toContain("atrasoAplicaSe");
    expect(PAINEL).toContain("envia na hora e não passa pela fila");
  });
});

describe("guardar e ler", () => {
  it("a chave escreve-se uma vez, e é a mesma nos dois lados", () => {
    expect(CHAVE_DO_ATRASO).toBe("atrasoDeResposta");
    expect(ROTA).toContain("CHAVE_DO_ATRASO");
    expect(DB).toContain("CHAVE_DO_ATRASO");
  });

  it("a tabela é de chave e valor — porque «a primeira» quer dizer que vêm mais", () => {
    /*
     * Uma coluna por definição obrigava a uma migração por cada ideia. Os
     * interruptores ficam onde estão: são booleanos com tabela feita para
     * eles, e enfiá-los aqui como "sim"/"nao" era perder o tipo.
     */
    expect(DB).toContain("CREATE TABLE IF NOT EXISTS assistenteConfiguracoes");
    expect(DB).toContain("export async function definirConfiguracaoDoAssistente");
  });

  it("ler nunca rebenta — devolve a omissão", () => {
    const i = DB.indexOf("export async function atrasoDeRespostaDoAssistente(");
    const corpo = DB.slice(i, i + 900);
    expect(corpo).toContain("catch");
    expect(corpo).toContain("SEM_ATRASO");
  });

  it("mudar no painel vê-se já — a memória é apagada ao gravar", () => {
    // O atraso é lido a cada mensagem que sai, por isso fica guardado um
    // minuto. Sem isto, mexer no painel só se notava um minuto depois.
    const i = DB.indexOf("export async function definirConfiguracaoDoAssistente(");
    expect(DB.slice(i, i + 900)).toContain("atrasoLembrado = null");
  });

  it("o painel só recusa números fora do intervalo, com o número na frase", () => {
    expect(ROTA).toContain("lerAtraso(corpo.segundos)");
    expect(ROTA).toContain("${ATRASO_MAXIMO}");
  });
});

describe("a parte que decide não toca na base", () => {
  it("o módulo puro não importa nada", () => {
    /*
     * O painel é "use client". Se este ficheiro chegasse ao `db`, arrastava o
     * mysql2 para o browser e o `next build` caía — como já caiu com a conta
     * da sugestão.
     */
    expect(PAINEL).toContain('"use client"');
    expect(PAINEL).toContain('from "@/lib/assistente-tempo-de-resposta"');
    expect(semNotas(PURO)).not.toContain("import ");
  });
});
