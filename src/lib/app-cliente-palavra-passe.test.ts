import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONFIRME_PRIMEIRO,
  CONTA_CRIADA,
  criarConta,
  emailValido,
  entrarComPalavraPasse,
  LINK_DE_REPOR_ENVIADO,
  pedirNovaPalavraPasse,
  porConfirmar,
  ROTA_DA_PALAVRA_PASSE,
  ROTA_DO_ESQUECI,
  ROTA_DO_REGISTO,
  ROTA_DA_PALAVRA_PASSE_DA_CONTA,
  temPalavraPasse,
  gravarPalavraPasse,
} from "../../app-cliente/src/lib/entrada";
import { ErroDaApi, type OpcoesDoPedido, type Pedir } from "../../app-cliente/src/lib/erros";

/**
 * A APP DE CLIENTE COM EMAIL E PALAVRA-PASSE (dono, 01-11-2026: a Google Play
 * pede uma conta para o revisor). Ao lado do Google e do link — não em vez deles.
 */

const APP = join(__dirname, "../../app-cliente");
const ler = (p: string) => readFileSync(join(APP, p), "utf8");

function siteDeMentira(resposta: (caminho: string, o: OpcoesDoPedido) => unknown) {
  const chamadas: Array<{ caminho: string; o: OpcoesDoPedido }> = [];
  const pedir = (async (caminho: string, o: OpcoesDoPedido = {}) => {
    chamadas.push({ caminho, o });
    return resposta(caminho, o);
  }) as Pedir;
  return { pedir, chamadas };
}

describe("as rotas do site, à letra do contrato", () => {
  it("entrar: POST /api/entrada/palavra-passe {email, palavraPasse, app: true}, sem sessão; a sessão fica como a do Google", async () => {
    const { pedir, chamadas } = siteDeMentira(() => ({ token: "t".repeat(40), email: " Ana@Exemplo.PT ", expiraEm: "2026-12-01T00:00:00Z" }));
    const s = await entrarComPalavraPasse({ pedir, email: " Ana@Exemplo.pt ", palavraPasse: " com espaços " });
    expect(ROTA_DA_PALAVRA_PASSE).toBe("/api/entrada/palavra-passe");
    expect(chamadas).toEqual([
      { caminho: ROTA_DA_PALAVRA_PASSE, o: { metodo: "POST", corpo: { email: "ana@exemplo.pt", palavraPasse: " com espaços ", app: true }, semSessao: true } },
    ]);
    expect(s).toEqual({ token: "t".repeat(40), email: "ana@exemplo.pt", expiraEm: "2026-12-01T00:00:00Z", entrada: "palavra-passe" });
  });

  it("entrar: uma resposta sem token não abre sessão", async () => {
    const { pedir } = siteDeMentira(() => ({ ok: true }));
    await expect(entrarComPalavraPasse({ pedir, email: "a@b.pt", palavraPasse: "x" })).rejects.toBeInstanceOf(ErroDaApi);
  });

  it("«por-confirmar» reconhece-se venha no motivo ou no erro; os outros erros mostram a frase do servidor", () => {
    expect(porConfirmar(new ErroDaApi("Confirme o email.", 403, { motivo: "por-confirmar" }))).toBe(true);
    expect(porConfirmar(new ErroDaApi("Confirme o email.", 403, { erro: "por-confirmar" }))).toBe(true);
    expect(porConfirmar(new ErroDaApi("Email ou palavra-passe errados.", 401, { motivo: "errada" }))).toBe(false);
    expect(porConfirmar(new Error("x"))).toBe(false);
    expect(CONFIRME_PRIMEIRO).toBe("Confirme primeiro o seu email (enviámos de novo).");
  });

  it("criar conta: POST /api/entrada/registo {nome, email, palavraPasse}; a frase é sempre a mesma", async () => {
    const { pedir, chamadas } = siteDeMentira(() => ({ ok: true, mensagem: "outra coisa" }));
    const frase = await criarConta({ pedir, nome: "  Ana  ", email: "ANA@exemplo.pt", palavraPasse: "segredo123" });
    expect(ROTA_DO_REGISTO).toBe("/api/entrada/registo");
    expect(chamadas[0]).toEqual({
      caminho: ROTA_DO_REGISTO,
      o: { metodo: "POST", corpo: { nome: "Ana", email: "ana@exemplo.pt", palavraPasse: "segredo123" }, semSessao: true },
    });
    expect(frase).toBe(CONTA_CRIADA);
    expect(CONTA_CRIADA).toBe(
      "Enviámos um email para confirmar a conta. Depois de confirmar, entre aqui com o email e a palavra-passe.",
    );
  });

  it("esqueci-me: POST /api/entrada/esqueci {email}; mostra a frase do servidor", async () => {
    const { pedir, chamadas } = siteDeMentira(() => ({ ok: true, mensagem: "A frase do site." }));
    expect(await pedirNovaPalavraPasse({ pedir, email: " Ana@exemplo.pt" })).toBe("A frase do site.");
    expect(ROTA_DO_ESQUECI).toBe("/api/entrada/esqueci");
    expect(chamadas[0]).toEqual({ caminho: ROTA_DO_ESQUECI, o: { metodo: "POST", corpo: { email: "ana@exemplo.pt" }, semSessao: true } });
    const semFrase = siteDeMentira(() => ({ ok: true }));
    expect(await pedirNovaPalavraPasse({ pedir: semFrase.pedir, email: "a@b.pt" })).toBe(LINK_DE_REPOR_ENVIADO);
  });

  it("o Perfil: GET/POST /api/conta/palavra-passe com a sessão; a actual só vai quando a conta já tem uma", async () => {
    const { pedir, chamadas } = siteDeMentira((_c, o) => (o.metodo === "POST" ? { ok: true, temPalavraPasse: true } : { ok: true, temPalavraPasse: false }));
    expect(ROTA_DA_PALAVRA_PASSE_DA_CONTA).toBe("/api/conta/palavra-passe");
    expect(await temPalavraPasse(pedir)).toBe(false);
    await gravarPalavraPasse({ pedir, nova: "nova-palavra-1" });
    await gravarPalavraPasse({ pedir, nova: "nova-palavra-2", actual: "antiga-123" });
    expect(chamadas).toEqual([
      { caminho: ROTA_DA_PALAVRA_PASSE_DA_CONTA, o: {} },
      { caminho: ROTA_DA_PALAVRA_PASSE_DA_CONTA, o: { metodo: "POST", corpo: { nova: "nova-palavra-1" } } },
      { caminho: ROTA_DA_PALAVRA_PASSE_DA_CONTA, o: { metodo: "POST", corpo: { nova: "nova-palavra-2", actual: "antiga-123" } } },
    ]);
    // Com sessão: nenhuma destas vai sem o Bearer.
    for (const c of chamadas) expect(c.o.semSessao).toBeUndefined();
    const rota = readFileSync(join(__dirname, "../app/api/conta/palavra-passe/route.ts"), "utf8");
    expect(rota).toContain("temPalavraPasse");
    expect(rota).toContain("corpo?.nova");
    expect(ler("src/app/(app)/perfil.tsx")).toContain("<PalavraPasseDaConta />");
  });

  it("o email tem de ter forma de email", () => {
    expect(emailValido(" a@b.pt ")).toBe(true);
    expect(emailValido("a@b")).toBe(false);
    expect(emailValido("")).toBe(false);
  });
});

describe("o ecrã de entrada", () => {
  const ENTRADA = ler("src/componentes/Entrada.tsx");
  const SESSAO = ler("src/estado/Sessao.tsx");
  const PERFIL = ler("src/app/(app)/perfil.tsx");

  it("o Google e o link continuam lá; a palavra-passe é a forma por omissão", () => {
    expect(ENTRADA).toContain("Continuar com o Google");
    expect(ENTRADA).toContain("Enviar link de entrada");
    expect(ENTRADA).toContain('useState<ModoDaEntrada>("palavra-passe")');
    for (const t of ["Esqueci-me da palavra-passe", "Criar conta", "Prefiro receber um link por email", "Entrar com a palavra-passe"]) {
      expect(ENTRADA).toContain(t);
    }
    expect(ENTRADA).toContain("secureTextEntry={!ver}");
  });

  it("entrar com a palavra-passe abre a sessão pelo mesmo caminho do Google, e depois segue para onde ia", () => {
    expect(ENTRADA).toContain("const sessao = await entrarComPalavraPasse({ pedir, email, palavraPasse });");
    expect(ENTRADA).toContain("await entrarComSessaoNova(sessao);");
    expect(ENTRADA).toContain("if (entrou) aoEntrar?.();");
    expect(ENTRADA).toContain("if (porConfirmar(e)) setAviso(mensagemDe(e, CONFIRME_PRIMEIRO));");
  });

  it("a sessão lembra-se de que se entrou com a palavra-passe, e o Perfil di-lo", () => {
    expect(SESSAO).toContain('e === "palavra-passe"');
    expect(PERFIL).toContain("Entrou com o email e a palavra-passe");
  });

  it("o mínimo da palavra-passe é o do site, sem número próprio", () => {
    expect(ENTRADA).toContain('import { MINIMO_DA_PALAVRA_PASSE } from "../../../src/lib/palavra-passe-minima";');
    expect(ENTRADA).not.toMatch(/const MINIMO_DA_PALAVRA_PASSE\s*=/);
  });

  it("a recusa «por-confirmar» do site é a que a app reconhece", () => {
    const rota = readFileSync(join(__dirname, "../app/api/entrada/palavra-passe/route.ts"), "utf8");
    expect(rota).toContain('codigo: "por-confirmar"');
    expect(rota).toContain('entrada: "palavra-passe"');
    expect(porConfirmar(new ErroDaApi("x", 403, { ok: false, codigo: "por-confirmar" }))).toBe(true);
  });

  it("ao cliente diz-se «parceiro», nunca «profissional»", () => {
    expect(ENTRADA.toLowerCase()).not.toContain("profissiona");
  });
});
