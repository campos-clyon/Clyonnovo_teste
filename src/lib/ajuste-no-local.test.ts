import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  ajustesDe,
  ajustePendente,
  cancelarAjuste,
  comPrazosVistos,
  expiraEm,
  pedirAjuste,
  porqueNaoPodePedir,
  responderAjuste,
  vistaDoAjuste,
  MAXIMO_DE_AJUSTES,
  type Ajuste,
  type EstadoDoTrabalhoParaAjuste,
} from "./ajuste-no-local";

/**
 * O AJUSTE NO LOCAL — as regras do dono, 18-10-2026.
 *
 * «Ajuste entra já» · subir precisa do «sim» do cliente e de fotografias ·
 * baixar «aplica logo» · o pedido fica de pé «até ao fim do dia» · no máximo
 * «2» por trabalho · e nunca se aprova sozinho.
 */

const T = (o: Partial<EstadoDoTrabalhoParaAjuste> = {}): EstadoDoTrabalhoParaAjuste => ({
  estado: "acordada",
  fase: "a_executar",
  valorAcordado: 100,
  ajustes: [],
  ...o,
});

// 18-10-2026, 10:00 em Lisboa (Verão, UTC+1).
const MANHA = new Date("2026-10-18T09:00:00.000Z");
const FOTO = "https://x.public.blob.vercel-storage.com/trabalhos/1/a.jpg";

const subir = (t = T(), agora = MANHA) => pedirAjuste(t, { valorNovo: 180, motivo: "eram 50 sacos, não 20", fotos: [FOTO] }, agora);

describe("quando ele pode pedir", () => {
  it("só no trabalho dele, antes de o dar por feito", () => {
    expect(porqueNaoPodePedir(T(), MANHA)).toBeNull();
    expect(porqueNaoPodePedir(T({ fase: "a_confirmar" }), MANHA)).toMatch(/antes de o dar por feito/);
    expect(porqueNaoPodePedir(T({ fase: "concluido" }), MANHA)).not.toBeNull();
    expect(porqueNaoPodePedir(T({ estado: "aberta" }), MANHA)).not.toBeNull();
    expect(subir(T({ fase: "a_confirmar" })).ok).toBe(false);
  });

  it("sem valor acordado não há o que ajustar", () => {
    expect(porqueNaoPodePedir(T({ valorAcordado: null }), MANHA)).toMatch(/valor acordado/);
  });

  it("um pedido à espera de cada vez", () => {
    const r1 = subir();
    if (!r1.ok) throw new Error(r1.erro);
    const r2 = subir(T({ ajustes: r1.ajustes }));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.erro).toMatch(/à espera do cliente/);
  });

  it(`no máximo ${MAXIMO_DE_AJUSTES} por trabalho — e o terceiro é recusado`, () => {
    expect(MAXIMO_DE_AJUSTES).toBe(2);
    const r1 = subir();
    if (!r1.ok) throw new Error(r1.erro);
    const recusado = responderAjuste(r1.ajustes, "recusar", "cliente", MANHA);
    if (!recusado.ok) throw new Error(recusado.erro);
    const r2 = subir(T({ ajustes: recusado.ajustes }));
    if (!r2.ok) throw new Error(r2.erro);
    const aprovado = responderAjuste(r2.ajustes, "aprovar", "cliente", MANHA);
    if (!aprovado.ok) throw new Error(aprovado.erro);
    const r3 = subir(T({ valorAcordado: 180, ajustes: aprovado.ajustes }));
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.erro).toMatch(/Já pediu 2 ajustes/);
  });

  it("um pedido que ele próprio retirou não conta", () => {
    const r1 = subir();
    if (!r1.ok) throw new Error(r1.erro);
    const c = cancelarAjuste(r1.ajustes, MANHA);
    if (!c.ok) throw new Error(c.erro);
    const v = vistaDoAjuste(T({ ajustes: c.ajustes }), MANHA);
    expect(v.restantes).toBe(2);
    expect(v.porqueNao).toBeNull();
    expect(v.ultimo?.estado).toBe("cancelado");
  });
});

describe("subir precisa do «sim» do cliente", () => {
  it("fica à espera e não mexe no valor", () => {
    const r = subir();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.efeito).toBe("pendente");
    expect(r.valorAcordadoNovo).toBeNull();
    expect(r.ajuste).toMatchObject({ valorAntigo: 100, valorNovo: 180, estado: "pendente" });
  });

  it("sem fotografias não sobe", () => {
    const r = pedirAjuste(T(), { valorNovo: 180, motivo: "eram 50 sacos", fotos: [] }, MANHA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/fotografe/);
  });

  it("o motivo é obrigatório, o valor tem de mudar e não pode disparar", () => {
    expect(pedirAjuste(T(), { valorNovo: 180, motivo: "  ok ", fotos: [FOTO] }, MANHA).ok).toBe(false);
    expect(pedirAjuste(T(), { valorNovo: 100, motivo: "eram 50 sacos", fotos: [FOTO] }, MANHA).ok).toBe(false);
    expect(pedirAjuste(T(), { valorNovo: 0, motivo: "eram 50 sacos", fotos: [FOTO] }, MANHA).ok).toBe(false);
    expect(pedirAjuste(T(), { valorNovo: Number.NaN, motivo: "eram 50 sacos", fotos: [FOTO] }, MANHA).ok).toBe(false);
    expect(pedirAjuste(T(), { valorNovo: 6000, motivo: "eram 50 sacos", fotos: [FOTO] }, MANHA).ok).toBe(false);
    expect(pedirAjuste(T(), { valorNovo: 1000, motivo: "eram 50 sacos", fotos: [FOTO] }, MANHA).ok).toBe(true);
  });

  it("aprovar devolve o valor novo; recusar deixa o que estava", () => {
    const r = subir();
    if (!r.ok) throw new Error(r.erro);
    const sim = responderAjuste(r.ajustes, "aprovar", "cliente", MANHA);
    const nao = responderAjuste(r.ajustes, "recusar", "clyon", MANHA, "o cliente ligou");
    expect(sim.ok && sim.valorAcordadoNovo).toBe(180);
    expect(sim.ok && sim.ajuste).toMatchObject({ estado: "aprovado", respondidoPor: "cliente" });
    expect(nao.ok && nao.valorAcordadoNovo).toBeNull();
    expect(nao.ok && nao.ajuste).toMatchObject({ estado: "recusado", respondidoPor: "clyon", notaDaResposta: "o cliente ligou" });
  });

  it("não se responde duas vezes ao mesmo pedido", () => {
    const r = subir();
    if (!r.ok) throw new Error(r.erro);
    const sim = responderAjuste(r.ajustes, "aprovar", "cliente", MANHA);
    if (!sim.ok) throw new Error(sim.erro);
    expect(responderAjuste(sim.ajustes, "recusar", "cliente", MANHA).ok).toBe(false);
  });
});

describe("baixar aplica logo", () => {
  it("sem fotografias, sem esperar por ninguém", () => {
    const r = pedirAjuste(T(), { valorNovo: 80, motivo: "afinal eram só 15 sacos", fotos: [] }, MANHA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.efeito).toBe("descida");
    expect(r.valorAcordadoNovo).toBe(80);
    expect(r.ajuste.estado).toBe("descida");
    expect(ajustePendente(r.ajustes, MANHA)).toBeNull();
  });

  it("conta para o máximo", () => {
    const r = pedirAjuste(T(), { valorNovo: 80, motivo: "afinal eram só 15 sacos", fotos: [] }, MANHA);
    if (!r.ok) throw new Error(r.erro);
    expect(vistaDoAjuste(T({ valorAcordado: 80, ajustes: r.ajustes }), MANHA).restantes).toBe(1);
  });
});

describe("até ao fim do dia, em Lisboa", () => {
  it("no Verão, as 23:59 de Lisboa são as 22:59 em UTC", () => {
    expect(expiraEm({ pedidoEm: "2026-10-18T09:00:00.000Z" }).toISOString()).toBe("2026-10-18T22:59:59.999Z");
  });

  it("no Inverno são as 23:59 em UTC", () => {
    expect(expiraEm({ pedidoEm: "2026-11-10T09:00:00.000Z" }).toISOString()).toBe("2026-11-10T23:59:59.999Z");
  });

  it("um pedido feito às 00:30 de Lisboa é desse dia, não do anterior", () => {
    // 23:30 UTC de 18/10 = 00:30 de 19/10 em Lisboa.
    expect(expiraEm({ pedidoEm: "2026-10-18T23:30:00.000Z" }).toISOString()).toBe("2026-10-19T22:59:59.999Z");
  });

  it("às 23:58 ainda está de pé; à meia-noite expirou", () => {
    const r = subir();
    if (!r.ok) throw new Error(r.erro);
    expect(ajustePendente(r.ajustes, new Date("2026-10-18T22:58:00.000Z"))).not.toBeNull();
    expect(ajustePendente(r.ajustes, new Date("2026-10-18T23:00:00.000Z"))).toBeNull();
  });
});

describe("nunca se aprova sozinho", () => {
  const r = subir();
  if (!r.ok) throw new Error(r.erro);
  const DEPOIS = new Date("2026-10-19T08:00:00.000Z");

  it("passado o prazo fica «expirado», nunca «aprovado»", () => {
    const vistos = comPrazosVistos(r.ajustes, DEPOIS);
    expect(vistos.map((a) => a.estado)).toEqual(["expirado"]);
    expect(vistos[0].respondidoPor).toBeNull();
  });

  it("e o cliente já não o pode aprovar", () => {
    const tarde = responderAjuste(r.ajustes, "aprovar", "cliente", DEPOIS);
    expect(tarde.ok).toBe(false);
    if (!tarde.ok) expect(tarde.erro).toMatch(/expirou/);
  });

  it("depois de expirar, ele pode pedir outra vez (conta para os dois)", () => {
    const v = vistaDoAjuste(T({ ajustes: r.ajustes }), DEPOIS);
    expect(v.pendente).toBeNull();
    expect(v.ultimo?.estado).toBe("expirado");
    expect(v.restantes).toBe(1);
    expect(v.porqueNao).toBeNull();
  });

  /*
   * O valor só muda por duas portas: o profissional a baixar, ou alguém a
   * responder que sim. Um trabalho agendado, a purga ou o assistente que
   * chamasse `responderAjuste` passava a aprovar sozinho — por isso a lista
   * de quem o chama é fechada.
   */
  it("só as três portas de resposta chamam a resposta ao ajuste", () => {
    const raiz = join(process.cwd(), "src");
    const todos = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? todos(p) : /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
      });
    const chamam = todos(raiz)
      .filter((f) => /\b(responderAjuste|responderAoAjuste)\(/.test(readFileSync(f, "utf8")))
      .map((f) => relative(raiz, f).replace(/\\/g, "/"))
      .sort();
    expect(chamam).toEqual([
      "app/api/admin/negociacoes/ajuste/route.ts",
      "app/api/negociacao/[token]/route.ts",
      "app/api/users/me/negociacao/route.ts",
      "lib/ajuste-no-local.ts",
      "lib/responder-ajuste.ts",
    ]);
  });
});

describe("o que vem da base", () => {
  it("lixo não parte nada", () => {
    expect(ajustesDe(null)).toEqual([]);
    expect(ajustesDe("")).toEqual([]);
    expect(ajustesDe("{")).toEqual([]);
    expect(ajustesDe('{"a":1}')).toEqual([]);
    expect(ajustesDe('[null, {"valorNovo":"x"}, {"valorNovo":5}]')).toHaveLength(1);
  });

  it("a vista diz o prazo do pendente", () => {
    const r = subir();
    if (!r.ok) throw new Error(r.erro);
    const v = vistaDoAjuste(T({ ajustes: r.ajustes }), MANHA);
    expect(v.pendente?.expiraEm).toBe("2026-10-18T22:59:59.999Z");
    expect(v.porqueNao).toMatch(/à espera/);
  });

  it("guarda-se e lê-se igual", () => {
    const r = subir();
    if (!r.ok) throw new Error(r.erro);
    const lido: Ajuste[] = ajustesDe(JSON.stringify(r.ajustes));
    expect(lido).toEqual(r.ajustes);
  });
});
