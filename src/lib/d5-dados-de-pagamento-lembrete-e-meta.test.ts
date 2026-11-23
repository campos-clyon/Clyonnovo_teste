import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OS_DADOS_DO_PARCEIRO_ESTAO_NO_PEDIDO,
  PAGA_AO_CONTRATADO,
  PAGA_AO_CONTRATADO_POR_CONFIRMAR,
  REGRAS_DO_PAGAMENTO_PARA_O_MODELO,
  pagaAoContratado,
} from "./o-pagamento-da-vitoria";
import { DADOS_DE_PAGAMENTO_A_CONFIRMAR } from "./dados-de-pagamento-por-confirmar";
import { mensagemDasPropostas } from "./mensagem-das-propostas";
import { OS_DADOS_JA_ESTAO_NO_PEDIDO, textoDoAvisoDosDadosConfirmados } from "./avisar-dados-de-pagamento-confirmados";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";

/**
 * A VITÓRIA DIZ A VERDADE SOBRE OS DADOS DE PAGAMENTO, O «2» NUNCA CANCELA À
 * PRIMEIRA E A META TEM TRAVA — d5 (CEO e dono, 21-11-2026), a parte do I&D;
 * e o número inteiro na consulta da Vitória (d3 de 22-11-2026). Números e
 * nomes INVENTADOS (o repositório é público); nenhuma mensagem sai a ninguém.
 */

const base = vi.hoisted(() => ({ fila: [] as string[] }));

const ler = (c: string) => readFileSync(join(process.cwd(), c), "utf8");

describe("(1) o pedido por confirmar nunca manda procurar um IBAN que não está lá", () => {
  it("com os dados por confirmar, a frase é a única da d5 de 19/11 e lembra o dinheiro no local", () => {
    const t = pagaAoContratado(true);
    expect(t).toBe(PAGA_AO_CONTRATADO_POR_CONFIRMAR);
    expect(t).toContain(DADOS_DE_PAGAMENTO_A_CONFIRMAR);
    expect(t).toContain("dinheiro no local");
    expect(t).not.toMatch(/está(?:o)? no seu pedido/i);
    expect(t).not.toMatch(/IBAN|MB WAY/);
  });

  it("sem nada por confirmar, a frase de sempre", () => {
    expect(pagaAoContratado(false)).toBe(PAGA_AO_CONTRATADO);
    expect(PAGA_AO_CONTRATADO).toContain("o IBAN e o MB WAY dele estão no seu pedido");
  });

  it("a mensagem «Está combinado» do pedido já fechado usa a frase certa pelo estado do parceiro", () => {
    const base = {
      profissional: "Parceiro Inventado",
      valor: 100,
      taxaCliente: 0,
      semIva: 100,
      total: 123,
      modelo: "iva_incluido" as const,
      aPagar: 123,
      forma: "na_plataforma" as const,
      novoModelo: true,
    };
    const com = mensagemDasPropostas({ pedidoId: 812, servico: "recolha_monos", propostas: [], fechado: { ...base, dadosPorConfirmar: true } } as never);
    const sem = mensagemDasPropostas({ pedidoId: 812, servico: "recolha_monos", propostas: [], fechado: base } as never);
    expect(com).toContain(DADOS_DE_PAGAMENTO_A_CONFIRMAR);
    expect(com).not.toContain("estão no seu pedido");
    expect(sem).toContain("estão no seu pedido");
  });

  it("os cinco sítios da Vitória leem o estado dos dados, e nenhum usa a frase fixa por cima", () => {
    for (const c of ["src/lib/whatsapp-negociacao.ts", "src/lib/assistente-automatico.ts", "src/lib/mensagem-das-propostas.ts"]) {
      const t = ler(c);
      expect(t, c).toContain("pagaAoContratado(");
      expect(t, c).not.toMatch(/\$\{PAGA_AO_CONTRATADO\}/);
    }
    expect(ler("src/lib/whatsapp-negociacao.ts")).toContain("negociacoesComDadosPorConfirmar");
    expect(ler("src/lib/assistente-automatico.ts")).toContain("negociacoesComDadosPorConfirmar");
  });

  it("a pergunta pelos dados e o aviso ao modelo dizem que, por confirmar, o pedido o diz e há dinheiro no local", () => {
    expect(OS_DADOS_DO_PARCEIRO_ESTAO_NO_PEDIDO).toMatch(/ainda estiver a confirmar/);
    expect(OS_DADOS_DO_PARCEIRO_ESTAO_NO_PEDIDO).toContain("dinheiro no local");
    expect(REGRAS_DO_PAGAMENTO_PARA_O_MODELO.join(" ")).toMatch(/ainda estiver a confirmar os dados do parceiro/);
  });

  it("as frases novas têm tradução fixa em inglês, francês e espanhol", () => {
    for (const frase of [DADOS_DE_PAGAMENTO_A_CONFIRMAR, "Pode sempre pagar em dinheiro no local.", "Paga-lhe diretamente.", OS_DADOS_JA_ESTAO_NO_PEDIDO]) {
      for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(frase, l), `${l}: ${frase}`).toBeTruthy();
    }
  });
});

describe("o «Confirmei com o parceiro» avisa o cliente", () => {
  it("o texto diz onde estão os dados, sem os dizer", () => {
    const { titulo, corpo } = textoDoAvisoDosDadosConfirmados(812);
    expect(corpo).toBe("Pedido #812: Os dados de pagamento do parceiro já estão no seu pedido.");
    expect(titulo + corpo).not.toMatch(/\d{9}|PT\d{2}|IBAN/);
  });

  it("a rota avisa depois de gravar (push na app, senão email) e nunca bloqueia a confirmação", () => {
    const rota = ler("src/app/api/admin/negociacoes/dados-de-pagamento/route.ts");
    expect(rota).toContain("avisarClienteDosDadosConfirmados");
    expect(rota.indexOf("confirmarDadosDePagamento(negociacaoId")).toBeLessThan(rota.indexOf("avisarClienteDosDadosConfirmados"));
    expect(rota).toMatch(/catch \(e\) \{[\s\S]*o aviso ao cliente falhou/);
    const aviso = ler("src/lib/avisar-dados-de-pagamento-confirmados.ts");
    expect(aviso).toContain("sendPushToUser(");
    expect(aviso.indexOf("sendPushToUser(")).toBeLessThan(aviso.indexOf("enviarEmailDoSeguimento"));
  });
});

describe("(3) a trava da API da Meta", () => {
  const ambiente = { ...process.env };

  beforeEach(async () => {
    base.fila = [];
    process.env.WHATSAPP_TOKEN = "token-inventado";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "111";
    process.env.WHATSAPP_VERIFY_TOKEN = "v";
    process.env.WHATSAPP_APP_SECRET = "s";
    process.env.PONTE_WHATSAPP_SEGREDO = "segredo-inventado";
    const { esquecerALeituraDaMeta } = await import("./whatsapp-pela-meta");
    esquecerALeituraDaMeta();
  });
  afterEach(() => {
    process.env = { ...ambiente };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("desligado por omissão: sem linha, sem tabela ou com a base a falhar", async () => {
    vi.doMock("./db", () => ({
      getPool: async () => ({ execute: async () => [[], []] }),
    }));
    const { enviarPelaMeta, esquecerALeituraDaMeta, interruptorDaMeta } = await import("./whatsapp-pela-meta");
    expect((await interruptorDaMeta()).ligado).toBe(false);
    esquecerALeituraDaMeta();
    expect(await enviarPelaMeta()).toBe(false);
    vi.doMock("./db", () => ({ getPool: async () => { throw new Error("sem base"); } }));
    vi.resetModules();
    const outra = await import("./whatsapp-pela-meta");
    expect(await outra.enviarPelaMeta()).toBe(false);
  });

  it("ligado só com a linha a 1", async () => {
    vi.doMock("./db", () => ({
      getPool: async () => ({ execute: async () => [[{ ligado: 1, mudadoEm: null, porQuem: "alguém" }], []] }),
    }));
    const { enviarPelaMeta } = await import("./whatsapp-pela-meta");
    expect(await enviarPelaMeta()).toBe(true);
  });

  it("as quatro variáveis e o interruptor desligado: o envio fica na fila da ponte e a Meta não é chamada", async () => {
    const chamadas: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      chamadas.push(String(url));
      return new Response("{}", { status: 200 });
    }));
    vi.doMock("./db", () => ({
      getPool: async () => ({ execute: async () => [[], []] }),
      podeAvisarONumeroWhatsApp: async () => true,
      saidasDoNumeroWhatsApp: async () => [],
      atrasoDeRespostaDoAssistente: async () => 0,
      guardarNaFilaWhatsApp: async (_t: string, texto: string) => {
        base.fila.push(texto);
      },
    }));
    vi.doMock("@/lib/db", () => ({
      podeAvisarONumeroWhatsApp: async () => true,
      saidasDoNumeroWhatsApp: async () => [],
      atrasoDeRespostaDoAssistente: async () => 0,
      guardarNaFilaWhatsApp: async (_t: string, texto: string) => {
        base.fila.push(texto);
      },
    }));
    vi.doMock("@/lib/lingua-do-cliente", async (original) => ({
      ...(await original<typeof import("./lingua-do-cliente")>()),
    }));
    const nuvem = await import("./whatsapp-cloud");
    expect(nuvem.whatsappConfigurado()).toBe(true);
    const saiu = await nuvem.enviarAvisoWhatsApp("351910000000", "Olá! Aviso de teste inventado.").catch(() => false);
    expect(chamadas.filter((u) => u.includes("graph.facebook.com"))).toEqual([]);
    expect(saiu).toBe(true);
    expect(base.fila).toHaveLength(1);
  });

  it("o código: os três caminhos da Cloud API passam pelo interruptor, e um erro da Meta fica marcado", () => {
    const nuvem = ler("src/lib/whatsapp-cloud.ts");
    expect(nuvem).toContain("!whatsappConfigurado() || !(await enviarPelaMeta())");
    expect(nuvem.match(/whatsappConfigurado\(\) && \(await enviarPelaMeta\(\)\)/g)?.length).toBe(2);
    expect(nuvem).toContain("await registarErroDaMeta(res.status, detalhe)");
    // Nenhum `if (whatsappConfigurado())` a mandar para a Meta sem o interruptor.
    expect(nuvem).not.toMatch(/\n\s*(?:\} else )?if \(whatsappConfigurado\(\)\) \{/);
  });

  it("o interruptor nas Configs: só o administrador, LIGAR para ligar, registo permanente, desligado por omissão", () => {
    const rota = ler("src/app/api/admin/interruptor-do-whatsapp-pela-meta/route.ts");
    expect(rota).toContain("requireAdminGeral");
    expect(rota).toContain('!== "LIGAR"');
    const lib = ler("src/lib/whatsapp-pela-meta.ts");
    expect(lib).toContain("registarNaTransaccao");
    expect(lib).toMatch(/const desligado: InterruptorDaMeta = \{ ligado: false/);
    expect(ler("src/components/admin/LegacyAdminClient.tsx")).toContain("<InterruptorDoWhatsAppPelaMeta />");
  });
});

describe("(d3 de 22-11) a Vitória reconhece o número inteiro, não só os 9 dígitos finais", () => {
  it("o pedido em curso e a equipa na conversa conferem pelo mesmo mesmoTelefoneEstrito do seguimento (d83)", () => {
    const t = ler("src/lib/pedido-em-curso-na-base.ts");
    expect(t).toContain('import { mesmoTelefoneEstrito } from "./validade-do-orcamento"');
    expect(t.match(/mesmoTelefoneEstrito\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(t).toContain("contactPhone,");
  });

  it("um número de outro país com os mesmos 9 dígitos finais não é o mesmo; o português com ou sem 351 é", async () => {
    const { mesmoTelefoneEstrito } = await import("./validade-do-orcamento");
    expect(mesmoTelefoneEstrito("351912345678", "912345678")).toBe(true);
    expect(mesmoTelefoneEstrito("+351 912 345 678", "00351912345678")).toBe(true);
    expect(mesmoTelefoneEstrito("447912345678", "351912345678")).toBe(false);
    expect(mesmoTelefoneEstrito("33912345678", "912345678")).toBe(false);
  });
});
