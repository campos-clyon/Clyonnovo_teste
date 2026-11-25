import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  KM_DA_ZONA_POR_OMISSAO,
  canalDaMensagemForaDaZona,
  foraDaZona,
  historicoDoCancelamentoForaDaZona,
  kmDaBaseDoPedido,
  limiteDaZona,
  linhaDoForaDaZona,
  mensagemDoForaDaZona,
  respostaDaVitoriaForaDaZona,
} from "./fora-da-zona";
import { MOTIVOS_DO_ENVIO_AUTOMATICO, porqueNaoSegueSozinho } from "./envio-automatico-aos-parceiros";
import { defaultSimulatorSettings } from "./simulator-settings";

/**
 * d128 (dono, 25-11-2026) — a CLYON não faz trabalhos a mais de 200 km de
 * Lisboa (a base). Na mudança conta a origem; o destino não tem limite. O
 * pedido marcado fica parado (parceiros e mensagens automáticas) até uma
 * pessoa confirmar a morada; «Cancelar e avisar o cliente» cancela e envia
 * UMA mensagem.
 *
 * relógio: datas explícitas — a regra da zona não lê o relógio (nem o modelo de 15-11).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const LISBOA = { lat: 38.7223, lng: -9.1393 };
const LEIRIA = { lat: 39.7436, lng: -8.8071 };
const COIMBRA = { lat: 40.2033, lng: -8.4103 };
const PORTO = { lat: 41.1579, lng: -8.6291 };

const recolha = (address: unknown, mais: Record<string, unknown> = {}) => ({
  serviceType: "recolha_moveis",
  status: "sem_assistente",
  rawOrderJson: JSON.stringify({ address, ...mais }),
});

/* ── A regra ─────────────────────────────────────────────────────────────── */

describe("d128 — a marca «fora da zona»", () => {
  it("o limite está nas Configs, a 200 km por omissão", () => {
    const def = defaultSimulatorSettings.find((d) => d.key === "zona_km_maximo");
    expect(def?.value).toBe(200);
    expect(KM_DA_ZONA_POR_OMISSAO).toBe(200);
    expect(limiteDaZona("150")).toBe(150);
    expect(limiteDaZona(null)).toBe(200);
    expect(limiteDaZona("abc")).toBe(200);
    expect(ler("src/components/admin/LegacyAdminClient.tsx")).toMatch(/"zona_km_maximo"/);
  });

  it("marca acima de 200 km, com a distância", () => {
    const f = foraDaZona(recolha(PORTO));
    expect(f).not.toBeNull();
    expect(f!.km).toBeGreaterThan(200);
    expect(f!.limite).toBe(200);
    expect(foraDaZona(recolha(COIMBRA))?.km).toBeGreaterThan(200);
    expect(linhaDoForaDaZona(f!)).toMatch(/^Fora da zona: \d+ km de Lisboa — confirme a morada com o cliente$/);
  });

  it("dentro do limite não marca (Lisboa, Leiria)", () => {
    expect(foraDaZona(recolha(LISBOA))).toBeNull();
    expect(foraDaZona(recolha(LEIRIA))).toBeNull();
  });

  it("o limite das Configs manda", () => {
    expect(foraDaZona(recolha(COIMBRA), 300)).toBeNull();
    expect(foraDaZona(recolha(LEIRIA), 100)).not.toBeNull();
  });

  it("mudança com a origem na zona e o destino longe não marca", () => {
    const p = {
      serviceType: "mudanca",
      status: "sem_assistente",
      rawOrderJson: JSON.stringify({ originAddress: LISBOA, destinationAddress: PORTO, movingDistance: { distanceKm: 313 } }),
    };
    expect(foraDaZona(p)).toBeNull();
  });

  it("mudança com a origem longe marca, pela origem", () => {
    const p = {
      serviceType: "mudanca",
      status: "sem_assistente",
      rawOrderJson: JSON.stringify({ originAddress: PORTO, destinationAddress: LISBOA }),
    };
    const f = foraDaZona(p);
    expect(f?.de).toBe("origem");
    expect(f!.km).toBeGreaterThan(200);
    // Pedidos da Vitória e do backoffice: a origem é a `address`.
    expect(foraDaZona({ ...p, rawOrderJson: JSON.stringify({ address: PORTO, destinationAddress: LISBOA }) })?.de).toBe("origem");
  });

  it("depois de a equipa editar uma mudança, conta a morada editada", () => {
    const p = {
      serviceType: "mudanca",
      status: "sem_assistente",
      rawOrderJson: JSON.stringify({ originAddress: PORTO, address: LISBOA, editadoPelaClyonEm: "2026-11-25T10:00:00Z" }),
    };
    expect(foraDaZona(p)).toBeNull();
  });

  it("distância desconhecida não marca", () => {
    expect(foraDaZona(recolha(undefined))).toBeNull();
    expect(foraDaZona(recolha({ lat: null, lng: null }))).toBeNull();
    expect(foraDaZona(recolha({ lat: 0, lng: 0 }))).toBeNull();
    expect(foraDaZona({ serviceType: "recolha_moveis", status: "sem_assistente", rawOrderJson: "não é json" })).toBeNull();
    // A estimativa do código postal (sem a duração do Google) não é uma medida.
    expect(foraDaZona(recolha(undefined, { distanceFromBase: { distanceKm: 30 } }))).toBeNull();
    expect(kmDaBaseDoPedido("mudanca", "{}")).toBeNull();
  });

  it("a medida do simulador pela estrada ganha à linha recta (salvo depois de editar)", () => {
    const medida = { distanceKm: 250, durationSeconds: 9000 };
    expect(kmDaBaseDoPedido("recolha_moveis", { address: LISBOA, distanceFromBase: medida })).toEqual({
      km: 250,
      de: "morada",
      medida: "estrada",
    });
    expect(kmDaBaseDoPedido("recolha_moveis", { address: LISBOA, distanceFromBase: medida, editadoPelaClyonEm: "x" })?.medida).toBe(
      "linha_recta",
    );
  });

  it("um pedido fechado nunca marca", () => {
    for (const status of ["cancelado", "arquivado", "concluido"]) {
      expect(foraDaZona({ ...recolha(PORTO), status })).toBeNull();
    }
  });
});

/* ── Parado: os parceiros e as mensagens automáticas ─────────────────────── */

describe("d128 — o pedido marcado fica parado", () => {
  const COMPLETO = {
    status: "sem_assistente",
    serviceType: "recolha_moveis",
    contactName: "Cliente",
    contactEmail: "cliente@exemplo.pt",
    faltas: [],
    codigoPostal: "4000-123",
  };

  it("não segue sozinho para os parceiros (envio automático), com o motivo à vista", () => {
    expect(porqueNaoSegueSozinho(COMPLETO)).toBeNull();
    expect(porqueNaoSegueSozinho({ ...COMPLETO, foraDaZona: true })).toBe("fora_da_zona");
    expect(MOTIVOS_DO_ENVIO_AUTOMATICO.fora_da_zona).toMatch(/fora da zona/);
    expect(ler("src/lib/envio-automatico-aos-parceiros-na-base.ts")).toMatch(/foraDaZona: \(await foraDaZonaDoPedido\(pedido\)\) != null/);
  });

  it("não vai aos parceiros por nenhuma das portas (Mesa, redistribuir, oferecer, voltar a oferecer, atribuir, alcance, editar)", () => {
    const enviar = ler("src/lib/enviar-aos-profissionais.ts");
    const i = enviar.indexOf("if (pedidoArrumado(pedido.status))");
    const j = enviar.indexOf("foraDaZonaDoPedido(pedido)");
    const k = enviar.indexOf("await assumirPedidoSeLivre(pedidoId, colab)");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(k).toBeGreaterThan(j);
    expect(ler("src/app/api/admin/negociacoes/redistribuir/route.ts")).toMatch(/recusaSeForaDaZona\(pedido\)/);
    const tc = ler("src/app/api/admin/trabalhos-clyon/route.ts");
    expect(tc.match(/recusaSeForaDaZona\(/g)?.length).toBe(3);
    expect(tc.indexOf("recusaSeForaDaZona(pedidoId)")).toBeLessThan(tc.indexOf("voltarAOferecerTrabalhoClyon(pedidoId, alvo)"));
    expect(ler("src/lib/correr-o-alcance.ts")).toMatch(/if \(await foraDaZonaDoPedido\(pedido\)\) continue;/);
    expect(ler("src/app/api/admin/pedidos/[id]/editar/route.ts")).toMatch(/recomeco = foraDepois \? null : await recomecarDoZero\(/);
  });

  it("as mensagens automáticas da Vitória sobre o pedido ficam paradas", () => {
    for (const f of [
      "src/lib/lembrete-do-que-falta-na-base.ts",
      "src/lib/recebemos-o-pedido-na-base.ts",
      "src/lib/seguimento-do-cliente-na-base.ts",
      "src/lib/envio-das-propostas-ao-cliente-na-base.ts",
      "src/lib/sem-propostas-ao-cliente-na-base.ts",
      "src/lib/validade-do-orcamento-na-base.ts",
      "src/lib/escolhidos-sem-resposta-no-servidor.ts",
    ]) {
      expect(ler(f), f).toMatch(/idsForaDaZona\(/);
    }
    // O passo do «Pedir o que falta» salta por cima do marcado (e retoma depois).
    expect(ler("src/lib/lembrete-do-que-falta-na-base.ts")).toMatch(/if \(foraDaZona\.has\(c\.pedidoId\)\) continue;\n\s*const passo = proximoPassoDoQueFalta/);
  });

  it("se o cliente perguntar, a Vitória diz com delicadeza que a equipa está a confirmar a morada", () => {
    const t = respostaDaVitoriaForaDaZona(712);
    expect(t).toMatch(/#712/);
    expect(t).toMatch(/a confirmar a morada/);
    expect(t).toMatch(/parceiros/);
    expect(t).not.toMatch(/profissional/);
    const neg = ler("src/lib/whatsapp-negociacao.ts");
    const ecra = neg.slice(neg.indexOf("export async function ecraDoPedido("));
    expect(ecra.indexOf("respostaDaVitoriaForaDaZona(pedidoId)")).toBeGreaterThan(-1);
    expect(ecra.indexOf("respostaDaVitoriaForaDaZona(pedidoId)")).toBeLessThan(ecra.indexOf("ainda à espera de propostas"));
  });

  it("conta para o selo da Mesa e chega aos três cartões", () => {
    expect(ler("src/lib/db.ts")).toMatch(/todosOsForaDaZona\(\)\)\.size;\n\s*if \(fora > 0\) saida\.negociacoes_clyon/);
    expect(ler("src/app/api/admin/negociacoes/route.ts")).toMatch(/foraDaZona: foraDaZona\.get\(Number\(p\.id\)\) \?\? null/);
    expect(ler("src/app/api/admin/negociacoes/promover/route.ts")).toMatch(/foraDaZona: foraDaZona\.get\(Number\(p\.id\)\) \?\? null/);
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toMatch(/foraDaZona: foraDaZona\.get\(Number\(o\.pedidoId\)\) \?\? null/);
    const mesa = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(mesa.match(/<ForaDaZonaNoCartao/g)?.length).toBe(2);
    expect(mesa).toMatch(/p\.foraDaZona\s*\?\s*BORDA_FORA_DA_ZONA/);
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toMatch(/<ForaDaZonaNoCartao/);
    const cartao = ler("src/components/admin/ForaDaZonaNoCartao.tsx");
    expect(cartao).toMatch(/⚠/);
    expect(cartao).toMatch(/Morada certa, corrigida/);
    expect(cartao).toMatch(/Cancelar e avisar o cliente/);
    expect(cartao).toMatch(/Isto cancela o pedido e envia a mensagem ao cliente\./);
    expect(cartao).not.toMatch(/\[#[0-9A-Fa-f]{3,8}\]/);
  });

  it("o pedido grava a distância à base ao nascer", () => {
    const db = ler("src/lib/db.ts");
    const criar = db.slice(db.indexOf("export async function createSimulatorOrder("));
    expect(criar.indexOf("kmDaBase: km")).toBeGreaterThan(-1);
    expect(criar.indexOf("kmDaBase: km")).toBeLessThan(criar.indexOf("INSERT INTO simulatorOrders"));
  });
});

/* ── A mensagem e o canal ────────────────────────────────────────────────── */

describe("d128 — a mensagem ao cliente", () => {
  it("curta, simpática, com o primeiro nome, o número, a localidade e «parceiros»", () => {
    const t = mensagemDoForaDaZona({ nome: "Maria Silva", pedidoId: 712, localidade: "Porto", limite: 200 });
    expect(t).toMatch(/^Olá, Maria! Confirmámos a morada do seu pedido #712 \(Porto\)\./);
    expect(t).toMatch(/cerca de 200 km de Lisboa/);
    expect(t).toMatch(/parceiros na sua zona/);
    expect(t).toMatch(/cancelámos o pedido/);
    expect(t).not.toMatch(/Silva/);
    expect(t).not.toMatch(/profissional/);
    expect(mensagemDoForaDaZona({ nome: "", pedidoId: 9 })).toMatch(/^Olá! Confirmámos a morada do seu pedido #9\. /);
  });

  it("WhatsApp; sem telemóvel (ou bloqueado), o email; sem nenhum, nada", () => {
    expect(canalDaMensagemForaDaZona({ telefone: "912 345 678", email: "a@b.pt" })).toBe("whatsapp");
    expect(canalDaMensagemForaDaZona({ telefone: "", email: "a@b.pt" })).toBe("email");
    expect(canalDaMensagemForaDaZona({ telefone: "912345678", email: "a@b.pt", bloqueado: true })).toBe("email");
    expect(canalDaMensagemForaDaZona({ telefone: null, email: "sem email" })).toBeNull();
  });

  it("o histórico diz o motivo e quem carregou", () => {
    const l = historicoDoCancelamentoForaDaZona({ km: 312.4, quem: "Ana", canal: "whatsapp", saiu: true });
    expect(l).toMatch(/Cancelado pela CLYON \(Ana\)/);
    expect(l).toMatch(/fora da zona \(312 km de Lisboa/);
    expect(l).toMatch(/WhatsApp/);
  });
});

/* ── O botão b), pela rota, com uma base a fingir ────────────────────────── */

const m = vi.hoisted(() => ({
  pedido: null as null | Record<string, unknown>,
  negociacoes: [] as Array<Record<string, unknown>>,
  fora: { km: 312, limite: 200, de: "morada" } as null | { km: number; limite: number; de: string },
  cancelar: vi.fn(async () => ({ encerradas: 0 })),
  whatsapp: vi.fn(async () => true),
  email: vi.fn(async () => true),
  historico: vi.fn(async () => {}),
  motivo: vi.fn(async () => {}),
  avisarPros: vi.fn(async () => {}),
}));

vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdmin: vi.fn(async () => ({ err: null, colab: { id: 7, nome: "Ana", papel: "admin" } })),
}));
vi.mock("@/lib/db", () => ({
  getSimulatorOrderById: vi.fn(async () => m.pedido),
  negociacoesDoPedido: vi.fn(async () => m.negociacoes),
  cancelarPedido: m.cancelar,
  appendOrderHistory: m.historico,
  gravarMotivoDoFecho: m.motivo,
  numeroBloqueadoWhatsApp: vi.fn(async () => false),
  registarSemFalhar: vi.fn(async () => {}),
}));
vi.mock("@/lib/fora-da-zona-na-base", () => ({ foraDaZonaDoPedido: vi.fn(async () => m.fora) }));
vi.mock("@/lib/avisar-cancelamento", () => ({ avisarDoCancelamento: m.avisarPros }));
vi.mock("@/lib/whatsapp-cloud", () => ({ enviarTextoManualWhatsApp: m.whatsapp }));
vi.mock("@/lib/email-proposta", () => ({ avisarClienteForaDaZona: m.email }));

async function carregar(corpo: unknown = { accao: "cancelar_e_avisar" }) {
  const { POST } = await import("@/app/api/admin/pedidos/[id]/fora-da-zona/route");
  const req = new NextRequest("http://localhost/api/admin/pedidos/712/fora-da-zona", {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: { "Content-Type": "application/json" },
  });
  return POST(req, { params: Promise.resolve({ id: "712" }) });
}

describe("d128 — «Cancelar e avisar o cliente»", () => {
  beforeEach(() => {
    m.pedido = { id: 712, status: "sem_assistente", contactName: "Maria Silva", contactPhone: "912345678", contactEmail: "m@exemplo.pt", city: "Porto" };
    m.negociacoes = [];
    m.fora = { km: 312, limite: 200, de: "morada" };
    for (const f of [m.cancelar, m.whatsapp, m.email, m.historico, m.motivo, m.avisarPros]) f.mockClear();
  });

  it("cancela pelo caminho de sempre e envia UMA mensagem (WhatsApp), com o motivo no histórico", async () => {
    const r = await carregar();
    expect(r.status).toBe(200);
    expect(m.cancelar).toHaveBeenCalledTimes(1);
    expect(m.cancelar).toHaveBeenCalledWith(712, { motivo: "Fora da zona (312 km de Lisboa)" });
    expect(m.whatsapp).toHaveBeenCalledTimes(1);
    expect(m.email).not.toHaveBeenCalled();
    const [para, texto] = m.whatsapp.mock.calls[0] as unknown as [string, string];
    expect(para).toBe("912345678");
    expect(texto).toMatch(/^Olá, Maria! Confirmámos a morada do seu pedido #712 \(Porto\)/);
    // O aviso genérico ao cliente não sai — só esta mensagem.
    expect(m.avisarPros).toHaveBeenCalledWith(expect.objectContaining({ semAvisoAoCliente: true }));
    expect(m.motivo).toHaveBeenCalledWith(712, "sem_parceiro", null, expect.objectContaining({ nome: "Ana" }));
    const linhas = m.historico.mock.calls.map((c) => (c as unknown as [number, { message: string }])[1].message);
    expect(linhas.some((l) => /fora da zona/.test(l) && /Ana/.test(l))).toBe(true);
  });

  it("sem telemóvel, vai por email", async () => {
    m.pedido = { ...m.pedido!, contactPhone: "" };
    await carregar();
    expect(m.whatsapp).not.toHaveBeenCalled();
    expect(m.email).toHaveBeenCalledTimes(1);
  });

  it("recusa o que já não está fora da zona, o já cancelado e o que tem parceiro contratado", async () => {
    m.fora = null;
    expect((await carregar()).status).toBe(409);
    m.fora = { km: 312, limite: 200, de: "morada" };
    m.pedido = { ...m.pedido!, status: "cancelado" };
    expect((await carregar()).status).toBe(409);
    m.pedido = { ...m.pedido!, status: "sem_assistente" };
    m.negociacoes = [{ id: 1, estado: "acordada", providerId: 3, profissionalNome: "X", valorAcordado: 100 }];
    expect((await carregar()).status).toBe(409);
    expect(m.cancelar).not.toHaveBeenCalled();
    expect(m.whatsapp).not.toHaveBeenCalled();
  });
});
