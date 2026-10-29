import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TEXTOS_DA_ALTERACAO,
  alteracoesParaAApp,
  avisoDaAlteracaoAoContacto,
  faseDaAlteracao,
  lerAlteracao,
  oQueMudou,
} from "./alteracoes-do-cliente";

/** S17 — as alterações do cliente (29-10-2026; R14, R17–R19; critérios 42–44). */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
// 10:00 em Lisboa a 29-10-2026.
const AGORA = new Date("2026-10-29T10:00:00Z");

describe("a leitura do corpo (R14, R17, R18)", () => {
  it("um campo fora da lista recusa tudo (critério 43)", () => {
    for (const k of ["telefone", "email", "morada", "nif", "precisaFatura", "valorDesejado", "descricao", "serviceType"]) {
      const r = lerAlteracao({ [k]: "x", pormenores: "Mais uma cadeira." }, AGORA);
      expect(r.ok, k).toBe(false);
    }
  });

  it("o dia: de amanhã em diante, em Lisboa, até 6 meses", () => {
    expect(lerAlteracao({ dataPreferida: "2026-10-29" }, AGORA).ok).toBe(false);
    expect(lerAlteracao({ dataPreferida: "2027-06-01" }, AGORA).ok).toBe(false);
    expect(lerAlteracao({ dataPreferida: "2026-11-02" }, AGORA)).toEqual({ ok: true, alteracao: { dataPreferida: "2026-11-02" } });
  });

  it("fotografias só do nosso armazenamento; pormenores até 1000 letras; acesso só com os valores conhecidos", () => {
    expect(lerAlteracao({ fotografias: ["https://outro.exemplo/x.jpg"] }, AGORA).ok).toBe(false);
    expect(lerAlteracao({ fotografias: ["https://a.public.blob.vercel-storage.com/x.jpg"] }, AGORA).ok).toBe(true);
    expect(lerAlteracao({ pormenores: "x".repeat(1001) }, AGORA).ok).toBe(false);
    expect(lerAlteracao({ acesso: { floor: "3", hasElevator: "no" } }, AGORA).ok).toBe(true);
    expect(lerAlteracao({ acesso: { floor: "3", morada: "Rua" } }, AGORA).ok).toBe(false);
    expect(lerAlteracao({}, AGORA).ok).toBe(false);
  });
});

describe("a fase decide (D2, P11 (a))", () => {
  const base = { status: "em_analise", trabalhoClyon: false, precoAceite: false, contratado: false, enviado: false };
  it("análise → aplica; enviado → à espera da Mesa; contratado e fechado → não", () => {
    expect(faseDaAlteracao(base)).toBe("analise");
    expect(faseDaAlteracao({ ...base, enviado: true })).toBe("enviado");
    expect(faseDaAlteracao({ ...base, enviado: true, contratado: true })).toBe("contratado");
    expect(faseDaAlteracao({ ...base, status: "cancelado" })).toBe("fechado");
    expect(faseDaAlteracao({ ...base, trabalhoClyon: true })).toBe("enviado");
    expect(faseDaAlteracao({ ...base, trabalhoClyon: true, precoAceite: true })).toBe("contratado");
  });

  it("uma de cada vez: com uma à espera, não se pode outra", () => {
    const a = alteracoesParaAApp({ fase: "enviado", mudanca: false, pendenteEm: "2026-10-29T09:00:00Z" });
    expect(a.pode).toBe(false);
    expect(a.pendente?.texto).toMatch(/^A CLYON está a rever a alteração que pediu a /);
    expect(alteracoesParaAApp({ fase: "analise", mudanca: false, pendenteEm: null }).campos).not.toContain("acessoDestino");
    expect(alteracoesParaAApp({ fase: "contratado", mudanca: false, pendenteEm: null, contratadoCom: "Rui" }).texto).toBe(
      "O trabalho já está combinado com Rui. Para mudar o dia ou acrescentar alguma coisa, fale com Rui.",
    );
  });

  it("os textos (G5) e o aviso ao contacto pelo link (critério 44)", () => {
    expect(TEXTOS_DA_ALTERACAO.jaHaUma).toBe("Já tem uma alteração à espera da CLYON.");
    const oQue = oQueMudou({ dataPreferida: "2026-11-02", pormenores: "x" });
    expect(oQue).toBe("o dia para 02/11/2026; pormenores novos");
    expect(avisoDaAlteracaoAoContacto(9, oQue)).toBe(
      "O pedido #9 foi alterado: o dia para 02/11/2026; pormenores novos. Não reconhece esta alteração? Responda a esta mensagem.",
    );
  });
});

describe("na base e na Mesa", () => {
  it("os pormenores ficam à parte: nunca reescrevem a descrição nem entram nas fontes do modelo (R17)", () => {
    const B = ler("src/lib/alteracoes-na-base.ts");
    expect(B).toContain("await juntarPormenoresDoCliente(pedido.id, a.pormenores)");
    expect(B).not.toMatch(/description|fontesDaDescricao/);
  });

  it("pelo link (site ou app sem conta) o contacto do pedido é avisado, no máximo de 30 em 30 minutos", () => {
    const B = ler("src/lib/alteracoes-na-base.ts");
    expect(B).toMatch(/if \(c\.porOnde === "link" \|\| c\.porOnde === "convidado"\)/);
    expect(B).toContain('limitarPorConta("aviso-ao-contacto", `pedido:${pedido.id}`, 1, 1800)');
    // E as acções pelo link do site (contratar, recusar, cancelar) também (R23).
    expect(ler("src/app/api/negociacao/[token]/route.ts")).toContain("await avisarAccaoPeloLink(pedido,");
  });

  it("«Aplicar» passa pela edição de hoje (recomeça se o retrato mudar); «Não aplicar» manda a frase ao cliente", () => {
    const B = ler("src/lib/alteracoes-na-base.ts");
    expect(B).toContain("await recomecarDoZero(depois, c.baseUrl);");
    expect(B).toContain('type: "message_to_client"');
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("<AlteracoesDoCliente token={token} />");
  });
});
