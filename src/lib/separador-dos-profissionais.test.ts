import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  contarNaMesa,
  linhasDoSeparador,
  naMesa,
  SEPARADORES_DA_MESA,
  type FactosDaConversa,
  type MensagemDaMesa,
} from "./mesa-das-conversas";

/**
 * O SEPARADOR «PROFISSIONAIS» DA MESA DO WHATSAPP — 13-11-2026 (decisão d21).
 *
 * Nos 7 dias até 13/11, 62 das 68 respostas a profissionais foram à mão e 12
 * vezes esperaram mais de 4 h: no meio dos clientes, perdiam-se. O separador
 * junta as conversas de quem tem ficha de profissional (pelo telefone), com a
 * mesma regra de quem falou por último, e o selo conta as por responder. As
 * conversas continuam também no separador do seu estado.
 */

const H = 3600;
const entrada = (id: number, texto: string, haSegundos: number): MensagemDaMesa => ({
  id,
  direccao: "in",
  texto,
  haSegundos,
  quando: "2026-11-13 10:00:00",
});
const saida = (id: number, texto: string, haSegundos: number): MensagemDaMesa => ({
  id,
  direccao: "out",
  texto,
  haSegundos,
  quando: "2026-11-13 10:00:00",
});
const conversa = (f: Partial<FactosDaConversa>): FactosDaConversa => ({
  telefone: "351910000008",
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
const PRO = { id: 7, nome: "Profissional de teste" };

describe("o separador «Profissionais»", () => {
  const linhas = [
    // Profissional que escreveu por último — por responder.
    naMesa(conversa({ telefone: "351910000001", ultimaEntrada: entrada(1, "Qual é o valor a passar?", 5 * H), profissional: PRO })),
    // Outro profissional, por responder há menos tempo.
    naMesa(conversa({ telefone: "351910000002", ultimaEntrada: entrada(2, "A referência não deu", H), profissional: { id: 8, nome: "" } })),
    // Profissional a quem já respondemos — à espera dele.
    naMesa(conversa({ telefone: "351910000003", ultimaSaida: saida(3, "Já está tratado.", 2 * H), profissional: { id: 9, nome: "" } })),
    // Um cliente por responder — não é deste separador.
    naMesa(conversa({ telefone: "351910000004", ultimaEntrada: entrada(4, "Olá, quanto custa?", 3 * H) })),
  ];

  it("existe, a seguir às guardadas, com a frase para quando está vazio", () => {
    const ids = SEPARADORES_DA_MESA.map((s) => s.id);
    expect(ids).toContain("profissionais");
    expect(ids.indexOf("profissionais")).toBe(ids.indexOf("guardada") + 1);
    const s = SEPARADORES_DA_MESA.find((x) => x.id === "profissionais")!;
    expect(s.titulo).toBe("Profissionais");
    expect(s.vazio.length).toBeGreaterThan(0);
  });

  it("o selo conta só os profissionais por responder", () => {
    const c = contarNaMesa(linhas);
    expect(c.profissionais).toBe(2);
    // E os clientes continuam contados onde estavam.
    expect(c.por_responder).toBe(3);
  });

  it("junta só os profissionais — por responder primeiro (quem espera há mais tempo à frente), depois os outros", () => {
    expect(linhasDoSeparador(linhas, "profissionais").map((l) => l.telefone)).toEqual([
      "351910000001",
      "351910000002",
      "351910000003",
    ]);
  });

  it("não os esconde do separador do estado deles", () => {
    expect(linhasDoSeparador(linhas, "por_responder").map((l) => l.telefone)).toContain("351910000001");
    expect(linhasDoSeparador(linhas, "a_espera").map((l) => l.telefone)).toContain("351910000003");
  });

  it("a mesma regra de quem falou por último: o «Já respondi» tira-o do selo", () => {
    const l = naMesa(
      conversa({
        telefone: "351910000005",
        ultimaEntrada: entrada(5, "Para que conta foi?", 3 * H),
        respondida: { haSegundos: H, quando: "x" },
        profissional: PRO,
      }),
    );
    expect(l.estado).toBe("a_espera");
    expect(contarNaMesa([l]).profissionais).toBe(0);
    expect(linhasDoSeparador([l], "profissionais")).toHaveLength(1);
  });

  it("sem ficha, não é profissional", () => {
    expect(naMesa(conversa({ ultimaEntrada: entrada(6, "Olá", H) })).profissional).toBeNull();
  });
});

describe("a ligação à base e ao painel", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const BASE = ler("src/lib/mesa-das-conversas-na-base.ts");
  const DB = ler("src/lib/db.ts");
  const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");

  it("a mesa sabe quem é profissional pelo telefone da ficha", () => {
    expect(BASE).toMatch(/telefonesDosProfissionaisWhatsApp\(\)/);
    expect(BASE).toMatch(/profissional:\s*profissionais\.get\(chave\)/);
  });

  it("a consulta usa colunas que existem em providers, pelos últimos 9 dígitos, sem a CLYON nem os apagados", () => {
    const i = DB.indexOf("export async function telefonesDosProfissionaisWhatsApp(");
    expect(i).toBeGreaterThan(-1);
    const fim = DB.slice(i).search(/\r?\n\}\r?\n/);
    expect(fim).toBeGreaterThan(-1);
    const corpo = DB.slice(i, i + fim);
    expect(corpo).toMatch(/FROM providers/);
    expect(corpo).toMatch(/RIGHT\(REGEXP_REPLACE\(COALESCE\(phone, ''\), '\[\^0-9\]', ''\), 9\)/);
    expect(corpo).toMatch(/isClyon = 0/);
    expect(corpo).toMatch(/estado <> 'apagado'/);
    // As colunas estão mesmo na tabela.
    const criar = DB.slice(DB.indexOf("CREATE TABLE IF NOT EXISTS providers"));
    for (const col of ["phone", "isClyon", "name"]) {
      expect(criar.slice(0, criar.indexOf(") ENGINE")), col).toMatch(new RegExp(`\\b${col}\\b`));
    }
    expect(DB).toMatch(/ALTER TABLE providers ADD COLUMN estado /);
  });

  it("o painel mostra o selo do separador e a etiqueta na linha", () => {
    expect(PAINEL).toMatch(/profissionais:\s*"bg-laranja\/14 text-laranja-texto"/);
    expect(PAINEL).toContain("{contagens[s.id] > 0 && (");
    expect(PAINEL).toMatch(/\{l\.profissional && \(/);
  });
});
