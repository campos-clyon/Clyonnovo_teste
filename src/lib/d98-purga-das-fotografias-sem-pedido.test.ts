import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DIAS_DAS_FOTOS_SEM_PEDIDO } from "./retencao";
import { HORAS_DAS_FOTOS_PENDENTES } from "./db";
import { HORAS_DO_RASCUNHO } from "./conversa-parada-a-meio";

/**
 * A PURGA DAS FOTOGRAFIAS SEM PEDIDO — d98 (23-11-2026, com o ok do Jurídico).
 *
 * Eram 3 dias de purga para 48 horas de espera, e o rascunho da recolha
 * passou a 7 dias na d93. Agora os três dizem o mesmo, de uma só constante, e
 * a Política de Privacidade diz o número.
 */

const ler = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");

describe("d98 — purga ≥ janela de junção ≥ rascunho", () => {
  it("a purga não leva uma fotografia que ainda podia entrar no pedido", () => {
    expect(DIAS_DAS_FOTOS_SEM_PEDIDO * 24).toBeGreaterThanOrEqual(HORAS_DAS_FOTOS_PENDENTES);
    expect(HORAS_DAS_FOTOS_PENDENTES).toBeGreaterThanOrEqual(HORAS_DO_RASCUNHO);
    expect(DIAS_DAS_FOTOS_SEM_PEDIDO).toBe(7);
  });

  it("de uma só constante, partilhada com o rascunho", () => {
    expect(ler("src/lib/retencao.ts")).toContain("export const DIAS_DAS_FOTOS_SEM_PEDIDO = HORAS_DO_RASCUNHO / 24;");
    expect(ler("src/lib/db.ts")).toContain("export const HORAS_DAS_FOTOS_PENDENTES = HORAS_DO_RASCUNHO;");
    expect(ler("src/app/api/cron/purgar-pedidos/route.ts")).toContain("purgarFotosPendentesDoWhatsApp(DIAS_DAS_FOTOS_SEM_PEDIDO");
  });

  it("a Política de Privacidade (secção 6) diz o prazo, pela constante", () => {
    const pagina = ler("src/app/privacidade/page.tsx");
    const i = pagina.indexOf('title="6. Prazo de conservação"');
    const fim = pagina.indexOf("<PolicySection", i + 1);
    expect(i).toBeGreaterThan(-1);
    const seis = pagina.slice(i, fim > -1 ? fim : undefined);
    expect(seis).toMatch(
      /<strong>Fotografias enviadas pelo WhatsApp antes de haver pedido:<\/strong>\{" "\}\s*\{DIAS_DAS_FOTOS_SEM_PEDIDO\} dias; se o pedido for criado nesse prazo, passam a fazer\s+parte dele\./,
    );
  });
});
