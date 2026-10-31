import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOTAO_DA_ETAPA,
  chegadaConfirmadaPelosDois,
  clientePodeConfirmarChegada,
  estadoDaViagemParaOCliente,
  ORDEM_DA_VIAGEM,
  podeMarcar,
  podeMostrarConcluir,
  proximaEtapa,
  VIAGEM_CONFIRMADA_DESDE,
  viagemComConfirmacao,
} from "./viagem-ate-ao-cliente";
import { ACCOES_SO_DO_CLIENTE, eAccaoSoDoCliente } from "./agir-como-cliente";

/**
 * «CHEGUEI» NAS DUAS APPS — ordem do CEO com o sim do dono, 30-10-2026
 * (parte C). A ordem dos estados, quem marca cada um, e o concluir escondido
 * até às duas confirmações.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const DEPOIS = new Date(VIAGEM_CONFIRMADA_DESDE.getTime() + 60_000).toISOString();
const ANTES = new Date(VIAGEM_CONFIRMADA_DESDE.getTime() - 60_000).toISOString();

describe("a ordem dos estados: a caminho → próximo → cheguei", () => {
  it("o botão grande oferece sempre só o passo seguinte", () => {
    expect(ORDEM_DA_VIAGEM).toEqual(["a_caminho", "proximo", "chegou"]);
    expect(proximaEtapa({})).toBe("a_caminho");
    expect(proximaEtapa({ aCaminhoEm: DEPOIS })).toBe("proximo");
    expect(proximaEtapa({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS })).toBe("chegou");
    expect(proximaEtapa({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS, chegouEm: DEPOIS })).toBeNull();
    expect([BOTAO_DA_ETAPA.a_caminho, BOTAO_DA_ETAPA.proximo, BOTAO_DA_ETAPA.chegou]).toEqual(["Estou a caminho", "Estou próximo", "Cheguei"]);
  });

  it("não se salta nenhum nem se repete", () => {
    expect(podeMarcar({}, "proximo")).toBe(false);
    expect(podeMarcar({}, "chegou")).toBe(false);
    expect(podeMarcar({ aCaminhoEm: DEPOIS }, "chegou")).toBe(false);
    expect(podeMarcar({ aCaminhoEm: DEPOIS }, "a_caminho")).toBe(false);
    expect(podeMarcar({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS }, "proximo")).toBe(false);
    expect(podeMarcar({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS }, "chegou")).toBe(true);
  });

  it("a base grava pela mesma ordem (o UPDATE repete a condição)", () => {
    const db = ler("src/lib/db.ts");
    const f = db.slice(db.indexOf("export async function registarEtapaNoTerreno"), db.indexOf("export async function confirmarChegadaPeloCliente"));
    expect(f).toMatch(/SET proximoEm = NOW\(\)[\s\S]*?AND aCaminhoEm IS NOT NULL[\s\S]*?AND proximoEm IS NULL AND chegouEm IS NULL/);
    expect(f).toMatch(/SET chegouEm = NOW\(\)[\s\S]*?AND proximoEm IS NOT NULL AND chegouEm IS NULL/);
    expect(f).not.toContain("COALESCE(aCaminhoEm");
    expect(db).toContain("ALTER TABLE negociacoes ADD COLUMN proximoEm DATETIME NULL DEFAULT NULL");
    expect(db).toContain("ALTER TABLE negociacoes ADD COLUMN chegadaConfirmadaEm DATETIME NULL DEFAULT NULL");
    // 13 foi a do «Cheguei»; as horas do trabalho (31-10-2026) subiram-na.
    expect(Number(/const VERSAO_DAS_NEGOCIACOES = (\d+);/.exec(db)?.[1])).toBeGreaterThanOrEqual(13);
  });
});

describe("só o profissional do pedido marca a viagem", () => {
  const rota = ler("src/app/api/profissionais/trabalho/etapa/route.ts");
  it("a rota pede a sessão do profissional e o trabalho tem de ser dele", () => {
    expect(rota).toContain("const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));");
    expect(rota).toContain("if (!n || Number(n.providerId) !== sessao.providerId)");
    expect(rota).toContain("registarEtapaNoTerreno(negociacaoId, sessao.providerId, etapa)");
  });
  it("aceita as três etapas e recusa a que vem fora da ordem", () => {
    expect(rota).toContain(`corpo.etapa === "a_caminho" || corpo.etapa === "proximo" || corpo.etapa === "chegou"`);
    expect(rota).toContain("if (!podeMarcar(n, etapa)) return NextResponse.json({ error: FORA_DA_ORDEM[etapa] }, { status: 409 });");
  });
});

describe("só o cliente confirma que ele chegou", () => {
  it("é uma acção só do cliente: o link do profissional recusa-a", () => {
    expect(ACCOES_SO_DO_CLIENTE).toContain("confirmar_chegada");
    expect(eAccaoSoDoCliente("confirmar_chegada")).toBe(true);
  });
  it("grava-se só no pedido dele, depois do «Cheguei», uma vez", () => {
    const db = ler("src/lib/db.ts");
    const f = db.slice(db.indexOf("export async function confirmarChegadaPeloCliente"), db.indexOf("/** Uma negociação com o que o terreno e o ajuste precisam"));
    expect(f).toContain("WHERE id = ? AND pedidoId = ? AND estado = 'acordada'");
    expect(f).toContain("AND execucaoEnviadaEm IS NULL AND chegouEm IS NOT NULL");
    expect(f).toContain("AND chegadaConfirmadaEm IS NULL");
    expect(clientePodeConfirmarChegada({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS })).toBe(false);
    expect(clientePodeConfirmarChegada({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS, chegouEm: DEPOIS })).toBe(true);
    expect(clientePodeConfirmarChegada({ chegouEm: DEPOIS, chegadaConfirmadaEm: DEPOIS })).toBe(false);
  });
  it("a acção sai para a app e para /conta só no momento certo, e fica no histórico", () => {
    const app = ler("src/lib/pedido-para-a-app.ts");
    expect(app).toContain(`...(n.fase === "a_executar" && clientePodeConfirmarChegada(n) ? ["confirmar_chegada"] : []),`);
    const agir = ler("src/lib/agir-como-cliente.ts");
    // Desde a d3 (31-10-2026) as portas gravam todas por confirmar-a-chegada.ts.
    expect(agir).toContain(`const gravou = await confirmarAChegada({ ...quem, onde: NA_PORTA[a.porta], autorTipo: "cliente", autorNome: a.autorNome });`);
    expect(ler("src/lib/confirmar-a-chegada.ts")).toContain("Cliente confirmou a chegada (negociação");
    expect(ler("app-cliente/src/componentes/Acompanhar.tsx")).toContain(`const podeConfirmarChegada = n.accoes.includes("confirmar_chegada");`);
    expect(ler("src/app/pedido/[token]/PropostasRecebidas.tsx")).toContain(`acordada.accoes.includes("confirmar_chegada")`);
  });
});

describe("o concluir fica escondido até às duas confirmações", () => {
  it("a regra", () => {
    const so = { aCaminhoEm: DEPOIS, proximoEm: DEPOIS, chegouEm: DEPOIS };
    expect(podeMostrarConcluir({ aCaminhoEm: DEPOIS }, false)).toBe(false);
    expect(podeMostrarConcluir(so, false)).toBe(false);
    expect(podeMostrarConcluir({ ...so, chegadaConfirmadaEm: DEPOIS }, false)).toBe(true);
    expect(chegadaConfirmadaPelosDois({ ...so, chegadaConfirmadaEm: DEPOIS })).toBe(true);
    // Trabalho CLYON e viagens de antes da regra: como antes.
    expect(podeMostrarConcluir(so, true)).toBe(true);
    expect(viagemComConfirmacao({ aCaminhoEm: ANTES }, false)).toBe(false);
    expect(podeMostrarConcluir({ aCaminhoEm: ANTES, chegouEm: ANTES }, false)).toBe(true);
  });

  it("o site recusa o «está feito» sem as duas, e a app Pro não o mostra", () => {
    const rota = ler("src/app/api/profissionais/trabalho/route.ts");
    expect(rota).toContain("if (!podeMostrarConcluir(trabalho, trabalhoClyon)) {");
    const pro = ler("app-pro/src/componentes/TrabalhoContratado.tsx");
    expect(pro).toContain(") : concluirVisivel(t) ? (\n        <EstaFeito t={t} aoMarcar={setObrigado} />");
    expect(pro).toContain("if (!t.aCaminhoEm) return false;");
    expect(pro).toContain("<BotaoDaViagem etapa={seguinte}");
  });

  it("ao cliente diz-se «parceiro»", () => {
    const s = { aCaminhoEm: DEPOIS };
    expect(estadoDaViagemParaOCliente(s)).toBe("O parceiro está a caminho.");
    expect(estadoDaViagemParaOCliente({ ...s, proximoEm: DEPOIS })).toBe("O parceiro está próximo.");
    expect(estadoDaViagemParaOCliente({ ...s, proximoEm: DEPOIS, chegouEm: DEPOIS })).toBe("O parceiro diz que chegou.");
    expect(estadoDaViagemParaOCliente({})).toBeNull();
  });
});

describe("a chegada confirmada ao telefone, pelo backoffice (d3, 31-10-2026)", () => {
  const rota = ler("src/app/api/admin/negociacoes/agir/route.ts");
  it("a rota agir conhece confirmar_chegada, pede administrador e grava pela porta comum, com o nome de quem o fez", () => {
    expect(rota).toMatch(/const ACCOES = \[[^\]]*"confirmar_chegada"[^\]]*\] as const;/);
    expect(rota).toContain("const { err, colab } = await requireAdmin(req);");
    const i = rota.indexOf('if (accao === "confirmar_chegada") {');
    expect(i).toBeGreaterThan(-1);
    const bloco = rota.slice(i, rota.indexOf("CONFIRMAR — e o único portao"));
    expect(bloco).toContain("if (linha.ofertaClyon) {");
    expect(bloco).toContain("const gravou = await confirmarAChegada({");
    expect(bloco).toContain("onde: `por telefone, registado no backoffice por ${colab?.nome ?? \"a CLYON\"}`,");
    expect(bloco).toContain('autorTipo: "clyon",');
    expect(bloco).toContain("after(() => avisarProfissionalDaChegadaConfirmada(quem));");
    // A negociação tem de ser deste pedido: procura-se antes, como nas outras acções.
    expect(rota.indexOf("const linha = todas.find((n) => Number(n.id) === negociacaoId);")).toBeLessThan(i);
  });
  it("o botão no cartão do trabalho, só com o «Cheguei» por confirmar", () => {
    const mesa = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(mesa).toContain("acordada.chegouEm && viagemComConfirmacao(acordada, false) && clientePodeConfirmarChegada(acordada) && (");
    expect(mesa).toContain("<ConfirmarChegadaNaMesa");
    const botao = ler("src/components/admin/ConfirmarChegadaNaMesa.tsx");
    expect(botao).toContain('"Confirmar a chegada (o cliente confirmou por telefone)"');
    expect(botao).toContain('accao: "confirmar_chegada"');
    const db = ler("src/lib/db.ts");
    const f = db.slice(db.indexOf("export async function pedidosComNegociacoes"));
    expect(f.slice(0, f.indexOf("p.regimeIva\n       FROM negociacoes n"))).toContain("n.aCaminhoEm, n.chegouEm, n.chegadaConfirmadaEm,");
  });
  it("a app Pro diz o que fazer enquanto o cliente não confirma, com o WhatsApp da CLYON", () => {
    const pro = ler("app-pro/src/componentes/TrabalhoContratado.tsx");
    expect(pro).toContain("{!clyon && viagemComConfirmacao(t, false) && clientePodeConfirmarChegada(t) ? (");
    expect(pro).toContain("abrir(linkDeWhatsApp(TELEFONE_DA_CLYON, mensagemDaChegadaPorConfirmar(t.pedidoId)))");
  });
});
