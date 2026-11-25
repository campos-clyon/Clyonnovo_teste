import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A APP DE CLIENTE NÃO MUDA SEM NOTA — d5, 25-11-2026.
 *
 * A Action «Actualizar a app de cliente» recusa publicar sem nota nova, mas só
 * o diz depois de a «Verificar» passar: uma mudança em app-cliente/src sem
 * nota ficava verde e a recusa vinha tarde, já na main. Aqui chumba logo: se
 * o commit (ou os commits do push) muda app-cliente/src, a primeira nota da
 * lista «cliente» de notas-das-apps.json tem de ser nova nesse mesmo commit.
 *
 * Só olha para app-cliente/src: pacotes e lockfile não dizem nada à pessoa que
 * usa a app (e a fingerprint decide se chegam aos telemóveis).
 */

const RAIZ = process.cwd();
const NOTAS = "src/lib/notas-das-apps.json";
const PASTA = "app-cliente/src/";

type Notas = { cliente?: { id?: string }[] };

/** Erro em português, ou null se estiver tudo bem. */
function semNotaNova(alterados: string[], antes: Notas | null, agora: Notas | null): string | null {
  const mudouASrc = alterados.filter((f) => f.startsWith(PASTA));
  if (mudouASrc.length === 0) return null;
  const primeira = agora?.cliente?.[0]?.id;
  if (!primeira) return `app-cliente/src mudou (${mudouASrc[0]}…) e não há notas da app de cliente em ${NOTAS}.`;
  const jaExistia = (antes?.cliente ?? []).some((n) => n.id === primeira);
  if (jaExistia) {
    return `app-cliente/src mudou (${mudouASrc[0]}${mudouASrc.length > 1 ? ` e mais ${mudouASrc.length - 1}` : ""}) sem uma nota nova no mesmo commit: acrescente a nota da app de cliente em ${NOTAS} (a primeira «${primeira}» já existia).`;
  }
  return null;
}

describe("a app de cliente não muda sem nota nova", () => {
  const nota = (id: string) => ({ cliente: [{ id }] });
  it("sem mudanças em app-cliente/src, passa", () => {
    expect(semNotaNova(["app-cliente/package.json", "app-cliente/package-lock.json", "src/lib/x.ts"], nota("cliente-2026-11-20"), nota("cliente-2026-11-20"))).toBeNull();
  });
  it("mudança em app-cliente/src sem nota nova chumba", () => {
    expect(semNotaNova(["app-cliente/src/app/index.tsx"], nota("cliente-2026-11-20"), nota("cliente-2026-11-20"))).toMatch(/sem uma nota nova/);
  });
  it("mudança em app-cliente/src com nota nova passa", () => {
    const agora = { cliente: [{ id: "cliente-2026-11-25" }, { id: "cliente-2026-11-20" }] };
    expect(semNotaNova(["app-cliente/src/app/index.tsx"], nota("cliente-2026-11-20"), agora)).toBeNull();
  });
  it("nota só da app Pro não serve à de cliente", () => {
    const antes = { pro: [{ id: "pro-1" }], cliente: [{ id: "cliente-2026-11-20" }] };
    const agora = { pro: [{ id: "pro-2" }, { id: "pro-1" }], cliente: [{ id: "cliente-2026-11-20" }] };
    expect(semNotaNova(["app-cliente/src/a.ts"], antes, agora)).not.toBeNull();
  });
  it("sem notas da app de cliente chumba", () => {
    expect(semNotaNova(["app-cliente/src/a.ts"], null, {})).toMatch(/não há notas/);
  });
  it("primeira vez (sem notas antes) com nota passa", () => {
    expect(semNotaNova(["app-cliente/src/a.ts"], null, nota("cliente-2026-11-25"))).toBeNull();
  });

  it("neste commit, a regra cumpre-se", () => {
    const git = (args: string[]) => execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const existe = (r: string) => {
      try {
        git(["cat-file", "-e", `${r}^{commit}`]);
        return true;
      } catch {
        return false;
      }
    };
    // O push diz de onde veio (VERIFICAR_BASE = github.event.before); senão, o pai.
    const dado = (process.env.VERIFICAR_BASE ?? "").trim();
    const base = dado && !/^0+$/.test(dado) && existe(dado) ? dado : existe("HEAD~1") ? "HEAD~1" : null;
    if (!base) return; // clone raso sem pai: nada com que comparar
    // Mudanças por fazer (a árvore de trabalho) contam como parte do commit a vir.
    const alterados = git(["diff", "--name-only", base]).split("\n").map((s) => s.trim()).filter(Boolean);
    const agora = JSON.parse(readFileSync(join(RAIZ, NOTAS), "utf8")) as Notas;
    let antes: Notas | null = null;
    try {
      antes = JSON.parse(git(["show", `${base}:${NOTAS}`])) as Notas;
    } catch {
      antes = null;
    }
    expect(semNotaNova(alterados, antes, agora)).toBeNull();
  });
});
