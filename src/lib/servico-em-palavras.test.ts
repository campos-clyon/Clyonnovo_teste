import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  oSeuServico,
  servicoEmPalavras,
  CATEGORIAS_COM_PALAVRAS,
  CATEGORIAS_DO_PRODUTO,
} from "./servico-em-palavras";

/**
 * «PARA A SUA OUTRO SERVIÇO».
 *
 * Saiu assim para uma cliente, a 13-09-2026:
 *
 *   Manuel Martins transportes propõe 148,57 € para a sua outro serviço
 *   (pedido #311).
 *
 * O artigo estava escrito à mão no molde da frase, e a etiqueta vinha de uma
 * lista onde três das dez são masculinas. Os avisos automáticos repetiam o
 * mesmo molde em sete mensagens — uma delas com o particípio também preso ao
 * feminino, «deu a sua esvaziamento de casa por feita».
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a frase vem feita, e não há concordância para errar", () => {
  it("as três masculinas que partiam a frase", () => {
    expect(oSeuServico("outro")).toBe("o seu pedido");
    expect(oSeuServico("esvaziamento_casa")).toBe("o seu esvaziamento de casa");
    expect(oSeuServico("esvaziamento_apartamento")).toBe("o seu esvaziamento de apartamento");
  });

  it("as femininas continuam femininas", () => {
    expect(oSeuServico("recolha_entulho")).toBe("a sua recolha de entulho");
    expect(oSeuServico("mudanca")).toBe("a sua mudança");
    expect(oSeuServico("montagem_moveis")).toBe("a sua montagem de móveis");
  });

  it("sem tipo, ou com um que ainda não existe, não se arrisca um artigo", () => {
    expect(oSeuServico(null)).toBe("o seu pedido");
    expect(oSeuServico("")).toBe("o seu pedido");
    expect(oSeuServico("servico_que_ainda_nao_existe")).toBe("o seu pedido");
  });

  /*
   * A frase entra na mensagem tal e qual — por isso tem de começar sempre
   * por um possessivo, e nunca por um nome nu que obrigue quem chama a
   * escrever o artigo outra vez. Foi essa a raiz do defeito.
   */
  it("nenhuma resposta obriga quem chama a pôr um artigo à frente", () => {
    for (const id of CATEGORIAS_DO_PRODUTO) {
      expect(oSeuServico(id)).toMatch(/^(a sua|o seu) /);
    }
  });
});

describe("a lista está completa, e é um teste que o garante", () => {
  /*
   * Havia uma segunda lista escrita à mão em `mensagem-whatsapp.ts`, já
   * dessincronizada: faltava-lhe `montagem_moveis`. Quem pedisse montagem via
   * o identificador da base a sair pela frente — «montagem moveis», sem
   * acento e com o traço baixo trocado por um espaço.
   */
  it("toda a categoria que o produto oferece sabe dizer-se em palavras", () => {
    const faltam = CATEGORIAS_DO_PRODUTO.filter((id) => !CATEGORIAS_COM_PALAVRAS.includes(id));
    expect(faltam).toEqual([]);
  });

  it("e não sobra nenhuma que o produto já não ofereça", () => {
    const sobram = CATEGORIAS_COM_PALAVRAS.filter((id) => !CATEGORIAS_DO_PRODUTO.includes(id));
    expect(sobram).toEqual([]);
  });

  it("o identificador da base nunca chega ao cliente numa categoria real", () => {
    for (const id of CATEGORIAS_DO_PRODUTO) {
      expect(servicoEmPalavras(id)).not.toContain("_");
      expect(oSeuServico(id)).not.toContain("_");
    }
  });
});

describe("a lista vive num sítio só", () => {
  it("mensagem-whatsapp.ts deixou de ter a sua cópia", () => {
    const M = ler("src/lib/mensagem-whatsapp.ts");
    expect(M).toContain("servicoEmPalavras");
    expect(M).not.toContain('recolha_monos:            "recolha de monos"');
  });

  it("o cérebro do WhatsApp já não escreve o artigo à mão", () => {
    const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");
    expect(CEREBRO).toContain("const servico = oSeuServico(dados.servico);");
    expect(CEREBRO).not.toContain("a sua ${servico.toLowerCase()}");
  });

  it("os avisos automáticos também não", () => {
    const AVISOS = ler("src/lib/assistente-automatico.ts");
    expect(AVISOS).toContain("const servico = oSeuServico(p.serviceType);");
    // O particípio que estava preso ao feminino.
    expect(AVISOS).not.toContain("por feita e mandou as fotografias");
    // E o aviso interno à equipa continua a falar sem possessivo.
    expect(AVISOS).toContain("const servicoNu = servicoEmPalavras(p.serviceType);");
  });
});
