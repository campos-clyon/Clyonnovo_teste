import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «Coloque o Nova conta de assistente dentro de um botão, para só abrir
 * quando quiser.» — o dono, 17-10-2026.
 */
const PAINEL = readFileSync(join(process.cwd(), "src/components/admin/AdminAssistentesPanel.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("a nova conta de assistente", () => {
  it("abre fechada: só o botão", () => {
    expect(PAINEL).toContain("const [novaAberta, setNovaAberta] = useState(false);");
    const botao = PAINEL.indexOf("{!novaAberta ? (");
    const formulario = PAINEL.indexOf('placeholder="NOME (sem espaços)"');
    expect(botao).toBeGreaterThan(-1);
    // O formulário só existe no ramo aberto, depois do botão.
    expect(formulario).toBeGreaterThan(PAINEL.indexOf(") : (", botao));
    expect(PAINEL.slice(botao, PAINEL.indexOf(") : (", botao))).toContain("onClick={() => setNovaAberta(true)}");
  });

  it("fecha-se à mão, e sozinha depois de criar a conta", () => {
    expect(PAINEL).toContain("onClick={() => setNovaAberta(false)}");
    const criar = PAINEL.slice(PAINEL.indexOf("async function criar()"), PAINEL.indexOf("function reporSenha"));
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
