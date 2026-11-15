import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { perguntasDaAjuda } from "../../app-pro/src/lib/novo-modelo";
import { avisoDosDadosMudados, type VistoDoPagarAoParceiro } from "../../app-cliente/src/lib/pagar-ao-parceiro";
import { perguntasDoProfissional } from "./ajuda-plataforma";

/**
 * D27 (PARTE 3) E D28 NAS APPS — 15-11-2026.
 *
 * d27: a Ajuda da app CLYON Pro escolhia as respostas do dinheiro pelo relógio
 * do telemóvel (`perguntasDoProfissional(taxas)` com `new Date()`). Passa a
 * escolhê-las pelo que o servidor diz (`novoModelo` do perfil), como «Como
 * funciona» e a carteira. Os testes fixam o relógio longe da data do modelo,
 * para provar que ele já não conta.
 *
 * d28: o bloco «Pagar a …» da app de cliente mostra a frase do servidor quando
 * os dados de pagamento do parceiro mudaram depois de contratar — sem lógica
 * própria: com o campo, mostra; sem ele, nada.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

const ANTES = new Date("2026-11-14T23:59:00Z");
const NO_DIA = new Date("2026-11-15T09:00:00Z");
const TAXAS = { cliente: 0, profissional: 0.1 };
const quantoLeva = (l: ReturnType<typeof perguntasDaAjuda>) => l.find((q) => q.pergunta === "Quanto é que a CLYON leva?")!.resposta;

describe("d27 — a Ajuda da app Pro pelo modelo do servidor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("com o servidor no modelo novo, as respostas são as do modelo novo, seja qual for o relógio do telemóvel", () => {
    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
    const app = perguntasDaAjuda(TAXAS, true);
    expect(app).toEqual(perguntasDoProfissional(TAXAS, NO_DIA));
    expect(quantoLeva(app)).toContain("O cliente paga-lhe diretamente");
  });

  it("com o servidor no modelo antigo, as de antes, mesmo com o telemóvel depois de 15-11", () => {
    vi.setSystemTime(new Date("2027-01-10T10:00:00Z"));
    const app = perguntasDaAjuda(TAXAS, false);
    expect(app).toEqual(perguntasDoProfissional(TAXAS, ANTES));
    expect(quantoLeva(app)).not.toContain("O cliente paga-lhe diretamente");
    expect(app).not.toEqual(perguntasDaAjuda(TAXAS, true));
  });

  it("sem as taxas ainda, o mesmo modelo, com o nome da taxa sem número", () => {
    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
    expect(perguntasDaAjuda(null, true)).toEqual(perguntasDoProfissional(null, NO_DIA));
    expect(perguntasDaAjuda(null, false)).toEqual(perguntasDoProfissional(null, ANTES));
  });

  it("o ecrã lê o `novoModelo` do perfil e não chama a função do relógio", () => {
    const A = semComentarios(ler("app-pro/src/app/conta/ajuda.tsx"));
    expect(A).toContain('import { perguntasDaAjuda } from "../../lib/novo-modelo";');
    expect(A).toContain("const { perfil } = useConta();");
    expect(A).toContain("const noNovoModelo = perfil?.novoModelo != null;");
    expect(A).toContain("perguntasDaAjuda(taxas, noNovoModelo), [taxas, noNovoModelo]");
    expect(A).toContain("setTaxas(taxasDaAjuda(r.taxas));");
    expect(A).not.toContain("perguntasDoProfissional");
    expect(A).not.toContain("new Date(");
  });
});

describe("d28 — «Pagar a …» na app de cliente com os dados que mudaram", () => {
  const visto = (o: Partial<VistoDoPagarAoParceiro> = {}): VistoDoPagarAoParceiro => ({ pagaAoParceiro: true, ...o });

  it("mostra a frase só quando o servidor a manda", () => {
    expect(avisoDosDadosMudados(visto({ dadosMudaram: "Os dados mudaram." }))).toBe("Os dados mudaram.");
    expect(avisoDosDadosMudados(visto())).toBeNull();
    expect(avisoDosDadosMudados(visto({ dadosMudaram: null }))).toBeNull();
    expect(avisoDosDadosMudados(visto({ dadosMudaram: "  " }))).toBeNull();
    expect(avisoDosDadosMudados(null)).toBeNull();
    expect(avisoDosDadosMudados({ pagaAoParceiro: true, dadosMudaram: 3 } as unknown as VistoDoPagarAoParceiro)).toBeNull();
  });

  it("o bloco desenha-a antes do IBAN e do MB WAY, sem texto próprio", () => {
    const B = semComentarios(ler("app-cliente/src/componentes/PagarAoParceiro.tsx"));
    expect(B).toContain("const mudaram = avisoDosDadosMudados(visto);");
    const aviso = B.indexOf('{mudaram ? <Aviso tom="aviso" texto={mudaram} /> : null}');
    const iban = B.indexOf('rotulo="IBAN"');
    expect(aviso).toBeGreaterThan(0);
    expect(iban).toBeGreaterThan(aviso);
    const L = semComentarios(ler("app-cliente/src/lib/pagar-ao-parceiro.ts"));
    expect(L).toContain("dadosMudaram?: string | null;");
    expect(L).not.toMatch(/mudaram[^\n]*["«]O[s]? dados/);
  });
});
