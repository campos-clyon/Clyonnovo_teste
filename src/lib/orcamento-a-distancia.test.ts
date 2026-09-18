import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ORCAMENTOS_A_DISTANCIA, ORCAMENTO_A_DISTANCIA } from "./orcamento-a-distancia";
import {
  mensagemDasPropostas,
  propostasParaOCliente,
  trabalhoFechado,
} from "./mensagem-das-propostas";

/**
 * O CLIENTE SABE QUE O ORÇAMENTO É ONLINE — ANTES DE ACEITAR.
 *
 * "Temos que também dizer aos clientes, de forma simples, que esses orçamentos
 * são online, portanto carecem de confirmação de uma colega no local."
 * — 18-09-2026.
 *
 * Um profissional que propõe 280 € está a propô-los sobre uma descrição e umas
 * fotografias. À porta pode haver mais três sacos, um terceiro andar sem
 * elevador, ou um sofá que não passa pela escada — e aí o valor muda. É normal
 * no ramo; o que não é normal é o cliente descobri-lo no dia, depois de ter
 * aceite um número que leu como final.
 *
 * E o custo de não o dizer é NOSSO: quem se sente apanhado desconfia da
 * plataforma, não do profissional — foi no nosso link que ele carregou.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const proposta = (por: string, valor: number, estado = "pendente") =>
  JSON.stringify([{ por, valor, estado, criadaEm: "2026-09-17T10:00:00Z" }]);

describe("a frase", () => {
  it("cabe numa linha — é lida no telemóvel, na rua", () => {
    /*
     * "Os clientes estão a reclamar que recebem muitas informações e que ficam
     * confusos" — 17-09-2026. Um parágrafo a explicar o que é um orçamento à
     * distância não se lê; uma linha lê-se.
     */
    expect(ORCAMENTOS_A_DISTANCIA.length).toBeLessThanOrEqual(90);
    expect(ORCAMENTO_A_DISTANCIA.length).toBeLessThanOrEqual(90);
  });

  it("diz as duas coisas: que é online, e que se confirma no local", () => {
    for (const frase of [ORCAMENTOS_A_DISTANCIA, ORCAMENTO_A_DISTANCIA]) {
      expect(frase).toContain("online");
      expect(frase).toContain("no local");
    }
  });

  it("e não promete que é a CLYON que lá vai", () => {
    /*
     * Regra de voz do site, e de facto: a CLYON liga clientes a profissionais
     * independentes e não faz as recolhas. Quem confirma à porta é quem lá
     * está — dizer "a nossa equipa" seria vender um serviço que não é nosso.
     */
    for (const frase of [ORCAMENTOS_A_DISTANCIA, ORCAMENTO_A_DISTANCIA]) {
      expect(frase.toLowerCase()).not.toContain("clyon");
      expect(frase.toLowerCase()).not.toContain("nossa equipa");
    }
  });
});

describe("sai com os valores, em todos os sítios onde eles saem", () => {
  it("na lista de propostas do WhatsApp", () => {
    const m = mensagemDasPropostas({
      nomeCliente: "Marianela",
      servico: "recolha de monos",
      cidade: "Lisboa",
      propostas: propostasParaOCliente([
        { estado: "aberta", profissionalNome: "Nova Recolha", propostasJson: proposta("profissional", 250) },
        { estado: "aberta", profissionalNome: "Revolution", propostasJson: proposta("profissional", 350) },
      ]),
      link: "https://clyon.pt/pedido/abc",
    });
    expect(m).toContain(ORCAMENTOS_A_DISTANCIA);
  });

  it("e ANTES do link — o que vem depois do link não se lê", () => {
    // A mesma lição da linha do IVA. Numa mensagem de WhatsApp, o link é o
    // fim da leitura.
    const link = "https://clyon.pt/pedido/abc";
    const m = mensagemDasPropostas({
      servico: "recolha de monos",
      propostas: propostasParaOCliente([
        { estado: "aberta", profissionalNome: "Nova Recolha", propostasJson: proposta("profissional", 250) },
      ]),
      link,
    });
    expect(m.indexOf(ORCAMENTOS_A_DISTANCIA)).toBeLessThan(m.indexOf(link));
  });

  it("e na mensagem do trabalho já combinado — é aí que mais importa", () => {
    /*
     * Já está fechado e o que falta é o dia. Se o valor mudar à porta, é agora
     * que ele tem de saber que isso é possível.
     */
    const m = mensagemDasPropostas({
      propostas: [],
      fechado: trabalhoFechado([
        {
          estado: "acordada",
          profissionalNome: "Manuel Martins",
          propostasJson: proposta("cliente", 280, "aceite"),
        },
      ]),
      link: "https://clyon.pt/pedido/abc",
    });
    expect(m).toContain(ORCAMENTO_A_DISTANCIA);
  });

  it("nas duas notícias que o assistente manda sozinho", () => {
    // A proposta que chega, e o «ele aceitou o seu valor». São os dois momentos
    // em que um número aparece ao cliente sem ninguém o ter escrito à mão.
    const AVISOS = semComentarios(ler("src/lib/assistente-automatico.ts"));
    expect((AVISOS.match(/ORCAMENTO_A_DISTANCIA/g) ?? []).length).toBe(3);
  });

  it("e pelos dois caminhos — o imediato e o do cron", () => {
    /*
     * As mesmas duas notícias saem por dois sítios: o envio imediato, quando a
     * proposta é gravada, e a passagem que apanha as que esse falhou. Se a
     * frase entrasse só num deles, metade dos clientes nunca a lia — e seria
     * sempre a metade para onde ninguém está a olhar.
     */
    const CEREBRO = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));
    expect((CEREBRO.match(/ORCAMENTO_A_DISTANCIA/g) ?? []).length).toBe(3);
  });

  it("e no ecrã do pedido, por cima dos cartões", () => {
    /*
     * Quem decide, decide a olhar para os valores. Uma advertência que vem
     * depois da decisão não é uma advertência — é uma desculpa.
     */
    const ECRA = semComentarios(ler("src/app/pedido/[token]/PropostasRecebidas.tsx"));
    expect(ECRA).toContain("{ORCAMENTOS_A_DISTANCIA}");
    expect(ECRA).toContain("{ORCAMENTO_A_DISTANCIA}");
    expect(ECRA.indexOf("{ORCAMENTOS_A_DISTANCIA}")).toBeGreaterThan(
      ECRA.indexOf("profissionais responderam"),
    );
  });
});

describe("está escrita uma vez só", () => {
  it("ninguém a volta a escrever à mão", () => {
    // Seis cópias de uma frase são seis frases diferentes ao fim de um mês.
    for (const f of [
      "src/lib/mensagem-das-propostas.ts",
      "src/lib/assistente-automatico.ts",
      "src/lib/whatsapp-negociacao.ts",
      "src/app/pedido/[token]/PropostasRecebidas.tsx",
    ]) {
      expect(semComentarios(ler(f)), `${f} tem de importar a frase`).not.toContain(
        "confirmam-se no local antes de começar",
      );
    }
  });
});
