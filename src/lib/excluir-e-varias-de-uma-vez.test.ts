import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * EXCLUIR, E VÁRIAS DE UMA VEZ — 23-10-2026.
 *
 * *«Esse pedido do número com final 398, o cliente desistiu. Devia ter um
 * botão para excluir o pedido e, aqui no assistente, todos os dados — e caso
 * o cliente voltasse a contactar, começava do zero, como se não soubéssemos
 * nada dele. E marcar vários e excluir vários de uma vez; e não só excluir:
 * quando marcar vários, ter as opções todas que criámos.»* — o dono, sobre o
 * pedido #484 («já tive aqui uma oferta e aceitei»).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const DB = ler("src/lib/db.ts");
const ROTA = semComentarios(ler("src/app/api/admin/whatsapp/route.ts"));
const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");

function corpoDe(fonte: string, nome: string): string {
  const i = fonte.indexOf(`export async function ${nome}(`);
  expect(i, nome).toBeGreaterThan(-1);
  return semComentarios(fonte.slice(i, fonte.indexOf("\n}\n", i)));
}

describe("excluir — a Vitória esquece o número", () => {
  const ESQUECER = corpoDe(DB, "esquecerNumeroWhatsApp");

  it("apaga a conversa e tudo o que a faria continuar, e devolve a palavra à Vitória", () => {
    expect(ESQUECER).toContain("await apagarConversaWhatsApp(digitos);");
    // Sem isto ficava «entregue a uma pessoa», e a Vitória calada quando ele voltasse.
    expect(ESQUECER).toContain("await retomarNumeroWhatsApp(digitos);");
    expect(ESQUECER).toContain("DELETE FROM whatsappFotosPendentes");
    expect(ESQUECER).toContain("await apagarFotosDoBlob(");
    expect(ESQUECER).toContain("DELETE FROM whatsappLinguas");
  });

  it("os pedidos vão pelo apagar de sempre — com arquivo dos apagados e registo", () => {
    expect(ESQUECER).toContain("await deleteSimulatorOrder(Number(p.id), {");
    expect(ESQUECER).toContain('motivo: "excluído com a conversa do WhatsApp (o cliente desistiu)"');
  });

  it("os pedidos com trabalho combinado ou pago ficam — são a história do dinheiro", () => {
    expect(ESQUECER).toContain("n.estado = 'acordada' OR n.pagoEm IS NOT NULL");
    expect(ESQUECER).toContain("pedidos.filter((x) => Number(x.comTrabalho) !== 1)");
  });

  it("e com trabalho combinado num pedido ainda aberto, não se exclui nada — antes de apagar o que quer que seja", () => {
    const recusa = ESQUECER.indexOf("if (aberto) throw new NumeroComTrabalhoAberto(");
    expect(recusa).toBeGreaterThan(-1);
    expect(recusa).toBeLessThan(ESQUECER.indexOf("await deleteSimulatorOrder("));
    expect(recusa).toBeLessThan(ESQUECER.indexOf("await apagarConversaWhatsApp("));
  });

  it("o bloqueio fica — é uma decisão em vigor", () => {
    expect(ESQUECER).not.toContain("whatsappBloqueados");
    expect(ESQUECER).not.toContain("desbloquear");
  });

  it("e «Apagar conversa» continua a não devolver a palavra a ninguém", () => {
    const APAGAR = corpoDe(DB, "apagarConversaWhatsApp");
    expect(APAGAR).not.toContain("whatsappInterrompidos");
  });
});

describe("a rota: uma acção, a uma ou a várias", () => {
  it("os botões da linha e as várias de uma vez passam pela mesma `naConversa`", () => {
    expect(ROTA).toContain('if (accao === "emLote") {');
    expect(ROTA).toContain("const feito = await naConversa(deCada, t, nota, colab?.nome ?? null);");
    expect(ROTA).toContain("const feito = await naConversa(accao, telefone, nota, colab?.nome ?? null);");
    for (const a of ["respondida", "fechar", "reabrir", "guardar", "desguardar", "retomar", "interromper", "excluir"]) {
      expect(ROTA, a).toMatch(new RegExp(`ACCOES_EM_LOTE = \\[[^\\]]*"${a}"`));
    }
  });

  it("excluir é só do administrador — sozinha ou em lote", () => {
    expect(ROTA).toContain('if (deCada === "excluir" && colab?.papel !== "admin") {');
    expect(ROTA).toContain('if (accao === "excluir" && colab?.papel !== "admin") {');
    expect(ROTA).toContain('{ error: "Só um administrador pode excluir conversas." }, { status: 403 }');
  });

  it("uma que falhe não trava as outras, e o que não cabe nos 60 s fica dito", () => {
    expect(ROTA).toContain("r.falhas.push({ telefone: t, porque:");
    expect(ROTA).toContain("if (Date.now() - comecou > 45_000) {");
    expect(ROTA).toContain("telefones.length === 0 || telefones.length > 300");
  });

  it("e as acções de sempre continuam lá: fechar com o porquê, guardar com a nota", () => {
    expect(ROTA).toContain('await arquivarConversaWhatsApp(telefone, true, { motivo: nota ?? null, porQuem: "equipa" });');
    expect(ROTA).toContain("await guardarConversaWhatsApp(telefone, true, nota ?? null);");
    expect(ROTA).toContain('await marcarRespondidaWhatsApp(telefone, accao === "respondida");');
  });
});

describe("o painel: marcar, e o que se faz às marcadas", () => {
  it("cada linha tem a caixa, e há «Marcar todas»", () => {
    expect(PAINEL).toContain("checked={marcadas.has(l.telefone)}");
    expect(PAINEL).toContain("`Marcar todas (${visiveis.length})`");
    // Mudar de separador desmarca: as marcadas são as do separador aberto.
    expect(PAINEL).toMatch(/setSeparador\(s\.id\);\s*setConversaAberta\(null\);\s*setMarcadas\(new Set\(\)\);/);
  });

  it("a barra tem os botões da linha, para todas de uma vez", () => {
    for (const a of ['emLote("respondida"', 'emLote("fechar"', 'emLote("reabrir"', 'emLote("guardar"', 'emLote("desguardar"', 'emLote("retomar"', 'emLote("interromper"']) {
      expect(PAINEL, a).toContain(a);
    }
  });

  it("excluir pergunta antes, diz o que leva, e só aparece ao administrador", () => {
    expect(PAINEL).toContain("const eAdmin = useEAdministrador();");
    expect(PAINEL).toContain("onClick={() => excluir(telefones, pedidos)}");
    expect(PAINEL).toContain("onClick={() => excluir([l.telefone], l.pedido ? [l.pedido.id] : [])}");
    expect(PAINEL).toContain("se o cliente voltar a escrever, começa do zero");
    expect(PAINEL).toContain("Os pedidos apagados ficam no arquivo dos apagados (Configs). Não se desfaz.");
    expect(PAINEL.match(/\{eAdmin && \(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("no fim diz o que aconteceu — e as que falharam ficam marcadas", () => {
    expect(PAINEL).toContain("Pedidos apagados: ");
    expect(PAINEL).toContain("setMarcadas(new Set(falhas.map((f) => f.telefone)));");
  });
});
