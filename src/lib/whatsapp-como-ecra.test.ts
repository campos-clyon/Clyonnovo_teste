import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import { telefoneParaWhatsApp, assinaturaValida, whatsappConfigurado } from "./whatsapp-cloud";

/**
 * O WhatsApp como ecrã do cliente.
 *
 * A visão, nas palavras do Wanderson: "seria como se o site falasse com o
 * cliente, como se o WhatsApp fosse a tela do cliente no site, onde ele pode
 * receber as propostas, contrapropor, aceitar e até escolher data — tudo
 * falando com o site". Hoje é ele a escrever as propostas à mão.
 *
 * O que NÃO pode partir: a identidade é a posse do número (um botão forjado
 * com o pedido de outra pessoa morre no guarda), o webhook só aceita o que a
 * Meta assinou, e sem as variáveis de ambiente tudo falha fechado — o site
 * fica exactamente como era.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const CLOUD = ler("src/lib/whatsapp-cloud.ts");
const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");
const WEBHOOK = ler("src/app/api/whatsapp/webhook/route.ts");
const AVISAR = ler("src/lib/avisar-da-proposta.ts");
const ROTA_PRO = ler("src/app/api/profissionais/negociacao/route.ts");

// ─── O transporte fala só com a API oficial e falha fechado ────────────────

describe("o transporte (whatsapp-cloud)", () => {
  const VARS = [
    "WHATSAPP_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_APP_SECRET",
  ] as const;
  const guardadas: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const v of VARS) {
      guardadas[v] = process.env[v];
      delete process.env[v];
    }
  });
  afterEach(() => {
    for (const v of VARS) {
      if (guardadas[v] === undefined) delete process.env[v];
      else process.env[v] = guardadas[v];
    }
  });

  it("fala com a API oficial da Meta — nunca uma biblioteca whatsapp-web", () => {
    expect(CLOUD).toContain("https://graph.facebook.com");
    // Nenhum import de bibliotecas que fingem ser um telemóvel — banem o número.
    expect(CLOUD).not.toMatch(/from ["'][^"']*(whatsapp-web|venom|baileys)/i);
  });

  it("sem as quatro variáveis de ambiente, não está configurado", () => {
    expect(whatsappConfigurado()).toBe(false);
    for (const v of VARS) process.env[v] = "x";
    expect(whatsappConfigurado()).toBe(true);
    delete process.env.WHATSAPP_APP_SECRET;
    expect(whatsappConfigurado()).toBe(false);
  });

  it("um número português de 9 dígitos ganha o indicativo 351", () => {
    expect(telefoneParaWhatsApp("912 345 678")).toBe("351912345678");
    expect(telefoneParaWhatsApp("+351 912 345 678")).toBe("351912345678");
    expect(telefoneParaWhatsApp("351912345678")).toBe("351912345678");
  });

  it("a assinatura do webhook é HMAC-SHA256 do corpo cru, em tempo constante", () => {
    process.env.WHATSAPP_APP_SECRET = "segredo-de-teste";
    const corpo = '{"entry":[]}';
    const boa = "sha256=" + crypto.createHmac("sha256", "segredo-de-teste").update(corpo, "utf8").digest("hex");
    expect(assinaturaValida(corpo, boa)).toBe(true);
    expect(assinaturaValida(corpo + " ", boa)).toBe(false);
    expect(assinaturaValida(corpo, "sha256=" + "0".repeat(64))).toBe(false);
    expect(assinaturaValida(corpo, null)).toBe(false);
    delete process.env.WHATSAPP_APP_SECRET;
    expect(assinaturaValida(corpo, boa)).toBe(false);
    expect(CLOUD).toContain("timingSafeEqual");
  });

  it("os botões respeitam os limites da API: 3 botões, 20 caracteres de título", () => {
    expect(CLOUD).toContain("botoes.slice(0, 3)");
    expect(CLOUD).toContain(".slice(0, 20)");
  });
});

// ─── O webhook: assinatura primeiro, 200 sempre que ela confere ────────────

describe("o webhook", () => {
  it("valida a assinatura ANTES de interpretar o corpo", () => {
    const posicaoAssinatura = WEBHOOK.indexOf("assinaturaValida(corpoCru");
    const posicaoParse = WEBHOOK.indexOf("JSON.parse(corpoCru)");
    expect(posicaoAssinatura).toBeGreaterThan(-1);
    expect(posicaoParse).toBeGreaterThan(posicaoAssinatura);
  });

  it("o aperto de mão da Meta só devolve o challenge com o verify token certo — e nunca com ele vazio", () => {
    expect(WEBHOOK).toContain('p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN');
    // Sem depender do fim de linha: em Windows o git reescreve os ficheiros
    // com CRLF ao mudar de ramo, e uma asserção presa ao fim de linha passa
    // a falhar sem que uma única linha de código tenha mudado.
    expect(WEBHOOK).toMatch(/&&\s*process\.env\.WHATSAPP_VERIFY_TOKEN\s*\)/);
    expect(WEBHOOK).toContain('p.get("hub.challenge")');
  });

  it("sem configuração responde 503; com assinatura má, 401", () => {
    expect(WEBHOOK).toContain("whatsappConfigurado()");
    expect(WEBHOOK).toContain("503");
    expect(WEBHOOK).toContain("401");
  });

  it("depois da assinatura conferir responde sempre 200 — a Meta reenvia tudo o que não for", () => {
    expect(WEBHOOK).toMatch(/catch[\s\S]*?console\.error[\s\S]*?\n\s*}\s*\n\s*return NextResponse\.json\(\{ ok: true \}\)/);
  });

  it("distingue botões de texto e ignora o resto em silêncio", () => {
    expect(WEBHOOK).toContain("button_reply");
    expect(WEBHOOK).toContain('tipo: "botao"');
    expect(WEBHOOK).toContain('tipo: "texto"');
  });
});

// ─── O cérebro: identidade pela posse do número, motor de sempre ───────────

describe("o cérebro (whatsapp-negociacao)", () => {
  it("resolve o número pelos últimos 9 dígitos e só em pedidos activos", () => {
    expect(CEREBRO).toContain("RIGHT(REGEXP_REPLACE(COALESCE(contactPhone, ''), '[^0-9]', ''), 9)");
    expect(CEREBRO).toContain("NOT IN ('cancelado', 'concluido', 'arquivado')");
  });

  it("o id do botão tem forma fixa e o alvo TEM de ser de quem responde", () => {
    expect(CEREBRO).toContain("/^(ct|rc):(\\d+):(\\d+)$/");
    expect(CEREBRO).toContain("if (!pedidos.includes(pedidoId)) return;");
  });

  it("as acções passam pelo motor com lado cliente — nunca por SQL directo ao estado", () => {
    expect(CEREBRO).toContain('aceitar(estado, "cliente"');
    expect(CEREBRO).toContain("contratar(estado");
    expect(CEREBRO).toContain('desistir(alvo.estado, "cliente"');
    expect(CEREBRO).toContain('propor(estado, "cliente"');
  });

  it("fechar por WhatsApp encerra as outras negociações, como em todo o lado", () => {
    expect(CEREBRO).toContain("encerrarOutrasNegociacoes(alvo.pedidoId, alvo.negociacaoId)");
  });

  it("tudo fica no histórico e no registo permanente como WhatsApp", () => {
    expect(CEREBRO).toContain('autorNome: "WhatsApp"');
    expect(CEREBRO).toContain("appendOrderHistory");
    expect(CEREBRO).toContain("registarSemFalhar");
  });

  it("texto com data marca a dataAgendada; valor vira contraproposta; o resto devolve o ponto de situação", () => {
    expect(CEREBRO).toContain("dataAgendada");
    expect(CEREBRO).toMatch(/propor\(estado, "cliente", valor/);
    expect(CEREBRO).toContain("ecraDoPedido(pedidos[0])");
  });

  it("a contraproposta do cliente avisa o profissional pelo caminho de sempre", () => {
    expect(CEREBRO).toContain('quemPropos: "cliente"');
  });

  it("o total com a taxa CLYON aparece antes de o cliente fechar", () => {
    expect(CEREBRO).toContain("quantoOClientePaga");
  });
});

// ─── As duas mensagens que saem: proposta e aceitação ──────────────────────

describe("o site fala primeiro", () => {
  it("sem email e com telefone, a proposta do profissional segue por WhatsApp com botões", () => {
    const ramoSemEmail = AVISAR.slice(
      AVISAR.indexOf("if (!email)"),
      AVISAR.indexOf("await existeContaComEmail"),
    );
    expect(ramoSemEmail).toContain("pedido.contactPhone");
    expect(ramoSemEmail).toContain("propostaParaOWhatsApp");
  });

  it("os botões da proposta levam o id que fecha ou recusa esta negociação", () => {
    expect(CEREBRO).toContain("`ct:${dados.pedidoId}:${dados.negociacaoId}`");
    expect(CEREBRO).toContain("`rc:${dados.pedidoId}:${dados.negociacaoId}`");
  });

  it("quando o profissional aceita o valor do cliente, o sim chega ao telefone", () => {
    expect(ROTA_PRO).toContain('corpo.accao === "aceitar" && nova.estado === "aguarda_contratacao"');
    expect(ROTA_PRO).toContain("aceitacaoParaOWhatsApp");
    expect(CEREBRO).toContain("aceitacaoParaOWhatsApp");
  });

  it("o aviso ao telefone só sai para pedidos SEM email — quem tem email já tem o link", () => {
    expect(ROTA_PRO).toContain('!(pedido.contactEmail ?? "").trim() && pedido.contactPhone');
  });
});
