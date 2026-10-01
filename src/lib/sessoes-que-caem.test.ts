import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  contaActiva,
  eAdministradorNaBase,
  motivoParaRecusarSessao,
  tokenAnteriorATrocaDeSenha,
  FOLGA_DA_TROCA_DE_SENHA_SEGUNDOS,
} from "./conta-do-painel";
import { contaPodeEntrarNoPainel } from "./profissional-auth";
import { limitarPorConta } from "./limite-rota-publica";

/**
 * AS SESSÕES CAEM QUANDO A CONTA CAI.
 *
 * O cookie do profissional vale trinta dias e renova-se; o token do
 * administrador vale oito horas (trinta com «manter sessão»). Até
 * 30-09-2026, uma conta suspensa, desactivada ou com a palavra-passe mudada
 * continuava lá dentro até o token caducar: só a ENTRADA perguntava à base.
 */

const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const lerNu = (p: string) => semComentarios(ler(p));

function rotas(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...rotas(caminho));
    else if (nome === "route.ts") saida.push(caminho);
  }
  return saida;
}

describe("o administrador, confirmado na base", () => {
  it("é administrador pelo mesmo critério do login", () => {
    expect(eAdministradorNaBase({ isAdmin: 1, funcao: "admin" })).toBe(true);
    // As contas antigas gravadas só com a função — o login deixa-as entrar.
    expect(eAdministradorNaBase({ isAdmin: 0, funcao: "admin" })).toBe(true);
    expect(eAdministradorNaBase({ isAdmin: 0, funcao: "assistente" })).toBe(false);
    expect(eAdministradorNaBase({ isAdmin: null, funcao: "motorista" })).toBe(false);
  });

  it("só um 0 escrito desactiva", () => {
    expect(contaActiva({ active: 1 })).toBe(true);
    expect(contaActiva({ active: null })).toBe(true);
    expect(contaActiva({ active: 0 })).toBe(false);
  });

  it("recusa a conta apagada, despromovida ou desactivada", () => {
    const boa = { isAdmin: 1, funcao: "admin", active: 1, senhaAlteradaEm: null };
    expect(motivoParaRecusarSessao(boa, "admin", 1)).toBeNull();
    expect(motivoParaRecusarSessao(undefined, "admin", 1)).not.toBeNull();
    expect(motivoParaRecusarSessao({ ...boa, isAdmin: 0, funcao: "motorista" }, "admin", 1)).not.toBeNull();
    expect(motivoParaRecusarSessao({ ...boa, active: 0 }, "admin", 1)).not.toBeNull();
  });

  it("no assistente, o activo e as secções continuam a ser do assistentePorId", () => {
    const assistente = { isAdmin: 0, funcao: "assistente", active: 0, senhaAlteradaEm: null };
    // Não se decide aqui — duas regras para a mesma coisa acabavam por divergir.
    expect(motivoParaRecusarSessao(assistente, "assistente", 1)).toBeNull();
    expect(motivoParaRecusarSessao(undefined, "assistente", 1)).not.toBeNull();
  });
});

describe("mudar a palavra-passe fecha as sessões abertas", () => {
  const mudou = new Date("2026-09-30T10:00:00Z");
  const emSegundos = mudou.getTime() / 1000;

  it("um token de antes da troca deixa de valer", () => {
    expect(tokenAnteriorATrocaDeSenha(mudou, emSegundos - 3600)).toBe(true);
    const conta = { isAdmin: 1, funcao: "admin", active: 1, senhaAlteradaEm: mudou };
    expect(motivoParaRecusarSessao(conta, "admin", emSegundos - 3600)).not.toBeNull();
    expect(motivoParaRecusarSessao(conta, "assistente", emSegundos - 3600)).not.toBeNull();
  });

  it("o token novo, emitido logo a seguir, vale — com a folga do arredondamento", () => {
    expect(tokenAnteriorATrocaDeSenha(mudou, emSegundos)).toBe(false);
    expect(tokenAnteriorATrocaDeSenha(mudou, emSegundos + 60)).toBe(false);
    // O DATETIME arredonda ao segundo e o iat é truncado: um segundo antes ainda vale.
    expect(tokenAnteriorATrocaDeSenha(mudou, emSegundos - 1)).toBe(false);
    expect(tokenAnteriorATrocaDeSenha(mudou, emSegundos - FOLGA_DA_TROCA_DE_SENHA_SEGUNDOS - 1)).toBe(true);
  });

  it("sem troca registada, nada muda; sem iat, o token é de antes de qualquer troca", () => {
    expect(tokenAnteriorATrocaDeSenha(null, undefined)).toBe(false);
    expect(tokenAnteriorATrocaDeSenha(mudou, undefined)).toBe(true);
  });

  it("o login põe o iat, e a troca grava a hora", () => {
    const LOGIN = lerNu("src/app/api/colaboradores/login/route.ts");
    expect(LOGIN).toContain(".setIssuedAt()");
    const TROCA = lerNu("src/app/api/admin/seguranca/alterar-senha/route.ts");
    expect(TROCA).toContain("senhaAlteradaEm = ?");
    expect(TROCA).toContain("requireAdminGeral(request)");
  });

  it("a coluna nasce com as outras, e fica FORA do schema do drizzle", () => {
    const DB = ler("src/lib/db.ts");
    expect(DB).toMatch(/ALTER TABLE colaboradores ADD COLUMN senhaAlteradaEm DATETIME NULL/);
    // No drizzle, uma coluna que ainda não existisse partia o select() do login.
    expect(ler("drizzle/schema.ts")).not.toContain("senhaAlteradaEm");
  });
});

describe("todas as rotas do backoffice passam pela base", () => {
  it("o requireAdmin e o requireAdminGeral confirmam a conta", () => {
    const HELPER = lerNu("src/lib/admin-auth-helper.ts");
    expect(HELPER.match(/await contaAindaVale\(/g)?.length).toBe(2);
  });

  it("nenhuma rota verifica o token à mão", () => {
    const aMao = rotas(join(process.cwd(), "src", "app", "api"))
      .map((f) => ({ f, codigo: semComentarios(readFileSync(f, "utf8")) }))
      .filter(({ codigo }) => /verifyColaboradorAuthHeader|verifyColaboradorToken|jwtVerify\(/.test(codigo))
      .map(({ f }) => f.split("src")[1]);
    expect(aMao).toEqual([]);
  });

  it("a página «ver como o cliente» também confirma a conta", () => {
    const PAGINA = lerNu("src/app/admin/pedido/[id]/page.tsx");
    expect(PAGINA).toContain("contaDoPainelPorId(sessao.colab.id)");
    expect(PAGINA).toContain("motivoParaRecusarSessao(");
  });
});

describe("o profissional suspenso deixa de entrar com o cookie antigo", () => {
  it("o critério é o da entrada", () => {
    expect(contaPodeEntrarNoPainel({ estado: "aprovado", isActive: 1 })).toBe(true);
    expect(contaPodeEntrarNoPainel({ estado: "pendente", isActive: 1 })).toBe(true);
    expect(contaPodeEntrarNoPainel({ estado: "suspenso", isActive: 1 })).toBe(false);
    expect(contaPodeEntrarNoPainel({ estado: "aprovado", isActive: 0 })).toBe(false);
  });

  it("a sessão activa usa esse critério, e a entrada também", () => {
    const SESSAO = lerNu("src/lib/sessao-activa-do-profissional.ts");
    expect(SESSAO).toContain("contaPodeEntrarNoPainel(linhas[0])");
    expect(SESSAO).toContain("isClyon = 0");
    expect(lerNu("src/app/api/profissionais/entrar/route.ts")).toContain("contaPodeEntrarNoPainel(p)");
  });

  it("todas as rotas do painel que lêem o cookie usam a sessão activa", () => {
    const leem = rotas(join(process.cwd(), "src", "app", "api", "profissionais"))
      .map((f) => ({ f, codigo: semComentarios(readFileSync(f, "utf8")) }))
      .filter(({ codigo }) => codigo.includes("cookies.get(COOKIE_SESSAO_PROFISSIONAL)"));
    expect(leem.length).toBeGreaterThanOrEqual(14);
    for (const { f, codigo } of leem) {
      expect(codigo, f).toContain("sessaoActivaDoProfissional(");
      expect(codigo, f).not.toContain("verificarSessaoDoProfissional(");
    }
  });
});

describe("os limites contam a conta, e não só a máquina", () => {
  it("limitarPorConta trava a conta venha de onde vier, sem maiúsculas", async () => {
    const nome = `teste-conta-${Date.now()}`;
    expect((await limitarPorConta(nome, "Alguem@Exemplo.pt", 2, 60)).erro).toBeNull();
    expect((await limitarPorConta(nome, "alguem@exemplo.pt", 2, 60)).erro).toBeNull();
    const terceira = await limitarPorConta(nome, "ALGUEM@EXEMPLO.PT", 2, 60);
    expect(terceira.erro?.status).toBe(429);
    // Outra conta não é afectada.
    expect((await limitarPorConta(nome, "outra@exemplo.pt", 2, 60)).erro).toBeNull();
  });

  it("o link de entrada limita por email SEM o IP na chave", () => {
    const LINK = lerNu("src/app/api/entrada/link/route.ts");
    expect(LINK).toContain('limitarPorConta("entrada-link-email", email, 4, 900)');
    expect(LINK).not.toContain("entrada-link-email:${email}");
    // E a resposta continua a ser sempre a mesma.
    expect(LINK).toMatch(/if \(porEmail\.erro\) return sempreOMesmo;/);
  });

  it("o login do backoffice: Redis partilhado, por IP e por conta, e sem o Map em memória", () => {
    const LOGIN = lerNu("src/app/api/colaboradores/login/route.ts");
    expect(LOGIN).toContain("checkRateLimit(");
    expect(LOGIN).toContain("colaborador-login-ip:");
    expect(LOGIN).toContain('"colaborador-login-conta"');
    expect(LOGIN).toContain("TENTATIVAS_POR_IP = 10");
    expect(LOGIN).toContain("TENTATIVAS_POR_CONTA = 5");
    expect(LOGIN).toContain("status: 429");
    expect(LOGIN).not.toContain("new Map<");
  });

  it("a entrada do profissional junta o limite por email ao do IP", () => {
    const ENTRAR = lerNu("src/app/api/profissionais/entrar/route.ts");
    expect(ENTRAR).toContain("limitarRotaPublica(");
    expect(ENTRAR).toContain('limitarPorConta("profissional-entrar-email", email, 5, 900)');
  });
});

describe("o catch-all dos colaboradores deixou de verificar o token à mão", () => {
  it("passa pelo requireAdminGeral", () => {
    const ROTA = lerNu("src/app/api/colaboradores/[...path]/route.ts");
    expect(ROTA).toContain("requireAdminGeral(req)");
    expect(ROTA).not.toContain("jose");
  });
});
