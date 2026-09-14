import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TITULO_DO_BOTAO_MAX } from "./lingua-do-cliente";

/**
 * O BOT FALA A LÍNGUA DE QUEM ESCREVE.
 *
 * "O bot devia adaptar a língua do cliente, ele está a ignorar que o cliente
 * não sabe português." — 14-09-2026, sobre a conversa do Heath: pediu o
 * esvaziamento de um T2 em inglês, avisou na primeira linha que não fala
 * português, e levou a recolha inteira em português na mesma.
 *
 * Estes testes guardam as LIGAÇÕES — a parte que nenhum teste de função pura
 * apanha e onde o próximo engano vai acontecer.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CLOUD = ler("src/lib/whatsapp-cloud.ts");
const DB = ler("src/lib/db.ts");
const PURO = ler("src/lib/lingua-do-cliente.ts");
const TRADUTOR = ler("src/lib/traduzir-para-o-cliente.ts");

describe("traduz-se num sítio só — o último", () => {
  it("no canal de saída, por onde passa tudo o que o cliente lê", () => {
    /*
     * São trinta e cinco sítios a escrever para o cliente. Traduzir na
     * composição obrigava a lembrar-se em todos — e a mensagem nova que
     * alguém acrescentasse na semana seguinte nascia em português outra vez.
     */
    const i = CLOUD.indexOf("async function enviarTextoPorCanal(");
    expect(i).toBeGreaterThan(-1);
    expect(CLOUD.slice(i, i + 400)).toContain("naLinguaDoCliente(");
  });

  it("os botões também — corpo e títulos", () => {
    const i = CLOUD.indexOf("export async function enviarBotoesWhatsApp(");
    const corpo = CLOUD.slice(i, i + 900);
    expect(corpo).toContain("naLinguaDoCliente(para, texto)");
    expect(corpo).toContain("botoesNaLinguaDoCliente(para, botoesPT)");
  });

  it("o id do botão NUNCA se traduz", () => {
    /*
     * É o id que volta no webhook e diz o que a pessoa carregou ("ct:123" =
     * contratar a #123). Traduzi-lo partia a leitura da resposta — e partia-a
     * só para os estrangeiros, que é a avaria mais difícil de encontrar.
     */
    const i = CLOUD.indexOf("async function botoesNaLinguaDoCliente(");
    const corpo = CLOUD.slice(i, CLOUD.indexOf("async function enviarTextoPorCanal("));
    expect(corpo).toContain("id: b.id");
    expect(semNotas(corpo)).not.toContain("traduzirParaOCliente(b.id");
  });
});

describe("falhar é falar português, nunca é calar-se", () => {
  it("o tradutor devolve o original quando não há chave ou o modelo falha", () => {
    const i = TRADUTOR.indexOf("export async function traduzirParaOCliente(");
    const corpo = TRADUTOR.slice(i, TRADUTOR.indexOf("export async function traduzirTituloDeBotao("));
    expect(corpo).toContain("if (!traduzida) return texto;");
    expect(TRADUTOR).toContain("if (!apiKey) return null;");
  });

  it("o canal de saída apanha o erro e segue com o português", () => {
    const i = CLOUD.indexOf("async function naLinguaDoCliente(");
    const corpo = CLOUD.slice(i, CLOUD.indexOf("async function botoesNaLinguaDoCliente("));
    expect(corpo).toContain("catch");
    expect(corpo).toContain("return texto;");
  });

  it("ler a língua na base nunca impede a mensagem de sair", () => {
    const i = DB.indexOf("export async function linguaDoNumero(");
    const corpo = DB.slice(i, DB.indexOf("export async function guardarLinguaDoNumero("));
    expect(corpo).toContain("catch");
    expect(corpo).toContain("return null;");
  });

  it("e o tradutor tem tecto de tempo — ninguém espera por ele para sempre", () => {
    expect(TRADUTOR).toContain("const SEGUNDOS");
    expect(TRADUTOR).toContain("Promise.race");
  });
});

describe("a língua apanha-se onde tudo o que entra passa", () => {
  const registo = DB.slice(
    DB.indexOf("export async function registarMensagemWhatsApp("),
    DB.indexOf("export interface ConversaWhatsApp"),
  );

  it("no registo da mensagem, e não no webhook", () => {
    /*
     * O webhook é só o caminho da Meta. Pela ponte do Railway entra pelo lado,
     * e o primeiro cliente estrangeiro a entrar por lá levava português outra
     * vez — uma avaria que só aparece em metade dos clientes.
     */
    expect(registo).toContain("linguaAGuardar(texto)");
    expect(registo).toContain("guardarLinguaDoNumero(");
  });

  it("só conta o que ELES escrevem", () => {
    // O que sai é nosso e é sempre português. Contá-lo era ensinar o sistema
    // que toda a gente fala português.
    expect(registo).toContain('direccao === "in"');
  });

  it("e falhar a detectar não impede a mensagem de ficar registada", () => {
    expect(registo).toContain("catch(() => {})");
  });
});

describe("o português é o padrão, e mora na ausência", () => {
  it("só se guarda o que NÃO é português", () => {
    /*
     * Uma linha na base a dizer "pt" é uma linha que alguém um dia lê ao
     * contrário. A tabela tem o tamanho do problema — os estrangeiros — e não
     * o tamanho da lista de clientes.
     */
    expect(PURO).toContain("export function linguaAGuardar");
    expect(PURO).toContain("l !== PORTUGUES ? l : null");
  });

  it("voltar ao português é APAGAR a linha", () => {
    const i = DB.indexOf("export async function porLinguaDoNumero(");
    const corpo = DB.slice(i, i + 900);
    expect(corpo).toContain("DELETE FROM whatsappLinguas");
  });

  it("a detecção não muda de ideias a meio da conversa", () => {
    /*
     * Quem escreve em inglês manda «ok» e «sim» pelo meio, como toda a gente.
     * Com UPDATE, um «sim» devolvia a conversa ao português e a mensagem
     * seguinte voltava ao inglês — o assistente a mudar de língua de balão
     * para balão. INSERT IGNORE escreve uma vez e fica.
     */
    const i = DB.indexOf("export async function guardarLinguaDoNumero(");
    const corpo = DB.slice(i, DB.indexOf("export async function porLinguaDoNumero("));
    expect(corpo).toContain("INSERT IGNORE INTO whatsappLinguas");
    expect(semNotas(corpo)).not.toContain("ON DUPLICATE KEY UPDATE");
  });
});

describe("o que a API do WhatsApp não perdoa", () => {
  it("um título traduzido que não caiba fica em português", () => {
    /*
     * Vinte caracteres é limite da Meta, não nosso: um título maior faz a
     * mensagem INTEIRA ser recusada. Entre um botão em português que aparece e
     * um em inglês que rebenta tudo, fica o português — pelo número a pessoa
     * ainda percebe «Fechar 600 €», e de uma mensagem que não chega não
     * percebe nada.
     */
    expect(TITULO_DO_BOTAO_MAX).toBe(20);
    const i = TRADUTOR.indexOf("export async function traduzirTituloDeBotao(");
    const corpo = TRADUTOR.slice(i);
    expect(corpo).toContain("traduzido.length > TITULO_DO_BOTAO_MAX) return titulo");
  });
});

describe("a parte que decide fica longe da rede", () => {
  it("o `lingua-do-cliente` não importa nada", () => {
    /*
     * A decisão corre a cada mensagem que entra, dentro do registo na base.
     * Uma decisão que dependa de uma chamada é uma decisão que um dia não
     * acontece — e, pior, que atrasa a gravação da conversa.
     */
    expect(semNotas(PURO)).not.toContain("import ");
  });

  it("quem fala com o Gemini é outro ficheiro, e só à saída", () => {
    expect(TRADUTOR).toContain("@google/generative-ai");
    expect(semNotas(PURO)).not.toContain("generative");
  });
});
