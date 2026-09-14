import { describe, it, expect } from "vitest";
import {
  LINGUAS,
  PORTUGUES,
  contarMarcas,
  linguaAGuardar,
  linguaEvidente,
  linguaValida,
  palavrasDe,
  precisaDeTraducao,
} from "./lingua-do-cliente";

/**
 * O BOT TEM DE FALAR A LÍNGUA DE QUEM ESCREVE.
 *
 * "O bot devia adaptar a língua do cliente, ele está a ignorar que o cliente
 * não sabe português." — 14-09-2026.
 *
 * As mensagens aqui em baixo são as do Heath, copiadas da conversa. Ele avisou
 * logo na primeira linha que não fala português, e levou a recolha inteira em
 * português na mesma.
 */

const HEATH_ABERTURA = `Hi! Apologies, my Portuguese is not very good so I am writing in English.

I would like to request a quote for a full apartment clearance of a 107 m² 2-bedroom (T2) apartment in São Marcos (Oeiras / Sintra border).

Timeline: The removal must be completed by September 21st.

Scope: Total clear-out of all household contents including furniture disassembly (adjustable beds, sofa, dining set), electronics, kitchenware, and general items.

Goal: The apartment needs to be left 100% empty for our landlord handover.

Do you also have cleaning?`;

const HEATH_PERGUNTAS = `Thanks!
Before confirming, could you please clarify three quick details:

Does the €600 quote include IVA (tax)?
Are you available to complete the job on Friday, September 18th?
Do you offer end-of-lease deep cleaning as an add-on, or is this quote strictly for item removal?`;

describe("a mensagem que deu origem a isto", () => {
  it("a abertura do Heath é inglês, e não fica na dúvida", () => {
    expect(linguaEvidente(HEATH_ABERTURA)).toBe("en");
  });

  it("as três perguntas dele também", () => {
    // Foi a estas que o bot respondeu com um resumo em português.
    expect(linguaEvidente(HEATH_PERGUNTAS)).toBe("en");
  });

  it("«São Marcos» no meio de uma frase inglesa não faz dela portuguesa", () => {
    /*
     * Os nomes de sítio portugueses aparecem em TODAS as conversas, venham na
     * língua que vierem — é um serviço em Portugal. Se um topónimo desse a
     * vitória ao português, nenhum estrangeiro seria detectado.
     */
    const [primeiro] = contarMarcas(HEATH_ABERTURA);
    expect(primeiro.lingua).toBe("en");
    const pt = contarMarcas(HEATH_ABERTURA).find((c) => c.lingua === "pt");
    expect(primeiro.pontos).toBeGreaterThan((pt?.pontos ?? 0) * 2);
  });
});

describe("o português continua a ser português", () => {
  const emPortugues = [
    "Boa tarde, preciso de esvaziar um T2 em Almada. O prédio não tem elevador.",
    "Olá! Queria saber quanto custa levar uns móveis de casa. Obrigado",
    "Bom dia. Tenho uma mudança para fazer, é no 3.º andar sem elevador.",
    "Sim, pode ser. A morada é na Rua das Flores, já agora também preciso de limpeza.",
  ];

  for (const t of emPortugues) {
    it(`«${t.slice(0, 42)}…» → pt`, () => {
      // Nunca pode devolver outra língua: escrever inglês a um português é o
      // erro caro, e o que não é evidente resolve-se a favor de casa.
      expect(linguaEvidente(t)).toBe(PORTUGUES);
      expect(linguaAGuardar(t)).toBeNull();
    });
  }
});

describe("o que é curto de mais não decide nada", () => {
  /*
   * NULL É A RESPOSTA CERTA AQUI, e é a mais frequente: metade do que entra
   * num WhatsApp é uma palavra. Basta que UMA mensagem da conversa seja clara
   * para a conversa ficar decidida; as outras não têm de adivinhar.
   */
  for (const t of ["ok", "SIM", "600", "", "   ", "👍", "Rua das Flores 5"]) {
    it(`«${t}» → null`, () => {
      expect(linguaEvidente(t)).toBeNull();
    });
  }
});

describe("as outras línguas da porta ao lado", () => {
  it("espanhol não é lido como português", () => {
    // É o par difícil: metade das palavras são quase iguais.
    expect(linguaEvidente("Hola, necesito vaciar un piso. ¿Cuánto cuesta? Gracias")).toBe("es");
  });

  it("francês idem", () => {
    expect(
      linguaEvidente("Bonjour, je voudrais un devis pour un appartement, merci. Avec ascenseur"),
    ).toBe("fr");
  });
});

describe("as regras de quem usa isto", () => {
  it("só se traduz o que não é português", () => {
    expect(precisaDeTraducao("en")).toBe(true);
    expect(precisaDeTraducao(PORTUGUES)).toBe(false);
    expect(precisaDeTraducao(null)).toBe(false);
    expect(precisaDeTraducao(undefined)).toBe(false);
  });

  it("guarda-se o que é evidente E não é português", () => {
    // O português é o padrão: uma linha na base a dizer "pt" é uma linha que
    // alguém um dia lê ao contrário.
    expect(linguaAGuardar(HEATH_ABERTURA)).toBe("en");
    expect(linguaAGuardar("Boa tarde, preciso de uma mudança, obrigado")).toBeNull();
    expect(linguaAGuardar("ok")).toBeNull();
  });

  it("só aceita as línguas que sabemos nomear", () => {
    expect(linguaValida("en")).toBe(true);
    expect(linguaValida("de")).toBe(false);
    expect(linguaValida("")).toBe(false);
    expect(linguaValida(null)).toBe(false);
  });
});

describe("as palavras, como o teclado as escreve", () => {
  it("tira acentos, apóstrofos e pontuação", () => {
    expect(palavrasDe("Não! É só isso…")).toEqual(["nao", "e", "so", "isso"]);
    expect(palavrasDe("I'm here")).toEqual(["im", "here"]);
    // O apóstrofo curvo que o telemóvel escreve sozinho conta como o direito.
    expect(palavrasDe("I’m here")).toEqual(["im", "here"]);
  });

  it("uma palavra que existe em duas listas não pontua para nenhuma", () => {
    /*
     * «Casa» é português e espanhol, «esta» também. Se pontuassem, ganhavam
     * por um voto e mandavam escrever na língua errada — que é o pior fim
     * possível para um desempate.
     */
    const so = contarMarcas("casa esta");
    for (const c of so) expect(c.pontos).toBe(0);
  });

  it("todas as línguas aparecem na contagem, mesmo a zero", () => {
    const c = contarMarcas("the and is");
    expect(c).toHaveLength(LINGUAS.length);
    expect(c[0].lingua).toBe("en");
  });
});
