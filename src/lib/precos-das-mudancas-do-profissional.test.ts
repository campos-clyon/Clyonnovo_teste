import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROTULO_DO_ESTADO_DOS_PRECOS,
  TEXTOS_DOS_PRECOS_DAS_MUDANCAS as TEXTOS,
  aparecerNaListaAoGravar,
  avisoDasTresPessoas,
  dicaDoInterruptor,
  estadoDosPrecosDasMudancas,
  faltaDosPrecosDasMudancas,
  interruptorAoAbrir,
  mensagemDeGravado,
  precosDasMudancasNaConta,
} from "./precos-das-mudancas-do-profissional";
import { TEXTOS_DA_LISTA } from "./lista-de-parceiros-da-mudanca";
import { REFERENCIA_DA_MUDANCA } from "./modelo-da-mudanca";

/**
 * OS PREÇOS DAS MUDANÇAS, DITOS AO PROFISSIONAL — 11-11-2026.
 *
 * A lista está aberta aos clientes: o ecrã deixa de dizer que os preços «ficam
 * só guardados», o interruptor nasce ligado na primeira gravação, a hora de 3
 * pessoas vazia avisa, o menu e o cartão do perfil dizem o estado, e o cliente
 * com a lista vazia lê como o pedido segue, com a referência.
 */

const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

const ECRA = ler("src/app/profissionais/painel/PrecosDasMudancas.tsx");
const PAINEL = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");
const CARTAO = ler("src/app/profissionais/painel/PerfilPorCompletar.tsx");
const ROTA = ler("src/app/api/profissionais/tarifas-mudancas/route.ts");
const ROTA_DO_PERFIL = ler("src/app/api/profissionais/perfil/route.ts");
const SIMULADOR = ler("src/app/simulador/components/ParceirosDaMudanca.tsx");

const gravada = (aparecerNaLista: boolean) => ({ aparecerNaLista });

describe("o ecrã dos preços diz que aparece na lista", () => {
  it("os textos não falam de uma lista por abrir", () => {
    const todos = Object.values(TEXTOS).join(" ");
    expect(todos).not.toMatch(/ficam só guardados|Quando a lista abrir|Por agora/);
    expect(TEXTOS.abertura).toContain("os clientes da sua zona vêem-no com estes preços");
    expect(TEXTOS.abertura).toContain("sem IVA");
  });

  it("o ecrã do painel lê os textos da lib e já não tem as frases antigas", () => {
    expect(ECRA).not.toMatch(/ficam só guardados|Quando a lista abrir/);
    expect(ECRA).toContain("TEXTOS.abertura");
    expect(ECRA).toContain("dicaDoInterruptor(naLista, podeAparecer)");
  });

  it("a dica do interruptor diz o que acontece ligado e desligado", () => {
    expect(dicaDoInterruptor(true, true)).toBe("Ligado: aparece na lista das mudanças com estes preços.");
    expect(dicaDoInterruptor(false, true)).toBe("Desligado: os preços ficam guardados, mas os clientes não o vêem.");
    expect(dicaDoInterruptor(true, false)).toBe("Só com o serviço «Mudanças» nos seus serviços.");
  });
});

describe("o interruptor nasce ligado na primeira gravação", () => {
  it("ao abrir sem nada gravado, vem ligado para quem tem Mudanças", () => {
    expect(interruptorAoAbrir(null, true)).toBe(true);
    expect(interruptorAoAbrir(null, false)).toBe(false);
  });

  it("quem já gravou vê o que gravou — desligado fica desligado", () => {
    expect(interruptorAoAbrir(gravada(false), true)).toBe(false);
    expect(interruptorAoAbrir(gravada(true), true)).toBe(true);
    expect(interruptorAoAbrir(gravada(true), false)).toBe(false);
  });

  it("a primeira gravação sem o campo fica na lista; as seguintes ficam como estavam", () => {
    expect(aparecerNaListaAoGravar({ enviado: undefined, gravada: null, temMudancas: true })).toBe(true);
    expect(aparecerNaListaAoGravar({ enviado: undefined, gravada: gravada(false), temMudancas: true })).toBe(false);
    expect(aparecerNaListaAoGravar({ enviado: undefined, gravada: gravada(true), temMudancas: true })).toBe(true);
  });

  it("quem diz sim ou não fica com o que disse, e sem Mudanças nunca se liga sozinho", () => {
    expect(aparecerNaListaAoGravar({ enviado: false, gravada: null, temMudancas: true })).toBe(false);
    expect(aparecerNaListaAoGravar({ enviado: true, gravada: gravada(false), temMudancas: true })).toBe(true);
    expect(aparecerNaListaAoGravar({ enviado: undefined, gravada: null, temMudancas: false })).toBe(false);
  });

  it("a rota e o ecrã usam a regra", () => {
    expect(ROTA).toContain("aparecerNaListaAoGravar({");
    expect(ROTA).toContain("gravarTarifaDasMudancas(sessao.providerId, { ...v.tarifa, aparecerNaLista })");
    expect(ROTA).toContain("interruptorAoAbrir: interruptorAoAbrir(tarifa, pode)");
    expect(ECRA).toContain("setNaLista(interruptorAoAbrir(d.tarifa ?? null, Boolean(d.podeAparecerNaLista)))");
  });

  it("depois de gravar, quem ficou fora da lista é avisado", () => {
    expect(mensagemDeGravado(true, true)).toBe("Guardado. Aparece na lista das mudanças com estes preços.");
    expect(mensagemDeGravado(false, true)).toBe(
      "Guardado. Ainda não aparece na lista: ligue «Aparecer na lista das mudanças».",
    );
    expect(mensagemDeGravado(false, false)).toBe("Preços gravados.");
    expect(ROTA).toContain("mensagem: mensagemDeGravado(");
  });
});

describe("sem preço para 3 pessoas, o aviso", () => {
  it("vazio avisa que fica fora dos T3 ou maiores; com preço não diz nada", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(avisoDasTresPessoas(v)).toBe("Sem preço para 3 pessoas não aparece nas mudanças de T3 ou maiores.");
    }
    expect(avisoDasTresPessoas("45")).toBeNull();
    expect(avisoDasTresPessoas(45)).toBeNull();
  });

  it("o ecrã mostra-o por baixo da hora com 3 pessoas", () => {
    expect(ECRA).toContain("aviso={avisoDasTresPessoas(campos.precoHora3)}");
  });
});

describe("o estado no menu e a falta no perfil", () => {
  it("três estados, com o nome que se lê", () => {
    expect(estadoDosPrecosDasMudancas(null)).toBe("por_preencher");
    expect(estadoDosPrecosDasMudancas(gravada(false))).toBe("fora_da_lista");
    expect(estadoDosPrecosDasMudancas(gravada(true))).toBe("na_lista");
    expect(ROTULO_DO_ESTADO_DOS_PRECOS).toEqual({
      por_preencher: "por preencher",
      fora_da_lista: "fora da lista",
      na_lista: "na lista",
    });
  });

  it("só a quem tem Mudanças", () => {
    expect(precosDasMudancasNaConta(null, false)).toBeNull();
    expect(precosDasMudancasNaConta(null, true)).toEqual({
      estado: "por_preencher",
      rotulo: "por preencher",
      falta: {
        chave: "precos-das-mudancas",
        rotulo: "Preços das mudanças",
        porque: "Sem eles não aparece na lista que os clientes vêem.",
      },
    });
    expect(precosDasMudancasNaConta(gravada(true), true)).toEqual({ estado: "na_lista", rotulo: "na lista", falta: null });
  });

  it("a falta só existe sem preços gravados", () => {
    expect(faltaDosPrecosDasMudancas(true, "por_preencher")).not.toBeNull();
    expect(faltaDosPrecosDasMudancas(true, "fora_da_lista")).toBeNull();
    expect(faltaDosPrecosDasMudancas(true, "na_lista")).toBeNull();
    expect(faltaDosPrecosDasMudancas(false, "por_preencher")).toBeNull();
    expect(faltaDosPrecosDasMudancas(true, undefined)).toBeNull();
  });

  it("a rota do perfil devolve-o, o menu mostra-o e o cartão abre o ecrã dos preços", () => {
    expect(ROTA_DO_PERFIL).toContain("precosDasMudancasNaConta(await tarifaDasMudancasDe(sessao.providerId), true)");
    expect(ROTA_DO_PERFIL).toMatch(/categorias: categoriasDele,\s+precosDasMudancas,/);
    expect(PAINEL).toContain("perfil.precosDasMudancas.rotulo");
    expect(PAINEL).toContain('onAbrirMudancas={() => abrir("precos-mudancas")}');
    expect(PAINEL).toContain("onGravado={carregar}");
    expect(CARTAO).toContain("if (resumo.completo && !faltaDasMudancas) return null;");
  });
});

describe("o cliente, com a lista vazia", () => {
  it("lê como o pedido segue e a referência — nunca «ainda não temos»", () => {
    expect(TEXTOS_DA_LISTA.semParceiros).toBe(
      "Os parceiros da sua zona respondem a este pedido com o preço por hora de cada um.",
    );
    expect(TEXTOS_DA_LISTA.semParceirosSegue).toBe(`A ${REFERENCIA_DA_MUDANCA}.`);
    expect(`${TEXTOS_DA_LISTA.semParceiros} ${TEXTOS_DA_LISTA.semParceirosSegue}`).not.toMatch(/Ainda não temos|profissiona/i);
    // Sem IVA nunca sozinho.
    expect(TEXTOS_DA_LISTA.semParceirosSegue).toContain("com IVA");
  });

  it("no simulador, a escolha da equipa só aparece com parceiros na lista", () => {
    expect(SIMULADOR).toMatch(
      /\{\(parceiros\.length > 0 \|\| houveParceiros\) && \(\s*<div>\s*<div[^>]*aria-label="Pessoas na equipa"/,
    );
    expect(SIMULADOR).toContain("if ((j.parceiros?.length ?? 0) > 0) setHouveParceiros(true);");
    expect(SIMULADOR).toContain("{resposta.semParceiros}");
    expect(SIMULADOR).toContain("{textos?.semParceirosSegue}");
  });
});
