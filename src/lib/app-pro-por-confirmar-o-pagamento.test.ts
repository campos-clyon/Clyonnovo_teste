import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROTULOS_DA_CARTEIRA } from "./rotulos-da-carteira";
import type { GrupoDaLinha, ResumoDaCarteira } from "./trabalhos-da-carteira";
import type { LinhaDaCarteira as LinhaDaApp, RespostaDaCarteira } from "../../app-pro/src/lib/conta";

/*
 * «POR CONFIRMAR O PAGAMENTO» NA APP PRO — 27-11-2026 (o #558).
 *
 * O servidor (a3904d06) passou a devolver o grupo «por_confirmar»: feito e
 * confirmado, sem registo de a quem o cliente pagou, nada por receber. A app
 * punha em «Por receber» tudo o que não estava recebido, e o #558 aparecia lá
 * com 0,00 €. Agora tem separador próprio, como o painel, e a linha de cima
 * «o cliente ainda não pagou» deixa de o contar.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const ECRA = ler("app-pro/src/app/(app)/carteira.tsx");

describe("app Pro — «por confirmar o pagamento» à parte (o #558)", () => {
  it("os grupos e o resumo da app aceitam o que o servidor devolve", () => {
    const g: GrupoDaLinha = "por_confirmar";
    const daApp: LinhaDaApp["grupo"] = g;
    expect(daApp).toBe("por_confirmar");
    const r: ResumoDaCarteira["porConfirmarOPagamento"] = 90;
    const naApp: NonNullable<RespostaDaCarteira["resumo"]>["porConfirmarOPagamento"] = r;
    expect(naApp).toBe(90);
  });

  it("«Por receber» só leva os por receber e os retidos; «Por confirmar» tem separador próprio, só quando há", () => {
    expect(ECRA).toContain('l.grupo === "por_receber" || l.grupo === "retido"');
    expect(ECRA).toContain('g === "por_confirmar" ? l.grupo === "por_confirmar"');
    expect(ECRA).toContain('doGrupo("por_confirmar").length > 0 ? ["por_receber", "por_confirmar", "recebido"] : ["por_receber", "recebido"]');
    expect(ECRA).toContain('g === "por_confirmar" ? "Por confirmar"');
    // Já não há o filtro antigo «tudo o que não está recebido».
    expect(ECRA).not.toContain('l.grupo !== "recebido"');
  });

  it("mostra o que recebe (nunca 0,00 €) e a nota a âmbar, como o painel", () => {
    expect(ECRA).toContain('euros(l.grupo === "recebido" || l.grupo === "por_confirmar" ? l.recebe : l.falta)');
    expect(ECRA).toContain('l.grupo === "retido" || l.grupo === "por_confirmar" ? c.aviso : c.tinta');
  });

  it("«o cliente ainda não pagou» sem os por confirmar, e a linha «Por confirmar o pagamento» à parte", () => {
    expect(ECRA).toContain("const porCobrar = dados.resumo ? dados.resumo.clienteAindaNaoPagou : k.porCobrar;");
    expect(ECRA).toContain("const porConfirmar = dados.resumo?.porConfirmarOPagamento ?? 0;");
    expect(ECRA).toContain("<Linha rotulo={R.porConfirmarOPagamento.rotulo} nota={R.porConfirmarOPagamento.nota} valor={porConfirmar}");
    expect(ROTULOS_DA_CARTEIRA.porConfirmarOPagamento.rotulo).toBe("Por confirmar o pagamento");
  });
});
