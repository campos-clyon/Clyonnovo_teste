import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AVISOS_DE_DATA_POR_PASSAGEM,
  MINUTOS_PARA_ASSENTAR,
  decidirAvisoDeData,
  eSoUmObrigado,
  quandoPorExtenso,
  textoDoAvisoDeData,
} from "./aviso-de-data-ao-cliente";
import { CAPACIDADES, FICHA_DA_CAPACIDADE, interruptoresPorOmissao } from "./assistente-interruptores";

/**
 * O CLIENTE FICA A SABER QUANDO O DIA DO TRABALHO MUDA.
 *
 * *«Sim, avise o cliente pelo WhatsApp.»* — 01-10-2026, depois de as agendas
 * passarem a deixar arrastar um trabalho para outro dia.
 *
 * As datas escrevem-se com fuso (`Z`): a mensagem diz as horas de Lisboa, e o
 * teste tem de dar o mesmo numa máquina em Lisboa, em França ou no Brasil.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/* Só os comentários que começam a linha — ver a memória dos testes que lêem o código. */
function semNotas(s: string): string {
  return s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
}

/* Quinta-feira, 1 de Outubro de 2026, 15:00 em Lisboa (Verão: UTC+1). */
const AGORA = new Date("2026-10-01T14:00:00Z");

describe("o dia por extenso, em Lisboa", () => {
  it("amanhã diz-se amanhã, e com o dia", () => {
    expect(quandoPorExtenso(new Date("2026-10-02T15:00:00Z"), AGORA)).toBe(
      "amanhã, sexta-feira, 2 de outubro, às 16:00",
    );
  });

  it("hoje diz-se hoje", () => {
    expect(quandoPorExtenso(new Date("2026-10-01T17:30:00Z"), AGORA)).toBe("hoje, às 18:30");
  });

  it("mais longe, só o dia", () => {
    expect(quandoPorExtenso(new Date("2026-10-06T08:00:00Z"), AGORA)).toBe("terça-feira, 6 de outubro, às 09:00");
  });

  it("meia-noite em ponto é um dia sem hora — não se inventa uma", () => {
    expect(quandoPorExtenso(new Date("2026-10-05T23:00:00Z"), AGORA)).toBe("terça-feira, 6 de outubro");
  });

  it("no Inverno Lisboa está em UTC", () => {
    expect(quandoPorExtenso(new Date("2026-12-10T14:00:00Z"), AGORA)).toBe("quinta-feira, 10 de dezembro, às 14:00");
  });

  it("perto da meia-noite, o dia é o de Lisboa", () => {
    /* 23:30 UTC do dia 1 já é dia 2 em Lisboa */
    expect(quandoPorExtenso(new Date("2026-10-01T23:30:00Z"), AGORA)).toBe(
      "amanhã, sexta-feira, 2 de outubro, às 00:30",
    );
  });
});

describe("a mensagem", () => {
  const base = { pedidoId: 402, cliente: "Carla Mendes", servico: "recolha_entulho" };

  it("mudou de dia: diz o novo primeiro, e o que ele sabia entre parênteses", () => {
    const t = textoDoAvisoDeData(
      { ...base, antes: new Date("2026-10-01T08:00:00Z"), depois: new Date("2026-10-02T15:00:00Z") },
      AGORA,
    );
    expect(t).toContain("Carla");
    expect(t).toContain("Aqui é a CLYON.");
    expect(t).toContain(
      "A sua recolha de entulho (pedido #402) mudou de dia: fica para amanhã, sexta-feira, 2 de outubro, às 16:00 " +
        "(antes era hoje, às 09:00).",
    );
    expect(t).toContain("Se não lhe der jeito, responda a esta mensagem.");
    expect(t).not.toContain("Mendes");
  });

  it("mudou só a hora: o dia diz-se uma vez", () => {
    const t = textoDoAvisoDeData(
      { ...base, antes: new Date("2026-10-06T08:00:00Z"), depois: new Date("2026-10-06T13:00:00Z") },
      AGORA,
    );
    expect(t).toContain("mudou de hora: fica para terça-feira, 6 de outubro, às 14:00 (antes era às 09:00).");
  });

  it("ainda não sabia dia nenhum: «já tem dia»", () => {
    const t = textoDoAvisoDeData({ ...base, antes: null, depois: new Date("2026-10-06T08:00:00Z") }, AGORA);
    expect(t).toContain("A sua recolha de entulho (pedido #402) já tem dia: terça-feira, 6 de outubro, às 09:00.");
  });

  it("o artigo vem do serviço, e um serviço desconhecido não diz «pedido» duas vezes", () => {
    const esvaziar = textoDoAvisoDeData(
      { ...base, servico: "esvaziamento_apartamento", antes: null, depois: new Date("2026-10-06T08:00:00Z") },
      AGORA,
    );
    expect(esvaziar).toContain("O seu esvaziamento de apartamento (pedido #402)");
    const sem = textoDoAvisoDeData({ ...base, servico: null, antes: null, depois: new Date("2026-10-06T08:00:00Z") }, AGORA);
    expect(sem).toContain("O seu pedido #402 já tem dia");
  });

  it("sem nome, cumprimenta na mesma", () => {
    const t = textoDoAvisoDeData({ ...base, cliente: null, antes: null, depois: new Date("2026-10-06T08:00:00Z") }, AGORA);
    expect(t.startsWith("Boa tarde. Aqui é a CLYON.")).toBe(true);
  });
});

describe("avisa-se, ou não", () => {
  const trabalho = {
    dataCombinada: new Date("2026-10-02T15:00:00Z"),
    conhecida: new Date("2026-10-01T08:00:00Z"),
    estado: "acordada",
    estadoDoPedido: "em_curso",
    confirmadoEm: null,
    pagoEm: null,
    execucaoEnviadaEm: null,
  };

  it("um trabalho em curso que mudou de dia: avisa", () => {
    expect(decidirAvisoDeData(trabalho, AGORA)).toEqual({ avisar: true });
  });

  it("um arrasto desfeito — voltou ao dia que ele sabia — não diz nada", () => {
    expect(decidirAvisoDeData({ ...trabalho, dataCombinada: new Date("2026-10-01T08:00:30Z") }, AGORA)).toEqual({
      avisar: false,
      porque: "igual",
    });
  });

  it("desmarcado não é notícia que se mande", () => {
    expect(decidirAvisoDeData({ ...trabalho, dataCombinada: null }, AGORA)).toEqual({
      avisar: false,
      porque: "desmarcado",
    });
  });

  it("cancelado, desistido, feito ou pago: já não se avisa", () => {
    for (const mudanca of [
      { estado: "cancelada" },
      { estadoDoPedido: "cancelado" },
      { estadoDoPedido: "concluido" },
      { execucaoEnviadaEm: new Date() },
      { confirmadoEm: new Date() },
      { pagoEm: new Date() },
    ]) {
      expect(decidirAvisoDeData({ ...trabalho, ...mudanca }, AGORA)).toEqual({
        avisar: false,
        porque: "fora_de_curso",
      });
    }
  });

  it("um dia que já passou é acertar o registo, não avisar", () => {
    expect(decidirAvisoDeData({ ...trabalho, dataCombinada: new Date("2026-09-30T08:00:00Z") }, AGORA)).toEqual({
      avisar: false,
      porque: "ja_passou",
    });
  });

  it("assenta uns minutos, e poucos de cada vez", () => {
    expect(MINUTOS_PARA_ASSENTAR).toBeGreaterThanOrEqual(2);
    expect(MINUTOS_PARA_ASSENTAR).toBeLessThanOrEqual(10);
    expect(AVISOS_DE_DATA_POR_PASSAGEM).toBeLessThanOrEqual(10);
  });
});

describe("o interruptor", () => {
  it("existe, diz o que pára, e nasce ligado porque o dono o pediu", () => {
    expect(CAPACIDADES).toContain("avisar_data");
    expect(FICHA_DA_CAPACIDADE.avisar_data.oQuePara).toContain("cliente");
    expect(interruptoresPorOmissao().avisar_data).toBe(true);
  });
});

describe("as duas rotas registam, e a passagem envia", () => {
  const ADMIN = semNotas(ler("src/app/api/admin/agenda/route.ts"));
  const PRO = semNotas(ler("src/app/api/profissionais/agenda/route.ts"));
  const PASSAGEM = semNotas(ler("src/lib/assistente-automatico.ts"));
  const DB = semNotas(ler("src/lib/db.ts"));

  it.each([
    ["do backoffice", ADMIN],
    ["do profissional", PRO],
  ])("a rota %s regista DEPOIS de gravar, e só se o dia mudou", (_n, src) => {
    const gravar = src.indexOf("UPDATE negociacoes SET dataCombinada");
    const registar = src.indexOf("await registarMudancaDeData({ negociacaoId, pedidoId: linha.pedidoId, antes });");
    expect(gravar).toBeGreaterThan(0);
    expect(registar).toBeGreaterThan(gravar);
    expect(src).toContain("if ((antes?.getTime() ?? null) !== (quando?.getTime() ?? null)) {");
  });

  it("a passagem tem o seu interruptor, a hora de falar, e corre antes de «com tudo em baixo»", () => {
    const i = PASSAGEM.indexOf('if (podeFazer("avisar_data") && horaDeFalar(agora)) {');
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(PASSAGEM.indexOf("const precisaDosPedidos ="));
    const bloco = PASSAGEM.slice(i, PASSAGEM.indexOf("const precisaDosPedidos ="));
    expect(bloco).toContain("enviarAvisoWhatsApp(telefone, texto)");
    expect(bloco).toContain("telemovelParaWhatsApp(a.telefoneDoCliente)");
    expect(bloco).toContain("decidirAvisoDeData(a, agora)");
    /* Fecha a volta que leu, e só essa. */
    expect(bloco).toContain("db.fecharAvisoDeData(a.negociacaoId, a.versao,");
  });

  it("a base guarda o que o cliente sabia ANTES de reabrir a volta", () => {
    const i = DB.indexOf("INSERT INTO avisosDeDataAoCliente");
    const sql = DB.slice(i, DB.indexOf("[dados.negociacaoId", i));
    const conhecida = sql.indexOf("conhecida = IF(fechadoEm IS NULL, conhecida, VALUES(conhecida))");
    expect(conhecida).toBeGreaterThan(0);
    expect(conhecida).toBeLessThan(sql.indexOf("fechadoEm = NULL"));
    expect(sql).toContain("versao = versao + 1");
    /* Sem dataCombinada antes, o que ele sabia era o dia que ele próprio pediu. */
    expect(sql).toContain("COALESCE(?, (SELECT o.dataAgendada FROM simulatorOrders o WHERE o.id = ?))");
  });

  it("fechar só fecha a versão lida", () => {
    const i = DB.indexOf("export async function fecharAvisoDeData(");
    expect(DB.slice(i, i + 900)).toContain("WHERE negociacaoId = ? AND versao = ? AND fechadoEm IS NULL");
  });
});

describe("quando ele responde ao aviso", () => {
  it("um obrigado fica por ali", () => {
    for (const t of ["ok", "Ok!", "obrigada", "Muito obrigado 🙏", "Está bem", "ta bem 👍", "Combinado.", "👍", "Perfeito, obrigado!", "sim"]) {
      expect(eSoUmObrigado(t), t).toBe(true);
    }
  });

  it("o resto vai para uma pessoa", () => {
    for (const t of [
      "Esse dia não me dá jeito",
      "Ok, mas pode ser às 10?",
      "Pode ser na segunda?",
      "Não posso",
      "obrigado mas não vou estar em casa",
      "Quero cancelar",
    ]) {
      expect(eSoUmObrigado(t), t).toBe(false);
    }
  });

  it("a guarda vem logo a seguir à da paciência, antes de o cérebro ler o que quer que seja", () => {
    const NEG = semNotas(ler("src/lib/whatsapp-negociacao.ts"));
    const i = NEG.indexOf("export async function tratarMensagemDoCliente(");
    const corpo = NEG.slice(i);
    const paciencia = corpo.indexOf("estaAPerderAPaciencia(conteudo.texto)");
    const guarda = corpo.indexOf("avisoDeDataRecente(telefone, HORAS_PARA_RESPONDER_AO_AVISO)");
    const cerebro = corpo.indexOf("pedidosDoTelefone(telefone)");
    expect(paciencia).toBeGreaterThan(0);
    expect(guarda).toBeGreaterThan(paciencia);
    expect(guarda).toBeLessThan(cerebro);
    const bloco = corpo.slice(guarda, cerebro);
    expect(bloco).toContain("if (eSoUmObrigado(conteudo.texto)) return;");
    expect(bloco).toContain("passarAUmaPessoa(");
    expect(bloco).toContain("RESPOSTA_A_QUEM_RESPONDEU_AO_AVISO");
  });

  it("só conta o aviso que saiu, e por telefone", () => {
    const DB = semNotas(ler("src/lib/db.ts"));
    const i = DB.indexOf("export async function avisoDeDataRecente(");
    const corpo = DB.slice(i, i + 1500);
    expect(corpo).toContain("a.porqueNaoSaiu IS NULL");
    expect(corpo).toContain("a.fechadoEm >= NOW() - INTERVAL ? HOUR");
  });
});
