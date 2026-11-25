import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d119 — O QUE A VITÓRIA JÁ MANDOU AO CLIENTE PASSA SOZINHO A «A AGUARDAR
 * CLIENTE» (25-11-2026). Pedidos, nomes e números inventados.
 */

import { historicoDoEnvioAutomatico, NOTA_DO_ENVIO_PELA_VITORIA } from "./envio-das-propostas-ao-cliente";
import { pedidosJaDitosPelaVitoria } from "./envio-das-propostas-ao-cliente-na-base";
import { propostasPorVer, temOSeloDasPropostas } from "./seguimento-das-propostas";
import { linhaDaMesa, respostaEConnosco } from "./validade-do-orcamento";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const AGORA = new Date("2026-11-25T15:00:00Z");
const antes = (min: number) => new Date(AGORA.getTime() - min * 60_000);
const naBase = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

const negociacao = (id: number, nome: string, criadaEm: Date) => ({
  id,
  providerId: 600 + id,
  profissionalNome: nome,
  profissionalEmail: null,
  estado: "aberta",
  valorAcordado: null,
  propostasJson: JSON.stringify([{ por: "profissional", valor: 80, estado: "pendente", criadaEm: criadaEm.toISOString() }]),
  execucaoEnviadaEm: null,
  provaJson: null,
  confirmadoEm: null,
  pagoEm: null,
  estrelas: null,
  avaliadoEm: null,
  criadaEm: naBase(antes(300)),
  actualizadaEm: naBase(criadaEm),
});
const pedido = (o: Record<string, unknown> = {}) =>
  ({
    id: 9119,
    serviceType: "recolha_monos",
    city: "Almada",
    contactName: "Cliente Exemplo",
    contactEmail: null,
    contactPhone: "912345678",
    origem: "backoffice",
    status: "sem_assistente",
    propostaEnviadaEm: null,
    valorUnicoCliente: null,
    negociacoes: [negociacao(1, "Recolhas Inventadas", antes(120))],
    ...o,
  }) as never;

describe("o envio automático grava-se como o «Já enviei»", () => {
  it("a nota no histórico", () => {
    expect(NOTA_DO_ENVIO_PELA_VITORIA).toBe("Orçamento enviado ao cliente pela Vitória (WhatsApp)");
    expect(historicoDoEnvioAutomatico(2)).toBe("Orçamento enviado ao cliente pela Vitória (WhatsApp) — 2 propostas, mensagem curta (d114).");
  });

  it("a rotina, a conversa livre e a lista da d111 marcam pela mesma função do «Já enviei»", () => {
    const BASE = ler("src/lib/envio-das-propostas-ao-cliente-na-base.ts");
    const marcar = BASE.slice(BASE.indexOf("async function marcarEnviadoPelaVitoria("));
    expect(marcar).toContain("await db.marcarOrcamentoEnviado(pedidoId);");
    expect(marcar).toContain("NOTA_DO_ENVIO_PELA_VITORIA");
    // A conversa livre e a lista (d111) passam por marcarAsPropostasNomeadas.
    const nomeadas = BASE.slice(BASE.indexOf("export async function marcarAsPropostasNomeadas("));
    expect(nomeadas.slice(0, 1500)).toContain("await marcarEnviadoPelaVitoriaSeEsperava(pedidoId, agora);");
    // Só se o pedido estava à espera de nós: o que já tinha ido não se marca outra vez.
    expect(BASE).toContain("if (!propostasPorEnviarDoPedido(comoNaMesa, agora)) return false;");
    // A rotina d88/d114 já o fazia.
    const envio = BASE.slice(BASE.indexOf("export async function enviarAsPropostasAoCliente("));
    expect(envio).toContain("await db.marcarOrcamentoEnviado(pedidoId);");
    // O «Já enviei» continua no painel para os outros canais.
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("Já enviei");
  });
});

describe("o selo «ainda não as viu» fica só para as que não saíram", () => {
  it("a proposta que já foi ao cliente pelo WhatsApp conta como enviada", () => {
    const p = { status: "sem_assistente", negociacoes: [{ estado: "aberta", propostasJson: JSON.stringify([{ por: "profissional", estado: "pendente", criadaEm: antes(180).toISOString() }]), vistoPeloClienteEm: null }] };
    expect(temOSeloDasPropostas(p, AGORA)).toBe(true);
    expect(temOSeloDasPropostas({ ...p, propostaEnviadaEm: naBase(antes(120)) }, AGORA)).toBe(false);
    // Uma que chegou depois do envio continua por ver.
    expect(propostasPorVer({ ...p, propostaEnviadaEm: naBase(antes(240)) })).toHaveLength(1);
  });
});

describe("«é connosco» só quando ela passou à equipa ou o cliente está sem resposta", () => {
  it("a Vitória respondeu depois do cliente: não é connosco", () => {
    expect(respostaEConnosco({ ultimaDoClienteEm: antes(60), ultimaDaVitoriaEm: antes(55) })).toBe(false);
    expect(respostaEConnosco({ ultimaDoClienteEm: antes(60), ultimaDaVitoriaEm: antes(90) })).toBe(true);
    expect(respostaEConnosco({ ultimaDoClienteEm: antes(60), ultimaDaVitoriaEm: null })).toBe(true);
    // Passou à equipa depois do cliente: é connosco, mesmo com a Vitória a ter respondido.
    expect(respostaEConnosco({ ultimaDoClienteEm: antes(60), ultimaDaVitoriaEm: antes(55), passadaEm: antes(55) })).toBe(true);
  });

  it("a linha da Mesa diz que a Vitória respondeu, sem o «é connosco»", () => {
    const c = { desde: new Date("2026-11-23T10:00:00Z"), lembrete1Em: null, ultimoAvisoEm: null, fechadoEm: null, paradoEm: new Date("2026-11-25T10:00:00Z") };
    expect(linhaDaMesa({ ...c, vitoriaRespondeu: true }, true)).toBe("orçamento enviado 23/11 · o cliente respondeu a 25/11 e a Vitória já lhe respondeu — contagem parada");
    expect(linhaDaMesa(c, true)).toContain("é connosco");
    const BASE = ler("src/lib/validade-do-orcamento-na-base.ts");
    expect(BASE).toContain("parado: Boolean(vista.paradoEm) && connosco,");
  });
});

describe("a passagem única: os pedidos de hoje com as propostas já ditas pela Vitória", () => {
  const fio = (texto: string, haMin: number, direccao = "out") => ({ direccao, texto, haSegundos: haMin * 60 });

  it("só os que têm uma mensagem dela, depois da proposta, a nomear o parceiro", () => {
    const pedidos = [pedido(), pedido({ id: 9120, contactPhone: "912345679" }), pedido({ id: 9121, contactPhone: "912345670" }), pedido({ id: 9122, contactPhone: "912345671" })];
    const fios: Record<string, ReturnType<typeof fio>[]> = {
      "912345678": [fio("Já tem a primeira proposta: 98,40 € (80 € + IVA), do parceiro Recolhas Inventadas.", 60)],
      // Antes da proposta: não conta.
      "912345679": [fio("A Recolhas Inventadas é um parceiro da zona.", 200)],
      // Sem nomear o parceiro: não conta.
      "912345670": [fio("Obrigada! Já anotei.", 30)],
      // À mão, da equipa: o «Já enviei» é dela.
      "912345671": [fio("[à mão] A proposta da Recolhas Inventadas é 98,40 €", 30)],
    };
    expect(pedidosJaDitosPelaVitoria(pedidos, (t) => fios[t] ?? [], AGORA)).toEqual([9119]);
  });

  it("já enviado (a aguardar cliente), não se toca", () => {
    expect(pedidosJaDitosPelaVitoria([pedido({ propostaEnviadaEm: naBase(antes(10)) })], () => [fio("do parceiro Recolhas Inventadas", 5)], AGORA)).toEqual([]);
  });

  it("corre uma vez, pelo cron das propostas, e escreve no registo quantos foram", () => {
    expect(ler("src/app/api/cron/propostas-ao-cliente/route.ts")).toContain("await passagemUnicaDosEnviados(new Date())");
    const BASE = ler("src/lib/envio-das-propostas-ao-cliente-na-base.ts");
    const f = BASE.slice(BASE.indexOf("export async function passagemUnicaDosEnviados("));
    expect(f.indexOf("INSERT IGNORE INTO retencaoInterruptores")).toBeLessThan(f.indexOf("pedidosJaDitosPelaVitoria("));
    expect(f).toContain("registarSemFalhar(");
    expect(f).not.toMatch(/DELETE FROM/);
  });
});
