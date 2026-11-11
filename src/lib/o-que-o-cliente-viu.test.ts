import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O QUE O CLIENTE VIU É O QUE SE GRAVA — 11-11-2026 (ordem do CEO com o sim do dono).
 *
 *   1. A folha vista: corrigir entre ler e confirmar dá 409 «A folha mudou».
 *   2. O preço visto: se o parceiro mudou o preço, a escolha não se grava.
 *   3. A transição: sem marca nem assinatura aceita-se 7 dias, com data escrita.
 *   4. Os lembretes da folha só entre as 8h e as 21h de Lisboa.
 *   5. O envio aos escolhidos que falha deixa uma linha no histórico do pedido.
 *   6. O rascunho da folha guarda-se sem avisar o cliente.
 *
 * Com a base, o Google e os avisos fingidos. As horas são as de Lisboa
 * (hora-de-lisboa.ts): esta máquina não está em Lisboa.
 */

const estado = vi.hoisted(() => ({
  /** A tarifa congelada da negociação (texto da coluna). */
  tarifaJson: "",
  /** A folha que está «na base» (o texto da coluna). */
  gravada: null as string | null,
  /** O que o parceiro faz entre a leitura e a escrita da confirmação (a corrida). */
  aMeio: null as null | (() => void),
  confirmacoes: [] as unknown[][],
  rascunhos: [] as unknown[][],
  folhasEnviadas: [] as unknown[][],
  historico: [] as Array<{ id: number; message: string }>,
  registos: [] as unknown[],
  avisosAoCliente: [] as unknown[][],
  avisosNoTerreno: [] as unknown[][],
  avisosAoParceiro: [] as unknown[][],
  depois: 0,
  porResponder: [] as unknown[],
  passos: [] as unknown[][],
  negociacoes: [] as unknown[],
  candidatos: [] as unknown[],
  distribuir: null as null | (() => Promise<unknown>),
  prova: [] as unknown[],
}));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(() => {
    estado.depois++;
  }),
}));
vi.mock("@/lib/db", () => ({
  appendOrderHistory: vi.fn(async (id: number, h: { message: string }) => {
    estado.historico.push({ id, message: h.message });
  }),
  registarSemFalhar: vi.fn(async (r: unknown) => {
    estado.registos.push(r);
  }),
  folhaDaNegociacao: vi.fn(async (id: number) => ({
    id,
    pedidoId: 700,
    providerId: 7,
    estado: "acordada",
    tarifaCongeladaJson: estado.tarifaJson,
    pessoasEscolhidas: 2,
    taxaCliente: 0,
    folhaJson: estado.gravada,
    folhaHistoricoJson: null,
    folhaNaMesaEm: null,
    horasContestadasEm: null,
    kmPercurso: "20",
  })),
  // A base fingida faz o que o comando faz: só confirma se a folha gravada ainda for a que veio na condição.
  confirmarHorasDoTrabalho: vi.fn(async (...a: unknown[]) => {
    estado.confirmacoes.push(a);
    estado.aMeio?.();
    const folha = a[3] as { folhaJson?: string | null } | null;
    return folha?.folhaJson == null || folha.folhaJson === estado.gravada;
  }),
  contestarHorasDoTrabalho: vi.fn(async () => true),
  gravarHorasDoTrabalho: vi.fn(async () => true),
  gravarFolhaDoTrabalho: vi.fn(async (...a: unknown[]) => {
    estado.folhasEnviadas.push(a);
    return true;
  }),
  gravarRascunhoDaFolha: vi.fn(async (...a: unknown[]) => {
    estado.rascunhos.push(a);
    return true;
  }),
  folhasPorResponder: vi.fn(async () => estado.porResponder),
  marcarPassoDaFolha: vi.fn(async (...a: unknown[]) => {
    estado.passos.push(a);
    return true;
  }),
  negociacaoNoTerreno: vi.fn(async () => ({ id: 1 })),
  negociacoesDoProfissional: vi.fn(async () => estado.negociacoes),
  candidatosDaListaDasMudancas: vi.fn(async () => estado.candidatos),
  listaDeParceirosNasMudancasLigada: vi.fn(async () => true),
  gravarEscolhaDosParceiros: vi.fn(async (id: number, p: unknown) => {
    estado.prova.push({ id, p });
  }),
}));
vi.mock("@/lib/avisos-ao-cliente", () => ({
  avisarOClienteDoPedido: vi.fn(async (...a: unknown[]) => {
    estado.avisosAoCliente.push(a);
  }),
}));
vi.mock("@/lib/avisos-do-terreno", () => ({
  avisarClienteDasHoras: vi.fn(async (...a: unknown[]) => {
    estado.avisosNoTerreno.push(a);
  }),
}));
vi.mock("@/lib/avisos-do-backoffice", () => ({
  avisarProfissional: vi.fn(async (...a: unknown[]) => {
    estado.avisosAoParceiro.push(a);
  }),
  avisarCliente: vi.fn(async (...a: unknown[]) => {
    estado.avisosAoCliente.push(a);
  }),
}));
vi.mock("@/lib/distancia-rodoviaria", () => ({
  distanciaRodoviaria: vi.fn(async () => ({ km: 20, minutos: 25, origem: "estrada" })),
  distanciasRodoviarias: vi.fn(async (pares: unknown[]) => pares.map(() => ({ km: 10, minutos: null, origem: "estrada" }))),
}));
vi.mock("@/lib/geocodificar", () => ({ geocodificarMorada: vi.fn(async () => null) }));
vi.mock("@/lib/bloqueio-do-profissional", () => ({ profissionaisBloqueadosEmDinheiro: vi.fn(async () => new Set<number>()) }));
vi.mock("@/lib/distribuir-pedido", () => ({
  distribuirPedido: vi.fn(async () =>
    estado.distribuir ? estado.distribuir() : { avisados: 1, receberam: 1, falhados: 0, candidatos: 1, jaTinham: 0, motivos: {} },
  ),
  resumoDaDistribuicao: vi.fn(() => "Resumo da distribuição."),
}));
vi.mock("@/lib/percurso-do-pedido", () => ({ percursoDoPedido: vi.fn(async () => null) }));

process.env.JWT_SECRET = "segredo-de-teste";

import { congelarTarifa, REGRAS_DAS_MUDANCAS, type TarifaDasMudancas } from "./conta-da-mudanca";
import {
  dinheiroDaFolha,
  lerFolha,
  lerRascunhoDaFolha,
  passoDaFolha,
  rascunhoDeJson,
  type ContextoDaFolha,
  type CorpoDaFolha,
} from "./folha-da-mudanca";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { confirmarAsHoras, marcarHorasPeloProfissional } from "./horas-no-servidor";
import { correrARotinaDasFolhas } from "./folha-no-servidor";
import { horasParaOCliente } from "./pedido-para-a-app";
import { assinaturaDoPreco, conferirAssinaturasDoPreco, idOpacoDoParceiro, lerPedidoDaLista, listaDosParceirosDaMudanca } from "./parceiros-da-mudanca";
import { enviarAosEscolhidos, linhaDoEnvioFalhado, prepararEscolhaDaMudanca } from "./mudanca-com-parceiros-escolhidos";
import {
  FOLHA_MUDOU,
  FOLHA_SEM_MARCA,
  LISTA_POR_VER,
  PRECO_MUDOU,
  SEM_MARCA_ATE,
  aindaSeAceitaSemMarca,
  conferirMarcaDaFolha,
  marcaDaFolha,
  sha256,
} from "./o-que-o-cliente-viu";

const emLisboa = (cru: string) => instanteEmLisboa(cru) as Date;
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const TARIFA: TarifaDasMudancas = {
  precoHora2: 40,
  precoHora3: 55,
  minimoHoras: 3,
  precoKm: 0.5,
  kmMinimo: 0,
  kmMaximo: 80,
  caixa: 2,
  cartaoMetro: null,
  filmeRolo: 10,
  plasticoBolhaRolo: null,
  aparecerNaLista: true,
};
const CONGELADA = congelarTarifa(TARIFA, REGRAS_DAS_MUDANCAS, new Date("2026-11-11T10:00:00Z"));
const JSON_DA_TARIFA = JSON.stringify(CONGELADA);
const CTX: ContextoDaFolha = { tarifa: CONGELADA, pessoasEscolhidas: 2, kmDoPercurso: 20, valorPorHoraAcordado: 40, diaPorOmissao: "2026-11-11" };
const RECEBEU = { avisados: 1, receberam: 1, falhados: 0, candidatos: 1, jaTinham: 0, motivos: {} };

/** Dentro dos 7 dias e depois deles. */
const NA_TRANSICAO = emLisboa("2026-11-12T10:00");
const DEPOIS_DA_TRANSICAO = emLisboa("2026-11-19T10:00");

function folhaEmJson(corpo: CorpoDaFolha): string {
  const r = lerFolha(corpo, CTX, new Date("2026-11-11T20:00:00Z"));
  if (!r.ok) throw new Error(r.erro);
  return JSON.stringify(r.folha);
}
/** A folha que o cliente viu: 4 h. E a que o parceiro pôs por cima: 8 h com material. */
const FOLHA_A = folhaEmJson({ inicio: "09:00", fim: "13:00" });
const FOLHA_B = folhaEmJson({ inicio: "09:00", fim: "17:00", materiais: { caixas: 20 } });

const LINHA = {
  horasMarcadasEm: new Date("2026-11-11T13:05:00Z"),
  horasConfirmadasEm: null,
  valorDasHoras: 170,
  valorAcordado: 40,
  taxaCliente: 0,
  taxaProfissional: 0.1,
};
const confirmar = (mais: { marcaVista?: unknown; agora?: Date; por?: "cliente" | "clyon" } = {}) =>
  confirmarAsHoras({
    negociacaoId: 55,
    pedidoId: 700,
    providerId: 7,
    por: mais.por ?? "cliente",
    onde: "pelo link do pedido",
    autorNome: null,
    linha: LINHA as never,
    marcaVista: mais.marcaVista,
    agora: mais.agora ?? NA_TRANSICAO,
  });

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(estado, {
    tarifaJson: JSON_DA_TARIFA,
    gravada: null,
    aMeio: null,
    confirmacoes: [],
    rascunhos: [],
    folhasEnviadas: [],
    historico: [],
    registos: [],
    avisosAoCliente: [],
    avisosNoTerreno: [],
    avisosAoParceiro: [],
    depois: 0,
    porResponder: [],
    passos: [],
    negociacoes: [],
    candidatos: [],
    distribuir: null,
    prova: [],
  });
});

/* ── 1. A folha vista ─────────────────────────────────────────────────────── */

describe("1. a folha que se confirma é a que o cliente viu", () => {
  it("o resumo sem módulos do servidor é o SHA-256 de sempre", () => {
    for (const t of ["", "abc", "Folha da mudança — 485,85 € com IVA", "x".repeat(55), "x".repeat(56), "x".repeat(64), "ç".repeat(1000), FOLHA_A]) {
      expect(sha256(t)).toBe(createHash("sha256").update(t, "utf8").digest("hex"));
    }
    expect(marcaDaFolha(FOLHA_A)).toHaveLength(32);
    expect(marcaDaFolha(FOLHA_A)).not.toBe(marcaDaFolha(FOLHA_B));
    expect(marcaDaFolha(null)).toBeNull();
  });

  it("a resposta que mostra a folha ao cliente leva a marca dela", () => {
    const h = horasParaOCliente(
      {
        estado: "acordada",
        porHora: true,
        valorAcordado: 40,
        taxaCliente: 0,
        horas: {
          ...LINHA,
          folhaJson: FOLHA_A,
          tarifaCongeladaJson: JSON_DA_TARIFA,
          horasInicioEm: new Date("2026-11-11T09:00:00Z"),
          horasFimEm: new Date("2026-11-11T13:00:00Z"),
          horasMinutos: 240,
          horasFaturadas: 4,
          valorPorHora: 40,
        },
      } as never,
      null,
    );
    expect(h?.folha?.marca).toBe(marcaDaFolha(FOLHA_A));
    expect(h?.botaoConfirmar).toBe("Confirmo a folha");
  });

  it("A CORRIDA: o parceiro corrige entre a leitura e a confirmação → 409 «A folha mudou», e nada se confirma", async () => {
    estado.gravada = FOLHA_A;
    // O cliente viu a A e carrega em «Confirmo a folha»; o servidor lê a A; e o parceiro grava a B antes de o comando correr.
    estado.aMeio = () => {
      estado.gravada = FOLHA_B;
    };
    const r = await confirmar({ marcaVista: marcaDaFolha(FOLHA_A) });
    expect(r.status).toBe(409);
    expect(r.corpo).toEqual({ ok: false, error: FOLHA_MUDOU, folhaMudou: true });
    // O comando levou a folha A na condição (e a taxa dela) — a base não confirmou a B com a taxa da A.
    expect(estado.confirmacoes).toHaveLength(1);
    const extra = estado.confirmacoes[0][3] as { folhaJson: string; taxaProfissional: number };
    expect(extra.folhaJson).toBe(FOLHA_A);
    expect(extra.taxaProfissional).toBe(dinheiroDaFolha(JSON.parse(FOLHA_A)).taxaProfissional);
    // Nada de «confirmada» em lado nenhum.
    expect(estado.historico).toEqual([]);
    expect(estado.registos).toEqual([]);
    expect(estado.depois).toBe(0);
    expect(estado.avisosAoParceiro).toEqual([]);
  });

  it("o parceiro já tinha corrigido antes de o cliente carregar → 409, sem chegar a escrever", async () => {
    estado.gravada = FOLHA_B;
    const r = await confirmar({ marcaVista: marcaDaFolha(FOLHA_A) });
    expect([r.status, r.corpo.error, r.corpo.folhaMudou]).toEqual([409, FOLHA_MUDOU, true]);
    expect(estado.confirmacoes).toEqual([]);
  });

  it("a mesma folha: confirma, com a taxa da folha gravada e a folha na condição do comando", async () => {
    estado.gravada = FOLHA_B;
    const r = await confirmar({ marcaVista: marcaDaFolha(FOLHA_B), agora: DEPOIS_DA_TRANSICAO });
    expect(r.status).toBe(200);
    const extra = estado.confirmacoes[0][3] as { folhaJson: string; taxaProfissional: number };
    expect(extra.folhaJson).toBe(FOLHA_B);
    expect(extra.taxaProfissional).toBe(dinheiroDaFolha(JSON.parse(FOLHA_B)).taxaProfissional);
    expect(estado.historico).toHaveLength(1);
  });

  it("a porta da equipa (backoffice) passa pela mesma conferência", async () => {
    estado.gravada = FOLHA_B;
    expect((await confirmar({ por: "clyon", marcaVista: marcaDaFolha(FOLHA_A) })).status).toBe(409);
    expect((await confirmar({ por: "clyon", marcaVista: marcaDaFolha(FOLHA_B) })).status).toBe(200);
  });

  it("o comando da base tem a folha na condição — é no MESMO comando que confirma", () => {
    const db = ler("src/lib/db.ts");
    const funcao = db.slice(db.indexOf("export async function confirmarHorasDoTrabalho("), db.indexOf("export async function contestarHorasDoTrabalho("));
    expect(funcao).toContain('AND folhaJson IS NOT NULL${folha.folhaJson != null ? " AND folhaJson = ?" : ""}');
    expect(funcao).toContain("...(folha.folhaJson != null ? [folha.folhaJson] : [])");
    // Um só comando: sem ler antes, sem transacção à volta.
    expect(funcao.match(/pool\.execute\(/g)).toHaveLength(1);
  });

  it("as três portas mandam a marca: link e conta do cliente, app (pelo mesmo corpo) e backoffice", () => {
    expect(ler("src/lib/agir-como-cliente.ts")).toContain("marcaVista: corpo.marcaDaFolha");
    expect(ler("src/app/pedido/[token]/PropostasRecebidas.tsx")).toContain("marcaDaFolha: negociacoes.find((n) => n.id === id)?.horas?.folha?.marca");
    expect(ler("src/components/admin/HorasNaMesa.tsx")).toContain("marcaDaFolha: r.folha.marca");
    const rota = ler("src/app/api/admin/negociacoes/horas/route.ts");
    expect(rota).toContain("marca: marcaDaFolha(l.folhaJson ?? null)");
    expect(rota).toContain("let marcaVista: unknown = corpo.marcaDaFolha;");
    expect(rota).toContain("marcaVista = pelaFolha.corpo.marca;");
  });
});

/* ── 3. A transição ───────────────────────────────────────────────────────── */

describe("3. sem marca nem assinatura aceita-se durante 7 dias, com data escrita", () => {
  it("a data-limite é o fim de 18-11-2026 em Lisboa: 7 dias depois de 11-11", () => {
    expect(SEM_MARCA_ATE).toBe("2026-11-18T23:59:59");
    const limite = emLisboa(SEM_MARCA_ATE);
    const publicado = emLisboa("2026-11-11T23:59:59");
    expect((limite.getTime() - publicado.getTime()) / 86_400_000).toBe(7);
    expect(aindaSeAceitaSemMarca(emLisboa("2026-11-11T18:00"))).toBe(true);
    expect(aindaSeAceitaSemMarca(emLisboa("2026-11-18T23:59"))).toBe(true);
    expect(aindaSeAceitaSemMarca(emLisboa("2026-11-19T00:00:01"))).toBe(false);
    // No Inverno Lisboa é UTC: quem corre isto noutro fuso lê o mesmo instante.
    expect(limite.toISOString()).toBe("2026-11-18T23:59:59.000Z");
  });

  it("a folha sem marca (app antiga): confirma até lá — com a corrida guardada na mesma — e depois manda ver outra vez", async () => {
    expect(conferirMarcaDaFolha(undefined, "x", NA_TRANSICAO)).toBe("sem_marca_aceite");
    expect(conferirMarcaDaFolha("", "x", NA_TRANSICAO)).toBe("sem_marca_aceite");
    expect(conferirMarcaDaFolha(null, "x", DEPOIS_DA_TRANSICAO)).toBe("sem_marca_recusada");

    estado.gravada = FOLHA_A;
    expect((await confirmar({ agora: NA_TRANSICAO })).status).toBe(200);
    // Mesmo sem marca, o comando leva a folha lida na condição.
    expect((estado.confirmacoes[0][3] as { folhaJson: string }).folhaJson).toBe(FOLHA_A);

    estado.confirmacoes = [];
    estado.aMeio = () => {
      estado.gravada = FOLHA_B;
    };
    const corrida = await confirmar({ agora: NA_TRANSICAO });
    expect([corrida.status, corrida.corpo.error]).toEqual([409, FOLHA_MUDOU]);

    estado.gravada = FOLHA_A;
    estado.aMeio = null;
    estado.confirmacoes = [];
    const tarde = await confirmar({ agora: DEPOIS_DA_TRANSICAO });
    expect([tarde.status, tarde.corpo.error, tarde.corpo.folhaMudou]).toEqual([409, FOLHA_SEM_MARCA, true]);
    expect(estado.confirmacoes).toEqual([]);
  });

  it("a escolha sem assinaturas: passa até lá, e depois manda ver a lista", () => {
    const e = [{ id: "a", providerId: 1, tarifa: TARIFA }];
    for (const vazio of [undefined, null, {}, [], "x"]) {
      expect(conferirAssinaturasDoPreco(vazio, e, NA_TRANSICAO)).toEqual({ ok: true, comAssinatura: false });
      expect(conferirAssinaturasDoPreco(vazio, e, DEPOIS_DA_TRANSICAO)).toEqual({ ok: false, erro: LISTA_POR_VER });
    }
  });
});

/* ── 2. O preço visto ─────────────────────────────────────────────────────── */

function candidato(id: number, tarifa: TarifaDasMudancas = TARIFA) {
  return {
    id,
    nome: `Parceiro ${id}`,
    email: null,
    telefone: null,
    avisaPorWhatsApp: true,
    isActive: true,
    estado: "aprovado",
    categorias: ["mudancas"],
    raioKm: 50,
    emiteFatura: true,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
    baseLat: 38.6,
    baseLng: -9.1,
    contaDeTeste: false,
    verificado: true,
    tarifa,
    notaMedia: null,
    avaliacoes: 0,
    googlePlaceId: null,
  };
}
const ORDER = {
  serviceType: "mudanca",
  tipologia: "T2",
  originAddress: { lat: 38.64, lng: -9.1, formattedAddress: "Rua A, Seixal", city: "Seixal" },
  destinationAddress: { lat: 38.68, lng: -9.16, formattedAddress: "Rua B, Almada", city: "Almada" },
  pessoas: 2,
};

async function listaVista() {
  const lido = lerPedidoDaLista({ origem: ORDER.originAddress, destino: ORDER.destinationAddress, tipologia: "T2", pessoas: 2 });
  if (!lido.ok) throw new Error(lido.erro);
  const r = await listaDosParceirosDaMudanca(lido.pedido);
  if (!r.ok) throw new Error(r.erro);
  return r.cartoes;
}

describe("2. o preço que se congela é o que o cliente viu no cartão", () => {
  it("cada cartão da lista leva a assinatura do preço mostrado, e ela muda com qualquer preço", async () => {
    estado.candidatos = [candidato(1), candidato(2)];
    const cartoes = await listaVista();
    expect(cartoes).toHaveLength(2);
    for (const c of cartoes) expect(c.assinatura).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // O mesmo preço em dois parceiros não dá a mesma assinatura (não se troca de um para o outro).
    expect(cartoes[0].assinatura).not.toBe(cartoes[1].assinatura);
    expect(cartoes.find((c) => c.id === idOpacoDoParceiro(1))?.assinatura).toBe(assinaturaDoPreco(1, TARIFA));

    const base = assinaturaDoPreco(1, TARIFA);
    const mudancas: Array<Partial<TarifaDasMudancas>> = [
      { precoHora2: 45 },
      { precoHora3: 60 },
      { precoHora3: null },
      { minimoHoras: 4 },
      { precoKm: 0.6 },
      { kmMinimo: 10 },
      { kmMaximo: 100 },
      { caixa: 2.5 },
      { cartaoMetro: 1 },
      { filmeRolo: null },
      { plasticoBolhaRolo: 12 },
    ];
    for (const m of mudancas) expect(assinaturaDoPreco(1, { ...TARIFA, ...m }), JSON.stringify(m)).not.toBe(base);
    // Sair e voltar à lista não é mudar de preço.
    expect(assinaturaDoPreco(1, { ...TARIFA, aparecerNaLista: false })).toBe(base);
    // Sem o segredo do servidor não se faz.
    expect(assinaturaDoPreco(1, TARIFA, "outro-segredo")).not.toBe(base);
  });

  it("O PREÇO MUDOU entre a lista e o envio: a escolha não se grava e o cliente volta à lista com o aviso", async () => {
    estado.candidatos = [candidato(1)];
    const [cartao] = await listaVista();
    const escolha = { ...ORDER, parceirosEscolhidos: [cartao.id], assinaturasDoPreco: { [cartao.id]: cartao.assinatura } };

    // O preço é o mesmo: segue.
    const igual = await prepararEscolhaDaMudanca(escolha, DEPOIS_DA_TRANSICAO);
    expect(igual.caminho).toBe("escolhidos");

    // O parceiro sobe a hora de 40 para 48 enquanto o cliente escreve o contacto.
    estado.candidatos = [candidato(1, { ...TARIFA, precoHora2: 48 })];
    const mudou = await prepararEscolhaDaMudanca(escolha, NA_TRANSICAO);
    expect(mudou).toEqual({ caminho: "recusado", erro: PRECO_MUDOU, campo: "parceirosEscolhidos", precoMudou: true });
    // Nada se gravou: quem grava é a rota, e só no caminho «escolhidos».
    expect(estado.prova).toEqual([]);
    const rota = ler("src/app/api/simulador/pedido/route.ts");
    expect(rota.indexOf('if (daMudanca.caminho === "recusado")')).toBeGreaterThan(0);
    expect(rota.indexOf('if (daMudanca.caminho === "recusado")')).toBeLessThan(rota.indexOf("createSimulatorOrder("));
    // O simulador volta à lista neste campo, com a frase do servidor.
    expect(ler("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain('if (saved.campo === "parceirosEscolhidos") setEscolhaDaMudanca(null);');
    expect(PRECO_MUDOU).toMatch(/lista/);
  });

  it("uma assinatura de outro cartão, inventada ou em falta não passa", () => {
    const e = [
      { id: "a", providerId: 1, tarifa: TARIFA },
      { id: "b", providerId: 2, tarifa: TARIFA },
    ];
    const certas = { a: assinaturaDoPreco(1, TARIFA), b: assinaturaDoPreco(2, TARIFA) };
    expect(conferirAssinaturasDoPreco(certas, e, DEPOIS_DA_TRANSICAO)).toEqual({ ok: true, comAssinatura: true });
    expect(conferirAssinaturasDoPreco({ a: certas.b, b: certas.a }, e, NA_TRANSICAO)).toEqual({ ok: false, erro: PRECO_MUDOU });
    expect(conferirAssinaturasDoPreco({ a: certas.a }, e, NA_TRANSICAO)).toEqual({ ok: false, erro: PRECO_MUDOU });
    expect(conferirAssinaturasDoPreco({ a: certas.a, b: "inventada" }, e, NA_TRANSICAO)).toEqual({ ok: false, erro: PRECO_MUDOU });
    expect(conferirAssinaturasDoPreco({ a: certas.a, b: 5 }, e, NA_TRANSICAO)).toEqual({ ok: false, erro: PRECO_MUDOU });
  });

  it("o simulador devolve as assinaturas dos cartões escolhidos", () => {
    expect(ler("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain("assinaturasDoPreco: escolhaDaMudanca.assinaturas ?? {}");
    expect(ler("src/app/simulador/components/ParceirosDaMudanca.tsx")).toContain("[p.id, p.assinatura as string]");
  });
});

/* ── 4. Os lembretes ──────────────────────────────────────────────────────── */

describe("4. os lembretes da folha só saem entre as 8h e as 21h de Lisboa", () => {
  const enviadaAs = (cru: string) => ({ folhaJson: FOLHA_A, horasMarcadasEm: emLisboa(cru) });

  it("às 23h e às 02h nada; às 08h sai o lembrete (folha enviada às 20h30)", () => {
    const f = enviadaAs("2026-11-11T20:30");
    expect(passoDaFolha(f, emLisboa("2026-11-11T20:59"))).toBeNull(); // ainda não passaram 2 h
    expect(passoDaFolha(f, emLisboa("2026-11-11T23:00"))).toBeNull();
    expect(passoDaFolha(f, emLisboa("2026-11-12T02:00"))).toBeNull();
    expect(passoDaFolha(f, emLisboa("2026-11-12T07:59"))).toBeNull();
    expect(passoDaFolha(f, emLisboa("2026-11-12T08:00"))).toBe("lembrete_2h");
    expect(passoDaFolha(f, emLisboa("2026-11-12T20:59"))).toBe("lembrete_24h");
    expect(passoDaFolha(f, emLisboa("2026-11-12T21:00"))).toBeNull();
  });

  it("o das 24 h também espera pela manhã, e no Verão a janela é a de Lisboa (não a de UTC)", () => {
    const f = enviadaAs("2026-11-11T01:00");
    expect(passoDaFolha(f, emLisboa("2026-11-12T02:00"))).toBeNull();
    expect(passoDaFolha(f, emLisboa("2026-11-12T08:00"))).toBe("lembrete_24h");
    // Julho: as 23h de Lisboa são as 22h UTC, e as 08h são as 07h UTC.
    const v = enviadaAs("2026-07-10T20:30");
    expect(passoDaFolha(v, new Date("2026-07-10T22:00:00Z"))).toBeNull();
    expect(passoDaFolha(v, new Date("2026-07-11T01:00:00Z"))).toBeNull();
    expect(passoDaFolha(v, new Date("2026-07-11T06:59:00Z"))).toBeNull();
    expect(passoDaFolha(v, new Date("2026-07-11T07:00:00Z"))).toBe("lembrete_2h");
  });

  it("a ida à Mesa às 48 h não é uma mensagem ao cliente: não espera", () => {
    expect(passoDaFolha(enviadaAs("2026-11-11T02:30"), emLisboa("2026-11-13T02:30"))).toBe("mesa");
  });

  it("a rotina: 0 lembretes e 0 avisos às 23h e às 02h; 1 às 08h", async () => {
    estado.porResponder = [
      { id: 55, pedidoId: 700, providerId: 7, folhaJson: FOLHA_A, horasMarcadasEm: emLisboa("2026-11-11T20:30"), folhaLembrete2hEm: null, folhaLembrete24hEm: null },
    ];
    for (const hora of ["2026-11-11T23:00", "2026-11-12T02:00"]) {
      expect(await correrARotinaDasFolhas(emLisboa(hora))).toEqual({ lembretes: 0, mesa: 0, falhados: 0 });
    }
    expect(estado.passos).toEqual([]);
    expect(estado.avisosAoCliente).toEqual([]);
    expect(estado.avisosNoTerreno).toEqual([]);
    expect(await correrARotinaDasFolhas(emLisboa("2026-11-12T08:00"))).toEqual({ lembretes: 1, mesa: 0, falhados: 0 });
    expect(estado.avisosAoCliente).toHaveLength(1);
    expect(estado.avisosNoTerreno).toHaveLength(1);
  });

  it("a regra não usa o relógio da máquina", () => {
    const f = ler("src/lib/folha-da-mudanca.ts");
    const regra = f.slice(f.indexOf("export function horaDeLembrar"), f.indexOf("export function passoDaFolha"));
    expect(regra).toContain("pecasEmLisboa(agora).hora");
    expect(f).not.toMatch(/\.getHours\(\)/);
  });
});

/* ── 5. O envio que falha ─────────────────────────────────────────────────── */

describe("5. se a distribuição aos escolhidos falhar, fica uma linha no histórico do pedido", () => {
  const PEDIDO = {
    id: 900,
    description: "Mudança",
    city: "Seixal",
    urgency: null,
    quantidadeDeFotos: 0,
    valorDesejadoCliente: null,
    precisaFatura: false,
    formaDePagamento: "na_plataforma",
    baseUrl: "https://exemplo.pt",
  };
  async function escolha() {
    estado.candidatos = [candidato(1)];
    const p = await prepararEscolhaDaMudanca({ ...ORDER, parceirosEscolhidos: [idOpacoDoParceiro(1)] }, NA_TRANSICAO);
    if (p.caminho !== "escolhidos") throw new Error("a escolha devia passar");
    return p.escolha;
  }

  it("a distribuição rebenta: a linha fica, a Mesa vê, e o cliente não recebe «enviado»", async () => {
    const e = await escolha();
    const calado = vi.spyOn(console, "error").mockImplementation(() => undefined);
    estado.distribuir = async () => {
      throw new Error("a base caiu");
    };
    await expect(enviarAosEscolhidos(PEDIDO, e, NA_TRANSICAO)).resolves.toBeUndefined();
    calado.mockRestore();
    expect(estado.historico).toEqual([{ id: 900, message: linhaDoEnvioFalhado(["Parceiro 1"]) }]);
    expect(estado.historico[0].message).toMatch(/FALHOU/);
    expect(estado.avisosAoCliente).toEqual([]);
    // A prova do que o cliente viu ficou gravada antes.
    expect(estado.prova).toHaveLength(1);
  });

  it("a distribuição corre mas ninguém recebe: também fica a linha", async () => {
    const e = await escolha();
    estado.distribuir = async () => ({ ...RECEBEU, avisados: 0, receberam: 0 });
    await enviarAosEscolhidos(PEDIDO, e, NA_TRANSICAO);
    expect(estado.historico.map((h) => h.message)).toContain(linhaDoEnvioFalhado(["Parceiro 1"]));
    expect(estado.avisosAoCliente).toEqual([]);
  });

  it("quando segue, não há linha de falha", async () => {
    const e = await escolha();
    await enviarAosEscolhidos(PEDIDO, e, NA_TRANSICAO);
    expect(estado.historico).toHaveLength(1);
    expect(estado.historico[0].message).not.toMatch(/FALHOU/);
  });

  it("uma falha antes de chegar ao envio também a escreve (a rota do pedido)", () => {
    const rota = ler("src/app/api/simulador/pedido/route.ts");
    expect(rota).toContain("if (escolhaDaMudanca && !chegouAoEnvio) {");
    expect(rota).toContain("message: linhaDoEnvioFalhado(escolhaDaMudanca.escolhidos.map((x) => x.nome)),");
  });
});

/* ── 6. O rascunho ────────────────────────────────────────────────────────── */

describe("6. o rascunho da folha guarda-se sem avisar o cliente", () => {
  const TRABALHO = {
    id: 55,
    pedidoId: 700,
    estado: "acordada",
    baseDoPreco: "hora",
    ofertaClyon: null,
    valorFixoClyon: null,
    valorAcordado: 40,
    confirmadoEm: null,
    pagoEm: null,
    chegouEm: new Date("2026-11-11T09:00:00Z"),
    chegadaConfirmadaEm: null,
    horasMarcadasEm: null,
    horasConfirmadasEm: null,
  };
  const guardar = (corpo: Record<string, unknown>) =>
    marcarHorasPeloProfissional({
      providerId: 7,
      nome: "Parceiro 7",
      corpo: { negociacaoId: 55, rascunho: true, ...corpo },
      agora: emLisboa("2026-11-11T09:05"),
    });

  it("aceita um rascunho a meio (início sem fim) e não avisa ninguém", async () => {
    estado.negociacoes = [TRABALHO];
    const r = await guardar({
      inicio: "09:00",
      pausas: [{ inicio: "12:30" }],
      pessoas: 2,
      km: "22,5",
      materiais: { caixas: 4, filmeRolos: "1", inventado: 9 },
      motivoDosKm: "Rua de Exemplo, 3.º esquerdo",
    });
    expect(r.status).toBe(200);
    expect(r.corpo.rascunho).toBe(true);
    expect(r.corpo.folhaRascunho).toEqual({
      dia: null,
      inicio: "09:00",
      fim: null,
      pausas: [{ inicio: "12:30", fim: null }],
      pessoas: 2,
      km: 22.5,
      materiais: { caixas: 4, filmeRolos: 1 },
      guardadoEm: emLisboa("2026-11-11T09:05").toISOString(),
    });
    // Gravou só o rascunho, na negociação dele.
    expect(estado.rascunhos).toHaveLength(1);
    expect(estado.rascunhos[0].slice(0, 2)).toEqual([55, 7]);
    // Só horas e quantidades: o texto livre não entra.
    expect(String(estado.rascunhos[0][2])).not.toMatch(/Rua|esquerdo|inventado/);
    // Sem folha enviada, sem histórico, sem registo, sem aviso nenhum ao cliente.
    expect(estado.folhasEnviadas).toEqual([]);
    expect(estado.historico).toEqual([]);
    expect(estado.registos).toEqual([]);
    expect(estado.avisosAoCliente).toEqual([]);
    expect(estado.avisosNoTerreno).toEqual([]);
    expect(estado.depois).toBe(0);
  });

  it("guarda-se logo depois do «Cheguei», sem esperar que o cliente confirme a chegada, e corrige-se por cima", async () => {
    estado.negociacoes = [{ ...TRABALHO, chegadaConfirmadaEm: null }];
    expect((await guardar({ inicio: "09:00" })).status).toBe(200);
    expect((await guardar({ inicio: "09:10", fim: "13:00" })).status).toBe(200);
    expect(estado.rascunhos).toHaveLength(2);
    expect(JSON.parse(String(estado.rascunhos[1][2]))).toMatchObject({ inicio: "09:10", fim: "13:00" });
    // Com uma folha já enviada e contestada, o rascunho não a muda nem limpa o «Não concordo».
    estado.gravada = FOLHA_A;
    expect((await guardar({ inicio: "09:00", fim: "12:00" })).status).toBe(200);
    expect(estado.folhasEnviadas).toEqual([]);
    expect(estado.avisosAoCliente).toEqual([]);
  });

  it("só no trabalho dele, numa mudança com a lista, depois do «Cheguei» e antes de a folha estar confirmada", async () => {
    estado.negociacoes = [];
    expect((await guardar({})).status).toBe(404);
    estado.negociacoes = [{ ...TRABALHO, chegouEm: null }];
    expect((await guardar({})).status).toBe(409);
    estado.negociacoes = [{ ...TRABALHO, horasConfirmadasEm: new Date() }];
    expect((await guardar({})).status).toBe(409);
    estado.negociacoes = [{ ...TRABALHO, estado: "aberta" }];
    expect((await guardar({})).status).toBe(409);
    estado.negociacoes = [{ ...TRABALHO, baseDoPreco: "total" }];
    expect((await guardar({})).status).toBe(409);
    // Sem tarifa congelada (não é uma mudança com a lista): não há folha, não há rascunho.
    estado.negociacoes = [TRABALHO];
    estado.tarifaJson = "";
    expect((await guardar({})).status).toBe(409);
    expect(estado.rascunhos).toEqual([]);
  });

  it("o rascunho relê-se pela mesma regra, e um JSON estragado é «sem rascunho»", () => {
    const r = lerRascunhoDaFolha({ dia: "2026-11-11", inicio: "9:05", fim: "25:00", pessoas: 5, km: -3 }, new Date("2026-11-11T09:05:00Z"));
    expect(r).toEqual({ dia: "2026-11-11", inicio: "09:05", fim: null, pausas: [], pessoas: null, km: null, materiais: {}, guardadoEm: "2026-11-11T09:05:00.000Z" });
    expect(rascunhoDeJson(JSON.stringify(r))).toEqual(r);
    expect(rascunhoDeJson("{")).toBeNull();
    expect(rascunhoDeJson(null)).toBeNull();
  });

  it("na base: escreve só a coluna do rascunho; enviar a folha limpa-o; e a lista do parceiro devolve-o", () => {
    const db = ler("src/lib/db.ts");
    const gravar = db.slice(db.indexOf("export async function gravarRascunhoDaFolha("), db.indexOf("export type FolhaPorResponder"));
    expect(gravar).toContain("SET folhaRascunhoJson = ?\n");
    expect(gravar).toContain("WHERE id = ? AND providerId = ? AND estado = 'acordada'");
    expect(gravar).toContain("AND confirmadoEm IS NULL AND horasConfirmadasEm IS NULL");
    expect(gravar).not.toMatch(/horasMarcadasEm|folhaJson =|folhaLembrete|folhaHistoricoJson/);
    const enviar = db.slice(db.indexOf("export async function gravarFolhaDoTrabalho("), db.indexOf("export async function gravarRascunhoDaFolha("));
    expect(enviar).toContain("folhaRascunhoJson = NULL");
    expect(db).toContain("ALTER TABLE negociacoes ADD COLUMN folhaRascunhoJson TEXT NULL DEFAULT NULL");
    expect(ler("src/app/api/profissionais/meus-pedidos/route.ts")).toContain("rascunho: rascunhoDeJson(e.folhaRascunhoJson ?? null),");
  });
});
