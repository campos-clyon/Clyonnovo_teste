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
