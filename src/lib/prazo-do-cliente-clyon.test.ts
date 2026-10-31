import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * QUEM ACEITA UM TRABALHO CLYON TEM RESPOSTA EM 72 HORAS — 28-10-2026 (d12).
 *
 * 72 horas depois de o preço ir ao cliente sem resposta, e sem a CLYON ter
 * escolhido ninguém, o pedido vai para os Arquivados e quem aceitou é
 * avisado. Os que já esperavam há mais de 5 dias quando a regra entrou ficam
 * para a equipa decidir.
 */

vi.mock("@/lib/db", () => ({
  trabalhosClyonComOPrecoNoCliente: vi.fn(async () => []),
  negociacoesDoPedido: vi.fn(async () => []),
  quemTemOTrabalhoClyon: vi.fn(async () => ({ eClyon: true, jaFeito: false, vivos: [] })),
  updateSimulatorOrder: vi.fn(async () => {}),
  perfilDoProfissional: vi.fn(async (id: number) => ({ email: `pro${id}@exemplo.pt` })),
  appendOrderHistory: vi.fn(async () => {}),
  registarSemFalhar: vi.fn(async () => {}),
}));
vi.mock("@/lib/avisar-por-push", () => ({ avisarProfissionalSemOTrabalhoPorPush: vi.fn(async () => {}) }));
vi.mock("@/lib/avisar-trabalho-clyon", () => ({ avisarSemEfeitoDoTrabalhoClyon: vi.fn(async () => 0) }));

import * as db from "@/lib/db";
import { avisarProfissionalSemOTrabalhoPorPush } from "@/lib/avisar-por-push";
import { avisarSemEfeitoDoTrabalhoClyon } from "@/lib/avisar-trabalho-clyon";
import {
  HORAS_PARA_O_CLIENTE_RESPONDER,
  PRAZO_DO_CLIENTE_DESDE,
  SE_O_CLIENTE_NAO_RESPONDER,
  TRABALHO_SEM_EFEITO,
  O_CLIENTE_RESPONDEU,
  clienteRespondeu,
  ficaSemEfeito,
  vaiAoPorDecidir,
} from "./prazo-do-cliente-clyon";
import { arquivarTrabalhosClyonSemResposta } from "./arquivar-sem-resposta";
import { avisoSemOTrabalho } from "./textos-dos-avisos-ao-profissional";
import { avisoDeSemEfeitoAoProfissional } from "./aviso-de-oferta-clyon";

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

const AGORA = new Date("2026-11-02T12:00:00Z");
const HORA = 3_600_000;
const aceitou = { estado: "aguarda_contratacao" };
const trabalho = (extra: Record<string, unknown> = {}) => ({
  valorFixoClyon: 300,
  estadoDoPedido: "sem_assistente",
  propostaEnviadaEm: new Date(AGORA.getTime() - 73 * HORA),
  negociacoes: [aceitou, { estado: "aberta" }],
  ...extra,
});

beforeEach(() => vi.clearAllMocks());

describe("as frases", () => {
  it("são as da decisão, e o prazo é de 72 horas", () => {
    expect(HORAS_PARA_O_CLIENTE_RESPONDER).toBe(72);
    expect(SE_O_CLIENTE_NAO_RESPONDER).toBe("Se o cliente não responder em 3 dias, avisamo-lo.");
    expect(TRABALHO_SEM_EFEITO).toBe(
      "O cliente não respondeu — este trabalho ficou sem efeito. Obrigado por ter aceitado.",
    );
  });

  it("o aviso no telemóvel e o WhatsApp levam a frase, sem preços", () => {
    const push = avisoSemOTrabalho({ pedidoId: 501, porque: "sem_resposta" });
    expect(push).toEqual({ title: "Trabalho CLYON #501", body: TRABALHO_SEM_EFEITO });
    const wa = avisoDeSemEfeitoAoProfissional("Rui Teste", { pedidoId: 501, servico: "recolha_moveis", localidade: "Almada" }, AGORA);
    expect(wa).toContain(TRABALHO_SEM_EFEITO);
    expect(wa).toContain("#501");
    expect(wa).not.toContain("€");
  });

  it("o email da oferta a vários, e o painel, dizem o prazo", () => {
    const EMAIL = ler("src/lib/email-profissional.ts");
    expect(EMAIL.match(/p\.modoDaOferta === "distribuida"/g)?.length).toBe(2);
    expect(EMAIL).toContain("SE_O_CLIENTE_NAO_RESPONDER");
    expect(ler("src/lib/distribuir-pedido.ts")).toContain("modoDaOferta: oferta?.modo ?? null,");
    expect(ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx")).toContain(
      "a CLYON escolhe e avisa-o. ${SE_O_CLIENTE_NAO_RESPONDER}",
    );
  });
});

describe("a regra (ficaSemEfeito)", () => {
  it("72 horas com o preço no cliente, ninguém escolhido e quem tenha aceitado: sim", () => {
    expect(ficaSemEfeito(trabalho(), AGORA)).toBe(true);
  });

  it("antes das 72 horas, não", () => {
    expect(ficaSemEfeito(trabalho({ propostaEnviadaEm: new Date(AGORA.getTime() - 71 * HORA) }), AGORA)).toBe(false);
  });

  it("com o profissional já escolhido pela CLYON, não lhe toca", () => {
    expect(ficaSemEfeito(trabalho({ negociacoes: [{ estado: "acordada" }, aceitou] }), AGORA)).toBe(false);
  });

  it("sem ninguém que tenha aceitado, não lhe toca", () => {
    expect(ficaSemEfeito(trabalho({ negociacoes: [{ estado: "aberta" }, { estado: "desistida" }] }), AGORA)).toBe(false);
  });

  it("os que esperavam há mais de 5 dias quando a regra entrou ficam para a equipa", () => {
    // Preços enviados a 21/10 — a 28/10 esperavam há 7 dias.
    expect(PRAZO_DO_CLIENTE_DESDE.toISOString()).toBe("2026-10-23T23:00:00.000Z");
    expect(ficaSemEfeito(trabalho({ propostaEnviadaEm: new Date("2026-10-21T10:00:00Z") }), AGORA)).toBe(false);
    expect(ficaSemEfeito(trabalho({ propostaEnviadaEm: new Date("2026-10-26T10:00:00Z") }), AGORA)).toBe(true);
  });

  it("nem arquivados, cancelados ou concluídos, nem pedidos que não são Trabalhos CLYON, nem sem preço enviado", () => {
    for (const estadoDoPedido of ["arquivado", "cancelado", "concluido"]) {
      expect(ficaSemEfeito(trabalho({ estadoDoPedido }), AGORA), estadoDoPedido).toBe(false);
    }
    expect(ficaSemEfeito(trabalho({ valorFixoClyon: null }), AGORA)).toBe(false);
    expect(ficaSemEfeito(trabalho({ propostaEnviadaEm: null }), AGORA)).toBe(false);
  });
});

describe("a rotina arquiva e avisa", () => {
  it("só o que fica sem efeito; avisa quem aceitou, no telemóvel e no WhatsApp", async () => {
    vi.mocked(db.trabalhosClyonComOPrecoNoCliente).mockResolvedValue([
      { id: 510, valorFixoClyon: 300, status: "sem_assistente", propostaEnviadaEm: new Date(AGORA.getTime() - 80 * HORA), serviceType: "recolha_moveis", city: "Almada" },
      { id: 511, valorFixoClyon: 300, status: "sem_assistente", propostaEnviadaEm: new Date(AGORA.getTime() - 80 * HORA), serviceType: "recolha_moveis", city: "Seixal" },
      { id: 436, valorFixoClyon: 300, status: "sem_assistente", propostaEnviadaEm: new Date("2026-10-21T10:00:00Z"), serviceType: "recolha_moveis", city: "Lisboa" },
    ]);
    vi.mocked(db.negociacoesDoPedido).mockImplementation((async (id: number) =>
      id === 511
        ? [{ id: 9, providerId: 90, estado: "acordada" }]
        : [
            { id: 1, providerId: 10, estado: "aguarda_contratacao" },
            { id: 2, providerId: 20, estado: "aguarda_contratacao" },
            { id: 3, providerId: 30, estado: "aberta" },
          ]) as never);
    vi.mocked(db.quemTemOTrabalhoClyon).mockResolvedValue({
      eClyon: true,
      jaFeito: false,
      vivos: [
        { negociacaoId: 1, providerId: 10, profissional: "A", telefone: "912345678", eraDele: false, avisaPorWhatsApp: true },
        { negociacaoId: 3, providerId: 30, profissional: "C", telefone: "912345678", eraDele: false, avisaPorWhatsApp: true },
      ],
    });

    const r = await arquivarTrabalhosClyonSemResposta(AGORA);

    expect(r.arquivados).toEqual([510]);
    expect(db.updateSimulatorOrder).toHaveBeenCalledTimes(1);
    expect(db.updateSimulatorOrder).toHaveBeenCalledWith(510, { status: "arquivado" });
    // Os dois que aceitaram, e não o que só a tinha recebido.
    expect(vi.mocked(avisarProfissionalSemOTrabalhoPorPush).mock.calls.map((c) => c[0].negociacaoId)).toEqual([1, 2]);
    expect(vi.mocked(avisarProfissionalSemOTrabalhoPorPush).mock.calls[0][0].porque).toBe("sem_resposta");
    expect(vi.mocked(avisarSemEfeitoDoTrabalhoClyon).mock.calls[0][0].quem.map((q) => q.negociacaoId)).toEqual([1]);
    expect(db.appendOrderHistory).toHaveBeenCalledWith(510, expect.objectContaining({ type: "archived" }));
    expect(r.avisados).toBe(2);
  });

  it("um pedido que rebenta não pára os outros", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(db.trabalhosClyonComOPrecoNoCliente).mockResolvedValue([
      { id: 1, valorFixoClyon: 300, status: null, propostaEnviadaEm: new Date(AGORA.getTime() - 80 * HORA), serviceType: null, city: null },
      { id: 2, valorFixoClyon: 300, status: null, propostaEnviadaEm: new Date(AGORA.getTime() - 80 * HORA), serviceType: null, city: null },
    ]);
    vi.mocked(db.negociacoesDoPedido)
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce([{ id: 5, providerId: 50, estado: "aguarda_contratacao" }] as never);
    const r = await arquivarTrabalhosClyonSemResposta(AGORA);
    expect(r).toMatchObject({ arquivados: [2], falhados: 1 });
  });
});

describe("a rotina na Vercel", () => {
  it("fecha sem o segredo, carimba a passagem e corre de hora a hora", () => {
    const R = ler("src/app/api/cron/trabalhos-clyon-sem-resposta/route.ts");
    expect(R).toContain("if (!secret)");
    expect(R).toContain('bearerConfere(req.headers.get("authorization"), secret)');
    expect(R).toMatch(/carimbarPassagem\(\s*"trabalhos-clyon-sem-resposta"/);
    const V = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as { crons: Array<{ path: string; schedule: string }> };
    expect(V.crons).toContainEqual({ path: "/api/cron/trabalhos-clyon-sem-resposta", schedule: "50 * * * *" });
  });
});

/*
 * QUEM DISSE QUE SIM NÃO SE ARQUIVA — 31-10-2026 (d2). A d12 foi escrita antes
 * do «Aceito este preço»; numa sonda, um aceite às 70 h era arquivado às 72 h.
 */
describe("o cliente respondeu (d2)", () => {
  const PRECO = new Date(AGORA.getTime() - 73 * HORA);
  const aposHoras = (h: number) => new Date(PRECO.getTime() + h * HORA);
  const linha = (id: number, extra: Record<string, unknown> = {}) => ({
    id,
    valorFixoClyon: 300,
    status: "sem_assistente",
    propostaEnviadaEm: PRECO,
    serviceType: "recolha_moveis",
    city: "Almada",
    ...extra,
  });
  const comQuemAceitou = () =>
    vi.mocked(db.negociacoesDoPedido).mockResolvedValue([{ id: 1, providerId: 10, estado: "aguarda_contratacao" }] as never);

  it("o selo é o da decisão", () => {
    expect(O_CLIENTE_RESPONDEU).toBe("O cliente respondeu — escolher parceiro");
  });

  it("aceite às 70 horas: às 73 não fica sem efeito, a rotina não o arquiva nem avisa ninguém, e vai ao «Por decidir»", async () => {
    const t = trabalho({ propostaEnviadaEm: PRECO, precoAceiteEm: aposHoras(70) });
    expect(ficaSemEfeito(t, AGORA)).toBe(false);
    expect(vaiAoPorDecidir(t)).toBe(true);

    vi.mocked(db.trabalhosClyonComOPrecoNoCliente).mockResolvedValue([linha(521, { precoAceiteEm: aposHoras(70) })]);
    comQuemAceitou();
    const r = await arquivarTrabalhosClyonSemResposta(AGORA);
    expect(r.arquivados).toEqual([]);
    expect(r.clienteRespondeu).toEqual([521]);
    expect(db.updateSimulatorOrder).not.toHaveBeenCalled();
    expect(avisarProfissionalSemOTrabalhoPorPush).not.toHaveBeenCalled();
    expect(avisarSemEfeitoDoTrabalhoClyon).not.toHaveBeenCalled();
  });

  it("resposta no WhatsApp às 71 horas (ou a conversa passada a uma pessoa): não se arquiva; uma mensagem de antes do preço não conta", async () => {
    expect(clienteRespondeu(trabalho({ propostaEnviadaEm: PRECO, ultimaMensagemDoClienteEm: aposHoras(71) }))).toBe(true);
    expect(clienteRespondeu(trabalho({ propostaEnviadaEm: PRECO, passadaAUmaPessoaEm: aposHoras(71) }))).toBe(true);
    expect(clienteRespondeu(trabalho({ propostaEnviadaEm: PRECO, ultimaMensagemDoClienteEm: aposHoras(-2) }))).toBe(false);
    expect(ficaSemEfeito(trabalho({ propostaEnviadaEm: PRECO, ultimaMensagemDoClienteEm: aposHoras(-2) }), AGORA)).toBe(true);

    vi.mocked(db.trabalhosClyonComOPrecoNoCliente).mockResolvedValue([
      linha(513, { ultimaMensagemDoClienteEm: aposHoras(71) }),
      linha(514, { passadaAUmaPessoaEm: aposHoras(71) }),
      linha(515, { ultimaMensagemDoClienteEm: aposHoras(-2) }),
    ]);
    comQuemAceitou();
    const r = await arquivarTrabalhosClyonSemResposta(AGORA);
    expect(r.clienteRespondeu).toEqual([513, 514]);
    expect(r.arquivados).toEqual([515]);
    expect(db.updateSimulatorOrder).toHaveBeenCalledTimes(1);
    expect(db.updateSimulatorOrder).toHaveBeenCalledWith(515, { status: "arquivado" });
  });

  it("restaurado depois de a rotina o arquivar: não leva um segundo «sem efeito» aos mesmos profissionais", async () => {
    expect(ficaSemEfeito(trabalho({ propostaEnviadaEm: PRECO, semEfeitoAvisadoEm: aposHoras(72) }), AGORA)).toBe(false);

    vi.mocked(db.trabalhosClyonComOPrecoNoCliente).mockResolvedValue([linha(501, { semEfeitoAvisadoEm: aposHoras(72) })]);
    comQuemAceitou();
    const r = await arquivarTrabalhosClyonSemResposta(new Date(AGORA.getTime() + 72 * HORA));
    expect(r.arquivados).toEqual([]);
    expect(db.updateSimulatorOrder).not.toHaveBeenCalled();
    expect(avisarProfissionalSemOTrabalhoPorPush).not.toHaveBeenCalled();
    expect(avisarSemEfeitoDoTrabalhoClyon).not.toHaveBeenCalled();
  });

  it("com o parceiro já escolhido, ou fora da mesa, não vai ao «Por decidir»", () => {
    const aceite = { propostaEnviadaEm: PRECO, precoAceiteEm: aposHoras(10) };
    expect(vaiAoPorDecidir(trabalho({ ...aceite, negociacoes: [{ estado: "acordada" }] }))).toBe(false);
    expect(vaiAoPorDecidir(trabalho({ ...aceite, estadoDoPedido: "arquivado" }))).toBe(false);
    expect(vaiAoPorDecidir(trabalho({ ...aceite, valorFixoClyon: null }))).toBe(false);
    expect(vaiAoPorDecidir(trabalho({ propostaEnviadaEm: PRECO }))).toBe(false);
  });

  it("a base lê as respostas e os já avisados; a Mesa põe-nos no «Por decidir» com o selo", () => {
    const DB = ler("src/lib/db.ts");
    expect(DB).toContain("respostasDoClienteNoWhatsApp(linhas.map(");
    expect(DB).toContain("semEfeitoJaAvisado(ids)");
    expect(DB).toMatch(/FROM whatsappMensagens\s+WHERE direccao = 'in'/);
    expect(DB).toMatch(/FROM registoPermanente\s+WHERE acontecimento = 'negociacao_encerrada' AND autorNome = 'prazo do cliente'/);
    expect(ler("src/lib/arquivar-sem-resposta.ts")).toContain('autorNome: "prazo do cliente"');
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain("clienteRespondeu: vaiAoPorDecidir({");
    const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(MESA).toMatch(/b && t\.clienteRespondeu\s*\?\s*mostrar !== "clyon"\s*\?\s*"porEnviar"/);
    expect(MESA).toContain("{O_CLIENTE_RESPONDEU}");
    expect(MESA).toContain('porPromoverNaMesa.length + voltamAoPorDecidir.length + clyonDoBloco("porEnviar").length');
  });
});
