import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { prazoDeResposta } from "./prazo-de-resposta-do-parceiro";
import type { TarifaDasMudancas } from "./conta-da-mudanca";
import {
  MAXIMO_DE_ESCOLHIDOS,
  ORDENACAO,
  TEXTOS_DA_LISTA,
  cartaoDoParceiro,
  type CandidatoDaMudanca,
  type ContextoDaMudanca,
} from "./lista-de-parceiros-da-mudanca";
import {
  ACCOES_DOS_ESCOLHIDOS,
  AJUDA_DO_PROCURAR_MAIS,
  cartaoDoCliente,
  DEPOIS_DE_CADA_SAIDA,
  ERROS_DO_CLIENTE,
  JA_ESTA_A_PROCURAR,
  LINHA_DAS_3_HORAS,
  linhaDoPrazoParaOCliente,
  pedidoEnviadoAOutros,
  SAIDAS_DO_CLIENTE,
  semRespostaDosEscolhidos,
  TEXTOS_DE_ESCOLHER_OUTRO,
  type EscolhidosDoPedido,
  type NegociacaoDoPedido,
} from "./escolhidos-sem-resposta";
import { ErroDaApi, NAO_FOI_POSSIVEL, SEM_REDE, type Pedir } from "../../app-cliente/src/lib/erros";
import { caminhoDoAviso } from "../../app-cliente/src/lib/links";
import { ROTA_DAS_ACCOES } from "../../app-cliente/src/lib/pedidos";
import { escolhaFeita, listaValida } from "../../app-cliente/src/lib/parceiros-da-mudanca";
import {
  ACCOES_DOS_ESCOLHIDOS as ACCOES_NA_APP,
  agirSobreOsEscolhidos,
  botaoDeEscolherOutros,
  corpoDeEscolherOutros,
  erroDosEscolhidos,
  ESPERA_DEPOIS_DE_VAZIO_MS,
  lerOsEscolhidos,
  listaParaEscolherValida,
  oQueMostrar,
  podeReler,
  saidaSemMaisNinguem,
  TIPO_DO_AVISO,
  valeAPenaLer,
  vistaValida,
} from "../../app-cliente/src/lib/escolhidos-sem-resposta";

/**
 * A PARTE DA APP DE CLIENTE DA d6 — 11-11-2026. Quando os parceiros escolhidos
 * não respondem em 3 horas, o cliente vê na app o cartão com as três saídas, e
 * lê na lista que os parceiros têm 3 horas para responder. Uma regra, um teste:
 *
 *   1. o cartão é o da rota, tal como vem (as três saídas e a linha do prazo);
 *   2. cada saída manda a acção do botão e mostra o que a rota responde;
 *   3. «Escolher outro parceiro»: a lista da rota, os ids e o preço visto;
 *   4. as recusas: «já não é preciso», o preço que mudou, sem rede;
 *   5. o aviso no telemóvel abre o pedido, e o cartão relê-se com ele;
 *   6. a lista: a linha das 3 horas, e «pedir à CLYON» sempre que há parceiros;
 *   7. paridade — a app não tem frases próprias: lê as do site.
 *
 * O site destes testes é de mentira, mas responde com as regras e as frases
 * verdadeiras da lib (`escolhidos-sem-resposta.ts`), como `agirSobreOsEscolhidos`
 * no servidor.
 */

const lisboa = (quando: string) => instanteEmLisboa(quando) as Date;
const cru = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

const ENVIADO = lisboa("2026-11-11T16:00");
const PRAZO = prazoDeResposta(ENVIADO);
const ANTES = lisboa("2026-11-11T18:00");
const DEPOIS = lisboa("2026-11-11T19:30");
const PEDIDO = 610;

const escolhida = (o: Record<string, unknown> = {}): NegociacaoDoPedido => ({
  estado: "aberta",
  propostasJson: "[]",
  escolhidoPeloCliente: 1,
  prazoRespostaEm: PRAZO.toISOString(),
  profissionalNome: "Mudanças Exemplo",
  ...o,
});
const comProposta = JSON.stringify([{ por: "profissional", valor: 40, estado: "pendente", criadaEm: ENVIADO.toISOString() }]);
const semPedir: EscolhidosDoPedido = { em: ENVIADO.toISOString(), procurarMais: false, marca: null, decisao: null, enviadoAMais: null };

const TARIFA: TarifaDasMudancas = {
  precoHora2: 50,
  precoHora3: 65,
  minimoHoras: 3,
  precoKm: 0.6,
  kmMinimo: 10,
  kmMaximo: 80,
  caixa: 2,
  cartaoMetro: null,
  filmeRolo: 10,
  plasticoBolhaRolo: 20,
  aparecerNaLista: true,
};
const candidato = (nome: string): CandidatoDaMudanca =>
  ({
    id: 7,
    nome,
    isActive: true,
    estado: "aprovado",
    categorias: ["mudancas"],
    raioKm: 50,
    emiteFatura: true,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
    contaDeTeste: false,
    verificado: true,
    tarifa: TARIFA,
    notaMedia: 4.84,
    avaliacoes: 5,
  }) as CandidatoDaMudanca;
const CTX: ContextoDaMudanca = { tipologia: "T2", desmontagem: false, pessoas: 2, kmPercurso: 20, formaDePagamento: "na_plataforma", cidade: "Seixal" };
/** Um cartão da lista como o servidor o manda, com a assinatura do preço que ele põe. */
const cartao = (id: string, nome: string) => ({ ...cartaoDoParceiro({ ...candidato(nome), tarifa: TARIFA }, CTX, id, ENVIADO)!, assinatura: `assinatura-de-${id}` });

/**
 * O site, de mentira: a rota das acções do cliente para UM pedido, com as
 * regras de `agirSobreOsEscolhidos` (escolhidos-sem-resposta-no-servidor.ts) e
 * as frases da lib. Tudo o que responde passa por JSON, como chega à app.
 */
function site(agora: Date, inicio: { negociacoes?: NegociacaoDoPedido[]; resumo?: EscolhidosDoPedido; fechado?: boolean; outros?: Array<ReturnType<typeof cartao>>; precoMudou?: boolean } = {}) {
  const pedidos: Array<{ caminho: string; corpo: Record<string, unknown> }> = [];
  let negociacoes = inicio.negociacoes ?? [escolhida()];
  const resumo: EscolhidosDoPedido = { ...(inicio.resumo ?? semPedir) };
  const outros = inicio.outros ?? [cartao("b", "Outra Empresa"), cartao("c", "Terceira")];
  const vista = () => ({ cartao: cartaoDoCliente(negociacoes, resumo, agora, !!inicio.fechado), prazoTexto: inicio.fechado ? null : linhaDoPrazoParaOCliente(negociacoes, agora) });
  const falha = (estado: number, error: string, mais: Record<string, unknown> = {}) => new ErroDaApi(error, estado, { ok: false, error, ...mais });
  const pedir: Pedir = async <T,>(caminho: string, opcoes?: { metodo?: string; corpo?: unknown }) => {
    const corpo = (opcoes?.corpo ?? {}) as Record<string, unknown>;
    pedidos.push({ caminho, corpo });
    const responder = (o: Record<string, unknown>) => JSON.parse(JSON.stringify({ ok: true, ...o })) as T;
    if (corpo.pedidoId !== PEDIDO) throw falha(404, "Pedido não encontrado.");
    if (corpo.accao === ACCOES_DOS_ESCOLHIDOS.ver) return responder(vista());
    if (inicio.fechado) throw falha(409, ERROS_DO_CLIENTE.jaFechado, { jaNaoEPreciso: true, botao: ERROS_DO_CLIENTE.verOPedido });
    if (!semRespostaDosEscolhidos(negociacoes, agora)) throw falha(409, ERROS_DO_CLIENTE.jaRespondeu, { jaNaoEPreciso: true, botao: ERROS_DO_CLIENTE.verOPedido });
    if (corpo.accao === ACCOES_DOS_ESCOLHIDOS.esperar) {
      resumo.decisao = { saida: "esperar", em: agora.toISOString(), por: "cliente" };
      return responder(vista());
    }
    if (corpo.accao === ACCOES_DOS_ESCOLHIDOS.pedirAClyon) {
      resumo.decisao = { saida: "pedir_a_clyon", em: agora.toISOString(), por: "cliente" };
      resumo.procurarMais = true;
      return responder(vista());
    }
    if (corpo.accao === ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro) {
      return responder({
        titulo: TEXTOS_DE_ESCOLHER_OUTRO.titulo,
        linha: TEXTOS_DE_ESCOLHER_OUTRO.linha(MAXIMO_DE_ESCOLHIDOS),
        botao: TEXTOS_DE_ESCOLHER_OUTRO.botao,
        maximoDeEscolhidos: MAXIMO_DE_ESCOLHIDOS,
        pessoas: 2,
        parceiros: outros,
        semMaisNinguem: outros.length === 0 ? TEXTOS_DE_ESCOLHER_OUTRO.semMaisNinguem : null,
      });
    }
    if (corpo.accao === ACCOES_DOS_ESCOLHIDOS.escolherOutro) {
      const ids = Array.isArray(corpo.parceiros) ? (corpo.parceiros as string[]) : [];
      const escolhidos = outros.filter((c) => ids.includes(c.id));
      if (escolhidos.length === 0 || escolhidos.length !== ids.length) throw falha(409, "Um dos parceiros que escolheu já não está disponível.");
      const assinaturas = (corpo.assinaturas ?? {}) as Record<string, string>;
      if (inicio.precoMudou || escolhidos.some((c) => assinaturas[c.id] !== c.assinatura)) throw falha(409, "O preço de um dos parceiros mudou. Veja a lista outra vez.", { precoMudou: true });
      const prazo = prazoDeResposta(agora);
      negociacoes = [...negociacoes, ...escolhidos.map((c) => escolhida({ profissionalNome: c.nome, prazoRespostaEm: prazo.toISOString() }))];
      return responder({ enviado: pedidoEnviadoAOutros(escolhidos.map((c) => c.nome), prazo, agora), cartao: null, prazoTexto: null });
    }
    throw falha(400, "Acção desconhecida.");
  };
  return { pedir, pedidos, vista };
}

describe("1. o cartão é o da rota, tal como vem", () => {
  it("com o prazo a correr: só a linha «tem até às HH:MM para responder»", async () => {
    const s = site(ANTES);
    const v = await lerOsEscolhidos(s.pedir, PEDIDO);
    expect(s.pedidos).toEqual([{ caminho: ROTA_DAS_ACCOES, corpo: { pedidoId: PEDIDO, accao: "ver_escolhidos" } }]);
    expect(v).toEqual({ cartao: null, prazoTexto: "O parceiro que escolheu tem até às 19:00 para responder." });
    expect(oQueMostrar(v, null, null)).toBe("prazo");
  });

  it("passado o prazo sem resposta: o título, a linha e as três saídas, com a acção de cada botão", async () => {
    const s = site(DEPOIS);
    const v = await lerOsEscolhidos(s.pedir, PEDIDO);
    // Exactamente o cartão da lib do site: a app não lhe muda nada.
    expect(v?.cartao).toEqual(cartaoDoCliente([escolhida()], semPedir, DEPOIS));
    expect(v?.cartao?.titulo).toBe("O parceiro Mudanças Exemplo ainda não respondeu");
    expect(v?.cartao?.linha).toBe("O prazo de 3 horas terminou às 19:00. O que prefere?");
    expect(v?.cartao?.botoes).toEqual([
      { accao: "esperar_pelos_escolhidos", texto: SAIDAS_DO_CLIENTE.esperar, principal: false },
      { accao: "lista_para_escolher_outro", texto: SAIDAS_DO_CLIENTE.escolherOutro, principal: false },
      { accao: "pedir_a_clyon_que_procure", texto: SAIDAS_DO_CLIENTE.pedirAClyon, principal: true },
    ]);
    expect(v?.prazoTexto).toBeNull();
    expect(oQueMostrar(v, null, null)).toBe("cartao");
  });

  it("já tinha pedido à CLYON na lista: duas saídas e a nota; todos disseram que não: sem «esperar»", async () => {
    const jaPediu = await lerOsEscolhidos(site(DEPOIS, { resumo: { ...semPedir, procurarMais: true } }).pedir, PEDIDO);
    expect(jaPediu?.cartao?.botoes.map((b) => b.texto)).toEqual([SAIDAS_DO_CLIENTE.esperar, SAIDAS_DO_CLIENTE.escolherOutro]);
    expect(jaPediu?.cartao?.nota).toBe(JA_ESTA_A_PROCURAR);
    const nao = await lerOsEscolhidos(site(ANTES, { negociacoes: [escolhida({ estado: "desistida" })] }).pedir, PEDIDO);
    expect(nao?.cartao?.titulo).toBe("Os parceiros que escolheu não podem fazer esta mudança");
    expect(nao?.cartao?.botoes.map((b) => b.accao)).toEqual(["lista_para_escolher_outro", "pedir_a_clyon_que_procure"]);
  });

  it("um parceiro respondeu, o pedido fechou, ou não é um pedido com escolhidos: não se mostra nada", async () => {
    expect(oQueMostrar(await lerOsEscolhidos(site(DEPOIS, { negociacoes: [escolhida({ propostasJson: comProposta })] }).pedir, PEDIDO), null, null)).toBeNull();
    expect(oQueMostrar(await lerOsEscolhidos(site(DEPOIS, { fechado: true }).pedir, PEDIDO), null, null)).toBeNull();
    expect(vistaValida({ ok: true, cartao: null, prazoTexto: null })).toEqual({ cartao: null, prazoTexto: null });
    expect(oQueMostrar(null, null, null)).toBeNull();
  });

  it("um botão sem acção ou sem texto não se desenha (a app não inventa nenhum dos dois), e sem rede não lança", async () => {
    const v = vistaValida({ cartao: { caso: "sem_resposta", titulo: "T", botoes: [{ accao: "x" }, { texto: "Y" }, { accao: "z", texto: "Z", principal: 1 }], ligacoes: "não é lista" } });
    expect(v.cartao?.botoes).toEqual([{ accao: "z", texto: "Z", principal: false }]);
    expect(v.cartao?.ligacoes).toEqual([]);
    expect(vistaValida({ cartao: { caso: "sem_resposta" } }).cartao).toBeNull();
    const semRede: Pedir = async () => {
      throw new TypeError("Network request failed");
    };
    expect(await lerOsEscolhidos(semRede, PEDIDO)).toBeNull();
  });

  it("o ecrã do pedido mostra o cartão por cima das propostas, e desenha só o que a rota manda", () => {
    const VISTA = semNotas("app-cliente/src/componentes/VistaDoPedido.tsx");
    expect(VISTA).toContain("<EscolhidosSemResposta pedidoId={pedidoId} pedir={pedir}");
    expect(VISTA.indexOf("<EscolhidosSemResposta")).toBeLessThan(VISTA.indexOf("{espera ? ("));
    expect(VISTA.indexOf("<EscolhidosSemResposta")).toBeLessThan(VISTA.indexOf("propostas.map((n) => ("));
    const C = semNotas("app-cliente/src/componentes/EscolhidosSemResposta.tsx");
    for (const campo of ["cartao.titulo", "cartao.linha", "cartao.depois", "cartao.nota", "cartao.botoes.map(botao)", "cartao.ligacoes.map(", "vista.prazoTexto"]) {
      expect(C, campo).toContain(campo);
    }
    // O botão manda a acção que a rota lhe deu, e o principal é o que ela diz.
    expect(C).toContain("aoCarregar={() => void agir({ pedidoId, accao: b.accao })}");
    expect(C).toContain('tipo={b.principal ? "principal" : "secundario"}');
  });
});

describe("2. cada saída manda a acção do botão e mostra o que a rota responde", () => {
  it("«Esperar mais um pouco»: fica a frase, com as outras duas saídas em ligações", async () => {
    const s = site(DEPOIS);
    const cartao0 = (await lerOsEscolhidos(s.pedir, PEDIDO))!.cartao!;
    const r = await agirSobreOsEscolhidos(s.pedir, { pedidoId: PEDIDO, accao: cartao0.botoes[0].accao });
    expect(s.pedidos[1]).toEqual({ caminho: ROTA_DAS_ACCOES, corpo: { pedidoId: PEDIDO, accao: "esperar_pelos_escolhidos" } });
    if (!r.ok) throw new Error("devia correr bem");
    expect(r.vista.cartao).toMatchObject({ titulo: null, linha: null, depois: DEPOIS_DE_CADA_SAIDA.esperar, botoes: [] });
    expect(r.vista.cartao?.ligacoes.map((b) => [b.accao, b.texto])).toEqual([
      ["lista_para_escolher_outro", SAIDAS_DO_CLIENTE.escolherOutro],
      ["pedir_a_clyon_que_procure", SAIDAS_DO_CLIENTE.pedirAClyon],
    ]);
    expect(r.lista).toBeNull();
    expect(r.enviado).toBeNull();
  });

  it("«Pedir à CLYON que procure»: fica a frase, sem botões — e quem abre o pedido a mais parceiros não é a app", async () => {
    const s = site(DEPOIS);
    const r = await agirSobreOsEscolhidos(s.pedir, { pedidoId: PEDIDO, accao: ACCOES_DOS_ESCOLHIDOS.pedirAClyon });
    if (!r.ok) throw new Error("devia correr bem");
    expect(r.vista.cartao).toMatchObject({ depois: DEPOIS_DE_CADA_SAIDA.pedirAClyon, botoes: [], ligacoes: [] });
    expect(oQueMostrar(r.vista, null, null)).toBe("cartao");
    // A app só fala com a rota das acções do cliente: nenhuma rota de enviar a profissionais.
    expect(s.pedidos.every((p) => p.caminho === ROTA_DAS_ACCOES)).toBe(true);
    expect(semNotas("app-cliente/src/lib/escolhidos-sem-resposta.ts")).not.toMatch(/redistribuir|\/api\/admin/);
  });

  it("depois de uma saída, o ecrã volta a ler o pedido", () => {
    const C = semNotas("app-cliente/src/componentes/EscolhidosSemResposta.tsx");
    expect(C).toContain("setVista(r.vista);");
    expect(C).toContain("aoMudar();");
    expect(semNotas("app-cliente/src/componentes/VistaDoPedido.tsx")).toContain("aoMudar={depoisDeAgir}");
    // Um segundo toque com um pedido a caminho não envia outro.
    expect(C).toContain("if (aEnviar) return;");
  });
});

describe("3. «Escolher outro parceiro»", () => {
  it("a lista é a da rota: os textos, o máximo e os cartões das mudanças (com o IVA à frente)", async () => {
    const s = site(DEPOIS);
    const r = await agirSobreOsEscolhidos(s.pedir, { pedidoId: PEDIDO, accao: ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro });
    if (!r.ok || !r.lista) throw new Error("devia vir a lista");
    expect(r.lista).toMatchObject({
      titulo: TEXTOS_DE_ESCOLHER_OUTRO.titulo,
      linha: TEXTOS_DE_ESCOLHER_OUTRO.linha(MAXIMO_DE_ESCOLHIDOS),
      botao: TEXTOS_DE_ESCOLHER_OUTRO.botao,
      maximo: MAXIMO_DE_ESCOLHIDOS,
      pessoas: 2,
      semMaisNinguem: null,
    });
    expect(r.lista.parceiros.map((p) => [p.id, p.nome])).toEqual([
      ["b", "Outra Empresa"],
      ["c", "Terceira"],
    ]);
    expect(r.lista.parceiros[0].estimativa.texto).toBe(cartao("b", "Outra Empresa").estimativa.texto);
    expect(r.lista.parceiros[0].estimativa.texto).toMatch(/com IVA/);
    expect(oQueMostrar({ cartao: null, prazoTexto: null }, r.lista, null)).toBe("lista");
    expect(botaoDeEscolherOutros(r.lista, 0)).toBe(TEXTOS_DE_ESCOLHER_OUTRO.botao);
    expect(botaoDeEscolherOutros(r.lista, 2)).toBe(`${TEXTOS_DE_ESCOLHER_OUTRO.botao} (2)`);
    expect(saidaSemMaisNinguem(r.lista, cartaoDoCliente([escolhida()], semPedir, DEPOIS))).toBeNull();
  });

  it("«Pedir orçamento» manda os ids que marcou e a assinatura do preço que viu em cada um, e lê «Pedido enviado a…»", async () => {
    const s = site(DEPOIS);
    const r = await agirSobreOsEscolhidos(s.pedir, { pedidoId: PEDIDO, accao: ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro });
    if (!r.ok || !r.lista) throw new Error("devia vir a lista");
    expect(corpoDeEscolherOutros(PEDIDO, r.lista, [])).toBeNull();
    expect(corpoDeEscolherOutros(PEDIDO, r.lista, ["não-está-na-lista"])).toBeNull();
    const corpo = corpoDeEscolherOutros(PEDIDO, r.lista, ["c", "b"])!;
    expect(corpo).toEqual({
      pedidoId: PEDIDO,
      accao: "escolher_outros_parceiros",
      parceiros: ["b", "c"],
      assinaturas: { b: "assinatura-de-b", c: "assinatura-de-c" },
    });
    const enviado = await agirSobreOsEscolhidos(s.pedir, corpo);
    if (!enviado.ok) throw new Error("devia correr bem");
    expect(enviado.enviado).toBe(pedidoEnviadoAOutros(["Outra Empresa", "Terceira"], prazoDeResposta(DEPOIS), DEPOIS));
    expect(enviado.enviado).toMatch(/^Pedido enviado a Outra Empresa, Terceira\. Têm até /);
    expect(enviado.vista).toEqual({ cartao: null, prazoTexto: null });
    expect(oQueMostrar(enviado.vista, null, enviado.enviado)).toBe("enviado");
    // A seguir o prazo novo corre; a frase «Pedido enviado a…» fica à frente da linha do prazo.
    expect(oQueMostrar(await lerOsEscolhidos(s.pedir, PEDIDO), null, enviado.enviado)).toBe("enviado");
  });

  it("sem mais ninguém na lista: a frase da rota e o botão de pedir à CLYON", async () => {
    const s = site(DEPOIS, { outros: [] });
    const r = await agirSobreOsEscolhidos(s.pedir, { pedidoId: PEDIDO, accao: ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro });
    if (!r.ok || !r.lista) throw new Error("devia vir a lista");
    expect(r.lista.semMaisNinguem).toBe(TEXTOS_DE_ESCOLHER_OUTRO.semMaisNinguem);
    // O botão é o que o cartão já trazia (com o texto da rota), agora como principal.
    const cartaoDeAntes = vistaValida(s.vista()).cartao;
    expect(saidaSemMaisNinguem(r.lista, cartaoDeAntes)).toEqual({ accao: "pedir_a_clyon_que_procure", texto: SAIDAS_DO_CLIENTE.pedirAClyon, principal: true });
    // Depois de «Esperar», a saída está nas ligações: serve na mesma.
    const esperou = vistaValida({ cartao: cartaoDoCliente([escolhida()], { ...semPedir, decisao: { saida: "esperar", em: DEPOIS.toISOString(), por: "cliente" } }, DEPOIS) }).cartao;
    expect(saidaSemMaisNinguem(r.lista, esperou)?.texto).toBe(SAIDAS_DO_CLIENTE.pedirAClyon);
    // Já tinha pedido à CLYON (o cartão não traz esse botão): fica só a frase da rota.
    const jaPediu = vistaValida({ cartao: cartaoDoCliente([escolhida()], { ...semPedir, procurarMais: true }, DEPOIS) }).cartao;
    expect(saidaSemMaisNinguem(r.lista, jaPediu)).toBeNull();
    expect(saidaSemMaisNinguem(r.lista, null)).toBeNull();
  });

  it("uma resposta que não é a lista não se desenha", () => {
    expect(listaParaEscolherValida({ ok: false, error: "x" })).toBeNull();
    expect(listaParaEscolherValida({ ok: true })).toBeNull();
    // Um máximo estranho não passa do do site; um cartão sem IVA fica de fora.
    const l = listaParaEscolherValida({ ok: true, titulo: "T", maximoDeEscolhidos: 9, parceiros: [{ ...cartao("x", "X"), estimativa: { texto: "100 €" } }, cartao("y", "Y")] })!;
    expect(l.maximo).toBe(MAXIMO_DE_ESCOLHIDOS);
    expect(l.parceiros.map((p) => p.id)).toEqual(["y"]);
  });
});

describe("4. as recusas da rota", () => {
  it("um parceiro respondeu entretanto, ou o pedido fechou: «já não é preciso», com o botão da rota", async () => {
    const respondeu = await agirSobreOsEscolhidos(site(DEPOIS, { negociacoes: [escolhida({ propostasJson: comProposta })] }).pedir, { pedidoId: PEDIDO, accao: ACCOES_DOS_ESCOLHIDOS.esperar });
    expect(respondeu).toEqual({ ok: false, erro: { texto: ERROS_DO_CLIENTE.jaRespondeu, botao: ERROS_DO_CLIENTE.verOPedido, precoMudou: false } });
    const fechado = await agirSobreOsEscolhidos(site(DEPOIS, { fechado: true }).pedir, { pedidoId: PEDIDO, accao: ACCOES_DOS_ESCOLHIDOS.pedirAClyon });
    expect(fechado).toEqual({ ok: false, erro: { texto: ERROS_DO_CLIENTE.jaFechado, botao: ERROS_DO_CLIENTE.verOPedido, precoMudou: false } });
    // O botão relê o pedido e o cartão.
    const C = semNotas("app-cliente/src/componentes/EscolhidosSemResposta.tsx");
    expect(C).toContain("titulo={erro.botao}");
    expect(C).toContain("void ler(true); aoMudar();");
  });

  it("o preço de um dos que marcou mudou: a frase da rota, e a lista pede-se outra vez", async () => {
    const s = site(DEPOIS, { precoMudou: true });
    const r = await agirSobreOsEscolhidos(s.pedir, { pedidoId: PEDIDO, accao: ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro });
    if (!r.ok || !r.lista) throw new Error("devia vir a lista");
    const recusa = await agirSobreOsEscolhidos(s.pedir, corpoDeEscolherOutros(PEDIDO, r.lista, ["b"])!);
    expect(recusa).toEqual({ ok: false, erro: { texto: "O preço de um dos parceiros mudou. Veja a lista outra vez.", botao: null, precoMudou: true } });
    const C = semNotas("app-cliente/src/componentes/EscolhidosSemResposta.tsx");
    expect(C).toContain("if (r.erro.precoMudou) { const nova = await agirSobreOsEscolhidos(pedir, { pedidoId, accao: ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro });");
  });

  it("sem resposta nenhuma (sem rede): a frase de sempre da app, e nunca lança", async () => {
    // O `pedir` da app (api.ts) lança assim quando o site nem respondeu.
    const semRede: Pedir = async () => {
      throw new ErroDaApi(SEM_REDE, 0);
    };
    expect(await agirSobreOsEscolhidos(semRede, { pedidoId: PEDIDO, accao: ACCOES_DOS_ESCOLHIDOS.esperar })).toEqual({
      ok: false,
      erro: { texto: SEM_REDE, botao: null, precoMudou: false },
    });
    const partido: Pedir = async () => {
      throw new TypeError("qualquer outra coisa");
    };
    expect(await agirSobreOsEscolhidos(partido, { pedidoId: PEDIDO, accao: ACCOES_DOS_ESCOLHIDOS.esperar })).toEqual({
      ok: false,
      erro: { texto: NAO_FOI_POSSIVEL, botao: null, precoMudou: false },
    });
    // O botão de «já não é preciso» só existe com o texto da rota.
    expect(erroDosEscolhidos(new ErroDaApi("x", 409, { jaNaoEPreciso: true })).botao).toBeNull();
    expect(semNotas("app-cliente/src/lib/api.ts")).toContain("throw new ErroDaApi(sinal?.aborted ? REDE_LENTA : SEM_REDE, 0);");
  });
});

describe("5. o aviso no telemóvel abre o pedido, e o cartão relê-se com ele", () => {
  it("`tipo: \"escolhidos_sem_resposta\"` com `pedidoId` abre esse pedido", () => {
    expect(TIPO_DO_AVISO).toBe("escolhidos_sem_resposta");
    expect(caminhoDoAviso({ tipo: TIPO_DO_AVISO, pedidoId: PEDIDO })).toBe(`/pedido/${PEDIDO}`);
    expect(caminhoDoAviso({ tipo: TIPO_DO_AVISO, pedidoId: String(PEDIDO) })).toBe(`/pedido/${PEDIDO}`);
    // É o que o site manda no aviso (para a app de cliente, nunca para a Pro).
    const servidor = semNotas("src/lib/escolhidos-sem-resposta-no-servidor.ts");
    expect(servidor).toContain(`pedidoId: pedido.id, tipo: "${TIPO_DO_AVISO}", }, "cliente", );`);
    // Tocar no aviso leva ao caminho; com o pedido já aberto, o aviso relê-o.
    expect(semNotas("app-cliente/src/app/_layout.tsx")).toContain("router.push(caminhoDoAviso(r.notification.request.content.data) as never)");
    expect(semNotas("app-cliente/src/componentes/VistaDoPedido.tsx")).toContain("if (Number(dados?.pedidoId) === pedidoId) void carregar(true);");
  });

  it("de cada vez que o pedido se relê, o cartão relê-se (é assim que aparece quando o prazo passa com o ecrã aberto)", () => {
    const VISTA = semNotas("app-cliente/src/componentes/VistaDoPedido.tsx");
    expect(VISTA).toContain("setR(lido); setErro(null); setReleitura((n) => n + 1);");
    expect(VISTA).toContain("releitura={releitura}");
    const C = semNotas("app-cliente/src/componentes/EscolhidosSemResposta.tsx");
    expect(C).toContain("useEffect(() => { if (activo) void ler(); }, [activo, releitura, ler]);");
    expect(C).toContain("if (!aForca && !podeReler(ultima.current, Date.now())) return;");
  });

  it("com o prazo a correr ou o cartão à vista relê sempre; depois de uma leitura vazia, só passados 5 minutos", () => {
    expect(podeReler(null, 0)).toBe(true);
    expect(podeReler({ vazia: false, em: 1000 }, 1001)).toBe(true);
    expect(podeReler({ vazia: true, em: 1000 }, 1000 + ESPERA_DEPOIS_DE_VAZIO_MS - 1)).toBe(false);
    expect(podeReler({ vazia: true, em: 1000 }, 1000 + ESPERA_DEPOIS_DE_VAZIO_MS)).toBe(true);
    expect(ESPERA_DEPOIS_DE_VAZIO_MS).toBe(300_000);
  });

  it("só se pergunta enquanto se espera pelos escolhidos: nem num Trabalho CLYON, nem contratado, nem fechado", () => {
    expect(valeAPenaLer({ trabalhoClyon: false, contratado: false, fechado: false })).toBe(true);
    expect(valeAPenaLer({ trabalhoClyon: true, contratado: false, fechado: false })).toBe(false);
    expect(valeAPenaLer({ trabalhoClyon: false, contratado: true, fechado: false })).toBe(false);
    expect(valeAPenaLer({ trabalhoClyon: false, contratado: false, fechado: true })).toBe(false);
    expect(semNotas("app-cliente/src/componentes/EscolhidosSemResposta.tsx")).toContain("if (!activo) return null;");
  });
});

describe("6. a lista: a linha das 3 horas, e «pedir à CLYON» sempre que há parceiros", () => {
  const resposta = (parceiros: unknown[]) =>
    JSON.parse(
      JSON.stringify({
        ok: true,
        ligado: true,
        pessoas: 2,
        resumo: "T2 · Seixal → Almada · cerca de 5,5 h com 2 pessoas",
        recomendaTres: null,
        maximoDeEscolhidos: MAXIMO_DE_ESCOLHIDOS,
        parceiros,
        semParceiros: null,
        ordenacao: ORDENACAO,
        textos: TEXTOS_DA_LISTA,
      }),
    );

  it("a app lê `textos.prazo` e `textos.procurarMaisAjuda` da rota, e mostra a linha por baixo de «Escolha até 3…»", () => {
    const l = listaValida(resposta([cartao("a", "Mudanças Exemplo"), cartao("b", "Outra Empresa")]))!;
    if (!l.ligado) throw new Error("ligado");
    expect(l.textos.prazo).toBe(LINHA_DAS_3_HORAS);
    expect(l.textos.prazo).toBe(
      "Os parceiros que escolher têm 3 horas para responder, entre as 8h e as 21h. Se nenhum responder, avisamos: pode esperar, escolher outro ou pedir à CLYON que procure por si.",
    );
    expect(l.textos.procurarMaisAjuda).toBe(AJUDA_DO_PROCURAR_MAIS);
    const ECRA = semNotas("app-cliente/src/componentes/ParceirosDaMudanca.tsx");
    expect(ECRA).toContain("{l.textos.escolha ? <Paragrafo>{l.textos.escolha}</Paragrafo> : null} {l.textos.prazo ? <Paragrafo>{l.textos.prazo}</Paragrafo> : null}");
    expect(ECRA).toContain("{l.textos.procurarMaisAjuda ? <Text");
  });

  it("um site antigo, sem a linha: não se mostra nada no lugar dela", () => {
    const { prazo: _prazo, procurarMaisAjuda: _ajuda, ...antigos } = TEXTOS_DA_LISTA;
    const l = listaValida({ ...resposta([cartao("a", "A")]), textos: antigos })!;
    expect(l.ligado && l.textos.prazo).toBe("");
    expect(l.ligado && l.textos.procurarMaisAjuda).toBe("");
  });

  it("a opção «Pedir também à CLYON…» aparece sempre que há parceiros — já não só com exactamente um", () => {
    const ECRA = semNotas("app-cliente/src/componentes/ParceirosDaMudanca.tsx");
    expect(ECRA).not.toMatch(/parceiros\.length === 1/);
    expect(semNotas("app-cliente/src/lib/parceiros-da-mudanca.ts")).not.toMatch(/parceiros\.length === 1/);
    // Está dentro do bloco «há parceiros», e só depende de a rota mandar o texto.
    const bloco = ECRA.slice(ECRA.indexOf("{!aCarregar && l && l.parceiros.length > 0 ? ("));
    expect(bloco).toContain("{l.textos.procurarMais ? ( <Pressable onPress={() => aoMudarProcurarMais(!procurarMais)}");
  });

  it("marcada, vai no pedido com um, dois ou três parceiros na lista; desmarcada (por omissão), não vai", () => {
    for (const cartoes of [[cartao("a", "A")], [cartao("a", "A"), cartao("b", "B")], [cartao("a", "A"), cartao("b", "B"), cartao("c", "C")]]) {
      const l = listaValida(resposta(cartoes))!;
      if (!l.ligado) throw new Error("ligado");
      expect(escolhaFeita(["a"], l, 2, true)?.procurarMais, `${cartoes.length} na lista`).toBe(true);
      expect(escolhaFeita(["a"], l, 2, false)?.procurarMais, `${cartoes.length} na lista`).toBe(false);
    }
    // Por omissão começa desmarcada: a CLYON só procura mais se o cliente pedir.
    expect(semNotas("app-cliente/src/componentes/NovoPedido.tsx")).toContain("const [procurarMaisParceiros, setProcurarMaisParceiros] = useState(false);");
  });
});

describe("7. paridade — a app não tem frases próprias: lê as do site", () => {
  const FICHEIROS = [
    "app-cliente/src/lib/escolhidos-sem-resposta.ts",
    "app-cliente/src/componentes/EscolhidosSemResposta.tsx",
    "app-cliente/src/componentes/ParceirosDaMudanca.tsx",
    "app-cliente/src/lib/parceiros-da-mudanca.ts",
    "app-cliente/src/componentes/VistaDoPedido.tsx",
  ];

  it("nenhuma frase da lib está escrita à mão na app", () => {
    const frases = [
      ...Object.values(SAIDAS_DO_CLIENTE),
      ...Object.values(DEPOIS_DE_CADA_SAIDA),
      ...Object.values(ERROS_DO_CLIENTE),
      TEXTOS_DE_ESCOLHER_OUTRO.titulo,
      TEXTOS_DE_ESCOLHER_OUTRO.botao,
      TEXTOS_DE_ESCOLHER_OUTRO.semMaisNinguem,
      JA_ESTA_A_PROCURAR,
      LINHA_DAS_3_HORAS,
      AJUDA_DO_PROCURAR_MAIS,
      TEXTOS_DA_LISTA.procurarMais,
      "ainda não respondeu",
      "ainda não responderam",
      "O prazo de 3 horas",
      "3 horas para responder",
      "para responder.",
      "Pedido enviado a",
      "Os que já escolheu continuam",
    ];
    for (const f of FICHEIROS) {
      const fonte = semNotas(f);
      for (const frase of frases) expect(fonte, `${f}: «${frase}»`).not.toContain(frase);
    }
  });

  it("os nomes das acções são os da lib do site, escritos num sítio só; «esperar» só existe no botão que a rota manda", () => {
    const REGRA = semNotas("app-cliente/src/lib/escolhidos-sem-resposta.ts");
    const { esperar, ...asQueAAppSabe } = ACCOES_DOS_ESCOLHIDOS;
    expect({ ...ACCOES_NA_APP }).toEqual(asQueAAppSabe);
    for (const accao of Object.values(ACCOES_DOS_ESCOLHIDOS)) {
      for (const f of FICHEIROS.slice(1)) expect(semNotas(f), `${f}: ${accao}`).not.toContain(`"${accao}"`);
    }
    expect(REGRA).not.toContain(`"${esperar}"`);
    // Os textos chegam pela rota: a app não leva a lib do site no bundle (e a lista do workflow não muda).
    expect(REGRA).not.toContain("src/lib/");
    expect(semNotas("app-cliente/src/componentes/EscolhidosSemResposta.tsx")).not.toContain("src/lib/");
    // A rota é a das acções do cliente, a mesma do resto do pedido.
    expect(REGRA).toContain(`const ROTA = "${ROTA_DAS_ACCOES}";`);
  });

  it("a app e o site desenham os mesmos campos do cartão e da lista", () => {
    const SITE = semNotas("src/components/EscolhidosSemResposta.tsx");
    const APP = semNotas("app-cliente/src/componentes/EscolhidosSemResposta.tsx");
    for (const campo of ["cartao.titulo", "cartao.linha", "cartao.depois", "cartao.nota", "cartao.botoes", "cartao.ligacoes", "lista.titulo", "lista.linha", "lista.semMaisNinguem"]) {
      expect(SITE, `site: ${campo}`).toContain(campo);
      expect(APP, `app: ${campo}`).toContain(campo);
    }
    // O botão da lista é o da rota, com a conta dos marcados ao lado, nos dois.
    expect(SITE).toContain("{lista.botao}");
    expect(semNotas("app-cliente/src/lib/escolhidos-sem-resposta.ts")).toContain("return quantos > 0 ? `${l.botao} (${quantos})` : l.botao;");
  });
});
