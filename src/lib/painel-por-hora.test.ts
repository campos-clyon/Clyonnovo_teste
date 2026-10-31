import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O PAINEL DO PROFISSIONAL NUM PEDIDO POR HORA — 31-10-2026 (ordem do CEO com
 * o sim do dono). O caso #536: «240,30 €» ao lado de «121,99 € por hora». Num
 * pedido por hora todos os valores levam «/hora» e o total estimado ao lado;
 * a proposta leva os materiais; o bloco das horas grava pela rota; e o «Está
 * feito» espera pelas horas.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const TRABALHOS = ler("src/app/profissionais/painel/Trabalhos.tsx");
const HORAS = ler("src/app/profissionais/painel/HorasDoTrabalho.tsx");
const NEGOCIACAO = ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx");
const MATERIAIS = ler("src/app/profissionais/pedidos/[token]/CamposDosMateriais.tsx");
const LINK = ler("src/app/profissionais/pedidos/[token]/page.tsx");

describe("valores por hora, com o total estimado ao lado", () => {
  it("o cartão e o detalhe colam «/hora» e mostram o total estimado (totalEstimadoCurto)", () => {
    const sufixo = TRABALHOS.slice(TRABALHOS.indexOf("function sufixoDe"), TRABALHOS.indexOf("function estimadoDe"));
    expect(sufixo).toContain('b === "hora" ? "/hora" : b === "carga" ? "/carga" : ""');
    expect(TRABALHOS).toContain("totalEstimadoCurto(v, p.horasPrevistas ?? null)");
    // O número grande do cartão e o do detalhe levam a unidade e o total.
    expect(TRABALHOS.match(/\{sufixoDe\(p\)\}/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(TRABALHOS.match(/\{sufixoDe\(pedido\)\}/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(TRABALHOS).toContain("total {estimadoDe(p,");
    expect(TRABALHOS).toContain("total {estimadoDe(pedido,");
  });

  it("com as horas confirmadas o valor fechado é o total das horas, sem «/hora»", () => {
    expect(TRABALHOS).toContain('if (b === "hora" && p.porHora?.confirmadas) return "";');
    expect(TRABALHOS).toContain('"total das horas"');
  });

  it("a negociação (painel e link do email) usa o sufixo nos atalhos e nos valores", () => {
    expect(NEGOCIACAO).toContain('const sufixo = base === "hora" ? "/hora" : base === "carga" ? "/carga" : "";');
    expect(NEGOCIACAO.match(/sufixo=\{sufixo\}/g)?.length).toBe(2);
    expect(NEGOCIACAO).toContain("totalEstimadoCurto(v, horasPrevistas)");
    expect(NEGOCIACAO).toContain("{eu(sugestaoAberta.precoSugerido)}");
    expect(NEGOCIACAO).not.toMatch(/\{euros\(sugestaoAberta\.precoSugerido\)\}/);
    expect(NEGOCIACAO).not.toMatch(/Aceitar \{euros\(valorEmCima\)\}/);
    expect(TRABALHOS).toContain("base={lerBase(pedido.baseDoPreco)}");
    expect(TRABALHOS).toContain("horasPrevistas={pedido.horasPrevistas ?? null}");
    expect(LINK).toContain("horasPrevistas={horasPrevistasDaLinha(");
  });
});

describe("os materiais na proposta", () => {
  it("o corpo de propor e aceitar leva `materiais`", () => {
    expect(NEGOCIACAO).toContain('materiais: accao === "propor" || accao === "aceitar" ? materiaisParaEnviar(materiais) : undefined');
    expect(MATERIAIS).toContain("PERGUNTA_DOS_MATERIAIS");
    expect(MATERIAIS).toContain("MATERIAIS_DE_PARTIDA");
    expect(MATERIAIS).toContain('if (e.resposta === "sim") return { incluidos: true };');
    expect(MATERIAIS).toContain("{ incluidos: false, itens }");
  });
  it("numa mudança a pergunta tem resposta antes de propor", () => {
    expect(NEGOCIACAO).toContain('const eMudanca = servico === "mudanca";');
    expect(NEGOCIACAO).toMatch(/if \(eMudanca && !ofertaClyon && \(accao === "propor" \|\| accao === "aceitar"\) && !materiaisParaEnviar\(materiais\)\)/);
  });
});

describe("o bloco das horas e o «Está feito»", () => {
  it("dois campos editáveis que grava pela rota das horas — sem cronómetro", () => {
    expect(HORAS).toContain('fetch("/api/profissionais/trabalho/horas"');
    expect(HORAS.match(/type="time"/g)?.length).toBe(1); // um `campo` usado duas vezes
    expect(HORAS).toContain("campo(HORA_DE_INICIO, inicio, setInicio)");
    expect(HORAS).toContain("campo(HORA_DE_FIM, fim, setFim)");
    expect(HORAS).toContain("if (!valor) mudar(agoraNoCampo());");
    expect(HORAS).not.toMatch(/setInterval|requestAnimationFrame/);
  });
  it("o «Está feito» de um trabalho por hora depende de podeDarPorFeito", () => {
    expect(TRABALHOS).toContain("{pedido.porHora && !pedido.porHora.podeDarPorFeito ? (");
    expect(TRABALHOS).toContain("{MARQUE_AS_HORAS_PRIMEIRO}");
    expect(TRABALHOS).toContain("<HorasDoTrabalho pedido={pedido} onGravou={onRecarregar} />");
  });
});
