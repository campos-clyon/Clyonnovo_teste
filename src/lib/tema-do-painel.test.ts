import { describe, it, expect, afterEach, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  CHAVE_DO_TEMA,
  SCRIPT_DO_TEMA_DO_PAINEL,
  aplicarTema,
  guardarTema,
  lerTemaGuardado,
} from "./tema-do-painel";

/*
 * O MODO ESCURO DO PAINEL DO PROFISSIONAL — 03-10-2026.
 *
 * «Um botão na conta do pro para ele decidir se quer claro ou escuro quando
 * quiser.» O botão põe `data-tema="escuro"` no <html>, e o globals.css dá
 * outros valores às variáveis de onde as classes do Tailwind tiram a cor.
 *
 * O que isto guarda: que o botão está na conta, que o tema não sai do painel,
 * que vem antes de pintar, e — o que se estraga sem ninguém dar por isso — que
 * uma cor em hexadecimal nova num ecrã do painel não fica clara no escuro.
 */

const RAIZ = process.cwd();
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");

// Só o código: os comentários que começam a linha saem
// (`tirar-comentarios-sem-comer-codigo.test.ts`).
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

type Pagina = { atributos: Map<string, string>; caminho: string; guardado: string | null; armazenamentoFalha?: boolean };

/** Corre o script do <head> numa página de mentira. */
function correrScript(p: Pagina) {
  const location = { pathname: p.caminho };
  const localStorage = {
    getItem: (k: string) => {
      if (p.armazenamentoFalha) throw new Error("SecurityError");
      return k === CHAVE_DO_TEMA ? p.guardado : null;
    },
  };
  const document = { documentElement: { setAttribute: (k: string, v: string) => p.atributos.set(k, v) } };
  new Function("location", "localStorage", "document", SCRIPT_DO_TEMA_DO_PAINEL)(location, localStorage, document);
}

describe("o script do <head>", () => {
  const pagina = (caminho: string, guardado: string | null, armazenamentoFalha = false): Pagina => ({
    atributos: new Map(),
    caminho,
    guardado,
    armazenamentoFalha,
  });

  it("põe o escuro antes de pintar, no painel, a quem o escolheu", () => {
    const p = pagina("/profissionais/painel", "escuro");
    correrScript(p);
    expect(p.atributos.get("data-tema")).toBe("escuro");
  });

  it("e só no painel: o resto do site é sempre claro", () => {
    for (const caminho of ["/", "/profissionais", "/profissionais/entrar", "/admin", "/conta"]) {
      const p = pagina(caminho, "escuro");
      correrScript(p);
      expect(p.atributos.has("data-tema"), caminho).toBe(false);
    }
  });

  it("quem escolheu o claro, ou nunca escolheu, fica no claro", () => {
    for (const guardado of ["claro", null]) {
      const p = pagina("/profissionais/painel", guardado);
      correrScript(p);
      expect(p.atributos.has("data-tema")).toBe(false);
    }
  });

  it("sem armazenamento (navegação privada) não rebenta a página", () => {
    const p = pagina("/profissionais/painel", "escuro", true);
    expect(() => correrScript(p)).not.toThrow();
    expect(p.atributos.has("data-tema")).toBe(false);
  });

  it("vai no layout, logo a seguir ao do fuso, e o <html> não se queixa do atributo", () => {
    const layout = semNotas(ler("src/app/layout.tsx"));
    expect(layout).toContain("<script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA_DO_PAINEL }} />");
    expect(layout.indexOf("SCRIPT_DO_TEMA_DO_PAINEL }}")).toBeGreaterThan(layout.indexOf("SCRIPT_DO_FUSO_DE_LISBOA }}"));
    expect(layout).toMatch(/<html[^>]*suppressHydrationWarning/);
  });
});

describe("guardar, ler e aplicar", () => {
  afterEach(() => vi.unstubAllGlobals());

  function aparelho(falha = false) {
    const guardado = new Map<string, string>();
    const atributos = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => {
          if (falha) throw new Error("SecurityError");
          return guardado.get(k) ?? null;
        },
        setItem: (k: string, v: string) => {
          if (falha) throw new Error("QuotaExceededError");
          guardado.set(k, v);
        },
      },
    });
    vi.stubGlobal("document", {
      documentElement: {
        setAttribute: (k: string, v: string) => atributos.set(k, v),
        removeAttribute: (k: string) => atributos.delete(k),
      },
    });
    return { guardado, atributos };
  }

  it("a escolha fica no aparelho e volta na visita seguinte", () => {
    const { guardado } = aparelho();
    expect(lerTemaGuardado()).toBe("claro");
    guardarTema("escuro");
    expect(guardado.get(CHAVE_DO_TEMA)).toBe("escuro");
    expect(lerTemaGuardado()).toBe("escuro");
  });

  it("o atributo põe-se e tira-se — e `null` tira-o ao sair do painel", () => {
    const { atributos } = aparelho();
    aplicarTema("escuro");
    expect(atributos.get("data-tema")).toBe("escuro");
    aplicarTema("claro");
    expect(atributos.has("data-tema")).toBe(false);
    aplicarTema("escuro");
    aplicarTema(null);
    expect(atributos.has("data-tema")).toBe(false);
  });

  it("sem armazenamento, fica o claro e nada rebenta", () => {
    aparelho(true);
    expect(lerTemaGuardado()).toBe("claro");
    expect(() => guardarTema("escuro")).not.toThrow();
  });
});

describe("o botão, na conta dele", () => {
  const PAINEL = semNotas(ler("src/app/profissionais/painel/PainelDoProfissional.tsx"));
  const BOTAO = semNotas(ler("src/app/profissionais/painel/InterruptorDoTema.tsx"));

  it("está no grupo «A minha conta»", () => {
    const inicio = PAINEL.indexOf('<GrupoDeLinhas titulo="A minha conta"');
    expect(inicio).toBeGreaterThan(-1);
    const grupo = PAINEL.slice(inicio, PAINEL.indexOf("</GrupoDeLinhas>", inicio));
    expect(grupo).toContain("<InterruptorDoTema tema={tema} onMudar={mudarTema} />");
  });

  it("muda, guarda e aplica de uma vez — e ao sair do painel o tema sai com ele", () => {
    const mudar = PAINEL.slice(PAINEL.indexOf("function mudarTema("), PAINEL.indexOf("function mudarTema(") + 200);
    for (const passo of ["setTema(novo)", "guardarTema(novo)", "aplicarTema(novo)"]) expect(mudar).toContain(passo);
    expect(PAINEL).toContain("return () => aplicarTema(null);");
  });

  it("é um interruptor para o leitor de ecrã, e a linha inteira carrega", () => {
    expect(BOTAO).toContain('role="switch"');
    expect(BOTAO).toContain("aria-checked={escuro}");
    expect(BOTAO).toMatch(/<button[\s\S]*?onClick=\{\(\) => onMudar\(escuro \? "claro" : "escuro"\)\}/);
  });
});

/* ------------------------------------------------------------------------ */

const CSS = ler("src/app/globals.css");
const REGRAS = CSS.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "");

/** O corpo do bloco `html[data-tema="escuro"] { … }` das variáveis. */
const inicioDoBloco = REGRAS.indexOf('html[data-tema="escuro"] {');
const VARIAVEIS = REGRAS.slice(inicioDoBloco, REGRAS.indexOf("}", inicioDoBloco));
const valorDe = (v: string) => VARIAVEIS.match(new RegExp(`${v}:\\s*([^;]+);`))?.[1].trim();

describe("⚠️ o escuro no globals.css", () => {
  it("é um bloco fora de camada, que dá outro valor ao branco e aos tokens", () => {
    expect(inicioDoBloco).toBeGreaterThan(-1);
    // Dentro de uma camada perdia para o `@layer theme` do Tailwind.
    const antes = REGRAS.slice(0, inicioDoBloco);
    const abertas = (antes.match(/\{/g) ?? []).length - (antes.match(/\}/g) ?? []).length;
    expect(abertas).toBe(0);
    expect(VARIAVEIS).toContain("color-scheme: dark");
    for (const v of ["--background", "--foreground", "--color-white", "--color-tinta", "--color-tinta-fraca", "--color-fundo-alt", "--color-borda", "--color-acao", "--color-acao-hover", "--color-erro"]) {
      expect(valorDe(v), v).toBeDefined();
    }
    // A marca e o verde do WhatsApp são os mesmos nos dois.
    expect(valorDe("--color-marca")).toBeUndefined();
    expect(valorDe("--color-whatsapp")).toBeUndefined();
  });

  it("vira todas as escalas do Tailwind ao contrário — e o 500 fica", () => {
    const theme = readFileSync(join(RAIZ, "node_modules/tailwindcss/theme.css"), "utf8");
    const original = (p: string, s: string) => theme.match(new RegExp(`--color-${p}-${s}:\\s*([^;]+);`))?.[1].trim();
    const par: Record<string, string> = { 50: "950", 100: "900", 200: "800", 300: "700", 400: "600", 600: "400", 700: "300", 800: "200", 900: "100", 950: "50" };
    const cromaticas = ["red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"];
    for (const p of cromaticas) {
      for (const [s, oposto] of Object.entries(par)) {
        expect(valorDe(`--color-${p}-${s}`), `${p}-${s}`).toBe(original(p, oposto));
      }
      expect(valorDe(`--color-${p}-500`), `${p}-500`).toBeUndefined();
    }
  });

  it("e os cinzentos têm escala sua, do escuro para o claro, sem buracos", () => {
    for (const p of ["slate", "gray", "zinc", "neutral", "stone"]) {
      const passos = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"].map((s) => valorDe(`--color-${p}-${s}`));
      expect(passos.every(Boolean), p).toBe(true);
      // Cada passo mais claro do que o anterior, do 100 para cima (o 50 é o
      // fundo rebaixado, abaixo do cartão).
      const brilho = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
      for (let i = 2; i < passos.length; i++) expect(brilho(passos[i]!), `${p} ${i}`).toBeGreaterThan(brilho(passos[i - 1]!));
    }
  });

  it("os botões que o ficheiro pinta de branco à força levam a letra do cartão", () => {
    for (const s of ['html[data-tema="escuro"] a.bg-acao', 'html[data-tema="escuro"] button.bg-acao', 'html[data-tema="escuro"] button[class~="bg-cyan-600"]']) {
      const i = REGRAS.indexOf(s);
      expect(i, s).toBeGreaterThan(-1);
      expect(REGRAS.slice(i, REGRAS.indexOf("}", i)), s).toMatch(/color:\s*var\(--color-white\)\s*!important;/);
    }
  });
});

/* ------------------------------------------------------------------------ */

/**
 * Os ficheiros que o painel abre, a partir do próprio painel e do menu do
 * site que vai por cima dele: os imports locais, seguidos até ao fim.
 */
function ficheirosDoPainel(): string[] {
  const visto = new Set<string>();
  const fila = ["src/app/profissionais/painel/PainelDoProfissional.tsx", "src/components/Header.tsx"].map((f) => join(RAIZ, f));
  while (fila.length) {
    const f = fila.pop()!;
    if (visto.has(f)) continue;
    visto.add(f);
    const texto = readFileSync(f, "utf8");
    for (const m of texto.matchAll(/(?:import|export)[^"';]*?from\s*["']([^"']+)["']/g)) {
      const esp = m[1];
      const base = esp.startsWith("@/") ? join(RAIZ, "src", esp.slice(2)) : esp.startsWith(".") ? resolve(dirname(f), esp) : null;
      if (!base) continue;
      const achado = [".tsx", ".ts", "/index.tsx", "/index.ts"].map((e) => base + e).find((c) => existsSync(c));
      if (achado) fila.push(achado);
    }
  }
  return [...visto].map((f) => relative(RAIZ, f).replace(/\\/g, "/"));
}

/*
 * As cores em hexadecimal que podem ficar como estão: a marca e o verde do
 * WhatsApp (iguais nos dois temas), o ponto ciano da agenda, e as classes do
 * tema ESCURO da grelha — que é o do backoffice, e não aparece no painel.
 */
const FICAM = new Set(["#00B4CC", "#25D366", "#20BD5A", "#06B6D4"]);
const SO_DA_GRELHA_ESCURA = new Set([
  "bg-[#22D3EE]",
  "text-[#020617]",
  "bg-[#22D3EE]/15",
  "text-[#A5F3FC]",
  "ring-[#22D3EE]/60",
  "bg-[#06B6D4]/15",
  "text-[#ECFEFF]",
]);

/** `active:bg-[#E2EEF3]` → `.active\:bg-\[\#E2EEF3\]`, como o Tailwind o escreve. */
const selectorDe = (classe: string) => "." + classe.replace(/[[\]#:/.]/g, (c) => "\\" + c);

describe("⚠️ as cores em hexadecimal dos ecrãs do painel", () => {
  const FICHEIROS = ficheirosDoPainel();
  const classes = new Map<string, string>();
  for (const f of FICHEIROS) {
    for (const m of ler(f).matchAll(/(?<![\w-])((?:[a-z-]+:)*(?:bg|text|border|ring|fill|stroke|from|via|to|outline|divide)-\[#[0-9A-Fa-f]{3,8}\](?:\/\d+)?)/g)) {
      if (!classes.has(m[1])) classes.set(m[1], f);
    }
  }

  it("o caminho pelos imports encontra os ecrãs (sanidade)", () => {
    for (const f of ["src/app/profissionais/painel/Trabalhos.tsx", "src/app/profissionais/painel/Perfil.tsx", "src/components/GrelhaDeAgenda.tsx", "src/lib/agenda-em-grelha.ts", "src/components/HeaderLocationSelector.tsx"]) {
      expect(FICHEIROS, f).toContain(f);
    }
    expect(classes.size).toBeGreaterThan(10);
  });

  it("cada uma tem a sua versão escura no globals.css — ou é das que ficam", () => {
    // Um hexadecimal não lê variável nenhuma: sem uma regra no escuro, um
    // `text-[#0B1929]` novo é texto quase preto sobre o cartão escuro.
    const faltam: string[] = [];
    for (const [classe, f] of classes) {
      const hex = classe.match(/#[0-9A-Fa-f]+/)![0].toUpperCase();
      if (FICAM.has(hex) || SO_DA_GRELHA_ESCURA.has(classe)) continue;
      if (!REGRAS.includes(`html[data-tema="escuro"] ${selectorDe(classe)}`)) faltam.push(`${classe}  (${f})`);
    }
    expect(faltam).toEqual([]);
  });

  it("e a grelha escura continua só no backoffice: a agenda do painel é a clara", () => {
    const agenda = semNotas(ler("src/app/profissionais/painel/Agenda.tsx"));
    expect(agenda).toContain("<GrelhaDeAgenda");
    expect(agenda).not.toMatch(/tema="escuro"/);
  });
});
