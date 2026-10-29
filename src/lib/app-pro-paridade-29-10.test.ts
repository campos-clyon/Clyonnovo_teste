import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  caminhoDoLink,
  caminhoDoPainel,
  ECRA_DO_PAINEL_NA_APP,
  precisaDeSessao,
} from "../../app-pro/src/lib/destino";
import {
  esquecerDestino,
  guardarDestino,
  tirarDestino,
  VALIDADE_DO_DESTINO_MS,
} from "../../app-pro/src/lib/destino-pendente";
import {
  caminhoDoMapa,
  chaveDoGrupo,
  clienteDesde,
  fasesDe,
  GRUPOS,
  haQuantoTempoNoCartao,
  juntarNovidades,
  linhasDaLista,
  maisRecentePrimeiro,
  naOrdemDaRota,
  novidadesEntre,
  RECUSA,
  SEM_DESCRICAO,
  SEPARADORES,
  tempoDoCartao,
  type Trabalho,
} from "../../app-pro/src/lib/trabalhos";
import {
  corDoServicoNaApp,
  ESTADO_DO_FEITO,
  eventosDaAgenda,
  largarEm,
  proximoTrabalho,
  quandoParaGravar,
  semDiaNaAgenda,
} from "../../app-pro/src/lib/agenda";
import { legendaDosConfirmados } from "./fim-do-trabalho";

/**
 * A PARIDADE PAINEL × APP PRO — 29-10-2026, ordem do CEO aprovada pelo dono:
 * «tudo o que o painel do profissional faz num pedido tem de existir também
 * na app». A12, A13, A14, A15 e A16 da especificação v3 (matriz B2).
 *
 * Onde o painel guarda a regra dentro de um componente (e a app não o pode
 * importar), o teste lê as duas fontes e compara-as: mudar uma sem a outra
 * chumba aqui.
 */

const cru = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem comentários, com a regra ancorada ao início da linha. */
const ler = (p: string) =>
  cru(p)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");
/** Os espaços e as quebras de linha do JSX contam como um espaço. */
const corrido = (s: string) => s.replace(/\s+/g, " ");

const PAINEL = cru("src/app/profissionais/painel/PainelDoProfissional.tsx");
const LISTA_DO_PAINEL = cru("src/app/profissionais/painel/Trabalhos.tsx");
const AGENDA_DO_PAINEL = cru("src/app/profissionais/painel/Agenda.tsx");

const T = (o: Partial<Trabalho>): Trabalho =>
  ({
    negociacaoId: 1,
    pedidoId: 100,
    estado: "aberta",
    fase: "a_negociar",
    propostas: null,
    valorAcordado: null,
    querPagar: null,
    recebeSeAceitar: null,
    recebeSeFechado: null,
    valorDaClyon: null,
    sugestao: null,
    taxas: { cliente: 0, profissional: 0.11 },
    formaDePagamento: "na_plataforma",
    ofertaClyon: null,
    valorFixo: null,
    concorrentes: 0,
    pedidoCancelado: false,
    serviceType: "recolha_moveis",
    city: "Lisboa",
    description: null,
    filesJson: null,
    urgency: null,
    dataAgendada: null,
    dataCombinada: null,
    criadoEm: null,
    criadaEm: null,
    arquivadoEm: null,
    confirmadoEm: null,
    pagoEm: null,
    abertoEm: null,
    execucaoEnviadaEm: null,
    actualizadoEm: "2026-10-29T10:00:00.000Z",
    duracaoMinutos: null,
    morada: null,
    contactoNome: null,
    ...o,
  }) as Trabalho;

// ── A12 — os links ──────────────────────────────────────────────────────────

describe("A12 — os links do painel abrem o sítio certo na app", () => {
  it("`?ecra=` e `&trabalho=` abrem a secção e o trabalho", () => {
    expect(caminhoDoLink("https://clyon.pt/profissionais/painel?ecra=trabalhos&trabalho=42")).toBe("/trabalho/42");
    expect(caminhoDoLink("https://clyon.pt/profissionais/painel?ecra=carteira")).toBe("/carteira");
    expect(caminhoDoLink("https://clyon.pt/profissionais/painel?ecra=seguranca")).toBe("/conta/palavra-passe");
    expect(caminhoDoLink("https://clyon.pt/profissionais/painel?ecra=agenda")).toBe("/agenda");
    // O botão do email do trabalho contratado (`email-trabalho.ts`).
    expect(caminhoDoLink("https://clyon.pt/profissionais/painel?ecra=trabalhos")).toBe("/");
    expect(caminhoDoLink("https://clyon.pt/profissionais/painel")).toBe("/");
    // Uma secção que a app não conheça, ou um trabalho que não é número: a lista.
    expect(caminhoDoLink("https://clyon.pt/profissionais/painel?ecra=inventada")).toBe("/");
    expect(caminhoDoPainel(new URLSearchParams("trabalho=abc"))).toBe("/");
    // O que já abria continua a abrir.
    expect(caminhoDoLink("https://clyon.pt/profissionais/pedidos/abc123")).toBe("/abrir/abc123");
    expect(caminhoDoLink("https://clyon.pt/profissionais/definir-senha/xyz")).toBe("/definir-senha/xyz");
  });

  it("todas as secções do painel têm o seu ecrã na app, e o ecrã existe", () => {
    const bloco = /const ECRAS_VALIDOS: Ecra\[\] = \[([\s\S]*?)\];/.exec(PAINEL)?.[1] ?? "";
    const doPainel = [...bloco.matchAll(/"([\w-]+)"/g)].map((m) => m[1]).sort();
    expect(doPainel.length).toBeGreaterThan(10);
    expect(Object.keys(ECRA_DO_PAINEL_NA_APP).sort()).toEqual(doPainel);
    const ficheiro: Record<string, string> = {
      "/": "app-pro/src/app/(app)/index.tsx",
      "/conta": "app-pro/src/app/(app)/conta.tsx",
      "/agenda": "app-pro/src/app/(app)/agenda.tsx",
      "/carteira": "app-pro/src/app/(app)/carteira.tsx",
    };
    for (const caminho of Object.values(ECRA_DO_PAINEL_NA_APP)) {
      const f = ficheiro[caminho] ?? `app-pro/src/app${caminho}.tsx`;
      expect(existsSync(join(process.cwd(), f)), f).toBe(true);
    }
  });

  it("só o que precisa de sessão fica à espera de entrar", () => {
    expect(precisaDeSessao("/abrir/abc")).toBe(true);
    expect(precisaDeSessao("/trabalho/42")).toBe(true);
    expect(precisaDeSessao("/carteira")).toBe(true);
    expect(precisaDeSessao("/definir-senha/xyz")).toBe(false);
    expect(precisaDeSessao("/")).toBe(false);
  });

  afterEach(() => esquecerDestino());

  it("o destino guardado sai uma vez, e passados 30 minutos já não sai", () => {
    guardarDestino("/abrir/abc", 1_000);
    expect(tirarDestino(2_000)).toBe("/abrir/abc");
    expect(tirarDestino(2_000)).toBeNull();
    guardarDestino("/abrir/abc", 1_000);
    expect(tirarDestino(1_000 + VALIDADE_DO_DESTINO_MS + 1)).toBeNull();
    guardarDestino("/abrir/abc", 1_000);
    esquecerDestino();
    expect(tirarDestino(1_001)).toBeNull();
  });

  it("o link sem sessão guarda-se, abre-se a seguir a entrar, e sair esquece-o", () => {
    const intent = ler("app-pro/src/app/+native-intent.tsx");
    expect(intent).toContain("if (precisaDeSessao(caminho) && !(await lerToken())) guardarDestino(caminho);");
    expect(intent).toContain("return caminho;");
    const raiz = ler("app-pro/src/app/_layout.tsx");
    expect(raiz).toContain("useAbrirOLinkDepoisDeEntrar(carregando, ligado);");
    expect(raiz).toContain("const entrouAgora = antes.current === false && ligado;");
    expect(raiz).toContain("const caminho = tirarDestino();");
    const sessao = ler("app-pro/src/estado/Sessao.tsx");
    expect(sessao).toMatch(/const sair = useCallback\(async \(\) => \{\s*esquecerDestino\(\);/);
  });
});

// ── A13 — o detalhe ─────────────────────────────────────────────────────────

describe("A13 — o detalhe do pedido, como no painel", () => {
  it("sem descrição, o aviso do painel, palavra por palavra", () => {
    expect(corrido(LISTA_DO_PAINEL)).toContain(SEM_DESCRICAO);
    const detalhe = ler("app-pro/src/app/trabalho/[id].tsx");
    expect(detalhe).toContain('if (!texto?.trim()) return <Mensagem tom="aviso" texto={SEM_DESCRICAO} />;');
    expect(detalhe).toContain("<DescricaoDoPedido texto={t.description} />");
  });

  it("o elevador e o estacionamento do destino, que a rota já mandava", () => {
    const rota = cru("src/app/api/profissionais/meus-pedidos/route.ts");
    for (const campo of ["elevadorDestino:", "estacionamentoDestino:", "entulhoQuantidadeDita:", "clienteContexto:"]) {
      expect(rota, campo).toContain(campo);
    }
    const detalhe = ler("app-pro/src/app/trabalho/[id].tsx");
    expect(detalhe).toContain('<Linha rotulo="Elevador no destino" valor={emPortugues(ELEVADOR, t.elevadorDestino)} />');
    expect(detalhe).toContain('<Linha rotulo="Estacionar no destino" valor={emPortugues(ESTACIONAMENTO, t.estacionamentoDestino)} />');
    expect(detalhe).toContain("o cliente disse «{t.entulhoQuantidadeDita}»");
    expect(LISTA_DO_PAINEL).toContain("o cliente disse «{pedido.entulhoQuantidadeDita}»");
  });

  it("«Cliente desde … · N trabalhos confirmados», só quando é real", () => {
    expect(clienteDesde({ desde: "2026-10-01T10:00:00.000Z", confirmados: 3 })).toBe(
      "Cliente desde outubro de 2026 · 3 trabalhos confirmados",
    );
    expect(clienteDesde({ desde: null, confirmados: 1 })).toBe("1 trabalho confirmado");
    expect(clienteDesde({ desde: "2026-09-15T10:00:00.000Z", confirmados: 0 })).toBe("Cliente desde setembro de 2026");
    expect(clienteDesde({ desde: null, confirmados: 0 })).toBeNull();
    expect(clienteDesde(null)).toBeNull();
    expect(clienteDesde(undefined)).toBeNull();
    const contratado = ler("app-pro/src/componentes/TrabalhoContratado.tsx");
    expect(contratado).toContain("clienteDesde(t.clienteContexto)");
    expect(contratado).toContain("<MapaDaMorada morada={t.morada} />");
  });

  it("o mapa vem da rota do site, com a sessão, e a chave do Google não sai dele", () => {
    expect(caminhoDoMapa("Rua Augusta 1, Lisboa")).toBe("/api/mapa?q=Rua%20Augusta%201%2C%20Lisboa&w=640&h=200");
    expect(caminhoDoMapa("  ")).toBeNull();
    expect(caminhoDoMapa(null)).toBeNull();
    const mapa = ler("app-pro/src/componentes/MapaDaMorada.tsx");
    expect(mapa).toContain("headers: { Authorization: `Bearer ${token}` }");
    expect(mapa).not.toMatch(/maps\.googleapis|key=/);
    expect(LISTA_DO_PAINEL).toContain("/api/mapa?q=${encodeURIComponent(pedido.morada)}&w=640&h=200");
  });
});

// ── A14 — a lista ───────────────────────────────────────────────────────────

describe("A14 — a lista, com os nomes, os grupos e as horas do painel", () => {
  it("os separadores têm os nomes do painel, e são os seis sempre", () => {
    const bloco = /const SEPARADORES: Array<\{ id: Separador; rotulo: string \}> = \[([\s\S]*?)\];/.exec(LISTA_DO_PAINEL)?.[1] ?? "";
    const doPainel = [...bloco.matchAll(/\{ id: "(\w+)", rotulo: "([^"]+)" \}/g)].map((m) => [m[1], m[2]]);
    expect(doPainel).toHaveLength(6);
    expect(SEPARADORES.map((s) => [s.id, s.rotulo])).toEqual(doPainel);
    const ecra = ler("app-pro/src/app/(app)/index.tsx");
    expect(ecra).toContain("const separadores = SEPARADORES;");
    expect(ecra).not.toContain("porOrdemDeChegada");
  });

  it("os grupos e o porquê são os do painel, título a título", () => {
    const grupos = /const GRUPOS: Partial<Record<Separador, GrupoDaLista\[\]>> = \{([\s\S]*?)\n\};/.exec(LISTA_DO_PAINEL)?.[1] ?? "";
    const doPainel = [
      ...grupos.matchAll(/chave: "(\w+)",\s*titulo: "([^"]+)",\s*(?:\/\/[^\n]*\n\s*)*legenda: "([^"]+)"/g),
    ].map((m) => [m[1], m[2], m[3]]);
    const daApp = Object.values(GRUPOS).flatMap((l) => (l ?? []).map((g) => [g.chave, g.titulo, g.legenda]));
    expect(doPainel).toHaveLength(7);
    expect(daApp).toEqual(doPainel);

    const recusa = /const RECUSA: Record<string, \{[^}]*\}> = \{([\s\S]*?)\n\};/.exec(LISTA_DO_PAINEL)?.[1] ?? "";
    const porques = [...recusa.matchAll(/(\w+): \{\s*texto: "([^"]+)"/g)].map((m) => [m[1], m[2]]);
    expect(porques).toHaveLength(3);
    expect(Object.entries(RECUSA).map(([k, v]) => [k, v.texto])).toEqual(porques);
  });

  it("os Contratados dividem-se em Por fazer e À espera, com quantos e a legenda", () => {
    const lista = [
      T({ negociacaoId: 1, estado: "acordada", fase: "a_confirmar" }),
      T({ negociacaoId: 2, estado: "acordada", fase: "a_executar" }),
      T({ negociacaoId: 3, estado: "acordada", fase: "a_executar" }),
    ];
    const linhas = linhasDaLista(lista, "contratados");
    expect(linhas.map((l) => (l.tipo === "grupo" ? `${l.grupo.titulo} (${l.quantos})` : l.trabalho.negociacaoId))).toEqual([
      "Por fazer (2)",
      2,
      3,
      "À espera da confirmação (1)",
      1,
    ]);
    // Nos Feed e Em negociação não há grupos.
    expect(linhasDaLista(lista, "novos").every((l) => l.tipo === "trabalho")).toBe(true);
  });

  it("os Confirmados dizem onde está o dinheiro, pela regra do painel", () => {
    const confirmados = [
      T({ negociacaoId: 5, estado: "acordada", fase: "confirmado", confirmadoEm: "2026-10-28", valorAcordado: 350, clientePagou: true, criadaEm: "2026-10-20T10:00:00.000Z" }),
    ];
    const [grupo] = linhasDaLista(confirmados, "terminados");
    expect(grupo.tipo === "grupo" && grupo.legenda).toBe(legendaDosConfirmados(confirmados));
  });

  it("os Recusados agrupam-se pelo porquê", () => {
    expect(chaveDoGrupo(T({ estado: "morta", pedidoCancelado: false }))).toBe("outro");
    expect(chaveDoGrupo(T({ estado: "morta", pedidoCancelado: true }))).toBe("cancelado");
    expect(chaveDoGrupo(T({ estado: "desistida" }))).toBe("desistida");
  });

  it("«Recentes» é o que mexeu há menos tempo, e o resto vai pela ordem da rota", () => {
    const a = T({ negociacaoId: 1, actualizadoEm: "2026-10-29T08:00:00.000Z", criadaEm: "2026-10-29T09:00:00.000Z" });
    const b = T({ negociacaoId: 2, actualizadoEm: "2026-10-29T09:00:00.000Z", criadaEm: "2026-10-29T07:00:00.000Z" });
    expect(maisRecentePrimeiro([a, b]).map((t) => t.negociacaoId)).toEqual([2, 1]);
    const morta = T({ negociacaoId: 3, estado: "morta", actualizadoEm: "2026-10-29T12:00:00.000Z" });
    const desistida = T({ negociacaoId: 4, estado: "desistida", actualizadoEm: "2026-10-29T06:00:00.000Z" });
    expect(naOrdemDaRota([morta, desistida]).map((t) => t.negociacaoId)).toEqual([4, 3]);
  });

  it("há quanto tempo, como o cartão do painel; nos terminados, quando acabou", () => {
    const agora = new Date("2026-10-29T12:00:00.000Z");
    expect(haQuantoTempoNoCartao("2026-10-29T11:59:50.000Z", agora)).toBe("há 1 min");
    expect(haQuantoTempoNoCartao("2026-10-29T11:15:00.000Z", agora)).toBe("há 45 min");
    expect(haQuantoTempoNoCartao("2026-10-29T09:00:00.000Z", agora)).toBe("há 3 h");
    expect(haQuantoTempoNoCartao("2026-10-28T11:00:00.000Z", agora)).toBe("há 1 dia");
    expect(haQuantoTempoNoCartao("2026-10-25T11:00:00.000Z", agora)).toBe("há 4 dias");
    expect(haQuantoTempoNoCartao("nada", agora)).toBe("");
    expect(
      tempoDoCartao(
        T({ estado: "acordada", fase: "confirmado", confirmadoEm: "2026-10-28T10:00:00.000Z", execucaoEnviadaEm: "2026-10-27T15:00:00.000Z" }),
        agora,
      ),
    ).toBe("concluído 27/10");
    expect(tempoDoCartao(T({ actualizadoEm: "2026-10-29T10:00:00.000Z" }), agora)).toBe("há 2 h");
    // A regra do painel é esta, e o cartão dele chama-a assim.
    expect(LISTA_DO_PAINEL).toContain("? `concluído ${diaEMes(p.execucaoEnviadaEm ?? p.confirmadoEm)}`");
    expect(LISTA_DO_PAINEL).toContain("return dias === 1 ? \"há 1 dia\" : `há ${dias} dias`;");
  });
});

// ── A16 — as novidades e a proposta à espera ────────────────────────────────

describe("A16 — as novidades do painel, dentro da app", () => {
  it("as frases são as do painel", () => {
    const app = cru("app-pro/src/lib/trabalhos.ts");
    // Frase a frase, nas duas fontes.
    for (const pedaco of [
      "Pedido novo na sua zona — #${pd.pedidoId}. Abra para propor.",
      "Foi contratado — pedido #${pd.pedidoId}. A morada e o contacto já estão abertos.",
      "Trabalho #${pd.pedidoId} confirmado",
      " € já estão disponíveis na carteira.",
      " — o valor já está disponível na carteira.",
      "Transferência do trabalho #${pd.pedidoId} processada.",
    ]) {
      expect(PAINEL, pedaco).toContain(pedaco);
      expect(app, pedaco).toContain(pedaco);
    }
  });

  it("na primeira leitura não há novidades; depois, só o que é notícia para ele", () => {
    const antes = [
      T({ negociacaoId: 1, pedidoId: 11, estado: "aberta", fase: "a_negociar" }),
      T({ negociacaoId: 2, pedidoId: 12, estado: "acordada", fase: "a_executar" }),
      T({ negociacaoId: 3, pedidoId: 13, estado: "acordada", fase: "a_confirmar", recebeSeFechado: 311.5 }),
      T({ negociacaoId: 4, pedidoId: 14, estado: "acordada", fase: "confirmado" }),
    ];
    expect(novidadesEntre(null, antes)).toEqual([]);
    const depois = [
      T({ negociacaoId: 1, pedidoId: 11, estado: "acordada", fase: "a_executar" }),
      T({ negociacaoId: 2, pedidoId: 12, estado: "acordada", fase: "a_confirmar" }),
      T({ negociacaoId: 3, pedidoId: 13, estado: "acordada", fase: "confirmado", recebeSeFechado: 311.5 }),
      T({ negociacaoId: 4, pedidoId: 14, estado: "acordada", fase: "pago" }),
      T({ negociacaoId: 5, pedidoId: 15 }),
    ];
    const n = novidadesEntre(fasesDe(antes), depois);
    expect(n.map((x) => x.texto)).toEqual([
      "Foi contratado — pedido #11. A morada e o contacto já estão abertos.",
      "Trabalho #13 confirmado — 311,50 € já estão disponíveis na carteira.",
      "Transferência do trabalho #14 processada.",
      "Pedido novo na sua zona — #15. Abra para propor.",
    ]);
    // Passar a «à espera da confirmação» foi ele — não é notícia (o #12 não aparece).
    expect(n.map((x) => x.negociacaoId)).toEqual([1, 3, 4, 5]);
    // A mesma notícia não vira duas linhas.
    expect(juntarNovidades(n, n)).toHaveLength(4);
  });

  it("a lista mostra-as, um toque abre o trabalho, e saem ao sair", () => {
    const ecra = ler("app-pro/src/app/(app)/index.tsx");
    expect(ecra).toContain("{novidades.map((n) => (");
    expect(ecra).toContain("router.push(`/trabalho/${n.negociacaoId}`);");
    const estado = ler("app-pro/src/estado/Trabalhos.tsx");
    expect(estado).toContain("const chegadas = novidadesEntre(fasesAnteriores.current, lista);");
    expect(estado).toMatch(/fasesAnteriores\.current = null;\s*setNovidades\(\[\]\);/);
  });

  it("a proposta dele à espera do cliente mostra o valor e o que recebe", () => {
    const detalhe = ler("app-pro/src/app/trabalho/[id].tsx");
    expect(detalhe).toContain("<APropostaDele t={t} />");
    expect(detalhe).toContain("if (!p || p.por !== \"profissional\") return null;");
    expect(detalhe).toContain("{euros(quantoOProfissionalRecebe(p.valor, t.taxas))}");
    expect(cru("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx")).toContain('? "A sua proposta"');
  });
});

// ── A15 — a agenda em grelha ────────────────────────────────────────────────

describe("A15 — a agenda em grelha, com os feitos, o dia a marcar e o arrasto", () => {
  it("os feitos dizem o mesmo que no painel", () => {
    const bloco = /const ESTADO_DO_FEITO: Partial<Record<Pedido\["fase"\], string>> = \{([\s\S]*?)\};/.exec(AGENDA_DO_PAINEL)?.[1] ?? "";
    const doPainel = Object.fromEntries([...bloco.matchAll(/(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
    expect(ESTADO_DO_FEITO).toEqual(doPainel);
  });

  it("os por fazer pela hora de Lisboa, os feitos no dia em que foram feitos, os arquivados fora", () => {
    const lista = [
      // 1 de Julho: Lisboa está em UTC+1 — 13:00 UTC são 14:00 em Lisboa.
      T({ negociacaoId: 1, estado: "acordada", fase: "a_executar", dataCombinada: "2026-07-01T13:00:00.000Z", contactoNome: "Ana" }),
      T({ negociacaoId: 2, estado: "acordada", fase: "a_confirmar", execucaoEnviadaEm: "2026-07-02T09:30:00.000Z" }),
      T({ negociacaoId: 3, estado: "acordada", fase: "a_executar", arquivadoEm: "2026-07-01", dataCombinada: "2026-07-01T10:00:00.000Z" }),
      T({ negociacaoId: 4, estado: "acordada", fase: "a_executar" }),
    ];
    const ev = eventosDaAgenda(lista);
    expect(ev.map((e) => e.id)).toEqual([1, 2]);
    expect(ev[0].inicio.getHours()).toBe(14);
    expect(ev[0].fixo).toBe(false);
    expect(ev[1]).toMatchObject({ fixo: true, linha2: "Feito", titulo: "✓ Recolha de móveis" });
    expect(semDiaNaAgenda(lista).map((t) => t.negociacaoId)).toEqual([4]);
    // O que ele acabou de arrastar fica onde o largou, até o site responder.
    const movido = eventosDaAgenda(lista, { 1: "2026-07-03T08:00:00.000Z" });
    expect(movido.find((e) => e.id === 1)?.inicio.getDate()).toBe(3);
  });

  it("o próximo trabalho é um por fazer, e não um feito", () => {
    const ev = eventosDaAgenda([
      T({ negociacaoId: 1, estado: "acordada", fase: "confirmado", dataCombinada: "2026-07-05T09:00:00.000Z" }),
      T({ negociacaoId: 2, estado: "acordada", fase: "a_executar", dataCombinada: "2026-07-08T09:00:00.000Z" }),
    ]);
    expect(proximoTrabalho(ev, new Date(2026, 6, 4))?.getDate()).toBe(8);
  });

  it("largar: uma hora para baixo, um dia para o lado, ao quarto de hora e dentro da grelha", () => {
    const inicio = new Date(2026, 9, 30, 9, 0);
    const base = { inicio, larguraDaColuna: 40, colunas: 7, coluna: 3, janela: { de: 7, ate: 24 } };
    expect(quandoParaGravar(largarEm({ ...base, dx: 0, dy: 48 }))).toBe("2026-10-30T10:00");
    expect(quandoParaGravar(largarEm({ ...base, dx: 40, dy: 7 }))).toBe("2026-10-31T09:15");
    expect(quandoParaGravar(largarEm({ ...base, dx: -400, dy: -1000 }))).toBe("2026-10-27T07:00");
    expect(quandoParaGravar(largarEm({ ...base, dx: 0, dy: 5000 }))).toBe("2026-10-30T23:45");
  });

  it("cada serviço tem a cor do painel", () => {
    for (const s of ["recolha_moveis", "recolha_entulho", "esvaziamento_casa", "mudanca", "manutencao_casa", "recolha_monos"]) {
      expect(corDoServicoNaApp(s), s).not.toBe("#94A3B8");
    }
    expect(corDoServicoNaApp("inventado")).toBe("#94A3B8");
  });

  it("o ecrã tem as quatro vistas, o arrasto, o dia a marcar e grava pela rota do painel", () => {
    const ecra = ler("app-pro/src/app/(app)/agenda.tsx");
    for (const pedaco of [
      "VISTAS.map((v) =>",
      "<Grelha",
      "<Mes ",
      "<Lista trabalhos={trabalhos} />",
      "PanResponder.create({",
      "<ODia t={t} />",
      'await pedir("/api/profissionais/agenda", { metodo: "POST", corpo: { negociacaoId: id, quando: quandoParaGravar(parede) } });',
      "Próximo trabalho:",
    ]) {
      expect(ecra, pedaco).toContain(pedaco);
    }
  });
});
