import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAXIMO_DE_FOTOS_DO_PEDIDO,
  fotografiasProntas,
  haFotografiasACarregar,
  quantasCabem,
  type FotografiaNoFormulario,
} from "./fotografias-do-pedido";

/**
 * d37, 15-11-2026 — AS FOTOGRAFIAS NO BACKOFFICE.
 *
 * 1) Tocar numa miniatura abre-a em grande: o visor partilhado, com setas,
 *    teclas, deslizar, contador e «Abrir original»; o ✕ de tirar é outro botão.
 * 2) O «+» do formulário «Editar pedido» está sempre lá: escolher mais enquanto
 *    outras sobem; cada uma diz como está; gravar espera pelas que sobem.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem comentários de linha nem de bloco, para um comentário não fazer passar o teste. */
const semComentarios = (t: string) =>
  // Ancorada ao início da linha: «image/*» no `accept` não é um comentário.
  t.replace(/^[ \t]*(\{[ \t]*)?\/\*[\s\S]*?\*\/([ \t]*\})?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const VISOR = semComentarios(ler("src/components/VisorDeFotos.tsx"));
const FORM = semComentarios(ler("src/components/admin/RegistarPedido.tsx"));

const item = (estado: FotografiaNoFormulario["estado"], url?: string): FotografiaNoFormulario => ({
  chave: url ?? Math.random().toString(36),
  estado,
  nome: "x.jpg",
  ficheiro: estado === "pronta" ? { url: url ?? "u", name: "x.jpg", size: 1 } : undefined,
});

describe("a conta das fotografias do pedido", () => {
  it("só as prontas seguem no pedido, pela ordem", () => {
    const itens = [item("pronta", "a"), item("a-carregar"), item("falhou"), item("pronta", "b")];
    expect(fotografiasProntas(itens).map((f) => f.url)).toEqual(["a", "b"]);
  });

  it("sabe quando ainda há alguma a subir", () => {
    expect(haFotografiasACarregar([item("pronta", "a"), item("falhou")])).toBe(false);
    expect(haFotografiasACarregar([item("pronta", "a"), item("a-carregar")])).toBe(true);
  });

  it("respeita o máximo e diz quantas ficaram de fora", () => {
    expect(MAXIMO_DE_FOTOS_DO_PEDIDO).toBe(12);
    expect(quantasCabem(0, 5)).toEqual({ entram: 5, ficamDeFora: 0 });
    expect(quantasCabem(10, 5)).toEqual({ entram: 2, ficamDeFora: 3 });
    expect(quantasCabem(12, 1)).toEqual({ entram: 0, ficamDeFora: 1 });
  });

  it("as rotas cortam pelo mesmo número que o ecrã mostra", () => {
    for (const p of ["src/app/api/admin/pedidos/criar/route.ts", "src/app/api/admin/pedidos/[id]/editar/route.ts"]) {
      const R = ler(p);
      expect(R).toContain(".slice(0, MAXIMO_DE_FOTOS_DO_PEDIDO)");
      expect(R).not.toContain(".slice(0, 12)");
    }
  });
});

describe("regra 1 — ver em grande, num só visor", () => {
  it("o visor desliza no telemóvel", () => {
    expect(VISOR).toContain("onTouchStart=");
    expect(VISOR).toContain("onTouchEnd=");
    expect(VISOR).toMatch(/if \(dx < 0\) seguinte\(\);\s*else anterior\(\);/);
  });

  it("tem «Abrir original» num separador novo, com a url tal como subiu", () => {
    expect(VISOR).toMatch(/<a\s+href=\{url\}\s+target="_blank"\s+rel="noopener noreferrer"/);
    expect(VISOR).toContain("Abrir original");
  });

  it("o Escape do visor não fecha a janela de trás", () => {
    expect(VISOR).toContain('window.addEventListener("keydown", tecla, true)');
    expect(VISOR).toContain("e.stopPropagation()");
  });

  it("o formulário abre as miniaturas no visor partilhado", () => {
    expect(FORM).toContain("<VisorDeFotos");
    expect(FORM).toContain("onAbrir={() => setFotoAberta(ondeNoVisor)}");
  });

  it("o ✕ de tirar é um botão à parte, irmão da miniatura e não dentro dela", () => {
    const i = FORM.indexOf("onAbrir={() => setFotoAberta(ondeNoVisor)}");
    const fimDaMiniatura = FORM.indexOf("/>", i);
    const tirar = FORM.indexOf("onClick={() => tirarFotografia(ft.chave)}");
    expect(i).toBeGreaterThan(0);
    expect(tirar).toBeGreaterThan(fimDaMiniatura);
    expect(FORM).toContain("aria-label={`Tirar a fotografia ${idx + 1}`}");
  });

  it("o ajuste no local também abre as fotografias no visor", () => {
    const A = semComentarios(ler("src/components/admin/AjusteNaFicha.tsx"));
    expect(A).toContain("<VisorDeFotos");
    expect(A).not.toContain('target="_blank"');
  });
});

describe("regra 2 — o «+» sempre activo, e cada fotografia com o seu estado", () => {
  it("o «+» já não vira rodinha enquanto outras sobem", () => {
    expect(FORM).not.toContain("aEnviarFotos");
    const mais = FORM.slice(FORM.indexOf("aria-disabled={cheioDeFotos}"), FORM.indexOf("ref={seletorDeFotos}"));
    expect(mais).toContain("+");
    expect(mais).not.toContain("Loader2");
    // Só o máximo o desliga.
    expect(FORM).toContain("disabled={cheioDeFotos}");
    expect(FORM).toContain("itensDasFotos.length >= MAXIMO_DE_FOTOS_DO_PEDIDO");
  });

  it("escolhe várias de uma vez e limpa o seletor logo, não no fim do envio", () => {
    expect(FORM).toContain("multiple");
    const escolher = FORM.slice(FORM.indexOf("function escolherFotos"), FORM.indexOf("function tentarOutraVez"));
    expect(escolher.indexOf('seletorDeFotos.current.value = ""')).toBeLessThan(escolher.indexOf("porNaFila("));
    expect(escolher).toContain("quantasCabem(");
  });

  it("cada fotografia diz se está a carregar, se falhou (com «Tentar outra vez») ou se está pronta", () => {
    expect(FORM).toContain('ft.estado === "a-carregar"');
    expect(FORM).toContain('ft.estado === "falhou"');
    expect(FORM).toContain('ft.estado === "pronta"');
    expect(FORM).toContain("Tentar outra vez");
    expect(FORM).toContain("onClick={() => tentarOutraVez(ft.chave)}");
  });

  it("diz o limite junto ao «+»", () => {
    expect(FORM).toContain("{itensDasFotos.length} de {MAXIMO_DE_FOTOS_DO_PEDIDO}");
  });

  it("gravar espera pelas que ainda sobem, e grava só as prontas que ficaram depois", () => {
    const calc = FORM.slice(FORM.indexOf("async function calcular()"), FORM.indexOf("async function enviar()"));
    const espera = calc.indexOf("await filaDasFotos.current");
    const prontas = calc.indexOf("fotografiasProntas(itensRef.current)");
    const pedido = calc.indexOf("await fetch(");
    expect(espera).toBeGreaterThan(0);
    expect(prontas).toBeGreaterThan(espera);
    expect(pedido).toBeGreaterThan(prontas);
    expect(FORM).toContain("À espera das fotografias…");
  });
});
