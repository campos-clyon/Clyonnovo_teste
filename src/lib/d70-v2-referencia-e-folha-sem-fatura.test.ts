import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { comFacturaDaReferencia } from "./sem-factura";
import { quantoSePedeNesteTrabalho } from "./eupago";
import { fazerAFolhaFinal, fraseDaFolhaFinal, type CorpoDaFolhaFinal } from "./folha-final";

/**
 * d70 v2 (19-11-2026) — A MARCA «SEM FATURA» NO «GERAR REFERÊNCIA» E NA FRASE
 * DA FOLHA FINAL.
 *
 * · num trabalho marcado, o servidor ignora o «com fatura» do corpo e pede o
 *   sem IVA — o mesmo valor do «Enviar o valor final» (d70);
 * · sem a marca, como antes;
 * · a frase do histórico da folha final, num trabalho sem fatura, diz «X (sem
 *   fatura)», sem «com IVA».
 */

const SEM_FATURA = { cliente: 0, profissional: 0.1 };
// Como o servidor o monta: a marca põe o modelo sem IVA (`modeloDaLinha`).
const marcado = {
  acordado: 431.33,
  taxas: SEM_FATURA,
  acrescimo: 0,
  formaDePagamento: "na_plataforma",
  modelo: "sem_iva" as const,
  novoModelo: false,
  reservaCent: 0,
  semFactura: true,
};

describe("o «Gerar referência» num trabalho marcado «Sem fatura»", () => {
  it("o «com fatura» do corpo não conta: a referência é do sem IVA", () => {
    for (const doEcra of [true, false, undefined, "true"]) {
      const comFactura = comFacturaDaReferencia(marcado, doEcra);
      expect(comFactura).toBe(false);
      expect(quantoSePedeNesteTrabalho(marcado, comFactura)).toEqual({ valor: 431.33, quemPaga: "cliente" });
    }
  });

  it("mesmo com o modelo do IVA incluído, a marca manda", () => {
    expect(comFacturaDaReferencia({ modelo: "iva_incluido", semFactura: true }, true)).toBe(false);
  });

  it("sem a marca, como antes: IVA incluído sempre com fatura; antes dele, a escolha do ecrã", () => {
    expect(comFacturaDaReferencia({ modelo: "iva_incluido" }, false)).toBe(true);
    expect(comFacturaDaReferencia({ modelo: "iva_incluido", semFactura: false }, undefined)).toBe(true);
    expect(comFacturaDaReferencia({ modelo: "sem_iva" }, true)).toBe(true);
    expect(comFacturaDaReferencia({ modelo: "sem_iva" }, false)).toBe(false);
    expect(comFacturaDaReferencia({ modelo: "sem_iva" }, "true")).toBe(false);
    const semMarca = { ...marcado, semFactura: false };
    expect(quantoSePedeNesteTrabalho(semMarca, comFacturaDaReferencia(semMarca, true)).valor).toBeGreaterThan(431.33);
  });
});

const fonte = (f: string) => readFileSync(join(__dirname, "..", f), "utf8").replace(/\r\n/g, "\n");

describe("a rota e o ecrã usam a marca", () => {
  const rota = fonte("app/api/admin/pagamentos/criar/route.ts");
  it("o POST decide a fatura pela marca, não pelo corpo sozinho", () => {
    expect(rota).toContain("const comFactura = comFacturaDaReferencia(t, corpo.comFactura);");
    expect(rota).not.toMatch(/const comFactura = t\.modelo === "iva_incluido" \|\| corpo\.comFactura === true/);
  });
  it("o GET diz ao ecrã que o trabalho está marcado, e o «com fatura» dá o sem IVA", () => {
    expect(rota).toContain("semFactura: t.semFactura === true,");
    expect(rota).toContain("valorAPedirComFactura: falta(t, comFacturaDaReferencia(t, true)),");
  });
  it("o ecrã, marcado, não oferece o «com fatura» e explica porquê", () => {
    const ecra = fonte("components/admin/GerarReferencia.tsx");
    expect(ecra).toMatch(/semEscolhaDeFactura = [^;]*doServidor\?\.semFactura === true/);
    expect(ecra).toContain("Trabalho marcado «Sem fatura»");
    expect(ecra).toContain("comFactura: comFactura && doServidor?.semFactura !== true,");
  });
});

const CORPO: CorpoDaFolhaFinal = {
  pessoas: 3,
  horas: "8",
  precoHora: "55",
  deslocacaoTipo: "euros",
  deslocacaoEuros: "63",
  materiais: [],
};
const TAXA = { daFolhaAnterior: null, trabalhoClyon: true, taxaClyon: 0.15, tarifa: null, taxaCliente: 0, taxaProfissional: 0.15 };

describe("a frase do histórico da folha final", () => {
  const f = fazerAFolhaFinal({ corpo: CORPO, tarifa: null, taxa: TAXA, modelo: { novoModelo: false, regime: "normal" } });
  if (!f.ok) throw new Error(f.erro);
  const base = { porQuem: "Equipa", antes: null, jaPago: false, motivo: null };

  it("sem fatura: «X (sem fatura)», sem «com IVA»", () => {
    const frase = fraseDaFolhaFinal(f.folha, { ...base, semFactura: true });
    expect(frase).toContain(`Valor final ${f.folha.previa.semIva.toFixed(2).replace(".", ",")} € (sem fatura)`);
    expect(frase).not.toContain("com IVA");
  });

  it("com fatura (ou sem o campo): como antes", () => {
    const antes = fraseDaFolhaFinal(f.folha, base);
    expect(antes).toContain("sem IVA (");
    expect(antes).toContain("com IVA)");
    expect(fraseDaFolhaFinal(f.folha, { ...base, semFactura: false })).toBe(antes);
  });

  it("o servidor passa a marca à frase", () => {
    expect(fonte("lib/folha-final-no-servidor.ts")).toContain("motivo, semFactura: c.semFactura });");
  });
});
