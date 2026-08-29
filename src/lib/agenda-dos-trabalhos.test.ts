import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { naAgenda, PESO_NA_AGENDA, quandoPorExtenso } from "./agenda-dos-trabalhos";

/**
 * A agenda: quando é o trabalho, e se já passou do dia.
 *
 * "Quero uma agenda para o admin acompanhar as datas e horários dos trabalhos,
 * para saber se os trabalhos estão no horário ou não. Também deve ter a opção
 * do pro corrigir a sua agenda, podendo alterar horário e data."
 */

/* Sábado, 29 de agosto de 2026, às 15:00 em Lisboa. */
const AGORA = new Date("2026-08-29T14:00:00.000Z");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("qual das duas datas manda", () => {
  it("a combinada ganha à que o cliente pediu", () => {
    /*
     * `dataAgendada` é o que o CLIENTE pediu e fica como está: é a promessa
     * que lhe foi feita. `dataCombinada` é o que os dois marcaram DEPOIS de
     * fechar, e é a que manda na agenda.
     */
    const a = naAgenda(
      { dataAgendada: "2026-08-27T09:00:00Z", dataCombinada: "2026-09-05T09:00:00Z" },
      AGORA,
    );
    expect(a.origem).toBe("combinada");
    expect(a.estado).toBe("por_vir");
  });

  it("sem combinada, vale a do cliente — e diz-se que é dele", () => {
    // O ecrã tem de poder avisar que aquilo ainda não foi confirmado com
    // ninguém: é uma data pedida, não uma data marcada.
    const a = naAgenda({ dataAgendada: "2026-09-05T09:00:00Z" }, AGORA);
    expect(a.origem).toBe("do_cliente");
  });

  it("sem nenhuma das duas, fica por combinar", () => {
    const a = naAgenda({}, AGORA);
    expect(a.estado).toBe("sem_data");
    expect(a.origem).toBe("nenhuma");
    expect(a.quando).toBeNull();
  });
});

describe("está no horário, ou não", () => {
  it("o dia passou e ninguém deu por feito — atrasado, com os dias contados", () => {
    const a = naAgenda({ dataCombinada: "2026-08-26T09:00:00Z" }, AGORA);
    expect(a.estado).toBe("atrasado");
    expect(a.diasDeAtraso).toBe(3);
  });

  it("é hoje, e a hora já passou — mas isso NÃO é atraso", () => {
    /*
     * Um trabalho das 9h às 15h da tarde pode estar a decorrer, e a prova
     * chega quase sempre ao fim do dia. Pintá-lo de vermelho seria dar um
     * alarme por cada trabalho da manhã.
     */
    const a = naAgenda({ dataCombinada: "2026-08-29T08:00:00Z" }, AGORA);
    expect(a.estado).toBe("hoje");
    expect(a.horaJaPassou).toBe(true);
    expect(a.diasDeAtraso).toBe(0);
  });

  it("é hoje e ainda falta — não há nada a assinalar", () => {
    const a = naAgenda({ dataCombinada: "2026-08-29T18:00:00Z" }, AGORA);
    expect(a.estado).toBe("hoje");
    expect(a.horaJaPassou).toBe(false);
  });

  it("feito GANHA a tudo, mesmo entregue depois do dia", () => {
    /*
     * Um trabalho entregue no dia seguinte ao marcado está feito, e não
     * atrasado: pintá-lo de vermelho para sempre transformava o histórico
     * numa lista de queixas. O atraso interessa enquanto há o que fazer.
     */
    for (const marca of ["execucaoEnviadaEm", "confirmadoEm", "pagoEm"] as const) {
      const a = naAgenda(
        { dataCombinada: "2026-08-20T09:00:00Z", [marca]: "2026-08-25T20:00:00Z" },
        AGORA,
      );
      expect(a.estado).toBe("feito");
      expect(a.diasDeAtraso).toBe(0);
    }
  });

  it("uma data que não se percebe é como não ter data", () => {
    expect(naAgenda({ dataCombinada: "isto não é uma data" }, AGORA).estado).toBe("sem_data");
  });
});

describe("a ordem por que se olha para isto", () => {
  it("é por urgência, e não cronológica", () => {
    /*
     * Cronológica punha o trabalho de daqui a três semanas por cima do que
     * passou do dia a semana passada — e é este que precisa de um telefonema.
     * «Sem data» vem depois de «hoje»: é um atraso que ainda não começou.
     */
    expect(PESO_NA_AGENDA.atrasado).toBeLessThan(PESO_NA_AGENDA.hoje);
    expect(PESO_NA_AGENDA.hoje).toBeLessThan(PESO_NA_AGENDA.sem_data);
    expect(PESO_NA_AGENDA.sem_data).toBeLessThan(PESO_NA_AGENDA.por_vir);
    expect(PESO_NA_AGENDA.por_vir).toBeLessThan(PESO_NA_AGENDA.feito);
  });
});

describe("como se diz a data", () => {
  it("hoje, amanhã e ontem por palavras; o resto por extenso", () => {
    const dizer = (iso: string) => quandoPorExtenso(naAgenda({ dataCombinada: iso }, AGORA), AGORA);
    expect(dizer("2026-08-29T10:00:00Z")).toContain("hoje");
    expect(dizer("2026-08-30T10:00:00Z")).toContain("amanhã");
    expect(dizer("2026-08-28T10:00:00Z")).toContain("ontem");
    expect(dizer("2026-09-04T10:00:00Z")).toContain("setembro");
  });

  it("a hora é a de Lisboa, e não a de quem lê", () => {
    // O trabalho é às onze em Lisboa mesmo que ele esteja em Espanha.
    expect(quandoPorExtenso(naAgenda({ dataCombinada: "2026-08-29T10:00:00Z" }, AGORA), AGORA)).toContain(
      "11:00",
    );
  });

  it("meia-noite não é hora nenhuma", () => {
    // É o que sobra de um dia gravado sem hora.
    const f = quandoPorExtenso(naAgenda({ dataCombinada: "2026-08-29T23:00:00Z" }, AGORA), AGORA);
    expect(f).not.toContain("00:00");
  });

  it("sem data, diz-se isso", () => {
    expect(quandoPorExtenso(naAgenda({}, AGORA), AGORA)).toBe("sem dia marcado");
  });
});

describe("o profissional marca o dia", () => {
  const ROTA = ler("src/app/api/profissionais/agenda/route.ts");

  it("a negociação tem de ser DELE — o id sai da sessão e entra no WHERE", () => {
    // Sem isto, bastava mudar um número no corpo para remarcar o trabalho de
    // outra pessoa.
    expect(ROTA).toContain("WHERE id = ? AND providerId = ? LIMIT 1");
    expect(ROTA).toContain("[negociacaoId, sessao.providerId]");
    expect(ROTA).toContain("SET dataCombinada = ? WHERE id = ? AND providerId = ?");
  });

  it("NÃO escreve por cima do que o cliente pediu", () => {
    // É essa diferença que deixa ver «pedido para quinta, marcado para sábado».
    expect(ROTA).toContain("dataCombinada");
    expect(ROTA).not.toContain("dataAgendada =");
  });

  it("só marca um trabalho que já é dele", () => {
    expect(ROTA).toContain('linha.estado !== "acordada"');
  });

  it("depois de confirmado, a data já não se muda", () => {
    // Deixou de ser um plano e passou a ser o registo do que aconteceu.
    expect(ROTA).toContain("linha.confirmadoEm || linha.pagoEm");
  });

  it("vazio DESMARCA, em vez de dar erro", () => {
    // É o que ele faz quando o cliente adia sem dizer quando.
    expect(ROTA).toContain("let quando: Date | null = null;");
  });

  it("tem tecto — o campo deixa escrever o ano 2206 sem se dar por isso", () => {
    expect(ROTA).toContain("2 * 365 * 86_400_000");
  });

  it("fica registado quem mudou, de quando para quando", () => {
    expect(ROTA).toContain("appendOrderHistory");
    expect(ROTA).toContain('acontecimento: "agenda_marcada"');
    expect(ROTA).toContain("(estava ${fmt(antes)})");
  });
});

describe("o caminho da data combinada", () => {
  const DB = ler("src/lib/db.ts");

  it("a coluna existe, e as duas consultas trazem-na", () => {
    expect(DB).toContain("ADD COLUMN dataCombinada DATETIME NULL DEFAULT NULL");
    expect(DB).toContain("n.abertoProfissionalEm, n.dataCombinada,");
    expect(DB).toContain("n.estrelas, n.avaliadoEm, n.dataCombinada,");
  });

  it("chega ao painel do profissional — rota, tipo e ecrã", () => {
    expect(ler("src/app/api/profissionais/meus-pedidos/route.ts")).toContain("dataCombinada:");
    expect(ler("src/app/profissionais/painel/tipos.ts")).toContain("dataCombinada?: string | null;");
    expect(ler("src/app/profissionais/painel/Trabalhos.tsx")).toContain("<MarcarODia pedido={pedido}");
  });

  it("a agenda DELE lê a data combinada, e por uma função só", () => {
    /*
     * Sete sítios liam `dataAgendada` directamente. Se continuassem, ele
     * marcava sábado e continuava a ver quinta — e sete leituras espalhadas
     * divergem no dia em que alguém corrige seis.
     */
    const AG = ler("src/app/profissionais/painel/Agenda.tsx");
    expect(AG).toContain("function quandoE(p: Pedido): string | null {");
    expect(AG).toContain("return p.dataCombinada ?? p.dataAgendada ?? null;");
    // Fora da própria função, ninguém volta a ler a coluna crua.
    const forasDaFuncao = AG.split("function quandoE")[1].split("}")[0];
    expect(forasDaFuncao).toContain("dataCombinada");
  });
});

describe("a agenda do backoffice", () => {
  const ROTA = ler("src/app/api/admin/agenda/route.ts");
  const PAINEL = ler("src/components/admin/AdminAgendaPanel.tsx");

  it("é do admin, e só lista o que está contratado", () => {
    // Uma negociação a decorrer não tem data para acompanhar: tem uma proposta
    // à espera de resposta, e isso já tem ecrã.
    expect(ROTA).toContain("requireAdmin(req)");
    expect(ROTA).toContain("n.estado = 'acordada'");
  });

  it("deixa de fora os pedidos cancelados", () => {
    expect(ROTA).toContain("o.status <> 'cancelado'");
  });

  it("manda as DUAS datas separadas para o ecrã", () => {
    // Ver «pedido para quinta, combinado para sábado» é metade da razão de
    // existir desta agenda.
    expect(ROTA).toContain("dataCombinada:");
    expect(ROTA).toContain("dataDoCliente:");
    expect(PAINEL).toContain("O cliente tinha pedido");
  });

  it("o estado vem da mesma função de sempre, e não de um cálculo à parte", () => {
    expect(ROTA).toContain('import { naAgenda } from "@/lib/agenda-dos-trabalhos"');
  });

  it("ordena por urgência e não por data", () => {
    expect(PAINEL).toContain("PESO_NA_AGENDA[a.estado] - PESO_NA_AGENDA[b.estado]");
  });

  it("dá os dois telefones, que é o que ele vem cá fazer", () => {
    // Quem chega aqui já sabe o que quer: ligar a um dos dois e perguntar.
    expect(PAINEL).toContain("tel:${t.profissionalTelefone}");
    expect(PAINEL).toContain("tel:${t.clienteTelefone}");
  });

  it("está no menu, no grupo da Plataforma", () => {
    const MENU = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(MENU).toContain('agenda: "Agenda"');
    expect(MENU).toContain('"agenda", "whatsapp"');
    expect(MENU).toContain("<AdminAgendaPanel />");
  });
});
