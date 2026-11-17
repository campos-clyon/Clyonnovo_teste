import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fraseDoTrabalhoClyon,
  TRABALHO_CLYON_NO_NOVO_MODELO,
  TRABALHO_COM_PRECO_FECHADO,
} from "../../app-pro/src/lib/trabalhos";
import { falaDoModeloAntigo } from "./palavras-do-modelo-antigo";

/**
 * d54 (17-11-2026, CEO e dono) — A PARTE DAS APPS. Os Trabalhos CLYON criados a
 * partir do corte seguem o modelo de 15-11: o cliente paga ao parceiro, e o
 * profissional passa à CLYON a taxa da plataforma e o IVA dela pela referência
 * da confirmação. As apps decidem pelo que o servidor manda — a app Pro pelo
 * `noNovoModelo` de cada trabalho, a app de cliente pelo `pagamento` do
 * `fimClyon` (`pagaAoParceiro` / `aoParceiro`, ou a rota do «Pagar a …»).
 */
const cru = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

describe("d54 — a app CLYON Pro: o Trabalho CLYON do modelo novo", () => {
  it("sem o modelo novo do servidor, a frase de sempre", () => {
    expect(fraseDoTrabalhoClyon({})).toBe(TRABALHO_COM_PRECO_FECHADO);
    expect(fraseDoTrabalhoClyon({ noNovoModelo: false, aPassarAClyon: 12 })).toBe(TRABALHO_COM_PRECO_FECHADO);
  });

  it("no modelo novo: o cliente paga-lhe a ele, e passa à CLYON a taxa e o IVA dela pela referência da confirmação", () => {
    const f = fraseDoTrabalhoClyon({ noNovoModelo: true });
    expect(f).toBe(TRABALHO_CLYON_NO_NOVO_MODELO);
    expect(f).toContain("o cliente paga-lhe diretamente");
    expect(f).toContain("passa à CLYON a taxa da plataforma e o IVA dela");
    expect(f).toContain("referência que recebe na confirmação");
    expect(f).not.toMatch(/CLYON (fala com o cliente e )?paga-lhe/);
    expect(falaDoModeloAntigo(f, "todos")).toBeNull();
  });

  it("com o valor a passar à CLYON que a rota manda, o número ao lado", () => {
    const f = fraseDoTrabalhoClyon({ noNovoModelo: true, aPassarAClyon: 24.6 });
    expect(f).toMatch(/e o IVA dela \(24,60\s€\), com a referência/);
    expect(fraseDoTrabalhoClyon({ noNovoModelo: true, aPassarAClyon: null })).toBe(TRABALHO_CLYON_NO_NOVO_MODELO);
  });

  it("os dois ecrãs do Trabalho CLYON usam a frase pelo modelo, e nenhum a frase antiga directamente", () => {
    for (const f of ["app-pro/src/app/trabalho/[id].tsx", "app-pro/src/componentes/TrabalhoContratado.tsx"]) {
      const s = semNotas(f);
      expect(s, f).toContain("{fraseDoTrabalhoClyon(t)}");
      expect(s, f).not.toContain("{TRABALHO_COM_PRECO_FECHADO}");
    }
  });
});

describe("d54 — a app de cliente: o Trabalho CLYON do modelo novo paga-se ao parceiro", () => {
  const T = semNotas("app-cliente/src/componentes/TrabalhoClyon.tsx");

  it("o bloco «Pagar a …» das negociações, pelo que o servidor manda, e não para o convidado", () => {
    expect(T).toContain("<PagarAoParceiro");
    expect(T).toContain("negociacaoId={fim.negociacaoId}");
    expect(T).toContain("daR5={n.pagamento ? n.pagamento.aoParceiro : undefined}");
    expect(T).toContain("{!convidado ? ( <PagarAoParceiro");
    const V = semNotas("app-cliente/src/componentes/VistaDoPedido.tsx");
    expect(V).toContain("convidado={!!convidado}");
    expect(V).toContain("pedirComo={pedir}");
  });

  it("sem o resumo da referência da CLYON quando paga ao parceiro", () => {
    expect(T).toContain("{n.pagamento && !n.pagamento.pagaAoParceiro ? ( <Cartao> <ResumoDoPagamento");
  });

  it("sem «a CLYON guarda o pagamento» nem «paga ao parceiro depois»", () => {
    expect(T).not.toContain("guarda o acordo e o pagamento");
    expect(T).not.toContain("só paga ao parceiro");
    expect(falaDoModeloAntigo(T, "cliente")).toBeNull();
  });
});
