import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { grupoPorIdade, DIAS_ATE_ARREFECER } from "./idade-do-pedido";

/**
 * A lista dos pedidos que ainda não foram a lado nenhum.
 *
 * Era uma lista corrida, sem fim e sem hierarquia. O cabeçalho dizia "1 pedidos
 * na plataforma" e por baixo despejava quinze pedidos de dez dias atrás, todos
 * com o mesmo aspecto e o mesmo botão. E não havia forma de tirar nenhum dali:
 * um pedido que nunca ia ser enviado ficava a ocupar atenção para sempre.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const ROTA = ler("src/app/api/admin/negociacoes/promover/route.ts");
const DB = ler("src/lib/db.ts");

const AGORA = new Date("2026-08-23T12:00:00Z");
const haDias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000);

describe("a idade de um pedido por enviar", () => {
  it("hoje é hoje", () => {
    expect(grupoPorIdade(haDias(0), AGORA)).toBe("hoje");
    expect(grupoPorIdade(haDias(0.9), AGORA)).toBe("hoje");
  });

  it("de ontem até aos sete dias é a semana", () => {
    expect(grupoPorIdade(haDias(1), AGORA)).toBe("semana");
    expect(grupoPorIdade(haDias(6.9), AGORA)).toBe("semana");
  });

  it("a partir dos sete dias é antigo", () => {
    // A fronteira é fechada em cima: exactamente sete dias já é antigo.
    expect(grupoPorIdade(haDias(DIAS_ATE_ARREFECER), AGORA)).toBe("antigo");
    expect(grupoPorIdade(haDias(30), AGORA)).toBe("antigo");
  });

  it("uma data que não se percebe não passa por recente", () => {
    // Seria pôr lixo à frente do pedido que chegou há dez minutos.
    expect(grupoPorIdade("nao e uma data", AGORA)).toBe("antigo");
  });
});

describe("o ecrã", () => {
  it("agrupa por idade em vez de despejar tudo", () => {
    expect(PAINEL).toContain("grupoPorIdade");
    expect(PAINEL).toContain("ROTULO_DO_GRUPO");
  });

  it("usa a regra da biblioteca e não uma cópia", () => {
    expect(PAINEL).toContain('from "@/lib/idade-do-pedido"');
  });

  it("nasce com os antigos fechados", () => {
    /*
     * São os que menos merecem atenção e quase sempre os mais numerosos. Se
     * nascessem abertos, o ecrã ficava exactamente como estava.
     */
    expect(PAINEL).toContain("useState(false)");
    expect(PAINEL).toContain("antigosAbertos");
  });

  it("deixa procurar", () => {
    expect(PAINEL).toContain("Procurar por nome, cidade, serviço ou número");
  });

  it("tem arquivar por linha e apagar por selecção", () => {
    expect(PAINEL).toContain("onArquivar");
    expect(PAINEL).toContain("arquivarPedido");
    expect(PAINEL).toContain("apagarPedidos");
  });

  it("arquivar é a acção normal e apagar a excepção", () => {
    /*
     * Arquivar mantém o registo: daqui a três meses ainda se sabe que houve um
     * pedido de móveis em Almada que ninguém enviou, e o histórico do cliente
     * não muda. Apagar é para o que não devia ter existido.
     *
     * No ecrã isso lê-se: arquivar tem botão próprio em cada linha, apagar
     * exige marcar a caixa primeiro.
     */
    expect(PAINEL).toContain("Arquivar — sai da lista, mantém o registo");
    expect(PAINEL).toContain("marcados.size > 0");
  });
});

describe("os números do cabeçalho", () => {
  it("a lista deixou de estar limitada a vinte", () => {
    /*
     * Com vinte, o painel mostrava uma janela e calava o resto: arquivar um
     * pedido fazia aparecer outro vindo do fundo da fila, e o contador novo
     * seria uma mentira do tamanho da diferença.
     */
    expect(ROTA).toContain("pedidosPorPromover(100)");
  });

  it("um pedido arquivado sai mesmo da lista", () => {
    // É isto que faz o botão de arquivar valer alguma coisa: sem esta condição,
    // arquivar não mudava nada no ecrã.
    const q = DB.slice(DB.indexOf("export async function pedidosPorPromover"));
    expect(q).toContain("'cancelado', 'concluido', 'arquivado'");
  });
});
