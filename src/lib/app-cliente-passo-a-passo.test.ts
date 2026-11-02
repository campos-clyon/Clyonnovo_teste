import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  avisoNoTopoSeVe,
  diaMarcadoCurto,
  horaCurtaDoPasso,
  intervaloDeLeitura,
  LEITURA_ACTIVA_MS,
  LEITURA_DA_LISTA_MS,
  LEITURA_PARADA_MS,
  momentoDoPedido,
  mudancasNaLista,
  passosDoPedido,
  tomDoEstado,
} from "../../app-cliente/src/lib/passos-do-pedido";

/**
 * O PASSO A PASSO, O AVISO DO MOMENTO E O POP-UP DO TOPO — ordem do CEO com
 * o sim do dono, 02-11-2026 (#555). Os avisos do parceiro passavam
 * despercebidos: a pílula e a caixa «O parceiro está a caminho.» diziam o
 * mesmo em cor neutra, e só se viam com o pedido aberto e depois de puxar
 * para actualizar. Agora: o momento em cor forte no topo, a linha de passos
 * com a hora de cada um, o pedido a reler-se sozinho, e um aviso no topo
 * quando um pedido muda com a app aberta noutro ecrã.
 */
const APP = join(process.cwd(), "app-cliente", "src");
const ler = (p: string) => readFileSync(join(APP, p), "utf8").replace(/\r\n/g, "\n");

// 02-11-2026, 20:30 em Lisboa (UTC no Inverno).
const AGORA = new Date("2026-11-02T20:30:00Z");

const pedido = (estadoTexto = "Fred Teste vai a caminho") => ({ criadoEm: "2026-11-02T16:00:00Z", estadoTexto });
const contratada = (extra: Record<string, unknown> = {}) =>
  ({
    fase: "a_executar",
    profissional: { nome: "Fred Teste" },
    accoes: [] as string[],
    dataCombinada: null,
    dataCombinadaTexto: null,
    aCaminhoEm: null,
    proximoEm: null,
    chegouEm: null,
    chegadaConfirmadaEm: null,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagamento: { pago: true, pagoEm: "2026-11-02T17:42:00Z", emDinheiroAoProfissional: false, disponivel: true },
    ...extra,
  }) as never;

describe("as horas, sempre em Lisboa", () => {
  it("hoje, ontem ou o dia, com a hora", () => {
    expect(horaCurtaDoPasso("2026-11-02T18:20:00Z", AGORA)).toBe("hoje, 18:20");
    expect(horaCurtaDoPasso("2026-11-01T09:05:00Z", AGORA)).toBe("ontem, 09:05");
    expect(horaCurtaDoPasso("2026-10-28T10:00:00Z", AGORA)).toBe("28/10, 10:00");
    expect(horaCurtaDoPasso(null, AGORA)).toBeNull();
    // Verão: Lisboa = UTC+1.
    expect(horaCurtaDoPasso("2026-10-20T17:20:00Z", new Date("2026-10-20T20:00:00Z"))).toBe("hoje, 18:20");
  });

  it("o dia marcado em curto; meia-noite é só o dia", () => {
    expect(diaMarcadoCurto("2026-11-04T10:00:00Z")).toBe("qua, 04/11, 10:00");
    expect(diaMarcadoCurto("2026-11-04T00:00:00Z")).toBe("qua, 04/11");
  });
});

describe("a linha de passos", () => {
  it("são os sete passos do dono, pela ordem, com o actual destacado depois do último feito", () => {
    const passos = passosDoPedido(pedido(), contratada({ aCaminhoEm: "2026-11-02T18:20:00Z" }), AGORA);
    expect(passos.map((p) => p.titulo)).toEqual(["Pedido feito", "Parceiro escolhido", "Pago", "Dia marcado", "A caminho", "Chegou", "Concluído"]);
    expect(passos.map((p) => p.estado)).toEqual(["feito", "feito", "feito", "saltado", "feito", "actual", "por-fazer"]);
    expect(passos.find((p) => p.id === "caminho")?.detalhe).toBe("hoje, 18:20");
    expect(passos.find((p) => p.id === "pago")?.detalhe).toBe("hoje, 17:42");
    expect(passos.find((p) => p.id === "escolhido")?.detalhe).toBe("Fred Teste");
  });

  it("o pagamento que ficou para trás continua a contar («por pagar»), e o pago no local não é passo", () => {
    const porPagar = contratada({ dataCombinada: "2026-11-04T10:00:00Z", pagamento: { pago: false, emDinheiroAoProfissional: false, disponivel: true } });
    expect(passosDoPedido(pedido(), porPagar, AGORA).find((p) => p.id === "pago")?.estado).toBe("falta");
    const noLocal = contratada({ pagamento: { pago: false, emDinheiroAoProfissional: true, disponivel: false } });
    expect(passosDoPedido(pedido(), noLocal, AGORA).some((p) => p.id === "pago")).toBe(false);
  });

  it("sem parceiro, o actual é «Parceiro escolhido»; cancelado, nenhum é o actual", () => {
    expect(passosDoPedido(pedido("Tem propostas"), null, AGORA).find((p) => p.estado === "actual")?.id).toBe("escolhido");
    expect(passosDoPedido(pedido("Cancelado"), null, AGORA).some((p) => p.estado === "actual")).toBe(false);
  });

  it("feito pelo parceiro: o «Concluído» pede a confirmação; confirmado, tudo feito", () => {
    const aConfirmar = passosDoPedido(pedido("Por confirmar"), contratada({ fase: "a_confirmar", chegouEm: "2026-11-02T19:00:00Z" }), AGORA);
    expect(aConfirmar.at(-1)).toMatchObject({ estado: "actual", detalhe: "Confirme que ficou feito" });
    const feito = passosDoPedido(pedido("Concluído"), contratada({ fase: "confirmado", confirmadoEm: "2026-11-02T20:00:00Z" }), AGORA);
    expect(feito.at(-1)).toMatchObject({ estado: "feito", detalhe: "hoje, 20:00" });
  });
});

describe("o aviso do momento", () => {
  it("diz o que acabou de acontecer, com a hora, em cor forte", () => {
    expect(momentoDoPedido(pedido(), contratada({ aCaminhoEm: "2026-11-02T18:20:00Z" }), AGORA)).toEqual({
      titulo: "Fred Teste vai a caminho",
      texto: "Saiu às 18:20.",
      tom: "marca",
    });
    expect(
      momentoDoPedido(pedido(), contratada({ aCaminhoEm: "2026-11-02T18:20:00Z", chegouEm: "2026-11-02T18:40:00Z", accoes: ["confirmar_chegada"] }), AGORA),
    ).toEqual({ titulo: "Fred Teste chegou", texto: "Chegou às 18:40. Confirme que chegou.", tom: "aviso" });
    expect(momentoDoPedido(pedido("Concluído"), contratada({ fase: "pago", confirmadoEm: "2026-11-01T10:00:00Z" }), AGORA)?.tom).toBe("bom");
  });

  it("sem parceiro ou cancelado não há momento (falam as propostas e o estado)", () => {
    expect(momentoDoPedido(pedido("Tem propostas"), null, AGORA)).toBeNull();
    expect(momentoDoPedido(pedido("Cancelado"), contratada(), AGORA)).toBeNull();
  });

  it("nunca diz «profissional» (o cliente lê «parceiro»)", () => {
    const fonte = ler("lib/passos-do-pedido.ts") + ler("componentes/PassoAPasso.tsx") + ler("componentes/AvisoNoTopo.tsx");
    const textos = [...fonte.matchAll(/"([^"]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? "");
    expect(textos.filter((x) => /profission/i.test(x.replace(/\$\{[^}]*\}/g, "")))).toEqual([]);
  });
});

describe("o pedido actualiza-se sozinho", () => {
  it("15 s com parceiro e por concluir, 60 s à espera, parado depois do fim", () => {
    expect(intervaloDeLeitura(pedido(), { fase: "a_executar" })).toBe(LEITURA_ACTIVA_MS);
    expect(LEITURA_ACTIVA_MS).toBe(15_000);
    expect(intervaloDeLeitura(pedido("À espera de propostas"), null)).toBe(LEITURA_PARADA_MS);
    expect(intervaloDeLeitura(pedido("Concluído"), { fase: "confirmado" })).toBeNull();
    expect(intervaloDeLeitura(pedido("Cancelado"), null)).toBeNull();
    expect(LEITURA_DA_LISTA_MS).toBe(30_000);
  });

  it("o ecrã do pedido relê em silêncio, só à vista e em primeiro plano, ao voltar à app e com um aviso deste pedido", () => {
    const v = ler("componentes/VistaDoPedido.tsx");
    expect(v).toContain("useFocusEffect(");
    expect(v).toContain('AppState.addEventListener("change"');
    expect(v).toContain("if (!aVista || !activa || intervalo == null) return;");
    expect(v).toContain("setInterval(() => void carregar(true), intervalo)");
    expect(v).toContain("Notifications.addNotificationReceivedListener");
    expect(v).toContain("if (Number(dados?.pedidoId) === pedidoId) void carregar(true);");
    // A leitura sozinha não acende a roda nem pinta o erro.
    expect(v).toContain("if (!silencioso) setALer(true);");
  });

  it("a lista relê de 30 em 30 s só em primeiro plano, e com cada aviso", () => {
    const e = ler("estado/Pedidos.tsx");
    expect(e).toContain("setInterval(() => void ler(true), LEITURA_DA_LISTA_MS)");
    expect(e).toContain("} else desligarRelogio();");
    expect(e).toContain("Notifications.addNotificationReceivedListener");
  });
});

describe("o aviso em pop-up no topo", () => {
  const l = (id: number, estadoTexto: string, novidade: string | null = null) => ({ id, estadoTexto, novidade });

  it("um pedido que muda de estado acende o aviso com o estado novo; o pagamento que entra também", () => {
    expect(mudancasNaLista([l(555, "Contratado — Fred Teste")], [l(555, "Fred Teste vai a caminho")])).toEqual([
      { pedidoId: 555, titulo: "Pedido #555", texto: "Fred Teste vai a caminho" },
    ]);
    expect(mudancasNaLista([l(555, "Contratado — Fred Teste", "Por pagar")], [l(555, "Contratado — Fred Teste")])).toEqual([
      { pedidoId: 555, titulo: "Pedido #555", texto: "Pagamento recebido" },
    ]);
    expect(mudancasNaLista([l(7, "Tem propostas", "1 proposta nova")], [l(7, "Tem propostas", "2 propostas novas")])[0]?.texto).toBe("2 propostas novas");
  });

  it("nada muda, ou um pedido novo (foi ele que o fez): nada a avisar", () => {
    expect(mudancasNaLista([l(1, "Tem propostas")], [l(1, "Tem propostas")])).toEqual([]);
    expect(mudancasNaLista([], [l(2, "A ser revisto pela CLYON")])).toEqual([]);
  });

  it("não aparece no próprio pedido (nem no pagar dele), e só com sessão", () => {
    expect(avisoNoTopoSeVe("/pedido/555", 555)).toBe(false);
    expect(avisoNoTopoSeVe("/pagar/555", 555)).toBe(false);
    expect(avisoNoTopoSeVe("/pedidos", 555)).toBe(true);
    expect(avisoNoTopoSeVe("/pedido/12", 555)).toBe(true);
    expect(ler("app/_layout.tsx")).toContain("{ligado ? <AvisoNoTopo /> : null}");
  });
});

describe("o ecrã do pedido e a lista", () => {
  it("o momento e os passos no topo; a pílula e a caixa neutra da viagem saem", () => {
    const v = ler("componentes/VistaDoPedido.tsx");
    expect(v).toContain("{momento ? <MomentoDoPedido momento={momento} /> : null}");
    expect(v).toContain("{passos ? <PassosDoPedido passos={passos} /> : null}");
    expect(v).toContain("{momento ? null : <Etiqueta texto={p.estadoTexto} />}");
    expect(v.indexOf("<MomentoDoPedido")).toBeLessThan(v.indexOf("<Mensagens "));
    expect(ler("componentes/Acompanhar.tsx")).toContain("n.viagemTexto && !n.execucaoEnviadaEm && !semViagem");
  });

  it("pago, o cartão fica curto: o total e o «Pago …»; as três linhas vão para «O valor e os itens a mais»", () => {
    const v = ler("componentes/VistaDoPedido.tsx");
    expect(v).toContain("{`Total ${contratada.preco.conta.total}`}");
    expect(v).toContain('{pagoJa && contratada.preco?.conta ? <Preco preco={{ ...contratada.preco, nota: "" }} tamanho="medio" /> : null}');
  });

  it("cada cartão da lista mostra o estado com a cor do momento", () => {
    expect(tomDoEstado({ estadoTexto: "Fred Teste vai a caminho", novidade: null })).toBe("movimento");
    expect(tomDoEstado({ estadoTexto: "Contratado — Fred Teste", novidade: "Por pagar" })).toBe("aviso");
    expect(tomDoEstado({ estadoTexto: "Concluído", novidade: null })).toBe("bom");
    expect(tomDoEstado({ estadoTexto: "Cancelado", novidade: null })).toBe("apagado");
    expect(ler("app/(app)/pedidos.tsx")).toContain("COR_DO_ESTADO[tomDoEstado(p)]");
  });
});

describe("a R5 manda a hora do pagamento", () => {
  it("o pagamento leva `pagoEm` em ISO ao lado do texto", () => {
    const r5 = readFileSync(join(process.cwd(), "src", "lib", "pedidos-do-cliente.ts"), "utf8");
    expect(r5).toContain("pagoEm: pago ? isoOuNulo(pago.pagoEm) : null,");
  });
});
