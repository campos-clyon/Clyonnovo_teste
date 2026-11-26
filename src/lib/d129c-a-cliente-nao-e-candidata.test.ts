import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { decidirAIntencaoComPortas, type PortasDaIntencao } from "./vitoria-agente/intencao-na-base";
import { avisoDaIntencao, MARCA_DA_LIGACAO, type LeituraDaIntencao } from "./vitoria-agente/intencao";
import type { ClienteDoClaude } from "./vitoria-agente/cliente";
import {
  escolhaNaDuvida,
  guardaDoCandidato,
  intencaoExplicitaDeParceiro,
  MOTIVO_DO_CANDIDATO_COM_RASCUNHO,
  passosDeClienteRespondidos,
  perguntouADuvida,
  QUER_PEDIR_OU_SER_PARCEIRO,
  querSerParceiro,
} from "./candidato-a-parceiro";
import { eCandidatoPeloMotivo } from "./mesa-das-conversas";

/*
 * d129c (26-11-2026, «Erro grave») — A CLIENTE QUE VIROU «CANDIDATA».
 *
 * Uma cliente acabava de falar com a equipa ao telefone e escreveu que queria
 * o «levantamento de alguns imóveis» (recolha de móveis, escrito por quem não
 * é nativa). A Vitória seguiu a recolha — o nome, o código postal, o andar,
 * o estacionamento — e à resposta do estacionamento a leitura do modelo disse
 * «candidato a parceiro»: saiu a candidatura, o rascunho apagou-se e a
 * conversa fechou-se. O modelo é fingido; nada sai a ninguém. Nomes, ruas e
 * números INVENTADOS (o repositório é público); as localidades ficam.
 */

const AGORA = new Date("2026-11-26T17:00:00Z");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

function claudeFingido(leitura: Partial<LeituraDaIntencao>, chamadas: unknown[] = []): ClienteDoClaude {
  return {
    beta: {
      messages: {
        create: async (p) => {
          chamadas.push(p);
          return {
            id: "msg_fingida",
            type: "message",
            role: "assistant",
            model: "claude-sonnet-5-5",
            content: [
              {
                type: "text",
                text: JSON.stringify({ respondeAPergunta: false, resposta: "", retomarAPergunta: false, porque: "", ...leitura }),
                citations: null,
              },
            ],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 900, output_tokens: 120, cache_read_input_tokens: 8000, cache_creation_input_tokens: 0 },
          } as unknown as Anthropic.Beta.BetaMessage;
        },
      },
    },
  };
}

/* A conversa do caso (inventada nos dados, fiel na forma). */
const FIO_DA_CLIENTE = [
  { direccao: "in", texto: "Boa tarde" },
  { direccao: "in", texto: "Acabamos de falar" },
  { direccao: "out", texto: "Boa tarde! Sou a Vitória, assistente online da CLYON. Em que posso ajudar?" },
  { direccao: "in", texto: "Em relação do levantamento do alguns imóveis" },
  { direccao: "in", texto: "Na Rua das Flores em Oeiras" },
  { direccao: "out", texto: "Fica anotado: recolha de móveis. Com quem tenho o gosto de falar?" },
  { direccao: "in", texto: "Joana" },
  { direccao: "out", texto: "E o código postal?" },
  { direccao: "in", texto: "2780-000" },
  { direccao: "out", texto: "E em que andar é?" },
  { direccao: "in", texto: "5 com elevador" },
  { direccao: "out", texto: "A carrinha consegue estacionar perto da porta?" },
  { direccao: "in", texto: "Há muitos lugares à volta do prédio" },
];
const DADOS_DA_CLIENTE = {
  serviceType: "recolha_moveis",
  contactName: "Joana",
  address: "Rua das Flores",
  city: "Oeiras",
  postalCode: "2780-000",
  floor: "5",
  hasElevator: "yes",
};
const ESTACIONAMENTO = "Há muitos lugares à volta do prédio";

const CANDIDATURA_DO_MODELO: Partial<LeituraDaIntencao> = {
  intencao: "candidato_a_parceiro",
  resposta: `Obrigada pelo interesse em trabalhar com a CLYON! Inscreva-se aqui: ${MARCA_DA_LIGACAO}`,
};

function portas(cliente: ClienteDoClaude, extra: Partial<PortasDaIntencao> = {}): PortasDaIntencao {
  return {
    cliente,
    ligada: true,
    recolha: async () => ({ passo: "estacionamento", dados: DADOS_DA_CLIENTE, pedidoId: null }),
    fio: async () => FIO_DA_CLIENTE,
    perguntaPendente: () => "A carrinha consegue estacionar perto da porta?",
    gastoETecto: async () => ({ gastoUsd: 0.4, tectoUsd: 10 }),
    registar: async () => {},
    ...extra,
  };
}

describe("o caso: a cliente a meio da recolha nunca vira candidata", () => {
  it("nenhuma das mensagens dela é uma intenção explícita de ser parceiro (nem pela regra de sempre)", () => {
    for (const m of FIO_DA_CLIENTE.filter((x) => x.direccao === "in")) {
      expect(intencaoExplicitaDeParceiro(m.texto), m.texto).toBe(false);
      expect(querSerParceiro(m.texto), m.texto).toBe(false);
    }
  });

  it("o rascunho dela tem passos de cliente respondidos (o serviço sozinho não conta)", () => {
    expect(passosDeClienteRespondidos(DADOS_DA_CLIENTE)).toBeGreaterThan(0);
    expect(passosDeClienteRespondidos({ serviceType: "recolha_moveis" })).toBe(0);
    expect(passosDeClienteRespondidos(null)).toBe(0);
  });

  it("o modelo diz «candidato» à resposta do estacionamento: o cliente ganha — segue a recolha", async () => {
    const d = await decidirAIntencaoComPortas(ESTACIONAMENTO, AGORA, portas(claudeFingido(CANDIDATURA_DO_MODELO)));
    expect(d.tipo).toBe("regras");
  });

  it("a meio da recolha, mesmo com palavras explícitas, não se fecha: pergunta-se numa linha", async () => {
    const texto = "Afinal quero é trabalhar convosco como parceiro";
    const d = await decidirAIntencaoComPortas(texto, AGORA, portas(claudeFingido(CANDIDATURA_DO_MODELO)));
    expect(d).toEqual({ tipo: "responder", texto: QUER_PEDIR_OU_SER_PARCEIRO });
  });

  it("sem passos respondidos e sem palavras explícitas (a dúvida): a mesma pergunta, nunca a candidatura", async () => {
    const d = await decidirAIntencaoComPortas("Em relação do levantamento do alguns imóveis", AGORA, portas(claudeFingido(CANDIDATURA_DO_MODELO), {
      recolha: async () => null,
      fio: async () => FIO_DA_CLIENTE.slice(0, 4),
    }));
    expect(d).toEqual({ tipo: "responder", texto: QUER_PEDIR_OU_SER_PARCEIRO });
  });

  it("depois da pergunta: «pedir um serviço» volta à pergunta da recolha; «parceiro» recebe a candidatura; sem se perceber, a equipa", async () => {
    const fio = [...FIO_DA_CLIENTE, { direccao: "out", texto: QUER_PEDIR_OU_SER_PARCEIRO }];
    expect(perguntouADuvida(fio)).toBe(true);
    const cliente = await decidirAIntencaoComPortas("Quero pedir um serviço, a recolha dos móveis", AGORA, portas(claudeFingido(CANDIDATURA_DO_MODELO), { fio: async () => fio }));
    expect(cliente).toEqual({ tipo: "responder", texto: "Com certeza. A carrinha consegue estacionar perto da porta?" });
    const parceiro = await decidirAIntencaoComPortas("Trabalhar como parceiro", AGORA, portas(claudeFingido(CANDIDATURA_DO_MODELO), { fio: async () => fio }));
    expect(parceiro.tipo).toBe("candidato");
    expect(parceiro.tipo === "candidato" && parceiro.texto).toContain("https://clyon.pt/quero-ser-parceiro");
    const ambigua = await decidirAIntencaoComPortas("Sim, isso mesmo", AGORA, portas(claudeFingido(CANDIDATURA_DO_MODELO), { fio: async () => fio }));
    expect(ambigua.tipo).toBe("equipa");
    expect(escolhaNaDuvida("o levantamento dos imóveis")).toBe("cliente");
  });

  it("o prompt: só com palavras explícitas; quem responde à recolha é cliente; «imóveis»/«levantamento» = móveis/recolha", () => {
    const a = avisoDaIntencao(AGORA);
    expect(a).toContain("SÓ quando a pessoa diz, por palavras explícitas");
    expect(a).toContain("«imóveis» quer dizer móveis e «levantamento» quer dizer recolha");
    expect(a).not.toContain("Mesmo a meio de uma recolha");
  });
});

describe("o candidato verdadeiro (d129) continua a receber a candidatura", () => {
  const SAUDACAO = "Boa tarde! Fica anotado: recolha de móveis. Com quem tenho o gosto de falar?";
  const M1 = "Quero fazer meu cadastro para ser parceiro de vocês";
  const M2 = "Que trabalhar com vocês";
  const M4 = "Olá, sou o Gervásio, estou no Seixal com camião e quero ser parceiro para recolha de móveis/monos e fretes.";

  it("as frases dele são intenção explícita", () => {
    for (const t of [M1, M2, M4, "Tenho carrinha e quero trabalhar convosco", "Posso fazer fretes para vocês?", "Estão a contratar?"]) {
      expect(intencaoExplicitaDeParceiro(t), t).toBe(true);
    }
  });

  it("no início da recolha (só o serviço), o modelo diz candidato: a candidatura", async () => {
    const d = await decidirAIntencaoComPortas(M1, AGORA, {
      ...portas(claudeFingido(CANDIDATURA_DO_MODELO)),
      recolha: async () => ({ passo: "nome", dados: { serviceType: "recolha_moveis" }, pedidoId: null }),
      fio: async () => [
        { direccao: "out", texto: SAUDACAO },
        { direccao: "in", texto: M1 },
      ],
      perguntaPendente: () => "Com quem tenho o gosto de falar?",
    });
    expect(d.tipo).toBe("candidato");
  });

  it("a guarda, pura: sem passos e explícito → candidato; com passos e explícito → pergunta; com passos e sem → cliente", () => {
    expect(guardaDoCandidato({ texto: M1, passosRespondidos: 0, perguntouADuvida: false })).toBe("candidato");
    expect(guardaDoCandidato({ texto: M1, passosRespondidos: 3, perguntouADuvida: false })).toBe("perguntar");
    expect(guardaDoCandidato({ texto: ESTACIONAMENTO, passosRespondidos: 3, perguntouADuvida: false })).toBe("cliente");
    expect(guardaDoCandidato({ texto: "Ok obrigado", anteriores: [M1], passosRespondidos: 0, perguntouADuvida: false })).toBe("candidato");
  });
});

describe("o rascunho nunca se apaga por esta leitura", () => {
  it("o cérebro: sem apagar o rascunho; com rascunho, a conversa vai à equipa com o motivo (e continua nos «Profissionais»)", () => {
    const neg = ler("src/lib/whatsapp-negociacao.ts");
    const corpo = neg.slice(neg.indexOf("async function aIntencaoAntesDaRecolha"), neg.indexOf("O VALOR ÚNICO, DECIDIDO"));
    expect(corpo).not.toContain("apagarRecolhaWhatsApp");
    expect(corpo).toContain("fecharComoCandidato(telefone, await rascunhoDaRecolhaEmCurso(telefone))");
    const fecho = neg.slice(neg.indexOf("async function fecharComoCandidato"), neg.indexOf("async function fecharComoCandidato") + 900);
    expect(fecho).toContain("interromperNumeroWhatsApp(telefone, cand.MOTIVO_DO_CANDIDATO_COM_RASCUNHO)");
    expect(fecho).not.toContain("apagarRecolhaWhatsApp");
    expect(eCandidatoPeloMotivo(MOTIVO_DO_CANDIDATO_COM_RASCUNHO)).toBe(true);
  });

  it("a regra de sempre (sem o modelo) também passa pela guarda", () => {
    const neg = ler("src/lib/whatsapp-negociacao.ts");
    const corpo = neg.slice(neg.indexOf("async function aoCandidato"), neg.indexOf("async function rascunhoDaRecolhaEmCurso"));
    expect(corpo).toContain("cand.guardaDoCandidato(");
    expect(corpo).toContain('if (guarda === "cliente") return false;');
    expect(corpo).toContain("fecharComoCandidato(telefone, rascunho)");
  });
});
