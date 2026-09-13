import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O cartão das empresas, por baixo do resumo do pedido.
 *
 * "Crie aqui no canto inferior direito, logo abaixo de «Resumo do pedido»,
 * uma opção para as empresas enviar pedidos por e-mails" — 13-09-2026.
 *
 * O que se guarda aqui é a LIGAÇÃO, que é o que se perde sem se dar por isso:
 * o cartão desenhado nos dois sítios (a barra lateral esconde-se no telemóvel),
 * e a rota a gravar o lead além de mandar o email. A aparência muda quando
 * alguém quiser; isto não pode mudar por descuido.
 */

const raiz = join(process.cwd(), "src", "app");
const form = readFileSync(join(raiz, "simulador", "SimulatorThreePhaseForm.tsx"), "utf8");
const rota = readFileSync(join(raiz, "api", "pedido-de-empresa", "route.ts"), "utf8");
const cartao = readFileSync(
  join(raiz, "simulador", "components", "PedidoDeEmpresaCard.tsx"),
  "utf8",
);

describe("o cartão está desenhado onde foi pedido", () => {
  it("vem importado no simulador", () => {
    expect(form).toContain('import PedidoDeEmpresaCard from "./components/PedidoDeEmpresaCard"');
  });

  it("aparece logo por baixo do «Resumo do pedido»", () => {
    const depoisDoResumo = form.slice(form.indexOf("<OrderSummaryCard"));
    expect(depoisDoResumo.indexOf("<PedidoDeEmpresaCard />")).toBeGreaterThan(-1);
  });

  it("aparece duas vezes — a barra lateral esconde-se no telemóvel", () => {
    const vezes = form.split("<PedidoDeEmpresaCard />").length - 1;
    expect(vezes).toBe(2);
  });

  it("e uma delas está no bloco que só o telemóvel vê", () => {
    expect(form).toMatch(/lg:hidden[\s\S]{0,400}<PedidoDeEmpresaCard \/>/);
  });
});

describe("o pedido vai aos dois sítios", () => {
  it("grava o lead, para não viver só numa caixa de correio", () => {
    expect(rota).toContain("createLead(");
    expect(rota).toContain('origem: "cartao_empresas_simulador"');
  });

  it("manda o email para a CLYON", () => {
    expect(rota).toContain("BUSINESS_EMAIL");
  });

  it("responder ao email vai ter à empresa, não ao noreply", () => {
    expect(rota).toContain("replyTo: email");
  });

  it("tem trava de repetição, como a rota de contacto", () => {
    expect(rota).toContain("checkRateLimit(");
  });

  it("escapa o que a empresa escreveu antes de o pôr no HTML", () => {
    expect(rota).toContain('import { e } from "@/lib/escapar-html"');
    expect(rota).toContain("e(empresa)");
    expect(rota).toContain("e(email)");
  });
});

describe("o cartão fala com a rota certa", () => {
  it("envia para /api/pedido-de-empresa", () => {
    expect(cartao).toContain('fetch("/api/pedido-de-empresa"');
  });

  it("não promete resposta imediata a quem escreve fora de horas", () => {
    expect(cartao).toContain("próximo dia útil");
  });
});
