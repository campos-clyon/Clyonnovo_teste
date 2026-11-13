import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LIMITE_DOS_AVISOS,
  fasesDosTrabalhos,
  juntarAvisos,
  lerAvisosGuardados,
  linhaDosPedidosNovos,
  marcarComoLido,
  marcarTodosComoLidos,
  numeroDoSino,
  oQueMudou,
  quantosPorLer,
  retomarSeForDestaConta,
  textoDosAvisos,
  type AvisoDoProfissional,
} from "./avisos-do-profissional";

/**
 * O SINO DO PROFISSIONAL — 13-11-2026 (d13, ordem do CEO aprovada pelo dono).
 *
 * Quem ficava dias sem abrir a app encontrava no topo do Feed uma pilha de
 * «Pedido novo dentro do seu raio — #604. Abra para propor.», a fechar um a um
 * (o dono tinha dez). Isto guarda: que o pedido novo deixou de ser aviso e dá
 * no máximo UMA linha; que o resto vai para o sino, do mais recente para o
 * mais antigo, até 30, com «Marcar tudo como lido»; que o lido persiste; e que
 * a app e o painel fazem o mesmo, pela mesma fonte.
 */

const cru = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem comentários, com a regra ancorada ao início da linha. */
const ler = (p: string) =>
  cru(p)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FEED = ler("app-pro/src/app/(app)/index.tsx");
const ESTADO = ler("app-pro/src/estado/Trabalhos.tsx");
const PAINEL = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");
const LISTA_DO_PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");

const t = (negociacaoId: number, fase: string, pedidoId = 600 + negociacaoId) => ({ negociacaoId, pedidoId, fase });
const aviso = (id: string, em: string, lido = false): AvisoDoProfissional => ({
  id,
  texto: id,
  negociacaoId: Number(id.split("-")[1] ?? 0),
  em,
  lido,
});

describe("as regras", () => {
  it("dez pedidos novos não dão dez avisos: dão uma linha", () => {
    const antes = fasesDosTrabalhos([t(1, "a_negociar")]);
    const depois = [t(1, "a_negociar"), ...Array.from({ length: 10 }, (_, i) => t(10 + i, "a_negociar"))];
    const r = oQueMudou(antes, depois);
    expect(r.avisos).toEqual([]);
    expect(r.pedidosNovos).toHaveLength(10);
    expect(linhaDosPedidosNovos(r.pedidosNovos.length)).toBe("10 pedidos novos desde a última vez");
    expect(linhaDosPedidosNovos(1)).toBe("1 pedido novo desde a última vez");
    expect(linhaDosPedidosNovos(0)).toBeNull();
  });

  it("os avisos ficam do mais recente para o mais antigo, sem repetir, e no máximo 30", () => {
    const velhos = Array.from({ length: 30 }, (_, i) =>
      aviso(`pago-${i}`, new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(), true),
    );
    const novo = aviso("contratado-99", "2026-11-13T09:00:00.000Z");
    const junto = juntarAvisos(velhos, [novo, velhos[0]]);
    expect(junto).toHaveLength(LIMITE_DOS_AVISOS);
    expect(LIMITE_DOS_AVISOS).toBe(30);
    expect(junto[0].id).toBe("contratado-99");
    // O mais antigo saiu; o que já estava lido continua lido.
    expect(junto.some((a) => a.id === "pago-0")).toBe(false);
    expect(junto.filter((a) => a.id === "pago-29")[0].lido).toBe(true);
  });

  it("«Marcar tudo como lido» limpa o número de uma vez; abrir um dá-o por lido", () => {
    const lista = [aviso("contratado-1", "2026-11-13T09:00:00Z"), aviso("pago-2", "2026-11-13T08:00:00Z")];
    expect(quantosPorLer(lista)).toBe(2);
    expect(quantosPorLer(marcarComoLido(lista, "pago-2"))).toBe(1);
    expect(quantosPorLer(marcarTodosComoLidos(lista))).toBe(0);
    expect(numeroDoSino(0)).toBeNull();
    expect(numeroDoSino(3)).toBe("3");
    expect(numeroDoSino(12)).toBe("9+");
  });

  it("o lido persiste entre aberturas — e só se retoma o que é desta conta", () => {
    const fases = fasesDosTrabalhos([t(1, "a_executar"), t(2, "a_negociar")]);
    const lista = marcarTodosComoLidos([aviso("contratado-1", "2026-11-13T09:00:00Z")]);
    const guardado = lerAvisosGuardados(textoDosAvisos(fases, lista));
    expect(guardado?.avisos[0].lido).toBe(true);
    expect([...(guardado?.fases ?? new Map()).entries()]).toEqual([...fases.entries()]);
    // Da mesma conta: partilha negociações com a lista acabada de ler.
    expect(retomarSeForDestaConta(guardado, [t(2, "a_negociar"), t(3, "a_negociar")])).toBe(guardado);
    // De outra conta (nenhuma negociação em comum), vazio ou estragado: nada.
    expect(retomarSeForDestaConta(guardado, [t(50, "a_negociar")])).toBeNull();
    expect(retomarSeForDestaConta(lerAvisosGuardados(textoDosAvisos(new Map(), [])), [t(1, "x")])).toBeNull();
    expect(lerAvisosGuardados("{estragado")).toBeNull();
    expect(lerAvisosGuardados(JSON.stringify({ versao: 99, fases: [], avisos: [] }))).toBeNull();
  });

  it("o que se guarda não tem nada do cliente: números, fases e as frases", () => {
    const texto = textoDosAvisos(fasesDosTrabalhos([t(1, "a_executar")]), [aviso("contratado-1", "2026-11-13T09:00:00Z")]);
    expect(Object.keys(JSON.parse(texto)).sort()).toEqual(["avisos", "fases", "versao"]);
    expect(Object.keys(JSON.parse(texto).avisos[0]).sort()).toEqual(["em", "id", "lido", "negociacaoId", "texto"]);
  });
});

describe("⚠️ nunca uma pilha de «Pedido novo» no Feed", () => {
  it("a frase do pedido novo saiu de todo o lado", () => {
    for (const f of [
      "app-pro/src/lib/trabalhos.ts",
      "app-pro/src/app/(app)/index.tsx",
      "app-pro/src/estado/Trabalhos.tsx",
      "src/app/profissionais/painel/PainelDoProfissional.tsx",
      "src/app/profissionais/painel/Trabalhos.tsx",
      "src/lib/avisos-do-profissional.ts",
    ]) {
      expect(cru(f), f).not.toContain("Pedido novo dentro do seu raio");
    }
  });

  it("o Feed da app: os avisos não entram na lista; os novos dão uma linha só (um texto, não uma lista)", () => {
    const cabecaDaLista = FEED.slice(FEED.indexOf("ListHeaderComponent={"), FEED.indexOf("ListEmptyComponent={"));
    expect(cabecaDaLista.length).toBeGreaterThan(0);
    expect(cabecaDaLista).not.toMatch(/avisos|novidades/);
    expect(cabecaDaLista).toContain("{linhaDosNovos && separador === \"novos\" ? (");
    expect(FEED).toContain("const linhaDosNovos = linhaDosPedidosNovos(pedidosNovos);");
    // Só a lista do sino mostra avisos.
    expect(FEED.match(/data=\{avisos\}/g)).toHaveLength(1);
    expect(FEED).toContain('<Modal visible={aberto}');
    // Ao sair do Feed, a linha já foi vista.
    expect(FEED).toContain("useFocusEffect(useCallback(() => () => verPedidosNovos(), [verPedidosNovos]));");
  });

  it("o painel: sem a pilha no canto do ecrã; os avisos só dentro do sino; a linha só na lista", () => {
    expect(PAINEL).not.toContain("fixed inset-x-3 bottom-3");
    expect(PAINEL).not.toContain("novidades");
    expect(PAINEL.match(/avisos\.map\(/g)).toHaveLength(1);
    const sino = PAINEL.slice(PAINEL.indexOf('role="dialog"'), PAINEL.indexOf("onClick={voltar}"));
    expect(sino).toContain("avisos.map((a) => (");
    expect(LISTA_DO_PAINEL).toContain("{linhaDosNovos && separador === \"novos\" && (");
    expect(PAINEL).toContain("linhaDosNovos={linhaDosPedidosNovos(pedidosNovos)}");
  });
});

describe("a app e o painel fazem o mesmo", () => {
  it("as mesmas frases do sino, da mesma fonte", () => {
    for (const nome of ["linhaDosPedidosNovos", "MARCAR_TUDO_COMO_LIDO", "numeroDoSino", "SEM_AVISOS", "TITULO_DOS_AVISOS"]) {
      expect(FEED, nome).toContain(nome);
      expect(PAINEL, nome).toContain(nome);
    }
    for (const nome of ["oQueMudou", "juntarAvisos", "retomarSeForDestaConta", "marcarTodosComoLidos", "marcarComoLido"]) {
      expect(ESTADO, nome).toContain(nome);
      expect(PAINEL, nome).toContain(nome);
    }
  });

  it("a hora do aviso é a de Lisboa, nas duas (dataEHora)", () => {
    expect(FEED).toContain("{dataEHora(a.em)}");
    expect(PAINEL).toContain("{dataEHora(a.em)}");
  });

  it("o lido guarda-se nas duas, e sai ao sair da conta", () => {
    expect(ESTADO).toContain("guardarAvisos(fasesAnteriores.current, lista);");
    expect(ESTADO).toContain("apagarAvisosGuardados();");
    expect(PAINEL).toContain("guardarAvisosNoAparelho(fotografiaAnterior.current, lista);");
    expect(PAINEL).toContain("esquecerAvisosDoAparelho();");
  });
});
