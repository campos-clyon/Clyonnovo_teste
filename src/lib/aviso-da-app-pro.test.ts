import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  avisadoHoje,
  FRASE_DA_DESCONTINUACAO,
  FRASE_DO_GMAIL,
  idDoProfissional,
  podeAvisarAgora,
  quemAvisarEmMassa,
  rotuloDoAvisado,
  textoDoAvisoDaAppPro,
  textoParaEnviar,
  type LinhaQueSeAvisa,
} from "./aviso-da-app-pro";
import { avisarNaAppProCom, type CaminhosDoAviso } from "./aviso-da-app-pro-na-base";
import { APP_PRO_NA_PLAY, LINK_DO_TESTE_DA_APP_PRO } from "./links-da-app";
import type { LinhaDoRegisto } from "./db";
import type { EstadoDeUso, PessoaDoTeste } from "./quem-conta-para-os-12";

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

// 14h05 de Lisboa a 03/11/2026 (inverno: Lisboa = UTC).
const INSCRITO = "2026-11-03T14:05:00.000Z";
// 20/10/2026 às 10h30 de Lisboa (verão: UTC+1).
const ABERTA = "2026-10-20T09:30:00.000Z";
const AGORA = new Date("2026-11-26T12:00:00Z");

describe("o texto do aviso, pelo estado", () => {
  it("«Nunca entrou»: inscrição em hora de Lisboa, os quatro passos e os links da constante única", () => {
    const t = textoDoAvisoDaAppPro({ nome: "Ana Exemplo", estado: "nunca", inscritoEm: INSCRITO, abertaEm: null, naoGmail: false });
    expect(t.startsWith("Olá, Ana! Aqui é a equipa da CLYON 😊 Inscreveu-se na CLYON a 03/11/2026 às 14h05 e, até hoje, ainda não entrou na app CLYON Pro.")).toBe(true);
    expect(t).toContain(FRASE_DA_DESCONTINUACAO);
    expect(t).toContain("Para instalar (Android):");
    expect(t).toContain(`1) No telemóvel, abra ${LINK_DO_TESTE_DA_APP_PRO} com a conta Google da Play Store e carregue em «Tornar-se testador».`);
    expect(t).toContain(`2) Instale em ${APP_PRO_NA_PLAY}`);
    expect(t).toContain("3) Entre com o mesmo email e palavra-passe do painel.");
    expect(t).toContain("4) Aceite as notificações — é assim que recebe os pedidos a tempo.");
    expect(t).toContain("Se aparecer «Este item não está disponível», responda a esta mensagem com o Gmail do seu telemóvel e pomo-lo na lista.");
    // d10: quem tem iPhone fica com caminho (o painel), antes dos passos do Android.
    expect(t).toContain("Se tem iPhone, a app ainda não está para si: use o painel no browser do telemóvel, com o mesmo email e palavra-passe.");
    expect(t.indexOf("Se tem iPhone")).toBeLessThan(t.indexOf("Para instalar (Android):"));
    expect(t).not.toContain("diga-nos qual é o Gmail");
    expect(t).not.toContain(FRASE_DO_GMAIL);
    expect(t).not.toContain("não a abre desde");
  });

  it("«Instalou e parou»: não a abre desde o dia (Lisboa), «abra a app e entre», a descontinuação", () => {
    const t = textoDoAvisoDaAppPro({ nome: "Ana Exemplo", estado: "parou", inscritoEm: INSCRITO, abertaEm: ABERTA, naoGmail: false });
    expect(t).toContain("Inscreveu-se na CLYON a 03/11/2026 às 14h05 e instalou a app CLYON Pro, mas não a abre desde 20/10/2026.");
    expect(t).toContain(FRASE_DA_DESCONTINUACAO);
    expect(t).toContain("1) Abra a app CLYON Pro e entre com o mesmo email e palavra-passe do painel.");
    expect(t).toContain("Aceite as notificações");
    expect(t).not.toContain("ainda não entrou");
    expect(t).not.toContain("Tornar-se testador");
  });

  it("«Instalou e parou» sem a data da última abertura não inventa uma data", () => {
    const t = textoDoAvisoDaAppPro({ nome: "Ana", estado: "parou", inscritoEm: INSCRITO, abertaEm: null, naoGmail: false });
    expect(t).toContain("mas não a abre há mais de duas semanas.");
  });

  it("o email sem Gmail acrescenta a frase do Gmail, nos dois estados", () => {
    for (const estado of ["nunca", "parou"] as const) {
      const t = textoDoAvisoDaAppPro({ nome: "Ana", estado, inscritoEm: INSCRITO, abertaEm: ABERTA, naoGmail: true });
      expect(t.endsWith(FRASE_DO_GMAIL)).toBe(true);
    }
  });

  it("sem datas de descontinuação e sem nome inventado", () => {
    const t = textoDoAvisoDaAppPro({ nome: "Sem nome (#12)", estado: "nunca", inscritoEm: null, abertaEm: null, naoGmail: false });
    expect(t.startsWith("Olá! Aqui é a equipa da CLYON 😊 Inscreveu-se na CLYON e, até hoje,")).toBe(true);
    expect(FRASE_DA_DESCONTINUACAO).not.toMatch(/\d{4}|janeiro|fevereiro|março|\d+\/\d+/i);
  });

  it("os links do texto vêm de links-da-app.ts (nenhum escrito à mão)", () => {
    const fonte = semComentarios(ler("src/lib/aviso-da-app-pro.ts"));
    expect(fonte).not.toContain("play.google.com");
    expect(fonte).toContain("LINK_DO_TESTE_DA_APP_PRO");
    expect(fonte).toContain("APP_PRO_NA_PLAY");
  });
});

describe("um por dia, em Lisboa", () => {
  it("avisado hoje conta pelo dia de Lisboa", () => {
    expect(avisadoHoje("2026-11-26T08:00:00Z", AGORA)).toBe(true);
    expect(avisadoHoje("2026-11-25T23:30:00Z", AGORA)).toBe(false);
    expect(avisadoHoje(null, AGORA)).toBe(false);
  });
  it("«avisado a DD/MM às HH:MM» em hora de Lisboa", () => {
    expect(rotuloDoAvisado("2026-11-26T14:05:00Z")).toBe("avisado a 26/11 às 14:05");
    expect(rotuloDoAvisado("2026-10-20T09:30:00Z")).toBe("avisado a 20/10 às 10:30");
    expect(rotuloDoAvisado(null)).toBeNull();
  });
});

const linha = (p: Partial<LinhaQueSeAvisa> & { id: string }): LinhaQueSeAvisa => ({
  estado: "nunca",
  contaDeTeste: false,
  temWhatsApp: true,
  avisadoEm: null,
  ...p,
});

describe("quem se pode avisar", () => {
  it("só «Nunca entrou» e «Instalou e parou», com WhatsApp e não avisados hoje", () => {
    expect(podeAvisarAgora(linha({ id: "p1" }), AGORA)).toBe(true);
    expect(podeAvisarAgora(linha({ id: "p2", estado: "parou" }), AGORA)).toBe(true);
    expect(podeAvisarAgora(linha({ id: "p3", estado: "usa" }), AGORA)).toBe(false);
    expect(podeAvisarAgora(linha({ id: "p4", temWhatsApp: false }), AGORA)).toBe(false);
    expect(podeAvisarAgora(linha({ id: "p5", avisadoEm: "2026-11-26T09:00:00Z" }), AGORA)).toBe(false);
    expect(podeAvisarAgora(linha({ id: "p6", avisadoEm: "2026-11-25T09:00:00Z" }), AGORA)).toBe(true);
  });
  it("«Avisar todos» leva só os «Nunca entrou», sem contas de teste nem quem já foi avisado hoje", () => {
    const ids = quemAvisarEmMassa(
      [
        linha({ id: "p1" }),
        linha({ id: "p2", estado: "parou" }),
        linha({ id: "p3", contaDeTeste: true }),
        linha({ id: "p4", avisadoEm: "2026-11-26T09:00:00Z" }),
        linha({ id: "p5", temWhatsApp: false }),
      ],
      AGORA,
    ).map((l) => l.id);
    expect(ids).toEqual(["p1"]);
  });
  it("o texto e o id que chegam à rota", () => {
    expect(textoParaEnviar("  olá \r\n ")).toBe("olá");
    expect(textoParaEnviar("")).toBeNull();
    expect(textoParaEnviar("x".repeat(2001))).toBeNull();
    expect(idDoProfissional("p12")).toBe(12);
    expect(idDoProfissional("c12")).toBeNull();
    expect(idDoProfissional(12)).toBe(12);
  });
});

/* ── O envio, com caminhos falsos ─────────────────────────────────────────── */

function pessoa(estado: EstadoDeUso, telefone: string | null = "912345678"): { pessoa: PessoaDoTeste; estado: EstadoDeUso } {
  return {
    estado,
    pessoa: {
      id: "p7",
      nome: "Ana Exemplo",
      emails: ["exemplo@gmail.com"],
      telefone,
      abertaEm: null,
      versao: null,
      temAvisosDaApp: false,
      porque: "Aprovado (vê o convite no painel)",
      contaDeTeste: false,
    },
  };
}

function caminhos(lida: ReturnType<typeof pessoa> | null, saiu = true) {
  const dias = new Map<string, "a_enviar" | "enviado">();
  const enviados: Array<{ telefone: string; texto: string }> = [];
  const registos: LinhaDoRegisto[] = [];
  const c: CaminhosDoAviso = {
    lerPessoa: async () => lida,
    reservar: async (id, dia) => {
      const k = `${id}:${dia}`;
      if (dias.has(k)) return false;
      dias.set(k, "a_enviar");
      return true;
    },
    avisadoNoDia: async () => "2026-11-26T09:00:00.000Z",
    confirmar: async (id, dia) => {
      dias.set(`${id}:${dia}`, "enviado");
      return "2026-11-26T12:00:00.000Z";
    },
    desfazer: async (id, dia) => {
      dias.delete(`${id}:${dia}`);
    },
    telemovel: (t) => (t && /^9\d{8}$/.test(t.replace(/\D/g, "")) ? `351${t.replace(/\D/g, "")}` : null),
    enviar: async (telefone, texto) => {
      enviados.push({ telefone, texto });
      return saiu;
    },
    registar: async (l) => {
      registos.push(l);
    },
  };
  return { c, dias, enviados, registos };
}

describe("o envio de um aviso", () => {
  const pedido = { providerId: 7, texto: "Olá, Ana!", porQuem: "Equipa Exemplo", porId: 3, agora: AGORA };

  it("envia o texto que o administrador viu e regista no histórico do profissional (quem, quando)", async () => {
    const f = caminhos(pessoa("nunca"));
    const r = await avisarNaAppProCom(f.c, pedido);
    expect(r).toEqual({ ok: true, avisadoEm: "2026-11-26T12:00:00.000Z" });
    expect(f.enviados).toEqual([{ telefone: "351912345678", texto: "Olá, Ana!" }]);
    expect(f.registos).toHaveLength(1);
    expect(f.registos[0]).toMatchObject({
      acontecimento: "aviso_da_app_pro",
      providerId: 7,
      autorTipo: "clyon",
      autorNome: "Equipa Exemplo",
      estadoAntes: "nunca",
    });
    expect(String(f.registos[0].resumo)).toContain("Nunca entrou");
  });

  it("um por dia: o segundo no mesmo dia não sai e diz quando foi avisado", async () => {
    const f = caminhos(pessoa("parou"));
    expect((await avisarNaAppProCom(f.c, pedido)).ok).toBe(true);
    const r = await avisarNaAppProCom(f.c, pedido);
    expect(r).toMatchObject({ ok: false, status: 409, avisadoEm: "2026-11-26T09:00:00.000Z" });
    expect(f.enviados).toHaveLength(1);
    expect(f.registos).toHaveLength(1);
    // No dia seguinte já pode.
    expect((await avisarNaAppProCom(f.c, { ...pedido, agora: new Date("2026-11-27T10:00:00Z") })).ok).toBe(true);
    expect(f.enviados).toHaveLength(2);
  });

  it("se não saiu, desfaz a reserva do dia e não regista", async () => {
    const f = caminhos(pessoa("nunca"), false);
    const r = await avisarNaAppProCom(f.c, pedido);
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(f.dias.size).toBe(0);
    expect(f.registos).toHaveLength(0);
  });

  it("não envia a quem já usa a app, a quem não tem telemóvel, nem um texto vazio", async () => {
    for (const [lida, texto] of [
      [pessoa("usa"), "Olá"],
      [pessoa("nunca", null), "Olá"],
      [pessoa("nunca"), "   "],
      [null, "Olá"],
    ] as const) {
      const f = caminhos(lida);
      const r = await avisarNaAppProCom(f.c, { ...pedido, texto });
      expect(r.ok).toBe(false);
      expect(f.enviados).toHaveLength(0);
      expect(f.registos).toHaveLength(0);
    }
  });
});

describe("no backoffice, nada sai sem «Enviar»", () => {
  const ui = semComentarios(ler("src/components/admin/QuemContaParaOs12.tsx"));

  it("«Avisar no WhatsApp» só abre a pré-visualização (editável)", () => {
    const i = ui.search(/Avisar no WhatsApp\s*<\/button>/);
    expect(i).toBeGreaterThan(-1);
    const botao = ui.slice(ui.lastIndexOf("<button", i), i);
    expect(botao).toContain("setPrevia(");
    expect(botao).not.toMatch(/enviarAviso|enviarAPrevia|enviarATodos|fetch\(/);
    expect(ui).toMatch(/<textarea[\s\S]*?value=\{previa\.texto\}/);
  });

  it("a rota do aviso só é chamada por enviarAviso, e esta só pelos botões «Enviar»", () => {
    expect(ui.match(/quem-conta-para-os-12\/avisar/g)).toHaveLength(1);
    const chamadas = [...ui.matchAll(/enviarAviso\(/g)].length;
    // a definição, a pré-visualização e o envio um a um
    expect(chamadas).toBe(3);
    expect(ui).toMatch(/onClick=\{\(\) => void enviarAPrevia\(\)\}[\s\S]{0,400}Enviar\s*<\/button>/);
    expect(ui).toMatch(/onClick=\{\(\) => void enviarATodos\(\)\}[\s\S]{0,300}Enviar a \{massa\.ids\.length\}, um a um/);
    expect([...ui.matchAll(/enviarAPrevia\(\)/g)]).toHaveLength(2);
    expect([...ui.matchAll(/enviarATodos\(\)/g)]).toHaveLength(2);
  });

  it("«Avisar todos» espera 20 a 45 s entre envios", () => {
    const corpo = ui.slice(ui.indexOf("async function enviarATodos"));
    expect(corpo).toMatch(/intervaloAoAcaso\(\)[\s\S]{0,200}await esperar\(s \* 1000\)/);
  });
});

describe("a rota", () => {
  it("só o administrador, e passa pelo envio com reserva e registo", () => {
    const rota = ler("src/app/api/admin/quem-conta-para-os-12/avisar/route.ts");
    expect(rota).toContain("requireAdminGeral(req)");
    expect(rota).toContain("avisarNaAppPro(");
    const base = semComentarios(ler("src/lib/aviso-da-app-pro-na-base.ts"));
    expect(base).toContain("PRIMARY KEY (providerId, dia)");
    expect(base).toContain("INSERT IGNORE INTO avisosDaAppPro");
    expect(base).toContain("enviarAvisoWhatsApp(telefone, texto)");
    expect(base).toContain("registar: registarSemFalhar");
  });
});
