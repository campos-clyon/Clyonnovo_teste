import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * As negociações da CLYON têm ecrã próprio no menu.
 *
 * São o trabalho DIÁRIO de quem opera — há propostas à espera de resposta
 * nossa. Misturadas com as dos clientes num ecrã só, o que exige acção vivia
 * no meio do que não exige nenhuma. E o lugar no menu veio do "Acesso aos
 * testes", que ocupava posição nobre para mostrar zero contas.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const SHELL = ler("src/components/admin/LegacyAdminClient.tsx");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");

describe("o menu", () => {
  it("Negociações CLYON está na Plataforma e os testes desceram para Gerir", () => {
    // "negociacoes" saiu do menu quando os dois ecrãs se fundiram num só —
    // a secção continua a responder a links antigos, mas o menu tem UMA porta.
    expect(SHELL).toMatch(
      /Plataforma", itens: \[[^\]]*"negociacoes_clyon"[^\]]*\]/,
    );
  });

  /*
   * «ACESSO AOS TESTES» SAIU — 29-09-2026.
   *
   * *«Vamos remover isso, nunca usamos.»* Zero contas de teste criadas desde
   * que o ecrã existe. Este teste guardava o contrário («nada foi apagado»),
   * porque o portão do MVP dependia dessas contas — e continua a depender: as
   * páginas `/plataforma` e a regra no middleware ficam como estão, fechadas a
   * toda a gente, que é exactamente o que já eram com zero contas. O que saiu
   * foi só o ecrã que as criava.
   */
  it("o ecrã de «Acesso aos testes» já não está no backoffice", () => {
    // Só o código: um comentário que conte a história do ecrã não o traz de volta.
    const codigo = SHELL.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toContain('activeSection === "testadores"');
    expect(codigo).not.toContain("AdminTestadoresPanel");
    expect(codigo).not.toContain("Acesso aos testes");
  });
});

describe("o painel dividido", () => {
  it("é o MESMO componente com um modo, não uma cópia", () => {
    // Duas versões da mesma lógica divergiam como os dois rodapés divergiram.
    // Depois da fusão dos ecrãs, o menu usa um modo só — "tudo" — mas o
    // componente mantém os três: a secção antiga responde a links antigos.
    expect(PAINEL).toContain('mostrar?: "tudo" | "clyon" | "clientes"');
    /*
     * O `mostrar="tudo"` é a garantia; a lista de atributos é livre de
     * crescer. `podeApagar` entrou depois — quem apaga passou a ser só o
     * admin — e um teste preso ao texto exacto da etiqueta chumbava por
     * causa de uma restrição que ele próprio quereria.
     */
    expect(SHELL).toMatch(/<AdminNegociacoesPanel\s+mostrar="tudo"[^>]*\/>/);
  });

  it("o registar pedido vive no ecrã da CLYON", () => {
    // Um pedido de telefone nasce como negociação da CLYON — o formulário
    // pertence ao ecrã onde o resultado vai viver.
    // Sem depender de estar tudo na mesma linha: o que importa é a condição
    // e o componente, não onde o Prettier decidiu partir o JSX.
    const bloco = PAINEL.slice(
      PAINEL.indexOf('{mostrar !== "clientes" &&'),
      PAINEL.indexOf('{mostrar !== "clientes" &&') + 200,
    );
    expect(bloco).toContain("<RegistarPedido");
  });

  it("nenhum ecrã esconde o outro — porque já não há dois", () => {
    /*
     * Havia duas listas e uma linha em cada a apontar para a outra, para que
     * nada ficasse escondido. Os atalhos desapareceram com o motivo deles: os
     * dois grupos são hoje uma lista única, separada por de quem é a vez e
     * não por de onde o pedido veio.
     */
    expect(PAINEL).toContain("const activosOrdenados = useMemo");
    expect(PAINEL).toContain("Precisa de si");
    expect(PAINEL).toContain("A correr");
  });

  it('"à espera de si" só se diz onde é verdade', () => {
    /*
     * Nas negociações dos clientes quem tem de responder é o CLIENTE. O aviso
     * "à espera de si" nesse ecrã mandava o admin responder por quem pode
     * falar sozinho.
     */
    expect(PAINEL).toMatch(/mostrar === "clientes"\s*\?\s*\[\]/);
  });
});
