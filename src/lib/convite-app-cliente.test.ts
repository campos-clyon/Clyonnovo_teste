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

describe("o convite da app de cliente (v3 da d107, aprovada à letra a 24-11-2026)", () => {
  const NOSSO = "https://clyon.pt/app-cliente?c=AbCdEfGhIjKlMnOp";

  it("assunto, pré-cabeçalho e corpo como o dono os aprovou", () => {
    expect(ASSUNTO_DO_CONVITE).toBe("Os seus pedidos CLYON no telemóvel (Android)");
    expect(PRE_CABECALHO_DO_CONVITE).toBe("Peça, compare propostas e acompanhe o trabalho na app. Por agora só Android.");
    expect(textoDoConvite({ nome: "ana maria silva", link: NOSSO })).toBe(
      [
        "Olá, Ana.",
        "",
        "Já pode acompanhar os seus pedidos CLYON no telemóvel. Com a app:",
        "",
        "- faz um pedido com fotografias e recebe as propostas dos parceiros no mesmo sítio;",
        "- compara as propostas e escolhe com calma;",
        "- acompanha o trabalho passo a passo, com as fotografias do parceiro;",
        "- vê quanto paga e paga ao parceiro sem andar à procura de mensagens.",
        "",
        `Ver como instalar: ${NOSSO}`,
        "",
        "A ligação mostra o passo-a-passo, em menos de 2 minutos. Se alguma coisa não correr bem, diga-nos lá em que passo ficou e nós ajudamos.",
        "",
        "A app é opcional: no site faz tudo na mesma. Ainda está em teste na Google Play e, por agora, é só para Android.",
        "",
        "Equipa CLYON",
        "",
        `Não quero receber mensagens sobre a app: ${NOSSO}&r=3`,
      ].join("\n"),
    );
  });

  it("sem a linha dos avisos no telemóvel ([SÓ COM AVISOS]): a chave FCM V1 ainda não está confirmada", () => {
    expect(textoDoConvite({ nome: null, link: NOSSO })).not.toMatch(/recebe um aviso/);
    expect(htmlDoConvite({ nome: null, link: NOSSO })).not.toMatch(/recebe um aviso/);
  });

  it("o HTML leva o pré-cabeçalho escondido, o botão «Ver como instalar» e a recusa, sem píxel", () => {
    const html = htmlDoConvite({ nome: "Ana", link: NOSSO });
    expect(html).toMatch(/display:none[^>]*>Peça, compare propostas/);
    expect(html).toMatch(/>Ver como instalar<\/a>/);
    expect(html).toContain(`href="${NOSSO}&amp;r=3"`);
    expect(html).toContain(">Não quero receber mensagens sobre a app</a>");
    expect(html).not.toMatch(/<img/i);
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

  it("o HTML escapa o nome e assina pela Equipa CLYON", () => {
    const html = htmlDoConvite({ nome: "<b>Rui</b>", link: "https://clyon.pt/app-cliente?c=AbCdEfGhIjKlMnOp" });
    expect(html).not.toContain("<b>Rui");
    expect(html).toContain("Equipa CLYON");
  });

  it("a ligação de adesão tem de ser da Google Play em https", () => {
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

  it("só clientes ativos, sem profissionais, sem teste, um por email", () => {
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
