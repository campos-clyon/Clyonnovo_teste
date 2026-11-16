import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chaveDaReferencia, formaDoCorpo, lerAvisoDoEupago } from "./webhook-do-eupago";

/**
 * AVISOS DO euPAGO SEM TRID — 16-11-2026 (d50).
 *
 * O painel dizia «a assinatura confere, e a plataforma respondeu erro … O
 * aviso não traz trid.». Agora a chave vem de outro nome do trid, ou da
 * referência — a MESMA chave que a conferência já grava —, ou do nosso
 * identificador; e de um aviso que mesmo assim não se lê fica a forma do
 * corpo (só os nomes dos campos) para se saber o que mudou.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

function transacao(t: Record<string, unknown>) {
  return {
    channel: { name: "CLYON" },
    transaction: {
      identifier: "clyon-site-41",
      method: "PC:PT",
      amount: { value: "60.00", currency: "EUR" },
      status: "Paid",
      ...t,
    },
  };
}

describe("a chave de um aviso sem trid", () => {
  it("é igual à que a conferência grava para a mesma referência", () => {
    const p = { entidade: "21921", referencia: "104295830" };
    const r = lerAvisoDoEupago(transacao({ entity: 21921, reference: 104295830 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.aviso.trid).toBe(chaveDaReferencia(p.entidade, p.referencia));
    // E é a forma histórica da conferência: as linhas já gravadas continuam a casar.
    expect(chaveDaReferencia(p.entidade, p.referencia)).toBe(`ref:${p.entidade}:${p.referencia}`);
    expect(chaveDaReferencia(null, "104295830")).toBe("ref::104295830");
  });

  it("a referência escrita com espaços dá a mesma chave", () => {
    expect(chaveDaReferencia("21921", "104 295 830")).toBe(chaveDaReferencia("21921", "104295830"));
  });

  it("as duas conferências e o webhook usam a mesma função, e ninguém escreve a chave à mão", () => {
    for (const f of [
      "src/app/api/cron/conferir-pagamentos/route.ts",
      "src/app/api/admin/pagamentos/conferir/route.ts",
    ]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).toContain("trid: chaveDaReferencia(p.entidade, p.referencia)");
      expect(codigo, f).not.toContain("`ref:");
    }
  });

  it("o trid com outro nome conta como trid, e vem antes da referência", () => {
    for (const nome of ["transactionId", "transaction_id", "transactionID", "tid", "id"]) {
      const r = lerAvisoDoEupago(transacao({ [nome]: 777001, reference: "104295830" }));
      expect(r.ok, nome).toBe(true);
      if (r.ok) expect(r.aviso.trid, nome).toBe("777001");
    }
    const comTrid = lerAvisoDoEupago(transacao({ trid: 1, transactionId: 2, reference: "9" }));
    if (comTrid.ok) expect(comTrid.aviso.trid).toBe("1");
  });

  it("sem referência, só com o nosso identificador, a chave leva o identificador e o estado", () => {
    const r = lerAvisoDoEupago(transacao({}));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.aviso.trid).toBe("id:clyon-site-41:pago");
  });

  it("sem nada disso continua a recusar, com 500", () => {
    const r = lerAvisoDoEupago(transacao({ identifier: "outro-produto-9" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retentar).toBe(true);
      expect(r.porque).toBe("O aviso não traz trid.");
    }
  });
});

describe("a forma do corpo — só nomes de campos, nunca valores", () => {
  it("lista as chaves por dentro, ordenadas, sem um único valor", () => {
    const corpo = {
      channel: { name: "CLYON", account: "conta-x" },
      transaction: {
        identifier: "clyon-site-41",
        customer: { phone: "912345678", name: "Maria" },
        amount: { value: "60.00", currency: "EUR" },
        lista: [{ a: 1 }],
      },
    };
    const f = formaDoCorpo(corpo);
    expect(f).toBe(
      "{channel{account,name},transaction{amount{currency,value},customer{name,phone},identifier,lista[{a}]}}",
    );
    for (const valor of ["CLYON", "conta-x", "clyon-site-41", "912345678", "Maria", "60.00", "EUR"]) {
      expect(f).not.toContain(valor);
    }
  });

  it("cabe em 500 caracteres e limpa nomes estranhos", () => {
    const grande = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`campo_${i}`, i]));
    expect(formaDoCorpo(grande).length).toBeLessThanOrEqual(500);
    expect(formaDoCorpo({ "a b<script>": 1 })).toBe("{abscript}");
  });

  it("a falha guarda a forma numa coluna nova, e nunca o corpo", () => {
    const base = semComentarios(ler("src/lib/pagamentos-na-base.ts"));
    expect(base).toContain("ALTER TABLE avisosRecusados ADD COLUMN forma VARCHAR(500)");
    const i = base.indexOf("export async function anotarFalha");
    const corpo = base.slice(i, base.indexOf("\n}\n", i));
    expect(corpo).toContain("forma");
    expect(corpo).not.toContain("corpoCru");
    const rota = semComentarios(ler("src/app/api/pagamentos/webhook/route.ts"));
    expect(rota).toContain("falhar(leitura.porque, corpoCru.length, formaDoCorpo(json))");
  });

  it("o painel mostra a forma junto da falha", () => {
    const ecra = semComentarios(ler("src/components/admin/AdminPagamentosPanel.tsx"));
    const corpo = ecra.slice(ecra.indexOf("function PortaDosAvisos"));
    expect(corpo.slice(0, 2000)).toContain("w.ultimaFalha?.forma");
  });
});
