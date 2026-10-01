import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deveLembrar,
  diaEmLisboa,
  horaDoTrabalho,
  lembreteDoTrabalhoDeHoje,
} from "./lembrete-do-trabalho-de-hoje";

/**
 * *«Essa função não está funcionando: os pros que activaram não recebem
 * nada. Eles deviam receber notificações de pedidos novos, com um resumo da
 * localidade, valor e descrição, e pedidos agendados — por exemplo: aviso
 * CLYON, você tem um trabalho agendado para hoje na Costa da Caparica para as
 * 10h00.»* — 29-09-2026.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("os avisos deixam de morrer à porta da conversa entregue", () => {
  const DB = semComentarios(ler("src/lib/db.ts"));
  const CLOUD = semComentarios(ler("src/lib/whatsapp-cloud.ts"));
  const CRON = semComentarios(ler("src/lib/assistente-automatico.ts"));

  /*
   * ⚠️ A CAUSA. A ponte entrega uma conversa a uma pessoa sempre que alguém
   * da CLYON escreve à mão a esse número — e a equipa fala com os
   * profissionais todos os dias. A porta do cérebro recusa conversas
   * entregues, e os avisos morriam todos lá, arquivados «não saiu».
   */
  it("a porta dos avisos não pergunta se a conversa foi entregue", () => {
    const i = DB.indexOf("export async function podeAvisarONumeroWhatsApp");
    const corpo = DB.slice(i, DB.indexOf("export async function profissionalDoTelefone", i));
    expect(corpo).toContain("whatsappLigado()");
    expect(corpo).toContain("numeroBloqueadoWhatsApp(telefone)");
    expect(corpo).not.toContain("numeroInterrompidoWhatsApp");
  });

  it("e a porta do cérebro continua igual — só os avisos têm porta própria", () => {
    const i = DB.indexOf("export async function podeOWhatsAppFalarCom");
    expect(DB.slice(i, i + 400)).toContain("numeroInterrompidoWhatsApp(telefone)");
  });

  it("o envio dos avisos usa essa porta, e não a do cérebro", () => {
    const i = CLOUD.indexOf("export async function enviarAvisoWhatsApp");
    // Até à função seguinte, e não um número de caracteres: a seguinte
    // (a dos botões) usa a porta do cérebro, e com razão.
    const corpo = CLOUD.slice(i, CLOUD.indexOf("export async function", i + 10));
    expect(corpo).toContain("podeAvisarONumeroWhatsApp(");
    expect(corpo).not.toContain("autorizadoAFalarCom(");
  });

  it("os dois envios da passagem — pedido novo e lembrete — são avisos", () => {
    expect(CRON).toContain("enviarAvisoWhatsApp(aviso.telefone, aviso.texto)");
    expect(CRON).toContain("enviarAvisoWhatsApp(telefone, texto)");
    expect(CRON).not.toContain("enviarTextoWhatsApp(aviso.telefone");
  });

  it("a vontade do profissional continua a ser vista antes de sair", () => {
    // Na fila dos pedidos novos e na consulta dos lembretes.
    expect(DB.match(/p\.whatsappAvisos = 1/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("o lembrete do trabalho de hoje", () => {
  // Terça, 29-09-2026, 07:30 em Lisboa.
  const AS_7_30 = new Date("2026-09-29T07:30:00+01:00");
  const AS_10_DE_HOJE = new Date("2026-09-29T10:00:00+01:00");

  it("o texto dele, tal e qual o pediu: onde, a que horas, o quê", () => {
    const t = lembreteDoTrabalhoDeHoje(
      {
        pedidoId: 384,
        profissional: "Pedro Revolution",
        servico: "recolha_moveis",
        localidade: "Costa da Caparica",
        morada: "Rua das Flores, 3",
        cliente: "Ana Ferreira",
        telefoneDoCliente: "916 251 788",
        quando: AS_10_DE_HOJE,
      },
      AS_7_30,
    );
    expect(t).toContain("Aqui é a CLYON — aviso de agenda.");
    expect(t).toContain("Tem um trabalho marcado para hoje em Costa da Caparica, às 10:00");
    expect(t).toContain("(#384)");
    expect(t).toContain("Cliente: Ana Ferreira");
    expect(t).toContain("Telefone: 916 251 788");
    expect(t).toContain("Morada: Rua das Flores, 3");
    expect(t).toContain("escreva parar");
  });

  it("sem hora marcada não inventa uma", () => {
    const meiaNoite = new Date("2026-09-29T00:00:00+01:00");
    expect(horaDoTrabalho(meiaNoite)).toBeNull();
    const t = lembreteDoTrabalhoDeHoje(
      {
        pedidoId: 1, profissional: null, servico: null, localidade: "Almada",
        morada: null, cliente: null, telefoneDoCliente: null, quando: meiaNoite,
      },
      AS_7_30,
    );
    expect(t).toContain("marcado para hoje em Almada:");
    expect(t).not.toContain("às 00:00");
  });

  it("lembra-se de manhã de um trabalho de hoje", () => {
    expect(deveLembrar({ dataCombinada: AS_10_DE_HOJE }, AS_7_30).lembrar).toBe(true);
  });

  it("vale a data combinada, e na falta dela a que o cliente pediu", () => {
    expect(deveLembrar({ dataAgendada: AS_10_DE_HOJE }, AS_7_30).lembrar).toBe(true);
  });

  it("não acorda ninguém antes das 7h", () => {
    const as6 = new Date("2026-09-29T06:30:00+01:00");
    expect(deveLembrar({ dataCombinada: AS_10_DE_HOJE }, as6).lembrar).toBe(false);
  });

  /*
   * Um trabalho das 8h lembrado às 10h já não é lembrar — é acusar.
   */
  it("não lembra um trabalho cuja hora já passou", () => {
    const as11 = new Date("2026-09-29T11:00:00+01:00");
    expect(deveLembrar({ dataCombinada: AS_10_DE_HOJE }, as11).lembrar).toBe(false);
  });

  it("não lembra o de amanhã nem o de ontem", () => {
    const amanha = new Date("2026-09-30T10:00:00+01:00");
    const ontem = new Date("2026-09-28T10:00:00+01:00");
    expect(deveLembrar({ dataCombinada: amanha }, AS_7_30).lembrar).toBe(false);
    expect(deveLembrar({ dataCombinada: ontem }, AS_7_30).lembrar).toBe(false);
  });

  it("o dia é o de Lisboa — às 00:30 de Lisboa ainda é ontem em UTC", () => {
    expect(diaEmLisboa(new Date("2026-09-29T00:30:00+01:00"))).toBe("2026-09-29");
  });

  it("reserva-se antes de enviar — dois crons cruzados não mandam dois", () => {
    const CRON = semComentarios(ler("src/lib/assistente-automatico.ts"));
    const i = CRON.indexOf("deveLembrar(t, agora)");
    const reserva = CRON.indexOf("db.reservarLembrete(", i);
    const envio = CRON.indexOf("enviarAvisoWhatsApp(telefone, texto)", i);
    expect(reserva).toBeGreaterThan(i);
    expect(reserva).toBeLessThan(envio);
    expect(ler("src/lib/db.ts")).toContain("UNIQUE KEY uq_negociacao_dia (negociacaoId, dia)");
  });
});

describe("quando o profissional responde", () => {
  const NEG = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));

  /*
   * Com os avisos a chegar, eles respondem. Sem isto, «ok» levava de volta
   * «Diga-me o que precisa de levar» — o cérebro a tratar um profissional
   * como um cliente novo.
   */
  it("não cai no formulário de cliente: passa a uma pessoa", () => {
    const i = NEG.indexOf("profissionalDoTelefone(telefone)");
    const recolha = NEG.indexOf("recolherPedidoPorWhatsApp(telefone, conteudo.texto)");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(recolha);
    expect(NEG.slice(i, recolha)).toContain('"Profissional escreveu — responder"');
  });

  it("«parar» confirma-se só a quem tinha avisos ligados", () => {
    const PONTE = semComentarios(ler("src/app/api/whatsapp/ponte/route.ts"));
    expect(PONTE).toContain("const desligou = await desligarAvisosPeloTelefone(telefone)");
    expect(PONTE).toContain("if (desligou)");
    const DB = semComentarios(ler("src/lib/db.ts"));
    const i = DB.indexOf("export async function desligarAvisosPeloTelefone");
    expect(DB.slice(i, i + 900)).toContain("WHERE whatsappAvisos = 1");
  });
});
