import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { distanciaParaElegibilidade } from "./distancia-entre-pontos";
import {
  ELEVADOR,
  ESTACIONAMENTO,
  distanciaPorExtenso,
} from "@/app/profissionais/painel/tipos";

/**
 * O que o profissional precisa de saber ANTES de propor um valor.
 *
 * Nas palavras dele, com o Fixando ao lado: "falta informação importante
 * para os clientes como andar, tipo de acesso, com ou sem elevador e a
 * distância". E depois: "adicione a distância do pro ao cliente para os pros
 * saberem mais ou menos os kms".
 *
 * O andar e o elevador já eram perguntados ao cliente, já estavam guardados,
 * e a API até os anunciava — a consulta é que nunca os foi buscar, e por isso
 * chegavam sempre vazios. A distância já era calculada para o backoffice
 * ("Fred · 52,9 km"); faltava do lado de quem faz o trabalho.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const API = ler("src/app/api/profissionais/meus-pedidos/route.ts");
const ECRA = ler("src/app/profissionais/painel/Trabalhos.tsx");
const VALORES = ler("src/lib/pedido-valores.ts");

describe("os dados do acesso chegam mesmo ao profissional", () => {
  it("a consulta do painel vai buscar andar, elevador e estacionamento", () => {
    const q = DB.slice(
      DB.indexOf("export async function negociacoesDoProfissional"),
      DB.indexOf("WHERE n.providerId = ?"),
    );
    expect(q).toContain("o.floor, o.hasElevator, o.parkingDistance");
  });

  it("e o guarda do que ele pode ver já os permitia — o buraco era a consulta", () => {
    expect(VALORES).toContain('"floor"');
    expect(VALORES).toContain('"hasElevator"');
    expect(VALORES).toContain('"parkingDistance"');
  });

  it("a morada continua a só existir depois de contratado", () => {
    // O acesso não é a morada: "2.º sem elevador" não leva ninguém à porta
    // de ninguém. Isto tinha de continuar verdade depois desta mudança.
    const antes = VALORES.slice(
      VALORES.indexOf("CAMPOS_VISIVEIS_AO_PROFISSIONAL = ["),
      VALORES.indexOf("] as const"),
    );
    expect(antes).not.toContain('"address"');
    expect(antes).not.toContain('"contactPhone"');
  });
});

describe("a distância até ao trabalho", () => {
  it("é a MESMA conta que o backoffice já mostrava ao distribuir", () => {
    expect(API).toContain("distanciaParaElegibilidade");
  });

  it("cala-se quando falta o ponto de um dos lados, em vez de inventar", () => {
    expect(distanciaParaElegibilidade(null, { lat: 38.7, lng: -9.1 })).toBeNull();
    expect(distanciaParaElegibilidade({ lat: 38.7, lng: -9.1 }, null)).toBeNull();
    // Lisboa → Almada: uns 10 km em linha recta, com a folga da estrada.
    const km = distanciaParaElegibilidade(
      { lat: 38.7223, lng: -9.1393 },
      { lat: 38.6790, lng: -9.1569 },
    );
    expect(km).not.toBeNull();
    expect(km!).toBeGreaterThan(4);
    expect(km!).toBeLessThan(12);
  });

  it("as coordenadas saem do JSON sem rebentar um pedido sem morada", () => {
    // Um CAST de um nulo de JSON deita abaixo a consulta INTEIRA, e pedidos
    // sem morada geocodificada são normais.
    const q = DB.slice(
      DB.indexOf("export async function negociacoesDoProfissional"),
      DB.indexOf("WHERE n.providerId = ?"),
    );
    expect(q).toContain("JSON_VALID(o.rawOrderJson)");
    expect(q).toContain("JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.address.lat'))");
    expect(q).not.toContain("CAST(JSON_EXTRACT");
  });

  it("aparece na LISTA, que é onde ele decide se vale a pena abrir", () => {
    const cartao = ECRA.slice(0, ECRA.indexOf("export default function") + 200);
    expect(ECRA).toContain("distanciaPorExtenso(p.distanciaKm)");
    expect(cartao.length).toBeGreaterThan(0);
  });

  it("diz-se por alto, com til — é linha recta, não é a conta do GPS", () => {
    expect(distanciaPorExtenso(34.2)).toBe("~34 km");
    expect(distanciaPorExtenso(0.4)).toBe("menos de 1 km");
  });
});

describe("o vocabulário do ecrã", () => {
  it("o profissional lê português, não lê «yes»", () => {
    expect(ELEVADOR.yes).toBe("Com elevador");
    expect(ELEVADOR.no).toBe("Sem elevador");
    expect(ESTACIONAMENTO.difficult).toBe("Longe ou complicado");
    // Antes saía o valor cru do motor de preços.
    expect(ECRA).not.toContain("Elevador: {pedido.hasElevator}");
  });

  it("um valor desconhecido passa tal e qual, em vez de desaparecer", () => {
    expect(ECRA).toContain("ELEVADOR[pedido.hasElevator] ?? pedido.hasElevator");
    expect(ECRA).toContain(
      "ESTACIONAMENTO[pedido.parkingDistance] ?? pedido.parkingDistance",
    );
  });

  it("o bloco do acesso só aparece quando há algo para dizer", () => {
    expect(ECRA).toContain("pedido.distanciaKm != null) && (");
    expect(ECRA).toContain("O acesso");
  });
});

describe("corrigir o pedido logo depois de o criar", () => {
  it("o painel do resultado tem por onde corrigir e juntar fotografias", () => {
    const REG = ler("src/components/admin/RegistarPedido.tsx");
    expect(REG).toContain("Corrigir ou juntar fotografias");
    expect(REG).toContain("onEditar?: (id: number) => void;");
  });

  it("e abre o editor que a Mesa já tinha, em vez de um segundo caminho", () => {
    const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(MESA).toContain("onEditar={(id) => setAEditarPlataforma(id)}");
  });
});
