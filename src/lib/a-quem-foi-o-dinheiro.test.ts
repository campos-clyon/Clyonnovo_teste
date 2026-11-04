import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SECCAO_DO_SEPARADOR,
  classificarPagamento,
  destinoDoTrabalho,
  noSeparador,
  porCobrarNosPagosEmMao,
  resumoDosRegistos,
  somaDoSeparador,
  taxaDoPagoEmMao,
  ultimosDe,
  type GrupoDoRegisto,
} from "./a-quem-foi-o-dinheiro";
import type { TrabalhoParaGerir } from "./dinheiro-do-trabalho";
import type { SeparadorDoDinheiro } from "./filtros-dos-pagamentos";

/*
 * A QUEM FOI O DINHEIRO — 03-11-2026 (d3, dono): os pagamentos feitos à CLYON
 * em secções separadas dos feitos para os profissionais. Uma só regra para os
 * cartões, os números e as listas do ecrã dos Pagamentos. Valores inventados:
 * o repositório é público.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** Os métodos que a base conhece, lidos do tipo `ComoEntrou` — um novo entra aqui sozinho. */
const COMO_ENTROU = (() => {
  const fonte = ler("src/lib/dinheiro-do-trabalho.ts");
  const i = fonte.indexOf("export type ComoEntrou =");
  const bloco = fonte.slice(i, fonte.indexOf(";", i));
  return [...bloco.matchAll(/\|\s*"([a-z_]+)"/g)].map((m) => m[1]);
})();

describe("1. cada linha de `pagamentos` vai para uma secção", () => {
  it("o tipo `ComoEntrou` foi lido (a lista não está vazia)", () => {
    expect(COMO_ENTROU).toContain("mbway");
    expect(COMO_ENTROU).toContain("ao_profissional");
    expect(COMO_ENTROU.length).toBeGreaterThanOrEqual(10);
  });

  it("todos os métodos conhecidos estão classificados — nenhum cai em «outro»", () => {
    for (const m of COMO_ENTROU) expect(classificarPagamento(m).natureza, m).not.toBe("outro");
  });

  it("à CLYON: o euPago, o recebido à mão pela CLYON e o que o profissional lhe pagou", () => {
    for (const m of ["multibanco", "mbway"]) expect(classificarPagamento(m)).toEqual({ destino: "clyon", natureza: "eupago", entraNaClyon: true });
    for (const m of ["transferencia", "numerario"])
      expect(classificarPagamento(m)).toEqual({ destino: "clyon", natureza: "recebido_a_mao", entraNaClyon: true });
    for (const m of ["pro_transferencia", "pro_mbway", "pro_numerario"])
      expect(classificarPagamento(m)).toEqual({ destino: "clyon", natureza: "pago_pelo_profissional", entraNaClyon: true });
  });

  it("ao profissional: o pago em mão e os acertos no saldo — nunca entram na CLYON", () => {
    expect(classificarPagamento("ao_profissional")).toEqual({ destino: "profissional", natureza: "em_mao", entraNaClyon: false });
    for (const m of ["abatimento", "quitacao"])
      expect(classificarPagamento(m)).toEqual({ destino: "profissional", natureza: "acerto_no_saldo", entraNaClyon: false });
  });

  it("um método desconhecido fica à CLYON, como antes — não desaparece das contas", () => {
    for (const m of ["xpto", "", null, undefined]) {
      expect(classificarPagamento(m)).toEqual({ destino: "clyon", natureza: "outro", entraNaClyon: true });
    }
    expect(classificarPagamento("  mbway ").natureza).toBe("eupago");
  });
});

describe("2. cada trabalho: a quem o cliente pagou", () => {
  it("em mão (dinheiro, ou registado «pago ao profissional») é do profissional; o resto, da CLYON", () => {
    expect(destinoDoTrabalho({ formaDePagamento: "dinheiro" })).toBe("profissional");
    expect(destinoDoTrabalho({ formaDePagamento: "dinheiro", comoEntrou: "multibanco" })).toBe("profissional");
    expect(destinoDoTrabalho({ formaDePagamento: "na_plataforma", comoEntrou: "ao_profissional" })).toBe("profissional");
    expect(destinoDoTrabalho({ formaDePagamento: null, comoEntrou: "mbway" })).toBe("clyon");
    expect(destinoDoTrabalho({ formaDePagamento: null, comoEntrou: null })).toBe("clyon");
  });

  it("combinado pela plataforma, o trabalho e a linha que o paga dizem o mesmo", () => {
    for (const comoEntrou of [null, "multibanco", "mbway", "transferencia", "numerario", "ao_profissional"]) {
      const doTrabalho = destinoDoTrabalho({ formaDePagamento: "na_plataforma", comoEntrou });
      expect(doTrabalho, String(comoEntrou)).toBe(classificarPagamento(comoEntrou).destino);
    }
  });
});

describe("3. os separadores do «Trabalho a trabalho»", () => {
  const DIA = "2026-10-20T10:00:00.000Z";
  const SEPARADORES: SeparadorDoDinheiro[] = ["por_receber", "recebidos", "em_mao", "por_pagar", "pagos"];

  it("a CLYON tem «Por receber» e «Recebidos»; os profissionais, «Pagos em mão», «Por pagar» e «Pagos»", () => {
    expect(SECCAO_DO_SEPARADOR).toEqual({
      por_receber: "clyon",
      recebidos: "clyon",
      em_mao: "profissional",
      por_pagar: "profissional",
      pagos: "profissional",
    });
  });

  it("em todas as combinações: um pago em mão vive só em «Pagos em mão»; os outros, uma vez de cada lado", () => {
    let vistos = 0;
    for (const formaDePagamento of [null, "na_plataforma", "dinheiro"])
      for (const comoEntrou of [null, "multibanco", "mbway", "transferencia", "numerario", "ao_profissional"])
        for (const clientePagouEm of [null, DIA])
          for (const confirmadoEm of [null, DIA])
            for (const pagoEm of [null, DIA])
              for (const dividaDoProfissional of [null, 30]) {
                const t: TrabalhoParaGerir = {
                  formaDePagamento,
                  comoEntrou: clientePagouEm ? comoEntrou : null,
                  clientePagouEm,
                  confirmadoEm,
                  pagoEm,
                  dividaDoProfissional,
                };
                const onde = SEPARADORES.filter((s) => noSeparador(t, s));
                const quem = JSON.stringify(t);
                if (destinoDoTrabalho(t) === "profissional") {
                  expect(onde, quem).toEqual(["em_mao"]);
                } else {
                  expect(onde.filter((s) => s === "por_receber" || s === "recebidos"), quem).toHaveLength(1);
                  expect(onde.filter((s) => s === "por_pagar" || s === "pagos"), quem).toHaveLength(1);
                  expect(onde, quem).not.toContain("em_mao");
                }
                vistos++;
              }
    expect(vistos).toBe(3 * 6 * 2 * 2 * 2 * 2);
  });

  it("o pago em mão nunca está por receber nem recebido pela CLYON, nem pago por ela", () => {
    const emMao: TrabalhoParaGerir = { formaDePagamento: "dinheiro", confirmadoEm: DIA, dividaDoProfissional: 30 };
    const registado: TrabalhoParaGerir = { comoEntrou: "ao_profissional", clientePagouEm: DIA, confirmadoEm: DIA };
    for (const t of [emMao, registado]) {
      for (const s of ["por_receber", "recebidos", "por_pagar", "pagos"] as const) expect(noSeparador(t, s), s).toBe(false);
      expect(noSeparador(t, "em_mao")).toBe(true);
    }
  });

  it("as somas: o cliente do lado do cliente (à CLYON ou em mão), o profissional do que a CLYON lhe paga", () => {
    const linhas = [
      { clientePaga: 123, profissionalRecebe: 80 },
      { clientePaga: 61.5, profissionalRecebe: 40 },
    ];
    expect(somaDoSeparador(linhas, "por_receber")).toBe(184.5);
    expect(somaDoSeparador(linhas, "recebidos")).toBe(184.5);
    expect(somaDoSeparador(linhas, "em_mao")).toBe(184.5);
    expect(somaDoSeparador(linhas, "por_pagar")).toBe(120);
    expect(somaDoSeparador(linhas, "pagos")).toBe(120);
    expect(somaDoSeparador([{ clientePaga: 0.1, profissionalRecebe: 0 }, { clientePaga: 0.2, profissionalRecebe: 0 }], "em_mao")).toBe(0.3);
  });
});

describe("4. a parte da CLYON de um pago em mão", () => {
  const TAXAS = { cliente: 0, profissional: 0.2 };

  it("em dinheiro: a dívida de sempre, cobrada quando o pagamento dela entrou", () => {
    const base = { formaDePagamento: "dinheiro", valorAcordado: 100, taxas: TAXAS };
    expect(taxaDoPagoEmMao({ ...base, dividaDoProfissional: 43 })).toEqual({ valor: 43, cobrada: false, descontaNoSaldo: false });
    expect(taxaDoPagoEmMao({ ...base, dividaDoProfissional: 43, clientePagouEm: "2026-10-21" })).toEqual({
      valor: 43,
      cobrada: true,
      descontaNoSaldo: false,
    });
    // O regime antigo não tem a dívida registada: não se inventa.
    expect(taxaDoPagoEmMao({ ...base, dividaDoProfissional: null })).toBeNull();
  });

  it("registado «pago ao profissional»: a conta do registo em mão (desde 04-11-2026 também por referência)", () => {
    const base = { formaDePagamento: "na_plataforma", comoEntrou: "ao_profissional", valorAcordado: 100, taxas: TAXAS };
    expect(taxaDoPagoEmMao({ ...base, valorQueEntrou: 100 })).toEqual({
      valor: 20,
      cobrada: false,
      descontaNoSaldo: false,
      como: null,
      fechadaCom: null,
    });
    // Com o IVA pago em mão, o IVA também é da CLYON.
    expect(taxaDoPagoEmMao({ ...base, valorQueEntrou: 123 })?.valor).toBe(43);
    // Sem o valor registado, só a taxa.
    expect(taxaDoPagoEmMao({ ...base, valorQueEntrou: null })?.valor).toBe(20);
    expect(taxaDoPagoEmMao({ ...base, valorQueEntrou: 100, taxaAParteEm: "2026-11-02" })?.cobrada).toBe(true);
  });

  it("nos que o cliente paga à CLYON não há parte por cobrar ao profissional", () => {
    expect(taxaDoPagoEmMao({ formaDePagamento: null, comoEntrou: "mbway", valorAcordado: 100, taxas: TAXAS })).toBeNull();
    expect(taxaDoPagoEmMao({ formaDePagamento: null, comoEntrou: null, valorAcordado: 100, taxas: TAXAS })).toBeNull();
  });

  it("«por cobrar» soma só o que falta cobrar", () => {
    expect(
      porCobrarNosPagosEmMao([
        { taxaEmMao: { valor: 20, cobrada: false, descontaNoSaldo: true } },
        { taxaEmMao: { valor: 43, cobrada: true, descontaNoSaldo: false } },
        { taxaEmMao: { valor: 8.8, cobrada: false, descontaNoSaldo: false } },
        { taxaEmMao: null },
        {},
      ]),
    ).toBe(28.8);
  });
});

describe("5. o registo dos pagamentos, por secção", () => {
  const g = (metodo: string, estado: string, n: number, valorPago: number, extra: Partial<GrupoDoRegisto> = {}): GrupoDoRegisto => ({
    metodo,
    estado,
    n,
    valor: valorPago,
    valorPago,
    comissao: 0,
    ...extra,
  });
  const GRUPOS: GrupoDoRegisto[] = [
    g("mbway", "pago", 3, 300, { comissao: 3 }),
    g("multibanco", "pago", 2, 200, { comissao: 2 }),
    g("transferencia", "pago", 1, 100),
    g("pro_transferencia", "pago", 1, 25),
    g("ao_profissional", "pago", 2, 150),
    g("abatimento", "pago", 1, 20),
    g("quitacao", "pago", 1, 10),
    g("mbway", "pendente", 1, 0, { valor: 50 }),
    g("multibanco", "falhado", 2, 0),
    g("mbway", "cancelado", 1, 0),
    g("multibanco", "expirado", 1, 0),
    g("ao_profissional", "cancelado", 1, 0),
  ];

  it("cada secção com os seus números", () => {
    expect(resumoDosRegistos(GRUPOS)).toEqual({
      clyon: {
        recebidos: { n: 7, total: 625 },
        aEspera: { n: 1, total: 50 },
        falhadosOuCancelados: 3,
        comissaoDoEupago: 5,
      },
      profissional: {
        emMao: { n: 2, total: 150 },
        acertos: { n: 2, total: 30 },
      },
    });
  });

  it("o pago em mão não mexe no recebido nem no «à espera» da CLYON, em estado nenhum", () => {
    const sem = resumoDosRegistos(GRUPOS.filter((x) => x.metodo !== "ao_profissional"));
    const com = resumoDosRegistos([
      ...GRUPOS,
      g("ao_profissional", "pago", 5, 999),
      g("ao_profissional", "pendente", 2, 0, { valor: 77 }),
      g("ao_profissional", "falhado", 2, 0),
    ]);
    expect(com.clyon).toEqual(sem.clyon);
  });

  it("o «recebido» antigo (tudo menos abatimento e quitação) passava o da CLYON pelo pago em mão, ao cêntimo", () => {
    const antigo = GRUPOS.filter(
      (x) => x.estado === "pago" && x.metodo !== "abatimento" && x.metodo !== "quitacao",
    ).reduce((s, x) => s + x.valorPago, 0);
    const r = resumoDosRegistos(GRUPOS);
    expect(antigo - r.clyon.recebidos.total).toBe(r.profissional.emMao.total);
  });
});

describe("6. os últimos pagamentos, por secção", () => {
  const lista = [
    { id: 9, metodo: "mbway" },
    { id: 8, metodo: "ao_profissional" },
    { id: 7, metodo: "multibanco" },
    { id: 6, metodo: "abatimento" },
    { id: 5, metodo: "transferencia" },
  ];

  it("cada lista só com os seus, pela ordem em que vieram, e com limite", () => {
    expect(ultimosDe(lista, "clyon").map((p) => p.id)).toEqual([9, 7, 5]);
    expect(ultimosDe(lista, "profissional").map((p) => p.id)).toEqual([8, 6]);
    expect(ultimosDe(lista, "clyon", 2).map((p) => p.id)).toEqual([9, 7]);
  });
});

describe("7. o ecrã e a base usam esta regra — e não outra parecida", () => {
  const PAINEL = semComentarios(ler("src/components/admin/AdminPagamentosPanel.tsx"));
  const BASE = ler("src/lib/pagamentos-na-base.ts");
  const ROTA = ler("src/app/api/admin/pagamentos/route.ts");
  const GERIR = ler("src/lib/trabalhos-para-gerir.ts");

  it("os separadores, as somas, a etiqueta e as listas vêm de `a-quem-foi-o-dinheiro`", () => {
    expect(PAINEL).toContain('from "@/lib/a-quem-foi-o-dinheiro"');
    expect(PAINEL).toContain("noSeparador(t, s.id) && dentroDoIntervalo(dataDeReferencia(t, s.id), intervalo)");
    expect(PAINEL).toContain("return somaDoSeparador(linhas, s);");
    expect(PAINEL).toContain("SECCAO_DO_SEPARADOR[c.id] === seccao");
    expect(PAINEL).toContain("const destino = destinoDoTrabalho(t);");
    expect(PAINEL).toContain("const ultimosDaVez = ultimosDe(estado.ultimos, verUltimos, 25);");
    expect(PAINEL).toContain("{porNumeroDoPedido(ultimosDaVez).map((p) => {");
    // A regra antiga, que punha os pagos em mão em «Recebidos» e «Pagos aos pros», saiu.
    expect(PAINEL).not.toMatch(/ladoDoCliente\(|ladoDoProfissional\(/);
    expect(PAINEL).not.toContain("resumo.totalPago");
  });

  it("as duas secções têm título, a etiqueta diz a quem, e «À CLYON» abre por omissão", () => {
    expect(PAINEL).toContain('titulo: "Pagos à CLYON"');
    expect(PAINEL).toContain('titulo: "Pagos aos profissionais"');
    expect(PAINEL).toContain('etiqueta: "à CLYON"');
    expect(PAINEL).toContain('etiqueta: "ao profissional"');
    expect(PAINEL).toContain('const [verUltimos, setVerUltimos] = useState<Destino>("clyon");');
    expect(PAINEL).toContain('rotulo: "Pagos em mão"');
    expect(PAINEL).toContain("<RegistoDaSeccao seccao={seccao} registo={registo} />");
  });

  it("a base só agrupa por método e estado; quem classifica é a regra", () => {
    const i = BASE.indexOf("export async function resumoDosPagamentos");
    const corpo = BASE.slice(i, BASE.indexOf("\n}\n", i));
    expect(i).toBeGreaterThan(-1);
    expect(corpo).toContain("GROUP BY metodo, estado");
    expect(corpo).toContain("porDestino: resumoDosRegistos(");
    expect(corpo).not.toMatch(/CASE WHEN|NOT IN \(/);
    expect(ROTA).toContain("ultimosPagamentos(80)");
  });

  it("a parte cobrada de um pago em mão lê a linha à parte pelo mesmo `trid` da carteira", () => {
    // Desde 04-11-2026 (d9) vive em `pago-em-mao.ts` (sem base, para as Finanças); a base reexporta-o.
    const MAO = ler("src/lib/pago-em-mao.ts");
    expect(MAO).toContain('export const PREFIXO_DO_ABATIMENTO_A_PARTE = "abatimento-mao-";');
    expect(MAO).toContain("return `${PREFIXO_DO_ABATIMENTO_A_PARTE}${negociacaoId}`;");
    expect(BASE).toContain('export { PREFIXO_DO_ABATIMENTO_A_PARTE, tridDoAbatimentoAParte } from "./pago-em-mao";');
    expect(GERIR).toContain("ON ap.trid = CONCAT(?, n.id) AND ap.estado = 'pago' AND ap.negociacaoPaga IS NULL");
    expect(GERIR).toContain("soA ? [PREFIXO_DO_ABATIMENTO_A_PARTE, soA] : [PREFIXO_DO_ABATIMENTO_A_PARTE]");
    expect(GERIR).toContain("taxaEmMao: taxaDoPagoEmMao({");
  });

  it("as Finanças deixam de fora da CLYON exactamente os mesmos métodos", () => {
    const fin = ler("src/lib/financas.ts");
    const lista = /const NAO_ENTROU_NA_CLYON = \[([^\]]*)\]/.exec(fin)?.[1] ?? "";
    const delas = [...lista.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort();
    const daRegra = COMO_ENTROU.filter((m) => !classificarPagamento(m).entraNaClyon).sort();
    expect(delas.length).toBeGreaterThan(0);
    expect(delas).toEqual(daRegra);
  });
});
