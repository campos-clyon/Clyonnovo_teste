import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aceitaTermosNoCorpo,
  corpoDoRegime,
  faixaDoValorEmAtraso,
  mostrarOsTermos,
  regimeInicial,
  termosLidos,
  COMPLETAR_O_PERFIL as DA_APP,
  type EstadoDosTermos,
  type NovoModeloDaCarteira,
} from "../../app-pro/src/lib/novo-modelo";
import { ORIGEM_DA_APP } from "../../app-pro/src/lib/candidatura";
import { vistoDaR5 } from "../../app-cliente/src/lib/pagar-ao-parceiro";
import { totalAoParceiroEmTexto } from "./pagar-ao-parceiro-para-o-cliente";
import { estadoDoPagar } from "../../app-cliente/src/lib/pagamento";
import { corpoDoFecho, type Pagamento } from "../../app-cliente/src/lib/pedidos";
import { passosDoPedido } from "../../app-cliente/src/lib/passos-do-pedido";
import { COMPLETAR_O_PERFIL, estadoDosDadosParaReceber, FAIXA_DOS_DADOS_PARA_RECEBER } from "./dados-para-receber";
import { ROTULOS_DA_CARTEIRA, rotulosDaCarteira } from "./rotulos-da-carteira";
import {
  comoRecebe,
  comoRecebeDoModelo,
  depoisDeAprovado,
  depoisDeAprovadoDoModelo,
  DEPOIS_DE_APROVADO_NO_NOVO_MODELO,
} from "./como-funciona-para-o-profissional";
import { limparOrigemDaCandidatura } from "./origem-da-candidatura";
import { ondeEstaODinheiro } from "./fim-do-trabalho";
import { TEXTOS_DA_ACEITACAO, VERSAO_DOS_TERMOS } from "./aceitacao-dos-termos";
import { ACCAO_DO_FECHO } from "./fecho-do-modelo-novo";
import { NOVO_MODELO_DESDE } from "./novo-modelo";

/**
 * D18 E AS PARTES DAS APPS DAS d15, d16, d17, d19 E d20 (13-11-2026) — o passo 3
 * da d10 nas duas apps, inerte até à data do SERVIDOR.
 *
 * A regra que não se parte: as apps não têm o relógio do modelo. Tudo o que é
 * novo aparece só com um campo que o servidor manda (`novoModelo`,
 * `noNovoModelo`, `pagaAoParceiro`, `aoParceiro`, `perguntaDoFecho`,
 * `precisaDeAceitar`, `emVigor`); antes de 15-11 vêm nulos ou falsos, e as apps
 * ficam como estão. Os ecrãs (React Native) lêem-se, como nos outros testes.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const dia = (iso: string | null) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : null);

const ANTES = new Date("2026-11-14T23:59:00Z");
const NO_DIA = new Date("2026-11-15T09:00:00Z");

const carteira = (o: Partial<NovoModeloDaCarteira> = {}): NovoModeloDaCarteira => ({
  emVigor: true,
  valorEmAtraso: 0,
  valores: [],
  standBy: null,
  dadosParaReceber: { estado: "completos" },
  ...o,
});
const valor = (negociacaoId: number, total: number, prazoAte: string | null) => ({
  negociacaoId,
  pedidoId: 500 + negociacaoId,
  total,
  iva: 0,
  taxa: total,
  nasceuEm: null,
  prazoAte,
  multibanco: null,
});

describe("app Pro — a faixa do valor em atraso, com os 4 dias e «Pagar o valor em atraso»", () => {
  it("antes da data (sem novoModelo) ou sem nada a pagar, não há faixa", () => {
    expect(faixaDoValorEmAtraso(null, euros, dia)).toBeNull();
    expect(faixaDoValorEmAtraso(undefined, euros, dia)).toBeNull();
    expect(faixaDoValorEmAtraso(carteira(), euros, dia)).toBeNull();
  });

  it("com valores: o total, o prazo mais próximo e o botão", () => {
    const f = faixaDoValorEmAtraso(
      carteira({ valores: [valor(1, 30.75, "2026-11-21T23:59:00Z"), valor(2, 12.3, "2026-11-19T23:59:00Z")] }),
      euros,
      dia,
    );
    expect(f?.standBy).toBe(false);
    expect(f?.titulo).toBe("Valor em atraso · 43,05 €");
    expect(f?.texto).toContain("de 2 trabalhos");
    expect(f?.texto).toContain("Tem 4 dias");
    expect(f?.texto).toContain("pague até 19/11");
    expect(f?.botao).toBe("Pagar o valor em atraso");
  });

  it("em stand-by: a frase do site e o mesmo botão", () => {
    const f = faixaDoValorEmAtraso(
      carteira({ valores: [valor(1, 30.75, "2026-11-10T00:00:00Z")], standBy: { total: 30.75, accao: "Pagar o valor em atraso", explicacao: "EXPLICACAO DO SITE", negociacoes: [1] } }),
      euros,
      dia,
    );
    expect(f).toEqual({ standBy: true, titulo: "Conta em stand-by · 30,75 €", texto: "EXPLICACAO DO SITE", botao: "Pagar o valor em atraso" });
  });

  it("o Início e o pedido mostram a faixa com os botões; só com o novoModelo da carteira", () => {
    const s = semComentarios(ler("app-pro/src/componentes/AvisosDoNovoModelo.tsx"));
    expect(s).toContain("if (!nm) return null;");
    expect(s).toContain("faixaDoValorEmAtraso(nm, euros, diaCurto)");
    expect(s).toContain('router.push("/carteira")');
    expect(s).toContain("titulo={COMPLETAR_O_PERFIL}");
    expect(ler("app-pro/src/app/(app)/index.tsx")).toContain("<AvisosDoNovoModelo />");
  });
});

describe("app Pro e painel — a faixa dos dados para receber é a do CEO (d11 v2)", () => {
  const semDados = { iban: "", ibanTitular: "", mbway: "", regimeIva: "normal", regimeIvaConfirmadoEm: null, estado: "aprovado", aprovadoEm: "2026-10-01T10:00:00Z" };

  it("até 22-11 a frase é a da faixa, e o botão «Completar o perfil» é o mesmo", () => {
    const e = estadoDosDadosParaReceber(semDados, NO_DIA);
    expect(e.estado).toBe("aviso");
    expect(e.estado === "aviso" && e.frase).toBe(FAIXA_DOS_DADOS_PARA_RECEBER);
    expect(FAIXA_DOS_DADOS_PARA_RECEBER).toBe(
      "A partir de 15 de novembro de 2026 recebe diretamente do cliente. Até 22 de novembro de 2026, complete no perfil o IBAN, o titular, o MB WAY e o regime de IVA (escolha e grave).",
    );
    expect(DA_APP).toBe(COMPLETAR_O_PERFIL);
    expect(COMPLETAR_O_PERFIL).toBe("Completar o perfil");
    expect(estadoDosDadosParaReceber(semDados, ANTES).estado).toBe("ainda_nao_vale");
  });
});

describe("app Pro — d17: «o cliente ainda não pagou à CLYON» só no modelo antigo", () => {
  it("o ecrã segue a regra: as três frases do dinheiro na CLYON só com noNovoModelo !== true", () => {
    const s = semComentarios(ler("app-pro/src/componentes/TrabalhoContratado.tsx"));
    expect(s).toContain("t.clientePagou === true && t.noNovoModelo !== true");
    expect(s).toContain('t.clientePagou === false && t.pagamentoACaminho === "transferencia" && t.noNovoModelo !== true');
    expect(s).toContain('t.clientePagou === false && t.pagamentoACaminho !== "transferencia" && t.noNovoModelo !== true');
    // `t` traz o noNovoModelo do servidor, e a linha do dinheiro lê-o.
    expect(s).toContain("ondeEstaODinheiro(t)");
    expect(ler("app-pro/src/lib/trabalhos.ts")).toContain("noNovoModelo?: boolean;");
  });

  it("a mesma função do site diz outra coisa no modelo novo", () => {
    const base = { fase: "confirmado", formaDePagamento: "na_plataforma", clientePagou: null, valorAcordado: 350, criadaEm: "2026-11-15T10:00:00Z" };
    const novo = ondeEstaODinheiro({ ...base, noNovoModelo: true });
    expect(novo).not.toBeNull();
    expect(novo?.frase).not.toMatch(/ainda não pagou à CLYON/);
  });
});

describe("app Pro — d16: os textos escolhem pelo servidor, nunca pelo relógio", () => {
  it("como recebe e depois de aprovado: as duas versões, pelo booleano", () => {
    expect(comoRecebeDoModelo(false)).toEqual(comoRecebe(ANTES));
    expect(comoRecebeDoModelo(true)).toEqual(comoRecebe(NO_DIA));
    expect(depoisDeAprovadoDoModelo(false)).toBe(depoisDeAprovado(ANTES));
    expect(depoisDeAprovadoDoModelo(true)).toBe(DEPOIS_DE_APROVADO_NO_NOVO_MODELO);
  });

  it("a carteira: os rótulos não mudam; as notas do dinheiro na CLYON mudam só no modelo novo", () => {
    expect(rotulosDaCarteira(false)).toBe(ROTULOS_DA_CARTEIRA);
    const novo = rotulosDaCarteira(true);
    for (const k of Object.keys(ROTULOS_DA_CARTEIRA) as Array<keyof typeof ROTULOS_DA_CARTEIRA>) {
      expect(novo[k].rotulo).toBe(ROTULOS_DA_CARTEIRA[k].rotulo);
    }
    expect(ROTULOS_DA_CARTEIRA.aEsperaDaConfirmacao.nota).toContain("o cliente já pagou à CLYON");
    expect(novo.aEsperaDaConfirmacao.nota).toContain("antes de 15 de novembro");
    expect(novo.aPagarAClyon.nota).toContain("a taxa da plataforma e o IVA dela");
    // O mapa de sempre não muda (o painel e os textos antigos continuam a lê-lo).
    expect(ROTULOS_DA_CARTEIRA.aPagarAClyon.nota).toBe("IVA e taxa da plataforma de trabalhos pagos em dinheiro");
  });

  it("os ecrãs: carteira, como funciona, IBAN/MB WAY e registo, pelo campo do servidor", () => {
    const carteiraTsx = semComentarios(ler("app-pro/src/app/(app)/carteira.tsx"));
    expect(carteiraTsx).toContain("const noNovoModelo = dados.novoModelo != null;");
    expect(carteiraTsx).toContain("const R = rotulosDaCarteira(noNovoModelo);");
    expect(carteiraTsx).toContain("noNovoModelo ? PROMESSA_DO_NOVO_MODELO : PROMESSA");
    expect(semComentarios(ler("app-pro/src/app/conta/como-funciona.tsx"))).toContain("comoRecebeDoModelo(perfil?.novoModelo != null)");
    const banco = semComentarios(ler("app-pro/src/app/conta/banco.tsx"));
    expect(banco).toContain("dica={ajudaDoMbway(Boolean(perfil.novoModelo))}");
    expect(banco).not.toContain('dica="Outra forma de lhe pagarmos');
    const registo = semComentarios(ler("app-pro/src/app/registo.tsx"));
    expect(registo).toContain("{depoisDeAprovadoDoModelo(noNovoModelo)}");
    expect(registo).toContain("setNoNovoModelo(termosLidos(r)?.emVigor === true)");
    expect(registo).toContain("const [noNovoModelo, setNoNovoModelo] = useState(false);");
    expect(registo).not.toContain("O NIF, a morada fiscal e o IBAN\n");
  });

  it("nenhum ecrã das apps decide o modelo pelo relógio do telemóvel", () => {
    for (const f of [
      "app-pro/src/app/(app)/carteira.tsx",
      "app-pro/src/app/conta/como-funciona.tsx",
      "app-pro/src/app/conta/banco.tsx",
      "app-pro/src/app/conta/faturacao.tsx",
      "app-pro/src/app/registo.tsx",
      "app-pro/src/app/definir-senha/[token].tsx",
      "app-pro/src/componentes/AceitarOsTermos.tsx",
      "app-pro/src/componentes/AvisosDoNovoModelo.tsx",
      "app-pro/src/componentes/TrabalhoContratado.tsx",
      "app-pro/src/lib/novo-modelo.ts",
      "app-cliente/src/componentes/PagarAoParceiro.tsx",
      "app-cliente/src/componentes/TrabalhoJaFeito.tsx",
      "app-cliente/src/componentes/Pagar.tsx",
      "app-cliente/src/lib/pagamento.ts",
    ]) {
      const s = ler(f);
      expect(s, f).not.toMatch(/novoModeloEmVigor|pedidoNovoNoNovoModelo|NOVO_MODELO_DESDE\b|comoRecebe\(|depoisDeAprovado\(/);
    }
  });
});

describe("app Pro — a candidatura leva a origem", () => {
  it("no molde do site, e o servidor guarda-a tal e qual", () => {
    expect(limparOrigemDaCandidatura(ORIGEM_DA_APP)).toEqual({ ...ORIGEM_DA_APP });
    expect(semComentarios(ler("app-pro/src/app/registo.tsx"))).toContain("origem: ORIGEM_DA_APP,");
  });
});

describe("app Pro — d19: o regime de IVA só se confirma com um toque", () => {
  it("começa vazio quando o perfil não o tem confirmado", () => {
    expect(regimeInicial("")).toBe("");
    expect(regimeInicial(null)).toBe("");
    expect(regimeInicial("qualquer")).toBe("");
    expect(regimeInicial("isento")).toBe("isento");
    expect(regimeInicial("normal")).toBe("normal");
  });

  it("só segue com um toque, e então com confirmarRegime", () => {
    expect(corpoDoRegime("isento", false)).toEqual({});
    expect(corpoDoRegime("", true)).toEqual({});
    expect(corpoDoRegime("normal", true)).toEqual({ regimeIva: "normal", confirmarRegime: true });
  });

  it("o ecrã: sem «isento» por omissão, a escolha à vista de toda a gente", () => {
    const s = semComentarios(ler("app-pro/src/app/conta/faturacao.tsx"));
    expect(s).toContain("useState<\"isento\" | \"normal\" | \"\">(regimeInicial(perfil.regimeIva))");
    expect(s).toContain("...corpoDoRegime(regime, regimeEscolhido),");
    expect(s).not.toMatch(/regimeIva: regime,/);
    expect(s).not.toMatch(/\{emiteFatura \|\| perfil\.novoModelo \? \(/);
    expect(s).toContain("setRegimeEscolhido(true);");
  });
});

describe("app Pro — d20: os Termos no primeiro acesso, pelo servidor", () => {
  const t: EstadoDosTermos = {
    versao: VERSAO_DOS_TERMOS,
    versaoPorExtenso: "15 de novembro de 2026",
    emVigor: true,
    aceiteEm: null,
    precisaDeAceitar: true,
    textos: TEXTOS_DA_ACEITACAO,
  };

  it("aparece só quando o servidor pede, e não depois de «Agora não» nesta abertura", () => {
    expect(mostrarOsTermos(t, null)).toBe(true);
    expect(mostrarOsTermos(t, VERSAO_DOS_TERMOS)).toBe(false);
    expect(mostrarOsTermos({ ...t, precisaDeAceitar: false }, null)).toBe(false);
    expect(mostrarOsTermos(null, null)).toBe(false);
    expect(termosLidos({ error: "Não autenticado" })).toBeNull();
    expect(termosLidos(t)).toEqual(t);
  });

  it("no definir-senha, a versão só com a caixa marcada e os Termos em vigor", () => {
    expect(aceitaTermosNoCorpo(t, false)).toEqual({});
    expect(aceitaTermosNoCorpo(t, true)).toEqual({ aceitaTermos: "2026-11-15" });
    expect(aceitaTermosNoCorpo({ ...t, emVigor: false }, true)).toEqual({});
    expect(aceitaTermosNoCorpo(null, true)).toEqual({});
    expect(VERSAO_DOS_TERMOS).toBe(NOVO_MODELO_DESDE.toISOString().slice(0, 10));
  });

  it("os ecrãs: a caixa nunca vem marcada, o botão só com ela, e «Agora não» não grava nada", () => {
    const s = semComentarios(ler("app-pro/src/componentes/AceitarOsTermos.tsx"));
    expect(s).toContain("const [marcada, setMarcada] = useState(false);");
    expect(s).toContain("desactivado={!marcada}");
    expect(s).toContain("corpo: { versao: estado.versao, aceito: true }");
    const agoraNao = s.slice(s.indexOf("function agoraNao()"), s.indexOf("async function aceitar()"));
    expect(agoraNao).not.toContain("pedir(");
    expect(ler("app-pro/src/app/(app)/index.tsx")).toContain("<AceitarOsTermos />");
    const senha = semComentarios(ler("app-pro/src/app/definir-senha/[token].tsx"));
    expect(senha).toContain("const [aceitaTermos, setAceitaTermos] = useState(false);");
    expect(senha).toContain("...aceitaTermosNoCorpo(termos, aceitaTermos)");
    expect(senha).toContain("pedir<unknown>(ROTA_DOS_TERMOS, { semSessao: true })");
    expect(senha).toContain("termos?.emVigor ? (");
  });

  it("a rota sem sessão dá só a parte pública; com um token que não vale, 401", () => {
    const r = ler("src/app/api/profissionais/termos/route.ts");
    const publica = r.slice(r.indexOf("if (semToken(req)) {"), r.indexOf("const sessao = await sessaoActivaDoProfissional"));
    expect(publica).toContain("precisaDeAceitar: false");
    expect(publica).toContain("aceiteEm: null");
    expect(publica).toContain('limitarRotaPublica(req, "termos-sem-sessao"');
    expect(publica).not.toMatch(/aceitacaoDoProfissional|providerId/);
    expect(r).toContain('return !req.headers.get("authorization") && !tokenDoProfissional(req);');
  });
});

describe("app de cliente — d18: «Pagar ao parceiro» pela R5", () => {
  const conta = { semIva: 291, total: 358.05, faturaDoParceiro: 324.6, faturaDaTaxa: 33.45, ivaDoParceiro: 0, ivaDaTaxa: 6.26 };

  it("o total pelo regime, com o sem IVA ao lado e as duas faturas — a frase do site, escrita no servidor", () => {
    expect(totalAoParceiroEmTexto(conta)).toBe(
      "Total: 358,05 € com IVA (291,00 € sem IVA) — fatura do trabalho 324,60 € e fatura da taxa da plataforma 33,45 €.",
    );
    expect(totalAoParceiroEmTexto({ ...conta, total: null })).toBeNull();
    expect(ler("src/lib/pagar-ao-parceiro-para-o-cliente.ts")).toContain("totalEmTexto: c ? totalAoParceiroEmTexto(");
    // A mesma frase do bloco do site.
    const site = ler("src/components/PagarAoParceiro.tsx");
    expect(site).toContain("com IVA ({euros(visto.conta.semIva)} sem IVA) — fatura do");
    expect(site).toContain("fatura da taxa da plataforma {euros(visto.conta.faturaDaTaxa)}.");
  });

  it("o bloco da R5 só conta com pagaAoParceiro; sem ele (site antigo) pergunta-se à rota", () => {
    expect(vistoDaR5(null)).toBeNull();
    expect(vistoDaR5(undefined)).toBeNull();
    expect(vistoDaR5({ pagaAoParceiro: false })).toBeNull();
    expect(vistoDaR5({ pagaAoParceiro: true, conta })?.conta).toEqual(conta);
    const s = semComentarios(ler("app-cliente/src/componentes/PagarAoParceiro.tsx"));
    expect(s).toContain("if (daR5 === undefined) void ler();");
    expect(s).toContain("{visto.totalEmTexto}");
    expect(s).not.toContain("visto.conta");
    expect(s).toContain("visto.semDados ?");
    const vista = semComentarios(ler("app-cliente/src/componentes/VistaDoPedido.tsx"));
    expect(vista).toContain("daR5={contratada.pagamento ? contratada.pagamento.aoParceiro : undefined}");
  });

  const pg = (o: Partial<Pagamento> = {}): Pagamento => ({
    disponivel: false,
    pago: false,
    pagoEmTexto: null,
    emDinheiroAoProfissional: false,
    pendentes: [],
    ivaIncluido: true,
    valoresTexto: { comFactura: "358,05 € (291,00 € sem IVA)", semFactura: "291,00 €" },
    ...o,
  });

  it("o ecrã de pagar: no modelo novo é «ao parceiro», nunca «indisponível» nem «no local»", () => {
    expect(estadoDoPagar(pg({ pagaAoParceiro: true }), 0).tipo).toBe("ao-parceiro");
    expect(estadoDoPagar(pg(), 0).tipo).toBe("indisponivel");
    expect(estadoDoPagar(pg({ emDinheiroAoProfissional: true }), 0).tipo).toBe("no-local");
    const s = semComentarios(ler("app-cliente/src/componentes/Pagar.tsx"));
    expect(s).toContain('estado.tipo === "ao-parceiro" ? (');
    expect(s).toContain("<PagarAoParceiro pedidoId={pedidoId} negociacaoId={n.id} daR5={pg.aoParceiro} />");
  });

  it("o passo a passo: sem o passo do pagamento quando paga ao parceiro", () => {
    const n = {
      profissional: { nome: "Parceiro" },
      fase: "a_executar",
      accoes: [],
      dataCombinada: null,
      dataCombinadaTexto: null,
      aCaminhoEm: null,
      chegouEm: null,
      execucaoEnviadaEm: null,
      confirmadoEm: null,
    };
    const p = { criadoEm: "2026-11-15T10:00:00Z", estadoTexto: "Contratado" };
    const comPagamento = passosDoPedido(p, { ...n, pagamento: pg({ disponivel: true }) } as never, NO_DIA).map((x) => x.id);
    const aoParceiro = passosDoPedido(p, { ...n, pagamento: pg({ pagaAoParceiro: true }) } as never, NO_DIA).map((x) => x.id);
    expect(comPagamento.length).toBe(aoParceiro.length + 1);
  });
});

describe("app de cliente — d15: «O trabalho já foi feito?»", () => {
  it("o corpo vai pela R8 com a acção do servidor e «sim» ou «nao»", () => {
    const pergunta = { negociacaoId: 77, accao: ACCAO_DO_FECHO, pergunta: "?", explicacao: "", sim: "Sim", nao: "Não" };
    expect(corpoDoFecho(500, pergunta, "sim")).toEqual({ pedidoId: 500, negociacaoId: 77, accao: "trabalho_ja_feito", resposta: "sim" });
    expect(corpoDoFecho(500, pergunta, "nao").resposta).toBe("nao");
  });

  it("o cartão só com a pergunta do servidor; um 409 relê o pedido", () => {
    const s = semComentarios(ler("app-cliente/src/componentes/TrabalhoJaFeito.tsx"));
    expect(s).toContain("if (!pergunta && !feito) return null;");
    expect(s).toContain("corpoDoFecho(pedidoId, pergunta, resposta)");
    expect(s).toContain("e.estado === 409");
    expect(s).toContain("{pergunta.sim}".replace("{pergunta.sim}", "titulo={pergunta.sim}"));
    const vista = semComentarios(ler("app-cliente/src/componentes/VistaDoPedido.tsx"));
    expect(vista).toContain("<TrabalhoJaFeito pedidoId={pedidoId} pergunta={contratada.perguntaDoFecho} pedir={pedir} aoMudar={depoisDeAgir} />");
  });
});
