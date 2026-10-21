import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  contarNaMesa,
  eEsperaAntiga,
  haQuanto,
  linhasDoSeparador,
  naMesa,
  reabertaDepoisDoFecho,
  soAgradece,
  type FactosDaConversa,
  type MensagemDaMesa,
} from "./mesa-das-conversas";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";

/**
 * A MESA DAS CONVERSAS — 21-10-2026.
 *
 * *«Estamos perdidos entre quais pedidos já foram respondidos, quais já foram
 * resolvidos, quais já foram finalizados, e quais ainda falta responder,
 * quais as conversas ficaram a meio, quais a Vitória começou a responder e
 * parou.»* — o dono, com 193 conversas em «Entregues a si». Decidiu que a
 * Vitória fecha sozinha as que leu e viu acabadas, e que lê as 193.
 *
 * As conversas das capturas desse dia, cada uma no separador onde tinha de
 * estar.
 */

const H = 3600;
const entrada = (id: number, texto: string, haSegundos: number): MensagemDaMesa => ({
  id,
  direccao: "in",
  texto,
  haSegundos,
  quando: "2026-10-21 18:57:00",
});
const saida = (id: number, texto: string, haSegundos: number): MensagemDaMesa => ({
  id,
  direccao: "out",
  texto,
  haSegundos,
  quando: "2026-10-21 18:51:00",
});
const conversa = (f: Partial<FactosDaConversa>): FactosDaConversa => ({
  telefone: "351914798695",
  ultimaEntrada: null,
  ultimaSaida: null,
  bloqueada: false,
  entregue: true,
  fecho: null,
  recolha: null,
  pedidoVivo: null,
  ultimoPedido: null,
  guardada: null,
  ...f,
});

describe("por responder — o cliente escreveu por último", () => {
  it("o Leandro: «Podemos prosseguir» depois do nosso «sim» à mão", () => {
    const l = naMesa(
      conversa({
        ultimaSaida: saida(10, `${MARCA_DE_MAO} sim`, 6 * 60),
        ultimaEntrada: entrada(12, "Podemos prosseguir", 60),
        motivoDaEntrega: "Respondeu à mão no WhatsApp",
      }),
    );
    expect(l.estado).toBe("por_responder");
    expect(l.porque).toBe("Escreveu há 1 min: «Podemos prosseguir»");
    expect(l.dono).toBe("equipa");
    expect(l.motivoDaEntrega).toBe("Respondeu à mão no WhatsApp");
  });

  it("a Teresa: duas fotografias depois do nosso «obrigada»", () => {
    const l = naMesa(
      conversa({
        ultimaSaida: saida(20, `${MARCA_DE_MAO} obrigada`, 2 * H),
        ultimaEntrada: entrada(23, "[fotografia]", H + 50 * 60),
      }),
    );
    expect(l.estado).toBe("por_responder");
    expect(l.porque).toBe("Escreveu há 1 h: «📷 imagem»");
  });

  it("com a Vitória: diz se ela está a responder ou se não respondeu", () => {
    const agora = naMesa(conversa({ entregue: false, ultimaEntrada: entrada(5, "Olá", 30) }));
    expect(agora.porque).toContain("a Vitória está a responder");
    const parada = naMesa(conversa({ entregue: false, ultimaEntrada: entrada(5, "Olá", 2 * H) }));
    expect(parada.porque).toContain("a Vitória não respondeu");
  });

  it("e com pedido vivo continua por responder — o pedido vai no porquê", () => {
    const l = naMesa(
      conversa({
        ultimaEntrada: entrada(30, "E o valor?", 40 * 60),
        ultimaSaida: saida(29, "sim!", H),
        pedidoVivo: { id: 475, status: "novo" },
      }),
    );
    expect(l.estado).toBe("por_responder");
    expect(l.porque).toContain("· pedido #475");
  });

  it("«Combinado» e «sim» são o cliente a aceitar — alguém tem de avançar", () => {
    for (const t of ["Combinado", "sim", "Podemos prosseguir", "Então?", "Ok. Estou de acordo."]) {
      expect(soAgradece(t), t).toBe(false);
      expect(naMesa(conversa({ ultimaEntrada: entrada(2, t, 600), ultimaSaida: saida(1, "x", 900) })).estado, t).toBe(
        "por_responder",
      );
    }
  });
});

describe("à espera do cliente — a última palavra foi nossa", () => {
  it("o «Obrigado» depois do «De nada» não pede resposta", () => {
    for (const t of ["Obrigado", "ok 👍", "🙏", "Muito obrigada", "obg"]) expect(soAgradece(t), t).toBe(true);
    const l = naMesa(
      conversa({ ultimaSaida: saida(8, "De nada. Qualquer coisa, é só dizer.", 2 * H), ultimaEntrada: entrada(9, "Obrigado", H) }),
    );
    expect(l.estado).toBe("a_espera");
    expect(l.porque).toBe("O cliente agradeceu há 1 h — nada por responder");
  });

  it("diz quem respondeu — a equipa ou a Vitória — e o quê", () => {
    const equipa = naMesa(conversa({ ultimaSaida: saida(4, `${MARCA_DE_MAO} Pode enviar fotos?`, 3 * H) }));
    expect(equipa.estado).toBe("a_espera");
    expect(equipa.porque).toBe("A equipa respondeu há 3 h: «Pode enviar fotos?»");
    const vitoria = naMesa(conversa({ entregue: true, ultimaSaida: saida(4, "Qual é a morada, por favor?", 25 * H) }));
    expect(vitoria.porque).toBe("A Vitória respondeu há 1 dia: «Qual é a morada, por favor?»");
  });
});

describe("a meio — a Vitória estava a recolher e o cliente parou", () => {
  it("diz onde parou e há quanto tempo foi a pergunta", () => {
    const l = naMesa(
      conversa({
        entregue: false,
        recolha: { passo: "morada" },
        ultimaEntrada: entrada(3, "Helena", 50 * 60),
        ultimaSaida: saida(4, "Obrigada, Helena! Qual é a morada, por favor?", 45 * 60),
      }),
    );
    expect(l.estado).toBe("a_meio");
    expect(l.porque).toBe("Parou a dar a morada — a última pergunta foi há 45 min");
    expect(l.passo).toBe("morada");
  });
});

describe("com pedido — há um pedido vivo, e é lá que se trata", () => {
  it("a Daniela: o nosso «Obrigada» e o pedido #475 agendado", () => {
    const l = naMesa(
      conversa({
        telefone: "351964764157",
        ultimaEntrada: entrada(40, "Ok. Estou de acordo.", 3 * H),
        ultimaSaida: saida(41, `${MARCA_DE_MAO} Obrigada`, 2 * H),
        pedidoVivo: { id: 475, status: "agendado" },
      }),
    );
    expect(l.estado).toBe("com_pedido");
    expect(l.porque).toBe("Pedido #475 — agendado");
    expect(l.pedidoId).toBe(475);
  });
});

describe("resolvidas — fechadas, com o porquê", () => {
  it("fechada pela Vitória ou pela equipa, com o motivo", () => {
    const vitoria = naMesa(
      conversa({
        ultimaEntrada: entrada(2, "Já arranjei quem fizesse, obrigado", 5 * H),
        fecho: { haSegundos: 4 * H, quando: "x", motivo: "o cliente disse que já arranjou quem fizesse", porQuem: "vitoria" },
      }),
    );
    expect(vitoria.estado).toBe("resolvida");
    expect(vitoria.porque).toBe("A Vitória fechou-a: o cliente disse que já arranjou quem fizesse");
    expect(vitoria.fechadaPor).toBe("vitoria");
    const equipa = naMesa(conversa({ fecho: { haSegundos: H, quando: "x", motivo: null, porQuem: "equipa" } }));
    expect(equipa.porque).toBe("Fechada pela equipa");
  });

  it("volta sozinha à mesa se o cliente escrever depois de fechada", () => {
    const f = conversa({
      ultimaEntrada: entrada(9, "Afinal ainda precisamos", 10 * 60),
      fecho: { haSegundos: 2 * H, quando: "x", motivo: "serviço feito", porQuem: "equipa" },
    });
    expect(reabertaDepoisDoFecho(f)).toBe(true);
    const l = naMesa(f);
    expect(l.estado).toBe("por_responder");
    expect(l.porque).toBe("Voltou a escrever depois de fechada — escreveu há 10 min: «Afinal ainda precisamos»");
  });

  it("o pedido acabou e não houve nada depois: resolvida pelo pedido", () => {
    const l = naMesa(
      conversa({ ultimaSaida: saida(3, "Obrigada!", 30 * H), ultimoPedido: { id: 402, status: "concluido" } }),
    );
    expect(l.estado).toBe("resolvida");
    expect(l.porque).toBe("Pedido #402 concluído");
    expect(l.fechadaPor).toBe("pedido");
  });
});

describe("bloqueadas e guardadas", () => {
  it("bloqueada manda sobre tudo", () => {
    expect(naMesa(conversa({ bloqueada: true, ultimaEntrada: entrada(1, "Olá", 60) })).estado).toBe("bloqueada");
  });

  it("guardada é uma marca por cima do estado — conta à parte, e aparece no separador dela", () => {
    const linhas = [
      naMesa(conversa({ telefone: "351910000001", ultimaEntrada: entrada(1, "Olá", 5 * H), guardada: { nota: "ligar amanhã", quando: "x" } })),
      naMesa(conversa({ telefone: "351910000002", ultimaEntrada: entrada(2, "Então?", H) })),
      naMesa(conversa({ telefone: "351910000003", ultimaSaida: saida(3, "x", H) })),
    ];
    const c = contarNaMesa(linhas);
    expect(c.por_responder).toBe(2);
    expect(c.a_espera).toBe(1);
    expect(c.guardada).toBe(1);
    expect(linhasDoSeparador(linhas, "guardada").map((l) => l.telefone)).toEqual(["351910000001"]);
    expect(linhasDoSeparador(linhas, "guardada")[0].guardada?.nota).toBe("ligar amanhã");
  });

  it("mas as que esperam há mais de 3 dias vêm depois das de hoje, das mais recentes para as velhas", () => {
    /*
     * No primeiro dia a lista abriu com conversas de há 41 dias — respondidas
     * à mão antes de a ponte guardar essas respostas — e as de hoje ficavam
     * no fundo (21-10-2026).
     */
    const linhas = [
      naMesa(conversa({ telefone: "351910000001", ultimaEntrada: entrada(1, "Sim obrigada", 41 * 24 * H) })),
      naMesa(conversa({ telefone: "351910000002", ultimaEntrada: entrada(2, "Então?", 5 * H) })),
      naMesa(conversa({ telefone: "351910000003", ultimaEntrada: entrada(3, "Olá", 10 * 24 * H) })),
      naMesa(conversa({ telefone: "351910000004", ultimaEntrada: entrada(4, "Podemos prosseguir", 60) })),
    ];
    expect(linhasDoSeparador(linhas, "por_responder").map((l) => l.telefone)).toEqual([
      "351910000002",
      "351910000004",
      "351910000003",
      "351910000001",
    ]);
    expect(eEsperaAntiga({ haSegundos: 3 * 24 * H + 1 })).toBe(true);
    expect(eEsperaAntiga({ haSegundos: 3 * 24 * H })).toBe(false);
    const PAINEL = readFileSync(join(process.cwd(), "src/components/admin/AdminWhatsAppPanel.tsx"), "utf8");
    expect(PAINEL).toContain("Há mais de 3 dias");
  });

  it("no «Por responder», quem espera há mais tempo vem primeiro", () => {
    const linhas = [
      naMesa(conversa({ telefone: "351910000001", ultimaEntrada: entrada(1, "Olá", 10 * 60) })),
      naMesa(conversa({ telefone: "351910000002", ultimaEntrada: entrada(2, "Então?", 5 * H) })),
    ];
    expect(linhasDoSeparador(linhas, "por_responder").map((l) => l.telefone)).toEqual([
      "351910000002",
      "351910000001",
    ]);
  });
});

describe("as palavras do tempo", () => {
  it("agora mesmo, minutos, horas, dias", () => {
    expect(haQuanto(30)).toBe("agora mesmo");
    expect(haQuanto(5 * 60)).toBe("há 5 min");
    expect(haQuanto(2 * H + 5)).toBe("há 2 h");
    expect(haQuanto(26 * H)).toBe("há 1 dia");
    expect(haQuanto(3 * 24 * H)).toBe("há 3 dias");
  });
});

describe("as peças estão ligadas", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const ROTA = ler("src/app/api/admin/whatsapp/route.ts");
  const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");
  const DB = ler("src/lib/db.ts");

  it("a API devolve a mesa, e fecha, reabre e guarda", () => {
    expect(ROTA).toContain("mesaDasConversasWhatsApp().catch((e) => {");
    expect(ROTA).toMatch(/\bmesa,\s/);
    expect(ROTA).toContain('await arquivarConversaWhatsApp(telefone, true, { motivo: nota ?? null, porQuem: "equipa" });');
    expect(ROTA).toContain('case "reabrir":');
    expect(ROTA).toContain("await guardarConversaWhatsApp(telefone, true, nota ?? null);");
    expect(ROTA).toContain("await guardarConversaWhatsApp(telefone, false);");
  });

  it("o fecho guarda o porquê e quem — e apagar a conversa leva as marcas", () => {
    expect(DB).toContain("ALTER TABLE whatsappArquivadas ADD COLUMN motivo VARCHAR(300) NULL");
    expect(DB).toContain("ALTER TABLE whatsappArquivadas ADD COLUMN porQuem VARCHAR(20) NULL");
    expect(DB).toContain("ON DUPLICATE KEY UPDATE criadoEm = NOW(), motivo = VALUES(motivo), porQuem = VALUES(porQuem)");
    const i = DB.indexOf("export async function apagarConversaWhatsApp(");
    const corpo = DB.slice(i, DB.indexOf("\n}", i));
    expect(corpo).toContain("DELETE FROM whatsappGuardadas");
    expect(corpo).toContain("DELETE FROM whatsappLeituras");
  });

  it("o painel abre no «Por responder», e fecha com o porquê", () => {
    expect(PAINEL).toContain('useState<Separador>("por_responder")');
    expect(PAINEL).toContain("Porque fica resolvida?");
    expect(PAINEL).toContain("Guardar para continuar");
  });
});
