import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  METODOS_PAGOS_PELA_PLATAFORMA,
  SQL_AVALIACAO_QUE_CONTA,
  SQL_CONTACTO_NO_MOMENTO,
  SQL_CONTACTO_VERIFICADO_E_DIFERENTE,
  SQL_PAGO_PELA_PLATAFORMA,
} from "./avaliacao-que-conta";
import {
  avisoDasCoincidencias,
  coincidenciasEntre,
  emailNormalizado,
  mesmaMorada,
  noveDigitos,
} from "./coincidencias-cliente-parceiro";

/**
 * AS ESTRELAS PÚBLICAS SÓ DE TRABALHOS VERDADEIROS — 04-11-2026 (d10.3).
 *
 * No perfil público e no `aggregateRating` contam só as avaliações de
 * trabalhos pagos pela plataforma (euPago ou transferência para a CLYON) ou de
 * clientes com contacto verificado e diferente do do parceiro. As outras ficam
 * guardadas, fora da média. E a Mesa alerta quando o cliente e o parceiro
 * partilham o telefone, o email ou a morada.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("o que conta como trabalho verdadeiro", () => {
  it("pago pela plataforma: o euPago (MB WAY, Multibanco) ou a transferência para a CLYON — nunca o pago em mão", () => {
    expect([...METODOS_PAGOS_PELA_PLATAFORMA]).toEqual(["mbway", "multibanco", "transferencia"]);
    const pago = SQL_PAGO_PELA_PLATAFORMA("n");
    expect(pago).toContain("FROM pagamentos");
    expect(pago).toContain("negociacaoId = n.id");
    expect(pago).toContain("pagoEm IS NOT NULL");
    expect(pago).toContain("deTeste");
    expect(pago).not.toMatch(/ao_profissional|numerario|abatimento|quitacao/);
  });

  it("contacto verificado: uma conta onde já se entrou com o email, ou o cliente escreveu-nos desse número", () => {
    const c = SQL_CONTACTO_VERIFICADO_E_DIFERENTE("o", "p");
    expect(c).toContain("FROM users");
    expect(c).toContain("lastSignedIn IS NOT NULL");
    expect(c).toContain("FROM whatsappMensagens");
    expect(c).toContain("direccao = 'in'");
  });

  it("e diferente do do parceiro — o email e o telefone", () => {
    const c = SQL_CONTACTO_VERIFICADO_E_DIFERENTE("o", "p");
    expect(c).toMatch(/AND NOT \([\s\S]*o\.contactEmail[\s\S]*p\.email/);
    expect(c).toMatch(/AND NOT \([\s\S]*o\.contactPhone[\s\S]*p\.phone/);
    // Sem o pedido (já arquivado), não se prova nada.
    expect(c.startsWith("(o.id IS NOT NULL AND")).toBe(true);
  });

  it("a regra junta as duas, e grava o contacto no momento da avaliação", () => {
    const r = SQL_AVALIACAO_QUE_CONTA();
    expect(r).toContain(SQL_PAGO_PELA_PLATAFORMA("n"));
    expect(r).toContain("n.avaliacaoContactoVerificado = 1");
    expect(r).toContain("n.avaliacaoContactoVerificado IS NULL AND");
    expect(SQL_CONTACTO_NO_MOMENTO).toContain("negociacoes.pedidoId");
    expect(SQL_CONTACTO_NO_MOMENTO).toContain("negociacoes.providerId");
    const db = ler("src/lib/db.ts");
    expect(db).toContain("ADD COLUMN avaliacaoContactoVerificado TINYINT NULL DEFAULT NULL");
    const avaliar = db.slice(db.indexOf("export async function avaliarProfissional"));
    expect(avaliar.slice(0, 3000)).toContain("SET avaliacaoContactoVerificado = ${SQL_CONTACTO_NO_MOMENTO}");
  });
});

describe("o perfil público só conta essas", () => {
  const perfil = ler("src/lib/perfil-publico-do-profissional.ts");

  it("a média, a contagem, a lista e os cartões das cidades passam pela regra", () => {
    expect((perfil.match(/SQL_AVALIACAO_QUE_CONTA\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    for (const coluna of ["AS media", "AS avaliados", "AS mediaDosClientes", "AS dosClientes"]) {
      const i = perfil.indexOf(coluna);
      expect(i, coluna).toBeGreaterThan(-1);
      expect(perfil.slice(Math.max(0, i - 220), i), coluna).toContain("${conta}");
    }
    expect(perfil).toContain("AND n.estrelas IS NOT NULL AND ${conta}");
  });

  it("se a conta falhar, sai sem estrelas — nunca com todas", () => {
    expect(perfil).toContain('estatisticas("FALSE")');
    expect(perfil).toContain('consulta("FALSE")');
  });

  it("o aggregateRating vem dos números já filtrados", () => {
    const pagina = ler("src/app/profissionais/[slug]/page.tsx");
    expect(pagina).toContain("ratingValue: p.notaDosClientes");
    expect(pagina).toContain("reviewCount: p.avaliacoesDosClientes");
  });
});

describe("o alerta na Mesa: o cliente e o parceiro com o mesmo contacto", () => {
  it("o telefone pelos nove dígitos, venha como vier", () => {
    expect(noveDigitos("+351 912 345 678")).toBe("912345678");
    expect(noveDigitos("912345678")).toBe("912345678");
    expect(noveDigitos("12345")).toBeNull();
    expect(coincidenciasEntre({ telefone: "+351 912 345 678" }, { telefone: "912345678" })).toEqual(["telefone"]);
  });

  it("o email sem maiúsculas e sem o «+etiqueta»", () => {
    expect(emailNormalizado(" Nome+teste@Exemplo.pt ")).toBe("nome@exemplo.pt");
    expect(coincidenciasEntre({ email: "nome+x@exemplo.pt" }, { email: "NOME@exemplo.pt" })).toEqual(["email"]);
  });

  it("a morada igual, ou uma dentro da outra — com número de porta, e nunca só a terra", () => {
    expect(mesmaMorada("Rua das Flores, 12, 2845-123 Amora, Portugal", "R. das Flores 12")).toBe(false);
    expect(mesmaMorada("Rua das Flores, 12, 2845-123 Amora, Portugal", "Rua das Flores, 12")).toBe(true);
    expect(mesmaMorada("Rua das Flores 12", "rua das flores 12")).toBe(true);
    expect(mesmaMorada("Rua X, Seixal", "Seixal")).toBe(false);
    expect(
      coincidenciasEntre({ morada: "Rua das Flores, 12, Amora" }, { moradas: [null, "Rua das Flores, 12, Amora"] }),
    ).toEqual(["morada"]);
  });

  it("sem nada em comum, nada; e a frase diz o que partilham", () => {
    expect(coincidenciasEntre({ telefone: "912345678", email: "a@b.pt" }, { telefone: "930000123", email: "c@d.pt" })).toEqual([]);
    expect(avisoDasCoincidencias([])).toBeNull();
    expect(avisoDasCoincidencias(["telefone", "email"])).toBe(
      "O cliente e o parceiro partilham o telefone e o email. Confirme quem é o cliente antes de fechar.",
    );
  });

  it("a Mesa e os Trabalhos CLYON mostram-no", () => {
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("avisoDasCoincidencias(n.coincidencias)");
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain("avisoDasCoincidencias(n.coincidencias)");
    expect(ler("src/lib/confianca-na-mesa.ts")).toContain("coincidenciasEntre(");
  });
});
