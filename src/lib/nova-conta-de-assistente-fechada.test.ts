import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «Coloque o Nova conta de assistente dentro de um botão, para só abrir
 * quando quiser.» — o dono, 17-10-2026.
 *
 * d81, 21-11-2026: o botão passou para o topo, à direita do título
 * «Assistentes», e abre (ou fecha) o formulário por baixo. O que se guarda é
 * o mesmo: nasce fechado, o formulário só existe aberto, fecha-se à mão e
 * fecha-se sozinho depois de criar a conta.
 */
const PAINEL = readFileSync(join(process.cwd(), "src/components/admin/AdminAssistentesPanel.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("a nova conta de assistente", () => {
  it("abre fechada: só o botão, no topo, ao lado do título", () => {
    expect(PAINEL).toContain("const [novaAberta, setNovaAberta] = useState(false);");
    const titulo = PAINEL.indexOf('<h2 className="text-2xl font-semibold text-white">Assistentes</h2>');
    const botao = PAINEL.indexOf("onClick={() => setNovaAberta((v) => !v)}");
    const ramo = PAINEL.indexOf("{novaAberta && (");
    const formulario = PAINEL.indexOf('placeholder="NOME (sem espaços)"');
    expect(titulo).toBeGreaterThan(-1);
    expect(botao).toBeGreaterThan(titulo);
    // O botão vem antes do formulário, e o formulário só existe no ramo aberto.
    expect(ramo).toBeGreaterThan(botao);
    expect(formulario).toBeGreaterThan(ramo);
    expect(PAINEL.slice(botao, botao + 200)).toContain("aria-expanded={novaAberta}");
    expect(PAINEL.slice(botao, ramo)).toContain("Nova conta de assistente");
  });

  it("fecha-se à mão, e sozinha depois de criar a conta", () => {
    expect(PAINEL).toContain("onClick={() => setNovaAberta(false)}");
    const criar = PAINEL.slice(PAINEL.indexOf("async function criar()"), PAINEL.indexOf("function alternarEstado"));
    expect(criar.length).toBeGreaterThan(0);
    expect(criar).toContain("setNovaAberta(false);");
  });
});

/**
 * «A Comissão poderia ter o quadrado pequeno à frente do nome, para colocar até
 * 3 números.» — o dono, 17-10-2026. As duas caixas da percentagem (a da conta
 * nova e a de cada conta) são pequenas, e já não ocupam a linha toda.
 */
describe("a caixa da comissão", () => {
  it("é pequena, nas duas, e não a caixa de linha inteira", () => {
    expect(PAINEL.split("className={CAIXA_DA_PERCENTAGEM}").length - 1).toBe(2);
    expect(PAINEL).not.toContain("${CAIXA} w-24");
    const caixa = PAINEL.slice(PAINEL.indexOf("const CAIXA_DA_PERCENTAGEM ="), PAINEL.indexOf("const CAIXA ="));
    expect(caixa).toContain("w-20");
    expect(caixa).not.toContain("w-full");
  });
});
