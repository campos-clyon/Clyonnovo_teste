import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blocoDoClyonNaMesa } from "./trabalho-clyon-na-mesa";

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
    // d47: o link abre na língua do cliente, e continua a marcar a proposta como enviada.
    expect(CARTAO).toMatch(/void abrirWhatsAppNaLingua\(t\.telefone, proposta\.texto, token\);\s*onPropostaAberta\(\);/);
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
    // Dentro do bloco de cada acção — e só depois de a mudança ser aceite
    // (10-11-2026, d26; a ordem guarda-a `d26-tres-bugs-altos.test.ts`).
    const iValor = ROTA.indexOf("await mudarValorDoTrabalhoClyon(");
    expect(iValor).toBeGreaterThan(-1);
    const depoisDoValor = ROTA.slice(iValor, ROTA.indexOf('if (accao === "cancelar")', iValor));
    expect(depoisDoValor).toContain("await limparPropostaEnviada(pedidoId);");
    const iPreco = ROTA.indexOf("await definirPrecoAoClienteClyon(");
    expect(iPreco).toBeGreaterThan(-1);
    expect(ROTA.slice(iPreco, iPreco + 600)).toContain("await limparPropostaEnviada(pedidoId);");
  });

  it("na Mesa, «escolher» com proposta enviada vai para «A aguardar cliente»", () => {
    // …e volta para cá quando o cliente aceita o preço na app (28-10-2026, S7).
    // Desde 18-11-2026 pela regra única (trabalho-clyon-na-mesa.ts).
    expect(MESA).toContain("blocoDoClyonNaMesa(paraAMesa(t))");
    const t = { arrumado: false, bloco: "precisa" as const, fase: "escolher", propostaEnviadaEm: "2026-11-17T10:00:00Z" };
    expect(blocoDoClyonNaMesa(t)).toBe("aguardaCliente");
    expect(blocoDoClyonNaMesa({ ...t, precoAceiteEm: "2026-11-17T12:00:00Z" })).toBe("n1");
  });
});
