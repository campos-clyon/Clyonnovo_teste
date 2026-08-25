import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A ponte do Winapp — o WhatsApp emparelhado no PC como transporte do site.
 *
 * Sem Meta configurada, o site continua a poder falar com o cliente: as
 * mensagens ficam na fila (whatsappFila) e o Winapp vem buscá-las com um
 * segredo partilhado. Os botões degradam para SIM/NÃO em texto, e o cérebro
 * entende as palavras. Quando a Cloud API existir, ela manda sozinha — a
 * ponte passa a suplente sem mudar mais nada.
 *
 * O que NÃO pode partir: o segredo compara-se em tempo constante; um número
 * SEM pedido activo devolve {meu:false} e o site não lhe toca — a conversa é
 * do bot local do Winapp; e uma mensagem só se risca da fila DEPOIS de o
 * Winapp confirmar que saiu.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const CLOUD = ler("src/lib/whatsapp-cloud.ts");
const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");
const PONTE = ler("src/app/api/whatsapp/ponte/route.ts");
const DB = ler("src/lib/db.ts");
const ROTA_ADMIN = ler("src/app/api/admin/whatsapp/route.ts");
const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");
const ADMIN = ler("src/components/admin/LegacyAdminClient.tsx");

describe("o transporte escolhe o caminho", () => {
  it("a Cloud API manda quando está configurada — a ponte é a suplente", () => {
    // Nos dois envios: primeiro pergunta-se pela Meta, só depois pela ponte.
    const texto = CLOUD.slice(CLOUD.indexOf("export async function enviarTextoWhatsApp"));
    expect(texto.indexOf("whatsappConfigurado()")).toBeLessThan(texto.indexOf("ponteConfigurada()"));
    const botoes = CLOUD.slice(CLOUD.indexOf("export async function enviarBotoesWhatsApp"));
    expect(botoes.indexOf("whatsappConfigurado()")).toBeLessThan(botoes.indexOf("ponteConfigurada()"));
  });

  it("pela ponte, as mensagens vão à fila em vez de à Meta", () => {
    expect(CLOUD).toContain("guardarNaFilaWhatsApp");
  });

  it("os botões degradam para SIM e NÃO em palavras", () => {
    expect(CLOUD).toContain('b.id.startsWith("ct:")');
    expect(CLOUD).toContain("responda SIM");
    expect(CLOUD).toContain("responda NÃO");
  });

  it("sem Meta e sem ponte, tudo devolve false — falha fechada", () => {
    // O caminho comum nasce a false e só vira true se algum canal aceitar.
    const canal = CLOUD.slice(
      CLOUD.indexOf("async function enviarTextoPorCanal"),
      CLOUD.indexOf("export async function enviarTextoWhatsApp"),
    );
    expect(canal).toContain("let saiu = false;");
    expect(canal).toContain("else if (ponteConfigurada())");
    expect(canal).toContain("return saiu;");
  });
});

describe("a rota da ponte", () => {
  it("o segredo compara-se em tempo constante e sem ele é 503", () => {
    expect(PONTE).toContain("timingSafeEqual");
    expect(PONTE).toContain("503");
    expect(PONTE).toContain("401");
  });

  it("um número sem pedido activo é do bot local — {meu: false} e nada mais", () => {
    const post = PONTE.slice(PONTE.indexOf("export async function POST"));
    // A pergunta vem ANTES de o cérebro tocar na mensagem.
    expect(post.indexOf("pedidosDoTelefone(telefone)")).toBeLessThan(
      post.indexOf("tratarMensagemDoCliente"),
    );
    expect(post).toContain("meu: false");
  });

  it("só se risca da fila por confirmação do Winapp", () => {
    expect(PONTE).toContain("export async function PATCH");
    expect(PONTE).toContain("marcarFilaWhatsAppEnviadas");
    // O GET não marca nada como enviado.
    const get = PONTE.slice(PONTE.indexOf("export async function GET"), PONTE.indexOf("export async function POST"));
    expect(get).not.toContain("marcarFilaWhatsAppEnviadas");
  });
});

describe("a fila na base", () => {
  it("existe, com criação preguiçosa como as outras tabelas novas", () => {
    expect(DB).toContain("CREATE TABLE IF NOT EXISTS whatsappFila");
    expect(DB).toContain("ensureFilaWhatsAppTable");
  });

  it("entrega mais velhas primeiro — numa conversa a ordem é significado", () => {
    expect(DB).toContain("ORDER BY criadoEm ASC, id ASC");
  });
});

describe("o painel de controlo manda em tudo", () => {
  it("todo o envio pergunta primeiro: desligado, bloqueado ou interrompido cala", () => {
    expect(DB).toContain("export async function podeOWhatsAppFalarCom");
    // Os dois envios passam pelo mesmo guarda.
    expect(CLOUD).toContain("autorizadoAFalarCom");
    const texto = CLOUD.slice(CLOUD.indexOf("export async function enviarTextoWhatsApp"));
    expect(texto).toContain("autorizadoAFalarCom(para)");
    // E o cérebro também — nem a resposta de "não o conheço" sai.
    expect(CEREBRO).toContain("podeOWhatsAppFalarCom(telefone)");
  });

  it("sem linha na base o interruptor está LIGADO — desligar é a excepção", () => {
    expect(DB).toContain("rows.length === 0 || Number(rows[0].ligado) === 1");
  });

  it("desligado, nem o que já estava na fila sai pela ponte", () => {
    const get = PONTE.slice(PONTE.indexOf("export async function GET"), PONTE.indexOf("export async function POST"));
    expect(get).toContain("whatsappLigado()");
  });

  it("o Winapp avisa quando o dono responde à mão — e a conversa fica entregue", () => {
    expect(PONTE).toContain('corpo.accao === "interromper"');
    expect(PONTE).toContain("Respondeu à mão no WhatsApp");
  });

  it("interrompido é do site ({meu: true}) mas em silêncio — o bot local também se cala", () => {
    const post = PONTE.slice(PONTE.indexOf("export async function POST"));
    expect(post).toContain("numeroInterrompidoWhatsApp(telefone)");
    expect(post).toContain("meu: true, paraEnviar: []");
  });

  it("bloqueado ou desligado, o site lava as mãos — {meu: false}", () => {
    const post = PONTE.slice(PONTE.indexOf("export async function POST"));
    expect(post.indexOf("whatsappLigado()")).toBeLessThan(post.indexOf("pedidosDoTelefone"));
    expect(post.indexOf("numeroBloqueadoWhatsApp")).toBeLessThan(post.indexOf("pedidosDoTelefone"));
  });

  it("a rota do backoffice exige admin e tem as seis acções", () => {
    expect(ROTA_ADMIN).toContain("requireAdmin");
    for (const accao of ["ligar", "desligar", "bloquear", "desbloquear", "interromper", "retomar"]) {
      expect(ROTA_ADMIN).toContain(`case "${accao}"`);
    }
  });

  it("o painel vive na barra da Plataforma, com interruptor, entregas e bloqueados", () => {
    expect(ADMIN).toContain('"whatsapp"');
    expect(ADMIN).toContain("<AdminWhatsAppPanel />");
    expect(PAINEL).toContain("Desligar tudo");
    expect(PAINEL).toContain("Devolver ao site");
    expect(PAINEL).toContain("Desbloquear");
  });
});

describe("o cérebro entende as palavras", () => {
  it("SIM fecha e NÃO recusa — pelo MESMO corpo dos botões", () => {
    expect(CEREBRO).toContain("fecharPeloCliente");
    expect(CEREBRO).toContain("recusarPeloCliente");
    // O ramo dos botões e o das palavras chamam as mesmas funções.
    const botao = CEREBRO.slice(CEREBRO.indexOf('conteudo.tipo === "botao"'), CEREBRO.indexOf("Texto livre"));
    expect(botao).toContain("fecharPeloCliente(telefone, alvo)");
    expect(botao).toContain("recusarPeloCliente(telefone, alvo)");
  });

  it("os acentos e a pontuação não mudam a palavra — «Não!» é «nao»", () => {
    expect(CEREBRO).toContain('.normalize("NFD")');
  });

  it("com várias propostas na mesa, um SIM sozinho não fecha nenhuma — pede o valor", () => {
    expect(CEREBRO).toContain("Diga qual pelo valor");
  });

  it("«fechar 300» encontra a proposta de 300 € pelo valor em cima da mesa", () => {
    expect(CEREBRO).toContain("valorNaMesa");
    expect(CEREBRO).toContain("Math.abs(a.valorNaMesa - valorPedido)");
  });
});
