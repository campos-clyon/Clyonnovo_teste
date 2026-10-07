import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * QUEM JÁ TEM O TRABALHO FICA A SABER DA EDIÇÃO — 07-10-2026.
 *
 * *«Sim, avisa por WhatsApp»*, à pergunta: «quando o trabalho já está
 * atribuído e mudas a data ou a morada, o profissional não recebe aviso».
 *
 * Prova-se contra uma base e um WhatsApp falsos: a quem chega, o que muda no
 * trabalho dele, quando não sai nada — e que o primeiro dia marcado, num
 * trabalho que ainda não tinha dia nenhum, também é avisado.
 */

const estado = {
  linha: null as null | {
    id: number;
    dataCombinada: Date | null;
    profissionalNome: string;
    profissionalTelefone: string | null;
  },
  sql: [] as Array<{ sql: string; params: unknown[] }>,
  ligado: true,
  enviados: [] as Array<{ para: string; texto: string }>,
  registos: [] as unknown[],
  historia: [] as string[],
};

vi.mock("./db", () => ({
  getPool: async () => ({
    execute: async (sql: string, params: unknown[] = []) => {
      estado.sql.push({ sql, params });
      if (sql.includes("FROM negociacoes n JOIN providers p")) return [estado.linha ? [estado.linha] : [], null];
      return [{}, null];
    },
  }),
  assistentePode: async (c: string) => c === "avisar_profissional" && estado.ligado,
  registarMudancaDeData: async (d: unknown) => {
    estado.registos.push(d);
  },
  appendOrderHistory: async (_id: number, e: { message: string }) => {
    estado.historia.push(e.message);
  },
}));

vi.mock("./whatsapp-cloud", () => ({
  telemovelParaWhatsApp: (t: string | null) => (t && /^(351)?9\d{8}$/.test(t) ? (t.startsWith("351") ? t : `351${t}`) : null),
  enviarAvisoWhatsApp: async (para: string, texto: string) => {
    estado.enviados.push({ para, texto });
    return true;
  },
}));

const { avisarQuemTemOTrabalho, moradaPorExtenso } = await import("./avisar-quem-tem-o-trabalho");
const { textoDoAvisoDeMoradaAoProfissional } = await import("./aviso-de-morada-ao-profissional");

const PEDIDO = {
  id: 417,
  serviceType: "recolha_entulho",
  city: "Quinta do Conde",
  postalCode: "2975-000",
  address: "Rua das Acácias, 12",
  dataAgendada: new Date("2026-10-10T08:00:00.000Z"),
  rawOrderJson: "{}",
} as never;

const avisar = (mudou: string[], diaAntesDaEdicao: Date | null = null, pedido = PEDIDO) =>
  avisarQuemTemOTrabalho({ pedido, mudou, diaAntesDaEdicao, baseUrl: "https://clyon.pt" });

beforeEach(() => {
  estado.linha = { id: 2001, dataCombinada: null, profissionalNome: "Ana Sousa Recolhas", profissionalTelefone: "912345678" };
  estado.sql = [];
  estado.ligado = true;
  estado.enviados = [];
  estado.registos = [];
  estado.historia = [];
});

describe("a quem chega", () => {
  it("sem mudança de dia nem de morada, nem se pergunta à base", async () => {
    expect(await avisar(["description", "fotografias"])).toBeNull();
    expect(estado.sql).toEqual([]);
  });

  it("só ao contratado, e só com o trabalho por fazer", async () => {
    await avisar(["address"]);
    const consulta = estado.sql[0].sql;
    expect(consulta).toContain("n.estado = 'acordada'");
    expect(consulta).toContain("n.execucaoEnviadaEm IS NULL AND n.confirmadoEm IS NULL AND n.pagoEm IS NULL");
    expect(estado.sql[0].params).toEqual([417]);
  });

  it("sem ninguém contratado, não sai nada", async () => {
    estado.linha = null;
    expect(await avisar(["address", "dataAgendada"])).toBeNull();
    expect(estado.enviados).toEqual([]);
    expect(estado.registos).toEqual([]);
  });
});

describe("o dia", () => {
  it("o primeiro dia marcado passa para o trabalho dele e regista-se — com «antes» nenhum, mesmo", async () => {
    // O #417: «Sem dia». A dataAgendada da base já é a nova quando isto corre,
    // e sem `antesJaLido` a base ia buscá-la e dava o dia novo como o velho.
    const r = await avisar(["dataAgendada"], null);
    const update = estado.sql.find((s) => s.sql.startsWith("UPDATE negociacoes SET dataCombinada"));
    expect(update?.params).toEqual([new Date("2026-10-10T08:00:00.000Z"), 2001]);
    expect(estado.registos).toEqual([
      { negociacaoId: 2001, pedidoId: 417, antes: null, porQuem: "clyon", antesJaLido: true },
    ]);
    expect(r).toMatchObject({ profissional: "Ana Sousa Recolhas", dia: true, morada: null, avisosLigados: true });
    // O WhatsApp do dia sai pela passagem do assistente, e não daqui.
    expect(estado.enviados).toEqual([]);
  });

  it("o «antes» é o dia que ele tinha: o combinado, se havia", async () => {
    estado.linha!.dataCombinada = new Date("2026-10-08T09:00:00.000Z");
    await avisar(["dataAgendada"], new Date("2026-10-06T09:00:00.000Z"));
    expect(estado.registos[0]).toMatchObject({ antes: new Date("2026-10-08T09:00:00.000Z") });
  });

  it("o dia «novo» igual ao que ele já tinha não é notícia", async () => {
    estado.linha!.dataCombinada = new Date("2026-10-10T08:00:00.000Z");
    expect(await avisar(["dataAgendada"], new Date("2026-10-06T09:00:00.000Z"))).toBeNull();
    expect(estado.registos).toEqual([]);
    expect(estado.sql.some((s) => s.sql.startsWith("UPDATE"))).toBe(false);
  });

  it("apagar o dia não desmarca o trabalho dele", async () => {
    // A edição põe a dataAgendada a nulo quando o dia já passou há mais de uma
    // hora. Isso não é a CLYON a desmarcar o trabalho.
    const semDia = { ...(PEDIDO as object), dataAgendada: null } as never;
    expect(await avisar(["dataAgendada"], new Date("2026-10-06T09:00:00.000Z"), semDia)).toBeNull();
    expect(estado.sql).toEqual([]);
  });
});

describe("a morada", () => {
  it("sai já, para o telemóvel dele, com a morada nova por extenso", async () => {
    const r = await avisar(["address", "postalCode"]);
    expect(r?.morada).toBe("saiu");
    expect(estado.enviados).toHaveLength(1);
    expect(estado.enviados[0].para).toBe("351912345678");
    expect(estado.enviados[0].texto).toContain("Rua das Acácias, 12, 2975-000 Quinta do Conde");
    expect(estado.historia[0]).toContain("foi avisado por WhatsApp da morada nova");
  });

  it("com o interruptor do dono desligado não sai — e o ecrã diz porquê", async () => {
    estado.ligado = false;
    const r = await avisar(["address"]);
    expect(r).toMatchObject({ morada: "desligado", avisosLigados: false });
    expect(estado.enviados).toEqual([]);
  });

  it("sem telemóvel português na ficha não sai", async () => {
    estado.linha!.profissionalTelefone = "212345678";
    expect((await avisar(["city"]))?.morada).toBe("sem_telemovel");
    expect(estado.enviados).toEqual([]);
  });

  it("numa mudança, o destino novo também", async () => {
    const mudanca = {
      ...(PEDIDO as object),
      serviceType: "mudanca",
      rawOrderJson: JSON.stringify({ destinationAddress: { formattedAddress: "Rua do Ouro 3, Lisboa" } }),
    } as never;
    await avisar(["destino"], null, mudanca);
    expect(estado.enviados[0].texto).toContain("a entrega passa a ser em Rua do Ouro 3, Lisboa");
  });

  it("dia e morada na mesma edição: a morada sai já, o dia fica para a passagem", async () => {
    const r = await avisar(["address", "dataAgendada"]);
    expect(r).toMatchObject({ dia: true, morada: "saiu" });
    expect(estado.enviados).toHaveLength(1);
    expect(estado.registos).toHaveLength(1);
  });
});

describe("o texto", () => {
  const agora = new Date("2026-10-07T10:00:00.000Z");
  const texto = textoDoAvisoDeMoradaAoProfissional(
    {
      pedidoId: 417,
      profissional: "Ana Sousa Recolhas",
      servico: "recolha_entulho",
      localidade: "Quinta do Conde",
      morada: "Rua das Acácias, 12, 2975-000 Quinta do Conde",
      destino: null,
      link: "https://clyon.pt/profissionais/painel",
    },
    agora,
  );

  it("diz quem fala, de que trabalho, a morada nova e onde a ver", () => {
    expect(texto).toContain("Aqui é a CLYON — aviso de morada.");
    expect(texto).toContain("#417");
    expect(texto).toContain("Quinta do Conde");
    expect(texto).toContain("passa a ser em Rua das Acácias, 12, 2975-000 Quinta do Conde.");
    expect(texto).toContain("https://clyon.pt/profissionais/painel");
  });

  it("só o primeiro nome, e sem «parar» — é o trabalho dele, não uma oferta", () => {
    expect(texto).toContain("Ana.");
    expect(texto).not.toContain("Sousa");
    expect(texto.toLowerCase()).not.toContain("parar");
  });

  it("a morada por extenso não repete a localidade que já lá está", () => {
    expect(moradaPorExtenso({ address: "Rua A 1, Quinta do Conde", postalCode: "2975-000", city: "Quinta do Conde" })).toBe(
      "Rua A 1, Quinta do Conde",
    );
    expect(moradaPorExtenso({ address: "Rua A 1", postalCode: "2975-000", city: "Quinta do Conde" })).toBe(
      "Rua A 1, 2975-000 Quinta do Conde",
    );
    expect(moradaPorExtenso({ address: "", postalCode: "", city: "" })).toBeNull();
  });
});

describe("as ligações", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
  const semNotas = (s: string) =>
    s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
  const ROTA = semNotas(ler("src/app/api/admin/pedidos/[id]/editar/route.ts"));
  const DB = semNotas(ler("src/lib/db.ts"));
  const FORMULARIO = semNotas(ler("src/components/admin/RegistarPedido.tsx"));

  it("a edição chama-o depois de gravar, com o dia de ANTES, e devolve o que se disse", () => {
    const i = ROTA.indexOf("await avisarQuemTemOTrabalho({");
    expect(i).toBeGreaterThan(ROTA.indexOf("const depoisDeGravar = await getSimulatorOrderById(pedidoId);"));
    expect(ROTA.slice(i, i + 300)).toContain(
      "diaAntesDaEdicao: pedido.dataAgendada ? new Date(pedido.dataAgendada) : null,",
    );
    expect(ROTA).toContain("avisoAoProfissional,");
  });

  it("a base só deixa de ir buscar o «antes» a quem disse que já o leu", () => {
    expect(DB).toContain("if (!antes && !dados.antesJaLido) {");
  });

  it("o ecrã mostra-o logo a seguir a gravar", () => {
    expect(FORMULARIO).toContain("{r.avisoAoProfissional && <AvisoAQuemTemOTrabalhoNoEcra a={r.avisoAoProfissional} />}");
    expect(FORMULARIO).toContain('import type { AvisoAQuemTemOTrabalho } from "@/lib/avisar-quem-tem-o-trabalho";');
  });
});
