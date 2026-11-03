import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOTAO_DA_ETAPA,
  CHEGADA_CONFIRMADA_OBRIGATORIA,
  chegadaConfirmadaPelosDois,
  clientePodeConfirmarChegada,
  estadoDaViagemParaOCliente,
  estadoDaViagemParaOProfissional,
  etapasQueSePodemMarcar,
  ORDEM_DA_VIAGEM,
  podeMarcar,
  podeMostrarConcluir,
  proximaEtapa,
  VIAGEM_CONFIRMADA_DESDE,
  viagemComConfirmacao,
} from "./viagem-ate-ao-cliente";
import { ACCOES_SO_DO_CLIENTE, eAccaoSoDoCliente } from "./agir-como-cliente";
import { avisoAoCliente } from "./avisos-ao-cliente";

/**
 * «CHEGUEI» NAS DUAS APPS — ordem do CEO com o sim do dono, 30-10-2026
 * (parte C). A ordem dos estados, quem marca cada um, e o concluir escondido
 * até às duas confirmações.
 *
 * O INTERRUPTOR — d2, 03-11-2026 («Vamos remover isso por enquanto e deixar o
 * passo a passo mais simples»). `CHEGADA_CONFIRMADA_OBRIGATORIA` desliga a
 * chegada confirmada e a ordem obrigatória da viagem. As funções recebem o
 * interruptor como último argumento (por omissão, o valor publicado): aqui
 * prova-se a regra LIGADA e DESLIGADA, e os testes passam com qualquer dos
 * dois valores — voltar a ligá-la é mudar só esse valor.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const DEPOIS = new Date(VIAGEM_CONFIRMADA_DESDE.getTime() + 60_000).toISOString();
const ANTES = new Date(VIAGEM_CONFIRMADA_DESDE.getTime() - 60_000).toISOString();
const LIGADA = true;
const DESLIGADA = false;

function ficheiros(pasta: string): string[] {
  const fora = new Set(["node_modules", ".next", "dist", "build", ".expo"]);
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    if (fora.has(nome)) continue;
    const p = join(pasta, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheiros(p));
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(p);
  }
  return saida;
}

describe("o interruptor da chegada confirmada (d2, 03-11-2026)", () => {
  it("é um só, comentado, em viagem-ate-ao-cliente.ts — e nenhum outro ficheiro o define", () => {
    const fonte = ler("src/lib/viagem-ate-ao-cliente.ts");
    expect(fonte).toMatch(/export const CHEGADA_CONFIRMADA_OBRIGATORIA: boolean = (true|false);/);
    expect(fonte).toContain("Vamos remover isso por enquanto e deixar o");
    expect(typeof CHEGADA_CONFIRMADA_OBRIGATORIA).toBe("boolean");
    const definem = ["src", "app-pro/src", "app-cliente/src"]
      .flatMap((p) => ficheiros(join(RAIZ, p)))
      .filter((f) => /CHEGADA_CONFIRMADA_OBRIGATORIA\s*(:\s*boolean\s*)?=(?!=)/.test(readFileSync(f, "utf8")));
    expect(definem.map((f) => f.replace(/\\/g, "/").replace(RAIZ.replace(/\\/g, "/") + "/", ""))).toEqual([
      "src/lib/viagem-ate-ao-cliente.ts",
    ]);
  });

  it("por omissão, as funções seguem o valor publicado", () => {
    const viagem = { aCaminhoEm: DEPOIS, proximoEm: DEPOIS, chegouEm: DEPOIS };
    expect(viagemComConfirmacao(viagem, false)).toBe(viagemComConfirmacao(viagem, false, CHEGADA_CONFIRMADA_OBRIGATORIA));
    expect(podeMostrarConcluir(viagem, false)).toBe(podeMostrarConcluir(viagem, false, CHEGADA_CONFIRMADA_OBRIGATORIA));
    expect(clientePodeConfirmarChegada(viagem)).toBe(clientePodeConfirmarChegada(viagem, CHEGADA_CONFIRMADA_OBRIGATORIA));
    expect(podeMarcar({}, "chegou")).toBe(podeMarcar({}, "chegou", CHEGADA_CONFIRMADA_OBRIGATORIA));
    expect(estadoDaViagemParaOProfissional(viagem)).toBe(estadoDaViagemParaOProfissional(viagem, CHEGADA_CONFIRMADA_OBRIGATORIA));
  });
});

describe("a ordem dos estados: a caminho → próximo → cheguei", () => {
  it("o botão grande oferece o passo a seguir ao último marcado", () => {
    expect(ORDEM_DA_VIAGEM).toEqual(["a_caminho", "proximo", "chegou"]);
    expect(proximaEtapa({})).toBe("a_caminho");
    expect(proximaEtapa({ aCaminhoEm: DEPOIS })).toBe("proximo");
    expect(proximaEtapa({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS })).toBe("chegou");
    expect(proximaEtapa({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS, chegouEm: DEPOIS })).toBeNull();
    // Sem a ordem obrigatória: depois de «Cheguei» já não há botão; depois de «Estou próximo», «Cheguei».
    expect(proximaEtapa({ chegouEm: DEPOIS })).toBeNull();
    expect(proximaEtapa({ proximoEm: DEPOIS })).toBe("chegou");
    expect([BOTAO_DA_ETAPA.a_caminho, BOTAO_DA_ETAPA.proximo, BOTAO_DA_ETAPA.chegou]).toEqual(["Estou a caminho", "Estou próximo", "Cheguei"]);
  });

  it("LIGADA: não se salta nenhum nem se repete", () => {
    expect(podeMarcar({}, "proximo", LIGADA)).toBe(false);
    expect(podeMarcar({}, "chegou", LIGADA)).toBe(false);
    expect(podeMarcar({ aCaminhoEm: DEPOIS }, "chegou", LIGADA)).toBe(false);
    expect(podeMarcar({ aCaminhoEm: DEPOIS }, "a_caminho", LIGADA)).toBe(false);
    expect(podeMarcar({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS }, "proximo", LIGADA)).toBe(false);
    expect(podeMarcar({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS }, "chegou", LIGADA)).toBe(true);
    expect(etapasQueSePodemMarcar({}, LIGADA)).toEqual(["a_caminho"]);
  });

  it("DESLIGADA: «Cheguei» sem «Estou próximo», «Estou próximo» sem «Estou a caminho» — nunca para trás nem repetido", () => {
    expect(podeMarcar({}, "chegou", DESLIGADA)).toBe(true);
    expect(podeMarcar({}, "proximo", DESLIGADA)).toBe(true);
    expect(podeMarcar({ aCaminhoEm: DEPOIS }, "chegou", DESLIGADA)).toBe(true);
    expect(podeMarcar({ proximoEm: DEPOIS }, "chegou", DESLIGADA)).toBe(true);
    // Para trás e repetido, não.
    expect(podeMarcar({ aCaminhoEm: DEPOIS }, "a_caminho", DESLIGADA)).toBe(false);
    expect(podeMarcar({ proximoEm: DEPOIS }, "a_caminho", DESLIGADA)).toBe(false);
    expect(podeMarcar({ chegouEm: DEPOIS }, "a_caminho", DESLIGADA)).toBe(false);
    expect(podeMarcar({ chegouEm: DEPOIS }, "proximo", DESLIGADA)).toBe(false);
    expect(podeMarcar({ chegouEm: DEPOIS }, "chegou", DESLIGADA)).toBe(false);
    expect(etapasQueSePodemMarcar({}, DESLIGADA)).toEqual(["a_caminho", "proximo", "chegou"]);
    expect(etapasQueSePodemMarcar({ aCaminhoEm: DEPOIS }, DESLIGADA)).toEqual(["proximo", "chegou"]);
    expect(etapasQueSePodemMarcar({ chegouEm: DEPOIS }, DESLIGADA)).toEqual([]);
  });

  it("a base grava pela mesma regra, ligada ou desligada (o UPDATE repete a condição)", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain('import { CHEGADA_CONFIRMADA_OBRIGATORIA } from "@/lib/viagem-ate-ao-cliente";');
    const f = db.slice(db.indexOf("export async function registarEtapaNoTerreno"), db.indexOf("export async function confirmarChegadaPeloCliente"));
    const i = f.indexOf("const sql = !CHEGADA_CONFIRMADA_OBRIGATORIA");
    expect(i).toBeGreaterThan(-1);
    const j = f.indexOf(': etapa === "a_caminho"', i);
    expect(j).toBeGreaterThan(i);
    const desligada = f.slice(i, j);
    const ligada = f.slice(j);
    // Desligada: cada passo só se nem ele nem os seguintes estão marcados.
    expect(desligada).toMatch(/SET aCaminhoEm = NOW\(\)[\s\S]*?AND aCaminhoEm IS NULL\s+AND proximoEm IS NULL AND chegouEm IS NULL`/);
    expect(desligada).toMatch(/SET proximoEm = NOW\(\)[\s\S]*?AND execucaoEnviadaEm IS NULL\s+AND proximoEm IS NULL AND chegouEm IS NULL`/);
    expect(desligada).toMatch(/SET chegouEm = NOW\(\)[\s\S]*?AND execucaoEnviadaEm IS NULL AND chegouEm IS NULL`/);
    expect(desligada).not.toContain("IS NOT NULL");
    // Ligada: a regra de 30-10-2026, tal e qual.
    expect(ligada).toMatch(/SET proximoEm = NOW\(\)[\s\S]*?AND aCaminhoEm IS NOT NULL[\s\S]*?AND proximoEm IS NULL AND chegouEm IS NULL/);
    expect(ligada).toMatch(/SET chegouEm = NOW\(\)[\s\S]*?AND proximoEm IS NOT NULL AND chegouEm IS NULL/);
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
  it("aceita as três etapas; uma já ultrapassada responde sem avisar; a fora da ordem recusa-se só com a regra ligada", () => {
    expect(rota).toContain(`corpo.etapa === "a_caminho" || corpo.etapa === "proximo" || corpo.etapa === "chegou"`);
    expect(rota).toContain(`(etapa === "a_caminho" && (n.aCaminhoEm != null || n.proximoEm != null || n.chegouEm != null))`);
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
    expect(clientePodeConfirmarChegada({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS }, LIGADA)).toBe(false);
    expect(clientePodeConfirmarChegada({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS, chegouEm: DEPOIS }, LIGADA)).toBe(true);
    expect(clientePodeConfirmarChegada({ chegouEm: DEPOIS, chegadaConfirmadaEm: DEPOIS }, LIGADA)).toBe(false);
  });
  it("DESLIGADA: não se pede ao cliente (sem o «Confirmo que chegou»)", () => {
    expect(clientePodeConfirmarChegada({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS, chegouEm: DEPOIS }, DESLIGADA)).toBe(false);
    expect(clientePodeConfirmarChegada({ chegouEm: DEPOIS }, DESLIGADA)).toBe(false);
  });
  it("a acção sai para a app e para /conta só no momento certo, e fica no histórico", () => {
    const app = ler("src/lib/pedido-para-a-app.ts");
    expect(app).toContain(`...(n.fase === "a_executar" && clientePodeConfirmarChegada(n) ? ["confirmar_chegada"] : []),`);
    const agir = ler("src/lib/agir-como-cliente.ts");
    // Desde a d3 (31-10-2026) as portas gravam todas por confirmar-a-chegada.ts.
    expect(agir).toContain(`const gravou = await confirmarAChegada({ ...quem, onde: NA_PORTA[a.porta], autorTipo: "cliente", autorNome: a.autorNome });`);
    expect(ler("src/lib/confirmar-a-chegada.ts")).toContain("Cliente confirmou a chegada (negociação");
    expect(ler("app-cliente/src/componentes/Acompanhar.tsx")).toContain(`const podeConfirmarChegada = n.accoes.includes("confirmar_chegada");`);
    const pagina = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(pagina).toContain(`acordada.accoes.includes("confirmar_chegada")`);
    // Sem o botão, o cliente continua a ler «O parceiro diz que chegou» (viagemTexto).
    expect(pagina).toContain(`{!acordada.accoes.includes("confirmar_chegada") && acordada.viagemTexto && (`);
  });
  it("o aviso no telemóvel do «Cheguei» só pede a confirmação com a regra ligada", () => {
    const corpo = avisoAoCliente("chegou", { pedidoId: 9, nome: "Ana" }).body;
    expect(corpo).toBe(
      CHEGADA_CONFIRMADA_OBRIGATORIA
        ? "Ao local do trabalho do pedido #9. Confirme no pedido que chegou."
        : "Ao local do trabalho do pedido #9.",
    );
    expect(ler("src/lib/avisos-ao-cliente.ts")).toContain("body: CHEGADA_CONFIRMADA_OBRIGATORIA");
  });
});

describe("o «Está feito»: ligada, só depois das duas confirmações; desligada, sempre (d2)", () => {
  const so = { aCaminhoEm: DEPOIS, proximoEm: DEPOIS, chegouEm: DEPOIS };

  it("LIGADA: a regra de 30-10-2026", () => {
    expect(podeMostrarConcluir({ aCaminhoEm: DEPOIS }, false, LIGADA)).toBe(false);
    expect(podeMostrarConcluir(so, false, LIGADA)).toBe(false);
    expect(podeMostrarConcluir({ ...so, chegadaConfirmadaEm: DEPOIS }, false, LIGADA)).toBe(true);
    expect(chegadaConfirmadaPelosDois({ ...so, chegadaConfirmadaEm: DEPOIS })).toBe(true);
    // Trabalho CLYON e viagens de antes da regra: como antes.
    expect(podeMostrarConcluir(so, true, LIGADA)).toBe(true);
    expect(viagemComConfirmacao({ aCaminhoEm: ANTES }, false, LIGADA)).toBe(false);
    expect(viagemComConfirmacao({ aCaminhoEm: DEPOIS }, false, LIGADA)).toBe(true);
    expect(podeMostrarConcluir({ aCaminhoEm: ANTES, chegouEm: ANTES }, false, LIGADA)).toBe(true);
  });

  it("DESLIGADA: aparece sem viagem, sem «Cheguei» e sem a confirmação", () => {
    expect(viagemComConfirmacao({ aCaminhoEm: DEPOIS }, false, DESLIGADA)).toBe(false);
    expect(podeMostrarConcluir({}, false, DESLIGADA)).toBe(true);
    expect(podeMostrarConcluir({ aCaminhoEm: DEPOIS }, false, DESLIGADA)).toBe(true);
    expect(podeMostrarConcluir({ aCaminhoEm: DEPOIS, proximoEm: DEPOIS }, false, DESLIGADA)).toBe(true);
    expect(podeMostrarConcluir(so, false, DESLIGADA)).toBe(true);
    expect(podeMostrarConcluir(so, true, DESLIGADA)).toBe(true);
  });

  it("o site usa a mesma regra, com as horas primeiro e nenhum ajuste à espera", () => {
    const rota = ler("src/app/api/profissionais/trabalho/route.ts");
    expect(rota).toContain("if (!podeMostrarConcluir(trabalho, trabalhoClyon)) {");
    expect(rota).toContain("if (!podeDarPorFeitoComAsHoras(porHora, trabalho)) {");
    expect(rota).toContain("if (ajustePendente(ajustesDe(trabalho.ajustesJson), new Date())) {");
    // As horas e o painel no navegador também (chegadaOk = podeMostrarConcluir).
    expect(ler("src/lib/horas-no-servidor.ts")).toContain("const chegadaOk = podeMostrarConcluir(linha, trabalhoClyon);");
    expect(ler("src/app/api/profissionais/meus-pedidos/route.ts")).toContain("chegadaOk: podeMostrarConcluir(l, trabalhoClyon),");
  });

  it("a app Pro pergunta o mesmo (`podeMostrarConcluir`) antes de mostrar o «Está feito»", () => {
    /*
     * A Engenharia — Apps muda a app a seguir (d2): o `if (!t.aCaminhoEm)
     * return false;` de `concluirVisivel` sai lá. Aqui só se exige o que fica
     * nas duas formas.
     */
    const pro = ler("app-pro/src/componentes/TrabalhoContratado.tsx");
    expect(pro).toMatch(/export function concluirVisivel\([\s\S]*?podeMostrarConcluir\(t, clyon\)/);
    expect(pro).toContain("<EstaFeito t={t} aoMarcar={setObrigado} />");
    expect(pro).toContain("<BotaoDaViagem");
  });

  it("ao profissional: com a regra desligada, ninguém fica «à espera que o cliente confirme»", () => {
    expect(estadoDaViagemParaOProfissional(so, LIGADA)).toBe("À espera que o cliente confirme que chegou.");
    expect(estadoDaViagemParaOProfissional(so, DESLIGADA)).toBeNull();
    const confirmada = { ...so, chegadaConfirmadaEm: DEPOIS };
    expect(estadoDaViagemParaOProfissional(confirmada, DESLIGADA)).toBe(estadoDaViagemParaOProfissional(confirmada, LIGADA));
  });

  it("ao cliente diz-se «parceiro» — e «O parceiro diz que chegou» fica, como informação", () => {
    const s = { aCaminhoEm: DEPOIS };
    expect(estadoDaViagemParaOCliente(s)).toBe("O parceiro está a caminho.");
    expect(estadoDaViagemParaOCliente({ ...s, proximoEm: DEPOIS })).toBe("O parceiro está próximo.");
    expect(estadoDaViagemParaOCliente({ ...s, proximoEm: DEPOIS, chegouEm: DEPOIS })).toBe("O parceiro diz que chegou.");
    expect(estadoDaViagemParaOCliente({ chegouEm: DEPOIS })).toBe("O parceiro diz que chegou.");
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
  it("o botão no cartão do trabalho, só com o «Cheguei» por confirmar — e some com a regra desligada", () => {
    const mesa = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(mesa).toContain("acordada.chegouEm && viagemComConfirmacao(acordada, false) && clientePodeConfirmarChegada(acordada) && (");
    expect(mesa).toContain("<ConfirmarChegadaNaMesa");
    const porConfirmar = { aCaminhoEm: DEPOIS, proximoEm: DEPOIS, chegouEm: DEPOIS };
    expect(viagemComConfirmacao(porConfirmar, false, LIGADA) && clientePodeConfirmarChegada(porConfirmar, LIGADA)).toBe(true);
    expect(viagemComConfirmacao(porConfirmar, false, DESLIGADA) || clientePodeConfirmarChegada(porConfirmar, DESLIGADA)).toBe(false);
    const botao = ler("src/components/admin/ConfirmarChegadaNaMesa.tsx");
    expect(botao).toContain('"Confirmar a chegada (o cliente confirmou por telefone)"');
    expect(botao).toContain('accao: "confirmar_chegada"');
    const db = ler("src/lib/db.ts");
    const f = db.slice(db.indexOf("export async function pedidosComNegociacoes"));
    expect(f.slice(0, f.indexOf("p.regimeIva\n       FROM negociacoes n"))).toContain("n.aCaminhoEm, n.chegouEm, n.chegadaConfirmadaEm,");
  });
  it("a app Pro: se ainda diz o que fazer enquanto o cliente não confirma, só atrás da regra", () => {
    // A Apps pode tirar este bloco (d2); se ficar, tem de continuar atrás de `viagemComConfirmacao`.
    const pro = ler("app-pro/src/componentes/TrabalhoContratado.tsx");
    if (pro.includes("{COMO_O_CLIENTE_CONFIRMA}")) {
      expect(pro).toContain("{!clyon && viagemComConfirmacao(t, false) && clientePodeConfirmarChegada(t) ? (");
      expect(pro).toContain("abrir(linkDeWhatsApp(TELEFONE_DA_CLYON, mensagemDaChegadaPorConfirmar(t.pedidoId)))");
    }
  });
});
