import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { congelarTarifa } from "./conta-da-mudanca";
import { folhaNoEcra, lerFolha } from "./folha-da-mudanca";

/**
 * A FOLHA DA MUDANÇA NA APP DE CLIENTE — 11-11-2026. A app não faz contas: lê
 * a folha que a API escreve (`horasParaOCliente` → `folha`) e confirma ou diz
 * que não concorda pelas acções de sempre (`confirmar_horas`/`contestar_horas`).
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const ECRA = ler("app-cliente/src/componentes/HorasDoTrabalho.tsx");
const TIPOS = ler("app-cliente/src/lib/pedidos.ts");

describe("a app de cliente mostra a folha que a API manda", () => {
  it("o tipo tem tudo o que a API escreve", () => {
    const t = congelarTarifa({
      precoHora2: 40,
      precoHora3: null,
      minimoHoras: 3,
      precoKm: 0.5,
      kmMinimo: 0,
      kmMaximo: 100,
      caixa: 2,
      cartaoMetro: null,
      filmeRolo: null,
      plasticoBolhaRolo: null,
      aparecerNaLista: true,
    });
    const r = lerFolha(
      { inicio: "09:00", fim: "13:00" },
      { tarifa: t, pessoasEscolhidas: 2, kmDoPercurso: 10, valorPorHoraAcordado: 40, diaPorOmissao: "2026-11-10" },
      new Date("2026-11-11T12:00:00Z"),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const doCliente = { ...folhaNoEcra(r.folha, "cliente", 3), estado: "enviada", historico: [] };
    const bloco = TIPOS.slice(TIPOS.indexOf("export type FolhaParaOCliente"), TIPOS.indexOf("export type HorasDoTrabalho"));
    for (const k of Object.keys(doCliente).filter((k) => k !== "recebeTexto")) expect(bloco, k).toContain(`${k}:`);
    expect(TIPOS).toContain("folha?: FolhaParaOCliente | null;");
  });

  it("o ecrã desenha as linhas, o aviso da equipa, a regra e o histórico", () => {
    expect(ECRA).toContain("h.folha.linhas.map(");
    expect(ECRA).toContain("h.folha.avisoDaEquipa");
    expect(ECRA).toContain("h.folha ? h.folha.regra : h.regraTexto");
    expect(ECRA).toContain("h.folha.historico");
    // Confirma e contesta pelas mesmas acções das horas (o botão vem da API: «Confirmo a folha»).
    expect(ECRA).toContain('n.accoes.includes("confirmar_horas")');
    expect(ECRA).toContain("titulo={h.botaoConfirmar}");
  });

  it("a app não faz a conta da folha", () => {
    expect(ECRA).not.toMatch(/valorDaMudanca|lerFolha|folha-da-mudanca/);
  });
});
