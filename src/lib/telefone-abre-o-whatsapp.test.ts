import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O TELEMÓVEL DO CLIENTE ABRE O WHATSAPP — 21-10-2026. *«Coloque o link no
 * número dos clientes; ao clicar vai direto para o WhatsApp deles.»* — o dono.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const C = ler("src/components/admin/TelefoneComWhatsApp.tsx");

describe("o número", () => {
  it("abre o wa.me pela regra de sempre, e um número que não serve fica só escrito", () => {
    expect(C).toContain('import { numeroParaWhatsApp } from "@/lib/link-de-whatsapp";');
    expect(C).toContain("href={`https://wa.me/${numero}`}");
    // Um que não serve para o WhatsApp (um fixo) continua a ligar.
    expect(C).toContain('href={`tel:${(telefone ?? "").replace(/\\s/g, "")}`}');
  });

  it("o clique fica no número: não abre nem fecha o cartão", () => {
    expect(C).toContain("onClick={(e) => e.stopPropagation()}");
    expect(C).toContain('rel="noopener noreferrer"');
  });
});

describe("onde está", () => {
  it("na Mesa, nas negociações e nos de valor fixo", () => {
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("<TelefoneComWhatsApp\n                  telefone={p.contactPhone}");
    const T = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(T).toContain('<TelefoneComWhatsApp telefone={t.telefone} className="tabular-nums text-cyan-300" />');
    // A linha de cima já não é um botão — um link dentro de um botão não funciona.
    const cartao = T.slice(T.indexOf("function CartaoDoTrabalho("));
    expect(cartao).toContain("{...linhaQueAbre(() => {");
    expect(cartao.slice(0, cartao.indexOf("<TelefoneComWhatsApp"))).not.toMatch(/<button\s+type="button"\s+onClick=\{\(\) => \{\s+if \(porVer/);
  });

  it("nos Pagamentos (era uma chamada) e em «Todos os pedidos», quando o número se vê", () => {
    const P = ler("src/components/admin/AdminPagamentosPanel.tsx");
    expect(P).toContain("<TelefoneComWhatsApp telefone={t.telefoneDoCliente}");
    expect(P).not.toContain("href={`tel:${t.telefoneDoCliente");
    expect(ler("src/components/admin/LegacyAdminClient.tsx")).toContain(
      "{shouldMask ? maskPhone(p.contactPhone) : <TelefoneComWhatsApp telefone={p.contactPhone} />}",
    );
  });
});

describe("também nos profissionais — 21-10-2026", () => {
  it("nos Profissionais, na Agenda (botão e ficha), nas Finanças e nas Candidaturas", () => {
    expect(ler("src/components/admin/AdminProfissionaisPanel.tsx")).toContain("telefone={p.phone}");
    const A = ler("src/components/admin/AdminAgendaPanel.tsx");
    expect(A).toContain("telefone={t.profissionalTelefone}");
    expect(A).toContain("telefone={t.clienteTelefone}");
    expect(A).not.toContain("href={`tel:");
    const F = ler("src/components/admin/FichaDaAgenda.tsx");
    expect(F).toContain("telefone={t.profissionalTelefone}");
    expect(F).toContain("telefone={t.clienteTelefone}");
    const FIN = ler("src/components/admin/AdminCarteirasPanel.tsx");
    expect(FIN).toContain("<TelefoneComWhatsApp telefone={c.telefone}");
    expect(FIN).toContain("<TelefoneComWhatsApp telefone={t.telefoneDoCliente}");
    expect(ler("src/components/admin/AdminCandidaturasPanel.tsx")).toContain("<TelefoneComWhatsApp telefone={c.telefone}");
    expect(ler("src/components/admin/ContasPanel.tsx")).toContain("telefone={u.phone}");
  });
});
