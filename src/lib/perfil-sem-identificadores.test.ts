import { describe, it, expect } from "vitest";
import { SERVICE_CATEGORIES } from "./service-categories";
import { tService } from "./translations";

/*
 * O PERFIL PÚBLICO DIZ O SERVIÇO POR PALAVRAS — 14-10-2026.
 *
 * /profissionais/revolution mostrava «montagem_moveis · jardinagem ·
 * manutencao_casa»: o identificador da base, porque a tradução não conhecia
 * três das categorias que um profissional pode escolher ao inscrever-se.
 */
describe("os serviços de um profissional", () => {
  it("todas as categorias têm nome — nenhuma sai como está na base", () => {
    for (const c of SERVICE_CATEGORIES) {
      expect(tService(c.id), c.id).not.toContain("_");
      expect(tService(c.id), c.id).not.toBe(c.id);
    }
  });
});
