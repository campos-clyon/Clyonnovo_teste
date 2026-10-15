import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { origemDoLead } from "./acesso";
import { AVISO_DO_CONTACTO_A_MEIO, ORIGEM_DO_CONTACTO_A_MEIO } from "./contacto-a-meio";
import { DIAS_DOS_CONTACTOS_A_MEIO } from "./retencao";

/*
 * O CONTACTO DE QUEM PAROU A MEIO — 14-10-2026, decisão do dono: «Sim, com
 * aviso». Guarda-se ao avançar do passo 1, diz-se por baixo do botão, sai
 * quando o pedido completo chega ou ao fim de 30 dias, e a política de
 * privacidade di-lo.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("o contacto de quem parou a meio", () => {
  it("o formulário avisa por baixo do botão, e envia ao avançar sem esperar", () => {
    const F = ler("src/components/HeroQuoteForm.tsx");
    expect(F).toContain("{AVISO_DO_CONTACTO_A_MEIO}");
    expect(F).toContain('void fetch("/api/leads/parcial", {');
    expect(F).toContain("keepalive: true,");
    expect(AVISO_DO_CONTACTO_A_MEIO).toMatch(/guardamos o nome e o telefone/);
  });

  it("a rota só grava telefones que são telefones, e com limite por IP", () => {
    const R = ler("src/app/api/leads/parcial/route.ts");
    expect(R).toContain('limitarRotaPublica(req, "leads-parcial", 10, 300)');
    expect(R).toContain("if (problemaDoTelefone(d.telefone))");
  });

  it("um por telefone, e sai quando o pedido completo chega", () => {
    const D = ler("src/lib/db.ts");
    expect(D).toContain("DELETE FROM leads WHERE origem = ? AND telefone = ? AND status = 'novo'");
    expect(ler("src/app/api/hero-quote/route.ts")).toContain(".then(() => esquecerContactoAMeio(telefoneFull))");
  });

  it("sai na purga da noite ao fim do prazo, e a política de privacidade di-lo", () => {
    expect(DIAS_DOS_CONTACTOS_A_MEIO).toBe(30);
    expect(ler("src/app/api/cron/purgar-pedidos/route.ts")).toContain(
      "purgarContactosAMeio(DIAS_DOS_CONTACTOS_A_MEIO, { aSerio: armada })",
    );
    expect(ler("src/app/privacidade/page.tsx")).toContain("{DIAS_DOS_CONTACTOS_A_MEIO} dias");
  });

  it("no backoffice aparece como «Formulário a meio»", () => {
    expect(origemDoLead({ origem: ORIGEM_DO_CONTACTO_A_MEIO })).toBe("Formulário a meio");
  });
});
