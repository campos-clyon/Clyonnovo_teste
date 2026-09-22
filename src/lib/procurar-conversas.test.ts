import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  conversasVisiveis,
  numeroBate,
  procuraActiva,
  semEnfeites,
  soDigitos,
  textoBate,
} from "./procurar-conversas";

/**
 * A barra de procura da mesa do WhatsApp — 22-09-2026.
 *
 * O que se prova aqui é a regra que interessa: quem escreve um número
 * encontra-o esteja ele em que separador estiver. A mesa tem cento e sete
 * conversas em quatro listas, e obrigar a procurar quatro vezes é o mesmo que
 * não ter procura.
 */

type L = { telefone: string; estado: string; ultimaMensagem?: string | null; nota?: string | null };

const MESA: L[] = [
  { telefone: "351967100966", estado: "assistente", ultimaMensagem: "Bom dia, Susete." },
  { telefone: "351915370595", estado: "assistente", ultimaMensagem: "Boa tarde, Bruno." },
  { telefone: "351936139063", estado: "entregue", ultimaMensagem: "Bom dia, Estefânia.", nota: "Pediu factura" },
  { telefone: "912345678", estado: "arquivada", ultimaMensagem: null, nota: "Fornecedor" },
  { telefone: "351967789456", estado: "bloqueada", ultimaMensagem: null, nota: "Contacto pessoal" },
];

describe("procurar pelo número", () => {
  it("encontra pelo princípio do número", () => {
    expect(numeroBate("351967100966", "967")).toBe(true);
  });

  it("encontra por um pedaço do meio ou do fim — é como se lê ao telefone", () => {
    expect(numeroBate("351967100966", "100 966")).toBe(true);
    expect(numeroBate("351967100966", "0966")).toBe(true);
  });

  it("os espaços e o + não contam", () => {
    expect(numeroBate("351967100966", "+351 967 100 966")).toBe(true);
    expect(numeroBate("967100966", "967 100 966")).toBe(true);
  });

  it("o mesmo número com e sem indicativo é o mesmo número", () => {
    // Na base aparece das duas maneiras; a mesa não pode ter duas respostas.
    expect(numeroBate("351912345678", "912345678")).toBe(true);
    expect(numeroBate("912345678", "351912345678")).toBe(true);
  });

  it("o indicativo sozinho não faz toda a gente bater", () => {
    /*
     * Comparar a cadeia inteira fazia o «351» de todos os números portugueses
     * casar com tudo — uma procura que devolve a lista inteira não é procura.
     */
    expect(numeroBate("351967100966", "351")).toBe(false);
  });

  it("dois dígitos não chegam", () => {
    expect(numeroBate("351967100966", "96")).toBe(false);
  });
});

describe("procurar pelo que está escrito", () => {
  it("encontra pelo nome que vai na última mensagem", () => {
    expect(textoBate({ ultimaMensagem: "Boa tarde, Bruno." }, "bruno")).toBe(true);
  });

  it("os acentos não impedem nada", () => {
    expect(textoBate({ ultimaMensagem: "Bom dia, Estefânia." }, "estefania")).toBe(true);
    expect(textoBate({ ultimaMensagem: "Bom dia, Estefania." }, "Estefânia")).toBe(true);
  });

  it("procura também na nota, que é onde se escreve quem é", () => {
    expect(textoBate({ ultimaMensagem: null, nota: "Contacto pessoal" }, "pessoal")).toBe(true);
  });

  it("uma letra sozinha não é uma procura", () => {
    expect(textoBate({ ultimaMensagem: "Bruno" }, "b")).toBe(false);
  });
});

describe("a lista que se mostra", () => {
  it("sem procura, manda o separador — como sempre mandou", () => {
    const r = conversasVisiveis(MESA, "assistente", "");
    expect(r.map((l) => l.telefone)).toEqual(["351967100966", "351915370595"]);
  });

  it("espaços em branco não são uma procura", () => {
    expect(conversasVisiveis(MESA, "arquivada", "   ")).toHaveLength(1);
  });

  it("COM procura, o separador deixa de contar", () => {
    /*
     * É a razão de isto existir. O separador aberto é «assistente» e o número
     * está nos bloqueados; uma procura presa ao separador respondia que não
     * havia nada, e a conversa estava na lista do lado.
     */
    const r = conversasVisiveis(MESA, "assistente", "967789456");
    expect(r).toHaveLength(1);
    expect(r[0].estado).toBe("bloqueada");
  });

  it("encontra o arquivado a partir do separador dos bloqueados", () => {
    const r = conversasVisiveis(MESA, "bloqueada", "912345678");
    expect(r.map((l) => l.estado)).toEqual(["arquivada"]);
  });

  it("um número que não existe devolve lista vazia, e não a mesa toda", () => {
    expect(conversasVisiveis(MESA, "assistente", "999999999")).toHaveLength(0);
  });

  it("número e texto procuram-se ao mesmo tempo", () => {
    expect(conversasVisiveis(MESA, "assistente", "fornecedor").map((l) => l.telefone)).toEqual([
      "912345678",
    ]);
  });
});

describe("procuraActiva", () => {
  it("vazio não é procura", () => {
    expect(procuraActiva("")).toBe(false);
    expect(procuraActiva("  ")).toBe(false);
  });

  it("um dígito sozinho não é procura", () => {
    expect(procuraActiva("9")).toBe(false);
  });

  it("três dígitos ou duas letras já são", () => {
    expect(procuraActiva("967")).toBe(true);
    expect(procuraActiva("br")).toBe(true);
  });
});

describe("as ajudas", () => {
  it("soDigitos deita fora tudo o que não é número", () => {
    expect(soDigitos("+351 967 100 966")).toBe("351967100966");
  });

  it("semEnfeites tira acentos e maiúsculas", () => {
    expect(semEnfeites("Estefânia")).toBe("estefania");
  });
});

describe("o painel usa esta regra, e não outra", () => {
  const PAINEL = readFileSync(
    join(process.cwd(), "src/components/admin/AdminWhatsAppPanel.tsx"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("a mesa filtra pela função partilhada", () => {
    // Um filtro escrito à mão no painel divergia desta regra ao segundo mês —
    // e a divergência aparecia como um número que existe e não se encontra.
    expect(PAINEL).toContain("conversasVisiveis(linhas, separador, procura)");
  });

  it("há mesmo uma caixa de procura", () => {
    expect(PAINEL).toContain("setProcura");
    expect(PAINEL).toContain("Procurar por número");
  });

  it("o ecrã diz que está a procurar em tudo — senão a lista mente", () => {
    /*
     * Com procura escrita aparecem linhas de separadores que não estão
     * abertos. Sem uma palavra a dizê-lo, o ecrã contradiz-se a si próprio.
     */
    expect(PAINEL).toContain("em todos os separadores");
  });
});
