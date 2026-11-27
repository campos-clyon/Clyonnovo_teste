import { describe, it, expect } from "vitest";
import {
  decidirARespostaAoProfissional,
  qualPerguntaDeDinheiro,
  qualTemaDoParceiro,
  respostaAoTemaDaApp,
  TEMAS_DA_APP,
  type TemaDoParceiro,
} from "./vitoria-aos-profissionais";
import {
  ENTRAR_E_PALAVRA_PASSE,
  ETIQUETA_DO_GMAIL_DO_TESTE,
  FRASE_DO_IPHONE_NO_AVISO,
  GMAIL_RECEBIDO,
  HORARIO_DE_RESPOSTA,
  IPHONE_USA_O_PAINEL,
  PARAR_E_VOLTAR_A_RECEBER_AVISOS,
  PEDIDO_DE_AJUDA_ENVIADO,
  QUANDO_RESPONDEM,
  textoSemPedidos,
} from "./textos-aos-parceiros";
import { perguntasDoProfissional, perguntasDaAppEDoAtendimento } from "./ajuda-plataforma";
import { ATENDIMENTO_ABRE_AS, ATENDIMENTO_FECHA_AS } from "./horario-de-atendimento";
import { falaDoModeloAntigo } from "./palavras-do-modelo-antigo";

/**
 * relógio: datas explícitas (DEPOIS é uma data fixa).
 * d10 (CEO e dono, 27-11-2026) — a Vitória responde aos parceiros sobre a app e
 * sobre os pedidos: «não recebo pedidos» deixa de ser «como sou escolhido»; entrar
 * e a palavra-passe; iPhone; o Gmail do teste; quando respondem; parar e voltar
 * a receber avisos. As mesmas frases na Ajuda do painel e da app. Só actua com
 * o interruptor ligado (a decisão devolve «como_antes» sem ele). Nomes e
 * endereços INVENTADOS (o repositório é público).
 */

const DEPOIS = new Date("2026-11-30T15:00:00Z"); // segunda, 15h em Lisboa

const CADERNO: Record<string, string[]> = {
  sem_pedidos: [
    "não recebo pedidos",
    "Não me aparecem pedidos",
    "Porque não recebo pedidos?",
    "Porque é que não recebo trabalhos?",
    "há dias que não chegam pedidos",
    "deixei de receber pedidos",
    "estou sem pedidos há uma semana",
    "os pedidos não me aparecem na app",
  ],
  iphone: ["tenho iPhone", "Tenho iphone, como faço?", "a app não aparece no meu iPhone", "uso Apple"],
  entrar_e_palavra_passe: [
    "não consigo entrar",
    "Não consigo entrar na app",
    "esqueci a palavra-passe",
    "esqueci-me da palavra passe",
    "perdi a password",
    "como entro na app?",
    "a app não abre",
  ],
  gmail_do_teste: [
    "O meu gmail é joana.exemplo@gmail.com",
    "diz que este item não está disponível",
    "Este item não está disponível no meu país",
    "joana.exemplo@gmail.com",
  ],
  quando_respondem: [
    "quando respondem?",
    "Quando é que me respondem?",
    "qual é o horário de atendimento?",
    "a que horas atendem?",
    "quanto tempo demoram a responder?",
  ],
  parar_e_voltar: [
    "como paro os avisos?",
    "quero deixar de receber avisos",
    "como volto a receber os avisos?",
    "quero desligar as notificações",
    "não recebo avisos no WhatsApp",
  ],
};

describe("d10 — o caderno das frases dos temas novos", () => {
  for (const [tema, frases] of Object.entries(CADERNO)) {
    it(`lê «${tema}» em todas as formas`, () => {
      for (const f of frases) expect(qualTemaDoParceiro(f), f).toBe(tema);
    });
  }

  it("os critérios do CEO: cinco frases dão o tema certo", () => {
    expect(qualTemaDoParceiro("não recebo pedidos")).toBe("sem_pedidos");
    expect(qualTemaDoParceiro("não me aparecem pedidos")).toBe("sem_pedidos");
    expect(qualTemaDoParceiro("tenho iPhone")).toBe("iphone");
    expect(qualTemaDoParceiro("não consigo entrar")).toBe("entrar_e_palavra_passe");
    expect(qualTemaDoParceiro("esqueci a palavra-passe")).toBe("entrar_e_palavra_passe");
  });

  it("«não recebo pedidos» já não cai em «como sou escolhido» (o erro de encaminhamento)", () => {
    for (const f of ["Porque não recebo pedidos?", "Porque é que não recebo trabalhos", "não recebo pedidos há dias"]) {
      expect(qualPerguntaDeDinheiro(f), f).toBeNull();
    }
    // As que são mesmo «como sou escolhido» continuam lá.
    expect(qualPerguntaDeDinheiro("porque é que não fico com os trabalhos?")).toBe("como_sao_escolhidos");
    expect(qualPerguntaDeDinheiro("como ganho mais trabalhos?")).toBe("como_sao_escolhidos");
    expect(qualTemaDoParceiro("como são escolhidos os profissionais para um pedido?")).toBe("como_sao_escolhidos");
  });

  it("o dinheiro continua a ganhar aos temas novos, e o resto passa à equipa", () => {
    const dinheiro: Array<[string, TemaDoParceiro]> = [
      ["Como pago a taxa?", "pagar_a_taxa"],
      ["porque é que a minha conta está bloqueada?", "stand_by"],
      ["O meu IBAN é PT50 0000 0000 0000 0000 0000 0", "iban_e_mbway"],
      ["quem me paga?", "quem_me_paga"],
    ];
    for (const [f, t] of dinheiro) expect(qualTemaDoParceiro(f), f).toBe(t);
    for (const f of ["ok obrigado", "Bom dia", "Ainda está disponível?", "chego às 9h amanhã", "Pode ligar-me?", "Tenho a carrinha avariada"]) {
      expect(qualTemaDoParceiro(f), f).toBeNull();
    }
  });
});

describe("d10 — as respostas", () => {
  it("«sem pedidos»: serviços, raio, notificações, valor em atraso e a zona de trabalho lida das Configs", () => {
    const t = respostaAoTemaDaApp("sem_pedidos", { limiteDaZonaKm: 200 });
    expect(t).toContain("serviço que a CLYON tem ativo");
    expect(t).toContain("raio");
    expect(t).toContain("notificações ligadas");
    expect(t).toContain("valor em atraso");
    expect(t).toContain("até 200 km de Lisboa");
    expect(t).toContain("numa mudança conta a origem");
    // Não é a resposta de «como sou escolhido».
    expect(t).not.toContain("é o cliente que escolhe");
    // O número vem do limite, não está escrito à mão.
    expect(respostaAoTemaDaApp("sem_pedidos", { limiteDaZonaKm: 150 })).toContain("até 150 km de Lisboa");
    expect(respostaAoTemaDaApp("sem_pedidos", { limiteDaZonaKm: 150 })).not.toContain("200");
    // Sem o limite (a Ajuda), a regra sem número.
    expect(textoSemPedidos(null)).not.toMatch(/\d+ km/);
  });

  it("entrar, iPhone, quando respondem e parar/voltar dizem o que o CEO reviu", () => {
    expect(ENTRAR_E_PALAVRA_PASSE).toContain("Esqueci-me da palavra-passe");
    expect(IPHONE_USA_O_PAINEL).toContain("só para Android");
    expect(IPHONE_USA_O_PAINEL).toContain("No iPhone faz tudo no painel, no browser do telemóvel");
    expect(QUANDO_RESPONDEM).toContain(`de segunda a sábado, das ${ATENDIMENTO_ABRE_AS}h às ${ATENDIMENTO_FECHA_AS}h`);
    expect(HORARIO_DE_RESPOSTA).toBe(`de segunda a sábado, das ${ATENDIMENTO_ABRE_AS}h às ${ATENDIMENTO_FECHA_AS}h`);
    expect(PARAR_E_VOLTAR_A_RECEBER_AVISOS).toContain("responda PARAR");
    expect(PARAR_E_VOLTAR_A_RECEBER_AVISOS).toContain("voltar a recebê-los");
  });

  it("sem «IA», «virtual», «garantia», «no próprio dia», entulho, nem as palavras do modelo antigo", () => {
    for (const tema of TEMAS_DA_APP) {
      const r = respostaAoTemaDaApp(tema, { limiteDaZonaKm: 200 });
      expect(r, tema).not.toMatch(/\b(IA|virtual|intelig[êe]ncia artificial|garantia|garantido)\b/i);
      expect(r, tema).not.toMatch(/no próprio dia|entulho|contentor|big bag/i);
      expect(falaDoModeloAntigo(r, "todos"), tema).toBeNull();
      expect(r.length, tema).toBeLessThan(700);
    }
  });
});

describe("d10 — o Gmail do teste", () => {
  const com = "O meu gmail é joana.exemplo@gmail.com";

  it("a Vitória agradece, passa à equipa com a etiqueta «pôr na lista de testadores» e não repete o Gmail", () => {
    const d = decidirARespostaAoProfissional({ texto: com, agora: DEPOIS, interruptorLigado: true });
    expect(d.tipo).toBe("resposta");
    if (d.tipo !== "resposta") return;
    expect(d.pergunta).toBe("gmail_do_teste");
    expect(d.texto).toBe(GMAIL_RECEBIDO);
    expect(d.texto).not.toMatch(/gmail\.com|joana/i);
    expect(d.passaAEquipa).toBe(ETIQUETA_DO_GMAIL_DO_TESTE);
    expect(ETIQUETA_DO_GMAIL_DO_TESTE).toContain("pôr na lista de testadores");
  });

  it("«item não está disponível» sem o Gmail pede-o e não passa à equipa ainda", () => {
    const d = decidirARespostaAoProfissional({ texto: "diz que este item não está disponível", agora: DEPOIS, interruptorLigado: true });
    expect(d.tipo).toBe("resposta");
    if (d.tipo !== "resposta") return;
    expect(d.pergunta).toBe("gmail_do_teste");
    expect(d.passaAEquipa).toBeUndefined();
    expect(d.texto).toContain("Responda só com o Gmail");
  });
});

describe("d10 — só actua com o interruptor ligado, e a decisão não envia nada", () => {
  it("desligado: tudo como antes, para todos os temas", () => {
    for (const frases of Object.values(CADERNO)) {
      for (const f of frases) expect(decidirARespostaAoProfissional({ texto: f, agora: DEPOIS, interruptorLigado: false }).tipo, f).toBe("como_antes");
    }
  });
  it("ligado: responde, sem passar à equipa (excepto o Gmail)", () => {
    for (const [tema, frases] of Object.entries(CADERNO)) {
      const d = decidirARespostaAoProfissional({ texto: frases[0], agora: DEPOIS, interruptorLigado: true, limiteDaZonaKm: 200 });
      expect(d.tipo, tema).toBe("resposta");
      if (d.tipo === "resposta") expect(Boolean(d.passaAEquipa), tema).toBe(tema === "gmail_do_teste");
    }
  });
  it("o limite da zona chega à resposta do «sem pedidos»", () => {
    const d = decidirARespostaAoProfissional({ texto: "não me aparecem pedidos", agora: DEPOIS, interruptorLigado: true, limiteDaZonaKm: 200 });
    expect(d.tipo === "resposta" && d.texto).toContain("até 200 km de Lisboa");
  });
});

describe("d10 — a Ajuda do painel e da app Pro", () => {
  it("tem as quatro entradas novas, com as mesmas frases da Vitória", () => {
    for (const agora of [new Date("2026-11-01T12:00:00Z"), DEPOIS]) {
      const p = perguntasDoProfissional({ cliente: 0, profissional: 0.11 }, agora);
      const por = (q: string) => p.find((x) => x.pergunta === q);
      expect(por("Quando respondem ao meu pedido de ajuda?")?.resposta).toBe(QUANDO_RESPONDEM);
      expect(por("Não me aparecem pedidos. O que verifico?")?.resposta).toBe(textoSemPedidos(null));
      expect(por("Tenho iPhone: posso usar a CLYON Pro?")?.resposta).toBe(IPHONE_USA_O_PAINEL);
      expect(por("Como paro ou volto a receber avisos?")?.resposta).toBe(PARAR_E_VOLTAR_A_RECEBER_AVISOS);
    }
    expect(perguntasDaAppEDoAtendimento()).toHaveLength(4);
  });
  it("a frase do pedido enviado diz o horário (a mesma constante)", () => {
    expect(PEDIDO_DE_AJUDA_ENVIADO).toBe(
      `Recebemos o seu pedido. Respondemos ${HORARIO_DE_RESPOSTA}, por aqui e por email. Se for urgente, ligue-nos.`,
    );
  });
  it("o painel e a app lêem as constantes, não frases escritas à mão", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const painel = readFileSync(join(__dirname, "../app/profissionais/painel/Ajuda.tsx"), "utf8");
    const app = readFileSync(join(__dirname, "../../app-pro/src/app/conta/ajuda.tsx"), "utf8");
    expect(painel).toContain("RESPOSTA_AO_PEDIDO_DE_AJUDA");
    expect(painel).not.toContain("Respondemos por aqui e por email");
    expect(app).toContain("PEDIDO_DE_AJUDA_ENVIADO");
    expect(app).not.toContain("Respondemos por aqui e por email");
  });
});

describe("d10 — o aviso d134 traz o iPhone e «responda com o Gmail»", () => {
  it("a linha do iPhone vem antes dos passos do Android", async () => {
    const { textoDoAvisoDaAppPro } = await import("./aviso-da-app-pro");
    const t = textoDoAvisoDaAppPro({ nome: "Ana", estado: "nunca", inscritoEm: null, abertaEm: null, naoGmail: false });
    expect(t).toContain(FRASE_DO_IPHONE_NO_AVISO);
    expect(t.indexOf(FRASE_DO_IPHONE_NO_AVISO)).toBeLessThan(t.indexOf("Para instalar (Android):"));
    expect(t).toContain("responda a esta mensagem com o Gmail");
    expect(t).not.toContain("diga-nos qual");
  });
});

describe("d10 — a conversa cumpre a etiqueta do Gmail (código de origem)", () => {
  it("o consumidor passa à equipa com a etiqueta quando a decisão a traz", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const f = readFileSync(join(__dirname, "whatsapp-negociacao.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(f).toContain("if (decisao.passaAEquipa) await passarAUmaPessoa(telefone, decisao.passaAEquipa, decisao.texto);");
  });
});
