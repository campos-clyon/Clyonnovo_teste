import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ASSUNTO_DO_CONVITE,
  PRE_CABECALHO_DO_CONVITE,
  REMETENTE_DA_APP_DE_CLIENTE,
  csvParaAPlay,
  escolherDestinatarios,
  htmlDoConvite,
  linkDeAdesaoValido,
  primeiroNome,
  saudacao,
  textoDoConvite,
} from "./convite-app-cliente";

const LINK = "https://play.google.com/apps/testing/pt.clyon.cliente";

describe("o convite novo da app de cliente (texto aprovado à letra, 17-11-2026)", () => {
  it("assunto, pré-cabeçalho e corpo como o dono os aprovou", () => {
    expect(ASSUNTO_DO_CONVITE).toBe("Tem Android? Ajude-nos a lançar a app CLYON (2 minutos)");
    expect(PRE_CABECALHO_DO_CONVITE).toBe("São 2 toques: o link e a instalação. Precisamos de 12 clientes.");
    expect(textoDoConvite({ nome: "ana maria silva", link: LINK })).toBe(
      [
        "Olá, Ana.",
        "Este convite é só para quem tem telemóvel Android (no iPhone ainda não há app).",
        "",
        "A app CLYON está quase pronta e precisamos de 12 clientes que a usem 14 dias para a Google Play a abrir a toda a gente. Como já fez um pedido connosco, gostávamos muito que fosse um deles.",
        "",
        "Com a app, no telemóvel:",
        "- faz um pedido com fotografias e vê as propostas dos parceiros;",
        "- acompanha o trabalho passo a passo, com as fotografias do parceiro;",
        "- vê quanto paga e paga ao parceiro (MB WAY ou transferência), sem andar à procura de mensagens;",
        "- fala connosco pelo WhatsApp ou dentro do próprio pedido.",
        "",
        "São 2 passos, menos de 2 minutos:",
        `1. No telemóvel, com o Gmail que usa na Play Store, toque em «Quero testar a app» (${LINK}) e carregue em «Tornar-me testador».`,
        "2. Instale a app CLYON na Play Store e abra-a. Fique com ela 14 dias e abra-a de vez em quando.",
        "",
        "O email onde recebeu esta mensagem não é o Gmail do seu telemóvel? Responda a este email só com esse Gmail e nós tratamos do resto.",
        "",
        "Obrigado por nos ajudar a pôr a CLYON no bolso de mais gente.",
        "",
        "Equipa CLYON",
        "",
        "Se não tiver Android ou não quiser participar, basta ignorar este email. Só lhe lembramos mais uma vez, daqui a 3 dias.",
      ].join("\n"),
    );
  });

  it("sem a linha dos avisos no telemóvel: a chave FCM V1 da app de cliente ainda não está na EAS", () => {
    expect(textoDoConvite({ nome: null, link: LINK })).not.toMatch(/recebe um aviso/);
    expect(htmlDoConvite({ nome: null, link: LINK })).not.toMatch(/recebe um aviso/);
  });

  it("o HTML leva o pré-cabeçalho escondido e o botão «Quero testar a app»", () => {
    const html = htmlDoConvite({ nome: "Ana", link: LINK });
    expect(html).toContain(PRE_CABECALHO_DO_CONVITE);
    expect(html).toMatch(/display:none[^>]*>São 2 toques/);
    expect(html).toMatch(/>\s*Quero testar a app\s*<\/a>/);
  });

  it("o convite e o lembrete saem de geral@clyon.pt", () => {
    expect(REMETENTE_DA_APP_DE_CLIENTE).toBe("CLYON <geral@clyon.pt>");
    const lerF = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    for (const f of ["src/lib/convite-app-cliente-envio.ts", "src/lib/seguimento-da-app-envio.ts"]) {
      const src = lerF(f);
      expect(src).toContain("from: REMETENTE_DA_APP_DE_CLIENTE,");
      expect(src).not.toContain("noreply@clyon.pt");
    }
  });

  it("sem nome, «Olá,»", () => {
    expect(saudacao(null)).toBe("Olá,");
    expect(saudacao("   ")).toBe("Olá,");
    expect(saudacao("alguem@exemplo.invalid")).toBe("Olá,");
    expect(primeiroNome("João Pedro")).toBe("João");
    expect(primeiroNome("ÉLIA SANTOS")).toBe("Élia");
    expect(primeiroNome("joão")).toBe("João");
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
