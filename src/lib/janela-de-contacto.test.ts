import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  JANELA_DE_CONTACTO,
  JANELA_DE_CONTACTO_POR_EXTENSO,
  naJanelaDeContacto,
} from "./janela-de-contacto";
import { JANELA_DAS_MENSAGENS_AUTOMATICAS, HORA_DO_QUE_FICOU_PARA_DEPOIS, naJanelaDasMensagensAutomaticas, momentoDeSaida } from "./janela-das-mensagens-automaticas";
import { JANELA_DO_SEGUIMENTO, naJanelaDoSeguimento, horaNaJanela } from "./seguimento-do-cliente";
import { JANELA_DA_VALIDADE, naJanelaDaValidade } from "./validade-do-orcamento";
import { JANELA_DO_WHATSAPP, dentroDaJanelaDoWhatsApp } from "./aviso-aos-profissionais";
import { JANELA_DA_CONVERSA_PARADA } from "./conversa-parada-a-meio";
import { JANELA_DO_RECEBIDO, naJanelaDoRecebido } from "./recebemos-o-pedido";
import { JANELA_DE_RESPOSTA } from "./prazo-de-resposta-do-parceiro";
import { JANELA_DO_ENVIO_AUTOMATICO, naJanelaDoEnvioAutomatico, horaDeSaida } from "./envio-automatico-aos-parceiros";
import { naJanelaDeResposta } from "./escolhidos-sem-resposta";
import { naJanelaDosLembretes, noDiaSeguinte } from "./lembrete-do-que-falta";
import { HORA_A_QUE_ACORDA, HORA_A_QUE_ADORMECE, horaDeFalar } from "./assistente-interruptores";
import { HORA_QUE_ABRE, HORA_QUE_FECHA } from "./vitoria-agente/pergunta-ao-parceiro";

/**
 * UMA SÓ JANELA DE CONTACTO — d7 (24-11-2026, dono): das 9h às 20h de Lisboa.
 * Cada rotina e a Vitória liam a sua (8h–21h numas, 9h–21h noutras); agora
 * lêem todas de `janela-de-contacto.ts`, e este teste chumba se uma voltar a
 * ter a sua.
 */

// Lisboa no Inverno é UTC; no Verão é UTC+1. Um dia de cada.
const inverno = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 24, h, m));
const verao = (h: number, m = 0) => new Date(Date.UTC(2026, 6, 14, h - 1, m));

describe("a janela de contacto", () => {
  it("é das 9h às 20h, e diz-se assim", () => {
    expect(JANELA_DE_CONTACTO).toEqual({ abre: 9, fecha: 20 });
    expect(JANELA_DE_CONTACTO_POR_EXTENSO).toBe("das 9h às 20h");
  });

  it("abre às 9h00 e fecha às 20h00, em hora de Lisboa (Inverno e Verão)", () => {
    for (const hora of [inverno, verao]) {
      expect(naJanelaDeContacto(hora(8, 59))).toBe(false);
      expect(naJanelaDeContacto(hora(9, 0))).toBe(true);
      expect(naJanelaDeContacto(hora(19, 59))).toBe(true);
      expect(naJanelaDeContacto(hora(20, 0))).toBe(false);
      expect(naJanelaDeContacto(hora(20, 30))).toBe(false);
      expect(naJanelaDeContacto(hora(3, 0))).toBe(false);
    }
  });

  it("todas as rotinas e a Vitória leem a mesma", () => {
    const igual = (a: number, f: number) => expect({ a, f }).toEqual({ a: 9, f: 20 });
    igual(JANELA_DAS_MENSAGENS_AUTOMATICAS.das, JANELA_DAS_MENSAGENS_AUTOMATICAS.as);
    igual(JANELA_DO_SEGUIMENTO.das, JANELA_DO_SEGUIMENTO.as);
    igual(JANELA_DA_VALIDADE.das, JANELA_DA_VALIDADE.as);
    igual(JANELA_DO_WHATSAPP.das, JANELA_DO_WHATSAPP.as);
    igual(JANELA_DA_CONVERSA_PARADA.das, JANELA_DA_CONVERSA_PARADA.as);
    igual(JANELA_DO_RECEBIDO.das, JANELA_DO_RECEBIDO.as);
    igual(JANELA_DE_RESPOSTA.abre, JANELA_DE_RESPOSTA.fecha);
    igual(JANELA_DO_ENVIO_AUTOMATICO.abre, JANELA_DO_ENVIO_AUTOMATICO.fecha);
    igual(HORA_A_QUE_ACORDA, HORA_A_QUE_ADORMECE);
    igual(HORA_QUE_ABRE, HORA_QUE_FECHA);
    expect(HORA_DO_QUE_FICOU_PARA_DEPOIS).toBe(JANELA_DE_CONTACTO.abre);
  });

  it("e todas dão a mesma resposta em cada hora do dia", () => {
    for (let h = 0; h < 24; h++) {
      const quando = inverno(h, 30);
      const esperado = h >= 9 && h < 20;
      const respostas = [
        naJanelaDeContacto(quando),
        naJanelaDasMensagensAutomaticas(quando),
        naJanelaDoSeguimento(quando),
        naJanelaDaValidade(quando),
        dentroDaJanelaDoWhatsApp(quando),
        naJanelaDoRecebido(quando),
        naJanelaDoEnvioAutomatico(quando),
        naJanelaDeResposta(quando),
        naJanelaDosLembretes(quando),
        horaDeFalar(quando),
      ];
      expect(respostas, `${h}h30`).toEqual(respostas.map(() => esperado));
    }
    expect(horaNaJanela("08:59")).toBe(false);
    expect(horaNaJanela("09:00")).toBe(true);
    expect(horaNaJanela("19:59")).toBe(true);
    expect(horaNaJanela("20:00")).toBe(false);
  });

  it("o que cai fora sai às 9h, e nunca depois das 20h", () => {
    // Devido às 22h30 de terça: sai às 9h de quarta.
    expect(momentoDeSaida(inverno(22, 30), inverno(22, 45)).toISOString()).toBe("2026-11-25T09:00:00.000Z");
    // Devido às 8h30: às 9h do mesmo dia.
    expect(momentoDeSaida(inverno(8, 30), inverno(8, 45)).toISOString()).toBe("2026-11-24T09:00:00.000Z");
    // Às 20h15 já não sai: amanhã às 9h.
    expect(momentoDeSaida(inverno(19, 0), inverno(20, 15)).toISOString()).toBe("2026-11-25T09:00:00.000Z");
    // O envio aos parceiros: pedido completo às 20h40 sai às 9h do dia seguinte.
    expect(horaDeSaida(inverno(20, 40)).toISOString()).toBe("2026-11-25T09:00:00.000Z");
    expect(horaDeSaida(inverno(6, 0)).toISOString()).toBe("2026-11-24T09:00:00.000Z");
    // O passo seguinte do «Pedir o que falta»: a hora de cima, ou às 10h se a de cima cai fora.
    expect(noDiaSeguinte(inverno(14, 20)).toISOString()).toBe("2026-11-25T14:20:00.000Z");
    expect(noDiaSeguinte(inverno(20, 20)).toISOString()).toBe("2026-11-25T10:00:00.000Z");
  });
});

/* ── Nenhuma outra janela escondida no código ─────────────────────────────── */

const SRC = join(__dirname, "..");

function ficheiros(dir: string, fora: string[] = []): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) {
      if (nome === "node_modules") continue;
      out.push(...ficheiros(p, fora));
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.(ts|tsx)$/.test(nome)) out.push(p);
  }
  return out;
}

/**
 * Os horários que NÃO são a janela de contacto: o que se promete ao público
 * (atendimento, 08:00–20:00) e o telemóvel da equipa (08h–21h). Dizem-se à
 * parte e não se misturam com a janela.
 */
const OUTROS_HORARIOS = /avisos-a-equipa|AvisosDaEquipa|AdminContactosPanel|caixa-dos-contactos|horario-de-atendimento|cron[\\/]assistente[\\/]route/;

describe("sem outra janela escondida", () => {
  const todos = ficheiros(SRC).filter((f) => !OUTROS_HORARIOS.test(f) && !/janela-de-contacto.ts$/.test(f));

  it("nenhum texto diz «das 8h às 21h», «9h–21h», «20h59»… para o contacto", () => {
    const proibido =
      /\b(?:8|9|08)h(?:00)?\s*(?:às|–|-|e as)\s*21h|\b(?:8|9|08)h(?:00)? às 21 h|\b9h00 às 20h59|9h00–20h59|\b20h59\b|entre as (?:8|9)h e as 21h|nunca (?:entre as 21h e as 9h|das 21h às 9h)/;
    const mal = todos.filter((f) => proibido.test(readFileSync(f, "utf8")));
    expect(mal.map((f) => f.replace(SRC, ""))).toEqual([]);
  });

  it("nenhuma constante nova escreve a hora de abrir ou fechar à mão", () => {
    const mao = /\b(?:das|abre|fecha|as):\s*(?:8|9|20|21)\b|HORA_A_QUE_(?:ACORDA|ADORMECE)\s*=\s*\d|HORA_QUE_(?:ABRE|FECHA)\s*=\s*\d/;
    const mal = todos.filter((f) => !/janela-de-contacto\.ts$/.test(f) && mao.test(readFileSync(f, "utf8")));
    expect(mal.map((f) => f.replace(SRC, ""))).toEqual([]);
  });

  it("o agradecimento e o fecho já não dizem «fico-lhe grato» nem «Ele já tem a morada»", () => {
    const fonte = readFileSync(join(SRC, "lib", "assistente-automatico.ts"), "utf8");
    expect(fonte).not.toContain("fico-lhe grato");
    expect(fonte).not.toContain("Ele já tem a morada");
    expect(fonte).not.toContain("tratar disto consigo");
  });
});
