import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estaVerificado, parceiroNaFrase, SQL_DO_VERIFICADO, sqlDoVerificado } from "./parceiro-verificado";
import { quemFazOTrabalhoClyon } from "./fim-do-trabalho-clyon";

/**
 * «Selo só nos que tiverem os 3» — dono, 01-11-2026. NIF, identidade e
 * contacto confirmados no backoffice; o cliente só lê «verificado» de um
 * parceiro com as três.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("as três confirmações", () => {
  it("verificado só com as três", () => {
    expect(estaVerificado({ nifConfirmadoEm: "x", identidadeConfirmadaEm: "x", contactoConfirmadoEm: "x" })).toBe(true);
    expect(estaVerificado({ nifConfirmadoEm: "x", identidadeConfirmadaEm: "x", contactoConfirmadoEm: null })).toBe(false);
    expect(estaVerificado({ parceiroVerificado: 1 })).toBe(true);
    expect(estaVerificado({ parceiroVerificado: "1" })).toBe(true);
    expect(estaVerificado({ parceiroVerificado: 0 })).toBe(false);
    expect(estaVerificado(null)).toBe(false);
    expect(SQL_DO_VERIFICADO).toBe(
      "(p.nifConfirmadoEm IS NOT NULL AND p.identidadeConfirmadaEm IS NOT NULL AND p.contactoConfirmadoEm IS NOT NULL)",
    );
    expect(sqlDoVerificado("providers")).toContain("providers.contactoConfirmadoEm IS NOT NULL");
  });

  it("a frase de quem faz o trabalho só diz «verificado» com as três", () => {
    expect(parceiroNaFrase("Rui", true)).toBe("Rui, parceiro verificado pela CLYON");
    expect(parceiroNaFrase("Rui", false)).toBe("Rui, parceiro da CLYON");
    expect(quemFazOTrabalhoClyon("Rui")).toBe("O trabalho é feito por Rui, parceiro da CLYON.");
    expect(quemFazOTrabalhoClyon("Rui", true)).toBe("O trabalho é feito por Rui, parceiro verificado pela CLYON.");
  });

  it("as consultas que levam o parceiro ao cliente trazem o campo", () => {
    for (const f of ["src/lib/db.ts", "src/lib/pedidos-da-conta.ts", "src/lib/pedidos-do-cliente.ts"]) {
      expect(ler(f), f).toContain("${SQL_DO_VERIFICADO} AS parceiroVerificado");
    }
    expect(ler("src/lib/perfil-publico-do-profissional.ts")).toContain('${sqlDoVerificado("providers")} AS parceiroVerificado');
    expect(ler("src/lib/negociacao-na-vista.ts")).toContain("verificado: estaVerificado({ parceiroVerificado: n.parceiroVerificado ?? 0 }),");
    expect(ler("src/lib/pedido-para-a-app.ts")).toContain("verificado: n.verificado === true,");
    // Uma instância nova não lê colunas que ainda não existem.
    const db = ler("src/lib/db.ts");
    const i = db.indexOf("export async function ensureSimulatorOrdersTable()");
    expect(db.slice(i, i + 900)).toContain("await ensureProvidersSchema();");
  });

  it("as colunas nascem vazias, e mudar o NIF, o telefone ou o email tira a confirmação", () => {
    const db = ler("src/lib/db.ts");
    for (const c of ["nifConfirmadoEm", "identidadeConfirmadaEm", "contactoConfirmadoEm"]) {
      expect(db).toContain(`ALTER TABLE providers ADD COLUMN ${c} DATETIME NULL DEFAULT NULL`);
    }
    expect(db).toContain('["nif", "nifConfirmadoEm", "nifConfirmadoPor"]');
    expect(db).toContain('["phone", "contactoConfirmadoEm", "contactoConfirmadoPor"]');
    expect(db).toContain("SET contactoConfirmadoEm = IF(email <=> ?, contactoConfirmadoEm, NULL)");
  });

  it("marcam-se no backoffice, pelo administrador ou pela secção Profissionais, com data e quem", () => {
    const rota = ler("src/app/api/admin/profissionais/[id]/route.ts");
    expect(rota).toContain("const { err, colab } = await requireAdmin(req);");
    expect(rota).toContain("if (corpo.confirmacoes && typeof corpo.confirmacoes === \"object\") {");
    expect(rota).toContain("= COALESCE(${em}, NOW()), ${por} = COALESCE(${por}, ?)");
    expect(ler("src/lib/papel-do-painel.ts")).toContain('{ prefixo: "/api/admin/profissionais", seccoes: ["profissionais"] }');
    expect(ler("src/components/admin/AdminProfissionaisPanel.tsx")).toContain("<ConfirmacoesDoVerificado");
    expect(ler("src/app/api/admin/profissionais/route.ts")).toContain("nifConfirmadoEm, nifConfirmadoPor");
  });
});
