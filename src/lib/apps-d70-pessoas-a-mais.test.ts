import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { congelarTarifa, type TarifaDasMudancas } from "./conta-da-mudanca";
import { camposDaFolha, contextoDaFolha, lerFolha, lerRascunhoDaFolha, rascunhoDeJson, type CamposDaFolha } from "./folha-da-mudanca";
import {
  CAIXA_DO_ACORDO_DAS_PESSOAS_A_MAIS,
  PRECO_POR_PESSOA_A_MAIS_SEM_IVA,
  SEM_ACORDO_DAS_PESSOAS_A_MAIS,
  precoDaHoraParaPessoas,
} from "./tabela-das-mudancas";
import { TAXA_IVA } from "./taxas-plataforma";
import {
  acordoJaMarcado,
  camposDeAbrir,
  equipaNoCorpo,
  horaDasPessoasAMais,
  opcoesDaEquipa,
  pedeOAcordo,
} from "../../app-pro/src/lib/folha-a-meio";

/*
 * A PARTE DA APP PRO DA d70 — 17-11-2026 (ordem do CEO com o sim do dono):
 * na folha da mudança a equipa vai de 2 a 8 pessoas, como no painel.
 *
 *   1. A escolha vai de 2 até `campos.pessoasMaximas` (num site antigo, 2 ou 3).
 *   2. A caixa do acordo do cliente só aparece acima de 3, com a hora que dá.
 *   3. O pedido leva a equipa verdadeira e `acordoDasPessoasAMais: true` só
 *      marcada; sem o acordo o site recusa, e a frase dele aparece no ecrã.
 *   4. Reabrir uma folha de 4 a 8 mostra o número certo e o acordo.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários de bloco e de linha inteira: o que se afirma é sobre o código. */
const codigo = (p: string) =>
  ler(p)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
const ECRA = "app-pro/src/componentes/FolhaDaMudanca.tsx";

const TARIFA: TarifaDasMudancas = {
  precoHora2: 50,
  precoHora3: 65,
  minimoHoras: 3,
  precoKm: 0.6,
  kmMinimo: 10,
  kmMaximo: 80,
  caixa: 2,
  cartaoMetro: 1.5,
  filmeRolo: 10,
  plasticoBolhaRolo: 20,
  aparecerNaLista: true,
};
const CONTEXTO = contextoDaFolha({
  tarifaCongeladaJson: JSON.stringify(congelarTarifa(TARIFA)),
  pessoasEscolhidas: 3,
  kmDoPercurso: 20,
  valorPorHoraAcordado: 65,
  diaPorOmissao: "2026-11-17",
})!;
const CAMPOS: CamposDaFolha = camposDaFolha(null, CONTEXTO);
const AGORA = new Date("2026-11-17T15:00:00Z");
const HORAS = { dia: "2026-11-17", inicio: "09:00", fim: "13:00", km: "20" };

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

describe("app Pro (d70): a equipa da folha vai de 2 até ao máximo que o site manda", () => {
  it("com preço para a equipa de 3, de 2 a 8", () => {
    expect(CAMPOS.pessoasMaximas).toBe(8);
    expect(opcoesDaEquipa(CAMPOS)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it("sem preço de 3 só 2; um site antigo, sem os campos da d70, fica com 2 ou 3", () => {
    expect(opcoesDaEquipa({ ...CAMPOS, podeTres: false })).toEqual([2]);
    const antigo = { ...CAMPOS } as Partial<CamposDaFolha>;
    delete antigo.pessoasMaximas;
    delete antigo.pessoasDaFolha;
    expect(opcoesDaEquipa(antigo as CamposDaFolha)).toEqual([2, 3]);
    expect(opcoesDaEquipa({ ...CAMPOS, pessoasMaximas: 5 })).toEqual([2, 3, 4, 5]);
  });

  it("o ecrã desenha as escolhas acima de 3 a partir de `opcoesDaEquipa`, e o estado já não é só 2 | 3", () => {
    const ecra = codigo(ECRA);
    expect(ecra).toMatch(/opcoesDaEquipa\(campos\)\.filter\(pedeOAcordo\)/);
    expect(ecra).toMatch(/useState<PessoasDaFolha>\(aoAbrir\.pessoas\)/);
    expect(ecra).not.toMatch(/useState<2 \| 3>/);
  });
});

describe("app Pro (d70): a caixa do acordo do cliente só acima de 3", () => {
  it("2 e 3 não pedem o acordo; 4 a 8 pedem", () => {
    for (const n of [2, 3]) expect(pedeOAcordo(n), String(n)).toBe(false);
    for (const n of [4, 5, 6, 7, 8]) expect(pedeOAcordo(n), String(n)).toBe(true);
  });

  it("a hora que dá vem de `precoDaHoraParaPessoas` sobre a hora da equipa de 3 da folha, sem IVA com o com IVA ao lado", () => {
    expect(horaDasPessoasAMais(CAMPOS, 3)).toBeNull();
    expect(CAMPOS.horaDaEquipaDe3Cent).toBe(6500);
    for (const n of [4, 8] as const) {
      const sem = precoDaHoraParaPessoas(65, n);
      expect(sem).toBe(65 + (n - 3) * PRECO_POR_PESSOA_A_MAIS_SEM_IVA);
      expect(horaDasPessoasAMais(CAMPOS, n)).toBe(`${euros(sem)}/h + IVA (${euros(Math.round(sem * (1 + TAXA_IVA) * 100) / 100)} com IVA)`);
    }
    expect(horaDasPessoasAMais({ ...CAMPOS, horaDaEquipaDe3Cent: null }, 5)).toBeNull();
  });

  it("no ecrã a caixa está debaixo de `pedeOAcordo(pessoas)`, com o texto do site — sem o preço escrito à mão", () => {
    const ecra = codigo(ECRA);
    const caixa = ecra.slice(ecra.indexOf("{pedeOAcordo(pessoas) ? ("));
    expect(caixa.length).toBeGreaterThan(200);
    expect(caixa.slice(0, 1500)).toContain("{CAIXA_DO_ACORDO_DAS_PESSOAS_A_MAIS}");
    expect(caixa.slice(0, 1500)).toMatch(/horaAMais/);
    expect(ecra).toMatch(/import \{ CAIXA_DO_ACORDO_DAS_PESSOAS_A_MAIS[^}]*\} from "\.\.\/\.\.\/\.\.\/src\/lib\/tabela-das-mudancas"/);
    expect(ecra).not.toMatch(/\b13(,00)?\s*€/);
    expect(ecra).not.toMatch(/O cliente concordou com as pessoas a mais/);
  });
});

describe("app Pro (d70): o envio leva a equipa e o acordo", () => {
  it("com o acordo marcado: `pessoas`, `pessoasDaFolha` e `acordoDasPessoasAMais: true` — e o site grava", () => {
    expect(equipaNoCorpo(5, true)).toEqual({ pessoas: 5, pessoasDaFolha: 5, acordoDasPessoasAMais: true });
    const r = lerFolha({ ...HORAS, ...equipaNoCorpo(5, true) }, CONTEXTO, AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.folha.pessoas).toBe(5);
    expect(r.folha.horaCent).toBe(Math.round(precoDaHoraParaPessoas(65, 5) * 100));
    expect(r.folha.acordoDasPessoasAMais).toMatchObject({ por: "profissional", pessoas: 5 });
  });

  it("sem o acordo não vai `acordoDasPessoasAMais`, e o site recusa com a frase que o ecrã mostra", () => {
    expect(equipaNoCorpo(5, false)).toEqual({ pessoas: 5, pessoasDaFolha: 5 });
    const r = lerFolha({ ...HORAS, ...equipaNoCorpo(5, false) }, CONTEXTO, AGORA);
    expect(r).toMatchObject({ ok: false, erro: SEM_ACORDO_DAS_PESSOAS_A_MAIS });
  });

  it("com 2 ou 3 o acordo nunca vai, mesmo que tenha ficado marcado", () => {
    expect(equipaNoCorpo(3, true)).toEqual({ pessoas: 3, pessoasDaFolha: 3 });
    expect(equipaNoCorpo(2, true)).toEqual({ pessoas: 2, pessoasDaFolha: 2 });
  });

  it("o rascunho guarda a equipa verdadeira (o site põe-na em `pessoasDaFolha` acima de 3)", () => {
    const r = lerRascunhoDaFolha({ ...HORAS, ...equipaNoCorpo(6, false) }, AGORA);
    expect(r.pessoas).toBe(3);
    expect(r.pessoasDaFolha).toBe(6);
    expect(lerRascunhoDaFolha({ ...HORAS, ...equipaNoCorpo(3, false) }, AGORA)).not.toHaveProperty("pessoasDaFolha");
  });

  it("no ecrã: a folha, a previsão e o rascunho levam `equipaNoCorpo(pessoas, acordo)`; o erro do site aparece em palavras", () => {
    const ecra = codigo(ECRA);
    expect(ecra.match(/\.\.\.equipaNoCorpo\(pessoas, acordo\)/g)?.length).toBe(2);
    expect(ecra).toMatch(/const corpo = \{[^}]*\.\.\.equipaNoCorpo\(pessoas, acordo\)/);
    expect(ecra).toMatch(/const rascunho = \{[^}]*\.\.\.equipaNoCorpo\(pessoas, acordo\)/);
    expect(ecra).toMatch(/corpo: \{ negociacaoId: t\.negociacaoId, \.\.\.corpo \}/);
    expect(ecra).toMatch(/const r = lerFolha\(corpo, ctx\)/);
    expect(ecra).toMatch(/setErro\(e instanceof ErroDaApi \? e\.message : /);
    expect(ecra).toMatch(/previsao\.erro \? <Mensagem tom="aviso" texto=\{previsao\.erro\} \/>/);
  });
});

describe("app Pro (d70): reabrir uma folha de 4 a 8", () => {
  const enviada = (n: 4 | 5 | 6 | 7 | 8) => {
    const r = lerFolha({ ...HORAS, ...equipaNoCorpo(n, true) }, CONTEXTO, AGORA);
    if (!r.ok) throw new Error(r.erro);
    return camposDaFolha(r.folha, CONTEXTO);
  };

  it("mostra o número certo e o acordo marcado", () => {
    for (const n of [4, 5, 6, 7, 8] as const) {
      const campos = enviada(n);
      expect(campos.pessoas, String(n)).toBe(3);
      expect(camposDeAbrir(campos, null, null), String(n)).toMatchObject({ pessoas: n, acordo: true });
    }
  });

  it("um rascunho com outra equipa mostra a do rascunho, e pede o acordo outra vez", () => {
    const campos = enviada(6);
    const rascunho = rascunhoDeJson(JSON.stringify({ ...HORAS, pessoas: 3, pessoasDaFolha: 7, guardadoEm: "2026-11-17T16:00:00.000Z" }))!;
    expect(camposDeAbrir(campos, null, rascunho)).toMatchObject({ pessoas: 7, acordo: false });
    const mesmo = rascunhoDeJson(JSON.stringify({ ...HORAS, pessoas: 3, pessoasDaFolha: 6, guardadoEm: "2026-11-17T16:00:00.000Z" }))!;
    expect(camposDeAbrir(campos, null, mesmo)).toMatchObject({ pessoas: 6, acordo: true });
  });

  it("mudar a equipa no ecrã desmarca o acordo, salvo ao voltar à equipa que o tinha", () => {
    const campos = enviada(5);
    expect(acordoJaMarcado(campos, 5)).toBe(true);
    expect(acordoJaMarcado(campos, 6)).toBe(false);
    expect(acordoJaMarcado(campos, 3)).toBe(false);
    const ecra = codigo(ECRA);
    expect(ecra).toMatch(/const mudarPessoas = porEle\(\(n: PessoasDaFolha\) => \{\s*setPessoas\(n\);\s*setAcordo\(acordoJaMarcado\(campos, n\)\);/);
    expect(ecra).toMatch(/useState<boolean>\(aoAbrir\.acordo\)/);
  });

  it("uma folha de 2 ou 3 reabre como antes, sem acordo", () => {
    expect(camposDeAbrir(CAMPOS, null, null)).toMatchObject({ pessoas: 3, acordo: false });
    const r = lerFolha({ ...HORAS, ...equipaNoCorpo(2, false) }, CONTEXTO, AGORA);
    if (!r.ok) throw new Error(r.erro);
    expect(camposDeAbrir(camposDaFolha(r.folha, CONTEXTO), null, null)).toMatchObject({ pessoas: 2, acordo: false });
  });
});

describe("app Pro (d70): a nota da próxima atualização", () => {
  it("a primeira nota da Pro fala da equipa de 2 a 8 e do acordo do cliente", () => {
    const notas = JSON.parse(ler("src/lib/notas-das-apps.json")) as { pro: Array<{ id: string; nota: string }> };
    expect(notas.pro[0].id).toBe("pro-2026-11-17-2");
    expect(notas.pro[0].nota).toMatch(/de 2 a 8 pessoas/);
    expect(notas.pro[0].nota).toMatch(/acordo do cliente/);
  });
});
