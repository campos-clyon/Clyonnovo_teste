import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FALTA_PAGAR_AO_PROFISSIONAL,
  faltaPagarAoProfissional,
  ladoDoCliente,
  ladoDoProfissional,
  prontoAPagar,
  tudoFechado,
  type TrabalhoParaGerir,
} from "./dinheiro-do-trabalho";
import { assistenteComSeccoesPodeChamar } from "./papel-do-painel";

/**
 * UM TRABALHO SÓ SAI DA LISTA DE TRABALHO DOS PAGAMENTOS COM TUDO FEITO —
 * 26-10-2026 (d25).
 *
 * *«No pedido 435 eu marquei como já recebemos, mas não marquei que nós
 * pagámos o profissional. Então esse pedido não poderia ter sido fechado. Ele
 * teria que estar ainda disponível para a gente finalizar tudo. E mesmo após
 * finalizar tudo, esses pedidos que estão como pagos nós deveríamos poder
 * abrir para ver do que se trata — ao clicar, deveria ter a opção de abrir o
 * histórico.»* — o dono.
 *
 * Três regras: (1) não sai antes de fechar; (2) entre o recebido e o pago fica
 * num grupo próprio, à vista, e o selo conta-o; (3) os últimos pagamentos
 * abrem o trabalho, com o histórico.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Só os comentários que começam a linha (ver tirar-comentarios-sem-comer-codigo). */
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const PAINEL = semNotas(ler("src/components/admin/AdminPagamentosPanel.tsx"));
const DB = semNotas(ler("src/lib/db.ts"));
const MENU = semNotas(ler("src/components/admin/LegacyAdminClient.tsx"));

/** O corte de `fonte` entre `de` e `ate`, exigindo que os dois existam. */
function entre(fonte: string, de: string, ate: string): string {
  const i = fonte.indexOf(de);
  expect(i, de).toBeGreaterThan(-1);
  const j = fonte.indexOf(ate, i + de.length);
  expect(j, ate).toBeGreaterThan(-1);
  return fonte.slice(i, j);
}

const DIA = "2026-10-25T14:03:00.000Z";

describe("1 — um trabalho não sai da lista de trabalho antes de fechar", () => {
  it("o #435: recebido do cliente, profissional por pagar — fica no grupo, não está fechado", () => {
    const t: TrabalhoParaGerir = { clientePagouEm: DIA, comoEntrou: "transferencia", confirmadoEm: DIA };
    expect(ladoDoCliente(t)).toBe("recebido");
    expect(faltaPagarAoProfissional(t)).toBe(true);
    expect(prontoAPagar(t)).toBe(true);
    expect(tudoFechado(t)).toBe(false);
  });

  it("pago pelo cliente antes de confirmar também fica: o dinheiro do profissional está connosco", () => {
    const t: TrabalhoParaGerir = { clientePagouEm: DIA, comoEntrou: "multibanco" };
    expect(faltaPagarAoProfissional(t)).toBe(true);
    expect(tudoFechado(t)).toBe(false);
  });

  it("com o «Já pagámos» sai do grupo, e confirmado fica fechado", () => {
    const t: TrabalhoParaGerir = { clientePagouEm: DIA, comoEntrou: "transferencia", confirmadoEm: DIA, pagoEm: DIA };
    expect(faltaPagarAoProfissional(t)).toBe(false);
    expect(tudoFechado(t)).toBe(true);
  });

  it("dinheiro em mão: não há nada a transferir — nunca entra no grupo", () => {
    expect(faltaPagarAoProfissional({ formaDePagamento: "dinheiro", confirmadoEm: DIA })).toBe(false);
    expect(faltaPagarAoProfissional({ clientePagouEm: DIA, comoEntrou: "ao_profissional", confirmadoEm: DIA })).toBe(false);
    // Com IVA incluído, a parte da CLYON por receber deixa-o em «Por receber», e não fechado.
    const divida: TrabalhoParaGerir = { formaDePagamento: "dinheiro", confirmadoEm: DIA, dividaDoProfissional: 80 };
    expect(ladoDoCliente(divida)).toBe("por_receber");
    expect(tudoFechado(divida)).toBe(false);
    expect(tudoFechado({ ...divida, clientePagouEm: DIA, comoEntrou: "transferencia" })).toBe(true);
  });

  it("em todas as combinações: ou está por receber, ou no grupo, ou as duas pontas estão feitas", () => {
    const formas = [null, "na_plataforma", "dinheiro"];
    const comos = [null, "multibanco", "mbway", "transferencia", "numerario", "ao_profissional"];
    const datas = [null, DIA];
    const dividas = [null, 80];
    let vistas = 0;
    for (const formaDePagamento of formas)
      for (const comoEntrou of comos)
        for (const clientePagouEm of datas)
          for (const confirmadoEm of datas)
            for (const pagoEm of datas)
              for (const dividaDoProfissional of dividas) {
                const t: TrabalhoParaGerir = {
                  formaDePagamento,
                  comoEntrou: clientePagouEm ? comoEntrou : null,
                  clientePagouEm,
                  confirmadoEm,
                  pagoEm,
                  dividaDoProfissional,
                };
                const naLista = ladoDoCliente(t) === "por_receber" || faltaPagarAoProfissional(t);
                const duasPontas = ladoDoCliente(t) === "recebido" && ladoDoProfissional(t) === "pago";
                expect(naLista || duasPontas, JSON.stringify(t)).toBe(true);
                // E «fechado» nunca é dito de um trabalho com dinheiro por mexer.
                if (tudoFechado(t)) expect(naLista, JSON.stringify(t)).toBe(false);
                vistas++;
              }
    expect(vistas).toBe(3 * 6 * 2 * 2 * 2 * 2);
  });
});

describe("2 — o grupo «Recebido do cliente — falta pagar ao profissional»", () => {
  it("tem este nome", () => {
    expect(FALTA_PAGAR_AO_PROFISSIONAL).toBe("Recebido do cliente — falta pagar ao profissional");
  });

  const GRUPO = entre(PAINEL, 'aria-labelledby="grupo-falta-pagar"', "</section>");

  it("está por cima dos separadores, e lê a regra — não outra parecida", () => {
    expect(PAINEL.indexOf('aria-labelledby="grupo-falta-pagar"')).toBeLessThan(PAINEL.indexOf('<div role="tablist"'));
    expect(PAINEL).toContain("const aPagar = filtrados.filter(faltaPagarAoProfissional);");
    expect(GRUPO).toContain("{FALTA_PAGAR_AO_PROFISSIONAL} · {grupoAPagar.length}");
    // O valor a pagar: o que os profissionais recebem.
    expect(PAINEL).toContain("aPagar.reduce((n, t) => n + t.profissionalRecebe, 0)");
    expect(GRUPO).toContain("{euros(somaAPagar)}");
  });

  it("o caminho para pagar é o de sempre — a mesma rota, sem botão novo que pague", () => {
    expect(GRUPO).toContain('onPaguei={() => void agir(t, "/api/admin/pagamentos/pago-ao-profissional", {}, "grupo")}');
    expect(GRUPO).toContain("<Linha");
    expect(GRUPO).not.toMatch(/fetch\(/);
    // A rota que marca o pagamento ao profissional continua a ser a única.
    const rotas = [...PAINEL.matchAll(/"\/api\/admin\/pagamentos\/([a-z-]+)"/g)].map((m) => m[1]);
    // «fatura-emitida» (27-10-2026, d16) anota a fatura; não paga nada a ninguém.
    expect(new Set(rotas)).toEqual(new Set(["recebido", "pago-ao-profissional", "excluir", "factura", "testar", "fatura-emitida"]));
  });

  it("o selo conta-os: a mesma regra na base, sem as contas de teste", () => {
    const SQL = entre(DB, "export async function contarPorFazer(", '"[contarPorFazer:pagamentos]"');
    for (const condicao of [
      "n.estado = 'acordada'",
      "n.pagoEm IS NULL",
      "pg.negociacaoPaga = n.id",
      "pg.pagoEm IS NOT NULL",
      "pg.metodo <> 'ao_profissional'",
      "(n.formaDePagamento IS NULL OR n.formaDePagamento <> 'dinheiro')",
      "COALESCE(pr.contaDeTeste, 0) = 0",
    ]) {
      expect(SQL, condicao).toContain(condicao);
    }
    expect(SQL).toContain("saida.pagamentos =");
    expect(SQL).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/);
    expect(ler("src/app/api/admin/novidades/route.ts")).toContain("onde, porFazer });");
  });

  it("e não se apaga ao abrir a secção: soma-se ao selo, fora do que o abrir zera", () => {
    expect(MENU).toContain("setPorFazer(d.porFazer ?? {});");
    expect(MENU).toContain("const aFazer = ePedidos ? 0 : (porFazer[item.id] ?? 0);");
    expect(MENU).toContain("const novas = novasDesdeQueOlhou + aFazer;");
    const VISTA = entre(MENU, "const marcarSeccaoVista = useCallback(", "[token],");
    expect(VISTA).toContain("setNovidades(");
    expect(VISTA).not.toContain("setPorFazer(");
    // O painel abre em «Recebidos» só pelo que chegou de novo, não pela fila.
    expect(MENU).toContain("metades.map((x) => [x, novidades[x] ?? 0])");
  });
});

describe("3 — os últimos pagamentos abrem o trabalho, com o histórico", () => {
  const ULTIMOS = entre(PAINEL, "{porNumeroDoPedido(estado.ultimos).map((p) => {", "</div>\n      )}");

  it("cada linha abre (clique, Enter e espaço) a gaveta do seu trabalho", () => {
    expect(ULTIMOS).toContain("{...linhaQueAbre(() => abrirGaveta(p,");
    expect(PAINEL).toContain("trabalhos.find((t) => t.negociacaoId === gaveta.negociacaoId)");
    expect(PAINEL).toContain("<Gaveta titulo={`Pagamento do pedido #${gaveta.pedidoId}`} onFechar={onFecharGaveta}>");
  });

  it("a linha diz como entrou de verdade — não «Multibanco» a tudo — e se ainda falta pagar ao profissional", () => {
    expect(PAINEL).not.toContain('p.metodo === "mbway" ? "MB WAY" : "Multibanco"');
    expect(ULTIMOS).toContain("{comoEntrouNaLista(p.metodo)}");
    expect(ULTIMOS).toContain("faltaPagarAoProfissional(t)");
  });

  it("a gaveta é um diálogo que se usa com o teclado: foco dentro, Esc fecha, o foco volta à linha", () => {
    const G = entre(PAINEL, "function Gaveta(", "\nfunction HistoricoDoTrabalho(");
    expect(G).toContain('role="dialog"');
    expect(G).toContain('aria-modal="true"');
    expect(G).toContain('e.key === "Escape"');
    expect(G).toContain('e.key !== "Tab"');
    expect(G).toContain("botaoFechar.current?.focus();");
    // No telemóvel ocupa o ecrã; no computador fica à direita.
    expect(G).toContain("h-full w-full");
    expect(G).toContain("sm:max-w-xl");
    expect(PAINEL).toContain("if (linha) window.setTimeout(() => linha.focus(), 0);");
  });

  it("o trabalho fechado abre-se só para ver; por fechar, com as acções de sempre", () => {
    expect(PAINEL).toContain("const soLeitura = tudoFechado(t) && !t.contaDeTeste;");
    expect(PAINEL).toContain("{aberto && mexeNoDinheiro && !soLeitura && (");
    expect(PAINEL).toContain("{aberto && !mexeNoDinheiro && !soLeitura && (");
    // A gaveta usa o mesmo trabalho da lista, aberto.
    const GAVETA = entre(PAINEL, "{trabalhoDaGaveta ? (", "</Gaveta>");
    expect(GAVETA).toContain("<Linha");
    expect(GAVETA).toContain("naGaveta");
  });

  it("o histórico: lido de uma rota que só lê, aberta a quem tem os Pagamentos", () => {
    expect(PAINEL).toContain("fetch(`/api/admin/pagamentos/historico?${q}`");
    expect(PAINEL).toContain("abertoDeInicio={naGaveta || soLeitura}");
    const ROTA = semNotas(ler("src/app/api/admin/pagamentos/historico/route.ts"));
    expect(ROTA).toContain("await requireAdmin(req)");
    expect(ROTA).toContain("export async function GET(");
    expect(ROTA).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)\(/);
    expect(ROTA).not.toMatch(/\b(UPDATE|INSERT|DELETE FROM)\b/);
    expect(ROTA).not.toContain("markOrderAsViewed");
    expect(assistenteComSeccoesPodeChamar(["pagamentos"], "/api/admin/pagamentos/historico", "GET")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["agenda"], "/api/admin/pagamentos/historico", "GET")).toBe(false);
  });
});
