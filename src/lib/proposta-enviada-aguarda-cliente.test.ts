import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * «Os pedidos que já enviamos os orçamentos, tanto em "Enviar proposta ao
 * cliente" quanto em "Enviar pela CLYON", devem sair de PRECISA DE SI e ir
 * para A AGUARDAR CLIENTE» — o dono, 21-10-2026.
 */
const ler = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/admin/trabalhos-clyon/route.ts");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const CARTAO = ler("src/components/admin/TrabalhoClyon.tsx");

describe("a proposta enviada leva o valor fixo para «A aguardar cliente»", () => {
  it("a base guarda quando a proposta foi ao cliente", () => {
    expect(DB).toContain("ALTER TABLE simulatorOrders ADD COLUMN propostaEnviadaEm DATETIME NULL DEFAULT NULL");
    expect(DB).toContain("o.propostaEnviadaEm,");
    expect(DB).toContain("propostaEnviadaEm: data(p.propostaEnviadaEm),");
  });

  it("os dois botões marcam-na: o «Enviar pela CLYON» e o link do WhatsApp", () => {
    const daClyon = ROTA.slice(ROTA.indexOf('if (accao === "proposta")'), ROTA.indexOf('if (accao === "proposta_aberta")'));
    expect(daClyon).toContain("await marcarPropostaEnviada(pedidoId);");
    expect(ROTA).toContain('if (accao === "proposta_aberta")');
    expect(CARTAO).toContain("onClick={onPropostaAberta}");
    expect(CARTAO).toContain('mexer({ accao: "proposta_aberta" }');
  });

  it("«Já enviei» marca-a sem mandar nada, e só aparece enquanto não foi", () => {
    const jaEnviei = ROTA.slice(ROTA.indexOf('if (accao === "ja_enviei")'), ROTA.indexOf('if (accao === "proposta_aberta")'));
    expect(jaEnviei).toContain("await marcarPropostaEnviada(pedidoId);");
    expect(jaEnviei).not.toContain("enviarTextoManualWhatsApp");
    expect(CARTAO).toContain("{proposta && !t.propostaEnviadaEm && (");
    expect(CARTAO).toContain('mexer({ accao: "ja_enviei" }');
  });

  it("mudar o valor ou o preço volta a pô-la por enviar", () => {
    const depoisDoValor = ROTA.slice(ROTA.indexOf("await mudarValorDoTrabalhoClyon("));
    expect(depoisDoValor.slice(0, 700)).toContain("await limparPropostaEnviada(pedidoId);");
    const depoisDoPreco = ROTA.slice(ROTA.indexOf("await definirPrecoAoClienteClyon("));
    expect(depoisDoPreco.slice(0, 200)).toContain("await limparPropostaEnviada(pedidoId);");
  });

  it("na Mesa, «escolher» com proposta enviada vai para «A aguardar cliente»", () => {
    // …e volta para cá quando o cliente aceita o preço na app (28-10-2026, S7).
    expect(MESA).toContain(
      'b === "precisa" && t.resumo.fase === "escolher" && t.propostaEnviadaEm && !t.precoAceiteEm',
    );
    expect(MESA).toContain('? "aguardaCliente"');
  });
});
