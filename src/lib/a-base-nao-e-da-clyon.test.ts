import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A distância da base sai da frente do cliente.
 *
 * "não é a CLYON que faz as recolhas, então deve remover isto; e não use mais
 * a base da CLYON como referência para nada — as nossas ligações são cliente »
 * profissionais como o Óscar." — 16-09-2026.
 *
 * A distância era medida da base da CLYON até ao cliente. Só que a CLYON não
 * vai lá: quem vai é o profissional, e ele parte da base DELE. Era um número
 * interno a passar por informação no ecrã de quem contrata.
 *
 * O QUE ESTES TESTES NÃO DIZEM: que a base desapareceu do preço. A estimativa
 * ainda a usa, e não pode deixar de usar alguma coisa — no momento em que se
 * calcula ainda não há profissional escolhido. Isso é uma decisão de negócio,
 * e está por tomar.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("o cliente deixa de ver a distância da base", () => {
  const CONTA = ler("src/app/conta/components/OrderDetailModal.tsx");

  it("o cartão da distância saiu", () => {
    expect(CONTA).not.toContain("order.distanceKm != null");
    expect(CONTA).not.toContain("distanceText");
  });

  it("e o do estacionamento também", () => {
    expect(CONTA).not.toContain("order.parkingDistance &&");
    expect(CONTA).not.toContain("tParking(");
  });

  it("sem deixar importações penduradas", () => {
    expect(CONTA).not.toMatch(/import \{[^}]*\bRoute\b[^}]*\} from "lucide-react"/);
    expect(CONTA).not.toMatch(/import \{[^}]*\btParking\b[^}]*\} from "@\/lib\/translations"/);
  });

  it("mas o que é dele continua lá — morada, andar, urgência", () => {
    expect(CONTA).toContain("tFloor(order.floor)");
    expect(CONTA).toContain("tUrgency(order.urgency)");
  });
});

describe("e deixa de a ver enquanto pede", () => {
  for (const f of [
    "src/app/simulador/components/OrderSummaryCard.tsx",
    "src/app/plataforma/pedir/components/OrderSummaryCard.tsx",
  ]) {
    it(`${f.split("/")[2]}: a linha «Distância da base» saiu do resumo`, () => {
      expect(ler(f)).not.toContain("Distância da base");
    });

    it(`${f.split("/")[2]}: o trajecto de uma mudança fica — esse é o dele`, () => {
      // Origem → destino é a viagem do próprio cliente, e diz-lhe alguma coisa.
      expect(ler(f)).toContain("movingDistanceStatus");
    });
  }
});

describe("quem escolhe o profissional já mede da base DELE", () => {
  it("a distribuição usa baseLat/baseLng de cada profissional", () => {
    const D = ler("src/lib/distribuir-pedido.ts");
    expect(D).toContain("p.baseLat");
    expect(D).toContain("p.baseLng");
  });
});
