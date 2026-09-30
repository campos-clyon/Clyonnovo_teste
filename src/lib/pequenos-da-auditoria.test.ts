import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Os pontos pequenos da auditoria de 30-09-2026 — pequenos no tamanho da
 * correcção, não no que deixavam passar.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Só as chamadas ao console, cada uma inteira (podem ocupar várias linhas). */
function chamadasAoConsole(fonte: string): string[] {
  const codigo = semComentarios(fonte);
  const saida: string[] = [];
  const inicio = /console\.(log|warn|error|info)\(/g;
  let m: RegExpExecArray | null;
  while ((m = inicio.exec(codigo))) {
    let fundo = 0;
    let i = m.index + m[0].length - 1;
    for (; i < codigo.length; i++) {
      if (codigo[i] === "(") fundo++;
      else if (codigo[i] === ")" && --fundo === 0) break;
    }
    saida.push(codigo.slice(m.index, i + 1));
  }
  return saida;
}

describe("os registos do servidor não guardam contactos de clientes", () => {
  it("os emails do orçamento e do estado registam o pedido, e não o endereço", () => {
    for (const f of ["src/lib/email-orcamento.ts", "src/lib/email-status.ts"]) {
      const chamadas = chamadasAoConsole(ler(f));
      expect(chamadas.length, f).toBeGreaterThan(0);
      for (const c of chamadas) expect(c, f).not.toContain("params.to");
    }
  });

  it("o WhatsApp regista os três últimos algarismos, e não o número", () => {
    for (const c of chamadasAoConsole(ler("src/lib/whatsapp.ts"))) {
      expect(c).not.toMatch(/,\s*message\.to\s*\)/);
    }
    const repeticao = chamadasAoConsole(ler("src/lib/whatsapp-cloud.ts")).find((c) =>
      c.includes("engoli uma repetição"),
    );
    expect(repeticao).toBeDefined();
    expect(repeticao).not.toContain("${para}");
    expect(repeticao).not.toContain("texto.slice");
  });

  it("o número verdadeiro de um cliente saiu dos comentários", () => {
    // Montado aos bocados para este teste não ser ele próprio o sítio onde fica.
    const numero = ["337", "805", "82689"].join("");
    for (const f of ["ponte-whatsapp/index.js", "src/lib/assistente-fala-como-gente.test.ts"]) {
      expect(ler(f), f).not.toContain(numero);
    }
  });
});

describe("o .gitignore apanha todos os .env", () => {
  it("todos, menos o exemplo", () => {
    const linhas = ler(".gitignore").split(/\r?\n/).map((l) => l.trim());
    expect(linhas).toContain(".env*");
    expect(linhas).toContain("!.env.example");
    // A negação tem de vir DEPOIS da regra, senão é a regra que ganha.
    expect(linhas.indexOf("!.env.example")).toBeGreaterThan(linhas.indexOf(".env*"));
  });
});

describe("o link da palavra-passe de um profissional só vai para o administrador", () => {
  it("o assistente aprova, mas não recebe a chave da conta de outra pessoa", () => {
    const ROTA = semComentarios(ler("src/app/api/admin/profissionais/[id]/route.ts"));
    expect(ROTA).toContain('if (!conviteEnviado && colab.papel === "admin")');
    // E o painel diz-lhe o que fazer quando o email não sai.
    expect(ler("src/components/admin/AdminProfissionaisPanel.tsx")).toContain(
      "dados.conviteEnviado === false",
    );
  });
});
