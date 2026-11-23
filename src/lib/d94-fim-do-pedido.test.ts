import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  avisoDoFimNoTelemovel,
  avisosDoSinoDoFim,
  fimDoEstado,
  fimParaOProfissional,
  motivoAoProfissional,
  oQuePrendeOPedido,
  porQueNaoSeApaga,
  quemSabeDoFim,
  SEM_DINHEIRO,
  textoDoFim,
} from "./fim-do-pedido";
import { contarPorSeparador, etiquetaDoFim, SEPARADORES, separadorDe, type Trabalho } from "../../app-pro/src/lib/trabalhos";

/**
 * d94 (dono, 23-11-2026): o estado de um pedido chega a TODAS as contas dos
 * profissionais — cancelado, arquivado, apagado — pela função única
 * `fimDoPedido`. Dados inventados: nenhum nome nem contacto de ninguém.
 */

const viva = (id: number, providerId: number, estado: string, extra: Record<string, unknown> = {}) => ({
  id,
  providerId,
  estado,
  propostasJson: null as string | null,
  execucaoEnviadaEm: null as unknown,
  confirmadoEm: null as unknown,
  pagoEm: null as unknown,
  ...extra,
});
const comProposta = JSON.stringify([{ por: "profissional", valor: 120, estado: "pendente" }]);

describe("d94 — as regras do fim do pedido (puras)", () => {
  it("o estado do pedido diz o fim: cancelado, arquivado (e rejeitado), ou nenhum", () => {
    expect(fimDoEstado("cancelado")).toBe("cancelado");
    expect(fimDoEstado("arquivado")).toBe("arquivado");
    expect(fimDoEstado("rejeitado")).toBe("arquivado");
    for (const s of ["sem_assistente", "atribuido", "concluido", "precisa_info", null, undefined]) {
      expect(fimDoEstado(s as string | null)).toBeNull();
    }
  });

  it("cancelado vai SEMPRE para os Cancelados — do feed, da negociação, do contratado, até concluído por engano", () => {
    for (const n of [
      viva(1, 9, "morta"),
      viva(2, 9, "acordada"),
      viva(3, 9, "acordada", { execucaoEnviadaEm: "2026-11-20", confirmadoEm: "2026-11-21", pagoEm: "2026-11-22" }),
    ]) {
      expect(fimParaOProfissional("cancelado", n)).toBe("cancelado");
    }
  });

  it("arquivado vai para os Arquivados, menos o trabalho que ele já fez (fica nos Terminados — d27)", () => {
    expect(fimParaOProfissional("arquivado", viva(1, 9, "morta"))).toBe("arquivado");
    expect(fimParaOProfissional("rejeitado", viva(1, 9, "aberta"))).toBe("arquivado");
    expect(fimParaOProfissional("arquivado", viva(2, 9, "acordada", { execucaoEnviadaEm: "x" }))).toBeNull();
    expect(fimParaOProfissional("arquivado", viva(3, 9, "acordada", { confirmadoEm: "x", pagoEm: "y" }))).toBeNull();
    expect(fimParaOProfissional("sem_assistente", viva(4, 9, "aberta"))).toBeNull();
    expect(fimParaOProfissional("concluido", viva(5, 9, "acordada", { confirmadoEm: "x" }))).toBeNull();
  });

  it("quem é avisado: no cancelado e no apagado, quem o via, negociava ou estava contratado — um por profissional", () => {
    const negs = [
      viva(10, 1, "aberta"),
      viva(11, 2, "aguarda_contratacao"),
      viva(12, 3, "acordada"),
      viva(13, 4, "morta"),
      viva(14, 5, "desistida"),
      viva(15, 1, "aberta"),
    ];
    for (const fim of ["cancelado", "apagado"] as const) {
      expect(quemSabeDoFim(fim, negs)).toEqual([
        { negociacaoId: 10, providerId: 1 },
        { negociacaoId: 11, providerId: 2 },
        { negociacaoId: 12, providerId: 3 },
      ]);
    }
  });

  it("no arquivado, só quem estava mesmo no pedido e o perde (propôs, aceitou ou foi contratado, sem trabalho feito)", () => {
    const negs = [
      viva(20, 1, "aberta"), // só no feed: passa para os Arquivados, sem notificação
      viva(21, 2, "aberta", { propostasJson: comProposta }),
      viva(22, 3, "aguarda_contratacao"),
      viva(23, 4, "acordada"),
      viva(24, 5, "acordada", { execucaoEnviadaEm: "2026-11-20" }),
      viva(25, 6, "morta"),
    ];
    expect(quemSabeDoFim("arquivado", negs).map((q) => q.negociacaoId)).toEqual([21, 22, 23]);
  });

  it("as frases da notificação são as da ordem: «Pedido #N cancelado — motivo», «arquivado{ — motivo}», «apagado — motivo»", () => {
    expect(textoDoFim("cancelado", 630, "a cliente desistiu")).toBe("Pedido #630 cancelado — a cliente desistiu");
    expect(textoDoFim("arquivado", 630, null)).toBe("Pedido #630 arquivado");
    expect(textoDoFim("arquivado", 630, "o cliente não respondeu ao orçamento")).toBe(
      "Pedido #630 arquivado — o cliente não respondeu ao orçamento",
    );
    expect(textoDoFim("apagado", 630, "  repetido \n")).toBe("Pedido #630 apagado — repetido");
    const t = avisoDoFimNoTelemovel("cancelado", 630, "a cliente desistiu.");
    expect(t.title).toBe("Pedido #630 cancelado");
    expect(t.body).toContain("Motivo: a cliente desistiu.");
    expect(t.body).not.toContain("..");
    expect(avisoDoFimNoTelemovel("apagado", 7).body).not.toMatch(/Motivo/);
  });

  it("o motivo ao profissional: o texto escrito, ou a escolha da lista do fecho em minúsculas («outro» fica de fora)", () => {
    expect(motivoAoProfissional("o cliente mudou de ideias", "preco")).toBe("o cliente mudou de ideias");
    expect(motivoAoProfissional("", "ja_nao_precisa")).toBe("já não precisa");
    expect(motivoAoProfissional(null, "preco")).toBe("preço");
    expect(motivoAoProfissional(null, "outro")).toBeNull();
    expect(motivoAoProfissional(undefined, null)).toBeNull();
  });

  it("no sino: o id é o da linha (o mesmo acontecimento é o mesmo aviso) e um apagado não abre nada", () => {
    const sino = avisosDoSinoDoFim([
      { id: 5, pedidoId: 630, negociacaoId: 3778, fim: "cancelado", texto: "Pedido #630 cancelado", em: "2026-11-23T10:00:00.000Z" },
      { id: 6, pedidoId: 631, negociacaoId: null, fim: "apagado", texto: "Pedido #631 apagado — repetido", em: "2026-11-23T11:00:00.000Z" },
    ]);
    expect(sino.map((a) => [a.id, a.negociacaoId, a.lido])).toEqual([
      ["fim-5", 3778, false],
      ["fim-6", 0, false],
    ]);
    expect(avisosDoSinoDoFim(undefined)).toEqual([]);
  });

  it("um pedido com dinheiro não se apaga — e a recusa diz porquê e o que fazer", () => {
    expect(oQuePrendeOPedido(SEM_DINHEIRO)).toEqual([]);
    for (const campo of ["pagamentos", "faturas", "dividas", "movimentosDaCarteira", "comprovativos", "comissoes"] as const) {
      expect(oQuePrendeOPedido({ ...SEM_DINHEIRO, [campo]: 1 })).toHaveLength(1);
    }
    for (const campo of ["pagoAoProfissional", "confirmado", "clientePagou"] as const) {
      expect(oQuePrendeOPedido({ ...SEM_DINHEIRO, [campo]: true })).toHaveLength(1);
    }
    const frase = porQueNaoSeApaga(630, oQuePrendeOPedido({ ...SEM_DINHEIRO, pagamentos: 2, pagoAoProfissional: true }));
    expect(frase).toMatch(/^O pedido #630 não se apaga: /);
    expect(frase).toMatch(/cancele-o ou arquive-o/);
  });
});

describe("d94 — as listas do profissional nunca mostram um cancelado ou arquivado fora do sítio certo", () => {
  const base = (extra: Partial<Trabalho>): Trabalho =>
    ({
      negociacaoId: 1,
      pedidoId: 630,
      estado: "aberta",
      propostas: "[]",
      arquivadoEm: null,
      confirmadoEm: null,
      pagoEm: null,
      fase: "a_executar",
      actualizadoEm: "2026-11-23T10:00:00.000Z",
      ...extra,
    }) as unknown as Trabalho;

  it("a app tem o separador «Cancelados» entre os Recusados e os Arquivados", () => {
    const ids = SEPARADORES.map((s) => s.id);
    expect(ids.indexOf("cancelados")).toBe(ids.indexOf("recusados") + 1);
    expect(ids.indexOf("arquivados")).toBe(ids.indexOf("cancelados") + 1);
  });

  it("cancelado: Cancelados, venha de onde vier (feed, negociação, contratado, terminado por engano)", () => {
    for (const t of [
      base({ estado: "aberta", fimDoPedido: "cancelado" }),
      base({ estado: "aguarda_contratacao", fimDoPedido: "cancelado" }),
      base({ estado: "acordada", fimDoPedido: "cancelado" }),
      base({ estado: "acordada", confirmadoEm: "2026-11-21", fimDoPedido: "cancelado" }),
      base({ estado: "morta", fimDoPedido: "cancelado", arquivadoEm: "2026-11-22" }),
    ]) {
      expect(separadorDe(t)).toBe("cancelados");
    }
  });

  it("arquivado: Arquivados; sem fim, a negociação decide como sempre", () => {
    expect(separadorDe(base({ estado: "morta", fimDoPedido: "arquivado" }))).toBe("arquivados");
    expect(separadorDe(base({ estado: "acordada", fimDoPedido: "arquivado" }))).toBe("arquivados");
    expect(separadorDe(base({ estado: "acordada", fimDoPedido: null }))).toBe("contratados");
    expect(separadorDe(base({ estado: "aberta" }))).toBe("novos");
  });

  it("em nenhuma combinação um cancelado ou arquivado cai no Feed, na negociação ou nos contratados", () => {
    const estados = ["aberta", "aguarda_contratacao", "acordada", "desistida", "morta"];
    const fins = ["cancelado", "arquivado"] as const;
    for (const estado of estados)
      for (const fimDoPedido of fins)
        for (const confirmadoEm of [null, "2026-11-21"])
          for (const propostas of ["[]", comProposta]) {
            const s = separadorDe(base({ estado, fimDoPedido, confirmadoEm, propostas } as unknown as Partial<Trabalho>));
            expect(["novos", "negociacao", "contratados", "terminados", "recusados"]).not.toContain(s);
          }
    const contas = contarPorSeparador([base({ fimDoPedido: "cancelado" }), base({ fimDoPedido: "arquivado" })]);
    expect(contas.cancelados).toBe(1);
    expect(contas.arquivados).toBe(1);
  });

  it("o cartão diz o porquê: «cancelado — motivo», «arquivado — motivo»", () => {
    expect(etiquetaDoFim({ fimDoPedido: "cancelado", motivoDoFim: "a cliente desistiu" }, "cancelados")?.texto).toBe(
      "cancelado — a cliente desistiu",
    );
    expect(etiquetaDoFim({ fimDoPedido: "arquivado", motivoDoFim: null }, "arquivados")?.texto).toBe("pedido arquivado");
    expect(etiquetaDoFim({ fimDoPedido: null, motivoDoFim: null }, "arquivados")).toBeNull();
  });
});

/* ── A função única, com a base fingida ─────────────────────────────────── */

const estado = vi.hoisted(() => ({
  inserts: [] as Array<unknown[]>,
  jaExiste: new Set<string>(),
  pushes: [] as Array<{ email: string; title: string; body: string; negociacaoId?: number }>,
  matar: 0,
  fecharPorFazer: 0,
  negociacoes: [] as Array<Record<string, unknown>>,
  ordem: [] as string[],
}));

vi.mock("./db", () => ({
  getPool: async () => ({
    execute: async (sql: string, args: unknown[] = []) => {
      if (/^\s*CREATE TABLE/i.test(sql)) return [{}, null];
      if (/INSERT IGNORE INTO avisosDoFimDoPedido/.test(sql)) {
        const chave = `${args[0]}-${args[1]}-${args[3]}`;
        estado.ordem.push("aviso");
        if (estado.jaExiste.has(chave)) return [{ affectedRows: 0 }, null];
        estado.jaExiste.add(chave);
        estado.inserts.push(args);
        return [{ affectedRows: 1, insertId: estado.inserts.length }, null];
      }
      if (/UPDATE avisosDoFimDoPedido SET pushEm/.test(sql)) return [{ affectedRows: 1 }, null];
      if (/FROM negociacoes WHERE pedidoId/.test(sql)) return [estado.negociacoes, null];
      return [[], null];
    },
  }),
  ensureNegociacoesTable: async () => {},
  matarNegociacoesDoPedido: async () => {
    estado.ordem.push("fechar");
    estado.matar += 1;
    return estado.negociacoes.length;
  },
  fecharNegociacoesDeUmPedidoArrumado: async () => {
    estado.ordem.push("fechar");
    estado.fecharPorFazer += 1;
    return 1;
  },
  perfilDoProfissional: async (id: number) => ({ email: `pro${id}@exemplo.test` }),
}));
vi.mock("./webpush", () => ({
  sendPushToUser: async (email: string, p: { title: string; body: string; negociacaoId?: number }) => {
    estado.ordem.push("push");
    estado.pushes.push({ email, title: p.title, body: p.body, negociacaoId: p.negociacaoId });
    return 1;
  },
}));
vi.mock("./url-do-site", () => ({ urlDeAccao: () => "https://exemplo.test" }));

describe("d94 — fimDoPedido: fecha, grava o estado e avisa cada profissional uma vez", () => {
  beforeEach(() => {
    estado.inserts = [];
    estado.jaExiste = new Set();
    estado.pushes = [];
    estado.matar = 0;
    estado.fecharPorFazer = 0;
    estado.ordem = [];
    estado.negociacoes = [viva(31, 1, "aberta"), viva(32, 2, "acordada"), viva(33, 3, "morta")];
  });

  it("cancelar (a Mesa, o cliente, os lembretes): fecha tudo, grava o estado ANTES de avisar, e avisa quem o tinha", async () => {
    const { fimDoPedido } = await import("./fim-do-pedido-na-base");
    const r = await fimDoPedido(630, {
      fim: "cancelado",
      como: "tudo",
      motivo: "a cliente desistiu",
      depoisDeFechar: async () => {
        estado.ordem.push("estado");
      },
    });
    expect(estado.matar).toBe(1);
    expect(r.avisados).toBe(2);
    expect(estado.ordem.slice(0, 2)).toEqual(["fechar", "estado"]);
    expect(estado.pushes.map((p) => [p.email, p.title, p.negociacaoId])).toEqual([
      ["pro1@exemplo.test", "Pedido #630 cancelado", 31],
      ["pro2@exemplo.test", "Pedido #630 cancelado", 32],
    ]);
    expect(estado.inserts[0]).toEqual([1, 630, 31, "cancelado", "a cliente desistiu", "Pedido #630 cancelado — a cliente desistiu"]);
  });

  it("o mesmo fim duas vezes (dois caminhos, uma rotina repetida) não toca duas vezes", async () => {
    const { fimDoPedido } = await import("./fim-do-pedido-na-base");
    await fimDoPedido(630, { fim: "cancelado", como: "por_fazer" });
    await fimDoPedido(630, { fim: "cancelado", como: "por_fazer" });
    expect(estado.pushes).toHaveLength(2);
    expect(estado.fecharPorFazer).toBe(2);
  });

  it("arquivar (o «Arquivar», a validade d62, o seguimento d83): só as por fazer, e avisa quem estava no pedido", async () => {
    estado.negociacoes = [viva(41, 1, "aberta"), viva(42, 2, "aberta", { propostasJson: comProposta }), viva(43, 3, "acordada")];
    const { fimDoPedido } = await import("./fim-do-pedido-na-base");
    await fimDoPedido(631, { fim: "arquivado", motivo: "o cliente não respondeu ao orçamento" });
    expect(estado.matar).toBe(0);
    expect(estado.fecharPorFazer).toBe(1);
    expect(estado.pushes.map((p) => p.negociacaoId)).toEqual([42, 43]);
    expect(estado.inserts[0]?.[5]).toBe("Pedido #631 arquivado — o cliente não respondeu ao orçamento");
  });

  it("apagar: não fecha nada (as negociações vão com o pedido), avisa sem ligação; a purga não avisa", async () => {
    const { fimDoPedido } = await import("./fim-do-pedido-na-base");
    const antes = [viva(51, 1, "aberta"), viva(52, 2, "aguarda_contratacao")];
    await fimDoPedido(632, { fim: "apagado", motivo: "repetido", negociacoesAntes: antes });
    expect(estado.matar + estado.fecharPorFazer).toBe(0);
    expect(estado.pushes.map((p) => [p.title, p.negociacaoId])).toEqual([
      ["Pedido #632 apagado", undefined],
      ["Pedido #632 apagado", undefined],
    ]);
    expect(estado.inserts.every((a) => a[2] === null)).toBe(true);

    estado.pushes = [];
    await fimDoPedido(633, { fim: "apagado", negociacoesAntes: antes, avisar: false });
    expect(estado.pushes).toHaveLength(0);
  });
});

/* ── Todos os caminhos passam pela função única (teste de fonte) ─────────── */

const RAIZ = join(__dirname, "..", "..");
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

function corpoDaFuncao(fonte: string, assinatura: RegExp): string {
  const i = fonte.search(assinatura);
  expect(i, String(assinatura)).toBeGreaterThan(-1);
  const resto = fonte.slice(i);
  const fim = resto.slice(1).search(/\nexport (async )?function |\nexport class /);
  return fim > -1 ? resto.slice(0, fim + 1) : resto;
}

function ficheirosTs(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheirosTs(p, out);
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(p);
  }
  return out;
}

describe("d94 — todos os caminhos de cancelar, arquivar e apagar chamam a função única", () => {
  const db = semComentarios(ler("src/lib/db.ts"));

  it("as quatro portas da base passam por fimDoPedido", () => {
    expect(corpoDaFuncao(db, /export async function cancelarPedido\(/)).toMatch(/fimDoPedido\(pedidoId, \{\s*fim: "cancelado",\s*como: "tudo"/);
    expect(corpoDaFuncao(db, /export async function updateSimulatorOrder\(/)).toMatch(/fimNaBase\.fimDoPedido\(id,/);
    expect(corpoDaFuncao(db, /export async function cancelarOrcamentoPeloCliente\(/)).toMatch(/fimDoPedido\(order\.id, \{ fim: "cancelado"/);
    const apagar = corpoDaFuncao(db, /export async function deleteSimulatorOrder\(/);
    expect(apagar).toMatch(/fim: "apagado"/);
    // As notificações do apagado só depois do commit; o dinheiro antes de tudo.
    expect(apagar.indexOf('fim: "apagado"')).toBeGreaterThan(apagar.indexOf("await conn.commit()"));
    expect(apagar.indexOf("oQuePrendeOPedidoNaBase")).toBeGreaterThan(-1);
    expect(apagar.indexOf("oQuePrendeOPedidoNaBase")).toBeLessThan(apagar.indexOf("beginTransaction"));
    expect(apagar).toMatch(/throw new PedidoComDinheiro\(id, razoes\)/);
  });

  it("o desfazer (reabrir, restaurar, sair do arquivo) esquece as notificações, para um fim a seguir voltar a avisar", () => {
    expect(corpoDaFuncao(db, /export async function reabrirPedidoCancelado\(/)).toMatch(/esquecerFimDoPedido\(pedidoId\)/);
    expect(corpoDaFuncao(db, /export async function restaurarPedidoArrumado\(/)).toMatch(/esquecerFimDoPedido\(pedidoId\)/);
    expect(corpoDaFuncao(db, /export async function updateSimulatorOrder\(/)).toMatch(/esquecerFimDoPedido\(id\)/);
  });

  it("ninguém escreve cancelado/arquivado nem apaga um pedido por fora das portas (salvo a excepção dita)", () => {
    /*
     * Cada sítio que muda o estado de um pedido para o fim, ou o apaga, tem de
     * ser uma das portas acima. A única excepção: o arquivo dos lembretes do que
     * falta (d71) só arquiva pedidos SEM negociações (`NOT EXISTS` no próprio
     * UPDATE) — não há profissional nenhum a quem chegar.
     */
    const PORTAS = /export async function (cancelarPedido|updateSimulatorOrder|cancelarOrcamentoPeloCliente|deleteSimulatorOrder)\(/;
    // Uma atribuição (depois de SET ou de uma vírgula), e não uma condição do WHERE.
    const ESCRITA = /(?:\bSET|,)\s*status\s*=\s*'(cancelado|arquivado|rejeitado)'|DELETE FROM simulatorOrders/;
    const achados: string[] = [];
    for (const f of ficheirosTs(join(RAIZ, "src"))) {
      const fonte = semComentarios(readFileSync(f, "utf8"));
      if (!ESCRITA.test(fonte)) continue;
      const rel = f.slice(RAIZ.length + 1).replace(/\\/g, "/");
      // Cada ocorrência: em que função está?
      const re = new RegExp(ESCRITA.source, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(fonte))) {
        const antes = fonte.slice(0, m.index);
        const funcoes = [...antes.matchAll(/export async function (\w+)\(|async function (\w+)\(/g)];
        const ultima = funcoes.at(-1);
        const nome = ultima ? (ultima[1] ?? ultima[2]) : "?";
        const dentro = PORTAS.test(`export async function ${nome}(`);
        const excepcao = rel === "src/lib/lembrete-do-que-falta-na-base.ts" && nome === "arquivarSemResposta";
        if (!dentro && !excepcao) achados.push(`${rel} → ${nome}: ${m[0].slice(0, 60)}`);
      }
    }
    expect(achados).toEqual([]);
    // E a excepção continua a só tocar em pedidos sem negociações.
    const lembrete = ler("src/lib/lembrete-do-que-falta-na-base.ts");
    expect(lembrete).toMatch(/SET status = 'arquivado'[\s\S]{0,400}NOT EXISTS \(SELECT 1 FROM negociacoes n WHERE n\.pedidoId = simulatorOrders\.id\)/);
  });

  it("os caminhos dão o motivo à notificação", () => {
    expect(ler("src/app/api/admin/negociacoes/cancelar/route.ts")).toMatch(/cancelarPedido\(pedidoId, \{ motivo: motivoAoProfissional\(motivo, motivoDoFecho\.motivo\) \}\)/);
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toMatch(/cancelarPedido\(pedidoId, \{ motivo: motivoAoProfissional/);
    expect(ler("src/app/api/admin/pedidos/[id]/reject/route.ts")).toMatch(/status: "arquivado",\s*\}, \{ motivo: motivoAoProfissional/);
    expect(ler("src/lib/agir-como-cliente.ts")).toMatch(/cancelarPedido\(pedidoId, \{ motivo:/);
    expect(ler("src/lib/validade-do-orcamento-na-base.ts")).toMatch(/updateSimulatorOrder\(pedidoId, \{ status: "arquivado" \}, \{ motivo: FECHADO_SEM_RESPOSTA \}\)/);
    expect(ler("src/lib/seguimento-do-cliente-na-base.ts")).toMatch(/updateSimulatorOrder\(p\.id, \{ status: "arquivado" \}, \{ motivo: FECHADO_SEM_RESPOSTA \}\)/);
    expect(ler("src/lib/arquivar-sem-resposta.ts")).toMatch(/\{ motivo: FECHADO_SEM_RESPOSTA \}/);
    for (const rota of ["src/app/api/admin/negociacoes/apagar/route.ts", "src/app/api/admin/pedidos/route.ts", "src/app/api/admin/pedidos/[id]/route.ts"]) {
      expect(ler(rota), rota).toMatch(/motivoAoProfissional/);
    }
  });

  it("os avisos antigos das rotinas não repetem o que a função única já mandou, e o cancelamento não avisa duas vezes", () => {
    const push = ler("src/lib/avisar-por-push.ts");
    expect(push).toMatch(/fimJaAvisado\(dados\.pedidoId, dados\.negociacaoId\)/);
    const cancelamento = semComentarios(ler("src/lib/avisar-cancelamento.ts"));
    expect(cancelamento).not.toMatch(/avisarQuemFicouSemOTrabalho/);
    // O WhatsApp ao contratado (o canal de sempre) e o aviso ao cliente ficam.
    expect(cancelamento).toMatch(/enviarAvisoWhatsApp/);
    expect(cancelamento).toMatch(/avisarOClienteDoPedido/);
  });

  it("o painel e a app separam pelo fim do pedido, e o sino junta as notificações do servidor", () => {
    const painel = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(painel).toMatch(/if \(p\.fimDoPedido === "cancelado"\) return "cancelados";/);
    expect(painel).toMatch(/\{ id: "cancelados", rotulo: "Cancelados" \}/);
    expect(ler("src/app/profissionais/painel/PainelDoProfissional.tsx")).toMatch(/avisosDoSinoDoFim\(/);
    expect(ler("app-pro/src/estado/Trabalhos.tsx")).toMatch(/avisosDoSinoDoFim\(r\.avisos\)/);
    expect(ler("app-pro/src/app/(app)/index.tsx")).toMatch(/if \(a\.negociacaoId > 0\) router\.push/);
    const rota = ler("src/app/api/profissionais/meus-pedidos/route.ts");
    expect(rota).toMatch(/fimDoPedido: fimParaOProfissional\(l\.estadoDoPedido, l\)/);
    expect(rota).toMatch(/NextResponse\.json\(\{ nome: sessao\.nome, pedidos, avisos \}\)/);
  });

  it("o «Apagar» do backoffice pede o motivo (opcional) em todos os botões", () => {
    for (const f of [
      "src/components/admin/AdminNegociacoesPanel.tsx",
      "src/components/admin/LegacyAdminClient.tsx",
      "src/components/admin/PedidoDetailModal.tsx",
      "src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx",
    ]) {
      expect(ler(f), f).toMatch(/pedirMotivoAoApagar\(\)/);
    }
  });

  it("PedidoComDinheiro é uma TrabalhoEmCurso: as rotas que já recusam com 409 recusam também esta", () => {
    expect(db).toMatch(/export class PedidoComDinheiro extends TrabalhoEmCurso/);
  });
});
