import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O ORÇAMENTO SAI PELA CLYON — e o assistente fica com a conversa.
 *
 * "Esse botão enviar orçamento devia passar para o bot do WhatsApp enviar, e
 * continuar a conversa caso seja necessário." — 11-09-2026.
 *
 * O botão que havia abria o WhatsApp Web de quem carregava, com o texto já
 * escrito. Poupava copiar, e era tudo o que poupava: a mensagem saía do
 * telemóvel DELE, e a plataforma não ficava a saber de nada. Quando o cliente
 * respondesse «aceito» ou «150», a resposta caía numa conversa que o
 * assistente nunca tinha começado — e ele calava-se.
 *
 * Agora sai pelo número da CLYON, fica no fio, e o número é DEVOLVIDO ao
 * assistente. É o «devolver» que faz a segunda metade do pedido valer alguma
 * coisa: sem ele, uma conversa entregue a uma pessoa continuava entregue.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROTA = ler("src/app/api/admin/whatsapp/route.ts");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");

/** O corpo da acção nova, para não confundir com o `responder` ao lado. */
const BLOCO = (() => {
  const i = ROTA.indexOf('if (accao === "enviarPelaClyon") {');
  expect(i, "a acção enviarPelaClyon não existe").toBeGreaterThan(-1);
  return ROTA.slice(i, ROTA.indexOf("CHEGOU UMA RESPOSTA", i));
})();

describe("sai pelo número da CLYON, e não pelo telemóvel de quem carrega", () => {
  it("usa o canal da plataforma", () => {
    expect(BLOCO).toContain("enviarTextoManualWhatsApp(telefone, texto)");
  });

  it("e o botão do lado continua a existir, com o nome do que faz", () => {
    /*
     * Os dois têm lugar: às vezes quer-se mesmo falar do número pessoal. O
     * que não podia ficar era chamarem-se os dois «Enviar no WhatsApp».
     */
    expect(PAINEL).toContain("Enviar pela CLYON");
    expect(PAINEL).toContain("Do meu WhatsApp");
  });
});

describe("o assistente fica com a conversa — é a segunda metade do pedido", () => {
  it("devolve o número ao assistente depois de enviar", () => {
    /*
     * O TESTE QUE IMPORTA. Sem isto, uma conversa que estivesse entregue a
     * uma pessoa continuava entregue, e o cérebro calava-se à resposta do
     * cliente — que é exactamente o defeito que este botão veio corrigir.
     */
    expect(BLOCO).toContain("await retomarNumeroWhatsApp(telefone);");
    // E só DEPOIS de a mensagem ter saído: devolver uma conversa e não mandar
    // nada é pior do que não mexer.
    expect(BLOCO.indexOf("enviarTextoManualWhatsApp")).toBeLessThan(
      BLOCO.indexOf("retomarNumeroWhatsApp"),
    );
  });

  it("um envio que falha NÃO devolve a conversa", () => {
    const falhou = BLOCO.indexOf("if (!saiu) {");
    expect(falhou).toBeGreaterThan(-1);
    expect(falhou).toBeLessThan(BLOCO.indexOf("retomarNumeroWhatsApp"));
    expect(BLOCO).toContain("status: 400");
  });
});

describe("o que não se faz por acidente", () => {
  it("um número bloqueado continua bloqueado", () => {
    // O bloqueio é uma decisão em vigor, e este botão não é o sítio de a
    // desfazer sem ninguém pedir.
    expect(BLOCO).toContain("numeroBloqueadoWhatsApp(telefone)");
    expect(BLOCO).toContain("status: 409");
    expect(BLOCO.indexOf("numeroBloqueadoWhatsApp")).toBeLessThan(
      BLOCO.indexOf("enviarTextoManualWhatsApp"),
    );
  });

  it("com o WhatsApp desligado, diz-se que o assistente não vai responder", () => {
    /*
     * A mensagem sai à mesma — quem carregou pediu-o. Mas prometer que ele
     * fica a tratar da conversa, com o interruptor geral desligado, seria uma
     * promessa que a casa não cumpre.
     */
    expect(BLOCO).toContain("const ligado = await whatsappLigado();");
    expect(BLOCO).toContain("assistenteVaiResponder: ligado");
    expect(BLOCO).toContain("está DESLIGADO");
  });

  it("sem sessão não há envio — o botão só existe com token", () => {
    expect(PAINEL).toContain("token?: string | null;");
    expect(PAINEL).toContain("if (!token) return;");
  });
});

describe("o painel diz a verdade sobre o que aconteceu", () => {
  it("«a caminho», e não «enviada» — pela ponte, saiu quer dizer ficou na fila", () => {
    expect(PAINEL).toContain("A caminho pelo número da CLYON");
    expect(PAINEL).toContain("O assistente fica a tratar desta conversa");
  });

  it("e um aviso aparece mesmo quando o envio correu bem", () => {
    // Um aviso não é um erro: a mensagem saiu, mas há uma condição que impede
    // o assistente de continuar.
    expect(PAINEL).toContain("if (dados.aviso) setErroDoEnvio(dados.aviso);");
  });
});
