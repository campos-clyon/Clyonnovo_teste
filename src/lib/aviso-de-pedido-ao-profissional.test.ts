import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  avisoDePedidoAoProfissional,
  descricaoParaOAviso,
  urgenciaParaOAviso,
  distanciaParaOAviso,
  distanciaCurtaParaOAviso,
  localidadeParaOAviso,
  ganhoParaOAviso,
  ePedidoParaParar,
  COMO_SE_SAI,
  type PedidoParaAvisar,
} from "./aviso-de-pedido-ao-profissional";
import { TAXAS_DE_ORIGEM, quantoOProfissionalRecebe } from "./taxas-plataforma";
import { CAPACIDADES, FICHA_DA_CAPACIDADE } from "./assistente-interruptores";
import { telemovelParaWhatsApp } from "./whatsapp-cloud";
import { euros } from "./texto-da-mesa";

/**
 * O AVISO DE PEDIDO NOVO AO PROFISSIONAL — 20-09-2026.
 *
 * "Vamos criar uma funcionalidade para sempre que publicarmos um pedido /
 *  enviar aos profissionais o assistente enviar mensagens no wpp para os pro
 *  falando sobre o pedido novo com localidade e descrição e valor estimativa,
 *  a mensagem deve ser claro que e o assistente de pedidos que enviou da clyon"
 *
 * ⚠️ ISTO É A PRIMEIRA COISA QUE A CLYON DIZ A UM PROFISSIONAL NUM CANAL QUE
 * ELE NÃO ABRIU. Não há segunda oportunidade: uma mensagem que lhe cheire a
 * burla, ou que lhe minta num número, e o que ele faz é bloquear o número —
 * e com ele tudo o resto que a plataforma lhe queira dizer.
 *
 * Por isso estes testes não guardam «o código funciona». Guardam as promessas
 * que a mensagem faz, uma a uma.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Uma tarde de quinta, para a saudação não andar a saltar. */
const TARDE = new Date("2026-09-20T14:30:00Z");

const PEDIDO: PedidoParaAvisar = {
  pedidoId: 310,
  localidade: "Alcabideche",
  servico: "recolha_monos",
  descricao: "dois sofás, um colchão e uma mesa de sala, rés-do-chão com acesso pela rua",
  urgencia: "sem_pressa",
  valorDesejadoCliente: 100,
  baseDoPreco: "total",
  taxas: TAXAS_DE_ORIGEM,
  distanciaKm: 7,
  link: "https://clyon.pt/profissionais/pedidos/abc123",
};

describe("o aviso curto — d135 (26-11-2026), o formato que o dono pediu", () => {
  it("cinco linhas: o n.º e o serviço, onde, o ganho, a ligação e a saída", () => {
    const m = avisoDePedidoAoProfissional("Nova Recolha", { ...PEDIDO, servico: "recolha_moveis", pedidoId: 668, localidade: "Olivais, Lisboa", distanciaKm: 22.3 }, TARDE);
    const esperado = euros(quantoOProfissionalRecebe(100, TAXAS_DE_ORIGEM));
    expect(m).toBe(
      [
        "Pedido novo #668 · Recolha de móveis",
        "📍 Olivais, Lisboa · a 22 km de si",
        `💶 Ganho estimado: ${esperado} (já sem a taxa e sem IVA)`,
        `Ver e propor: ${PEDIDO.link}`,
        "(Para não receber estes avisos, responda parar.)",
      ].join("\n"),
    );
  });

  it("sem saudação, sem nome — nunca «Bom dia, Nova.» para a «Nova Recolha»", () => {
    for (const nome of ["Nova Recolha", "Bruno Silva", null]) {
      const m = avisoDePedidoAoProfissional(nome, PEDIDO, TARDE);
      expect(m.split("\n")[0]).toMatch(/^Pedido novo #310 · /);
      expect(m).not.toMatch(/Bom dia|Boa tarde|Boa noite|Olá/);
      expect(m).not.toContain("Nova");
      expect(m).not.toContain("Bruno");
      expect(m).not.toContain("undefined");
      expect(m).not.toContain("null");
    }
  });

  it("sem a apresentação, sem a descrição, sem notas, sem a explicação do orçamento", () => {
    const comTudo = {
      ...PEDIDO,
      descricao: "Para levar: dois sofás\nNotas: tocar à campainha\nPor confirmar: o dia",
      urgencia: "hoje",
    };
    const m = avisoDePedidoAoProfissional("Bruno", comTudo, TARDE);
    for (const fora of [
      "assistente de pedidos",
      "Aqui é a CLYON",
      "dois sofás",
      "Notas",
      "Por confirmar",
      "O orçamento é feito",
      "Fotografias e proposta",
      "Receberia",
      "É para hoje",
    ]) {
      expect(m, fora).not.toContain(fora);
    }
    expect(m.split("\n")).toHaveLength(5);
  });

  it("o n.º do pedido e a ligação, que é por onde ele vê e propõe", () => {
    const m = avisoDePedidoAoProfissional("Bruno", PEDIDO, TARDE);
    expect(m).toContain("#310");
    expect(m).toContain(`Ver e propor: ${PEDIDO.link}`);
  });

  it("a localidade é a do pedido, sem código postal colado", () => {
    expect(localidadeParaOAviso("1800-123 Olivais, Lisboa")).toBe("Olivais, Lisboa");
    expect(localidadeParaOAviso("  Alcabideche ")).toBe("Alcabideche");
    for (const v of [null, undefined, "", "   ", "2750-001"]) expect(localidadeParaOAviso(v)).toBeNull();
  });

  it("sem localidade ou sem distância, a linha do 📍 fica com o que há — ou cai inteira", () => {
    expect(avisoDePedidoAoProfissional(null, { ...PEDIDO, localidade: null }, TARDE)).toContain("📍 a 7 km de si\n");
    expect(avisoDePedidoAoProfissional(null, { ...PEDIDO, distanciaKm: null }, TARDE)).toContain("📍 Alcabideche\n");
    const nada = avisoDePedidoAoProfissional(null, { ...PEDIDO, localidade: "  ", distanciaKm: null }, TARDE);
    expect(nada).not.toContain("📍");
    expect(nada).not.toContain("km");
    expect(nada.split("\n")).toHaveLength(4);
    expect(distanciaCurtaParaOAviso(22.6)).toBe("a 23 km de si");
    for (const km of [null, undefined, NaN, -1]) expect(distanciaCurtaParaOAviso(km as number | null)).toBeNull();
  });
});

describe("o ganho é o número DELE, e é o mesmo que o painel lhe mostra", () => {
  it("é o líquido depois da taxa da plataforma, e não o que o cliente indicou", () => {
    /*
     * O erro caro seria mandar «100,00 €» — o valor do cliente. O número sai
     * da MESMA função que o painel usa (é o que antes saía em «Receberia …»).
     */
    const esperado = quantoOProfissionalRecebe(100, TAXAS_DE_ORIGEM);
    const m = avisoDePedidoAoProfissional("Bruno", PEDIDO, TARDE);
    expect(m).toContain(esperado.toFixed(2).replace(".", ","));
    expect(m).not.toContain("100,00 €");
  });

  it("diz que é sem a taxa e sem IVA", () => {
    expect(ganhoParaOAviso(PEDIDO)).toContain("(já sem a taxa e sem IVA)");
  });

  it("POR CARGA muda a frase — 94,00 € por três cargas não é 94,00 €", () => {
    const porCarga = { ...PEDIDO, baseDoPreco: "carga" as const };
    expect(ganhoParaOAviso(porCarga)).toMatch(/€ por carga \(já sem a taxa e sem IVA\)$/);
  });

  it("sem valor de partida NÃO inventa um zero", () => {
    for (const v of [null, 0, NaN]) {
      const sem = { ...PEDIDO, valorDesejadoCliente: v as number | null };
      expect(ganhoParaOAviso(sem), String(v)).toContain("a proposta é sua");
      expect(ganhoParaOAviso(sem), String(v)).not.toContain("0,00");
      expect(avisoDePedidoAoProfissional(null, sem, TARDE)).toContain("💶 Sem valor de partida: a proposta é sua.");
    }
  });
});

describe("o que a mensagem NUNCA pode levar", () => {
  it("a morada exacta do cliente não entra — só a localidade", () => {
    /*
     * A regra é a do painel dele e não se abre uma excepção por o canal ser
     * outro: nesta fase ele vê a localidade e mais nada. O molde só conhece
     * `localidade`, e este teste guarda que ninguém lhe acrescenta um campo
     * `morada` numa tarde distraída.
     */
    const fonte = semComentarios(ler("src/lib/aviso-de-pedido-ao-profissional.ts"));
    expect(fonte).not.toMatch(/\bmorada\b/i);
    expect(fonte).not.toMatch(/\baddress\b/i);
    expect(fonte).not.toMatch(/contactPhone|contactName|telefoneDoCliente/);
  });

  it("nem o valor máximo do cliente, que é privado", () => {
    const fonte = semComentarios(ler("src/lib/aviso-de-pedido-ao-profissional.ts"));
    expect(fonte).not.toContain("valorMaximoCliente");
  });
});

describe("a descrição é do cliente, e chega como ele a escreveu", () => {
  it("uma descrição enorme é cortada, e cortada na palavra", () => {
    const longa = "sofá ".repeat(100);
    const curta = descricaoParaOAviso(longa);
    expect(curta!.length).toBeLessThan(200);
    expect(curta!.endsWith("…")).toBe(true);
    // Cortar a meio de uma palavra faz o leitor parar a adivinhar.
    expect(curta).not.toMatch(/so…$/);
  });

  it("vazia, ou só espaços, não deixa um cabeçalho pendurado", () => {
    for (const v of [null, undefined, "", "   ", "\n\n"]) {
      expect(descricaoParaOAviso(v)).toBeNull();
    }
    const sem = avisoDePedidoAoProfissional("Bruno", { ...PEDIDO, descricao: "  " }, TARDE);
    expect(sem).not.toContain("O cliente escreveu:");
    expect(sem).not.toContain("\n\n\n");
  });

  it("as mudanças de linha dele não partem a mensagem em blocos", () => {
    const d = descricaoParaOAviso("uma\n\n\ncoisa\n  e outra");
    expect(d).toBe("uma coisa e outra");
  });
});

describe("a urgência e a distância só aparecem quando dizem alguma coisa", () => {
  it("«sem pressa» não ocupa espaço nenhum", () => {
    expect(urgenciaParaOAviso("sem_pressa")).toBeNull();
    expect(urgenciaParaOAviso(null)).toBeNull();
  });

  it("«hoje» e «amanhã» aparecem, porque mudam a decisão dele", () => {
    expect(urgenciaParaOAviso("hoje")).toContain("hoje");
    expect(urgenciaParaOAviso("amanha")).toContain("amanhã");
    expect(urgenciaParaOAviso("urgente")).toContain("hoje");
  });

  it("sem distância medida, a frase cai inteira em vez de dizer «null km»", () => {
    for (const km of [null, undefined, NaN, -1]) {
      expect(distanciaParaOAviso(km as number | null)).toBeNull();
    }
    const m = avisoDePedidoAoProfissional("Bruno", { ...PEDIDO, distanciaKm: null }, TARDE);
    expect(m).not.toContain("km");
    expect(m).not.toContain("null");
  });
});

describe("a saída — e ela tem de funcionar, senão isto é spam", () => {
  it("cada mensagem diz como se sai", () => {
    expect(avisoDePedidoAoProfissional("Bruno", PEDIDO, TARDE)).toContain(COMO_SE_SAI);
    expect(COMO_SE_SAI).toContain("parar");
  });

  it("«parar» é reconhecido como as pessoas o escrevem mesmo", () => {
    /*
     * Quem escreve isto está irritado. Exigir-lhe a palavra exacta, sem ponto
     * final e sem maiúsculas, é ter um opt-out que não existe — e a pessoa
     * passa da irritação para a queixa.
     */
    for (const t of ["parar", "PARAR", "Parar.", " parar ", "parem", "pára", "Stop"]) {
      expect(ePedidoParaParar(t), t).toBe(true);
    }
  });

  it("mas uma frase que só contém a palavra não conta", () => {
    for (const t of [
      "não quero parar agora, mando proposta logo",
      "vou parar aí amanhã",
      "",
      null,
    ]) {
      expect(ePedidoParaParar(t), String(t)).toBe(false);
    }
  });

  it("e as duas portas de entrada do WhatsApp sabem dele", () => {
    /*
     * A ponte e o webhook da Meta. Qual deles está ligado depende de variáveis
     * de ambiente que mudam sem ninguém tocar nestes ficheiros — e uma saída
     * que só funciona num dos canais não é uma saída.
     *
     * ⚠️ NA PONTE tem de estar ANTES do desvio dos números interrompidos:
     * ficam interrompidos os números a que o dono escreveu à mão, que são
     * precisamente os dos profissionais. Era aí que a promessa falhava.
     */
    const ponte = semComentarios(ler("src/app/api/whatsapp/ponte/route.ts"));
    const webhook = semComentarios(ler("src/app/api/whatsapp/webhook/route.ts"));
    expect(ponte).toContain("ePedidoParaParar");
    expect(webhook).toContain("ePedidoParaParar");
    expect(ponte.indexOf("ePedidoParaParar")).toBeLessThan(
      ponte.indexOf("tratarMensagemDoCliente(telefone"),
    );
    expect(ponte).toContain("desligarAvisosPeloTelefone");
    expect(webhook).toContain("desligarAvisosPeloTelefone");
  });
});

describe("as fechaduras — e são três", () => {
  it("há um interruptor próprio, e nasce DESLIGADO", () => {
    /*
     * A regra está escrita no topo de `assistente-interruptores.ts`: «o
     * interruptor de uma capacidade que já funciona nasce ligado; o de uma
     * capacidade NOVA nasce desligado».
     */
    expect(CAPACIDADES).toContain("avisar_profissional");
    expect(FICHA_DA_CAPACIDADE.avisar_profissional.porOmissao).toBe(false);
  });

  it("e o nome cabe na coluna, que é VARCHAR(20) e chave primária", () => {
    for (const c of CAPACIDADES) expect(c.length, c).toBeLessThanOrEqual(20);
  });

  it("a ficha diz o que pára, e diz o que NÃO pára", () => {
    // Quem carrega tem de saber que o email e o push continuam a sair. Sem
    // isso, desliga isto a pensar que calou os avisos todos.
    const f = FICHA_DA_CAPACIDADE.avisar_profissional.oQuePara;
    expect(f).toContain("WhatsApp");
    expect(f).toMatch(/email/i);
  });

  it("a distribuição exige as três antes de enfileirar", () => {
    /*
     * O interruptor de quem manda, a vontade de quem recebe, e um número que
     * seja mesmo um telemóvel. Faltando uma, não se enfileira nada.
     */
    const d = semComentarios(ler("src/lib/distribuir-pedido.ts"));
    expect(d).toContain("avisaPorWhatsApp");
    expect(d).toContain("telemovelParaWhatsApp");
    expect(d).toContain('assistentePode("avisar_profissional")');
  });

  it("e só telemóveis passam — um fixo de Lisboa não é um WhatsApp", () => {
    /*
     * A inscrição aceita fixos (`^[239]\\d{8}$`) e a coluna é gravada em cru.
     * `telefoneParaWhatsApp` devolvia `219876543` tal e qual, sem indicativo —
     * e um primeiro contacto para aí chega a outra pessoa qualquer, com o nome
     * de um cliente e um valor lá dentro.
     */
    expect(telemovelParaWhatsApp("912345678")).toBe("351912345678");
    expect(telemovelParaWhatsApp("+351 912 345 678")).toBe("351912345678");
    expect(telemovelParaWhatsApp("00351912345678")).toBe("351912345678");
    expect(telemovelParaWhatsApp("219876543")).toBeNull();
    expect(telemovelParaWhatsApp("123")).toBeNull();
    expect(telemovelParaWhatsApp(null)).toBeNull();
  });
});

describe("não sai tudo no mesmo segundo, que é o que faz banir um número", () => {
  it("a distribuição ENFILEIRA, e não envia", () => {
    /*
     * O ciclo da distribuição é um `Promise.all` sobre todos os elegíveis.
     * Enviar ali punha oito primeiros contactos do mesmo número no mesmo
     * segundo — o padrão de envio em massa. E não custa um cliente: custa o
     * número, e um número banido cala a plataforma inteira.
     */
    const d = semComentarios(ler("src/lib/distribuir-pedido.ts"));
    expect(d).toContain("porNaFilaDeAvisosAoProfissional");
    expect(d).not.toContain("enviarTextoWhatsApp");
  });

  it("e a passagem do assistente solta poucos de cada vez", () => {
    const a = semComentarios(ler("src/lib/assistente-automatico.ts"));
    expect(a).toContain("avisosAoProfissionalPorSair(AVISOS_AO_PROFISSIONAL_POR_PASSAGEM)");
  });

  it("respeita a hora — ninguém é acordado às 3 da manhã por um pedido", () => {
    const a = semComentarios(ler("src/lib/assistente-automatico.ts"));
    const i = a.indexOf('podeFazer("avisar_profissional")');
    expect(i).toBeGreaterThan(-1);
    expect(a.slice(i, i + 120)).toContain("horaDeFalar(agora)");
  });

  it("uma linha por pedido e por profissional, para sempre", () => {
    /*
     * A redistribuição e a passagem horária do alcance voltam a passar pelos
     * mesmos pedidos. Sem a chave única, um profissional recebia o mesmo
     * trabalho duas e três vezes — e quem recebe duas não lê nenhuma.
     */
    const db = ler("src/lib/db.ts");
    expect(db).toContain("UNIQUE KEY uq_pedido_pro (pedidoId, providerId)");
    expect(db).toContain("INSERT IGNORE INTO avisosAoProfissional");
  });
});

describe("o número dele não fica esquecido numa tabela", () => {
  it("o texto é apagado quando a linha fecha — leva lá um token de acesso", () => {
    const db = semComentarios(ler("src/lib/db.ts"));
    const i = db.indexOf("export async function fecharAvisoAoProfissional");
    expect(i).toBeGreaterThan(-1);
    expect(db.slice(i, db.indexOf("\n}", i))).toContain("texto = NULL");
  });

  it("apagar a conta dele leva a fila com ela", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain("DELETE FROM avisosAoProfissional WHERE providerId = ?");
  });

  it("e apagar o pedido também", () => {
    // Senão o assistente mandava mensagens sobre um pedido que já não existe,
    // com um link que não vai dar a lado nenhum.
    const db = ler("src/lib/db.ts");
    expect(db).toContain("DELETE FROM avisosAoProfissional WHERE pedidoId = ?");
  });

  it("e uma linha que nunca chegou a sair morre sozinha", () => {
    const db = semComentarios(ler("src/lib/db.ts"));
    expect(db).toContain("limparAvisosAoProfissionalVencidos");
    const i = db.indexOf("export async function limparAvisosAoProfissionalVencidos");
    expect(db.slice(i, db.indexOf("\n}", i))).toContain("validoAte <= NOW()");
  });
});

describe("o consentimento é dele, e só dele", () => {
  it("há uma rota própria, e o providerId vem da sessão", () => {
    /*
     * Nunca do corpo: se viesse, bastava mudar um número para ligar avisos em
     * nome de outro profissional — que é exactamente o consentimento
     * falsificado que isto existe para impedir.
     */
    const r = semComentarios(ler("src/app/api/profissionais/avisos-whatsapp/route.ts"));
    // A sessão confirmada na base (30-09-2026): uma conta suspensa não liga
    // avisos com um cookie que ainda não caducou.
    expect(r).toContain("sessaoActivaDoProfissional");
    expect(r).toContain("definirAvisosNoWhatsApp(sessao.providerId");
    expect(r).not.toMatch(/corpo\.providerId|body\.providerId/);
  });

  it("só `true` liga — tudo o resto desliga", () => {
    // Na dúvida sobre um consentimento a resposta é não: ligar por engano
    // manda mensagens a quem não as pediu; desligar por engano não faz mal.
    const r = semComentarios(ler("src/app/api/profissionais/avisos-whatsapp/route.ts"));
    expect(r).toContain("corpo.quer === true");
  });

  it("e o backoffice NÃO tem botão para ligar por eles", () => {
    /*
     * "Só ele, no painel" — 20-09-2026. O dono podia ligar para toda a gente
     * num minuto e ter isto a funcionar hoje; um sim que outra pessoa dá não é
     * defensável à frente de ninguém.
     */
    const admin = semComentarios(ler("src/components/admin/AdminAssistenteAutoPanel.tsx"));
    expect(admin).not.toContain("definirAvisosNoWhatsApp");
    // Mas mostra quantos já disseram que sim, senão o dono liga o interruptor,
    // não vê sair nada, e conclui que está avariado.
    expect(admin).toContain("queremAvisos");
  });

  it("a data fica gravada — é ela a prova", () => {
    const db = semComentarios(ler("src/lib/db.ts"));
    const i = db.indexOf("export async function definirAvisosNoWhatsApp");
    const corpo = db.slice(i, db.indexOf("\n}", i));
    expect(corpo).toContain("whatsappAvisosEm");
  });

  it("e está escrito nos termos e na privacidade ANTES de acontecer", () => {
    const termos = ler("src/app/termos/page.tsx");
    const privacidade = ler("src/app/privacidade/page.tsx");
    expect(termos).toContain("WhatsApp");
    expect(termos).toContain("parar");
    expect(privacidade).toContain("profissional");
    expect(privacidade).toMatch(/activar no painel|activar no seu painel|ele o activar/);
  });
});
