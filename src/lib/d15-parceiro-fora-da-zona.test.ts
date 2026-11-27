import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHAVE_DO_LIMITE_DA_ZONA } from "./fora-da-zona";
import {
  avisoDaZonaParaOParceiro,
  kmDeLisboaDeUmPonto,
  linhaDoParceiroForaDaZona,
  parceiroForaDaZona,
} from "./parceiro-fora-da-zona";

/**
 * d15 (27-11-2026): o aviso na candidatura e na inscrição, e a marca âmbar no
 * backoffice, para quem tem a base acima do limite da zona. O limite lê-se SEMPRE
 * da config `zona_km_maximo` — nunca se escreve à mão.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const semComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const LISBOA = { lat: 38.7223, lng: -9.1393 };
const PORTO = { lat: 41.1579, lng: -8.6291 };

describe("a regra, com o limite sempre por parâmetro", () => {
  it("Lisboa fica dentro; o Porto fora, com os km medidos", () => {
    expect(parceiroForaDaZona(LISBOA, 200)).toBeNull();
    const f = parceiroForaDaZona(PORTO, 200);
    expect(f?.limite).toBe(200);
    expect(f!.km).toBeGreaterThan(300);
  });

  it("muda com o limite que lhe dão (nada fixo lá dentro)", () => {
    expect(parceiroForaDaZona(PORTO, 1000)).toBeNull();
    expect(parceiroForaDaZona(LISBOA, 5)?.limite).toBe(5);
  });

  it("sem ponto, ou com um ponto que não vale, não marca", () => {
    expect(parceiroForaDaZona(null, 200)).toBeNull();
    expect(parceiroForaDaZona({ lat: null, lng: null }, 200)).toBeNull();
    expect(parceiroForaDaZona({ lat: 0, lng: 0 }, 200)).toBeNull();
    expect(kmDeLisboaDeUmPonto({ lat: "38.7", lng: "-9.1" })).not.toBeNull();
  });

  it("o aviso diz o limite que recebe, e que nas mudanças conta a origem", () => {
    expect(avisoDaZonaParaOParceiro(200)).toContain("200 km de Lisboa");
    expect(avisoDaZonaParaOParceiro(150)).toContain("150 km de Lisboa");
    expect(avisoDaZonaParaOParceiro(150)).not.toContain("200");
    expect(avisoDaZonaParaOParceiro(200)).toContain("nas mudanças conta");
    expect(linhaDoParceiroForaDaZona({ km: 312.4, limite: 200 })).toBe(
      "Fora da zona: base a 312 km de Lisboa (limite 200 km) — não recebe pedidos",
    );
  });
});

describe("o limite lê-se da config, nos três sítios", () => {
  it("a função do servidor lê zona_km_maximo das Configs", () => {
    expect(CHAVE_DO_LIMITE_DA_ZONA).toBe("zona_km_maximo");
    const f = semComentarios(ler("src/lib/fora-da-zona-na-base.ts"));
    expect(f).toContain("getSimulatorSettings()");
    expect(f).toContain("CHAVE_DO_LIMITE_DA_ZONA");
    const nb = semComentarios(ler("src/lib/parceiro-fora-da-zona-na-base.ts"));
    expect(nb).toContain("limiteDaZonaKm");
    expect(nb).not.toMatch(/\b200\b/);
  });

  it("a candidatura e a inscrição dizem o aviso pelo limite que a página lê", () => {
    const pagina = semComentarios(ler("src/app/quero-ser-parceiro/page.tsx"));
    expect(pagina).toContain("limiteDaZonaKm()");
    expect(pagina).toContain("limiteDaZonaKm={limiteDaZona}");
    const candidatura = semComentarios(ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx"));
    expect(candidatura).toContain("avisoDaZonaParaOParceiro(limiteDaZonaKm)");
    const convite = semComentarios(ler("src/app/profissionais/inscricao/[token]/page.tsx"));
    expect(convite).toContain("limiteDaZonaKm={await limiteDaZonaKm()}");
    const inscricao = semComentarios(ler("src/app/profissionais/InscricaoForm.tsx"));
    expect(inscricao).toContain("avisoDaZonaParaOParceiro(limiteDaZonaKm)");
  });

  it("nenhum destes ficheiros escreve o limite à mão", () => {
    for (const f of [
      "src/app/quero-ser-parceiro/page.tsx",
      "src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx",
      "src/app/profissionais/InscricaoForm.tsx",
      "src/app/profissionais/inscricao/[token]/page.tsx",
      "src/lib/parceiro-fora-da-zona.ts",
      "src/components/admin/AdminCandidaturasPanel.tsx",
      "src/components/admin/AdminProfissionaisPanel.tsx",
    ]) {
      expect(semComentarios(ler(f)), f).not.toMatch(/\b200\s*km\b|KM_DA_ZONA_POR_OMISSAO\s*[^=,}\s]/);
    }
  });

  it("o backoffice marca a candidatura e a conta fora da zona, a âmbar", () => {
    const rc = semComentarios(ler("src/app/api/admin/candidaturas/route.ts"));
    expect(rc).toContain("candidaturasForaDaZona(");
    expect(rc).toContain("foraDaZona:");
    const rp = semComentarios(ler("src/app/api/admin/profissionais/route.ts"));
    expect(rp).toContain("contasForaDaZona(");
    expect(rp).toContain("zonaKmMaximo");
    for (const f of ["AdminCandidaturasPanel", "AdminProfissionaisPanel"]) {
      const p = ler(`src/components/admin/${f}.tsx`);
      expect(p).toContain("foraDaZona");
      expect(p).toMatch(/amber-[0-9]+\/15[^"]*text-amber-300/);
    }
  });
});

describe("o raio máximo do parceiro não muda (escolha A do CEO)", () => {
  it("continua nos 500 km", () => {
    expect(ler("src/lib/inscricao-profissional.ts")).toMatch(/RAIO_MAXIMO_KM\s*=\s*500/);
  });
});
