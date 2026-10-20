import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
  porOrdemDeChegada,
  diasParaMarcar,
  HORAS_PARA_MARCAR,
  marcacaoInicial,
  provaDe,
  situacaoDoAjuste,
  quemResponde,
  whatsAppDaClyon,
  horaCurta,
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
  it("num pedido novo propõe — a abertura do cliente não se aceita, e a caixa começa vazia, como no painel", () => {
    const e = escolhasDe(
      T({
        propostas: JSON.stringify([proposta("cliente", 90)]),
        valorDaClyon: 235,
        sugestao: { horas: 2, pessoas: 2, custoMinimo: 80, precoSugerido: 140, recebeSePropuser: 131.6, lucroEstimado: 30, porCarga: false },
      }),
    );
    // Era a sugestão (140): no #469 a caixa dizia 80,36 € com o cliente nos 250 € (20-10-2026).
    expect(e).toMatchObject({ podePropor: true, podeAceitar: false, primeiraProposta: true, referenciaParaPropor: null });
  });

  it("aberto, o pedido mostra em cima o valor da CLYON — o mesmo número do cartão da lista", () => {
    const DETALHE = readFileSync(join(process.cwd(), "app-pro/src/app/trabalho/[id].tsx"), "utf8");
    expect(DETALHE).toContain("<Text style={{ color: c.suave }}>Valor sugerido pela CLYON</Text>");
    expect(DETALHE).toContain("{euros(t.valorDaClyon)}");
    expect(DETALHE).toContain("{e.primeiraProposta ? <ValorSugeridoPelaClyon t={t} /> : null}");
    // A mesma frase do painel, palavra por palavra.
    expect(readFileSync(join(process.cwd(), "src/app/profissionais/painel/Trabalhos.tsx"), "utf8")).toContain(
      "já com a taxa CLYON descontada · o valor é sem IVA",
    );
    expect(DETALHE).toContain("já com a taxa CLYON descontada · o valor é sem IVA");
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

  it("o link do email da palavra-passe abre o ecrã da app, com o mesmo token", () => {
    expect(caminhoDoLink("https://clyon.pt/profissionais/definir-senha/AbC_-123?chave=x")).toBe(
      "/definir-senha/AbC_-123",
    );
    expect(caminhoDoLink("/profissionais/definir-senha/AbC_-123")).toBe("/definir-senha/AbC_-123");
    // Sem token, ou com mais coisas atrás, é a lista — nunca um ecrã partido.
    expect(caminhoDoLink("https://clyon.pt/profissionais/definir-senha/")).toBe("/");
    expect(caminhoDoLink("https://clyon.pt/profissionais/definir-senha/a/b")).toBe("/");
  });

  it("o registo e a palavra-passe da app usam as rotas do site, com os mesmos campos", () => {
    const REGISTO = readFileSync(join(process.cwd(), "app-pro/src/app/registo.tsx"), "utf8");
    const SENHA = readFileSync(join(process.cwd(), "app-pro/src/app/definir-senha/[token].tsx"), "utf8");
    const ENTRAR = readFileSync(join(process.cwd(), "app-pro/src/app/entrar.tsx"), "utf8");
    const LAYOUT = readFileSync(join(process.cwd(), "app-pro/src/app/_layout.tsx"), "utf8");
    const ROTA = readFileSync(join(process.cwd(), "src/app/api/parceiros/candidatura/route.ts"), "utf8");

    expect(REGISTO).toContain('"/api/parceiros/candidatura"');
    for (const campo of ["nome", "email", "telefone", "cidade", "tipoVeiculo", "servicos", "mensagem"]) {
      expect(ROTA).toContain(`corpo.${campo}`);
      expect(REGISTO).toMatch(new RegExp(`\\b${campo}\\b`));
    }
    // As viaturas do registo existem todas na lista que a rota aceita.
    for (const [, id] of REGISTO.matchAll(/\{ id: "(\w+)", rotulo:/g)) {
      expect(readFileSync(join(process.cwd(), "src/lib/convite-profissional.ts"), "utf8")).toContain(`id: "${id}"`);
    }

    expect(SENHA).toContain('"/api/profissionais/definir-senha"');
    expect(SENHA).toContain("paraApp: true");
    expect(ENTRAR).toContain('router.push("/registo")');
    // O registo é para quem está fora; a palavra-passe abre dentro ou fora.
    expect(LAYOUT).toMatch(/guard=\{!ligado\}>[\s\S]*?name="registo"[\s\S]*?<\/Stack\.Protected>/);
    expect(LAYOUT).toMatch(/<\/Stack\.Protected>\s*\{\/\*[^*]*\*\/\}\s*<Stack\.Screen name="definir-senha\/\[token\]"/);
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
   * Next ou outro pacote do servidor parte o build da app sem aviso.
   *
   * Um `import type` não conta: apaga-se ao compilar e nada desse ficheiro
   * chega ao telemóvel.
   *
   * A REGRA É A CADEIA (fase 4, 18-10-2026). Antes só se aceitavam ficheiros
   * sem imports nenhuns — e a carteira, o perfil por completar e a ajuda,
   * que importam outras regras do src/lib, ficavam de fora, obrigando a
   * copiá-las. O que parte a app não é um import: é um import que sai do
   * src/lib (um pacote, o "@/", a base). Por isso segue-se cada import de
   * valor até ao fim, e a cadeia inteira tem de ficar em src/lib — e sem
   * `process.env`, que no telemóvel vem vazio.
   */
  function ficheiros(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (n === "node_modules") return [];
      return statSync(p).isDirectory() ? ficheiros(p) : /\.tsx?$/.test(n) ? [p] : [];
    });
  }

  /** Os imports que chegam ao telemóvel: `import type` e `import { type A }` não contam. */
  function importsDeValor(ficheiro: string): string[] {
    const texto = readFileSync(ficheiro, "utf8");
    const saida: string[] = [];
    for (const m of texto.matchAll(/^import\s+(type\s)?([^;"]*?)from\s+"([^"]+)"/gm)) {
      if (m[1]) continue;
      const nomes = m[2].replace(/[{}\s]/g, "");
      if (nomes && nomes.split(",").every((n) => n.startsWith("type"))) continue;
      saida.push(m[3]);
    }
    for (const m of texto.matchAll(/^import\s+"([^"]+)"/gm)) saida.push(m[1]);
    return saida;
  }

  it("cada regra do site que a app usa, e o que ela importa, fica em src/lib", () => {
    const lib = join(process.cwd(), "src", "lib");
    const partilhados = new Set<string>();
    for (const f of ficheiros(join(process.cwd(), "app-pro", "src"))) {
      for (const alvo of importsDeValor(f)) {
        if (/^(\.\.\/)+src\/lib\//.test(alvo)) partilhados.add(resolve(dirname(f), alvo) + ".ts");
      }
    }
    expect(partilhados.size).toBeGreaterThanOrEqual(4);

    const vistos = new Set<string>();
    const problemas: string[] = [];
    const seguir = (f: string) => {
      if (vistos.has(f)) return;
      vistos.add(f);
      if (!existsSync(f)) return void problemas.push(`${f} não existe`);
      if (dirname(f) !== lib) problemas.push(`${f} está fora de src/lib`);
      const semComentarios = readFileSync(f, "utf8")
        .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
      if (/process\.env/.test(semComentarios)) problemas.push(`${f} lê process.env`);
      for (const alvo of importsDeValor(f)) {
        if (alvo.startsWith("./")) seguir(join(dirname(f), alvo.slice(2)) + ".ts");
        else problemas.push(`${f} importa "${alvo}"`);
      }
    };
    partilhados.forEach(seguir);
    expect(vistos.size).toBeGreaterThanOrEqual(partilhados.size);
    expect(problemas).toEqual([]);
  });
});

describe("a lista, por ordem de chegada", () => {
  it("o último a chegar fica em cima, o mais antigo em baixo", () => {
    const lista = [
      T({ negociacaoId: 1, criadaEm: "2026-10-18T08:00:00.000Z" }),
      T({ negociacaoId: 2, criadaEm: "2026-10-18T10:00:00.000Z" }),
      T({ negociacaoId: 3, criadaEm: "2026-10-17T22:00:00.000Z" }),
    ];
    expect(porOrdemDeChegada(lista).map((t) => t.negociacaoId)).toEqual([2, 1, 3]);
  });

  it("sem a data de chegada vale a do pedido; empatados, o mais recente primeiro", () => {
    const lista = [
      T({ negociacaoId: 4, criadaEm: null, criadoEm: "2026-10-18T09:00:00.000Z" }),
      T({ negociacaoId: 5, criadaEm: "2026-10-18T09:00:00.000Z" }),
      T({ negociacaoId: 6, criadaEm: "2026-10-18T09:30:00.000Z" }),
    ];
    expect(porOrdemDeChegada(lista).map((t) => t.negociacaoId)).toEqual([6, 5, 4]);
  });
});

describe("o trabalho contratado — fase 3", () => {
  it("os dias para marcar começam hoje, em Lisboa, e não no fuso do telemóvel", () => {
    // 23:30 UTC de domingo, 18/10, já é segunda, 19/10, em Lisboa.
    const d = diasParaMarcar(new Date("2026-10-18T23:30:00.000Z"), 3);
    expect(d.map((x) => x.dia)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
    expect(d.map((x) => x.rotulo)).toEqual(["Hoje", "Amanhã", "qua 21/10"]);
  });

  it("as horas vão das 07:00 às 21:30, de meia em meia hora", () => {
    expect(HORAS_PARA_MARCAR).toHaveLength(30);
    expect(HORAS_PARA_MARCAR[0]).toBe("07:00");
    expect(HORAS_PARA_MARCAR[1]).toBe("07:30");
    expect(HORAS_PARA_MARCAR.at(-1)).toBe("21:30");
  });

  it("o seletor abre no dia já combinado, à hora de Lisboa", () => {
    expect(marcacaoInicial("2026-10-21T08:30:00.000Z")).toEqual({ dia: "2026-10-21", hora: "09:30" });
    // No Inverno Lisboa está em UTC.
    expect(marcacaoInicial("2026-11-04T08:30:00.000Z")).toEqual({ dia: "2026-11-04", hora: "08:30" });
    // Sem dia combinado: amanhã às 09:00.
    expect(marcacaoInicial(null, new Date("2026-10-18T10:00:00.000Z"))).toEqual({ dia: "2026-10-19", hora: "09:00" });
    expect(horaCurta("2026-10-18T07:52:00.000Z")).toBe("08:52");
  });

  it("a prova lê-se como o site a guarda", () => {
    expect(provaDe(JSON.stringify({ fotos: ["https://x/a.jpg", 3], nota: "feito", em: "2026-10-18" }))).toEqual({
      fotos: ["https://x/a.jpg"],
      nota: "feito",
    });
    expect(provaDe("{")).toBeNull();
    expect(provaDe(null)).toBeNull();
  });

  it("em que pé está o ajuste decide o que o ecrã mostra", () => {
    const base = { estado: "acordada" as const, fase: "a_executar" as const };
    const livre = { pendente: null, ultimo: null, restantes: 2, porqueNao: null };
    const a = { pedidoEm: "", valorAntigo: 100, valorNovo: 180, motivo: "eram 50", fotos: [] };
    expect(situacaoDoAjuste({ ...base, ajuste: livre })).toBe("livre");
    expect(situacaoDoAjuste({ ...base, ajuste: { ...livre, pendente: { ...a, estado: "pendente", expiraEm: "" } } })).toBe("pendente");
    expect(situacaoDoAjuste({ ...base, ajuste: { ...livre, ultimo: { ...a, estado: "recusado" } } })).toBe("sem_resposta");
    expect(situacaoDoAjuste({ ...base, ajuste: { ...livre, ultimo: { ...a, estado: "expirado" } } })).toBe("sem_resposta");
    expect(situacaoDoAjuste({ ...base, ajuste: { ...livre, restantes: 0, porqueNao: "Já pediu 2" } })).toBe("fechado");
    // Depois da prova já não há ajuste.
    expect(situacaoDoAjuste({ ...base, fase: "a_confirmar", ajuste: livre })).toBeNull();
  });

  it("num trabalho CLYON quem responde é a CLYON", () => {
    expect(quemResponde({ ofertaClyon: null })).toBe("o cliente");
    expect(quemResponde({ ofertaClyon: "distribuida" })).toBe("a CLYON");
  });

  it("«Falar com a CLYON» abre o WhatsApp do número do site", () => {
    expect(whatsAppDaClyon("Pedido #1")).toBe("https://wa.me/351931632622?text=Pedido%20%231");
  });

  /*
   * A app lê a resposta de `meus-pedidos` como um `Trabalho`. Um campo que a
   * app espere e o site não mande chega como `undefined`, e o ecrã cala-se
   * sem ninguém dar por isso. A lista sai do tipo da app, e não de uma lista
   * escrita aqui.
   */
  it("cada campo do tipo da app vem na resposta do site", () => {
    const tipo = readFileSync(join(process.cwd(), "app-pro", "src", "lib", "trabalhos.ts"), "utf8");
    const i = tipo.indexOf("export type Trabalho = {");
    expect(i).toBeGreaterThan(-1);
    const corpo = tipo.slice(i, tipo.indexOf("\n};", i));
    const campos = [...corpo.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(campos.length).toBeGreaterThan(40);
    const rota = readFileSync(join(process.cwd(), "src", "app", "api", "profissionais", "meus-pedidos", "route.ts"), "utf8");
    const faltam = campos.filter((c) => !new RegExp(String.raw`^\s+${c}(:|,)`, "m").test(rota));
    expect(faltam).toEqual([]);
  });
});
