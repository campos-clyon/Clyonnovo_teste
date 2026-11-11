import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LINK_DA_PLAY_STORE,
  TEXTOS_DO_CONVITE_NO_SITE,
  accaoDaInscricao,
  emailDoPrograma,
  emailsPorAdicionar,
  fraseDoEstadoNaConta,
  htmlDoConviteDoPrograma,
  podeMarcarAdicionado,
  podeReceberOConvite,
  textoDoConviteDoPrograma,
  validarInscricao,
  type LinhaDoPrograma,
} from "./programa-da-app";
import { SQL_DA_TABELA_DO_PROGRAMA } from "./programa-da-app-na-base";

/**
 * O PROGRAMA DE ACESSO ANTECIPADO DA APP — 11-11-2026 (ordem do CEO, pedida e
 * aprovada pelo dono). O que este ficheiro guarda: o consentimento é
 * obrigatório, um email é uma linha só, os estados andam pela ordem, a cópia
 * para a Play leva só os inscritos, o convite só vai a quem já está na Play,
 * e apagar a conta apaga a inscrição.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const BASE = semNotas(ler("src/lib/programa-da-app-na-base.ts"));
const DB = ler("src/lib/db.ts");
const ROTA_CONTA = semNotas(ler("src/app/api/conta/programa-da-app/route.ts"));
const ROTA_ADMIN = semNotas(ler("src/app/api/admin/programa-da-app/route.ts"));

const linha = (p: Partial<LinhaDoPrograma>): LinhaDoPrograma => ({
  id: 1,
  email: "ana@gmail.com",
  userId: 10,
  estado: "inscrito",
  ...p,
});

describe("o consentimento é obrigatório", () => {
  it("sem a caixa marcada, não há inscrição", () => {
    for (const consentimento of [false, undefined, null, "true", "sim", 1]) {
      const r = validarInscricao({ email: "ana@gmail.com", consentimento });
      expect(r.ok, `consentimento = ${String(consentimento)}`).toBe(false);
      if (!r.ok) expect(r.erro).toBe(TEXTOS_DO_CONVITE_NO_SITE.semConsentimento);
    }
  });

  it("com a caixa marcada e um email válido, inscreve — o email limpo e em minúsculas", () => {
    const r = validarInscricao({ email: "  Ana.Silva@Gmail.COM ", consentimento: true, origem: "registo" });
    expect(r).toEqual({ ok: true, email: "ana.silva@gmail.com", origem: "registo" });
  });

  it("um email mal escrito é recusado, e a origem desconhecida passa a «conta»", () => {
    expect(validarInscricao({ email: "ana@", consentimento: true }).ok).toBe(false);
    expect(validarInscricao({ email: "a, b@x.pt", consentimento: true }).ok).toBe(false);
    expect(emailDoPrograma(42)).toBeNull();
    const r = validarInscricao({ email: "ana@gmail.com", consentimento: true, origem: "outra" });
    expect(r.ok && r.origem).toBe("conta");
  });

  it("a rota da conta valida antes de gravar, e só com sessão de cliente", () => {
    expect(ROTA_CONTA).toContain("validarInscricao(");
    expect(ROTA_CONTA).toContain("clienteDaSessao(req)");
    expect(ROTA_CONTA.indexOf("validarInscricao(")).toBeLessThan(ROTA_CONTA.indexOf("inscreverNoPrograma("));
  });
});

describe("sem duplicados por email", () => {
  it("a tabela tem o email como chave única", () => {
    expect(SQL_DA_TABELA_DO_PROGRAMA).toMatch(/UNIQUE KEY \w+ \(email\)/);
  });

  it("um email novo nasce; o mesmo email da mesma conta só renova o consentimento", () => {
    expect(accaoDaInscricao(10, null, null)).toEqual({ tipo: "nova" });
    expect(accaoDaInscricao(10, linha({ estado: "convidado" }), linha({ estado: "convidado" }))).toEqual({
      tipo: "renovar",
      id: 1,
    });
  });

  it("quem saiu e volta reentra na mesma linha, como inscrito", () => {
    expect(accaoDaInscricao(10, linha({ estado: "saiu" }), linha({ estado: "saiu" }))).toEqual({ tipo: "reentrar", id: 1 });
  });

  it("a mesma conta com outro email troca o email da sua linha (não cria outra)", () => {
    expect(accaoDaInscricao(10, null, linha({ id: 7, email: "antigo@gmail.com", estado: "convidado" }))).toEqual({
      tipo: "mudar-email",
      id: 7,
    });
  });

  it("um email já inscrito por outra conta não é tocado", () => {
    expect(accaoDaInscricao(11, linha({ userId: 10 }), null)).toEqual({ tipo: "de-outra-conta" });
  });

  it("dois cliques ao mesmo tempo: o INSERT repetido é engolido, e não rebenta", () => {
    expect(BASE).toContain("ER_DUP_ENTRY");
  });

  it("trocar de email volta a «inscrito» — outro email é outra conta Google, e tem de ir outra vez à Play", () => {
    const i = BASE.indexOf('case "mudar-email"');
    const corpo = BASE.slice(i, BASE.indexOf("case ", i + 10));
    expect(corpo).toContain("estado = 'inscrito'");
    expect(corpo).toContain("convidadoEm = NULL");
  });
});

describe("os estados andam pela ordem", () => {
  it("só um inscrito passa a adicionado, e só um adicionado recebe o convite", () => {
    expect(podeMarcarAdicionado("inscrito")).toBe(true);
    for (const e of ["adicionado", "convidado", "saiu"]) expect(podeMarcarAdicionado(e)).toBe(false);
    expect(podeReceberOConvite("adicionado")).toBe(true);
    for (const e of ["inscrito", "convidado", "saiu"]) expect(podeReceberOConvite(e)).toBe(false);
  });

  it("a base aplica as mesmas regras no WHERE (não confia no ecrã)", () => {
    const marcar = BASE.slice(BASE.indexOf("export async function marcarAdicionados"));
    expect(marcar.slice(0, marcar.indexOf("\n}\n"))).toContain("estado = 'inscrito'");
    const reservar = BASE.slice(BASE.indexOf("export async function reservarConviteDoPrograma"));
    expect(reservar.slice(0, reservar.indexOf("\n}\n"))).toContain("WHERE id = ? AND estado = 'adicionado'");
    const lote = BASE.slice(BASE.indexOf("export async function adicionadosParaConvidar"));
    expect(lote.slice(0, lote.indexOf("\n}\n"))).not.toMatch(/estado = '(inscrito|convidado|saiu)'/);
  });

  it("o convite reserva ANTES de enviar e desfaz se o envio falhar", () => {
    const i = ROTA_ADMIN.indexOf('corpo.accao === "convidar"');
    const corpo = ROTA_ADMIN.slice(i);
    expect(corpo.indexOf("reservarConviteDoPrograma(")).toBeLessThan(corpo.indexOf("enviarConviteDoPrograma("));
    expect(corpo).toContain("desfazerConviteDoPrograma(");
  });

  it("sem link de adesão nas Configs, o convite não sai e diz o que falta", () => {
    const i = ROTA_ADMIN.indexOf('corpo.accao === "convidar"');
    const corpo = ROTA_ADMIN.slice(i);
    expect(corpo.indexOf("if (!link)")).toBeLessThan(corpo.indexOf("enviarConviteDoPrograma("));
    expect(corpo).toContain("Link do programa da app");
  });

  it("as rotas do backoffice são só do administrador", () => {
    expect(ROTA_ADMIN).toContain("requireAdminGeral(req)");
    expect(ROTA_ADMIN).not.toMatch(/requireAdmin\(req\)/);
    expect(ler("src/app/api/admin/programa-da-app/link/route.ts")).toContain("requireAdminGeral(req)");
  });

  it("o link é o mesmo do convite de 01-11 (um link, um sítio)", () => {
    expect(ROTA_ADMIN).toContain("linkDeAdesaoGuardado()");
    expect(ler("src/app/api/admin/programa-da-app/link/route.ts")).toContain("guardarLinkDeAdesao(");
  });
});

describe("a cópia para a Play Console", () => {
  const lista = [
    { email: "ana@gmail.com", estado: "inscrito" },
    { email: "rui@gmail.com", estado: "adicionado" },
    { email: "eva@gmail.com", estado: "convidado" },
    { email: "zé@gmail.com", estado: "saiu" },
    { email: "ANA@gmail.com", estado: "inscrito" },
    { email: "bia@sapo.pt", estado: "inscrito" },
  ];

  it("leva só os inscritos, sem repetidos, separados por vírgulas", () => {
    expect(emailsPorAdicionar(lista)).toBe("ana@gmail.com, bia@sapo.pt");
  });

  it("sem inscritos, não leva nada", () => {
    expect(emailsPorAdicionar(lista.filter((l) => l.estado !== "inscrito"))).toBe("");
  });

  it("o painel copia por esta função", () => {
    expect(ler("src/components/admin/ProgramaDaAppPanel.tsx")).toContain("emailsPorAdicionar(");
  });
});

describe("apagar a conta apaga a inscrição", () => {
  it("o titular apaga a conta: sai na mesma transacção, pelo email e pelo id", () => {
    const i = DB.indexOf("export async function apagarContaDeCliente(");
    const corpo = semNotas(DB.slice(i, DB.indexOf("export async function apagarFotosDoBlob", i)));
    const chamada = corpo.indexOf("apagarInscricaoNaTransaccao(conn, alvo, contaIds)");
    expect(chamada).toBeGreaterThan(-1);
    // Antes do commit — dentro da transacção — e depois de saber os ids.
    expect(chamada).toBeLessThan(corpo.indexOf("await conn.commit()"));
    expect(chamada).toBeGreaterThan(corpo.indexOf("const contaIds"));
    const f = BASE.slice(BASE.indexOf("export async function apagarInscricaoNaTransaccao"));
    expect(f.slice(0, f.indexOf("\n}\n"))).toContain("DELETE FROM programaDaApp WHERE email = ? OR userId IN");
  });

  it("o administrador apaga a conta no backoffice: a inscrição dela sai também", () => {
    const rota = semNotas(ler("src/app/api/admin/users/route.ts"));
    const i = rota.indexOf("export async function DELETE(");
    expect(rota.slice(i, rota.indexOf("export async function PATCH", i))).toContain("apagarInscricoesDaConta(id)");
  });

  it("a purga tira quem saiu há mais de 30 dias e as inscrições sem conta", () => {
    const cron = ler("src/app/api/cron/purgar-pedidos/route.ts");
    expect(cron).toContain("purgarProgramaDaApp(DIAS_DO_PROGRAMA_DEPOIS_DE_SAIR, { aSerio: armada })");
    const f = BASE.slice(BASE.indexOf("export async function purgarProgramaDaApp"));
    const corpo = f.slice(0, f.indexOf("\n}\n"));
    expect(corpo).toContain("p.estado = 'saiu'");
    expect(corpo).toContain("u.deletedAt IS NOT NULL");
    // A seco só conta.
    expect(corpo).toContain("if (!aSerio)");
  });
});

describe("o selo das Contas", () => {
  it("os inscritos por adicionar acendem as Contas, só para o administrador", () => {
    const rota = ler("src/app/api/admin/novidades/route.ts");
    const i = rota.indexOf("contarInscritosPorAdicionar");
    expect(i).toBeGreaterThan(-1);
    expect(rota.slice(i, i + 300)).toContain("porFazer.contas");
    // Dentro do ramo do administrador.
    expect(rota.lastIndexOf('colab.papel === "admin"', i)).toBeGreaterThan(-1);
    expect(rota.indexOf("} else {", rota.lastIndexOf('colab.papel === "admin"', i))).toBeGreaterThan(i);
  });
});

describe("os textos", () => {
  const site = Object.values(TEXTOS_DO_CONVITE_NO_SITE).join(" ");
  const html = htmlDoConviteDoPrograma({ email: "ana@gmail.com", linkDeAdesao: "https://play.google.com/apps/testing/pt.clyon.cliente" });
  const texto = textoDoConviteDoPrograma({ email: "ana@gmail.com", linkDeAdesao: "https://play.google.com/apps/testing/pt.clyon.cliente" });

  it("no site, um convite — sem «beta» nem «teste»", () => {
    expect(site).not.toMatch(/beta|teste|inst[áa]vel/i);
    expect(site).toContain("acesso antecipado");
    expect(site).toContain("conta Google");
    expect(fraseDoEstadoNaConta(null, null)).toBe(TEXTOS_DO_CONVITE_NO_SITE.corpo);
  });

  it("o email: os dois passos, o email da conta Google, os dois links, e que pode sair — sem «beta»", () => {
    for (const t of [html, texto]) {
      expect(t).not.toMatch(/beta/i);
      expect(t).toContain("ana@gmail.com");
      expect(t).toContain("https://play.google.com/apps/testing/pt.clyon.cliente");
      expect(t).toContain(LINK_DA_PLAY_STORE);
      expect(t).toContain("Pode sair do programa quando quiser");
    }
    expect(texto).toMatch(/1\. No telemóvel Android/);
    expect(texto).toMatch(/2\. Instale a app/);
  });

  it("o link vem escapado no HTML", () => {
    const h = htmlDoConviteDoPrograma({ email: "a@b.pt", linkDeAdesao: 'https://play.google.com/x"><b>' });
    expect(h).not.toContain('"><b>');
  });
});
