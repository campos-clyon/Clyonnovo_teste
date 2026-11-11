import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TEXTOS_DOS_PRECOS_DAS_MUDANCAS as TEXTOS,
  ROTULO_DO_ESTADO_DOS_PRECOS,
  aparecerNaListaAoGravar,
  avisoDasTresPessoas,
  dicaDoInterruptor,
  interruptorAoAbrir,
  mensagemDeGravado,
  precosDasMudancasNaConta,
} from "./precos-das-mudancas-do-profissional";
import { estadoDasMudancasNoMenu, faltaDasMudancasDe, type Perfil } from "../../app-pro/src/lib/conta";

/**
 * A PARTE DA APP CLYON PRO DA DECISÃO d4 — 11-11-2026.
 *
 * A lista das mudanças está aberta aos clientes. O ecrã dos preços da app diz
 * o mesmo que o do painel, com os textos e as regras da MESMA lib
 * (`precos-das-mudancas-do-profissional.ts`): já não «ficam só guardados», o
 * interruptor «Aparecer na lista» nasce ligado para quem tem «Mudanças» e
 * ainda não gravou, a hora de 3 pessoas de fora avisa, depois de gravar lê-se
 * a frase da rota, e o menu e o cartão da conta dizem o estado.
 *
 * Os ecrãs da app não correm aqui (são React Native): lê-se o código, como nos
 * outros testes da app, ancorado no que dura — a função da lib, a rota, o
 * campo.
 */

const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const APP = ler("app-pro/src/app/conta/mudancas.tsx");
const PAINEL = ler("src/app/profissionais/painel/PrecosDasMudancas.tsx");
const CONTA_DA_APP = ler("app-pro/src/app/(app)/conta.tsx");
const LIB_DA_APP = ler("app-pro/src/lib/conta.ts");
const MENU_DO_PAINEL = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");
const CARTAO_DO_PAINEL = ler("src/app/profissionais/painel/PerfilPorCompletar.tsx");
const ROTA = ler("src/app/api/profissionais/tarifas-mudancas/route.ts");

/**
 * As frases da lib: nenhuma pode estar escrita à mão num ecrã. Ficam de fora o
 * título («Preços das mudanças» é também a linha do menu, que já lá estava) e
 * os três rótulos do estado, curtos de mais para se procurarem à letra («por
 * preencher» também se diz dos campos do perfil) — esses provam-se mais abaixo,
 * pelo que a linha do menu mostra.
 */
const FRASES = Object.values(TEXTOS).filter((t) => t !== TEXTOS.titulo);

const perfilCom = (p: Partial<Perfil>) => ({ categorias: ["mudancas"], ...p }) as Perfil;

describe("d4 — o ecrã dos preços da app diz o mesmo que o do painel", () => {
  it("as frases de antes saíram, nos dois", () => {
    for (const codigo of [APP, PAINEL]) {
      expect(codigo).not.toMatch(/ficam só guardados|Quando a lista abrir|Por agora/);
    }
  });

  it("os dois lêem a mesma lib — a app não escreve as frases à mão", () => {
    expect(APP).toContain('from "../../../../src/lib/precos-das-mudancas-do-profissional";');
    expect(PAINEL).toContain('from "@/lib/precos-das-mudancas-do-profissional";');
    for (const codigo of [APP, PAINEL, CONTA_DA_APP, LIB_DA_APP]) {
      for (const frase of FRASES) expect(codigo.includes(frase), frase).toBe(false);
    }
  });

  it("a abertura, o interruptor e a dica são os da lib, nos dois", () => {
    for (const codigo of [APP, PAINEL]) expect(codigo).toContain("{TEXTOS.abertura}");
    expect(APP).toContain("rotulo={TEXTOS.interruptor}");
    expect(PAINEL).toContain("{TEXTOS.interruptor}");
    expect(APP).toContain("dica={dicaDoInterruptor(podeAparecer && naLista, podeAparecer)}");
    expect(PAINEL).toContain("{dicaDoInterruptor(naLista, podeAparecer)}");
    // A mesma dica nos dois, com e sem «Mudanças».
    expect(dicaDoInterruptor(true, true)).toBe(TEXTOS.interruptorLigado);
    expect(dicaDoInterruptor(false, true)).toBe(TEXTOS.interruptorDesligado);
    expect(dicaDoInterruptor(false, false)).toBe(TEXTOS.interruptorSemMudancas);
  });
});

describe("d4 — a primeira gravação pela app fica «na lista»", () => {
  it("o interruptor abre pelo que a rota manda; sem isso, pela mesma função do painel", () => {
    expect(ROTA).toContain("interruptorAoAbrir: interruptorAoAbrir(tarifa, pode),");
    expect(APP).toMatch(
      /setNaLista\(\s*typeof d\.interruptorAoAbrir === "boolean"\s*\? d\.interruptorAoAbrir\s*: interruptorAoAbrir\(d\.tarifa \?\? null, Boolean\(d\.podeAparecerNaLista\)\),\s*\);/,
    );
    expect(PAINEL).toContain("setNaLista(interruptorAoAbrir(d.tarifa ?? null, Boolean(d.podeAparecerNaLista)));");
    // Depois de encher com o que está gravado — senão o `encher` punha-o a falso.
    const leitura = APP.slice(APP.indexOf("const ler = useCallback"), APP.indexOf("const mudar ="));
    expect(leitura.indexOf("encher(d.tarifa ?? null);")).toBeGreaterThan(-1);
    expect(leitura.indexOf("setNaLista(")).toBeGreaterThan(leitura.indexOf("encher(d.tarifa ?? null);"));
  });

  it("nasce ligado para quem tem «Mudanças» e ainda não gravou; quem o desligou fica como está", () => {
    expect(interruptorAoAbrir(null, true)).toBe(true);
    expect(interruptorAoAbrir(null, false)).toBe(false);
    expect(interruptorAoAbrir({ aparecerNaLista: false }, true)).toBe(false);
    expect(interruptorAoAbrir({ aparecerNaLista: true }, true)).toBe(true);
  });

  it("a app manda o que o interruptor mostra, e a rota respeita-o", () => {
    expect(APP).toContain("{ aparecerNaLista: podeAparecer && naLista }");
    // Primeira gravação, com o interruptor como nasceu: fica na lista.
    const enviado = true && interruptorAoAbrir(null, true);
    expect(aparecerNaListaAoGravar({ enviado, gravada: null, temMudancas: true })).toBe(true);
    // Quem o desligou antes de gravar fica fora, e é avisado.
    expect(aparecerNaListaAoGravar({ enviado: false, gravada: null, temMudancas: true })).toBe(false);
    expect(mensagemDeGravado(false, true)).toBe(TEXTOS.gravadoForaDaLista);
  });
});

describe("d4 — o aviso das 3 pessoas e a frase depois de gravar", () => {
  it("a hora de 3 pessoas de fora (ou vazia) avisa, na app como no painel", () => {
    expect(APP).toContain("aviso={avisoDasTresPessoas(deFora.precoHora3 ? null : campos.precoHora3)}");
    expect(PAINEL).toContain("aviso={avisoDasTresPessoas(campos.precoHora3)}");
    expect(avisoDasTresPessoas(null)).toBe(TEXTOS.semTresPessoas);
    expect(avisoDasTresPessoas("")).toBe(TEXTOS.semTresPessoas);
    expect(avisoDasTresPessoas("60")).toBeNull();
    // O aviso não é erro: aparece por baixo, e o erro do campo tem a vez.
    expect(APP).toMatch(/\{aviso && !erro \? \(\s*<Text[^>]*color: c\.aviso[^>]*>\s*\{aviso\}/);
  });

  it("depois de gravar lê-se a frase da rota; a de um site de antes sai da mesma lib", () => {
    expect(ROTA).toContain('mensagem: mensagemDeGravado(estado === "na_lista", pode),');
    const escolha =
      'typeof d.mensagem === "string" ? d.mensagem : mensagemDeGravado(Boolean(d.tarifa?.aparecerNaLista), podeAparecer)';
    expect(APP).toContain(`setGravado(${escolha});`);
    expect(PAINEL).toContain(escolha);
    expect(APP).toContain('{gravado ? <Mensagem tom="bom" texto={gravado} /> : null}');
    // A frase de antes, que dizia «Guardado» a quem ficava fora da lista sem o saber.
    expect(APP).not.toMatch(/Guardado às/);
  });
});

describe("d4 — o estado na linha do menu e a falta no cartão, como no painel", () => {
  it("o tipo do perfil da app aceita o que a rota manda", () => {
    expect(LIB_DA_APP).toContain("precosDasMudancas?: PrecosDasMudancasNaConta | null;");
    expect(LIB_DA_APP).toContain('from "../../../src/lib/precos-das-mudancas-do-profissional";');
  });

  it("a linha do menu diz o estado: «na lista» sossegado, os outros dois a pedir um toque", () => {
    expect(CONTA_DA_APP).toMatch(
      /titulo="Preços das mudanças"\s*valor=\{mudancas\?\.rotulo\}\s*aviso=\{mudancas\?\.aviso\}\s*aoCarregar=\{\(\) => abrir\("\/conta\/mudancas"\)\}/,
    );
    // O painel: `valor` com «na lista», `destaque` (em âmbar) com os outros dois.
    expect(MENU_DO_PAINEL).toContain('perfil.precosDasMudancas?.estado === "na_lista" ? perfil.precosDasMudancas.rotulo : undefined');
    expect(MENU_DO_PAINEL).toContain('perfil.precosDasMudancas && perfil.precosDasMudancas.estado !== "na_lista"');

    const noMenu = (tarifa: { aparecerNaLista: boolean } | null) =>
      estadoDasMudancasNoMenu(perfilCom({ precosDasMudancas: precosDasMudancasNaConta(tarifa, true) }));
    expect(noMenu(null)).toEqual({ rotulo: ROTULO_DO_ESTADO_DOS_PRECOS.por_preencher, aviso: true });
    expect(noMenu({ aparecerNaLista: false })).toEqual({ rotulo: ROTULO_DO_ESTADO_DOS_PRECOS.fora_da_lista, aviso: true });
    expect(noMenu({ aparecerNaLista: true })).toEqual({ rotulo: ROTULO_DO_ESTADO_DOS_PRECOS.na_lista, aviso: false });
    // Sem «Mudanças», ou com um site de antes: a linha fica sem valor.
    expect(estadoDasMudancasNoMenu(perfilCom({ precosDasMudancas: null }))).toBeNull();
    expect(estadoDasMudancasNoMenu(perfilCom({}))).toBeNull();
    expect(estadoDasMudancasNoMenu(null)).toBeNull();
  });

  it("a falta dos preços aparece no cartão só a quem tem «Mudanças» e ainda não os pôs", () => {
    const por = precosDasMudancasNaConta(null, true);
    expect(faltaDasMudancasDe(perfilCom({ precosDasMudancas: por }))).toEqual({
      chave: "precos-das-mudancas",
      rotulo: TEXTOS.faltaRotulo,
      porque: TEXTOS.faltaPorque,
    });
    expect(faltaDasMudancasDe(perfilCom({ precosDasMudancas: precosDasMudancasNaConta({ aparecerNaLista: false }, true) }))).toBeNull();
    expect(faltaDasMudancasDe(perfilCom({ precosDasMudancas: precosDasMudancasNaConta({ aparecerNaLista: true }, true) }))).toBeNull();
    expect(faltaDasMudancasDe(perfilCom({ categorias: ["recolhas"], precosDasMudancas: por }))).toBeNull();
    expect(faltaDasMudancasDe(perfilCom({}))).toBeNull();
  });

  it("o cartão da app segue o do painel: aparece só com a falta, sem barra a 100 %, e abre o ecrã dos preços", () => {
    expect(CONTA_DA_APP).toContain("const faltaDasMudancas = faltaDasMudancasDe(perfil);");
    expect(CONTA_DA_APP).toContain("if (r.completo && !faltaDasMudancas) return null;");
    expect(CARTAO_DO_PAINEL).toContain("if (resumo.completo && !faltaDasMudancas) return null;");
    expect(CONTA_DA_APP).toContain("const temTravao = r.essenciais.length > 0 || Boolean(faltaDasMudancas);");
    expect(CARTAO_DO_PAINEL).toContain("const temTravao = essenciais.length > 0 || Boolean(faltaDasMudancas);");
    expect(CONTA_DA_APP).toContain("{r.completo ? null : (");
    expect(CARTAO_DO_PAINEL).toContain('<div className={resumo.completo ? "hidden" : "mt-3"}>');
    const linha = CONTA_DA_APP.slice(CONTA_DA_APP.indexOf("{faltaDasMudancas ? ("), CONTA_DA_APP.indexOf("{mostrar.map("));
    expect(linha).toContain('onPress={() => abrir("/conta/mudancas")}');
    expect(linha).toContain("{faltaDasMudancas.rotulo}");
    expect(linha).toContain("{faltaDasMudancas.porque}");
    // A mesma conta do painel, com a categoria e o estado que a rota do perfil manda.
    expect(LIB_DA_APP).toContain('faltaDosPrecosDasMudancas(p.categorias.includes("mudancas"), p.precosDasMudancas?.estado)');
    expect(MENU_DO_PAINEL).toMatch(
      /faltaDosPrecosDasMudancas\(\s*perfil\?\.categorias\.includes\("mudancas"\) === true,\s*perfil\?\.precosDasMudancas\?\.estado,\s*\)/,
    );
  });

  it("voltar do ecrã dos preços relê o perfil, e o menu mostra o estado novo", () => {
    expect(CONTA_DA_APP).toMatch(/useFocusEffect\(\s*useCallback\(\(\) => \{\s*void recarregarPerfil\(\);/);
  });
});
