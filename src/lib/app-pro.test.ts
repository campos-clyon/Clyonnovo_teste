import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import {
  escolhasDe,
  separadorDe,
  valorDoCartao,
  etiquetaDoEstado,
  lerValor,
  imagensDe,
  emPortugues,
  andarPorExtenso,
  novosPorAbrir,
  estadoCurto,
  quandoCurto,
  quandoE,
  URGENCIA,
  ELEVADOR,
  ESTACIONAMENTO,
  ESTADO_DO_ENTULHO,
  type Trabalho,
} from "../../app-pro/src/lib/trabalhos";
import { caminhoDe, caminhoDoLink, destinoDoAviso } from "../../app-pro/src/lib/destino";
import * as PAINEL from "@/app/profissionais/painel/tipos";
import { mensagensParaAExpo } from "./push-nativo";

/**
 * A APP DO PROFISSIONAL (app-pro/) — fase 2, 18-10-2026.
 *
 * A app não tem testes próprios: as regras dela são puras e correm aqui, na
 * mesma bateria que a CI do site já corre. Assim uma mudança no painel ou na
 * negociação que parta a app chumba antes de chegar ao telemóvel de ninguém.
 */

const T = (o: Partial<Trabalho>): Trabalho =>
  ({
    negociacaoId: 1,
    pedidoId: 10,
    estado: "aberta",
    fase: "a_negociar",
    propostas: "[]",
    valorAcordado: null,
    querPagar: null,
    recebeSeAceitar: null,
    recebeSeFechado: null,
    valorDaClyon: null,
    sugestao: null,
    taxas: { cliente: 0.05, profissional: 0.06 },
    ofertaClyon: null,
    arquivadoEm: null,
    confirmadoEm: null,
    pagoEm: null,
    abertoEm: null,
    ...o,
  }) as Trabalho;

const proposta = (por: "cliente" | "profissional", valor: number, estado = "pendente") => ({
  por,
  valor,
  criadaEm: "2026-10-18T10:00:00.000Z",
  estado,
});

describe("os separadores são os do painel", () => {
  it("cada estado cai no separador certo", () => {
    expect(separadorDe(T({}))).toBe("novos");
    expect(separadorDe(T({ propostas: JSON.stringify([proposta("profissional", 100)]) }))).toBe("negociacao");
    expect(separadorDe(T({ estado: "aguarda_contratacao" }))).toBe("negociacao");
    expect(separadorDe(T({ estado: "acordada", fase: "a_executar" }))).toBe("contratados");
    expect(separadorDe(T({ estado: "acordada", confirmadoEm: "2026-10-18" }))).toBe("terminados");
    expect(separadorDe(T({ estado: "morta" }))).toBe("recusados");
    expect(separadorDe(T({ estado: "acordada", arquivadoEm: "2026-10-18" }))).toBe("arquivados");
  });

  it("os textos do acesso são os mesmos do painel, palavra por palavra", () => {
    expect(URGENCIA).toEqual(PAINEL.URGENCIA);
    expect(ELEVADOR).toEqual(PAINEL.ELEVADOR);
    expect(ESTACIONAMENTO).toEqual(PAINEL.ESTACIONAMENTO);
    expect(ESTADO_DO_ENTULHO).toEqual(PAINEL.ESTADO_DO_ENTULHO);
  });
});

describe("o que ele pode fazer em cada trabalho", () => {
  it("num pedido novo propõe — a abertura do cliente não se aceita, e a sugestão CLYON é o ponto de partida", () => {
    const e = escolhasDe(
      T({
        propostas: JSON.stringify([proposta("cliente", 90)]),
        sugestao: { horas: 2, pessoas: 2, custoMinimo: 80, precoSugerido: 140, recebeSePropuser: 131.6, lucroEstimado: 30, porCarga: false },
      }),
    );
    expect(e).toMatchObject({ podePropor: true, podeAceitar: false, primeiraProposta: true, referenciaParaPropor: 140 });
  });

  it("depois de ele propor, a contraproposta do cliente pode ser aceite", () => {
    const e = escolhasDe(
      T({ propostas: JSON.stringify([proposta("profissional", 260, "recusada"), proposta("cliente", 230)]) }),
    );
    expect(e).toMatchObject({ podeAceitar: true, podePropor: true, valorParaAceitar: 230, primeiraProposta: false });
  });

  it("com a proposta dele à espera, só pode desistir", () => {
    const e = escolhasDe(T({ propostas: JSON.stringify([proposta("profissional", 150)]) }));
    expect(e).toMatchObject({ podeAceitar: false, podePropor: false, podeDesistir: true });
  });

  it("num Trabalho CLYON só aceita ou recusa, e o valor visto é o da mesa", () => {
    const e = escolhasDe(T({ ofertaClyon: "distribuida", propostas: JSON.stringify([proposta("cliente", 70)]) }));
    expect(e).toMatchObject({ valorFixo: true, podeAceitar: true, podePropor: false, valorParaAceitar: 70 });
  });

  it("à espera de ser contratado, só pode desistir", () => {
    const e = escolhasDe(T({ estado: "aguarda_contratacao", propostas: JSON.stringify([proposta("cliente", 200, "aceite")]) }));
    expect(e).toMatchObject({ podeAceitar: false, podePropor: false, podeDesistir: true });
  });

  it("um trabalho fechado não tem botões", () => {
    expect(escolhasDe(T({ estado: "acordada" }))).toMatchObject({ podeAceitar: false, podePropor: false, podeDesistir: false });
  });
});

describe("o número grande do cartão é o que ele recebe", () => {
  it("fechado, o líquido do acordado; novo, o valor CLYON ou a sugestão", () => {
    expect(valorDoCartao(T({ estado: "acordada", recebeSeFechado: 357.2 }))).toEqual({ valor: 357.2, legenda: "recebe, sem IVA" });
    expect(valorDoCartao(T({ valorDaClyon: 56, ofertaClyon: "directa" }))?.legenda).toBe("valor fixo · CLYON");
    expect(
      valorDoCartao(T({ sugestao: { recebeSePropuser: 131.6 } as Trabalho["sugestao"] }))?.valor,
    ).toBe(131.6);
  });

  it("a etiqueta diz de quem é a vez, como no painel", () => {
    expect(etiquetaDoEstado(T({ propostas: JSON.stringify([proposta("cliente", 90)]) }))).toBe("à espera da sua resposta");
    expect(etiquetaDoEstado(T({ propostas: JSON.stringify([proposta("profissional", 90)]) }))).toBe("à espera do cliente");
    expect(etiquetaDoEstado(T({ estado: "acordada", fase: "a_executar" }))).toBe("por fazer");
  });

  it("só mostra imagens, decidindo pelo nome do ficheiro como o painel", () => {
    const anexos = JSON.stringify([
      { url: "https://blob.exemplo/abc", name: "sala.jpg" },
      { url: "https://blob.exemplo/def", name: "reportagem.pdf" },
      { url: "https://blob.exemplo/ghi" },
      { url: "https://blob.exemplo/video.mp4" },
    ]);
    expect(imagensDe(anexos)).toEqual(["https://blob.exemplo/abc", "https://blob.exemplo/ghi"]);
  });

  it("o que a Vitória grava no WhatsApp aparece em português, no painel e na app", () => {
    expect(PAINEL.ESTACIONAMENTO.near).toBe("Estaciona perto da porta");
    expect(PAINEL.ESTACIONAMENTO.far).toBe("Estaciona longe da porta");
    expect(emPortugues(ESTACIONAMENTO, "near")).not.toBe("near");
    expect(andarPorExtenso("0")).toBe("Rés-do-chão");
    expect(andarPorExtenso("R/C")).toBe("Rés-do-chão");
    expect(andarPorExtenso("4")).toBe("4");
  });

  it("o cartão diz o estado numa palavra e o dia numa linha curta", () => {
    expect(estadoCurto(T({ propostas: JSON.stringify([proposta("cliente", 90)]) }))).toEqual({ texto: "Responder", tom: "aviso" });
    expect(estadoCurto(T({ estado: "aguarda_contratacao" }))?.texto).toBe("Com o cliente");
    expect(estadoCurto(T({ estado: "acordada", fase: "a_executar" }))?.texto).toBe("Por fazer");
    expect(quandoCurto({ dataCombinada: "2026-10-28T09:00:00.000Z", dataAgendada: null, urgency: null })).toBe("qua 28/10 · 09:00");
    expect(quandoCurto({ dataCombinada: null, dataAgendada: "2026-10-21", urgency: null })).toBe("qua 21/10");
    expect(quandoCurto({ dataCombinada: null, dataAgendada: null, urgency: "flexible" })).toBe("Sem pressa");
  });

  it("o número da aba conta só os novos que ele ainda não abriu", () => {
    expect(novosPorAbrir([T({}), T({ abertoEm: "2026-10-18T10:00:00Z" }), T({ estado: "acordada" })])).toBe(1);
  });

  it("lê o valor como ele o escreve", () => {
    expect(lerValor("120,50")).toBe(120.5);
    expect(lerValor("168 €")).toBe(168);
    expect(lerValor("12,345")).toBeNull();
    expect(lerValor("0")).toBeNull();
    expect(lerValor("abc")).toBeNull();
  });

  it("o dia diz-se à portuguesa, e sem hora quando não a há", () => {
    expect(quandoE({ dataCombinada: null, dataAgendada: null, urgency: "tomorrow" })).toBe("Amanhã");
    expect(quandoE({ dataCombinada: null, dataAgendada: "2026-10-21", urgency: null })).not.toMatch(/às/);
    expect(quandoE({ dataCombinada: "2026-10-21T08:30:00.000Z", dataAgendada: null, urgency: null })).toMatch(/às 09:30/);
  });
});

describe("tocar num aviso abre o trabalho certo", () => {
  it("o aviso traz o número do trabalho", () => {
    expect(destinoDoAviso({ negociacaoId: 77, tag: "pedido-novo" })).toEqual({ tipo: "trabalho", negociacaoId: 77 });
    expect(caminhoDe(destinoDoAviso({ negociacaoId: 77 }))).toBe("/trabalho/77");
  });

  it("os avisos antigos, sem número, também abrem algo com sentido", () => {
    expect(caminhoDe(destinoDoAviso({ tag: "contratado-45" }))).toBe("/trabalho/pedido-45");
    expect(caminhoDe(destinoDoAviso({ tag: "pedido-novo" }))).toBe("/");
    expect(caminhoDe(destinoDoAviso(null))).toBe("/");
  });

  it("os links do site abrem a lista, e nada abre um ecrã de erro", () => {
    expect(caminhoDoLink("https://clyon.pt/profissionais/pedidos/abc123")).toBe("/");
    expect(caminhoDoLink("https://clyon.pt/profissionais/painel?ecra=trabalhos")).toBe("/");
    expect(caminhoDoLink("/trabalho/12")).toBe("/trabalho/12");
    expect(caminhoDoLink("::lixo::")).toBe("/");
  });

  it("o site põe o número do trabalho no aviso que vai para a app", () => {
    const [m] = mensagensParaAExpo(["ExponentPushToken[AbCdEf123456]"], { title: "t", body: "b", negociacaoId: 77 });
    expect(m.data.negociacaoId).toBe(77);
    const distribuir = readFileSync(join(process.cwd(), "src/lib/distribuir-pedido.ts"), "utf8");
    expect(distribuir).toContain("negociacaoId = await criarNegociacao(");
    expect(distribuir).toMatch(/avisarProfissionalDePedidoPorPush\(\{[\s\S]*?negociacaoId,[\s\S]*?\}\)/);
  });

  it("reabrir uma negociação devolve o número dela, e não um insertId sem sentido", () => {
    const db = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
    const reabrir = db.slice(db.indexOf("ofertaClyon = VALUES(ofertaClyon)"), db.indexOf(": `id = LAST_INSERT_ID(id)`"));
    expect(reabrir).toContain("id = LAST_INSERT_ID(id)");
  });
});

describe("a app só partilha com o site regras sem dependências", () => {
  /*
   * A app importa alguns ficheiros de src/lib directamente — é o que garante
   * uma só verdade. Mas um desses ficheiros que passe a importar a base, o
   * Next ou outro pacote do servidor parte o build da app sem aviso. Só são
   * permitidos ficheiros cujos imports sejam todos `import type`.
   */
  function ficheiros(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (n === "node_modules") return [];
      return statSync(p).isDirectory() ? ficheiros(p) : /\.tsx?$/.test(n) ? [p] : [];
    });
  }

  it("cada ficheiro do site que a app usa não puxa mais nada", () => {
    const daApp = ficheiros(join(process.cwd(), "app-pro", "src"));
    const partilhados = new Set<string>();
    for (const f of daApp) {
      for (const m of readFileSync(f, "utf8").matchAll(/from "((?:\.\.\/)+src\/lib\/[\w-]+)"/g)) {
        partilhados.add(resolve(dirname(f), m[1]) + ".ts");
      }
    }
    expect(partilhados.size).toBeGreaterThanOrEqual(4);
    for (const p of partilhados) {
      const imports = readFileSync(p, "utf8").match(/^import\s.*$/gm) ?? [];
      expect(imports.filter((l) => !l.startsWith("import type")), p).toEqual([]);
    }
  });
});
