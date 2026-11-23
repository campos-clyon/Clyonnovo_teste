import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * d85, FASE 0 — A VITÓRIA AGENTE: AS FUNDAÇÕES (22-11-2026).
 *
 * Tudo com conversas inventadas e uma base fingida; o SDK é simulado — nunca
 * se chama a API num teste. Aqui: a guarda dos €, o custo e o tecto diário, a
 * anonimização (a do script de medição), as ferramentas (o que lêem, o que
 * nunca escrevem nesta fase, as bloqueadas), o cliente (os parâmetros pedidos
 * pelo CEO, o inactivo sem chave, o tecto, a recusa) e o registo.
 */

import { motivoParaBloquearOAgente, eurosDosResultados } from "./vitoria-agente/guarda";
import {
  custoEmUsd,
  custoMensalProjectado,
  dentroDoTecto,
  MODELO_DA_VITORIA_AGENTE,
  TECTO_DIARIO_POR_OMISSAO_USD,
  tectoDasConfigs,
  tectoValido,
  usoDe,
} from "./vitoria-agente/custo";
import { conversaAnonimizada, textoAnonimizado, ultimosDigitos } from "./vitoria-agente/anonimizar";
import {
  correrFerramenta,
  estadoNovo,
  FERRAMENTAS_QUE_PROPOEM,
  FERRAMENTAS_DA_VITORIA,
  type DependenciasDasFerramentas,
  type PedidoParaOAgente,
} from "./vitoria-agente/ferramentas";
import { chaveDoClaude, correrOAgente, type ClienteDoClaude, type LinhaDoRegistoDoAgente } from "./vitoria-agente/cliente";
import { AVISO_AO_MODELO, mensagemDoTurno } from "./vitoria-agente/aviso-ao-modelo";
import { partirNaUltimaDoCliente, SQL_DAS_TABELAS_DA_VITORIA_AGENTE, totaisDasChamadas } from "./vitoria-agente/na-base";
import { comIva } from "./o-que-o-site-sabe";
import { RECOLHA_MINIMA_DOS_MOVEIS } from "./precos-publicos";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const pt = (v: number) => v.toFixed(2).replace(".", ",");
const AGORA = new Date("2026-11-22T11:00:00Z"); // domingo, 11h de Lisboa (Inverno: Lisboa = UTC)

/* ── A guarda dos € ──────────────────────────────────────────────────────── */

describe("a guarda dos €", () => {
  const minimo = RECOLHA_MINIMA_DOS_MOVEIS;
  const comO = comIva(minimo);
  const doSite = [{ oQueOSiteSabe: `recolha mínima ${pt(minimo)} € sem IVA (${pt(comO)} € com IVA)` }];

  it("um euro que veio de uma ferramenta desta conversa passa; um inventado não", () => {
    const ok = eurosDosResultados(doSite);
    expect(ok).toContain(minimo);
    expect(ok).toContain(comO);
    expect(motivoParaBloquearOAgente(`A recolha mínima é ${pt(minimo)} € sem IVA, ${pt(comO)} € com IVA.`, ok)).toBeNull();
    expect(motivoParaBloquearOAgente(`Fica por ${pt(minimo + 7)} € com IVA.`, ok)).toMatch(/não veio de nenhuma ferramenta/);
    // Sem ferramentas, nenhum euro sai — nem um preço do site.
    expect(motivoParaBloquearOAgente(`São ${pt(comO)} € com IVA.`, [])).toMatch(/não veio de nenhuma ferramenta/);
  });

  it("os números das chaves de dinheiro também contam; os outros não", () => {
    const e = eurosDosResultados([{ pedido: 812, propostas: [{ valorComIva: 452.03, total: 367.5 }] }]);
    expect(e).toEqual(expect.arrayContaining([452.03, 367.5]));
    expect(e).not.toContain(812);
    expect(motivoParaBloquearOAgente("Pedido #812: 812 € com IVA.", e)).toMatch(/não veio/);
  });

  it("o IVA nunca sozinho", () => {
    const ok = eurosDosResultados(doSite);
    expect(motivoParaBloquearOAgente(`A recolha mínima é ${pt(minimo)} € + IVA.`, ok)).toMatch(/sem IVA sozinho/);
    expect(motivoParaBloquearOAgente(`A recolha mínima é ${pt(minimo)} € sem IVA.`, ok)).toMatch(/sem IVA sozinho/);
    expect(motivoParaBloquearOAgente(`${pt(minimo)} € + IVA (${pt(comO)} € com IVA).`, ok)).toBeNull();
  });

  it("«parceiro», nunca «profissional»; português de Portugal", () => {
    expect(motivoParaBloquearOAgente("O profissional vai ao local.", [])).toMatch(/parceiro/);
    expect(motivoParaBloquearOAgente("Você pode mandar fotografias?", [])).toMatch(/Portugal/);
    expect(motivoParaBloquearOAgente("Qual é o seu celular?", [])).toMatch(/Portugal/);
    expect(motivoParaBloquearOAgente("Pode mandar-me duas fotografias, por favor?", [])).toBeNull();
  });

  it("as promessas de sempre (motivoParaBloquear) também", () => {
    expect(motivoParaBloquearOAgente("O parceiro vai lá no próprio dia.", [])).toMatch(/próprio dia/);
    expect(motivoParaBloquearOAgente("Deixamos um contentor à porta.", [])).toMatch(/contentores/);
    expect(motivoParaBloquearOAgente("Sou uma assistente virtual.", [])).toMatch(/assistente automática/);
    // A divulgação (d85, 22-11-2026): a verdade sai; fingir ser uma pessoa não.
    expect(motivoParaBloquearOAgente("Aqui é a Vitória, a assistente automática da CLYON. Se preferir falar com uma pessoa da equipa, é só dizer.", [])).toBeNull();
    expect(motivoParaBloquearOAgente("Sou a Vitória, a assistente automática da CLYON — não sou uma pessoa.", [])).toBeNull();
    expect(motivoParaBloquearOAgente("Sou uma pessoa da equipa, pode confiar.", [])).toMatch(/passar por uma pessoa/);
    expect(motivoParaBloquearOAgente("Eu sou humana, claro!", [])).toMatch(/passar por uma pessoa/);
    expect(motivoParaBloquearOAgente("Não sou um robô.", [])).toMatch(/Nega ser automática/);
    expect(motivoParaBloquearOAgente("Respondo à mão, como sempre.", [])).toMatch(/à mão/);
    expect(motivoParaBloquearOAgente("A nossa equipa vai buscar os móveis.", [])).toMatch(/empresa que faz o trabalho/);
    expect(motivoParaBloquearOAgente("A taxa é de 11 %.", [])).toMatch(/não é o IVA/);
    expect(motivoParaBloquearOAgente("", [])).toBe("Sem texto.");
  });
});

/* ── O custo e o tecto ───────────────────────────────────────────────────── */

describe("o custo e o tecto diário", () => {
  it("o modelo é o Claude Sonnet 5.5, e o tecto por omissão 10 USD por dia", () => {
    expect(MODELO_DA_VITORIA_AGENTE).toBe("claude-sonnet-5-5");
    expect(TECTO_DIARIO_POR_OMISSAO_USD).toBe(10);
  });

  it("a conta: entrada 2, saída 10, cache lida 0,10, cache escrita 2,50 USD por milhão", () => {
    const u = usoDe({ input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 2_000_000, cache_creation_input_tokens: 400_000 });
    expect(custoEmUsd(u)).toBeCloseTo(2 + 1 + 0.2 + 1, 6);
    expect(custoEmUsd(usoDe(null))).toBe(0);
    expect(custoEmUsd(usoDe({ input_tokens: -5, output_tokens: Number.NaN }))).toBe(0);
  });

  it("passado o tecto, não se gasta mais (e um tecto inválido não passa)", () => {
    expect(dentroDoTecto(9.99, 10)).toBe(true);
    expect(dentroDoTecto(10, 10)).toBe(false);
    expect(dentroDoTecto(Number.NaN, 10)).toBe(false);
    expect(tectoValido("12,5")).toBe(12.5);
    expect(tectoValido(0)).toBe(0);
    expect(tectoValido(-1)).toBeNull();
    expect(tectoValido(1000)).toBeNull();
    expect(tectoValido("dez")).toBeNull();
  });

  it("sem nada escrito nas Configs vale o tecto de omissão (10 USD); um 0 escrito de propósito desliga", () => {
    // sem linha na base: rows[0]?.valor é undefined
    expect(tectoDasConfigs(undefined)).toBe(10);
    expect(tectoDasConfigs(null)).toBe(10);
    expect(tectoDasConfigs("")).toBe(10);
    expect(tectoDasConfigs("   ")).toBe(10);
    expect(tectoDasConfigs("0")).toBe(0);
    expect(tectoDasConfigs(0)).toBe(0);
    expect(tectoDasConfigs("12,5")).toBe(12.5);
    expect(tectoDasConfigs("abc")).toBe(10);
    expect(tectoDasConfigs("1000")).toBe(10);
    expect(tectoValido(undefined)).toBeNull();
    expect(tectoValido(null)).toBeNull();
    expect(tectoValido("")).toBeNull();
    expect(tectoValido("  ")).toBeNull();
    expect(tectoValido("0")).toBe(0);
    // e com o de omissão o agente pode chamar o modelo
    expect(dentroDoTecto(0, tectoDasConfigs(undefined))).toBe(true);
  });

  it("o tecto lido da base passa pelo de omissão (não por tectoValido sozinho)", () => {
    const fonte = ler("src/lib/vitoria-agente/na-base.ts");
    const corpo = fonte.slice(fonte.indexOf("export async function tectoDiarioUsd"), fonte.indexOf("export async function mudarTectoDiario"));
    expect(corpo).toContain("tectoDasConfigs(rows[0]?.valor)");
  });

  it("o custo mensal projectado é a média por conversa vezes as conversas do mês", () => {
    expect(custoMensalProjectado([0.02, 0.04], 1500)).toBe(45);
    expect(custoMensalProjectado([], 1500)).toBe(0);
  });
});

/* ── A anonimização ──────────────────────────────────────────────────────── */

describe("a anonimização (o ensaio e o script de medição)", () => {
  const quem = [{ contactName: "Leonor Fontoura", address: "Rua das Amendoeiras 12, 3.º Esq" }];

  it("sem telefone, email, NIF, IBAN, código postal, nome nem rua", () => {
    const t = textoAnonimizado(
      "Sou a Leonor Fontoura, o meu número é 912 345 678 e o email leonor@exemplo.pt. NIF 123456789, IBAN PT50 0002 0123 1234 5678 9015 4. Moro na Rua das Amendoeiras 12, 2800-123 Almada.",
      quem,
    );
    for (const fora of ["Leonor", "Fontoura", "912", "345 678", "@", "123456789", "PT50", "2800-123", "Amendoeiras"]) expect(t, fora).not.toContain(fora);
    // d92: a marca diz que o dado foi recebido (o agente nunca o volta a pedir).
    expect(t).toContain("[código postal recebido]");
    expect(t).toContain("[contacto recebido]");
    expect(t).toContain("Almada");
  });

  it("a conversa inteira, linha a linha, e o telefone só pelos últimos dígitos", () => {
    const c = conversaAnonimizada([{ direccao: "in", texto: "Ligue-me para o 960000567" }], quem);
    expect(c[0].texto).not.toMatch(/960000567/);
    expect(ultimosDigitos("351960000567")).toBe("…567");
  });
});

/* ── As ferramentas, com a base fingida ──────────────────────────────────── */

const PEDIDO: PedidoParaOAgente = {
  id: 812,
  serviceType: "recolha_monos",
  status: "pendente",
  contactName: "Leonor Fontoura",
  address: "Rua das Amendoeiras 12",
  city: "Almada",
  postalCode: "2800-123",
  floor: "3",
  hasElevator: null,
  parkingDistance: null,
  description: "Um sofá e um colchão. Ligar à Leonor.",
  filesJson: "[]",
};

function base(over: Partial<DependenciasDasFerramentas> = {}): DependenciasDasFerramentas {
  return {
    telefone: "351912345678",
    agora: AGORA,
    pedidosDoTelefone: async () => [812],
    lerPedido: async (id) => (id === 812 ? PEDIDO : id === 900 ? { ...PEDIDO, id: 900 } : null),
    lerConversa: async () => [{ direccao: "in", texto: "Olá", criadoEm: null }],
    propostasDoPedido: async () => "Pedido #812: ainda à espera de propostas dos parceiros.",
    oQueOSiteSabe: () => `recolha mínima ${pt(RECOLHA_MINIMA_DOS_MOVEIS)} € sem IVA (${pt(comIva(RECOLHA_MINIMA_DOS_MOVEIS))} € com IVA)`,
    ...over,
  };
}

describe("as ferramentas", () => {
  it("catorze (d92), numa ordem fixa, todas strict, com additionalProperties false e tudo em required", () => {
    expect(FERRAMENTAS_DA_VITORIA.map((f) => f.name)).toEqual([
      "pedidos_do_cliente",
      "ler_pedido",
      "o_que_falta",
      "propostas_vivas",
      "ler_conversa",
      "o_que_o_site_sabe",
      "gravar_dado",
      "marcar_seguimento",
      "passar_a_equipa",
      "propor_resposta",
      "aceitar_proposta",
      "cancelar_pedido",
      "perguntar_ao_parceiro",
      "perguntas_frequentes",
    ]);
    for (const f of FERRAMENTAS_DA_VITORIA) {
      expect(f.strict, f.name).toBe(true);
      const s = f.input_schema as { additionalProperties?: boolean; properties?: Record<string, unknown>; required?: string[] };
      expect(s.additionalProperties, f.name).toBe(false);
      expect([...(s.required ?? [])].sort(), f.name).toEqual(Object.keys(s.properties ?? {}).sort());
    }
  });

  it("só lê os pedidos deste telefone, e sem dados de pessoas", async () => {
    const e = estadoNovo();
    const outro = await correrFerramenta("ler_pedido", { pedido: 900 }, base(), e);
    expect(outro.erro).toBe(true);
    expect(JSON.stringify(outro.resultado)).toMatch(/não é deste cliente/);
    const meu = await correrFerramenta("ler_pedido", { pedido: 812 }, base(), e);
    const t = JSON.stringify(meu.resultado);
    for (const fora of ["Leonor", "Fontoura", "Amendoeiras", "2800-123"]) expect(t, fora).not.toContain(fora);
    expect(meu.resultado).toMatchObject({ pedido: 812, localidade: "Almada", temNome: true, temMorada: true, fotografias: 0 });
  });

  it("o que falta vem de oQueFaltaNoPedido; as propostas, do ecrã do cliente", async () => {
    const e = estadoNovo();
    const f = await correrFerramenta("o_que_falta", { pedido: 812 }, base(), e);
    expect((f.resultado.falta as string[]).includes("fotografias")).toBe(true);
    const p = await correrFerramenta("propostas_vivas", { pedido: 812 }, base(), e);
    expect(p.resultado.comoOClienteVe).toMatch(/à espera de propostas/);
  });

  it("nesta fase nada escreve: gravar, marcar e passar dizem o que TERIAM feito", async () => {
    const e = estadoNovo();
    const g = await correrFerramenta("gravar_dado", { pedido: 812, passo: "andar", texto: "é no 2.º andar" }, base(), e);
    expect(g.resultado).toMatchObject({ ensaio: true, gravado: false });
    const s = await correrFerramenta("marcar_seguimento", { pedido: 812, dia: "2026-11-24", hora: "10:30", nota: "ligar depois" }, base(), e);
    expect(s.resultado).toMatchObject({ ensaio: true, marcado: false });
    const fora = await correrFerramenta("marcar_seguimento", { pedido: 812, dia: "2026-11-24", hora: "23:00", nota: "" }, base(), e);
    expect(fora.erro).toBe(true);
    const q = await correrFerramenta("passar_a_equipa", { motivo: "pede uma pessoa" }, base(), e);
    // d92: a mensagem ao cliente é escrita pelo modelo; sem ela, fica a frase de sempre (quem passa é quem chama).
    expect(q.resultado).toMatchObject({ passado: true, mensagemAceite: false });
    expect(e.mensagemDeEquipa).toBeNull();
    expect(e.passouAEquipa).toBe("pede uma pessoa");
    expect(e.teriaFeito.length).toBe(3);
  });

  it("d92: aceitar, cancelar e perguntar ao parceiro só PROPÕEM (o código é que fecha e cancela)", async () => {
    expect([...FERRAMENTAS_QUE_PROPOEM]).toEqual(["aceitar_proposta", "perguntar_ao_parceiro", "cancelar_pedido"]);
    // Sem propostas no pedido, aceitar não tem o que escolher.
    const r = await correrFerramenta("aceitar_proposta", { pedido: 812, escolha: "X" }, base(), estadoNovo());
    expect(r.erro).toBe(true);
    expect(JSON.stringify(r.resultado)).toMatch(/Não há propostas/);
    const codigo = ler("src/lib/vitoria-agente/ferramentas.ts");
    expect(codigo).not.toMatch(/cancelarPedido\(|fecharPeloCliente|atribuirOferta|INSERT|UPDATE/);
  });

  it("propor_resposta passa pela guarda, com os euros que as ferramentas deram", async () => {
    const e = estadoNovo();
    const semLer = await correrFerramenta("propor_resposta", { texto: `São ${pt(comIva(RECOLHA_MINIMA_DOS_MOVEIS))} € com IVA.` }, base(), e);
    expect(semLer.resultado.aceite).toBe(false);
    await correrFerramenta("o_que_o_site_sabe", {}, base(), e);
    const depois = await correrFerramenta(
      "propor_resposta",
      { texto: `A recolha mínima é ${pt(RECOLHA_MINIMA_DOS_MOVEIS)} € sem IVA (${pt(comIva(RECOLHA_MINIMA_DOS_MOVEIS))} € com IVA).` },
      base(),
      e,
    );
    expect(depois.resultado.aceite).toBe(true);
    expect(e.recusadas.length).toBe(1);
  });

  it("uma ferramenta que falha não lança: volta ao modelo como erro", async () => {
    const r = await correrFerramenta("ler_pedido", { pedido: 812 }, base({ lerPedido: async () => { throw new Error("base em baixo"); } }), estadoNovo());
    expect(r.erro).toBe(true);
    expect(await correrFerramenta("nao_existe", {}, base(), estadoNovo())).toMatchObject({ erro: true });
  });
});

/* ── O cliente, com o SDK simulado ───────────────────────────────────────── */

type Pedido = Anthropic.Beta.MessageCreateParamsNonStreaming;

function respostaDoModelo(content: unknown[], stop_reason: string, usage = { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 }) {
  return { id: "msg_x", type: "message", role: "assistant", model: "claude-sonnet-5-5", content, stop_reason, usage } as unknown as Anthropic.Beta.BetaMessage;
}

function clienteFingido(respostas: Anthropic.Beta.BetaMessage[]) {
  const pedidos: Pedido[] = [];
  const cliente: ClienteDoClaude = {
    beta: {
      messages: {
        create: vi.fn(async (p: Pedido) => {
          pedidos.push(JSON.parse(JSON.stringify(p)) as Pedido);
          const r = respostas.shift();
          if (!r) throw new Error("sem mais respostas");
          return r;
        }),
      },
    },
  };
  return { cliente, pedidos };
}

const CONVERSA = [
  { direccao: "out", texto: "Boa tarde! Aqui é a Vitória, assistente online da CLYON." },
  { direccao: "in", texto: "Quanto custa levar um sofá?" },
];

describe("o cliente do Claude", () => {
  it("sem a chave fica inactivo e diz porquê (nunca falha calado)", async () => {
    expect(chaveDoClaude({})).toBeNull();
    expect(chaveDoClaude({ ANTHROPIC_API_KEY: "  " })).toBeNull();
    const r = await correrOAgente(
      { conversa: CONVERSA, pedidos: [], agora: AGORA },
      { cliente: null, ferramentas: base(), gastoETecto: async () => ({ gastoUsd: 0, tectoUsd: 10 }), registar: async () => {} },
    );
    expect(r.estado).toBe("inactivo");
    expect(r.motivo).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("passado o tecto, não chama o modelo (volta às regras)", async () => {
    const { cliente, pedidos } = clienteFingido([]);
    const r = await correrOAgente(
      { conversa: CONVERSA, pedidos: [], agora: AGORA },
      { cliente, ferramentas: base(), gastoETecto: async () => ({ gastoUsd: 10.2, tectoUsd: 10 }), registar: async () => {} },
    );
    expect(r.estado).toBe("tecto");
    expect(pedidos.length).toBe(0);
    const semSaber = await correrOAgente(
      { conversa: CONVERSA, pedidos: [], agora: AGORA },
      { cliente, ferramentas: base(), gastoETecto: async () => { throw new Error("x"); }, registar: async () => {} },
    );
    expect(semSaber.estado).toBe("tecto");
  });

  it("o pedido: Sonnet 5.5, adaptativo com esforço médio (d92), sem temperature, recolha «default», strict, auto, cache, e a data FORA do aviso", async () => {
    const minimo = pt(RECOLHA_MINIMA_DOS_MOVEIS);
    const com = pt(comIva(RECOLHA_MINIMA_DOS_MOVEIS));
    const { cliente, pedidos } = clienteFingido([
      respostaDoModelo([{ type: "thinking", thinking: "", signature: "s" }, { type: "tool_use", id: "t1", name: "o_que_o_site_sabe", input: {} }], "tool_use", {
        input_tokens: 1500,
        output_tokens: 60,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 2400,
      }),
      respostaDoModelo(
        [{ type: "tool_use", id: "t2", name: "propor_resposta", input: { texto: `Na referência do site, a recolha mínima é ${minimo} € sem IVA (${com} € com IVA). O preço final vem nas propostas dos parceiros.` } }],
        "tool_use",
      ),
    ]);
    const registo: LinhaDoRegistoDoAgente[] = [];
    const r = await correrOAgente(
      { conversa: CONVERSA, pedidos: [], agora: AGORA },
      { cliente, ferramentas: base(), gastoETecto: async () => ({ gastoUsd: 0, tectoUsd: 10 }), registar: async (l) => void registo.push(l) },
    );
    expect(r.estado).toBe("ok");
    expect(r.texto).toContain(`${com} € com IVA`);
    expect(pedidos.length).toBe(2);
    const p = pedidos[0] as Pedido & Record<string, unknown>;
    expect(p.model).toBe("claude-sonnet-5-5");
    expect(p.thinking).toEqual({ type: "adaptive" });
    expect(p.output_config).toEqual({ effort: "medium" });
    expect(p).not.toHaveProperty("temperature");
    expect(p).not.toHaveProperty("top_p");
    expect(p.fallbacks).toBe("default");
    expect(p.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(p.tool_choice).toEqual({ type: "auto" });
    expect((p.tools ?? []).every((t) => (t as { strict?: boolean }).strict === true)).toBe(true);
    const system = p.system as Array<{ text: string; cache_control?: unknown }>;
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(p.cache_control).toEqual({ type: "ephemeral" });
    // O aviso é igual byte a byte em todas as chamadas (a cache), e não tem a data.
    expect((pedidos[1].system as Array<{ text: string }>)[0].text).toBe(system[0].text);
    expect(system[0].text).toBe(AVISO_AO_MODELO);
    expect(AVISO_AO_MODELO).not.toMatch(/\b20\d\d\b|domingo|segunda-feira|novembro/);
    expect(JSON.stringify(p.messages[0])).toContain("2026-11-22");
    // O pensamento volta tal e qual na segunda ida.
    expect(JSON.stringify(pedidos[1].messages[1])).toContain('"type":"thinking"');
    // O uso e o custo, com a cache.
    expect(r.uso.cacheLidos).toBe(2000);
    expect(r.uso.cacheEscritos).toBe(2400);
    expect(r.custoUsd).toBeGreaterThan(0);
    expect(registo.filter((l) => l.ferramenta === "chamada").length).toBe(2);
    expect(registo.map((l) => l.ferramenta)).toEqual(["chamada", "o_que_o_site_sabe", "chamada", "propor_resposta", "resposta"]);
  });

  it("um preço inventado não sai: o texto solto também passa pela guarda", async () => {
    const { cliente } = clienteFingido([respostaDoModelo([{ type: "text", text: "Fica em 99,99 € com IVA." }], "end_turn")]);
    const r = await correrOAgente(
      { conversa: CONVERSA, pedidos: [], agora: AGORA },
      { cliente, ferramentas: base(), gastoETecto: async () => ({ gastoUsd: 0, tectoUsd: 10 }), registar: async () => {} },
    );
    expect(r.estado).toBe("bloqueado");
    expect(r.texto).toBeNull();
  });

  it("a recusa do modelo, um erro da API ou idas a mais não lançam: voltam às regras", async () => {
    const deps = (cliente: ClienteDoClaude) => ({ cliente, ferramentas: base(), gastoETecto: async () => ({ gastoUsd: 0, tectoUsd: 10 }), registar: async () => {} });
    const recusa = clienteFingido([respostaDoModelo([], "refusal")]);
    expect((await correrOAgente({ conversa: CONVERSA, pedidos: [], agora: AGORA }, deps(recusa.cliente))).estado).toBe("recusou");
    const falha = clienteFingido([]);
    const r = await correrOAgente({ conversa: CONVERSA, pedidos: [], agora: AGORA }, deps(falha.cliente));
    expect(r.estado).toBe("erro");
    const voltas = clienteFingido(
      Array.from({ length: 8 }, (_, i) => respostaDoModelo([{ type: "tool_use", id: `t${i}`, name: "ler_conversa", input: { mensagens: 5 } }], "tool_use")),
    );
    const v = await correrOAgente({ conversa: CONVERSA, pedidos: [], agora: AGORA }, deps(voltas.cliente));
    expect(v.estado).toBe("bloqueado");
    expect(v.idas).toBe(6);
  });

  it("passar à equipa é um resultado, não um erro", async () => {
    const { cliente } = clienteFingido([
      respostaDoModelo([{ type: "tool_use", id: "t1", name: "passar_a_equipa", input: { motivo: "quer aceitar a proposta" } }], "tool_use"),
      respostaDoModelo([], "end_turn"),
    ]);
    const r = await correrOAgente(
      { conversa: CONVERSA, pedidos: [], agora: AGORA },
      { cliente, ferramentas: base(), gastoETecto: async () => ({ gastoUsd: 0, tectoUsd: 10 }), registar: async () => {} },
    );
    expect(r.estado).toBe("equipa");
    expect(r.motivo).toBe("quer aceitar a proposta");
  });
});

/* ── O turno, o registo e o ensaio ───────────────────────────────────────── */

describe("o turno, o registo e o ensaio em sombra", () => {
  it("a mensagem do turno leva o dia de Lisboa, os pedidos e a conversa", () => {
    const m = mensagemDoTurno(AGORA, CONVERSA, [812]);
    expect(m).toContain("2026-11-22");
    expect(m).toContain("#812");
    expect(m).toContain("[cliente] Quanto custa levar um sofá?");
  });

  it("parte o fio na última mensagem do cliente: a resposta real é o que saiu depois", () => {
    const fio = [
      { direccao: "out", texto: "Olá!" },
      { direccao: "in", texto: "Tenho um sofá" },
      { direccao: "in", texto: "e um colchão" },
      { direccao: "out", texto: "Obrigada! Em que localidade?" },
    ];
    const p = partirNaUltimaDoCliente(fio)!;
    expect(p.doCliente).toBe("Tenho um sofá\ne um colchão");
    expect(p.respostaReal).toBe("Obrigada! Em que localidade?");
    expect(p.conversa.length).toBe(3);
    expect(partirNaUltimaDoCliente([{ direccao: "out", texto: "Olá" }])).toBeNull();
  });

  it("os totais do dia e do mês contam no dia de Lisboa", () => {
    const l = (iso: string, custoUsd: number, erro: string | null = null) => ({
      criadoEm: new Date(iso), custoUsd, tokensEntrada: 10, tokensSaida: 1, tokensCacheLidos: 100, tokensCacheEscritos: 0, modelo: "claude-sonnet-5-5", erro,
    });
    const t = totaisDasChamadas([l("2026-11-22T09:00:00Z", 0.5), l("2026-11-22T10:00:00Z", 0.25, "x"), l("2026-11-21T23:30:00Z", 1), l("2026-10-31T12:00:00Z", 4)], AGORA);
    expect(t.hoje).toMatchObject({ chamadas: 2, erros: 1, custoUsd: 0.75, tokensCacheLidos: 200 });
    expect(t.mes).toMatchObject({ chamadas: 3, custoUsd: 1.75 });
  });

  it("as colunas que se usam estão no CREATE TABLE do vitoriaAccoes e do vitoriaEnsaios", () => {
    const accoes = SQL_DAS_TABELAS_DA_VITORIA_AGENTE.find((s) => s.includes("vitoriaAccoes ("))!;
    for (const c of [
      "ensaioId", "pedidoId", "telefone", "ferramenta", "entradaJson", "resultadoJson", "texto", "modelo", "tokensEntrada",
      "tokensSaida", "tokensCacheLidos", "tokensCacheEscritos", "custoUsd", "ensaio", "erro", "criadoEm",
    ]) {
      expect(accoes, c).toMatch(new RegExp(`\\n\\s+${c}\\s`));
    }
    const ensaios = SQL_DAS_TABELAS_DA_VITORIA_AGENTE.find((s) => s.includes("vitoriaEnsaios ("))!;
    for (const c of ["telefone", "mensagemDoCliente", "respostaReal", "respostaDoAgente", "teriaFeitoJson", "estado", "custoUsd", "avaliacao", "avaliadoPor", "avaliadoEm"]) {
      expect(ensaios, c).toMatch(new RegExp(`\\n\\s+${c}\\s`));
    }
  });

  it("o ensaio corre na ponte DEPOIS da resposta real, e o interruptor está DESLIGADO na dúvida", () => {
    const ponte = ler("src/app/api/whatsapp/ponte/route.ts");
    const responder = ponte.indexOf("tratarMensagemDoCliente(telefone, { tipo: \"texto\", texto: junto");
    const ensaio = ponte.indexOf("await ensaioEmSombra(telefone)");
    expect(responder).toBeGreaterThan(0);
    expect(ensaio).toBeGreaterThan(responder);
    expect(ponte.slice(responder, ensaio)).toContain("after(async () => {");
    const naBase = ler("src/lib/vitoria-agente/na-base.ts");
    expect(naBase).toContain("if (!l) return desligado;");
    expect(naBase).toContain("if (!(await interruptorDoEnsaio()).ligado) return { feito: false, porque: \"ensaio desligado\" };");
    // O ensaio nunca envia: nada de enviar ao cliente em todo o agente.
    for (const f of ["na-base.ts", "cliente.ts", "ferramentas.ts", "guarda.ts"]) {
      expect(ler(`src/lib/vitoria-agente/${f}`), f).not.toMatch(/enviarTextoWhatsApp|enviarAvisoWhatsApp|enviarEmail/);
    }
    const rota = ler("src/app/api/admin/vitoria-agente/route.ts");
    expect(rota).toContain("requireAdminGeral");
    expect(rota).toContain('!== "LIGAR"');
  });

  it("o script de medição só lê, anonimiza, tem tecto e nunca escreve o relatório no repositório", () => {
    const s = ler("scripts/medir-vitoria-agente.ts");
    expect(s).toContain("conversaAnonimizada(partido.conversa, quem)");
    expect(s).toContain("O relatório nunca fica no repositório");
    expect(s).toMatch(/Number\(valor\("tecto"\) \?\? 20\)/);
    expect(s).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
    expect(s).not.toMatch(/registarAccao|ensaioEmSombra/);
  });
});
