import { describe, it, expect } from "vitest";
import {
  arrumarAsFaltas,
  assuntoDoQueFalta,
  caminhosDoQueFalta,
  CHAVES_DAS_FALTAS,
  cumprimentoPelaHora,
  linhaDaFalta,
  linkDoEmail,
  mensagemDoQueFalta,
  registoDoQueFalta,
  rotuloDaFalta,
  type ChaveDaFalta,
} from "./mensagem-do-que-falta";
import { saudacao } from "./whatsapp-recolha";

/**
 * A MENSAGEM DO QUE FALTA — 26-10-2026 (d31). Pede só o que falta, uma linha
 * por falta, com o cumprimento da hora de Lisboa, sem emojis nem preços.
 *
 * Os pedidos, os telefones e os emails destes testes são inventados.
 */

const PEDIDO = { id: 812, serviceType: "recolha_monos", city: "Almada" };
// 15:00 de Lisboa num dia de Inverno (Lisboa = UTC).
const TARDE = new Date("2026-11-03T15:00:00Z");

const linhasDaLista = (texto: string) => texto.split("\n").filter((l) => l.startsWith("- "));

describe("o cumprimento pela hora de Lisboa", () => {
  it("bom dia, boa tarde, boa noite — e a madrugada é noite", () => {
    expect(cumprimentoPelaHora(new Date("2026-11-03T09:00:00Z"))).toBe("Bom dia");
    expect(cumprimentoPelaHora(new Date("2026-11-03T12:59:00Z"))).toBe("Bom dia");
    expect(cumprimentoPelaHora(new Date("2026-11-03T13:00:00Z"))).toBe("Boa tarde");
    expect(cumprimentoPelaHora(new Date("2026-11-03T20:00:00Z"))).toBe("Boa noite");
    expect(cumprimentoPelaHora(new Date("2026-11-03T03:00:00Z"))).toBe("Boa noite");
  });

  it("no Verão conta a hora de Lisboa, e não a de Greenwich nem a de Paris", () => {
    // 12:30 em Greenwich é 13:30 em Lisboa (e 14:30 em Paris).
    expect(cumprimentoPelaHora(new Date("2026-07-15T12:30:00Z"))).toBe("Boa tarde");
    // 11:30 em Greenwich é 12:30 em Lisboa: ainda bom dia.
    expect(cumprimentoPelaHora(new Date("2026-07-15T11:30:00Z"))).toBe("Bom dia");
  });

  it("diz o mesmo que a Vitória, hora a hora, no Inverno e no Verão", () => {
    for (const dia of ["2026-01-15", "2026-07-15", "2026-10-25"]) {
      for (let h = 0; h < 24; h++) {
        const t = new Date(`${dia}T${String(h).padStart(2, "0")}:30:00Z`);
        expect(cumprimentoPelaHora(t), t.toISOString()).toBe(saudacao(t));
      }
    }
  });
});

describe("a mensagem", () => {
  it("é a do dono: quem fala, o pedido, porquê, uma linha por falta e o fecho", () => {
    const texto = mensagemDoQueFalta(PEDIDO, ["fotografias", "numeroDaPorta", "elevador"], TARDE);
    expect(texto).toBe(
      [
        "Boa tarde! Aqui é a equipa da CLYON.",
        "Estamos a contactar por causa do seu pedido #812 (recolha de monos em Almada). Para lhe enviarmos o orçamento mais adequado, precisamos de algumas informações que estão em falta:",
        [
          "- Fotografias do que é para levar, para os parceiros avaliarem o volume.",
          "- O número da porta da morada.",
          "- Se há elevador no prédio e se lá cabe o que é para levar.",
        ].join("\n"),
        "Pode responder a esta mensagem com o que falta.",
        "Obrigado,\nEquipa CLYON",
      ].join("\n\n"),
    );
  });

  it("pede só o que falta, uma linha por falta, pela ordem de pedir", () => {
    for (const faltas of [["morada"], ["nome", "fotografias"], ["data", "andar", "codigoPostal", "descricao"]] as ChaveDaFalta[][]) {
      const linhas = linhasDaLista(mensagemDoQueFalta(PEDIDO, faltas, TARDE));
      expect(linhas).toEqual(arrumarAsFaltas(faltas).map((c) => `- ${linhaDaFalta(c, PEDIDO.serviceType)}`));
    }
    // E nada do que não falta.
    const texto = mensagemDoQueFalta(PEDIDO, ["morada"], TARDE);
    expect(texto).not.toMatch(/fotografia|elevador|andar|nome/i);
  });

  it("uma falta só, no singular", () => {
    expect(mensagemDoQueFalta(PEDIDO, ["morada"], TARDE)).toContain(
      "precisamos de uma informação que está em falta:",
    );
  });

  it("sem faltas, não há mensagem — e chaves estranhas ou repetidas caem", () => {
    expect(mensagemDoQueFalta(PEDIDO, [], TARDE)).toBe("");
    expect(arrumarAsFaltas(["nome", "lixo", "fotografias", "nome", 3])).toEqual(["fotografias", "nome"]);
  });

  it("sem emojis, sem caracteres que chegam como «?», sem preços — em todas as linhas de todos os serviços", () => {
    for (const servico of ["recolha_moveis", "recolha_monos", "recolha_entulho", "esvaziamento_casa", "mudanca", "manutencao_casa", "outro", null]) {
      const texto = mensagemDoQueFalta({ id: 7, serviceType: servico, city: "Seixal" }, [...CHAVES_DAS_FALTAS], TARDE);
      expect(texto, String(servico)).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(texto, String(servico)).not.toMatch(/[…—–«»“”•✓→]/);
      expect(texto, String(servico)).not.toMatch(/€|\bIVA\b|preço/i);
      expect(linhasDaLista(texto)).toHaveLength(CHAVES_DAS_FALTAS.length);
    }
  });

  it("sem o serviço ou sem a localidade, diz o que sabe", () => {
    expect(mensagemDoQueFalta({ id: 9, serviceType: null, city: null }, ["servico"], TARDE)).toContain("seu pedido #9. Para");
    expect(mensagemDoQueFalta({ id: 9, serviceType: "mudanca", city: null }, ["morada"], TARDE)).toContain("#9 (mudança)");
    expect(mensagemDoQueFalta({ id: 9, serviceType: "outro", city: "Setúbal, Portugal" }, ["morada"], TARDE)).toContain(
      "#9 (em Setúbal)",
    );
  });

  it("cada serviço fala do que é seu", () => {
    expect(linhaDaFalta("fotografias", "mudanca")).toContain("divisões e dos móveis maiores");
    expect(linhaDaFalta("descricao", "manutencao_casa")).toContain("reparar");
    expect(linhaDaFalta("descricao", "recolha_entulho")).toContain("entulho");
    expect(linhaDaFalta("morada", "mudanca")).toContain("de onde sai a mudança");
    expect(rotuloDaFalta("descricao", "mudanca")).toBe("o que é para mudar");
  });
});

describe("o email e os links", () => {
  it("o assunto", () => {
    expect(assuntoDoQueFalta(PEDIDO)).toBe("Pedido #812 — informações em falta");
  });

  it("o mailto leva o assunto e o corpo codificados, com as linhas em CRLF", () => {
    const corpo = mensagemDoQueFalta(PEDIDO, ["fotografias", "morada"], TARDE);
    const link = linkDoEmail("cliente@exemplo.pt", assuntoDoQueFalta(PEDIDO), corpo)!;
    expect(link.startsWith("mailto:cliente@exemplo.pt?subject=")).toBe(true);
    const [, query] = link.split("?");
    // Só um «&», o que separa o assunto do corpo; nada de espaços nem quebras cruas.
    expect(query.split("&")).toHaveLength(2);
    expect(link).not.toMatch(/[\s\n]/);
    const params = Object.fromEntries(query.split("&").map((kv) => [kv.split("=")[0], decodeURIComponent(kv.split("=")[1])]));
    expect(params.subject).toBe("Pedido #812 — informações em falta");
    expect(params.body).toBe(corpo.replace(/\n/g, "\r\n"));
    expect(link).toContain("%0D%0A");
  });

  it("um email mal escrito não dá link", () => {
    for (const mau of [null, "", "sem-arroba", "a@b", "a b@exemplo.pt", "a@exemplo.pt?cc=outro@exemplo.pt"]) {
      expect(linkDoEmail(mau, "x", "y"), String(mau)).toBeNull();
    }
    expect(linkDoEmail("a+clyon@exemplo.pt", "x", "y")).toBe("mailto:a%2Bclyon@exemplo.pt?subject=x&body=y");
  });

  it("o WhatsApp abre a conversa do cliente com o texto; um número que não serve dá null e fica o email", () => {
    const c = caminhosDoQueFalta(
      { ...PEDIDO, contactPhone: "912 345 678", contactEmail: "cliente@exemplo.pt" },
      ["fotografias"],
      TARDE,
    );
    expect(c.whatsapp).toBe(`https://wa.me/351912345678?text=${encodeURIComponent(c.texto)}`);
    expect(decodeURIComponent(c.whatsapp!.split("?text=")[1])).toBe(c.texto);
    expect(c.email).toContain("mailto:cliente@exemplo.pt?subject=");

    const semWhatsApp = caminhosDoQueFalta({ ...PEDIDO, contactPhone: "12345", contactEmail: "cliente@exemplo.pt" }, ["fotografias"], TARDE);
    expect(semWhatsApp.whatsapp).toBeNull();
    expect(semWhatsApp.email).not.toBeNull();

    const nada = caminhosDoQueFalta({ ...PEDIDO, contactPhone: null, contactEmail: null }, ["fotografias"], TARDE);
    expect(nada.whatsapp).toBeNull();
    expect(nada.email).toBeNull();
    expect(nada.texto).toContain("#812");
  });

  it("um pedido completo não dá caminho nenhum", () => {
    const c = caminhosDoQueFalta({ ...PEDIDO, contactPhone: "912 345 678", contactEmail: "cliente@exemplo.pt" }, [], TARDE);
    expect(c).toMatchObject({ texto: "", whatsapp: null, email: null });
  });
});

describe("o que fica no histórico", () => {
  it("quem, por onde e a lista — sem a mensagem nem dados do cliente", () => {
    expect(registoDoQueFalta("Ana", "whatsapp", ["elevador", "fotografias", "numeroDaPorta"], "recolha_monos")).toBe(
      "Ana pediu ao cliente, por WhatsApp, as informações em falta: fotografias, número da porta e elevador.",
    );
    expect(registoDoQueFalta("Ana", "email", ["morada"])).toBe("Ana pediu ao cliente, por email, as informações em falta: morada.");
    expect(registoDoQueFalta(null, "copiar", ["nome", "data"])).toBe(
      "A equipa copiou a mensagem que pede ao cliente as informações em falta: data pretendida e nome.",
    );
    expect(registoDoQueFalta("Ana", "whatsapp", [])).toBe(
      "Ana pediu ao cliente, por WhatsApp, as informações em falta, mas o pedido já estava completo.",
    );
  });
});
