import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O FIM DO «RESPONDA SIM».
 *
 * "O bot ainda usa palavras engessadas para se comunicar, deveria ser mais
 * inteligente. Não deve usar sim ou não nem caracteres especiais, apenas
 * frases e textos — o Gemini deve entender o contexto." — 12-09-2026, a olhar
 * para isto:
 *
 *   TRSul propõe 300,00 € para o seu pedido #301 (recolha_moveis).
 *   300,00 € é sem IVA. Total a pagar: 315,00 €, já com o imposto e a taxa CLYON.
 *   Só paga depois de o trabalho estar feito e confirmado.
 *
 *   Para contrapropor, responda só com o valor (ex.: 300).
 *
 *   Para «Fechar 300 €», responda SIM.
 *   Para «Recusar», responda NÃO.
 *
 * Três coisas erradas na mesma mensagem: ensina o cliente a falar por
 * palavras-chave, mostra-lhe o identificador da base («recolha_moveis», com
 * traço baixo), e usa aspas que ninguém escreve num telemóvel.
 *
 * A raiz era do outro lado: a resposta lia-se com expressões regulares presas
 * à letra — `^(sim|fechar|aceito|aceitar|pode fechar)$`. Quem escrevesse «pode
 * ser, fechamos por esse valor» não era entendido, e por isso a mensagem TINHA
 * de ensinar a dizer SIM.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const NEGOCIACAO = ler("src/lib/whatsapp-negociacao.ts");
const COMPREENSAO = ler("src/lib/whatsapp-compreensao.ts");
const CLOUD = ler("src/lib/whatsapp-cloud.ts");

/**
 * Sem os comentários.
 *
 * O comentário que explica a remoção CITA a frase removida — «antes
 * acrescentava-se: responda SIM» — e tem direito a fazê-lo. Lido em cru, este
 * teste chumbava por causa da explicação do próprio remendo.
 */
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("a mensagem deixou de ensinar palavras-chave", () => {
  it("não manda responder SIM nem NÃO em lado nenhum", () => {
    expect(semNotas(CLOUD)).not.toContain("responda SIM");
    expect(semNotas(CLOUD)).not.toContain("responda NÃO");
    expect(semNotas(NEGOCIACAO)).not.toContain("responda só com o valor");
  });

  it("convida a escrever à vontade", () => {
    expect(NEGOCIACAO).toContain("Diga-me se lhe serve, ou responda com o valor que gostaria de pagar.");
  });

  it("o serviço vai em palavras, e não com o traço baixo da base", () => {
    // Saía «(recolha_moveis)» — linguagem de motor à frente de quem não a
    // devia ver.
    expect(NEGOCIACAO).toContain("ETIQUETA_DO_SERVICO[dados.servico]");
    expect(NEGOCIACAO).not.toContain("${dados.servico ? ` (${dados.servico})` : \"\"}");
  });

  it("pela ponte vai o texto como foi escrito, sem manual de instruções", () => {
    // A partir de `enviarBotoesWhatsApp`: o ficheiro tem outros
    // `ponteConfigurada()` acima, e um recorte a partir do primeiro apanhava
    // o bloco errado.
    const i = CLOUD.indexOf("export async function enviarBotoesWhatsApp(");
    const bloco = CLOUD.slice(i);
    expect(bloco).toContain("const degradado = texto;");
    // E à mão, pela mesma razão, vai só o texto para a fila.
    expect(bloco).toContain("return porNaFila(para, texto);");
  });
});

describe("o Gemini lê a frase e a máquina continua a decidir", () => {
  it("traduz para a linguagem que as expressões regulares já falam", () => {
    /*
     * A ideia toda. Em vez de ensinar o cliente a falar por palavras-chave,
     * lê-se o que ele escreveu e reescreve-se na forma que o código de baixo
     * já sabe ler. Assim nada abaixo muda e todas as guardas ficam de pé.
     */
    expect(NEGOCIACAO).toContain("async function traduzirParaAMaquina(");
    expect(NEGOCIACAO).toContain(
      "const texto = await traduzirParaAMaquina(conteudo.texto.trim(), pedidos);",
    );
    expect(NEGOCIACAO).toContain('if (lido.accao === "fechar") return valor != null ? `sim ${valor}` : "sim";');
  });

  it("o pior caso é o comportamento de ontem — devolve o original", () => {
    const i = NEGOCIACAO.indexOf("async function traduzirParaAMaquina(");
    const corpo = NEGOCIACAO.slice(i, NEGOCIACAO.indexOf("async function alvosAccionaveis", i));
    // Sem chave, sem texto, ou já legível: nem se tenta.
    expect(corpo).toContain("if (!compreensaoDisponivel() || !original || jaSeLe(original)) return original;");
    // Modelo falhou ou não percebeu: segue o que ele escreveu.
    expect(corpo).toContain("if (!lido) return original;");
    expect(corpo).toContain(".catch(() => null)");
  });

  it("um «sim» ou um valor sozinho não gasta uma chamada", () => {
    // 18 segundos de espera para ler a palavra «sim» seria pagar caro por
    // nada — e do outro lado está uma pessoa a olhar para o WhatsApp.
    expect(NEGOCIACAO).toContain("function jaSeLe(");
    const i = NEGOCIACAO.indexOf("function jaSeLe(");
    const corpo = NEGOCIACAO.slice(i, NEGOCIACAO.indexOf("async function traduzirParaAMaquina", i));
    expect(corpo).toContain("sim|fechar|aceito|aceitar|pode fechar|nao|recusar");
  });

  it("o nome também escolhe a proposta certa", () => {
    // «Aceito o do Manuel» não traz valor, e com duas na mesa um «sim» sozinho
    // fecharia a errada.
    expect(NEGOCIACAO).toContain("const porNome =");
    expect(NEGOCIACAO).toContain("a.profissionalNome.toLowerCase().includes(lido.profissional!.toLowerCase())");
  });
});

describe("o que o modelo pode dizer, e o que nunca inventa", () => {
  it("na dúvida é «nada» — e «nada» não fecha negócio nenhum", () => {
    /*
     * Fechar por engano custa dinheiro a duas pessoas; não perceber custa uma
     * mensagem a mais. A regra está escrita no aviso, e o «nada» devolve o
     * texto original — que cai no ponto de situação.
     */
    expect(COMPREENSAO).toContain("NA DÚVIDA É ISTO");
    expect(COMPREENSAO).toContain("Fechar um negócio por engano custa dinheiro a duas pessoas");
  });

  it("um valor fora de escala não passa", () => {
    // Um engano de leitura não pode virar uma proposta de cem mil euros.
    expect(COMPREENSAO).toContain("n != null && n > 0 && n < 100_000 ? n : null");
  });

  it("uma acção que não se reconhece deita a leitura fora inteira", () => {
    expect(COMPREENSAO).toContain("if (!(accoes as string[]).includes(a)) return null;");
  });

  it("a canalização do Gemini está num sítio só", () => {
    // Três perguntas diferentes ao modelo, uma só chamada escrita: o modelo,
    // o tempo de espera, e o que se regista quando falha.
    expect(COMPREENSAO).toContain("async function pedirJson(");
    const chamadas = COMPREENSAO.split("model.generateContent(").length - 1;
    expect(chamadas).toBe(1);
  });
});
