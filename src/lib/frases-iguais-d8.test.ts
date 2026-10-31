import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HA_UM_PROBLEMA,
  PEDIR_TROCA_DE_PARCEIRO,
  SE_NAO_DISSER_NADA,
  aceitouOPrecoNaData,
  chegouNaData,
  marcadoComoFeitoNaData,
  mensagemDaTrocaDeParceiro,
  mensagemDoProblema,
  naData,
  pagoNaData,
} from "./frases-do-pedido";
import { legendaDaContraproposta } from "./frase-da-contraproposta";
import { AINDA_SEM_PROPOSTAS, NO_MESMO_DIA, PEDIDO_URGENTE, PROPOSTAS_EM_ATE } from "./promessas-publicas";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";
import { quandoEmLisboa } from "./pedido-para-a-app";
import { MINIMO_POR_PEDIDO_DOS_ITENS } from "./preco-de-referencia";
import { CITY_BASE_CONTENT, CITY_SERVICE_CONTENT } from "./city-content";
import { perguntaQuandoChega, respostaDeQuandoChega, trabalhoPorFazer } from "./quando-chega-o-parceiro";
import { whatsappHaUmProblema, whatsappTrocaDeProfissional, paraCopiar } from "../../app-cliente/src/lib/pedidos";

/**
 * A ORQUESTRA DE SÁBADO — 31-10-2026 (decisão d8). As frases da mesma fase do
 * pedido, iguais no /pedido/[token], na app de cliente e na Vitória.
 */

const RAIZ = process.cwd();
/** O código sem os comentários (a regra ancorada ao início da linha — ver testes-que-leem-o-codigo-fonte). */
const ler = (f: string) =>
  readFileSync(join(RAIZ, f), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const PROPOSTAS = "src/app/pedido/[token]/PropostasRecebidas.tsx";

describe("(1) a data a meio da frase, numa forma única", () => {
  it("«no sábado, 31 de outubro, às 13:20», «na sexta-feira, …», e o resto com «a»", () => {
    expect(naData("sábado, 31 de outubro, às 13:20")).toBe("no sábado, 31 de outubro, às 13:20");
    expect(naData("domingo, 1 de novembro")).toBe("no domingo, 1 de novembro");
    expect(naData("sexta-feira, 30 de outubro, às 09:00")).toBe("na sexta-feira, 30 de outubro, às 09:00");
    expect(naData("segunda-feira, 2 de novembro")).toBe("na segunda-feira, 2 de novembro");
    expect(naData("30/10/2026")).toBe("a 30/10/2026");
  });

  it("com o texto de quandoEmLisboa, as quatro frases ficam inteiras", () => {
    const q = quandoEmLisboa("2026-10-31T13:20:00.000Z") as string; // Inverno: UTC+0
    expect(q).toBe("sábado, 31 de outubro, às 13:20");
    expect(chegouNaData(q)).toBe("Chegou no sábado, 31 de outubro, às 13:20.");
    expect(aceitouOPrecoNaData(q)).toBe("Aceitou este preço no sábado, 31 de outubro, às 13:20.");
    expect(aceitouOPrecoNaData("agora")).toBe("Aceitou este preço.");
    expect(aceitouOPrecoNaData(null)).toBe("Aceitou este preço.");
    expect(pagoNaData(q)).toBe("Pago no sábado, 31 de outubro, às 13:20.");
    expect(pagoNaData(null)).toBe("Pago.");
    expect(marcadoComoFeitoNaData(q)).toBe("Marcado como feito no sábado, 31 de outubro, às 13:20.");
  });

  it("as 6 frases (2 no site, 4 na app) usam-nas, e nenhuma volta a escrever «a ${…}» à mão", () => {
    const usos: Array<[string, string]> = [
      [PROPOSTAS, "chegouNaData(acordada.chegouEmTexto)"],
      ["src/components/PrecoDaClyon.tsx", "aceitouOPrecoNaData(aceiteEm)"],
      ["app-cliente/src/componentes/Acompanhar.tsx", "chegouNaData(n.chegouEmTexto)"],
      ["app-cliente/src/componentes/Pagar.tsx", "pagoNaData(pg.pagoEmTexto)"],
      ["app-cliente/src/componentes/TrabalhoClyon.tsx", "aceitouOPrecoNaData(m.aceiteEmTexto)"],
      ["app-cliente/src/componentes/TrabalhoFeito.tsx", "marcadoComoFeitoNaData(n.execucaoEnviadaEmTexto)"],
    ];
    for (const [f, uso] of usos) expect(ler(f), f).toContain(uso);
    for (const [f] of usos) {
      expect(ler(f), f).not.toMatch(/Às \{|`Às \$\{|Pago a \$\{|Marcado como feito a \$\{|Aceitou este preço\$\{|Aceitou este preço\{/);
    }
  });
});

describe("(2) «Ainda sem propostas», com o prazo das 6 h, numa constante", () => {
  it("diz o prazo e é lida pelo site e mandada à app pela R5", () => {
    expect(AINDA_SEM_PROPOSTAS).toContain(PROPOSTAS_EM_ATE);
    expect(AINDA_SEM_PROPOSTAS).toContain("6 horas");
    expect(ler(PROPOSTAS)).toContain("{AINDA_SEM_PROPOSTAS}");
    expect(ler("src/lib/pedidos-do-cliente.ts")).toContain("aindaSemPropostas: AINDA_SEM_PROPOSTAS,");
    expect(ler("app-cliente/src/lib/pedidos.ts")).toContain("r.textos?.aindaSemPropostas");
    expect(ler("app-cliente/src/lib/pedidos.ts")).not.toContain("O pedido foi enviado aos parceiros verificados da zona. Ainda sem propostas.");
  });
});

describe("(3) «Há um problema» e «Pedir troca de parceiro» nas duas portas, com as mesmas mensagens", () => {
  it("as mensagens são as mesmas no site e na app", () => {
    expect(mensagemDoProblema(12)).toBe("Pedido #12: há um problema.");
    expect(mensagemDaTrocaDeParceiro(12)).toBe("Pedido #12: queria pedir a troca de parceiro.");
    expect(whatsappHaUmProblema(12)).toBe(mensagemDoProblema(12));
    expect(whatsappTrocaDeProfissional(12)).toBe(mensagemDaTrocaDeParceiro(12));
    expect(ler("src/components/AjudaDoPedido.tsx")).toContain("return mensagemDoProblema(pedidoId);");
    expect(ler("src/components/AjudaDoPedido.tsx")).toContain("{HA_UM_PROBLEMA}");
    expect(ler("app-cliente/src/componentes/TrabalhoFeito.tsx")).toContain("titulo={HA_UM_PROBLEMA}");
    expect(HA_UM_PROBLEMA).toBe("Há um problema");
  });

  it("o /pedido/[token] tem «Pedir troca de parceiro», como a app", () => {
    const P = ler(PROPOSTAS);
    expect(P).toContain("mensagemDaTrocaDeParceiro(pedidoId)");
    expect(P).toContain("{PEDIR_TROCA_DE_PARCEIRO}");
    expect(ler("app-cliente/src/componentes/VistaDoPedido.tsx")).toContain("titulo={PEDIR_TROCA_DE_PARCEIRO}");
    expect(PEDIR_TROCA_DE_PARCEIRO).toBe("Pedir troca de parceiro");
  });

  it("o «7 dias» lê-se de DIAS_ATE_LIBERTAR_SOZINHO", () => {
    expect(SE_NAO_DISSER_NADA).toContain(`${DIAS_ATE_LIBERTAR_SOZINHO} dias depois`);
    expect(ler(PROPOSTAS)).not.toMatch(/fica confirmado 7 dias/);
    expect(ler("src/app/page.tsx")).not.toMatch(/fica confirmado 7 dias/);
    expect(ler("src/app/page.tsx")).toContain("${DIAS_ATE_LIBERTAR_SOZINHO} dias depois");
  });
});

describe("(4) a contraproposta, o «Copiar», a referência que ninguém envia, o MB WAY e a fatura", () => {
  it("a legenda da contraproposta vive numa constante, lida pelo site e mandada pela R5", () => {
    expect(legendaDaContraproposta({ ivaIncluido: true })).toBe("É o que paga se ele aceitar, com IVA incluído.");
    expect(legendaDaContraproposta({ ivaIncluido: false })).toBe("É o que paga se ele aceitar, sem IVA.");
    expect(legendaDaContraproposta({ porHora: true, ivaIncluido: true })).toBe(
      "É o que paga por hora se ele aceitar, com IVA incluído (mínimo 3 horas).",
    );
    expect(ler(PROPOSTAS)).toContain("legendaDaContraproposta({ porHora: !!n.horas, ivaIncluido: n.valores?.ivaIncluido })");
    expect(ler("src/lib/pedidos-do-cliente.ts")).toContain("proporAjuda: legendaDaContraproposta(");
    const vista = ler("app-cliente/src/componentes/VistaDoPedido.tsx");
    expect(vista).toContain("aPropor?.proporAjuda ?? r.textos.proporAjuda");
    expect(vista).not.toContain("com tudo incluído");
  });

  it("«Copiar» o valor copia só o número", () => {
    expect(paraCopiar("452,03 € (367,50 € sem IVA)")).toBe("452,03");
    expect(paraCopiar("452,03€")).toBe("452,03");
  });

  it("a app já não diz «A CLYON envia-lhe a referência»; o MB WAY vem preenchido e a fatura começa como o pedido", () => {
    const pagar = ler("app-cliente/src/componentes/Pagar.tsx");
    expect(pagar).not.toContain("envia-lhe a referência");
    expect(pagar).toContain('useState(telefoneSugerido ?? "")');
    expect(pagar).toContain("useState(!!precisaFatura)");
    for (const f of ["app-cliente/src/componentes/VistaDoPedido.tsx", "app-cliente/src/componentes/TrabalhoClyon.tsx"]) {
      expect(ler(f), f).toMatch(/telefoneSugerido=\{p(edido)?\.telefone \?\? null\}/);
      expect(ler(f), f).toMatch(/precisaFatura=\{p(edido)?\.precisaFatura\}/);
    }
    // O telefone vai na vista da conta (é dele) e nunca na do convidado.
    const r5 = ler("src/lib/pedidos-do-cliente.ts");
    expect(r5).toContain("telefone: pedido.contactPhone ?? null,");
    const convidado = r5.slice(r5.indexOf("export async function pedidoDoConvidadoParaAApp"));
    expect(convidado.indexOf("export async function pedidoDoConvidadoParaAApp")).toBe(0);
    expect(convidado).not.toMatch(/\btelefone\b/);
  });
});

describe("(5) o interruptor «WhatsApp» das notificações sai da app e da /conta", () => {
  it("nenhum dos dois o mostra nem o grava", () => {
    expect(ler("app-cliente/src/app/(app)/perfil.tsx")).not.toContain("notifWhatsapp");
    const conta = ler("src/app/conta/components/Notificacoes.tsx");
    expect(conta).not.toContain('id="notif-whatsapp"');
    expect(conta).not.toContain("notifWhatsapp");
  });
});

describe("(6) «Hoje»: pedido urgente, sem prometer o dia — na app, no simulador e na FAQ", () => {
  it("a mesma frase nas três portas, e a rota já não o recusa", () => {
    expect(PEDIDO_URGENTE).toMatch(/urgente/);
    expect(PEDIDO_URGENTE).toMatch(/não fica garantido/);
    expect(NO_MESMO_DIA).toMatch(/urgente/);
    expect(NO_MESMO_DIA).toMatch(/não fica garantido/);
    expect(ler("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain('formData.urgency === "today" && <p className="text-xs text-gray-600">{PEDIDO_URGENTE}</p>');
    expect(ler("src/lib/catalogo-da-app.ts")).toContain("pedidoUrgente: PEDIDO_URGENTE,");
    expect(ler("src/app/api/simulador/pedido/route.ts")).not.toContain("SEM_HOJE_NA_APP");
  });
});

describe("(7) a Vitória: «ele vem hoje?» de um trabalho contratado", () => {
  it("percebe a pergunta", () => {
    for (const t of ["Ele vem hoje?", "a que horas chega?", "A que horas é que o parceiro chega?", "Quando vem?", "Já está a caminho?", "o senhor vem amanhã de manhã?", "Chega a que horas?"]) {
      expect(perguntaQuandoChega(t), t).toBe(true);
    }
    for (const t of ["Fazem recolhas hoje?", "Quanto custa?", "Obrigada", "Hoje não posso", "Podem enviar proposta para sábado?"]) {
      expect(perguntaQuandoChega(t), t).toBe(false);
    }
  });

  it("responde com o dia marcado e a viagem, da mesma fonte da app, e «parceiro»", () => {
    const base = { pedidoId: 501, nome: "Rui Inventado", dataCombinada: "2026-10-31T13:20:00.000Z" };
    expect(respostaDeQuandoChega(base)).toEqual({
      texto: "Pedido #501: O trabalho com Rui está marcado no sábado, 31 de outubro, às 13:20.",
      semDia: false,
    });
    expect(respostaDeQuandoChega({ ...base, aCaminhoEm: "2026-10-31T13:00:00.000Z" }).texto).toBe(
      "Pedido #501: O parceiro está a caminho. O trabalho com Rui está marcado no sábado, 31 de outubro, às 13:20.",
    );
    // Sem hora: diz quem a combina.
    expect(respostaDeQuandoChega({ ...base, dataCombinada: "2026-10-31T00:00:00.000Z" }).texto).toBe(
      "Pedido #501: O trabalho com Rui está marcado no sábado, 31 de outubro. A hora combina-a Rui consigo.",
    );
    // Sem dia: passa a uma pessoa.
    const sem = respostaDeQuandoChega({ pedidoId: 501, nome: null, dataCombinada: null });
    expect(sem.semDia).toBe(true);
    expect(sem.texto).toBe("Pedido #501: Ainda não há dia marcado com o parceiro na plataforma. Passo a sua pergunta a uma pessoa da CLYON, que confirma consigo.");
    expect(sem.texto).not.toMatch(/profissional/i);
  });

  it("só o trabalho contratado e por fazer", () => {
    const n = (o: Record<string, unknown>) => ({ estado: "acordada", profissionalNome: "Rui", dataCombinada: null, ...o });
    expect(trabalhoPorFazer(1, [n({ estado: "aberta" })])).toBeNull();
    expect(trabalhoPorFazer(1, [n({ execucaoEnviadaEm: "2026-10-30T10:00:00Z" })])).toBeNull();
    expect(trabalhoPorFazer(1, [n({})])).toMatchObject({ pedidoId: 1, nome: "Rui" });
  });

  it("a pergunta lê-se antes das perguntas do site (o «hoje» levava o NO_MESMO_DIA)", () => {
    const w = ler("src/lib/whatsapp-negociacao.ts");
    const aqui = w.indexOf("perguntaQuandoChega(conteudo.texto)");
    const site = w.indexOf("respostaDoSiteOuDasLicoes(conteudo.texto, { contar: false })");
    expect(aqui).toBeGreaterThan(-1);
    expect(site).toBeGreaterThan(aqui);
  });

  it("as duas sobras de «profissional» nos textos ao cliente passam a «parceiro»", () => {
    expect(ler("src/lib/avisos-do-terreno.ts")).toContain('|| "O parceiro";');
    expect(ler("src/lib/avisos-do-terreno.ts")).not.toContain('|| "O profissional"');
    expect(ler("src/lib/assistente-automatico.ts")).toContain('n.profissionalNome || "o parceiro"');
  });
});

describe("(8) Vila Franca de Xira e Mafra saem das zonas vizinhas", () => {
  it("nenhuma página as diz vizinhas", () => {
    for (const [slug, c] of Object.entries({ ...CITY_SERVICE_CONTENT, ...CITY_BASE_CONTENT } as Record<string, { nearbyAreas?: string[] }>)) {
      for (const fora of ["Mafra", "Vila Franca de Xira"]) expect(c.nearbyAreas ?? [], `${slug} ${fora}`).not.toContain(fora);
    }
  });
});

describe("(9) o sofá: o mínimo por pedido ao lado da faixa, com o IVA", () => {
  it("a frase e onde ela vai", () => {
    expect(MINIMO_POR_PEDIDO_DOS_ITENS).toContain("80 € + IVA (98,40 € com IVA)");
    expect(ler("src/app/recolha-de-sofas/page.tsx")).toContain("{MINIMO_POR_PEDIDO_DOS_ITENS}");
    expect(ler("src/app/recolha-de-sofas/page.tsx")).toContain("${MINIMO_POR_PEDIDO_DOS_ITENS}");
    expect(ler("src/lib/blog-data.ts")).toContain("${MINIMO_POR_PEDIDO_DOS_ITENS}");
  });
});

describe("(10) a app de cliente entra nas regras n e o da orquestra", () => {
  it("sai a linha de excepção", () => {
    expect(ler("src/lib/orquestra.test.ts")).not.toContain("/^app-cliente\\//.test(f)");
  });
});
