import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIAS_ATE_AO_LEMBRETE,
  eGmail,
  htmlDeTextoSimples,
  inscritoParado,
  listaParaAPlay,
  precisaDoLembrete,
  preencherTexto,
} from "./seguimento-da-app";
import * as TEXTOS from "./textos-do-seguimento-da-app";
import { estadoDoLembrete } from "./lembrete-da-app";

/**
 * O SEGUIMENTO DA APP DE CLIENTE — 17-11-2026 (d59): «porque ninguém adere».
 * Inscritos parados, só Gmail na lista da Play, e o lembrete único DESLIGADO
 * até os textos do Marketing estarem aprovados pelo dono.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const H = 3600_000;
const agora = new Date("2026-11-17T12:00:00Z");

describe("o Gmail que a Play reconhece", () => {
  it("gmail.com e googlemail.com, em qualquer caixa", () => {
    expect(eGmail("ana@gmail.com")).toBe(true);
    expect(eGmail("  Ana@GMAIL.com ")).toBe(true);
    expect(eGmail("ana@googlemail.com")).toBe(true);
  });
  it("outros domínios e lixo não", () => {
    expect(eGmail("ana@exemplo.invalid")).toBe(false);
    expect(eGmail("ana@gmail.com.exemplo.invalid")).toBe(false);
    expect(eGmail("gmail.com")).toBe(false);
    expect(eGmail(null)).toBe(false);
  });
});

describe("os inscritos parados há mais de 24 h", () => {
  it("só os `inscrito`, e só depois das 24 h", () => {
    expect(inscritoParado({ estado: "inscrito", consentimentoEm: new Date(agora.getTime() - 25 * H) }, agora)).toBe(true);
    expect(inscritoParado({ estado: "inscrito", consentimentoEm: new Date(agora.getTime() - 23 * H) }, agora)).toBe(false);
    expect(inscritoParado({ estado: "adicionado", consentimentoEm: new Date(agora.getTime() - 99 * H) }, agora)).toBe(false);
    expect(inscritoParado({ estado: "inscrito", consentimentoEm: null }, agora)).toBe(false);
  });

  it("o painel mostra o aviso e o separador o selo", () => {
    const painel = ler("src/components/admin/ProgramaDaAppPanel.tsx");
    expect(painel).toContain("à espera há mais de 24 h");
    const legado = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(legado).toContain('id === "programa" && (porFazer.contas ?? 0) > 0');
  });
});

describe("a lista para a Play", () => {
  it("inscritos como estão, contas novas só com Gmail, sem repetidos", () => {
    const r = listaParaAPlay(
      [
        { email: "ana@gmail.com", estado: "inscrito" },
        { email: "rui@exemplo.invalid", estado: "inscrito" },
        { email: "ja@gmail.com", estado: "adicionado" },
      ],
      [{ email: "ANA@gmail.com" }, { email: "nova@gmail.com" }, { email: "outra@exemplo.invalid" }],
    );
    expect(r.emails).toEqual(["ana@gmail.com", "rui@exemplo.invalid", "nova@gmail.com"]);
    expect(r).toMatchObject({ deInscritos: 2, deContas: 1, faltaGmail: 1 });
  });

  it("o CSV do convite em massa só leva Gmail de quem não está no programa", () => {
    const rota = ler("src/app/api/admin/convite-app-cliente/route.ts");
    expect(rota).toContain("const prontoParaAPlay = (d: Destinatario) => d.gmail && !d.noPrograma;");
    expect(rota).toContain("csvParaAPlay(estado.destinatarios.filter(prontoParaAPlay)");
    // Sem o texto que pede o Gmail aprovado, uma conta sem Gmail não recebe nada.
    expect(rota).toContain("TEXTO_DO_CONVITE_QUE_PEDE_O_GMAIL !== null");
    // E o convite de sempre continua a ir para os Gmail, depois de reservar.
    expect(rota.indexOf("reservarConvite(")).toBeLessThan(rota.indexOf("enviarConviteDaApp({ para: d.email"));
  });
});

describe("o lembrete único", () => {
  const convidado = new Date(agora.getTime() - DIAS_ATE_AO_LEMBRETE * 24 * H);
  it("3 dias depois, a quem não aderiu, uma vez só", () => {
    expect(precisaDoLembrete({ convidadoEm: convidado, aderiu: null, lembreteEm: null }, agora)).toBe(true);
    expect(precisaDoLembrete({ convidadoEm: new Date(agora.getTime() - 71 * H), aderiu: null, lembreteEm: null }, agora)).toBe(false);
    expect(precisaDoLembrete({ convidadoEm: convidado, aderiu: "marcado", lembreteEm: null }, agora)).toBe(false);
    expect(precisaDoLembrete({ convidadoEm: convidado, aderiu: "avisos-da-app", lembreteEm: null }, agora)).toBe(false);
    expect(precisaDoLembrete({ convidadoEm: convidado, aderiu: null, lembreteEm: agora }, agora)).toBe(false);
  });

  it("DESLIGADO por omissão: interruptores a false e os textos novos por colar", () => {
    expect(TEXTOS.LEMBRETE_DA_APP_LIGADO).toBe(false);
    expect(TEXTOS.LEMBRETE_DA_APP_POR_WHATSAPP_LIGADO).toBe(false);
    expect(TEXTOS.TEXTO_DO_LEMBRETE_POR_EMAIL).toBeNull();
    expect(TEXTOS.TEXTO_DO_LEMBRETE_POR_WHATSAPP).toBeNull();
    expect(TEXTOS.TEXTO_DO_CONVITE_QUE_PEDE_O_GMAIL).toBeNull();
    expect(estadoDoLembrete()).toEqual({ email: false, whatsapp: false });
  });

  it("só sai com interruptor E texto, e reserva antes de enviar", () => {
    const f = ler("src/lib/lembrete-da-app.ts");
    expect(f).toContain("LEMBRETE_DA_APP_LIGADO && TEXTO_DO_LEMBRETE_POR_EMAIL !== null");
    expect(f).toContain("if (!ligado.email || !textoEmail) return { ligado: false");
    expect(f.indexOf("reservarLembrete(c.email)")).toBeLessThan(f.indexOf("enviarEmailDoSeguimento({"));
    const rota = ler("src/app/api/cron/lembrete-da-app/route.ts");
    expect(rota).toContain("bearerConfere(");
  });

  it("aderiu = os avisos da app de cliente ou a marca da equipa", () => {
    const base = ler("src/lib/seguimento-da-app-na-base.ts");
    expect(base).toContain("FROM pushSubscriptions WHERE app = 'cliente'");
    expect(base).toContain('aderiu: instalou ? "marcado" : avisosDaApp ? "avisos-da-app" : null');
  });
});

describe("os textos do Marketing, quando chegarem", () => {
  it("as marcas trocam-se, e as desconhecidas ficam", () => {
    expect(preencherTexto("Abra {linkDeAdesao} e {linkDaConta} {outra}", { linkDeAdesao: "A", linkDaConta: "B" })).toBe(
      "Abra A e B {outra}",
    );
  });
  it("o HTML escapa o texto e faz link de um link sozinho", () => {
    const h = htmlDeTextoSimples("Olá <b>\n\nhttps://play.google.com/x\n\nEquipa CLYON");
    expect(h).toContain("Olá &lt;b&gt;");
    expect(h).toContain('<a href="https://play.google.com/x"');
    expect(h).not.toContain("<b>");
  });
});

describe("apagar a conta apaga o seguimento", () => {
  it("na transacção do titular e no DELETE do backoffice", () => {
    const base = ler("src/lib/programa-da-app-na-base.ts");
    expect(base).toContain("await apagarSeguimentoNaTransaccao(conn, email, contaIds);");
    expect(base).toContain("await apagarSeguimentoDaConta(userId);");
  });
});
