import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  camposDoServico,
  CONFIANCA_MAXIMA_DAS_FOTOGRAFIAS,
  entradaDoLeitor,
  esquecerAsLeituras,
  ESQUEMA_DO_LEITOR,
  fotografiaNossa,
  fraseAoCliente,
  GRUPO_DO_SERVICO,
  INSTRUCAO_DO_LEITOR,
  lerOPedido,
  lerPedidoParaOLeitor,
  lerRespostaDoLeitor,
  numerosDoTexto,
  oQueSeViuQuePassa,
  PORQUE_SEM_FRASE,
  sugestoesQuePassam,
  type PedidoParaOLeitor,
  type RespostaDoLeitor,
  type SugestaoBruta,
} from "./ler-pedido-pelo-modelo";
import { SERVICOS_PUBLICOS } from "./service-categories";
import { MODELO_ACTUAL } from "./modelo-do-gemini";
import { NOME_DO_USO, USOS_DA_IA } from "./saude-da-ia";

/**
 * O LEITOR DO PEDIDO — 03-11-2026 (decisão d1 v1). A app de cliente manda a
 * descrição e as fotografias; o modelo sugere as respostas do simulador.
 *
 * As descrições são INVENTADAS (o repositório é público): nunca frases de
 * clientes reais. Nas fotografias, a resposta do modelo é simulada — nenhuma
 * chamada sai daqui.
 */

const anotadas: Array<{ uso: string; motivo: string | null }> = [];
vi.mock("./saude-da-ia-na-base", () => ({
  anotarSaudeDaIa: async (uso: string, motivo: string | null) => {
    anotadas.push({ uso, motivo });
  },
  falhasDaIa: async () => [],
}));

/** As fotografias que o leitor foi buscar — só as nossas podem aparecer aqui. */
const abertas: string[] = [];
vi.mock("./url-externo-seguro", async (importOriginal) => {
  const real = await importOriginal<typeof import("./url-externo-seguro")>();
  return {
    ...real,
    buscarImagemExterna: async (u: string) => {
      abertas.push(u);
      return { buffer: Buffer.from("imagem-de-teste"), mimeType: "image/jpeg" };
    },
  };
});

vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({ erro: null })) }));

/** Como responde cada chamada ao modelo, pela ordem; o que sobra repete a última. */
type RespostaSimulada = { erro?: string; texto?: string; uso?: Record<string, number> };
let respostas: RespostaSimulada[] = [];
const chamados: string[] = [];
const partesEnviadas: unknown[][] = [];
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel({ model }: { model: string }) {
      return {
        generateContent: async (partes: unknown[]) => {
          chamados.push(model);
          partesEnviadas.push(partes);
          const r = respostas[Math.min(chamados.length - 1, respostas.length - 1)] ?? { erro: "sem resposta" };
          if (r.erro) throw new Error(r.erro);
          return { response: { text: () => r.texto ?? "", usageMetadata: r.uso } };
        },
      };
    }
  },
}));

const NOSSO = "loja123abc.public.blob.vercel-storage.com";
const ENV = { CLYON_BLOB_HOST: NOSSO };
const foto = (n: number) => `https://${NOSSO}/pedidos/fotografia-${n}.jpg`;
const COM_TEMPO = 60_000;

const sug = (campo: string, valor: string, confianca = 0.9, origem = "descricao", porque = "Escreveu-o na descrição."): SugestaoBruta => ({
  campo,
  valor,
  confianca,
  porque,
  origem,
});
const resposta = (sugestoes: SugestaoBruta[], nasFotografias = ""): RespostaDoLeitor => ({ sugestoes, nasFotografias });
const pedido = (servico: string, descricao: string, extra: Partial<PedidoParaOLeitor> = {}): PedidoParaOLeitor => ({
  servico,
  descricao,
  respostas: {},
  fotografias: [],
  fotografiasRecebidas: 0,
  ...extra,
});
const porCampo = (s: ReturnType<typeof sugestoesQuePassam>) => Object.fromEntries(s.map((x) => [x.campo, x]));

/* ──────────────────────────────────────────────────────────────────────── */

describe("1. os campos de cada categoria", () => {
  it("todos os serviços do site têm as suas perguntas, e os de fora do plano nenhuma", () => {
    for (const s of SERVICOS_PUBLICOS) expect(GRUPO_DO_SERVICO[s.id], s.id).toBeDefined();
    expect(camposDoServico("montagem_moveis")).toEqual([]);
    expect(camposDoServico("jardinagem")).toEqual([]);
    expect(camposDoServico("nao_existe")).toEqual([]);
  });

  it("cada categoria pede o que é dela, com os ids do simulador", () => {
    const ids = (s: string) => camposDoServico(s).map((c) => c.id);
    expect(ids("recolha_entulho")).toEqual(["entulho", "tipoDeSaco", "quantidade", "ensacados", "porEnsacar", "entulhoVolume", "floor", "hasElevator", "parkingDistance"]);
    expect(ids("esvaziamento_apartamento")).toEqual(["tipologia", "volume", "desmontagem", "floor", "hasElevator", "parkingDistance"]);
    expect(ids("esvaziamento_garagem")).not.toContain("tipologia");
    expect(ids("manutencao_casa")).toEqual(["tipoDeTrabalho", "quantoTrabalho", "materiais", "floor", "hasElevator", "parkingDistance"]);
    expect(ids("recolha_moveis")).toEqual(["movelModo", "itens", "volume", "desmontagem", "floor", "hasElevator", "parkingDistance"]);
    const tipologia = camposDoServico("esvaziamento_casa").find((c) => c.id === "tipologia");
    expect(tipologia && tipologia.tipo === "opcao" ? tipologia.opcoes : []).toEqual(["T0/T1", "T2", "T3/T4", "moradia"]);
  });

  it("o «não sei» nunca é sugestão", () => {
    for (const s of SERVICOS_PUBLICOS) {
      for (const c of camposDoServico(s.id)) {
        if (c.tipo === "opcao") expect(c.opcoes.filter((o) => /^(unknown|incerto|nao_sei)$/.test(o)), `${s.id}.${c.id}`).toEqual([]);
      }
    }
  });

  it.skipIf(!existsSync(join(process.cwd(), "src/lib/simulador-por-categoria.ts")))(
    "a mesma língua do simulador por categoria do Site: cada campo sugerido existe lá",
    () => {
      const doSite = readFileSync(join(process.cwd(), "src/lib/simulador-por-categoria.ts"), "utf8");
      const ids = new Set(SERVICOS_PUBLICOS.flatMap((s) => camposDoServico(s.id).map((c) => c.id)));
      for (const id of ids) expect(doSite, id).toContain(id);
    },
  );
});

describe("2. o que entra: só as fotografias do NOSSO armazenamento", () => {
  it("o anfitrião exacto do nosso store, https, sem pergunta — nada de fora", () => {
    expect(fotografiaNossa(foto(1), ENV)).toBe(foto(1));
    expect(fotografiaNossa("https://example.com/a.jpg", ENV)).toBeNull();
    expect(fotografiaNossa("https://outra456.public.blob.vercel-storage.com/a.jpg", ENV)).toBeNull();
    expect(fotografiaNossa(`http://${NOSSO}/a.jpg`, ENV)).toBeNull();
    expect(fotografiaNossa(`${foto(1)}?download=1`, ENV)).toBeNull();
    expect(fotografiaNossa(`https://${NOSSO}.example.com/a.jpg`, ENV)).toBeNull();
    expect(fotografiaNossa("javascript:alert(1)", ENV)).toBeNull();
    // Sem saber qual é o nosso store, não se abre nenhuma.
    expect(fotografiaNossa(foto(1), {})).toBeNull();
  });

  it("até 6, sem repetidas; os endereços de fora contam como recebidos e não se abrem", () => {
    const p = lerPedidoParaOLeitor(
      {
        servico: "recolha_moveis",
        descricao: "  3 sofás  ",
        fotografias: [foto(1), "https://example.com/x.jpg", foto(1), ...[2, 3, 4, 5, 6, 7, 8].map(foto)],
      },
      ENV,
    );
    expect(p?.fotografias).toEqual([1, 2, 3, 4, 5, 6].map(foto));
    expect(p?.fotografiasRecebidas).toBe(10);
    expect(p?.descricao).toBe("3 sofás");
  });

  it("as respostas: só os campos do serviço, com valores curtos", () => {
    const p = lerPedidoParaOLeitor(
      {
        servico: "recolha_entulho",
        descricao: "x",
        respostas: { floor: "3º", quantidade: 50, preco: 90, tipologia: "T2", entulho: "a".repeat(60), itens: { grande: 2 } },
      },
      ENV,
    );
    expect(p?.respostas).toEqual({ floor: "3º", quantidade: 50 });
  });

  it("pedidos inválidos dão null (400)", () => {
    expect(lerPedidoParaOLeitor(null, ENV)).toBeNull();
    expect(lerPedidoParaOLeitor([], ENV)).toBeNull();
    expect(lerPedidoParaOLeitor({ servico: "Recolha de Móveis" }, ENV)).toBeNull();
    expect(lerPedidoParaOLeitor({ servico: "recolha_moveis" }, ENV)?.descricao).toBe("");
  });

  it("a entrada do modelo vai sem contactos nem códigos postais", () => {
    const e = entradaDoLeitor(pedido("recolha_monos", "Tralha na garagem, ligue 912 345 678 ou geral@exemplo.pt, 1100-001"), 0);
    expect(e).toContain("SERVIÇO: Recolha de monos");
    expect(e).toContain("Tralha na garagem");
    expect(e).not.toMatch(/912|exemplo\.pt|1100-001/);
    expect(e).toContain("FOTOGRAFIAS: nenhuma");
    expect(e).toContain("- volume: carrinha | camiao_caixa | camiao_lixo");
  });
});

describe("3. os números que a pessoa escreveu", () => {
  it("em algarismos e por extenso", () => {
    expect([...numerosDoTexto("tenho 50 sacos, 3.º andar")]).toEqual(expect.arrayContaining([50, 3]));
    expect(numerosDoTexto("dois big bags").has(2)).toBe(true);
    expect(numerosDoTexto("vinte e cinco sacos").has(25)).toBe(true);
    expect(numerosDoTexto("meia dúzia de caixas").has(6)).toBe(true);
    expect(numerosDoTexto("três sofás").has(3)).toBe(true);
    expect(numerosDoTexto("sacos").size).toBe(0);
  });
});

describe("4. as descrições inventadas da ordem — a resposta do modelo, verificada", () => {
  it("«tenho 50 sacos de entulho da obra da casa de banho, 3.º andar sem elevador»", () => {
    const p = pedido("recolha_entulho", "tenho 50 sacos de entulho da obra da casa de banho, 3.º andar sem elevador");
    const s = porCampo(
      sugestoesQuePassam(
        resposta([
          sug("entulho", "ensacado", 0.9, "descricao", "Disse que já está em sacos."),
          sug("tipoDeSaco", "pequeno", 0.7, "descricao", "Sacos de obra, dos pequenos."),
          sug("quantidade", "50", 0.95, "descricao", "Escreveu «50 sacos»."),
          sug("floor", "3.º", 0.95, "descricao", "Escreveu «3.º andar»."),
          sug("hasElevator", "não", 0.95, "descricao", "Disse que não tem elevador."),
          // inventado: 80 não está na descrição, e não há fotografias
          sug("porEnsacar", "80", 0.5),
        ]),
        p,
        0,
      ),
    );
    expect(Object.keys(s)).toEqual(["entulho", "tipoDeSaco", "quantidade", "floor", "hasElevator"]);
    expect(s.quantidade.valor).toBe(50);
    expect(s.floor.valor).toBe("3º");
    expect(s.hasElevator.valor).toBe("no");
    expect(s.quantidade.porque).toBe("Escreveu «50 sacos».");
    expect(s.entulho.origem).toBe("descricao");
  });

  it("«2 big bags no quintal» — na medida do cliente, e sem acesso inventado", () => {
    const p = pedido("recolha_entulho", "2 big bags no quintal");
    const s = porCampo(
      sugestoesQuePassam(
        resposta([
          sug("entulho", "ensacado", 0.85),
          sug("tipoDeSaco", "bigbag", 0.95, "descricao", "Escreveu «2 big bags» (cerca de 76 sacos pequenos)."),
          sug("quantidade", "2", 0.95),
          // a conversão para sacos não é o que ele disse: fica de fora
          sug("ensacados", "76", 0.6),
          // nada na descrição diz o andar nem o estacionamento
          sug("floor", "rés-do-chão", 0.7),
          sug("parkingDistance", "door", 0.6),
        ]),
        p,
        0,
      ),
    );
    expect(Object.keys(s)).toEqual(["entulho", "tipoDeSaco", "quantidade"]);
    expect(s.tipoDeSaco.valor).toBe("bigbag");
    expect(s.quantidade.valor).toBe(2);
  });

  it("«trocar uma torneira e pintar um quarto» — e nunca um preço", () => {
    const p = pedido("manutencao_casa", "trocar uma torneira e pintar um quarto");
    const lista = sugestoesQuePassam(
      resposta([
        sug("tipoDeTrabalho", "pintura", 0.75, "descricao", "Pintar um quarto dá mais trabalho; há também a torneira."),
        sug("quantoTrabalho", "varias_pequenas", 0.7),
        sug("materiais", "parceiro", 0.4, "descricao", "Os materiais custam cerca de 80 euros."),
        sug("preco", "120", 0.9),
        sug("valorEstimado", "150", 0.9),
      ]),
      p,
      0,
    );
    const s = porCampo(lista);
    expect(Object.keys(s)).toEqual(["tipoDeTrabalho", "quantoTrabalho", "materiais"]);
    expect(s.materiais.porque).toBe(PORQUE_SEM_FRASE.descricao);
    for (const x of lista) expect(Object.keys(x).every((k) => ["campo", "valor", "confianca", "porque", "origem", "discorda"].includes(k))).toBe(true);
    expect(JSON.stringify(lista)).not.toMatch(/€|euro|pre[çc]o|custa/i);
  });

  it("«esvaziar um T2 cheio»", () => {
    const p = pedido("esvaziamento_apartamento", "esvaziar um T2 cheio");
    const s = porCampo(
      sugestoesQuePassam(
        resposta([sug("tipologia", "t2", 0.95, "descricao", "Escreveu «T2»."), sug("volume", "camiao_caixa", 0.5, "descricao", "Disse que está cheio.")]),
        p,
        0,
      ),
    );
    expect(s.tipologia.valor).toBe("T2");
    expect(s.volume.valor).toBe("camiao_caixa");
    expect(s.volume.confianca).toBe(0.5);
  });

  it("as tipologias que os modelos escrevem de outra maneira", () => {
    const tip = (servico: string, valor: string) =>
      sugestoesQuePassam(resposta([sug("tipologia", valor)]), pedido(servico, "a casa toda"), 0)[0]?.valor;
    expect(tip("mudanca", "T5")).toBe("T4+");
    expect(tip("mudanca", "T0")).toBe("T0");
    expect(tip("esvaziamento_casa", "T1")).toBe("T0/T1");
    expect(tip("esvaziamento_casa", "T4")).toBe("T3/T4");
    expect(tip("esvaziamento_casa", "moradia")).toBe("moradia");
    expect(tip("esvaziamento_casa", "castelo")).toBeUndefined();
  });
});

describe("5. as fotografias", () => {
  const p = pedido("recolha_moveis", "", { fotografias: [foto(1), foto(2)], fotografiasRecebidas: 2 });

  it("o que só se vê nas fotografias vale, mas nunca com mais de 0,6; o acesso nunca vem delas", () => {
    const lista = sugestoesQuePassam(
      resposta(
        [
          sug("movelModo", "item", 0.9, "fotografias", "Nas fotografias vêem-se peças soltas."),
          sug("itens.grande", "3", 0.9, "fotografias", "Nas fotografias parecem ser 3 sofás."),
          sug("itens.pequeno", "0", 0.9, "fotografias"),
          sug("floor", "2º", 0.8, "fotografias"),
          sug("hasElevator", "yes", 0.8, "fotografias"),
        ],
        "3 sofás numa sala",
      ),
      p,
      2,
    );
    const s = porCampo(lista);
    expect(Object.keys(s)).toEqual(["movelModo", "itens"]);
    expect(s.itens.valor).toEqual({ pequeno: 0, medio: 0, grande: 3 });
    expect(s.itens.confianca).toBe(CONFIANCA_MAXIMA_DAS_FOTOGRAFIAS);
    expect(s.itens.origem).toBe("fotografias");
    expect(s.movelModo.confianca).toBe(0.6);
  });

  it("um número que não está na descrição passa a ser «das fotografias» quando há fotografias", () => {
    const comTexto = pedido("recolha_entulho", "entulho da obra na sala", { fotografias: [foto(1)], fotografiasRecebidas: 1 });
    const s = porCampo(sugestoesQuePassam(resposta([sug("quantidade", "30", 0.9, "descricao", "Cerca de 30 sacos.")]), comTexto, 1));
    expect(s.quantidade.origem).toBe("fotografias");
    expect(s.quantidade.confianca).toBe(0.6);
  });

  it("«viu-se nas fotografias» sem fotografia nenhuma vista é inventado", () => {
    const sem = pedido("recolha_moveis", "uns móveis");
    expect(sugestoesQuePassam(resposta([sug("itens.grande", "3", 0.9, "fotografias"), sug("movelModo", "item", 0.9, "fotografias")]), sem, 0)).toEqual([]);
  });

  it("a frase do que se vê: só com fotografias vistas, e sem falar de pessoas nem de dinheiro", () => {
    expect(oQueSeViuQuePassa(resposta([], "cerca de 30 sacos de entulho numa sala"), 1)).toBe("Cerca de 30 sacos de entulho numa sala.");
    expect(oQueSeViuQuePassa(resposta([], "cerca de 30 sacos"), 0)).toBeNull();
    expect(oQueSeViuQuePassa(resposta([], "um homem ao lado de um sofá"), 1)).toBeNull();
    expect(oQueSeViuQuePassa(resposta([], "um sofá que vale uns 50 euros"), 1)).toBeNull();
    expect(oQueSeViuQuePassa(resposta([], "(nada)"), 1)).toBeNull();
  });
});

describe("6. as respostas que o cliente já deu", () => {
  it("a mesma não volta; uma diferente volta marcada", () => {
    const p = pedido("recolha_entulho", "50 sacos, 3.º andar, sem elevador", { respostas: { floor: "3º", hasElevator: "yes" } });
    const s = porCampo(sugestoesQuePassam(resposta([sug("floor", "3º"), sug("hasElevator", "no"), sug("quantidade", "50")]), p, 0));
    expect(s.floor).toBeUndefined();
    expect(s.hasElevator.discorda).toBe(true);
    expect(s.quantidade.discorda).toBeUndefined();
  });

  it("no rés-do-chão o elevador não interessa", () => {
    const p = pedido("recolha_monos", "rés-do-chão, sem elevador");
    const s = porCampo(sugestoesQuePassam(resposta([sug("floor", "r/c"), sug("hasElevator", "no")]), p, 0));
    expect(s.floor.valor).toBe("rés-do-chão");
    expect(s.hasElevator).toBeUndefined();
  });
});

describe("7. as frases para o cliente", () => {
  it("sem dinheiro, sem contactos, português de Portugal, parceiro e não «profissional»", () => {
    expect(fraseAoCliente("Escreveu «50 sacos».")).toBe(true);
    expect(fraseAoCliente("Fica por 90 €.")).toBe(false);
    expect(fraseAoCliente("O preço é baixo.")).toBe(false);
    expect(fraseAoCliente("Você disse 50 sacos.")).toBe(false);
    expect(fraseAoCliente("O profissional leva tudo.")).toBe(false);
    expect(fraseAoCliente("Ligue para 912 345 678.")).toBe(false);
    expect(fraseAoCliente("Na Rua das Flores 12.")).toBe(false);
    expect(fraseAoCliente("Vale a pena 😀")).toBe(false);
  });

  it("o aviso ao modelo fala de plataforma e de parceiros, e o esquema não tem onde pôr um preço", () => {
    expect(INSTRUCAO_DO_LEITOR).toContain("plataforma");
    expect(INSTRUCAO_DO_LEITOR).toContain("liga clientes a parceiros");
    // «verificado» só junto do selo de um parceiro com as três confirmações (regra q da orquestra).
    expect(INSTRUCAO_DO_LEITOR).not.toMatch(/verificad/i);
    expect(INSTRUCAO_DO_LEITOR).not.toMatch(/profission/i);
    expect(INSTRUCAO_DO_LEITOR).toContain("Sem preços");
    expect(Object.keys(ESQUEMA_DO_LEITOR.properties)).toEqual(["sugestoes", "nasFotografias"]);
    expect(Object.keys(ESQUEMA_DO_LEITOR.properties.sugestoes.items.properties)).toEqual(["campo", "valor", "confianca", "porque", "origem"]);
  });

  it("a resposta do modelo lê-se com tolerância, e o que não é resposta é null", () => {
    expect(lerRespostaDoLeitor('```json\n{"sugestoes":[{"campo":"quantidade","valor":50,"confianca":"0.9","porque":"x","origem":"descricao"}],"nasFotografias":""}\n```'))
      .toEqual({ sugestoes: [{ campo: "quantidade", valor: "50", confianca: 0.9, porque: "x", origem: "descricao" }], nasFotografias: "" });
    expect(lerRespostaDoLeitor('Aqui está: {"sugestoes":[],"nasFotografias":"3 sofás"} fim')?.nasFotografias).toBe("3 sofás");
    expect(lerRespostaDoLeitor("isto não é JSON")).toBeNull();
    expect(lerRespostaDoLeitor('{"outra":1}')).toBeNull();
  });
});

/* ──────────────────────────────────────────────────────────────────────── */

const BOA_DO_ENTULHO = JSON.stringify({
  sugestoes: [
    { campo: "entulho", valor: "ensacado", confianca: 0.9, porque: "Disse que já está em sacos.", origem: "descricao" },
    { campo: "quantidade", valor: "50", confianca: 0.95, porque: "Escreveu «50 sacos».", origem: "descricao" },
    { campo: "floor", valor: "3º", confianca: 0.95, porque: "Escreveu «3.º andar».", origem: "descricao" },
    { campo: "hasElevator", valor: "no", confianca: 0.95, porque: "Disse que não tem elevador.", origem: "descricao" },
  ],
  nasFotografias: "",
});

describe("8. a chamada: o modelo responde, falha ou não está — e nunca calado", () => {
  const antes = { ...process.env };
  let erros: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    anotadas.length = 0;
    chamados.length = 0;
    partesEnviadas.length = 0;
    abertas.length = 0;
    respostas = [];
    esquecerAsLeituras();
    process.env.GEMINI_API_KEY = "chave-de-teste";
    process.env.CLYON_BLOB_HOST = NOSSO;
    delete process.env.WHATSAPP_GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;
    erros = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...antes };
    vi.restoreAllMocks();
  });

  const ENTULHO = pedido("recolha_entulho", "tenho 50 sacos de entulho da obra da casa de banho, 3.º andar sem elevador");

  it("o termómetro do painel tem o uso «Leitura dos pedidos da app»", () => {
    expect(USOS_DA_IA).toContain("leitor");
    expect(NOME_DO_USO.leitor).toBe("Leitura dos pedidos da app");
  });

  it("a ler bem: as sugestões saem verificadas, o termómetro limpa, e diz o que gastou", async () => {
    respostas = [{ texto: BOA_DO_ENTULHO, uso: { promptTokenCount: 900, candidatesTokenCount: 120, totalTokenCount: 1400 } }];
    const { leitura, uso } = await lerOPedido(ENTULHO);
    expect(leitura.ok).toBe(true);
    expect(leitura.sugestoes.map((s) => s.campo)).toEqual(["entulho", "quantidade", "floor", "hasElevator"]);
    expect(leitura.fotografias).toEqual({ recebidas: 0, vistas: 0 });
    expect(chamados).toEqual([MODELO_ACTUAL]);
    expect(uso).toMatchObject({ modelo: MODELO_ACTUAL, entrada: 900, saida: 120, pensamento: 380 });
    expect(anotadas).toEqual([{ uso: "leitor", motivo: null }]);
  }, COM_TEMPO);

  it("com fotografias: só as nossas se abrem, e vão ao modelo antes do texto", async () => {
    respostas = [
      {
        texto: JSON.stringify({
          sugestoes: [
            { campo: "movelModo", valor: "item", confianca: 0.9, porque: "Vêem-se peças soltas.", origem: "fotografias" },
            { campo: "itens.grande", valor: "3", confianca: 0.9, porque: "Nas fotografias parecem ser 3 sofás.", origem: "fotografias" },
          ],
          nasFotografias: "3 sofás numa sala",
        }),
      },
    ];
    const p = lerPedidoParaOLeitor(
      { servico: "recolha_moveis", descricao: "", fotografias: [foto(1), "https://example.com/x.jpg", `http://${NOSSO}/y.jpg`, foto(2)] },
      process.env,
    );
    expect(p).not.toBeNull();
    const { leitura } = await lerOPedido(p!);
    expect(abertas).toEqual([foto(1), foto(2)]);
    const partes = partesEnviadas[0] as Array<Record<string, unknown>>;
    expect(partes.filter((x) => "inlineData" in x)).toHaveLength(2);
    expect(partes.at(-1)).toHaveProperty("text");
    expect(leitura.fotografias).toEqual({ recebidas: 4, vistas: 2 });
    expect(leitura.nasFotografias).toBe("3 sofás numa sala.");
    expect(leitura.sugestoes.find((s) => s.campo === "itens")).toMatchObject({ valor: { pequeno: 0, medio: 0, grande: 3 }, confianca: 0.6, origem: "fotografias" });
  }, COM_TEMPO);

  it("sem quota (429): { ok: true, sugestoes: [] }, e a falha fica no termómetro e na consola", async () => {
    respostas = [{ erro: "[429 Too Many Requests] You exceeded your current quota" }];
    const { leitura } = await lerOPedido(ENTULHO);
    expect(leitura).toEqual({ ok: true, sugestoes: [], nasFotografias: null, fotografias: { recebidas: 0, vistas: 0 } });
    expect(anotadas.at(-1)?.uso).toBe("leitor");
    expect(anotadas.at(-1)?.motivo).toMatch(/429.*a app seguiu sem sugestões/);
    expect(erros).toHaveBeenCalled();
  }, COM_TEMPO);

  it("fora do formato: pergunta-se outra vez; duas vezes fora, vazio — e o registo não leva o que o cliente escreveu", async () => {
    respostas = [{ texto: "50 sacos no 3.º andar" }, { texto: BOA_DO_ENTULHO }];
    const certo = await lerOPedido(ENTULHO);
    expect(chamados).toHaveLength(2);
    expect(certo.leitura.sugestoes.length).toBeGreaterThan(0);

    esquecerAsLeituras();
    chamados.length = 0;
    respostas = [{ texto: "50 sacos no 3.º andar" }];
    const fora = await lerOPedido(ENTULHO);
    expect(fora.leitura.sugestoes).toEqual([]);
    expect(chamados).toHaveLength(2);
    expect(anotadas.at(-1)?.motivo).toMatch(/fora do formato \(texto \d+ car\./);
    expect(anotadas.at(-1)?.motivo).not.toContain("sacos");
  }, COM_TEMPO);

  it("sem chave: vazio, e diz-se", async () => {
    delete process.env.GEMINI_API_KEY;
    const { leitura } = await lerOPedido(ENTULHO);
    expect(leitura.sugestoes).toEqual([]);
    expect(chamados).toEqual([]);
    expect(anotadas).toEqual([{ uso: "leitor", motivo: "sem GEMINI_API_KEY — a app seguiu sem sugestões" }]);
  }, COM_TEMPO);

  it("o mesmo pedido duas vezes em dez minutos paga uma chamada", async () => {
    respostas = [{ texto: BOA_DO_ENTULHO }];
    await lerOPedido(ENTULHO);
    const segunda = await lerOPedido(ENTULHO);
    expect(chamados).toHaveLength(1);
    expect(segunda.leitura.sugestoes).toHaveLength(4);
  }, COM_TEMPO);

  it("sem nada para ler, ou num serviço fora do plano, não se chama o modelo", async () => {
    await lerOPedido(pedido("recolha_entulho", "  "));
    await lerOPedido(pedido("montagem_moveis", "montar um roupeiro"));
    expect(chamados).toEqual([]);
  }, COM_TEMPO);
});

describe("9. a rota POST /api/cliente/ler-pedido", () => {
  const antes = { ...process.env };
  beforeEach(() => {
    chamados.length = 0;
    respostas = [];
    esquecerAsLeituras();
    process.env.GEMINI_API_KEY = "chave-de-teste";
    process.env.CLYON_BLOB_HOST = NOSSO;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...antes };
    vi.restoreAllMocks();
  });

  const post = async (corpo: string) => {
    const { POST } = await import("@/app/api/cliente/ler-pedido/route");
    return POST(new NextRequest("https://clyon.pt/api/cliente/ler-pedido", { method: "POST", body: corpo, headers: { "content-type": "application/json" } }));
  };

  it("um corpo que não se lê, ou sem serviço, é 400", async () => {
    expect((await post("{isto")).status).toBe(400);
    expect((await post(JSON.stringify({ descricao: "50 sacos" }))).status).toBe(400);
  }, COM_TEMPO);

  it("um pedido bom: 200, as sugestões e o que gastou num cabeçalho", async () => {
    respostas = [{ texto: BOA_DO_ENTULHO, uso: { promptTokenCount: 900, candidatesTokenCount: 120, totalTokenCount: 1020 } }];
    const r = await post(JSON.stringify({ servico: "recolha_entulho", descricao: "tenho 50 sacos de entulho da obra da casa de banho, 3.º andar sem elevador" }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.sugestoes.map((s: { campo: string }) => s.campo)).toEqual(["entulho", "quantidade", "floor", "hasElevator"]);
    expect(r.headers.get("x-leitura-tokens")).toMatch(/^entrada=900; saida=120; pensamento=0; ms=\d+$/);
    expect(r.headers.get("cache-control")).toBe("no-store");
  }, COM_TEMPO);

  it("o modelo em baixo: 200 com a lista vazia — a app segue com as perguntas", async () => {
    respostas = [{ erro: "503 Service Unavailable" }];
    const r = await post(JSON.stringify({ servico: "recolha_entulho", descricao: "2 big bags no quintal" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, sugestoes: [], nasFotografias: null, fotografias: { recebidas: 0, vistas: 0 } });
  }, COM_TEMPO);
});
