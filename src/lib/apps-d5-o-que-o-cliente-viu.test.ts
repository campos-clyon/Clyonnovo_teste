import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/db", () => ({ candidatosDaListaDasMudancas: vi.fn(async () => []) }));
vi.mock("@/lib/distancia-rodoviaria", () => ({ distanciaRodoviaria: vi.fn(async () => null), distanciasRodoviarias: vi.fn(async () => []) }));
vi.mock("@/lib/geocodificar", () => ({ geocodificarMorada: vi.fn(async () => null) }));
vi.mock("@/lib/bloqueio-do-profissional", () => ({ profissionaisBloqueadosEmDinheiro: vi.fn(async () => new Set<number>()) }));
vi.mock("@/lib/ficha-no-google", () => ({ notasNoGoogle: vi.fn(async () => new Map()), PRAZO_DA_NOTA_DO_GOOGLE_MS: 1000 }));

import { congelarTarifa, type TarifaDasMudancas } from "./conta-da-mudanca";
import { camposDaFolha, contextoDaFolha, lerFolha, rascunhoDeJson, type CamposDaFolha } from "./folha-da-mudanca";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { conferirMarcaDaFolha, FOLHA_MUDOU, marcaDaFolha, PRECO_MUDOU, SEM_MARCA_ATE } from "./o-que-o-cliente-viu";
import { assinaturaDoPreco, conferirAssinaturasDoPreco } from "./parceiros-da-mudanca";
import { MAXIMO_DE_ESCOLHIDOS, ORDENACAO, TEXTOS_DA_LISTA, cartaoDoParceiro, type CandidatoDaMudanca, type ContextoDaMudanca } from "./lista-de-parceiros-da-mudanca";
import { aFolhaMudou, corpoDasHoras } from "../../app-cliente/src/lib/pedidos";
import { camposDaEscolha, escolhaFeita, listaValida, voltaALista } from "../../app-cliente/src/lib/parceiros-da-mudanca";
import { camposDeAbrir, folhaAMeioVale, folhasAMeioEm, rascunhoMaisRecente } from "../../app-pro/src/lib/folha-a-meio";
import type { Trabalho } from "../../app-pro/src/lib/trabalhos";

/*
 * A PARTE DAS APPS DA d5 — 11-11-2026 (ordem do CEO com o sim do dono):
 * «o que o cliente viu é o que se grava» e «a folha não se perde».
 *
 *   1. A app de cliente devolve a marca da folha no «Confirmo a folha».
 *   2. Se a folha mudou (409 `folhaMudou`), relê o pedido e diz a frase do site.
 *   3. A app de cliente devolve a assinatura do preço de cada parceiro escolhido.
 *   4. Se o preço mudou (`precoMudou`), volta à lista com a frase do site.
 *   5. Na app Pro, a folha a meio fica guardada (site e telemóvel) e repõe-se.
 *   6. O início vem com a hora do «Cheguei», em Lisboa.
 *   7. O que fica no telemóvel são só horas e quantidades.
 *   8. Enviar a folha, fechar o trabalho ou sair da conta apaga o rascunho.
 *
 * O servidor só aceita pedidos sem marca nem assinatura até `SEM_MARCA_ATE`.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários de bloco e de linha inteira: o que se afirma é sobre o código. */
const codigo = (p: string) =>
  ler(p)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const CHAVE = "segredo-de-teste";
const TARIFA: TarifaDasMudancas = {
  precoHora2: 50,
  precoHora3: 65,
  minimoHoras: 3,
  precoKm: 0.6,
  kmMinimo: 10,
  kmMaximo: 80,
  caixa: 2,
  cartaoMetro: 1.5,
  filmeRolo: 10,
  plasticoBolhaRolo: 20,
  aparecerNaLista: true,
};

/* ── 1 e 2: a folha vista ─────────────────────────────────────────────────── */

describe("app de cliente: o «Confirmo a folha» leva a marca da folha que está no ecrã", () => {
  const MARCA = marcaDaFolha('{"inicio":"09:00","fim":"13:00"}') as string;

  it("a marca do site tem 32 caracteres e volta em `marcaDaFolha`, tal e qual", () => {
    expect(MARCA).toHaveLength(32);
    const corpo = corpoDasHoras({ pedidoId: 500, negociacaoId: 9, accao: "confirmar_horas", marcaDaFolha: MARCA });
    expect(corpo).toEqual({ pedidoId: 500, negociacaoId: 9, accao: "confirmar_horas", marcaDaFolha: MARCA });
    // O servidor aceita-a com a folha que ele viu, e recusa-a com outra — mesmo depois do prazo da transição.
    const depois = new Date((instanteEmLisboa(SEM_MARCA_ATE) as Date).getTime() + 60_000);
    expect(conferirMarcaDaFolha((corpo as { marcaDaFolha?: string }).marcaDaFolha, MARCA, depois)).toBe("igual");
    expect(conferirMarcaDaFolha((corpo as { marcaDaFolha?: string }).marcaDaFolha, marcaDaFolha('{"inicio":"09:00","fim":"14:00"}'), depois)).toBe("mudou");
  });

  it("o «Não concordo» não leva marca, e sem folha da mudança não se inventa uma", () => {
    expect(corpoDasHoras({ pedidoId: 500, negociacaoId: 9, accao: "contestar_horas", motivo: " Foram menos horas. ", marcaDaFolha: MARCA })).toEqual({
      pedidoId: 500,
      negociacaoId: 9,
      accao: "contestar_horas",
      motivo: "Foram menos horas.",
    });
    for (const semMarca of [null, undefined, ""]) {
      expect(corpoDasHoras({ pedidoId: 500, negociacaoId: 9, accao: "confirmar_horas", marcaDaFolha: semMarca })).toEqual({
        pedidoId: 500,
        negociacaoId: 9,
        accao: "confirmar_horas",
      });
    }
  });

  it("o ecrã entrega a marca da negociação que mostra, e o tipo da folha tem-na", () => {
    expect(codigo("app-cliente/src/componentes/HorasDoTrabalho.tsx")).toMatch(/corpoDasHoras\(\{[^}]*marcaDaFolha:\s*n\.horas\?\.folha\?\.marca/);
    const tipos = ler("app-cliente/src/lib/pedidos.ts");
    const bloco = tipos.slice(tipos.indexOf("export type FolhaParaOCliente"), tipos.indexOf("export type HorasDoTrabalho"));
    expect(bloco).toMatch(/marca\?: string \| null;/);
  });
});

describe("app de cliente: a folha mudou — relê o pedido e mostra a nova com a frase do site", () => {
  it("reconhece a resposta do site", () => {
    expect(aFolhaMudou({ ok: false, error: FOLHA_MUDOU, folhaMudou: true })).toBe(true);
    expect(aFolhaMudou({ ok: false, error: "Outra coisa." })).toBe(false);
    expect(aFolhaMudou(null)).toBe(false);
  });

  it("a acção relê o pedido antes de devolver a frase, e o cartão da folha mostra-a", () => {
    const vista = codigo("app-cliente/src/componentes/VistaDoPedido.tsx");
    const inicio = vista.search(/const agir = useCallback\(/);
    expect(inicio).toBeGreaterThan(-1);
    const agir = vista.slice(inicio, vista.indexOf("async function contratar"));
    const ramo = agir.search(/e\.estado === 409 \|\| aFolhaMudou\(e\.corpo\)/);
    expect(ramo).toBeGreaterThan(-1);
    const depois = agir.slice(ramo);
    expect(depois.indexOf("await carregar()")).toBeGreaterThan(-1);
    expect(depois.indexOf("await carregar()")).toBeLessThan(depois.indexOf("return mensagemDe(e)"));
    // A frase que a acção devolve fica no cartão das horas (por cima dos botões da folha nova).
    const cartao = codigo("app-cliente/src/componentes/HorasDoTrabalho.tsx");
    expect(cartao).toMatch(/if \(e\) setErro\(e\)/);
    expect(cartao).toMatch(/erro && !aContestar \? <Aviso texto=\{erro\}/);
  });
});

/* ── 3 e 4: o preço visto ─────────────────────────────────────────────────── */

function candidato(id: number, nome: string): CandidatoDaMudanca & { tarifa: TarifaDasMudancas } {
  return {
    id,
    nome,
    isActive: true,
    estado: "aprovado",
    categorias: ["mudancas"],
    raioKm: 50,
    emiteFatura: true,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
    contaDeTeste: false,
    verificado: true,
    tarifa: TARIFA,
    notaMedia: 4.84,
    avaliacoes: 5,
  } as CandidatoDaMudanca & { tarifa: TarifaDasMudancas };
}
const CTX: ContextoDaMudanca = { tipologia: "T2", desmontagem: false, pessoas: 2, kmPercurso: 20, formaDePagamento: "na_plataforma", cidade: "Seixal" };
const AGORA = instanteEmLisboa("2026-11-11T10:00") as Date;
/** Um cartão como a rota o manda: o do site, com a assinatura do preço posta pelo servidor. */
const cartao = (idOpaco: string, providerId: number, nome: string, mais: Record<string, unknown> = {}) => ({
  ...cartaoDoParceiro(candidato(providerId, nome), CTX, idOpaco, AGORA)!,
  assinatura: assinaturaDoPreco(providerId, TARIFA, CHAVE),
  ...mais,
});
const resposta = (parceiros: unknown[]) =>
  JSON.parse(
    JSON.stringify({
      ok: true,
      ligado: true,
      pessoas: 2,
      resumo: "T2 · Seixal → Almada · cerca de 5,5 h com 2 pessoas",
      recomendaTres: null,
      maximoDeEscolhidos: MAXIMO_DE_ESCOLHIDOS,
      parceiros,
      semParceiros: null,
      ordenacao: ORDENACAO,
      textos: TEXTOS_DA_LISTA,
    }),
  );

describe("app de cliente: o pedido leva a assinatura do preço de cada parceiro escolhido", () => {
  const lista = listaValida(resposta([cartao("a", 7, "Mudanças Exemplo"), cartao("b", 8, "Outra"), cartao("c", 9, "Terceira")]))!;
  const escolhidos = [
    { id: "a", providerId: 7, tarifa: TARIFA },
    { id: "b", providerId: 8, tarifa: TARIFA },
  ];

  it("a lista lê a assinatura de cada cartão (22 caracteres)", () => {
    expect(lista.ligado).toBe(true);
    if (!lista.ligado) return;
    for (const p of lista.parceiros) expect(p.assinatura).toHaveLength(22);
    expect(lista.parceiros[0].assinatura).toBe(assinaturaDoPreco(7, TARIFA, CHAVE));
  });

  it("uma por cada id de `parceirosEscolhidos`, só as dos escolhidos — e o servidor aceita-as", () => {
    const escolha = escolhaFeita(["a", "b"], lista, 2, false)!;
    const campos = camposDaEscolha(escolha) as { parceirosEscolhidos: string[]; assinaturasDoPreco: Record<string, string> };
    expect(campos.parceirosEscolhidos).toEqual(["a", "b"]);
    expect(Object.keys(campos.assinaturasDoPreco).sort()).toEqual(["a", "b"]);
    const depois = new Date((instanteEmLisboa(SEM_MARCA_ATE) as Date).getTime() + 60_000);
    expect(conferirAssinaturasDoPreco(campos.assinaturasDoPreco, escolhidos, depois, CHAVE)).toEqual({ ok: true, comAssinatura: true });
    // O parceiro mudou o preço entretanto: a mesma escolha já não passa.
    const novaTarifa = { ...TARIFA, precoHora2: 55 };
    expect(conferirAssinaturasDoPreco(campos.assinaturasDoPreco, [escolhidos[0], { ...escolhidos[1], tarifa: novaTarifa }], depois, CHAVE)).toEqual({
      ok: false,
      erro: PRECO_MUDOU,
    });
  });

  it("a escolha guardada no rascunho leva-as, e o corpo do pedido passa por `camposDaEscolha`", () => {
    const escolha = escolhaFeita(["b"], lista, 2, false)!;
    expect(escolha.assinaturas).toEqual({ b: assinaturaDoPreco(8, TARIFA, CHAVE) });
    expect(codigo("app-cliente/src/lib/novo-pedido.ts")).toMatch(/Object\.assign\(order, camposDaEscolha\(r\.parceiros\)\)/);
    // Sem escolha não vai campo nenhum.
    expect(camposDaEscolha(null)).toEqual({});
  });
});

describe("app de cliente: o preço mudou — volta à lista, pede-a outra vez e mostra o aviso", () => {
  it("reconhece a resposta do site", () => {
    expect(voltaALista({ ok: false, error: PRECO_MUDOU, campo: "parceirosEscolhidos", precoMudou: true })).toBe(true);
    expect(voltaALista({ ok: false, error: PRECO_MUDOU, precoMudou: true })).toBe(true);
    expect(voltaALista({ ok: false, error: "Indique o telefone.", campo: "telefone" })).toBe(false);
    expect(voltaALista(null)).toBe(false);
  });

  it("o envio recusado volta ao ecrã da lista sem a escolha antiga, com a frase da rota", () => {
    const pedir = codigo("app-cliente/src/componentes/NovoPedido.tsx");
    const ramo = pedir.search(/e instanceof ErroDaApi && voltaALista\(e\.corpo\)/);
    expect(ramo).toBeGreaterThan(-1);
    const depois = pedir.slice(ramo, ramo + 400);
    expect(depois).toMatch(/irPara\("parceiros", \{ parceiros: undefined, semListaDeParceiros: undefined \}\)/);
    expect(depois).toMatch(/setFalta\(e\.message\)/);
    // Ao chegar ao ecrã da lista, ela pede-se outra vez à rota (preços e assinaturas de agora).
    expect(pedir).toMatch(/pedir<unknown>\(ROTA_DOS_PARCEIROS,/);
    expect(pedir).toMatch(/\}, \[naLista, pessoasDaLista, catalogo\]\);/);
  });
});

/* ── 5 a 8: a folha a meio, na app Pro ────────────────────────────────────── */

const disco = new Map<string, string>();
class Ficheiro {
  constructor(public uri: string) {}
  get exists() {
    return disco.has(this.uri);
  }
  create() {
    disco.set(this.uri, "");
  }
  write(texto: string) {
    disco.set(this.uri, texto);
  }
  async text() {
    return disco.get(this.uri) ?? "";
  }
  delete() {
    disco.delete(this.uri);
  }
}
const FICHEIRO = "documentos/folhas-a-meio.json";
/** A app a abrir: as regras de novo, sobre o mesmo disco (nada em memória passa de uma para a outra). */
const abrirAApp = () => folhasAMeioEm(() => new Ficheiro(FICHEIRO));

const CONTEXTO = contextoDaFolha({
  tarifaCongeladaJson: JSON.stringify(congelarTarifa(TARIFA)),
  pessoasEscolhidas: 2,
  kmDoPercurso: 20,
  valorPorHoraAcordado: 50,
  diaPorOmissao: "2026-11-11",
})!;
const CAMPOS: CamposDaFolha = camposDaFolha(null, CONTEXTO);

function trabalho(n: number, mudar: Partial<Trabalho> = {}, folha: Record<string, unknown> = {}, horas: Record<string, unknown> = {}): Trabalho {
  return {
    negociacaoId: n,
    pedidoId: 500 + n,
    estado: "acordada",
    fase: "a_executar",
    pedidoCancelado: false,
    arquivadoEm: null,
    confirmadoEm: null,
    pagoEm: null,
    chegouEm: "2026-11-11 08:42:10",
    baseDoPreco: "hora",
    porHora: { podeMarcar: true, marcadas: false, confirmadas: false, resumo: null, folha: { campos: CAMPOS, rascunho: null, ...folha }, ...horas },
    ...mudar,
  } as unknown as Trabalho;
}

/** O que ele tem escrito a meio do dia: começou, fez uma pausa que ainda não fechou, e já contou material. */
const A_MEIO = {
  dia: "2026-11-11",
  inicio: "08:45",
  fim: "",
  pausas: [{ inicio: "12:30", fim: "" }],
  pessoas: 3,
  km: "23,5",
  materiais: { caixas: "12", cartaoMetros: "2,5", filmeRolos: "", plasticoBolhaRolos: "1" },
};

describe("app Pro: a folha a meio sobrevive a fechar a app", () => {
  beforeEach(() => disco.clear());

  it("o que ele escreveu fica no telemóvel e repõe-se ao reabrir", async () => {
    await abrirAApp().guardarFolhaAMeio(41, A_MEIO, new Date("2026-11-11T12:31:00Z"));
    // A app fechou. Ao reabrir, lê-se do disco.
    const reposto = await abrirAApp().lerFolhaAMeio(41);
    expect(reposto).not.toBeNull();
    const campos = camposDeAbrir(CAMPOS, "2026-11-11 08:42:10", reposto);
    expect(campos).toEqual({
      inicio: "08:45",
      fim: "",
      pausas: [{ inicio: "12:30", fim: "" }],
      pessoas: 3,
      km: "23,5",
      materiais: { caixas: "12", cartaoMetros: "2,5", plasticoBolhaRolos: "1" },
    });
    // O rascunho de um trabalho não aparece noutro.
    expect(await abrirAApp().lerFolhaAMeio(42)).toBeNull();
  });

  it("o rascunho do site repõe-se pela mesma regra, e entre os dois vale o mais novo", async () => {
    await abrirAApp().guardarFolhaAMeio(41, A_MEIO, new Date("2026-11-11T12:31:00Z"));
    const doTelemovel = (await abrirAApp().lerFolhaAMeio(41))!;
    const doSite = rascunhoDeJson(JSON.stringify({ ...A_MEIO, inicio: "08:50", guardadoEm: "2026-11-11T12:00:00.000Z" }))!;
    expect(camposDeAbrir(CAMPOS, null, doSite).inicio).toBe("08:50");
    expect(rascunhoMaisRecente(doSite, doTelemovel)).toBe(doTelemovel);
    expect(rascunhoMaisRecente(doTelemovel, doSite)).toBe(doTelemovel);
    expect(rascunhoMaisRecente(doSite, null)).toBe(doSite);
    expect(rascunhoMaisRecente(null, null)).toBeNull();
  });

  it("o ecrã guarda a cada mudança dele — no telemóvel e, pela rota das horas, no site — e repõe ao abrir", () => {
    const ecra = codigo("app-pro/src/componentes/FolhaDaMudanca.tsx");
    // Os campos nascem do rascunho (ou da hora do «Cheguei»), e não só do que o site manda.
    expect(ecra).toMatch(/useState\(\(\) => camposDeAbrir\(campos, t\.chegouEm, doSite\)\)/);
    for (const campo of ["inicio", "fim", "pausas", "pessoas", "km", "materiais"]) expect(ecra, campo).toMatch(new RegExp(`useState(<[^(]*>)?\\(aoAbrir\\.${campo}\\)`));
    expect(ecra).not.toMatch(/useState(<[^(]*>)?\(campos\.(inicio|fim|pausas|pessoas|km|materiais)\)/);
    expect(ecra).toMatch(/const doSite = editavel \? \(f\.rascunho \?\? null\) : null/);
    expect(ecra).toMatch(/lerFolhaAMeio\(t\.negociacaoId\)/);
    // Guardar: no telemóvel e no site, com `rascunho: true` (não envia a folha nem avisa o cliente).
    expect(ecra).toMatch(/void guardarFolhaAMeio\(t\.negociacaoId, rascunho\)/);
    expect(ecra).toMatch(/pedir\(ROTA_DAS_HORAS, \{ metodo: "POST", corpo: \{ negociacaoId: t\.negociacaoId, rascunho: true, \.\.\.rascunho \} \}\)/);
    expect(ecra).toContain('const ROTA_DAS_HORAS = "/api/profissionais/trabalho/horas"');
    // Nenhum campo do ecrã muda sem passar por «foi ele que mexeu».
    const desenho = ecra.slice(ecra.lastIndexOf("return (\n    <Caixa>"));
    expect(desenho.length).toBeGreaterThan(500);
    expect(desenho).not.toMatch(/[^A-Za-z]set(Inicio|Fim|Pausas|Pessoas|Km|Materiais)\b/);
  });
});

describe("app Pro: o início vem com a hora do «Cheguei», em Lisboa", () => {
  it("sem início escrito, é a hora a que ele chegou — a de Lisboa, de Inverno e de Verão", () => {
    // A base guarda em UTC: 08:42 UTC é 08:42 em Lisboa em Novembro e 09:42 em Julho.
    expect(camposDeAbrir(CAMPOS, "2026-11-11 08:42:10", null).inicio).toBe("08:42");
    expect(camposDeAbrir(CAMPOS, "2026-07-01 08:42:10", null).inicio).toBe("09:42");
    expect(camposDeAbrir(CAMPOS, "2026-07-01T08:42:10.000Z", null).inicio).toBe("09:42");
    expect(camposDeAbrir(CAMPOS, null, null).inicio).toBe("");
  });

  it("o que ele já escreveu (no rascunho ou na folha enviada) não se troca pela hora do «Cheguei»", () => {
    const rascunho = rascunhoDeJson(JSON.stringify({ inicio: "09:10", guardadoEm: "2026-11-11T10:00:00.000Z" }))!;
    expect(camposDeAbrir(CAMPOS, "2026-11-11 08:42:10", rascunho).inicio).toBe("09:10");
    const enviada = lerFolha({ inicio: "09:00", fim: "13:00" }, CONTEXTO, new Date("2026-11-11T14:00:00Z"));
    expect(enviada.ok).toBe(true);
    if (!enviada.ok) return;
    expect(camposDeAbrir(camposDaFolha(enviada.folha, CONTEXTO), "2026-11-11 08:42:10", null).inicio).toBe("09:00");
    // Um rascunho sem início fica com a hora do «Cheguei».
    const semInicio = rascunhoDeJson(JSON.stringify({ km: 30, guardadoEm: "2026-11-11T10:00:00.000Z" }))!;
    expect(camposDeAbrir(CAMPOS, "2026-11-11 08:42:10", semInicio)).toMatchObject({ inicio: "08:42", km: "30" });
  });

  it("a equipa de 3 só se repõe se a tarifa dele a tiver", () => {
    const rascunho = rascunhoDeJson(JSON.stringify({ pessoas: 3, guardadoEm: "2026-11-11T10:00:00.000Z" }))!;
    expect(camposDeAbrir({ ...CAMPOS, podeTres: false }, null, rascunho).pessoas).toBe(2);
    expect(camposDeAbrir({ ...CAMPOS, podeTres: true }, null, rascunho).pessoas).toBe(3);
  });
});

describe("app Pro: no telemóvel ficam só horas e quantidades", () => {
  beforeEach(() => disco.clear());

  it("moradas, nomes, contactos e texto livre não chegam ao ficheiro", async () => {
    const RUA = "Rua de Exemplo 12";
    const NOME = "Cliente de Exemplo";
    const MOTIVO = "Desvio pela ponte";
    await abrirAApp().guardarFolhaAMeio(
      41,
      { ...A_MEIO, motivoDosKm: MOTIVO, morada: RUA, moradaDestino: RUA, contactoNome: NOME, contactoTelefone: "900000001", nota: NOME } as never,
      new Date("2026-11-11T12:31:00Z"),
    );
    const texto = disco.get(FICHEIRO)!;
    for (const proibido of [RUA, "Exemplo", NOME, MOTIVO, "900000001", "morada", "contacto", "motivo"]) expect(texto, proibido).not.toContain(proibido);
    // O que lá está: o número da negociação e os campos do rascunho do site, mais nada.
    const guardado = JSON.parse(texto) as Record<string, Record<string, unknown>>;
    expect(Object.keys(guardado)).toEqual(["41"]);
    expect(Object.keys(guardado["41"]).sort()).toEqual(["dia", "fim", "guardadoEm", "inicio", "km", "materiais", "pausas", "pessoas"]);
  });

  it("um ficheiro estragado, ou escrito por outra mão, conta como nenhum", async () => {
    disco.set(FICHEIRO, "{ isto não é JSON");
    expect(await abrirAApp().lerFolhaAMeio(41)).toBeNull();
    disco.set(FICHEIRO, JSON.stringify({ "41": { inicio: "08:45", morada: "Rua de Exemplo" }, "x; drop": { inicio: "09:00", guardadoEm: "2026-11-11T10:00:00.000Z" } }));
    expect(await abrirAApp().lerFolhaAMeio(41)).toBeNull();
  });
});

describe("app Pro: o rascunho sai quando já não é preciso", () => {
  beforeEach(() => disco.clear());
  const QUANDO = new Date("2026-11-11T12:31:00Z");

  it("enviar a folha apaga-o", async () => {
    const app = abrirAApp();
    await app.guardarFolhaAMeio(41, A_MEIO, QUANDO);
    await app.guardarFolhaAMeio(42, A_MEIO, QUANDO);
    await app.apagarFolhaAMeio(41);
    expect(await abrirAApp().lerFolhaAMeio(41)).toBeNull();
    expect(await abrirAApp().lerFolhaAMeio(42)).not.toBeNull();
    await app.apagarFolhaAMeio(42);
    expect(disco.has(FICHEIRO)).toBe(false);
    // No ecrã: depois de a rota aceitar a folha, e nunca antes.
    const ecra = codigo("app-pro/src/componentes/FolhaDaMudanca.tsx");
    const enviar = ecra.slice(ecra.indexOf("async function enviar()"), ecra.indexOf("const campoDeHora"));
    const envio = enviar.search(/await pedir<[^>]*>\(ROTA_DAS_HORAS/);
    const apaga = enviar.indexOf("void apagarFolhaAMeio(t.negociacaoId)");
    expect(envio).toBeGreaterThan(-1);
    expect(apaga).toBeGreaterThan(envio);
    expect(apaga).toBeLessThan(enviar.search(/\} catch \(e\)/));
    // E um rascunho que estava à espera de ir para o site já não vai atrás da folha.
    expect(enviar.indexOf("clearTimeout(espera.current)")).toBeGreaterThan(-1);
    expect(enviar.indexOf("clearTimeout(espera.current)")).toBeLessThan(envio);
  });

  it("a regra da d1: de um trabalho fechado não fica nada", async () => {
    const fechados: Array<[string, Trabalho | null]> = [
      ["confirmado", trabalho(41, { fase: "confirmado" })],
      ["pago", trabalho(41, { pagoEm: "2026-11-11 15:00:00" })],
      ["cancelado", trabalho(41, { pedidoCancelado: true })],
      ["arquivado", trabalho(41, { arquivadoEm: "2026-11-11 15:00:00" })],
      ["desistida", trabalho(41, { estado: "desistida" })],
      ["já fora da lista", null],
      ["horas confirmadas", trabalho(41, {}, {}, { confirmadas: true })],
      ["sem folha", trabalho(41, { porHora: null } as never)],
    ];
    for (const [nome, t] of fechados) {
      disco.clear();
      const app = abrirAApp();
      await app.guardarFolhaAMeio(41, A_MEIO, QUANDO);
      await app.guardarFolhaAMeio(42, A_MEIO, QUANDO);
      await app.ficarSoComAsFolhasVivas([...(t ? [t] : []), trabalho(42)]);
      expect(await abrirAApp().lerFolhaAMeio(41), nome).toBeNull();
      expect(await abrirAApp().lerFolhaAMeio(42), nome).not.toBeNull();
    }
  });

  it("a folha enviada depois dele (noutro telemóvel, ou no painel) tira-o; uma correcção a meio fica", async () => {
    const r = rascunhoDeJson(JSON.stringify({ ...A_MEIO, guardadoEm: QUANDO.toISOString() }))!;
    const enviadaDepois = trabalho(41, {}, {}, { marcadas: true, resumo: { marcadasEm: "2026-11-11T13:00:00.000Z" } });
    const enviadaAntes = trabalho(41, {}, {}, { marcadas: true, resumo: { marcadasEm: "2026-11-11T11:00:00.000Z" } });
    expect(folhaAMeioVale(enviadaDepois, r)).toBe(false);
    expect(folhaAMeioVale(enviadaAntes, r)).toBe(true);
    expect(folhaAMeioVale(trabalho(41), r)).toBe(true);
    // Com rascunho no site, é com ele que se compara (o mais novo dos dois).
    expect(folhaAMeioVale(trabalho(41, {}, { rascunho: r }, { marcadas: true, resumo: { marcadasEm: "2026-11-11T13:00:00.000Z" } }), r)).toBe(true);
  });

  it("depois de cada leitura do site limpa-se, e ao sair da conta apaga-se tudo", async () => {
    const estado = codigo("app-pro/src/estado/Trabalhos.tsx");
    const leitura = estado.slice(estado.indexOf("const recarregar = useCallback"), estado.search(/\} catch \(e\) \{\r?\n\s*setErro\(/));
    expect(leitura).toContain("void ficarSoComAsFolhasVivas(lista)");
    const semSessao = estado.slice(estado.indexOf("if (!activo) {"), estado.indexOf("let vivo = true"));
    expect(semSessao).toContain("apagarListaGuardada();");
    expect(semSessao).toContain("apagarFolhasAMeio();");
    const app = abrirAApp();
    await app.guardarFolhaAMeio(41, A_MEIO, QUANDO);
    app.apagarFolhasAMeio();
    expect(disco.size).toBe(0);
  });
});

/* ── A nota do Google no cartão da app de cliente ─────────────────────────── */

describe("app de cliente: as duas notas no cartão do parceiro, separadas", () => {
  const GOOGLE = { texto: "4,7 (128 avaliações)", atribuicao: "Google Maps" };

  it("a nota do Google lê-se como a rota a manda, sem tocar na da CLYON", () => {
    const l = listaValida(resposta([cartao("a", 7, "Mudanças Exemplo", { notaGoogle: GOOGLE }), cartao("b", 8, "Outra")]))!;
    expect(l.ligado).toBe(true);
    if (!l.ligado) return;
    expect(l.parceiros[0].notaGoogle).toEqual(GOOGLE);
    expect(l.parceiros[0].nota?.texto).toBe(cartao("a", 7, "Mudanças Exemplo").nota?.texto);
    expect(l.parceiros[0].nota?.texto).not.toContain("Google");
    expect(l.parceiros[1].notaGoogle).toBeNull();
  });

  it("sem a atribuição não se mostra", () => {
    const l = listaValida(resposta([cartao("a", 7, "Mudanças Exemplo", { notaGoogle: { texto: GOOGLE.texto } })]))!;
    expect(l.ligado && l.parceiros[0].notaGoogle).toBeNull();
  });

  it("o cartão desenha-as em linhas diferentes: a da CLYON primeiro, a do Google depois, com a atribuição", () => {
    const c = codigo("app-cliente/src/componentes/CartaoDoParceiro.tsx");
    const daClyon = c.indexOf("p.nota ? p.nota.texto");
    const doGoogle = c.indexOf("p.notaGoogle ? (");
    expect(daClyon).toBeGreaterThan(-1);
    expect(doGoogle).toBeGreaterThan(daClyon);
    const linha = c.slice(doGoogle, doGoogle + 600);
    expect(linha).toContain("p.notaGoogle.texto");
    expect(linha).toContain("p.notaGoogle.atribuicao");
    // Entre uma e outra fecha-se a linha da nota da CLYON.
    expect(c.slice(daClyon, doGoogle)).toContain("</View>");
  });
});
