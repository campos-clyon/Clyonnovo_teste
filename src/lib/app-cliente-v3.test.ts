import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { informacaoDoCatalogo, partesDoPreco, textosDaV3 } from "../../app-cliente/src/lib/catalogo";
import {
  catalogoValido,
  corpoDaReferencia,
  corpoDoPedido,
  faltaNoPasso,
  linhasDoResumo,
  rascunhoValido,
  rascunhoVazio,
  referenciaDoCatalogo,
  referenciaValida,
  tituloDoPasso,
  type Catalogo,
  type Rascunho,
} from "../../app-cliente/src/lib/novo-pedido";
import { lerRespostaSemConta, mostrarFolhaDeConta, sessoesValidas } from "../../app-cliente/src/lib/pedido-do-link";
import { corpoDaAlteracao, corpoDePropor, corpoDoPagamento, noSeparador, rotaDaLista, SEPARADORES } from "../../app-cliente/src/lib/pedidos";
import { catalogoDaApp } from "./catalogo-da-app";

/**
 * A APP DE CLIENTE, VERSÃO 3 — ordem do CEO de 29-10-2026, aprovada pelo dono
 * (A6, A7, A8, A10; A9 preparado). As regras da app que não dependem do
 * telemóvel, pelo contrato da especificação v3 (secção E) e pelas regras da
 * Segurança para o link sem conta (D3). Corre na suite do site, como os
 * outros testes da app: importa só os ficheiros puros e lê os outros como texto.
 */

const RAIZ = process.cwd();
const APP = join(RAIZ, "app-cliente");
const ler = (p: string) => readFileSync(join(APP, p), "utf8");
function ficheiros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? ficheiros(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}
const FONTES = ficheiros(join(APP, "src"));

/** Um catálogo R7 v2 como a especificação o descreve (secção E), com os textos de exemplo da G. */
const R7_V2 = {
  ...catalogoDaApp(),
  servicos: [
    { id: "recolha_moveis", nome: "Recolha de móveis", detalhes: "moveis", inclui: "Sofás, camas e armários.", precoReferencia: "40 – 120 € + IVA (49,20 – 147,60 € com IVA)" },
    { id: "recolha_entulho", nome: "Recolha de entulho", detalhes: "entulho", precoReferencia: "Desde 120 €/m³ + IVA (147,60 €/m³ com IVA)" },
    { id: "mudanca", nome: "Mudança", detalhes: "mudanca" },
    { id: "manutencao_casa", nome: "Manutenção da casa", detalhes: "manutencao" },
    { id: "outro", nome: "Outro serviço", detalhes: "outro" },
    { id: "x", nome: "Big bags em breve", detalhes: "outro" },
  ],
  precos: {
    linhas: [
      { servico: "recolha_entulho", rotulo: "Até 10 sacos", texto: "40 – 50 € + IVA (49,20 – 61,50 € com IVA)" },
      { servico: "mudanca", rotulo: "Por hora", texto: "50 € + IVA (61,50 € com IVA)" },
    ],
    nota: "Valor de referência.",
  },
  comoFunciona: [{ titulo: "Descreva", texto: "O que há para levar." }, "Escolha quem vai"],
  zonas: [{ nome: "Lisboa", localidades: ["Lisboa", "Amadora"] }, "Setúbal"],
  avaliacoes: { resumo: "4,9 em 46 avaliações no Google (outubro de 2026)", url: "https://g.page/r/clyon/review", testemunhos: [{ nome: "Paula", mes: "outubro de 2026", texto: "Serviço perfeito." }] },
  perguntas: [{ p: "Quanto custa?", r: "Depende." }, { pergunta: "E o entulho?", resposta: "Em sacos." }],
  textos: {
    ...catalogoDaApp().textos,
    notaDosPrecos: "Valor de referência. O preço de cada trabalho é o da proposta do profissional que escolher.",
    entulhoNota: "Se estiver no chão, o profissional carrega-o no local. Não há contentores nem big bags.",
    tresPassos: [{ titulo: "A CLYON confere o pedido", texto: "Verificados." }],
  },
};

describe("A7 — o catálogo do convidado (R7 v2, S12)", () => {
  const c = catalogoValido(R7_V2) as Catalogo;

  it("o catálogo de hoje (sem a S12) continua a servir, sem blocos de informação", () => {
    const hoje = catalogoValido(catalogoDaApp()) as Catalogo;
    expect(hoje.servicos.length).toBeGreaterThan(0);
    expect(hoje.info).toEqual({ precos: null, comoFunciona: [], zonas: [], avaliacoes: null, perguntas: [] });
    // Os oito do simulador entram todos, Manutenção da casa e Outro serviço incluídos (critério 47).
    expect(hoje.servicos.map((s) => s.id)).toEqual(catalogoDaApp().servicos.map((s) => s.id));
  });

  it("serviços com o que incluem e o preço de referência já escrito; nada «em breve» nem big bags", () => {
    expect(c.servicos.map((s) => s.id)).toEqual(["recolha_moveis", "recolha_entulho", "mudanca", "manutencao_casa", "outro"]);
    expect(c.servicos[0]).toMatchObject({ inclui: "Sofás, camas e armários.", precoReferencia: "40 – 120 € + IVA (49,20 – 147,60 € com IVA)" });
    expect(c.servicos[2].precoReferencia).toBeNull();
  });

  it("os blocos lêem-se pela forma da especificação e pelas variações óbvias", () => {
    const i = informacaoDoCatalogo(R7_V2);
    expect(i.precos?.grupos.map((g) => g.servico)).toEqual(["recolha_entulho", "mudanca"]);
    expect(i.precos?.nota).toBe("Valor de referência.");
    expect(i.comoFunciona).toEqual([{ titulo: "Descreva", texto: "O que há para levar." }, { titulo: "Escolha quem vai", texto: null }]);
    expect(i.zonas).toEqual([{ nome: "Lisboa", localidades: ["Lisboa", "Amadora"] }, { nome: "Setúbal", localidades: [] }]);
    expect(i.perguntas).toEqual([{ p: "Quanto custa?", r: "Depende." }, { p: "E o entulho?", r: "Em sacos." }]);
    expect(i.avaliacoes?.testemunhos).toEqual([{ nome: "Paula", mes: "outubro de 2026", texto: "Serviço perfeito." }]);
  });

  it("as avaliações só abrem no Google (regra j da orquestra)", () => {
    expect(informacaoDoCatalogo(R7_V2).avaliacoes?.url).toBe("https://g.page/r/clyon/review");
    expect(informacaoDoCatalogo({ avaliacoes: { resumo: "x", url: "https://outro.pt/avaliacoes" } }).avaliacoes?.url).toBeNull();
  });

  it("a nota do entulho passa (diz que NÃO há contentores); um texto que os prometa não passa", () => {
    expect(textosDaV3({ entulhoNota: R7_V2.textos.entulhoNota }).entulhoNota).toBe("Se estiver no chão, o profissional carrega-o no local. Não há contentores nem big bags.");
    expect(textosDaV3({ textos: { rodape: "Também com contentores." } }).rodape).toBeNull();
  });

  it("o preço parte-se para o ecrã sem perder o valor com IVA (fica na mesma frase)", () => {
    expect(partesDoPreco("40 – 120 € + IVA (49,20 – 147,60 € com IVA)")).toEqual({ principal: "40 – 120 € + IVA", resto: "(49,20 – 147,60 € com IVA)" });
    expect(partesDoPreco("Sob consulta")).toEqual({ principal: "Sob consulta", resto: null });
    const ui = ler("src/componentes/ui.tsx");
    const bloco = ui.slice(ui.indexOf("export function PrecoDeReferencia"), ui.indexOf("export function Etiqueta"));
    // As duas partes dentro do MESMO <Text> (critério 35).
    expect(bloco).toMatch(/<Text style=\{\{ color: cor[\s\S]*\{principal\}[\s\S]*\{resto \?[\s\S]*<\/Text>\s*\);/);
  });
});

describe("A7 — o convidado: a app abre no Início, sem ecrã de entrada à frente (C0)", () => {
  const raiz = ler("src/app/_layout.tsx");
  const separadores = ler("src/app/(app)/_layout.tsx");

  it("os separadores são os da escolha do dono: Início · Serviços · Pedir · Pedidos · Perfil", () => {
    const nomes = [...separadores.matchAll(/<Tabs\.Screen\s+name="([^"]+)"[\s\S]*?title: "([^"]+)"/g)].map((m) => m[2]);
    expect(nomes).toEqual(["Início", "Serviços", "Pedir", "Pedidos", "Perfil"]);
  });

  it("os separadores não estão atrás da sessão; só o pedido com conta está", () => {
    expect(raiz).toContain('<Stack.Screen name="(app)" />');
    const protegido = raiz.slice(raiz.indexOf("<Stack.Protected guard={ligado}>"), raiz.indexOf("</Stack.Protected>"));
    expect(protegido).not.toContain('"(app)"');
    expect(protegido).toContain('"pedido/[id]"');
    expect(raiz).not.toContain("bem-vindo");
  });

  it("o Início mostra o título da especificação (G1) e lê tudo do catálogo", () => {
    const inicio = ler("src/app/(app)/index.tsx");
    expect(inicio).toContain('"Recolhas, esvaziamentos, mudanças e manutenção da casa"');
    for (const s of ['"Serviços"', '"Como funciona"', '"Avaliações no Google"', '"Zonas com profissionais na CLYON"', '"Perguntas frequentes"', '"Já tem conta? Entrar"']) {
      expect(inicio).toContain(s);
    }
  });

  it("o catálogo fica guardado para abrir sem rede, e não se apaga ao sair", () => {
    const g = ler("src/lib/guardado.ts");
    expect(g).toContain('const CATALOGO = "catalogo.json";');
    const apagar = g.slice(g.indexOf("export function apagarTudoDaConta"), g.indexOf("}", g.indexOf("export function apagarTudoDaConta")));
    expect(apagar).not.toContain("CATALOGO");
  });
});

describe("A8 — o simulador v3 (E3 v3)", () => {
  const c = catalogoValido(R7_V2) as Catalogo;
  const base = (extra: Partial<Rascunho>): Rascunho => ({ ...rascunhoVazio(), descricao: "Restos de obra na garagem", ...extra });

  it("três passos com os nomes do site", () => {
    expect([tituloDoPasso(1, "moveis"), tituloDoPasso(2, "moveis"), tituloDoPasso(2, "mudanca"), tituloDoPasso(3, null)]).toEqual([
      "Que serviço precisa?",
      "Morada e condições de acesso",
      "Local e acesso da mudança",
      "Contacto e revisão",
    ]);
  });

  it("um rascunho da v2 (quatro passos) volta no último passo, sem perder nada", () => {
    const v2 = { ...rascunhoVazio(), passo: 4, servico: "recolha_moveis", descricao: "Um sofá grande" };
    expect(rascunhoValido(v2)).toMatchObject({ passo: 3, servico: "recolha_moveis", descricao: "Um sofá grande" });
  });

  it("entulho: o estado e a quantidade (em sacos, por volume, ou «não tenho a certeza»)", () => {
    const r = base({ servico: "recolha_entulho", entulho: "misto" });
    expect(faltaNoPasso(r, 1, c)).toBe("Diga quanto entulho há, ou «Não tenho a certeza».");
    expect(faltaNoPasso({ ...r, entulhoModo: "sacos" }, 1, c)).toBe("Diga quantos sacos são.");
    const misto = { ...r, entulhoModo: "sacos" as const, ensacados: "4", porEnsacar: "6" };
    expect(faltaNoPasso(misto, 1, c)).toBeNull();
    const { order } = corpoDoPedido(misto, c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 });
    expect(order).toMatchObject({ entulhoState: "misto", entulhoQuantidade: "10", entulhoQuantidadeEnsacados: "4", entulhoQuantidadePorEnsacar: "6" });
    expect(corpoDoPedido({ ...r, entulhoModo: "incerto" }, c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 }).order.entulhoQuantidadeIncerta).toBe(true);
  });

  it("manutenção com repetição, desmontagem, acesso difícil e nota em cada lado, «podem mostrar as fotos» e vídeos chegam com os campos do simulador", () => {
    const manut = corpoDoPedido(base({ servico: "manutencao_casa", repeticao: "quinzenal", desmontagem: true }), c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 }).order;
    expect(manut).toMatchObject({ recurrenceFrequency: "quinzenal", needsDismantling: "simple" });
    expect(corpoDoPedido(base({ servico: "manutencao_casa", repeticao: "pontual" }), c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 }).order.recurrenceFrequency).toBeNull();
    const mudanca = corpoDoPedido(
      base({
        servico: "mudanca",
        tipologia: "T2",
        acesso: { floor: "2º", hasElevator: "no", parkingDistance: "door", difficultAccess: true, accessNotes: " Escadas estreitas " },
        acessoDestino: { floor: "rés-do-chão", parkingDistance: "under_20m" },
        distanciaKm: 12.4,
        desmontagem: false,
        autorizaFotos: true,
        fotos: [
          { uri: "a", estado: "enviada", url: "https://x/a.jpg", tipo: "image/jpeg" },
          { uri: "v", estado: "enviada", url: "https://x/v.mp4", tipo: "video/mp4" },
        ],
      }),
      c,
      { emailDaSessao: "a@b.pt", rascunhosAntes: 0 },
    ).order;
    expect(mudanca.originAccess).toMatchObject({ difficultAccess: true, accessNotes: "Escadas estreitas" });
    expect(mudanca.destinationAccess).toMatchObject({ floor: "rés-do-chão", hasElevator: undefined });
    expect(mudanca).toMatchObject({ movingDistance: { distanceKm: 12.4 }, needsDismantling: "no", autorizaFotos: true });
    expect((mudanca.files as Array<{ type: string; mimeType: string }>).map((f) => [f.type, f.mimeType])).toEqual([
      ["image", "image/jpeg"],
      ["video", "video/mp4"],
    ]);
  });

  it("a quantidade exacta vai como `quantityExact` (o do site)", () => {
    const r = base({ servico: "recolha_moveis", movelModo: "carga", volume: "carrinha", quantidadeExacta: "12" });
    expect(corpoDoPedido(r, c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 }).order).toMatchObject({ volumeTier: "carrinha", quantityExact: "12" });
  });

  it("a referência: a R12 sem contactos nem moradas; uma linha sem o valor com IVA não serve; sem R12, a linha da R7", () => {
    const r = base({ servico: "mudanca", tipologia: "T2", morada: { formattedAddress: "Rua X, Lisboa" }, nome: "Ana", telefone: "912345678", distanciaKm: 30 });
    const corpo = JSON.stringify(corpoDaReferencia(r, c));
    for (const x of ["Rua X", "Ana", "912345678"]) expect(corpo).not.toContain(x);
    expect(corpoDaReferencia(r, c)).toMatchObject({ servico: "mudanca", tipologia: "T2", kmPercurso: 30 });
    expect(referenciaValida({ ok: true, linhas: [{ rotulo: "Total", texto: "40 € + IVA" }] })).toBeNull();
    expect(referenciaValida({ ok: true, linhas: [{ rotulo: "Total", texto: "40 € + IVA (49,20 € com IVA)" }], nota: "n" })).toEqual({
      linhas: [{ rotulo: "Total", texto: "40 € + IVA (49,20 € com IVA)" }],
      nota: "n",
    });
    expect(referenciaDoCatalogo({ servico: "recolha_moveis" }, c)?.linhas[0].texto).toBe("40 – 120 € + IVA (49,20 – 147,60 € com IVA)");
    expect(referenciaDoCatalogo({ servico: "mudanca" }, c)).toBeNull();
  });

  it("o resumo diz o que levar, o acesso e o dia, e cada linha volta ao seu passo", () => {
    const r = base({ servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 0, medio: 0, grande: 1 }, morada: { formattedAddress: "Rua X" }, acesso: { floor: "3º", hasElevator: "small", parkingDistance: "door" }, quando: "esta_semana" });
    const l = linhasDoResumo(r, c);
    expect(l.find((x) => x.rotulo === "Acesso")).toEqual({ rotulo: "Acesso", texto: "3.º andar, elevador pequeno, estacionamento à porta", passo: 2 });
    expect(l.find((x) => x.rotulo === "Quando")?.texto).toBe("Esta semana");
  });

  it("sem conta, «Enviar pedido» abre a folha G3 e não envia; o rascunho não se apaga ao entrar", () => {
    const e3 = ler("src/componentes/NovoPedido.tsx");
    expect(e3).toContain("else if (!ligado) setParaEntrar(true);");
    expect(e3).toContain('const ENTRE_PARA_ENVIAR = "Para enviar o pedido, entre na CLYON";');
    expect(e3).toContain("O que preencheu fica guardado neste telemóvel.");
    expect(e3).toContain("`Entrou como ${mascararEmail(email)}. Confira o pedido e toque em Enviar.`");
    // Entrar sem conta antes não passa por largarAConta (que apaga o rascunho).
    const s = ler("src/estado/Sessao.tsx");
    expect(s).toContain("if (antiga && emailAntigo !== s.email) await largarAConta(true);");
  });
});

describe("A10 — o pedido v3, com conta", () => {
  it("os separadores do site e o filtro `status` da R4", () => {
    expect(SEPARADORES.map((s) => s.nome)).toEqual(["Todos", "Em aberto", "Concluídos", "Cancelados"]);
    expect(rotaDaLista(2, "concluido")).toBe("/api/cliente/pedidos?pagina=2&status=concluido");
    expect(rotaDaLista(1, "todos")).toBe("/api/cliente/pedidos?pagina=1");
    expect(noSeparador({ estadoTexto: "Cancelado" }, "cancelado")).toBe(true);
    expect(noSeparador({ estadoTexto: "Tem propostas" }, "em_aberto")).toBe(true);
    expect(noSeparador({ estadoTexto: "Concluído" }, "em_aberto")).toBe(false);
  });

  it("«Propor outro valor»: o que ele escreve vai como `preco` (o que paga), e só números", () => {
    expect(corpoDePropor(482, 7, "85,50 €")).toEqual({ pedidoId: 482, negociacaoId: 7, accao: "propor", preco: "85,50" });
    expect(corpoDePropor(482, 7, "85.5")).toEqual({ pedidoId: 482, negociacaoId: 7, accao: "propor", preco: "85,5" });
    expect(corpoDePropor(482, 7, "muito")).toBeNull();
  });

  it("pagar com a escolha da fatura (a app deixa de mandar sempre `comFactura: true`)", () => {
    expect(corpoDoPagamento({ pedidoId: 1, negociacaoId: 2, metodo: "multibanco", comFactura: false, telemovel: "912" })).toEqual({
      pedidoId: 1,
      negociacaoId: 2,
      metodo: "multibanco",
      comFactura: false,
      telemovel: undefined,
    });
    expect(ler("src/componentes/Pagar.tsx")).not.toContain("comFactura: true,");
  });

  it("pedir troca de profissional abre o WhatsApp da CLYON com a frase da G8", () => {
    expect(ler("src/lib/pedidos.ts")).toContain("`Pedido #${id}: queria pedir a troca de profissional.`");
  });
});

describe("A9 — o pedido pelo link sem conta, preparado (regras da Segurança, D3)", () => {
  const agora = new Date("2026-10-29T12:00:00Z");

  it("a R10 v3 sem conta: convidado, temConta, muitosAparelhos (sem nenhum dado do pedido)", () => {
    const c = lerRespostaSemConta({ ok: true, estado: "convidado", id: 506, sessaoDoPedido: "chave", expiraEm: "2026-11-20T00:00:00.000Z", servico: "Esvaziamento", cidade: "Setúbal" }, agora);
    expect(c).toMatchObject({ estado: "convidado", sessao: { pedidoId: 506, sessao: "chave", expiraEm: "2026-11-20T00:00:00.000Z" } });
    expect(lerRespostaSemConta({ ok: true, estado: "temConta", emailMascarado: "a•••@x.pt" })).toEqual({ estado: "temConta", emailMascarado: "a•••@x.pt" });
    expect(lerRespostaSemConta({ ok: false, estado: "muitosAparelhos", id: 9 })).toEqual({ estado: "muitosAparelhos" });
    expect(lerRespostaSemConta({ ok: true, estado: "convidado", id: 0, sessaoDoPedido: "x" })).toEqual({ estado: "desconhecida" });
  });

  it("a sessão nunca dura mais do que o link (30 dias) e as expiradas saem", () => {
    const c = lerRespostaSemConta({ estado: "convidado", id: 1, sessaoDoPedido: "x", expiraEm: "2027-12-31T00:00:00.000Z" }, agora);
    expect(c.estado === "convidado" && c.sessao.expiraEm).toBe("2026-11-28T12:00:00.000Z");
    expect(sessoesValidas([{ pedidoId: 1, sessao: "x", expiraEm: "2026-10-28T00:00:00Z" }, { pedidoId: 2, sessao: "y", expiraEm: "2026-11-02T00:00:00Z" }], agora).map((s) => s.pedidoId)).toEqual([2]);
  });

  it("o código do aparelho do convidado é outro, numa chave do cofre própria — nunca o da entrada (S1)", () => {
    const conv = ler("src/lib/convidado.ts");
    const entrada = ler("src/lib/codigo-do-aparelho.ts");
    const chave = /const CODIGO = "([^"]+)"/.exec(conv)?.[1];
    expect(chave).toBe("clyon-cliente-convidado");
    expect(entrada).toContain('const CHAVE = "clyon-cliente-aparelho";');
    expect(conv).not.toContain('from "./codigo-do-aparelho"');
    expect(conv).toContain('export const CABECALHO_DO_APARELHO = "x-codigo-do-aparelho";');
    // Sair da conta não apaga os pedidos de convidado nem o código deles.
    expect(ler("src/estado/Sessao.tsx")).not.toContain("convidado");
  });

  it("a folha «Guarde este pedido na sua conta»: só na 2.ª abertura, e não volta antes de 7 dias", () => {
    expect(mostrarFolhaDeConta({ aberturas: 1 }, agora)).toBe(false);
    expect(mostrarFolhaDeConta({ aberturas: 2 }, agora)).toBe(true);
    expect(mostrarFolhaDeConta({ aberturas: 5, folhaEm: "2026-10-25T12:00:00Z" }, agora)).toBe(false);
    expect(mostrarFolhaDeConta({ aberturas: 5, folhaEm: "2026-10-22T12:00:00Z" }, agora)).toBe(true);
  });

  it("alterar: só a lista fechada, pormenores até 1000 caracteres, datas de amanhã a 180 dias", () => {
    const limites = { primeiroDia: "2026-10-30", ultimoDia: "2027-04-27" };
    expect(corpoDaAlteracao({ dataPreferida: "2026-10-29" }, limites)).toEqual({ erro: "Escolha um dia a partir de amanhã." });
    expect(corpoDaAlteracao({ dataPreferida: "2027-05-01" }, limites)).toEqual({ erro: "Escolha um dia a partir de amanhã." });
    expect(corpoDaAlteracao({ pormenores: "x".repeat(1001) }, limites)).toEqual({ erro: "Os pormenores vão até 1000 caracteres." });
    const ok = corpoDaAlteracao({ dataPreferida: "2026-11-02", pormenores: " Mais uma cómoda. ", acesso: { floor: "1º" } }, limites);
    expect(ok).toEqual({ corpo: { dataPreferida: "2026-11-02", pormenores: "Mais uma cómoda.", acesso: { floor: "1º" } } });
    // Os campos que nunca se alteram pela app nem existem na função.
    const f = ler("src/lib/pedidos.ts");
    const corpo = f.slice(f.indexOf("export function corpoDaAlteracao"), f.indexOf("/* ─── E5M"));
    for (const proibido of ["morada", "telefone", "email", "nif", "servico", "valorDesejado"]) expect(corpo).not.toMatch(new RegExp(`corpo\\.${proibido}`));
  });

  it("sem conta não se paga: o Pagar do convidado só mostra «Criar conta para pagar»", () => {
    const p = ler("src/componentes/Pagar.tsx");
    expect(p).toMatch(/pg\.disponivel && aoCriarConta \? \([\s\S]*?<Botao titulo="Criar conta para pagar" aoCarregar=\{aoCriarConta\} \/>/);
    expect(ler("src/componentes/VistaDoPedido.tsx")).toContain("aoCriarConta={convidado?.aoCriarConta}");
  });

  it("o 4.º telemóvel recebe uma mensagem simpática e o WhatsApp", () => {
    const e1b = ler("src/app/pedido-do-link.tsx");
    expect(e1b).toContain('if (r.estado === "muitosAparelhos") return setEstado({ passo: "muitos" });');
    expect(e1b).toContain("whatsappDaClyon(LINK.muitosWhatsapp)");
  });
});

describe("A6 — a 2.ª build: nada de novo nativo depois desta", () => {
  it("os vídeos abrem no navegador (como na Pro), sem leitor nativo", () => {
    const deps = Object.keys(JSON.parse(ler("package.json")).dependencies);
    expect(deps).not.toContain("expo-video");
    expect(deps).not.toContain("expo-av");
    expect(ler("src/componentes/VistaDoPedido.tsx")).toContain("abrirNoNavegador(v)");
  });

  it("as letras do site entram por EAS Update (pacotes só de JavaScript)", () => {
    for (const f of FONTES) expect(readFileSync(f, "utf8"), f).not.toMatch(/from "@expo-google-fonts\/[a-z-]+"/);
  });
});
