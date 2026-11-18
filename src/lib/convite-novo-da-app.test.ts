import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contagemDoConviteNovo, elegiveisParaOConviteNovo } from "./convite-novo-da-app";

/**
 * O CONVITE NOVO DA APP DE CLIENTE — 17-11-2026 (d59, parte 2).
 * Só Gmail, fora do programa e de quem aderiu, uma vez por email; o WhatsApp
 * espaçado pela ponte; e no máximo 1 convite novo + 1 lembrete por pessoa.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const d = (id: number, email: string, o: Partial<{ gmail: boolean; noPrograma: boolean }> = {}) => ({
  id,
  nome: "Cliente",
  email,
  gmail: true,
  noPrograma: false,
  ...o,
});

describe("quem recebe o convite novo", () => {
  it("Gmail, fora do programa, sem ter aderido nem recebido o convite novo", () => {
    const lista = elegiveisParaOConviteNovo(
      [
        d(1, "a@gmail.com"),
        d(2, "b@exemplo.invalid", { gmail: false }),
        d(3, "c@gmail.com", { noPrograma: true }),
        d(4, "d@gmail.com"),
        d(5, "e@gmail.com"),
        d(6, "f@gmail.com"),
      ],
      new Map([
        [1, "912 345 678"],
        [4, "+351 21 000 0000"],
        [6, "00351960000123"],
      ]),
      new Set(["d@gmail.com"]),
      new Set(["e@gmail.com"]),
    );
    expect(lista.map((e) => e.id)).toEqual([1, 6]);
    // Só telemóveis portugueses: um fixo nunca leva WhatsApp.
    expect(lista.map((e) => e.telemovel)).toEqual(["351912345678", "351960000123"]);
    expect(contagemDoConviteNovo(lista)).toEqual({ emails: 2, whatsapps: 2 });
  });

  it("uma pessoa com o convite de 01-11 continua elegível (o registo antigo não conta)", () => {
    const lista = elegiveisParaOConviteNovo([d(1, "a@gmail.com")], new Map(), new Set(), new Set());
    expect(contagemDoConviteNovo(lista)).toEqual({ emails: 1, whatsapps: 0 });
  });
});

describe("a rota e a base: uma vez por pessoa, reservado antes de sair", () => {
  const rota = ler("src/app/api/admin/convite-app-cliente/route.ts");
  const base = ler("src/lib/convite-novo-da-app-na-base.ts");

  it("só o administrador geral, e reserva o email antes de enviar", () => {
    expect(rota).toMatch(/requireAdminGeral\(req\)/);
    const bloco = rota.slice(rota.indexOf('corpo.accao === "enviar-convite-novo"'), rota.indexOf('corpo.accao === "enviar-lote"'));
    expect(bloco.indexOf("reservarConviteNovo(")).toBeGreaterThan(0);
    expect(bloco.indexOf("reservarConviteNovo(")).toBeLessThan(bloco.indexOf("enviarConviteDaApp("));
    // O WhatsApp só entra na fila depois de o email sair.
    expect(bloco.indexOf("marcarConviteNovoEnviado(")).toBeLessThan(bloco.indexOf("porWhatsAppDaAppNaFila("));
  });

  it("a base recusa o segundo convite novo e o segundo WhatsApp do mesmo tipo", () => {
    expect(base).toMatch(/email\s+VARCHAR\(255\) NOT NULL PRIMARY KEY/);
    expect(base).toMatch(/PRIMARY KEY \(email, tipo\)/);
    expect(base).toContain("INSERT IGNORE INTO conviteNovoDaApp");
    expect(base).toContain("INSERT IGNORE INTO whatsappDaAppPorEnviar");
  });

  it("o WhatsApp sai um de cada vez, 20–45 s entre cada, 9h–21h, pela ponte", () => {
    expect(base).toContain("dentroDaJanelaDoWhatsApp(agora)");
    expect(base).toContain("intervaloAoAcaso()");
    expect(base).toMatch(/UPDATE whatsappDaAppVez SET proximoEm = UTC_TIMESTAMP\(\) \+ INTERVAL \? SECOND WHERE id = 1 AND proximoEm <= UTC_TIMESTAMP\(\)/);
    expect(base).toContain("SET estado = 'a_enviar' WHERE email = ? AND tipo = ? AND estado = 'pendente'");
    const ponte = ler("src/app/api/whatsapp/ponte/route.ts");
    expect(ponte).toContain("await passagemDosWhatsAppDaApp();");
  });

  it("o convite novo não envia nada sozinho: só o botão do administrador", () => {
    // Nenhuma rotina chama o envio do convite novo.
    const cron = ler("src/app/api/cron/lembrete-da-app/route.ts");
    expect(cron).not.toContain("enviar-convite-novo");
    expect(cron).not.toContain("reservarConviteNovo");
  });
});
