// relógio: datas explícitas — a faixa e as linhas do valor recebem o instante.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  faixaDoValorEmAtraso,
  valorEmAtraso,
  PAGAR_A_CLYON,
  PAGAR_O_VALOR_EM_ATRASO,
  type NovoModeloDaCarteira,
} from "../../app-pro/src/lib/novo-modelo";
import { fraseDoTrabalhoClyon } from "../../app-pro/src/lib/trabalhos";
import { comoRecebeNoNovoModelo, linhaDoValorAPassar, FICA_CONSIGO_E_PASSA_A_CLYON } from "./como-recebe-no-novo-modelo";
import { FICA_CONSIGO_E_PASSA_A_CLYON as DO_NOVO_MODELO } from "./novo-modelo";
import { PORQUE_A_NEGOCIACAO_TERMINOU, porqueTerminou } from "./textos-dos-avisos-ao-profissional";
import { congelarTarifa, type TarifaDasMudancas } from "./conta-da-mudanca";
import { contextoDaFolha, folhaNoEcra, lerFolha } from "./folha-da-mudanca";

/**
 * AS PARTES DA APP CLYON PRO DAS d1, d2, d3 E d4 (CEO e dono, 18-11-2026).
 *
 * A regra de sempre: a app desenha o que o servidor decide. A frase do valor e
 * o «Como recebe» vêm de /api/profissionais/meus-pedidos (d4); a linha de cada
 * valor a passar à CLYON e o cartão «Pronto para receber pedidos» vêm da
 * carteira (d4, d1); o «fechado sem resposta» vem da rota (d2); a folha da
 * mudança refaz-se com o contexto da rota (d3). Os ecrãs (React Native) lêem-se.
 */

/** O que passa à CLYON leva o IVA dela (a regra d4 da orquestra, que lê também estes ficheiros). */
const passaAClyonSemIva = (t: string) => (/\bpass(?:a|am|a-a)\b[^.;!?]*à CLYON/i.test(t) && !/IVA dela/.test(t) ? t : null);

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const dia = (iso: string | null) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : null);

const ID = "app-pro/src/app/trabalho/[id].tsx";
const CONTRATADO = "app-pro/src/componentes/TrabalhoContratado.tsx";

const carteira = (valores: NovoModeloDaCarteira["valores"]): NovoModeloDaCarteira => ({
  emVigor: true,
  valorEmAtraso: 0,
  valores,
  standBy: null,
  dadosParaReceber: { estado: "completos" },
});
const valor = (o: Partial<NovoModeloDaCarteira["valores"][number]> = {}): NovoModeloDaCarteira["valores"][number] => ({
  negociacaoId: 1,
  pedidoId: 501,
  total: 12.3,
  iva: 2.3,
  taxa: 10,
  nasceuEm: "2026-11-17T10:00:00.000Z",
  prazoAte: "2026-11-21T10:00:00.000Z",
  multibanco: null,
  ...o,
});

describe("d4 — a frase do valor e o «Como recebe» na app", () => {
  it("o valor sugerido lê a frase da rota, com a frase única do site como recurso — nada à mão", () => {
    const s = semComentarios(ler(ID));
    expect(s).toContain("t.fraseDoValorNoNovoModelo ?? `${FICA_CONSIGO_E_PASSA_A_CLYON} · o valor é sem IVA`");
    expect(s).not.toContain("passa-a à CLYON");
    // A frase é a do site (a mesma constante), sem a app importar novo-modelo.ts.
    expect(FICA_CONSIGO_E_PASSA_A_CLYON).toBe(DO_NOVO_MODELO);
    expect(s).toContain(`import { FICA_CONSIGO_E_PASSA_A_CLYON } from "../../../../src/lib/como-recebe-no-novo-modelo";`);
    expect(passaAClyonSemIva(`${FICA_CONSIGO_E_PASSA_A_CLYON} · o valor é sem IVA`)).toBeNull();
  });

  it("o tipo Trabalho tem os campos da rota (opcionais: um site antigo não os manda)", () => {
    const s = ler("app-pro/src/lib/trabalhos.ts");
    expect(s).toContain("fraseDoValorNoNovoModelo?: string | null;");
    expect(s).toContain("comoRecebe?: ComoRecebe | null;");
    expect(s).toContain("pedidoFechadoSemResposta?: boolean;");
    expect(s).toContain('import type { ComoRecebe } from "../../../src/lib/como-recebe-no-novo-modelo";');
  });

  it("a frase do Trabalho CLYON diz a taxa E o IVA dela, nunca só «a taxa»", () => {
    const f = fraseDoTrabalhoClyon({ noNovoModelo: true, aPassarAClyon: 12.3 });
    expect(f).toContain("a taxa da plataforma e o IVA dela (12,30 €)");
    expect(passaAClyonSemIva(f)).toBeNull();
    expect(passaAClyonSemIva(fraseDoTrabalhoClyon({ noNovoModelo: true, aPassarAClyon: null }))).toBeNull();
  });

  it("o bloco «Como recebe» desenha o objecto do servidor nas duas fases do contratado", () => {
    const comp = semComentarios(ler("app-pro/src/componentes/ComoRecebe.tsx"));
    for (const campo of ["cr.titulo", "cr.formaTexto", "cr.fraseDoValor", "cr.linhaDoValor", 'cr.estado === "em_atraso"', 'cr.estado === "passado"']) {
      expect(comp).toContain(campo);
    }
    expect(comp).toContain("if (!cr) return null;");
    // Não decide nada: não chama as funções do site.
    expect(comp).not.toMatch(/comoRecebeNoNovoModelo\(|linhaDoValorAPassar\(/);
    const s = semComentarios(ler(CONTRATADO));
    expect((s.match(/<ComoRecebe t=\{t\} \/>/g) ?? []).length).toBe(2);
  });

  it("o objecto que a rota manda tem o que o ecrã lê (a mesma função do painel)", () => {
    const cr = comoRecebeNoNovoModelo(
      { forma: "mbway", aPassarAClyon: 12.3, fecho: new Date("2026-11-17T10:00:00Z"), paga: false },
      new Date("2026-11-18T12:00:00Z"),
    );
    expect(cr.titulo).toBe("Como recebe");
    expect(cr.estado).toBe("a_passar");
    expect(cr.linhaDoValor).toBe("A passar à CLYON · 12,30 € até 21/11");
    expect(typeof cr.formaTexto).toBe("string");
    expect(passaAClyonSemIva(`${cr.fraseDoValor}.`)).toBeNull();
  });
});

describe("d4 — «em atraso» só depois do prazo, na faixa do Início e na carteira", () => {
  const antes = Date.parse("2026-11-18T12:00:00Z");
  const depois = Date.parse("2026-11-22T12:00:00Z");

  it("dentro do prazo: a linha do servidor e «Pagar à CLYON»", () => {
    const linha = linhaDoValorAPassar({ total: 12.3, prazoAte: new Date("2026-11-21T10:00:00Z"), paga: false }, new Date(antes));
    const f = faixaDoValorEmAtraso(carteira([valor({ estado: linha.estado, linha: linha.linha })]), euros, dia, antes);
    expect(f?.titulo).toBe("A passar à CLYON · 12,30 € até 21/11");
    expect(f?.botao).toBe(PAGAR_A_CLYON);
    expect(f?.titulo).not.toMatch(/atraso/i);
  });

  it("depois do prazo: «Valor em atraso» e «Pagar o valor em atraso»", () => {
    const linha = linhaDoValorAPassar({ total: 12.3, prazoAte: new Date("2026-11-21T10:00:00Z"), paga: false }, new Date(depois));
    expect(linha.estado).toBe("em_atraso");
    const f = faixaDoValorEmAtraso(carteira([valor({ estado: linha.estado, linha: linha.linha })]), euros, dia, depois);
    expect(f?.titulo).toBe("Valor em atraso · 12,30 €");
    expect(f?.botao).toBe(PAGAR_O_VALOR_EM_ATRASO);
  });

  it("um site sem o `estado`: compara-se o prazo", () => {
    expect(valorEmAtraso(valor(), antes)).toBe(false);
    expect(valorEmAtraso(valor(), depois)).toBe(true);
    expect(valorEmAtraso(valor({ estado: "a_passar" }), depois)).toBe(false);
    expect(faixaDoValorEmAtraso(carteira([valor()]), euros, dia, antes)?.titulo).toBe("A passar à CLYON · 12,30 € até 21/11");
  });

  it("a carteira mostra `valores[].linha` em vez de «Pagar o valor em atraso» dentro do prazo", () => {
    const s = semComentarios(ler("app-pro/src/app/(app)/carteira.tsx"));
    expect(s).toContain("{v.linha ? (");
    expect(s).toContain(">{v.linha}</Text>");
    expect(s).toContain("{atraso ? PAGAR_O_VALOR_EM_ATRASO : PAGAR_A_CLYON}");
    expect(s).toContain("passou={valorEmAtraso(v, agora)}");
  });
});

describe("d2 — fechado porque o cliente não respondeu ao orçamento", () => {
  it("a frase é a do site", () => {
    expect(PORQUE_A_NEGOCIACAO_TERMINOU.sem_resposta).toBe("Fechado: o cliente não respondeu ao orçamento.");
    expect(porqueTerminou({ estado: "morta", pedidoCancelado: true, pedidoFechadoSemResposta: true })).toBe("sem_resposta");
  });

  it("o ecrã passa `pedidoFechadoSemResposta` ao porqueTerminou, também no Trabalho CLYON", () => {
    const s = semComentarios(ler(ID));
    expect((s.match(/pedidoFechadoSemResposta: t\.pedidoFechadoSemResposta/g) ?? []).length).toBe(2);
    expect(s).toContain("? PORQUE_A_NEGOCIACAO_TERMINOU.sem_resposta");
    expect(s).toContain("{porque ? <Text style={{ color: c.suave }}>{PORQUE_A_NEGOCIACAO_TERMINOU[porque]}</Text> : null}");
  });

  it("o cartão dos Recusados diz «fechado: o cliente não respondeu ao orçamento», como o painel", () => {
    const s = semComentarios(ler("app-pro/src/app/(app)/index.tsx"));
    expect(s).toContain("doGrupo === RECUSA.cancelado && t.pedidoFechadoSemResposta === true ? { ...doGrupo, texto: ETIQUETA_DO_FECHO_SEM_RESPOSTA } : doGrupo");
  });
});

describe("d1 — «Pronto para receber pedidos» no Início da app", () => {
  const cartao = semComentarios(ler("app-pro/src/componentes/ProntoParaReceber.tsx"));

  it("desenha a lista do servidor, linha a linha, e some quando está tudo feito", () => {
    expect(cartao).toContain("if (!cartao || cartao.pronto) return null;");
    expect(cartao).toContain("cartao.linhas.map(");
    for (const campo of ["l.rotulo", "l.detalhe", "l.botao", "l.impede", "cartao.resumo", "cartao.titulo", "cartao.podePropor"]) {
      expect(cartao).toContain(campo);
    }
    // Não decide o que falta: nenhuma regra do site é chamada aqui.
    expect(cartao).not.toMatch(/prontoParaReceber\(|estadoDosDadosParaReceber\(/);
    expect(cartao).toContain('import type { LinhaDoProntoParaReceber, ProntoParaReceber as Cartao } from "../../../src/lib/pronto-para-receber";');
  });

  it("cada linha leva ao ecrã que o servidor diz (`app`); sem ecrã, os Termos", () => {
    expect(cartao).toContain("if (l.app) router.push(l.app as never);");
    expect(cartao).toContain("else abrirOsTermos();");
    const termos = ler("app-pro/src/componentes/AceitarOsTermos.tsx");
    expect(termos).toContain("export function abrirOsTermos(): void {");
    expect(termos).toContain("quemAbre.add(ler);");
    expect(termos).toContain("void recarregarCarteira();");
  });

  it("sem pílula com ícone por cima do título: o título é a primeira coisa do cartão", () => {
    const corpo = cartao.slice(cartao.indexOf("return (\n    <View"), cartao.indexOf("function abrir("));
    const antesDoTitulo = corpo.slice(0, corpo.indexOf("{cartao.titulo}"));
    expect(antesDoTitulo).not.toMatch(/Ionicons|Etiqueta/);
  });

  it("no Início toma o lugar da faixa dos dados para receber, como no painel; sem ele, a faixa de antes", () => {
    const s = semComentarios(ler("app-pro/src/componentes/AvisosDoNovoModelo.tsx"));
    expect(s).toContain("const cartao = nm.prontoParaReceber ?? null;");
    expect(s).toContain("const dados = cartao ? null : avisoDosDadosParaReceber(nm.dadosParaReceber);");
    expect(s).toContain("{comCartao ? <ProntoParaReceber cartao={cartao} /> : null}");
    expect(ler("app-pro/src/lib/novo-modelo.ts")).toContain("prontoParaReceber?: ProntoParaReceber | null;");
    expect(ler("src/app/api/profissionais/carteira/route.ts")).toContain("prontoParaReceber: perfil ? prontoParaReceber(");
  });
});

describe("d3 — a pré-visualização da folha na app faz a conta do modelo de 15-11", () => {
  const TARIFA: TarifaDasMudancas = {
    precoHora2: 55,
    precoHora3: 70,
    minimoHoras: 3,
    precoKm: 0.5,
    kmMinimo: 0,
    kmMaximo: 100,
    caixa: 2,
    cartaoMetro: null,
    filmeRolo: null,
    plasticoBolhaRolo: null,
    aparecerNaLista: true,
  };
  const CONGELADA = congelarTarifa(TARIFA, { taxa: 0.1, modo: "de_dentro", materialComIva: true, iva: 0.23 }, new Date("2026-11-16T10:00:00Z"));
  const cru = (regime: string | null, novoModelo: boolean) => ({
    tarifaCongeladaJson: JSON.stringify(CONGELADA),
    pessoasEscolhidas: 2,
    kmDoPercurso: 0,
    valorPorHoraAcordado: 55,
    diaPorOmissao: "2026-11-18",
    novoModelo,
    regime,
  });
  const corpo = { inicio: "09:00", fim: "13:00", pessoas: 2, km: "0" };

  it("a app chama o que o painel chama, com o contexto cru da rota (que leva o modelo e o regime)", () => {
    const s = ler("app-pro/src/componentes/FolhaDaMudanca.tsx");
    expect(s).toContain("const ctx = contextoDaFolha(f.contexto);");
    expect(s).toContain("const r = lerFolha(corpo, ctx);");
    expect(s).toContain('folhaNoEcra(r.folha, "parceiro", ctx.tarifa.minimoHoras)');
    const rota = ler("src/app/api/profissionais/meus-pedidos/route.ts");
    expect(rota).toContain("novoModelo: modelo != null,");
    expect(rota).toContain("regime: modelo?.regime ?? null,");
  });

  for (const regime of ["normal", "isento"] as const) {
    it(`no modelo de 15-11 (${regime}) a pré-visualização tem «Fica consigo» e «Passa à CLYON»`, () => {
      const ctx = contextoDaFolha(cru(regime, true));
      expect(ctx).not.toBeNull();
      const r = lerFolha(corpo, ctx!);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const ecra = folhaNoEcra(r.folha, "parceiro", ctx!.tarifa.minimoHoras);
      const rotulos = ecra.linhas.map((l) => l.rotulo);
      expect(rotulos.some((x) => /^Fica consigo/.test(x))).toBe(true);
      expect(rotulos).toContain("Passa à CLYON");
      expect(ecra.recebeTexto).toMatch(/^Fica consigo .*; passa à CLYON .* \(a taxa e o IVA dela\)\.$/);
    });
  }

  it("fora do modelo de 15-11, a conta de sempre", () => {
    const ctx = contextoDaFolha(cru(null, false))!;
    const r = lerFolha(corpo, ctx);
    if (!r.ok) throw new Error(r.erro);
    const ecra = folhaNoEcra(r.folha, "parceiro", ctx.tarifa.minimoHoras);
    expect(ecra.linhas.map((l) => l.rotulo)).toContain("Recebe");
    expect(ecra.linhas.map((l) => l.rotulo)).not.toContain("Passa à CLYON");
  });

  it("as linhas cabem no telemóvel: o rótulo e a nota encolhem e partem, o valor fica à direita", () => {
    const s = ler("app-pro/src/componentes/FolhaDaMudanca.tsx");
    const resumo = s.slice(s.indexOf("function ResumoDaFolha"), s.indexOf("const estilos = StyleSheet.create"));
    expect(resumo).toContain("<View style={{ flex: 1 }}>");
    expect(resumo).not.toContain("numberOfLines");
    expect(s).toContain('lado: { flexDirection: "row", alignItems: "flex-start", gap: ESPACO.s },');
  });
});

describe("d8 — a candidatura pela app não promete tempo", () => {
  it("sem «leva dois minutos»", () => {
    expect(ler("src/lib/fotografias-da-carrinha.ts")).not.toMatch(/leva (dois|um|2|1) minutos?/i);
  });
});
