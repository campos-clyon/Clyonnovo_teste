import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ASSUNTO_DO_CONVITE,
  csvParaAPlay,
  escolherDestinatarios,
  htmlDoConvite,
  linkDeAdesaoValido,
  primeiroNome,
  saudacao,
  textoDoConvite,
} from "./convite-app-cliente";

const LINK = "https://play.google.com/apps/testing/pt.clyon.cliente";

describe("o convite da app de cliente (texto aprovado à letra, 01-11-2026)", () => {
  it("assunto e corpo como o dono os escreveu", () => {
    expect(ASSUNTO_DO_CONVITE).toBe("Convite: experimente primeiro a app CLYON");
    expect(textoDoConvite({ nome: "ana maria silva", link: LINK })).toBe(
      [
        "Olá, Ana.",
        "",
        "Como já tem conta na CLYON, convidamo-lo a experimentar a nossa app antes de toda a gente. Pode pedir, acompanhar e pagar os seus pedidos no telemóvel, e falar com o parceiro verificado.",
        "",
        `1. Abra este link no telemóvel Android, com a mesma conta Google: ${LINK}`,
        "2. Carregue em «Tornar-me testador» e instale a app na Play Store.",
        "",
        "Fique com a app pelo menos 14 dias. A sua opinião ajuda-nos a melhorar.",
        "",
        "Se não quiser participar, basta ignorar este email; não voltamos a escrever sobre isto.",
        "",
        "Equipa CLYON",
      ].join("\n"),
    );
  });

  it("sem nome, «Olá,»", () => {
    expect(saudacao(null)).toBe("Olá,");
    expect(saudacao("   ")).toBe("Olá,");
    expect(saudacao("alguem@exemplo.invalid")).toBe("Olá,");
    expect(primeiroNome("João Pedro")).toBe("João");
  });

  it("o HTML leva o link como botão e escrito, e escapa o nome", () => {
    const html = htmlDoConvite({ nome: "<b>Rui</b>", link: LINK });
    expect(html.split(`href="${LINK}"`).length - 1).toBe(2);
    expect(html).toContain(`>${LINK}</a>`);
    expect(html).not.toContain("<b>Rui");
    expect(html).toContain("Equipa CLYON");
  });

  it("o link de adesão tem de ser da Google Play em https", () => {
    expect(linkDeAdesaoValido(LINK)).toBe(LINK);
    expect(linkDeAdesaoValido(`  ${LINK}  `)).toBe(LINK);
    expect(linkDeAdesaoValido("http://play.google.com/apps/testing/x")).toBeNull();
    expect(linkDeAdesaoValido("https://play.google.com.exemplo.invalid/x")).toBeNull();
    expect(linkDeAdesaoValido("")).toBeNull();
    expect(linkDeAdesaoValido(undefined)).toBeNull();
  });
});

describe("quem recebe o convite", () => {
  const conta = (id: number, o: Partial<{ name: string | null; email: string | null; role: string; deletedAt: unknown }> = {}) => ({
    id,
    name: "Cliente",
    email: `c${id}@exemplo.invalid`,
    role: "user",
    deletedAt: null,
    ...o,
  });

  it("só clientes activos, sem profissionais, sem teste, um por email", () => {
    const { destinatarios, deFora } = escolherDestinatarios(
      [
        conta(1),
        conta(2, { deletedAt: "2026-10-01" }),
        conta(3, { role: "admin" }),
        conta(4, { email: "pro@exemplo.invalid" }),
        conta(5, { email: "dono@exemplo.invalid" }),
        conta(6, { name: "Fred Teste" }),
        conta(7, { email: "C1@Exemplo.invalid" }),
        conta(8, { email: null }),
        conta(9, { name: "Celeste" }),
      ],
      ["PRO@exemplo.invalid "],
      ["dono@exemplo.invalid"],
    );
    expect(destinatarios.map((d) => d.id)).toEqual([1, 9]);
    expect(deFora).toEqual({
      desactivada: 1,
      "nao-e-cliente": 1,
      "sem-email": 1,
      profissional: 1,
      "de-teste": 2,
      "email-repetido": 1,
    });
  });

  it("a lista para a Play: só emails, sem cabeçalho", () => {
    expect(csvParaAPlay(["a@exemplo.invalid", "b@exemplo.invalid"])).toBe("a@exemplo.invalid\r\nb@exemplo.invalid\r\n");
    expect(csvParaAPlay([])).toBe("");
  });
});

describe("a rota nunca envia duas vezes e é só do administrador", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const rota = ler("src/app/api/admin/convite-app-cliente/route.ts");
  const base = ler("src/lib/convite-app-cliente-na-base.ts");

  it("só o administrador geral", () => {
    expect(rota).toMatch(/requireAdminGeral\(req\)/);
    expect(rota).not.toMatch(/\brequireAdmin\(req\)/);
  });

  it("reserva antes de enviar, e a base recusa a segunda linha", () => {
    expect(rota.indexOf("reservarConvite(")).toBeLessThan(rota.indexOf("enviarConviteDaApp({ para: d.email"));
    expect(base).toMatch(/userId\s+INT UNSIGNED NOT NULL PRIMARY KEY/);
    expect(base).toMatch(/UNIQUE KEY uq_convite_app_email \(email\)/);
    expect(base).toMatch(/INSERT IGNORE INTO convitesAppCliente/);
  });
});
