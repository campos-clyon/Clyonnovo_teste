import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  sinaisDoTrabalho,
  pesoDoTrabalho,
  porQuilometro,
  porKmPorExtenso,
  corDaBarra,
  RAIO_QUENTE_KM,
  BOM_POR_KM,
} from "./sinais-do-trabalho";
import { deQuemEAVez } from "@/app/profissionais/painel/tipos";

/**
 * Os sinais no painel do profissional.
 *
 * "Pedidos que estão a menos de 10 km, por exemplo, devem ter o emoji do
 * foguinho — tente criar algo interativo, inteligente e moderno."
 *
 * A lista dizia o serviço, a cidade, a distância e o dinheiro, e cada linha
 * parecia igual à de cima. Quem lê vinte cartões não compara números: procura
 * um motivo para parar.
 *
 * Nenhum sinal pede dados novos — distância, urgência, valor e fotografias já
 * chegavam ao painel. O que não existia era a conta.
 */

const TRABALHOS = readFileSync(
  join(process.cwd(), "src/app/profissionais/painel/Trabalhos.tsx"),
  "utf8",
);

describe("o foguinho", () => {
  it("acende a menos de 10 km, e não acima", () => {
    expect(sinaisDoTrabalho({ distanciaKm: 6 }).map((s) => s.chave)).toContain("perto");
    expect(sinaisDoTrabalho({ distanciaKm: RAIO_QUENTE_KM }).map((s) => s.chave)).toContain("perto");
    expect(sinaisDoTrabalho({ distanciaKm: 11 }).map((s) => s.chave)).not.toContain("perto");
  });

  it("sem distância medida não inventa proximidade", () => {
    // Um pedido cuja morada não foi localizada tem distanciaKm nulo. Dizer
    // "a 0 km" seria a pior mentira possível: manda-o lá.
    expect(sinaisDoTrabalho({ distanciaKm: null }).map((s) => s.chave)).not.toContain("perto");
    expect(sinaisDoTrabalho({}).map((s) => s.chave)).not.toContain("perto");
  });

  it("diz os quilómetros no próprio distintivo", () => {
    expect(sinaisDoTrabalho({ distanciaKm: 6 })[0].texto).toBe("A 6 km");
    expect(sinaisDoTrabalho({ distanciaKm: 6 })[0].emoji).toBe("🔥");
  });
});

describe("os outros sinais", () => {
  it("urgente é hoje ou amanhã, no vocabulário do formulário e no do site", () => {
    for (const u of ["today", "tomorrow", "hoje", "amanhã"]) {
      expect(sinaisDoTrabalho({ urgency: u }).map((s) => s.chave)).toContain("urgente");
    }
    expect(sinaisDoTrabalho({ urgency: "flexible" }).map((s) => s.chave)).not.toContain("urgente");
  });

  it("bem pago é por quilómetro, e não pelo total", () => {
    // É este o ponto todo: 304 € a 39 km rendem menos do que 123 € a 6 km.
    const grande = { recebeSeAceitar: 304, distanciaKm: 39 };   // 7,8 €/km
    const pequeno = { recebeSeAceitar: 123.5, distanciaKm: 6 }; // 20,6 €/km
    expect(porQuilometro(grande)!).toBeLessThan(porQuilometro(pequeno)!);
    expect(sinaisDoTrabalho(pequeno).map((s) => s.chave)).toContain("bem_pago");
    expect(sinaisDoTrabalho(grande).map((s) => s.chave)).not.toContain("bem_pago");
  });

  it("o limiar está acima do típico — senão marcava metade da lista", () => {
    /*
     * A mediana real dos 19 trabalhos fechados é 6,3 €/km. Um limiar em 6
     * punha o distintivo em metade dos cartões, e um sinal que está em
     * metade das linhas não é um sinal.
     *
     * Este teste é o que impede alguém de o baixar sem reparar porquê.
     */
    const MEDIANA_REAL = 6.3;
    expect(BOM_POR_KM).toBeGreaterThan(MEDIANA_REAL * 1.5);

    // O trabalho típico do meio da tabela NÃO leva distintivo.
    expect(sinaisDoTrabalho({ recebeSeAceitar: 63, distanciaKm: 10 }).map((s) => s.chave))
      .not.toContain("bem_pago");
  });

  it("não divide por zero nem por distância que não existe", () => {
    expect(porQuilometro({ recebeSeAceitar: 100, distanciaKm: 0 })).toBeNull();
    expect(porQuilometro({ recebeSeAceitar: 100, distanciaKm: null })).toBeNull();
    expect(porQuilometro({ recebeSeAceitar: null, distanciaKm: 10 })).toBeNull();
    expect(porKmPorExtenso({ recebeSeAceitar: 100 })).toBeNull();
  });

  it("as fotografias contam-se em número, para caber na linha", () => {
    expect(sinaisDoTrabalho({ quantasFotos: 3 }).map((s) => s.texto)).toContain("3 fotos");
    expect(sinaisDoTrabalho({ quantasFotos: 2 }).map((s) => s.chave)).not.toContain("com_fotos");
  });

  it("o €/km escreve-se em português", () => {
    expect(porKmPorExtenso({ recebeSeAceitar: 123.5, distanciaKm: 6 })).toBe("20,6 €/km");
  });
});

describe("a ordem e a cor", () => {
  it("perto pesa mais do que urgente, e urgente mais do que bem pago", () => {
    const perto = pesoDoTrabalho({ distanciaKm: 5 });
    const urgente = pesoDoTrabalho({ urgency: "today" });
    const bem = pesoDoTrabalho({ recebeSeAceitar: 100, distanciaKm: 5.1 });
    expect(perto).toBeGreaterThan(urgente);
    expect(urgente).toBeGreaterThan(pesoDoTrabalho({ quantasFotos: 4 }));
    expect(bem).toBeGreaterThan(0);
  });

  it("um trabalho sem sinal nenhum não pesa nada — e isso é informação", () => {
    expect(pesoDoTrabalho({ distanciaKm: 90, urgency: "flexible" })).toBe(0);
  });

  it("só o perto pinta o cartão de laranja", () => {
    expect(corDaBarra({ distanciaKm: 5 }, false)).toContain("orange");
    expect(corDaBarra({ urgency: "today" }, false)).toContain("amber");
    // Sem sinal, volta ao ciano da marca quando é novo.
    expect(corDaBarra({ distanciaKm: 90 }, true)).toContain("00B4CC");
  });
});

describe("o cartão no painel", () => {
  it("mostra os distintivos e o €/km", () => {
    expect(TRABALHOS).toContain("sinaisDoTrabalho({ ...p, quantasFotos: fotos.length })");
    expect(TRABALHOS).toContain("porKmPorExtenso(p)");
    expect(TRABALHOS).toContain("{sinal.emoji}");
  });

  it("nenhum distintivo parte a meio no telemóvel", () => {
    // Ele mandou-me a fotografia com «Pouca concorrência» na linha de baixo.
    expect(TRABALHOS).toContain("whitespace-nowrap rounded-full border px-2 py-0.5");
  });

  it("os sinais só aparecem onde ele ainda decide", () => {
    // Num trabalho contratado, «bem pago» é história — e ruído por cima do
    // que interessa, que é a morada e o contacto.
    expect(TRABALHOS).toContain('const aDecidir = separador === "novos" || separador === "negociacao";');
    expect(TRABALHOS).toContain("aDecidir ? sinaisDoTrabalho(");
  });

  it("o quente muda o cartão inteiro, e é o único que o faz", () => {
    expect(TRABALHOS).toContain("border-l-orange-500");
    expect(TRABALHOS).toContain("ring-1 ring-orange-100");
  });

  it("a ordem por omissão é a chegada — o ecrã não decide por ele", () => {
    /*
     * A primeira versão punha os que têm sinal à frente, sempre. Ele
     * corrigiu-me: "você mudou a hierarquia dos pedidos; vamos deixar padrão
     * do último para o mais antigo".
     *
     * Tem razão, e o erro é o mesmo que os sinais vieram corrigir do outro
     * lado: o ecrã a decidir por ele. Uma lista que se reorganiza sozinha faz
     * perder o lugar de quem já sabia o que tinha visto.
     */
    expect(TRABALHOS).toContain('useState<Ordem>("recentes")');
    expect(TRABALHOS).toContain("return ordenada.sort(maisRecentePrimeiro);");
  });

  it("ordenar é uma escolha dele, com quatro caminhos", () => {
    for (const opcao of ['"recentes"', '"perto"', '"valor"', '"sinais"']) {
      expect(TRABALHOS).toContain(opcao);
    }
    expect(TRABALHOS).toContain("setOrdem(o.id)");
    // Os sinais continuam a existir — deixaram é de mandar sem ser pedido.
    expect(TRABALHOS).toContain("pesoDoTrabalho({ ...b, quantasFotos: quantasFotosDe(b) })");
  });

  it("só se ordena onde ele ainda decide", () => {
    // Nos separadores de trabalho feito a pergunta é "o que aconteceu quando",
    // e a cronologia é a única resposta.
    expect(TRABALHOS).toContain('const podeOrdenar = separador === "novos" || separador === "negociacao";');
    expect(TRABALHOS).toContain("if (!podeOrdenar) return lista;");
    expect(TRABALHOS).toContain("{podeOrdenar && visiveis.length > 1 && (");
  });

  it("sem distância medida não se finge que está perto", () => {
    // Desconhecido não é perto nem longe, e não se põe à frente de nada.
    expect(TRABALHOS).toContain("Number.POSITIVE_INFINITY");
  });

  it("o controlo vive fechado, e fecha-se sozinho depois de escolher", () => {
    /*
     * Deslizava na horizontal, e resolvia pouco: num telemóvel de 360 px a
     * última opção saía do ecrã, e ninguém arrasta uma barra que não sabe que
     * continua. Ele apanhou-o numa fotografia.
     *
     * Fechado é um botão com a escolha actual. Escolher fecha — escolher é o
     * fim da tarefa, e a gaveta aberta rouba à lista um cartão inteiro.
     */
    expect(TRABALHOS).toContain("const [ordemAberta, setOrdemAberta] = useState(false);");
    expect(TRABALHOS).toContain("aria-expanded={ordemAberta}");
    const i = TRABALHOS.indexOf("setOrdem(o.id);");
    expect(TRABALHOS.slice(i, i + 120)).toContain("setOrdemAberta(false);");
    // E mudar de separador fecha-a: a escolha fica, a gaveta não.
    expect(TRABALHOS).toContain("useEffect(() => setOrdemAberta(false), [separador]);");
  });
});

describe("de quem é a vez", () => {
  it("uma proposta DELE deixa a bola do lado do cliente", () => {
    /*
     * "O profissional fez uma proposta mas o pedido ficou no estado «à espera
     * da sua resposta» — devia estar à espera da resposta do cliente."
     *
     * O estado `aberta` cobre os dois lados da mesma mesa. A lista olhava só
     * para o nome do estado e dizia sempre a primeira das duas histórias; o
     * ecrã de dentro, que olha para as propostas, dizia a segunda. O mesmo
     * trabalho contava coisas diferentes conforme se abrisse ou não.
     */
    const dele = JSON.stringify([
      { por: "cliente", valor: 320, estado: "recusada" },
      { por: "profissional", valor: 300, estado: "pendente" },
    ]);
    expect(deQuemEAVez(dele)).toBe("cliente");
  });

  it("uma proposta do CLIENTE espera por ele", () => {
    const doCliente = JSON.stringify([{ por: "cliente", valor: 320, estado: "pendente" }]);
    expect(deQuemEAVez(doCliente)).toBe("sua");
  });

  it("manda a última pendente, e não a primeira que aparecer", () => {
    const ida = JSON.stringify([
      { por: "profissional", valor: 400, estado: "recusada" },
      { por: "cliente", valor: 350, estado: "recusada" },
      { por: "profissional", valor: 380, estado: "pendente" },
    ]);
    expect(deQuemEAVez(ida)).toBe("cliente");
  });

  it("sem nenhuma pendente, ninguém está à espera de ninguém", () => {
    expect(deQuemEAVez(null)).toBeNull();
    expect(deQuemEAVez("[]")).toBeNull();
    expect(deQuemEAVez(JSON.stringify([{ por: "cliente", estado: "aceite" }]))).toBeNull();
    // E o ecrã diz isso, em vez de inventar uma espera que não existe.
    expect(TRABALHOS).toContain("sem propostas ainda");
  });

  it("o cartão usa isto em vez do nome do estado", () => {
    expect(TRABALHOS).toContain('const vez = p.estado === "aberta" ? deQuemEAVez(p.propostas) : null;');
    expect(TRABALHOS).toContain('vez === "cliente"');
  });
});
