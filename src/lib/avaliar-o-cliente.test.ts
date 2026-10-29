import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lerAvaliacaoDoProfissional, podeAvaliarOCliente } from "./avaliacoes-do-cliente";
import { deveProcurar, ECRAS_QUE_ESPERAM, INTERVALO_MINIMO_MS, podeRecarregarAgora } from "../../app-pro/src/lib/actualizacoes";

/**
 * O PROFISSIONAL AVALIA O CLIENTE, E A APP PRO ACTUALIZA-SE SOZINHA — ordem do
 * CEO com o sim do dono, 29-10-2026.
 */
const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

const feito = {
  providerId: 7,
  estado: "acordada",
  execucaoEnviadaEm: "2026-10-29 10:00:00",
  confirmadoEm: null,
  pagoEm: null,
  contactEmail: "cliente@exemplo.pt",
};

describe("o profissional avalia o cliente", () => {
  it("só o profissional do trabalho, com o trabalho feito ou confirmado", () => {
    expect(podeAvaliarOCliente(feito, 7)).toBe(true);
    expect(podeAvaliarOCliente(feito, 8)).toBe(false);
    expect(podeAvaliarOCliente({ ...feito, execucaoEnviadaEm: null }, 7)).toBe(false);
    expect(podeAvaliarOCliente({ ...feito, execucaoEnviadaEm: null, confirmadoEm: "2026-10-29 12:00:00" }, 7)).toBe(true);
    expect(podeAvaliarOCliente({ ...feito, estado: "desistida" }, 7)).toBe(false);
    expect(podeAvaliarOCliente({ ...feito, contactEmail: null }, 7)).toBe(false);
    expect(podeAvaliarOCliente(null, 7)).toBe(false);
  });

  it("de 1 a 5 estrelas inteiras, comentário opcional até 500", () => {
    expect(lerAvaliacaoDoProfissional({ estrelas: 5, comentario: "  Simpático e pontual. " })).toEqual({ estrelas: 5, comentario: "Simpático e pontual." });
    expect(lerAvaliacaoDoProfissional({ estrelas: 3 })).toEqual({ estrelas: 3, comentario: null });
    for (const e of [0, 6, 2.5, "x", null]) expect(lerAvaliacaoDoProfissional({ estrelas: e })).toEqual({ erro: "Escolha de 1 a 5 estrelas." });
    expect("erro" in lerAvaliacaoDoProfissional({ estrelas: 4, comentario: "a".repeat(501) })).toBe(true);
  });

  it("uma por trabalho e não se altera: chave única e INSERT IGNORE, 409 na segunda", () => {
    const lib = ler("src/lib/avaliacoes-do-cliente.ts");
    expect(lib).toContain("UNIQUE KEY uniq_negociacao (negociacaoId)");
    expect(lib).toContain("INSERT IGNORE INTO avaliacoesAoCliente");
    expect(lib).not.toMatch(/UPDATE avaliacoesAoCliente|ON DUPLICATE KEY UPDATE/);
    const rota = ler("src/app/api/profissionais/trabalho/avaliar-cliente/route.ts");
    expect(rota).toContain('{ error: "Já avaliou este cliente." }, { status: 409 }');
    expect(rota).toContain("Number(n.providerId) !== sessao.providerId");
    expect(rota).toContain("tokenDoProfissional(req)");
  });

  it("o profissional não vê as estrelas que deu: o GET só diz se pode e se já avaliou", () => {
    const rota = ler("src/app/api/profissionais/trabalho/avaliar-cliente/route.ts");
    const get = rota.slice(rota.indexOf("export async function GET"), rota.indexOf("export async function POST"));
    expect(get).toContain("{ ok: true, podeAvaliar:");
    expect(get).not.toMatch(/estrelas|comentario/);
    for (const f of ["src/app/profissionais/painel/AvaliarOCliente.tsx", "app-pro/src/componentes/AvaliarOCliente.tsx"]) {
      const s = ler(f);
      expect(s, f).toContain("Avaliação do cliente enviada. Obrigado.");
      expect(s, f).toContain("/api/profissionais/trabalho/avaliar-cliente");
    }
  });

  it("aparece no painel e na app Pro depois de o trabalho estar feito", () => {
    expect(ler("src/app/profissionais/painel/Trabalhos.tsx")).toMatch(
      /\(pedido\.execucaoEnviadaEm \|\| pedido\.confirmadoEm \|\| pedido\.pagoEm\) && pedido\.negociacaoId \? \(\s*<AvaliarOCliente negociacaoId=\{pedido\.negociacaoId\} \/>/,
    );
    const pro = ler("app-pro/src/componentes/TrabalhoContratado.tsx");
    const terminado = pro.slice(pro.indexOf('if (t.fase !== "a_executar")'), pro.indexOf("<OTrabalhoESeu t={t} />"));
    expect(terminado).toContain("<AvaliarOCliente negociacaoId={t.negociacaoId} />");
  });
});

describe("a app Pro actualiza-se sozinha, sem perder uma proposta a meio", () => {
  it("aplica na lista e na agenda; espera no trabalho, na carteira, na conta e na entrada", () => {
    expect(podeRecarregarAgora(["(app)"])).toBe(true);
    expect(podeRecarregarAgora(["(app)", "agenda"])).toBe(true);
    for (const s of [["trabalho", "[id]"], ["abrir", "[token]"], ["(app)", "carteira"], ["conta", "perfil"], ["entrar"]]) {
      expect(podeRecarregarAgora(s), s.join("/")).toBe(false);
    }
    expect(ECRAS_QUE_ESPERAM).toContain("definir-senha");
    expect(deveProcurar(0, INTERVALO_MINIMO_MS - 1)).toBe(false);
  });

  it("procura ao abrir e ao voltar, descarrega e recarrega; está na raiz", () => {
    const c = ler("app-pro/src/componentes/ActualizacaoAutomatica.tsx");
    for (const s of ["Updates.checkForUpdateAsync()", "Updates.fetchUpdateAsync()", "Updates.reloadAsync()", 'AppState.addEventListener("change"', "isUpdatePending"]) expect(c).toContain(s);
    expect(ler("app-pro/src/app/_layout.tsx")).toContain("<ActualizacaoAutomatica />");
  });
});
