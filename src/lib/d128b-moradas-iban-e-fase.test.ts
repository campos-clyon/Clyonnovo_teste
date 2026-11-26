import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { etiquetaDasPropostasPorEnviar, ETIQUETA_DAS_PROPOSTAS_POR_ENVIAR } from "./do-nosso-lado";
import { BASE_DA_ZONA } from "./fora-da-zona";
import { kmDeLisboa, linhaDaMoradaEscolhida, locationbiasDaZona, rectanguloDaZona } from "./morada-escolhida";

/**
 * Três acertos (26-11-2026): o IBAN copiado sem os espaços (e com os «s»), a
 * fase «Propostas por enviar» na lista antiga de Pedidos (d123, pela regra da
 * Mesa) e as moradas com preferência à zona e a localidade e a distância a
 * Lisboa por baixo da morada escolhida (d128b).
 *
 * relógio: datas explícitas — `agora` passa-se sempre.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("o IBAN copiado", () => {
  it("tira os espaços, não os «s»", () => {
    const fonte = ler("src/components/PagarTrabalho.tsx");
    expect(fonte).toContain('t.iban.replace(/\\s+/g, "")');
    const iban = "PT50 0002 0123 1234 5678 9015 4";
    expect(iban.replace(/\s+/g, "")).toBe("PT50000201231234567890154");
  });

  it("nenhum /s+/g sem a barra no código", () => {
    for (const f of ["src/components/PagarTrabalho.tsx", "src/hooks/useGooglePlaces.ts"]) {
      expect(ler(f)).not.toMatch(/\(\/s\+\/g/);
    }
  });
});

describe("d123 na lista antiga de Pedidos", () => {
  const agora = new Date("2026-11-26T12:00:00Z");
  const pedido = (extra: Record<string, unknown> = {}) => ({
    id: 1,
    status: "atribuido",
    origem: "backoffice",
    contactEmail: null,
    propostaEnviadaEm: null as Date | null,
    negociacoes: [
      {
        estado: "proposta_profissional",
        propostasJson: JSON.stringify([{ por: "profissional", estado: "pendente", criadaEm: "2026-11-26T10:00:00Z" }]),
        execucaoEnviadaEm: null,
        confirmadoEm: null,
        actualizadaEm: null,
      },
    ],
    ...extra,
  });

  it("propostas que não foram ao cliente: «Propostas por enviar»", () => {
    expect(etiquetaDasPropostasPorEnviar("orcamento_enviado", pedido() as never, agora)).toBe(ETIQUETA_DAS_PROPOSTAS_POR_ENVIAR);
  });

  it("depois de sair (propostaEnviadaEm, como a base a devolve): a etiqueta da fase fica", () => {
    const enviado = pedido({ propostaEnviadaEm: new Date("2026-11-26T11:00:00Z") });
    expect(etiquetaDasPropostasPorEnviar("orcamento_enviado", enviado as never, agora)).toBeNull();
  });

  it("a API calcula-a pela mesma função e a lista mostra-a antes da etiqueta da fase", () => {
    const db = ler("src/lib/db.ts");
    const i = db.indexOf("export async function categoriasDosPedidos(");
    expect(i).toBeGreaterThan(-1);
    const corpo = db.slice(i, db.indexOf("\n}\n", i));
    expect(corpo).toContain("etiquetaDasPropostasPorEnviar(");
    expect(corpo).toContain("o.propostaEnviadaEm");
    expect(corpo).toContain("o.contactEmail");
    expect(ler("src/app/api/admin/pedidos/route.ts")).toContain("etiquetasDaFase,");
    const lista = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(lista).toMatch(/etiquetasDaFase\[String\(p\.id\)\] \?\?\s*ETIQUETA_DA_CATEGORIA/);
    expect(lista).toContain("setEtiquetasDaFase(data.etiquetasDaFase ?? {})");
  });
});

describe("d128b — a morada escolhida", () => {
  it("a zona da pesquisa contém o círculo dos 200 km à volta da base", () => {
    const r = rectanguloDaZona(200);
    expect(r.sul).toBeLessThan(BASE_DA_ZONA.lat - 1.79);
    expect(r.norte).toBeGreaterThan(BASE_DA_ZONA.lat + 1.79);
    expect(r.oeste).toBeLessThan(BASE_DA_ZONA.lng - 2.2);
    expect(r.este).toBeGreaterThan(BASE_DA_ZONA.lng + 2.2);
    // Porto (~275 km) fica fora; Coimbra (~170 km em linha recta) dentro.
    expect(41.15).toBeGreaterThan(r.norte);
    expect(40.2).toBeLessThan(r.norte);
    expect(locationbiasDaZona(200)).toMatch(/^rectangle:-?\d+(\.\d+)?,-?\d+(\.\d+)?\|-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
  });

  it("um limite estranho das Configs cai nos 200", () => {
    expect(rectanguloDaZona(Number.NaN)).toEqual(rectanguloDaZona(200));
    expect(rectanguloDaZona(0)).toEqual(rectanguloDaZona(200));
  });

  it("a localidade e a distância a Lisboa", () => {
    const felgueiras = { city: "Felgueiras", lat: 41.3646, lng: -8.1977 };
    const km = kmDeLisboa(felgueiras)!;
    expect(km).toBeGreaterThan(350);
    expect(km).toBeLessThan(450);
    expect(linhaDaMoradaEscolhida(felgueiras)).toBe(`Felgueiras · ${km} km de Lisboa`);
  });

  it("a medida da estrada ganha à linha recta", () => {
    expect(linhaDaMoradaEscolhida({ city: "Felgueiras", lat: 41.36, lng: -8.19, kmDaEstrada: 407.4 })).toBe("Felgueiras · 407 km de Lisboa");
  });

  it("em Lisboa, só «Lisboa»; sem coordenadas, só a localidade; sem nada, nada", () => {
    expect(linhaDaMoradaEscolhida({ city: "Lisboa", lat: 38.72, lng: -9.14 })).toBe("Lisboa");
    expect(linhaDaMoradaEscolhida({ city: "Sintra" })).toBe("Sintra");
    expect(linhaDaMoradaEscolhida({ city: "", lat: null, lng: null })).toBeNull();
    expect(kmDeLisboa({ lat: 0, lng: 0 })).toBeNull();
  });

  it("a rota do autocomplete prefere a zona das Configs e pesquisa sem ela se o Google a recusar", () => {
    const rota = ler("src/app/api/maps/autocomplete/route.ts");
    expect(rota).toContain("locationbiasDaZona(await limiteDaZonaKm(), baseDaZona())");
    expect(rota).toContain('p.set("locationbias", zona)');
    expect(rota).toContain('data?.status === "INVALID_REQUEST"');
    expect(rota).toContain("pedir(false)");
    // preferência, não restrição
    expect(rota).not.toContain("strictbounds");
    expect(rota).not.toContain("locationrestriction");
    expect(ler("src/hooks/useGooglePlaces.ts")).toContain("locationBias: ZONA_DE_PREFERENCIA");
  });

  it("o simulador e o /plataforma/pedir mostram a linha por baixo da morada escolhida", () => {
    for (const f of ["src/app/simulador/components/AddressAutocomplete.tsx", "src/app/plataforma/pedir/components/AddressAutocomplete.tsx"]) {
      const fonte = ler(f);
      expect(fonte).toContain("linhaDaMoradaEscolhida({ ...selectedAddress, kmDaEstrada })");
      expect(fonte).toContain('addressStatus === "selected"');
    }
  });
});
