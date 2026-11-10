import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { METODO_TRANSFERENCIA } from "./transferencia-bancaria";
import { abreOPagamentoDepoisDeContratar, estadoDoPagar } from "../../app-cliente/src/lib/pagamento";
import type { Pagamento } from "../../app-cliente/src/lib/pedidos";
import * as demoNativa from "../../app-pro/src/lib/demo";

/**
 * d25 (10-11-2026, ordem do CEO com o sim do dono) — a parte das apps.
 *
 * 1. Na app de cliente, «Contratar» abre logo o ecrã de pagar, como o site
 *    desde a d20: sem a confirmação no meio, sem voltar ao pedido para
 *    carregar em «Pagar». A guia por verificar (d10) continua a parar o botão,
 *    e uma transferência à espera (d13) continua sem oferecer o MB WAY nem o
 *    Multibanco.
 * 2. Na app Pro, a demonstração (exemplos inventados, com números que não são
 *    os reais) fica fora do bundle do telemóvel: vive em `demo.web.ts`, que o
 *    Metro só junta à web; o `demo.ts` que o Android resolve não leva nada.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários de linha inteira (regra ancorada ao início da linha) nem os blocos. */
const semNotas = (p: string) =>
  ler(p)
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

const pagamento = (extra: Partial<Pagamento> = {}): Pagamento => ({
  disponivel: true,
  pago: false,
  pagoEmTexto: null,
  emDinheiroAoProfissional: false,
  pendentes: [],
  ivaIncluido: true,
  valoresTexto: { comFactura: "452,03 € (367,50 € sem IVA)", semFactura: "367,50 €" },
  ...extra,
});
const AGORA = Date.parse("2026-11-10T12:00:00Z");
const daquiA = (min: number) => new Date(AGORA + min * 60_000).toISOString();

describe("depois de contratar, vai-se ao ecrã de pagar quando há lá o que fazer", () => {
  it("por pagar: abre o pagamento", () => {
    expect(abreOPagamentoDepoisDeContratar(pagamento(), AGORA)).toBe(true);
  });

  it("um MB WAY a confirmar: abre o pagamento (a contagem está lá)", () => {
    const pg = pagamento({
      pendentes: [{ metodo: "mbway", metodoTexto: "MB WAY", entidade: null, referencia: null, valorTexto: "452,03 €", expiraEm: daquiA(4), expiraEmTexto: null }],
    });
    expect(abreOPagamentoDepoisDeContratar(pg, AGORA)).toBe(true);
  });

  it("uma transferência à espera: abre o pagamento, que a mostra sem oferecer o MB WAY nem o Multibanco (d13)", () => {
    const pg = pagamento({
      aEsperaDaTransferencia: true,
      transferencia: null,
      pendentes: [{ metodo: METODO_TRANSFERENCIA, metodoTexto: "Transferência", entidade: null, referencia: null, valorTexto: "452,03 €", expiraEm: null, expiraEmTexto: null }],
    });
    expect(estadoDoPagar(pg, AGORA).tipo).toBe("a-espera-da-transferencia");
    expect(abreOPagamentoDepoisDeContratar(pg, AGORA)).toBe(true);
  });

  it("pago, a pagar ao parceiro no local, ou com a porta fechada: fica-se no pedido", () => {
    expect(abreOPagamentoDepoisDeContratar(pagamento({ pago: true }), AGORA)).toBe(false);
    expect(abreOPagamentoDepoisDeContratar(pagamento({ emDinheiroAoProfissional: true }), AGORA)).toBe(false);
    expect(abreOPagamentoDepoisDeContratar(pagamento({ disponivel: false }), AGORA)).toBe(false);
    expect(abreOPagamentoDepoisDeContratar(null, AGORA)).toBe(false);
    expect(abreOPagamentoDepoisDeContratar(undefined, AGORA)).toBe(false);
  });
});

describe("«Contratar» leva directo ao ecrã de pagar", () => {
  const VISTA = semNotas("app-cliente/src/componentes/VistaDoPedido.tsx");
  const inicio = VISTA.indexOf("async function contratar(n: NegociacaoV3) {");
  const fim = VISTA.indexOf("async function confirmarRecusar()");
  const CONTRATAR = VISTA.slice(inicio, fim);

  it("a proposta contrata com um toque — sem a confirmação «Contratar» no meio", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(inicio);
    expect(VISTA).toContain("aoContratar={() => void contratar(n)}");
    expect(VISTA).not.toMatch(/confirmar="Contratar"/);
    expect(VISTA).not.toContain("confirmarContratar");
  });

  it("contratado, lê o pedido e abre /pagar/<id> quando há o que pagar", () => {
    const accao = CONTRATAR.indexOf('await pedir(ROTA_DAS_ACCOES, { metodo: "POST", corpo: { pedidoId, negociacaoId: n.id, accao } });');
    const leitura = CONTRATAR.indexOf("const lido = await carregar();");
    const vai = CONTRATAR.indexOf(
      "if (!convidado && abreOPagamentoDepoisDeContratar(n2?.pagamento, Date.now())) router.push(`/pagar/${pedidoId}`);",
    );
    expect(accao).toBeGreaterThan(-1);
    expect(leitura).toBeGreaterThan(accao);
    expect(vai).toBeGreaterThan(leitura);
    expect(CONTRATAR).toContain("const n2 = lido ? contratadaDe(lido) : null;");
  });

  it("uma recusa do servidor (409, a guia, outro lado) diz a frase e não abre o pagamento", () => {
    const erro = CONTRATAR.slice(CONTRATAR.indexOf("} catch (e) {"), CONTRATAR.indexOf("const lido = await carregar();"));
    expect(erro).toContain("setAvisoDaAccao(mensagemDe(e));");
    expect(erro).toContain("return;");
    expect(erro).not.toContain("router.push");
  });

  it("o ecrã de pagar é a rota /pagar/[id], o mesmo de «Pagar Z €»", () => {
    expect(ler("app-cliente/src/app/pagar/[id].tsx")).toContain("EcraDePagar");
    expect(ler("app-cliente/src/componentes/Pagar.tsx")).toContain("router.push(`/pagar/${pedidoId}`)");
  });

  it("carregar devolve o pedido que leu (para se decidir com o estado novo, não com o de antes)", () => {
    expect(VISTA).toContain("const carregar = useCallback(async (silencioso = false): Promise<Resposta | null> => {");
    expect(VISTA).toContain("return lido;");
  });
});

describe("a guia trava como antes (d10)", () => {
  const VISTA = semNotas("app-cliente/src/componentes/VistaDoPedido.tsx");
  const PROPOSTA = ler("app-cliente/src/componentes/Proposta.tsx");

  it("o botão fica parado com o porquê por cima", () => {
    expect(PROPOSTA).toMatch(/const parado = porqueNaoSeContrata\(n\);/);
    expect(PROPOSTA).toContain('{parado ? <Aviso tom="aviso" texto={parado} /> : null}');
    expect(PROPOSTA).toContain('<Botao titulo="Contratar" aoCarregar={aoContratar} ocupado={aContratar} desligado={!!parado || desligado} />');
  });

  it("e mesmo que o toque chegasse, contratar não manda nada com a guia por verificar", () => {
    expect(VISTA).toContain("if (!accao || porqueNaoSeContrata(n) || aContratar) return;");
  });
});

describe("a demonstração da app Pro fica fora do bundle do telemóvel", () => {
  const PASTA = join(RAIZ, "app-pro/src");
  const fontes = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const c = join(d, n);
      return statSync(c).isDirectory() ? fontes(c) : /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [c] : [];
    });

  it("o demo.ts que o Android resolve não leva exemplos, números nem regras", () => {
    const nativa = semNotas("app-pro/src/lib/demo.ts");
    expect(nativa).not.toMatch(/taxas|profissional:|cliente:|0\.0\d|import /);
    expect(nativa).toContain("export const EM_DEMO = false;");
    expect(demoNativa.EM_DEMO).toBe(false);
    return expect(demoNativa.pedirEmDemo("/api/profissionais/me", "GET", undefined)).rejects.toThrow();
  });

  it("os exemplos vivem em demo.web.ts, só para o navegador, com o mesmo interruptor", () => {
    const web = ler("app-pro/src/lib/demo.web.ts");
    expect(web).toContain('export const EM_DEMO = process.env.EXPO_PUBLIC_DEMO === "1";');
    expect(web).toContain("export async function pedirEmDemo<T>(caminho: string, metodo: string, corpo: unknown): Promise<T> {");
  });

  it("nenhum ficheiro da app importa o demo.web à mão (o Metro escolhe pela plataforma)", () => {
    const quem = fontes(PASTA).filter((f) => /(from\s*|require\(\s*|import\(\s*)["'][^"']*demo\.web/.test(readFileSync(f, "utf8")));
    expect(quem).toEqual([]);
    expect(ler("app-pro/src/lib/api.ts")).toContain('import { EM_DEMO, pedirEmDemo } from "./demo";');
  });
});
