import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jaFoiDito, HORAS_SEM_REPETIR, type SaidaGravada } from "./nao-repetir";

/**
 * A CONVERSA ESTAVA GRAVADA, E O CÉREBRO NUNCA A ABRIA.
 *
 * Tudo o que entra e sai fica em `whatsappMensagens`, e há um leitor pronto —
 * `mensagensDoNumeroWhatsApp`. Só que era importado num sítio só: o painel.
 * `tratarMensagemDoCliente` não sabia o que já tinha dito a este número, nem
 * quando, nem quantas vezes.
 *
 * "Também não deve repetir informação." — 13-09-2026.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const AGORA = new Date("2026-09-13T15:00:00.000Z");
const ECRA = "Pedido #311 — o que já recebeu:\n• Manuel: 148,57 € (à sua espera)";

const saida = (texto: string, hEmAtraso: number): SaidaGravada => ({
  direccao: "out",
  texto,
  criadoEm: new Date(AGORA.getTime() - hEmAtraso * 3600_000).toISOString(),
});

describe("o mesmo texto não sai duas vezes na mesma janela", () => {
  it("o ecrã que saiu há uma hora não volta a sair", () => {
    expect(jaFoiDito(ECRA, [saida(ECRA, 1)], AGORA)).toBe(true);
  });

  it("passada a janela, já é notícia outra vez", () => {
    expect(jaFoiDito(ECRA, [saida(ECRA, HORAS_SEM_REPETIR + 1)], AGORA)).toBe(false);
  });

  it("um ecrã diferente sai sempre — é o estado que mudou", () => {
    const outro = "Pedido #311 — o que já recebeu:\n• Manuel: 300,00 € (à sua espera)";
    expect(jaFoiDito(outro, [saida(ECRA, 1)], AGORA)).toBe(false);
  });

  it("espaços e maiúsculas não fazem de uma repetição uma novidade", () => {
    expect(jaFoiDito(ECRA, [saida(ECRA.toUpperCase().replace(/\n/g, "  \n "), 1)], AGORA)).toBe(true);
  });
});

describe("o que a guarda não pode fazer", () => {
  it("não se cala por causa do que o CLIENTE escreveu", () => {
    // Se ele mandar de volta o texto do ecrã, isso não é a CLYON a repetir-se.
    const dele: SaidaGravada = { direccao: "in", texto: ECRA, criadoEm: saida(ECRA, 1).criadoEm };
    expect(jaFoiDito(ECRA, [dele], AGORA)).toBe(false);
  });

  it("uma data ilegível não cala o assistente — na dúvida, fala", () => {
    const estragada: SaidaGravada = { direccao: "out", texto: ECRA, criadoEm: "nao-e-uma-data" };
    expect(jaFoiDito(ECRA, [estragada], AGORA)).toBe(false);
  });

  it("sem histórico nenhum, fala", () => {
    expect(jaFoiDito(ECRA, [], AGORA)).toBe(false);
  });

  it("texto vazio não conta como repetição", () => {
    expect(jaFoiDito("   ", [saida("   ", 1)], AGORA)).toBe(false);
  });
});

describe("está ligada ao caminho que se repetia", () => {
  const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");

  it("todo o ponto de situação passa por lá", () => {
    expect(CEREBRO).toContain("async function mandarOEcra(");
    expect(CEREBRO).toContain("mensagensDoNumeroWhatsApp(telefone, 20)");
  });

  /*
   * E COMPARA-SE O QUE FICA GRAVADO, NÃO O QUE SE ESCREVEU.
   *
   * O envio passa por `paraTeclado` antes de registar: troca o travessão por
   * hífen e as aspas curvas por rectas. O texto escrito tem «Pedido #318 — o
   * que já recebeu» e o gravado tem «Pedido #318 - o que já recebeu».
   * Comparados assim nunca batiam, e esta guarda nunca disparou: uma cliente
   * levou o mesmo ecrã às 14:50 e às 14:54.
   */
  it("compara a forma que vai para a base, e não a de origem", () => {
    expect(CEREBRO).toContain("jaFoiDito(paraTeclado(texto), gravadas, new Date())");
  });

  /*
   * E SÓ O PONTO DE SITUAÇÃO. Uma proposta nova, um fecho ou um aviso de data
   * têm as suas próprias chaves de duplicação — que travam a MESMA novidade e
   * deixam passar uma novidade diferente com o mesmo aspecto. Trocar uma coisa
   * pela outra emudecia o assistente quando ele tinha alguma coisa a dizer.
   */
  it("não se pendurou nos avisos, que já têm a sua própria guarda", () => {
    expect(CEREBRO).toContain("podeContarPelaPrimeiraVez");
    const i = CEREBRO.indexOf("async function mandarOEcra(");
    const bloco = CEREBRO.slice(i, CEREBRO.indexOf("async function ecraDoPedido(", i));
    expect(bloco).not.toContain("podeContarPelaPrimeiraVez");
  });

  it("uma base em baixo não impede o assistente de responder", () => {
    expect(CEREBRO).toContain(".catch(() => [])");
  });
});
