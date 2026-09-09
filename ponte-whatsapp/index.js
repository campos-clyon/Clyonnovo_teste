/**
 * A PONTE DO WHATSAPP — o WhatsApp Web do número da CLYON, num Chrome sem
 * janela, a falar com o cérebro do site.
 *
 * "Quero fazer como no Winapp: o WhatsApp não oficial dentro da plataforma."
 * É a mesma cadeia do Winapp — whatsapp-web.js a conduzir um Chromium por
 * Puppeteer, LocalAuth a guardar o emparelhamento, a versão da página do
 * WhatsApp fixa numa que se sabe funcionar — só que a correr num servidor
 * (Railway) em vez de num PC em casa, e a falar com o site pelo protocolo
 * que a rota /api/whatsapp/ponte já tinha:
 *
 *   POST  {telefone, texto}            — chegou uma mensagem; devolve {meu, paraEnviar}
 *   POST  {telefone, foto: {base64, mime}} — chegou uma fotografia
 *   GET                                — o que está na fila por enviar
 *   PATCH {ids}                        — estas saíram mesmo
 *   POST  {telefone, accao: "interromper"} — o dono respondeu à mão
 *
 * Tudo com `Authorization: Bearer <PONTE_WHATSAPP_SEGREDO>`, o mesmo segredo
 * nas variáveis do Vercel e daqui.
 *
 * O QUE ISTO É E NÃO É: do lado da Meta é um telemóvel com o WhatsApp Web
 * aberto — indistinguível de um portátil. Não é a API oficial; a automação
 * viola os termos e o número pode ser bloqueado. Usar num número dedicado. A
 * saída definitiva é a API oficial, que o site já suporta (WHATSAPP_TOKEN).
 *
 * VARIÁVEIS:
 *   SITE_URL                — https://clyon.pt
 *   PONTE_WHATSAPP_SEGREDO  — o segredo partilhado com o site
 *   PONTE_NUMERO            — 351931632622: com isto, emparelha-se por CÓDIGO
 *                             (mais fácil de ler nos logs do que um QR)
 *   VERSAO_DA_PAGINA        — a versão do WhatsApp Web a pedir (2.3000.1017054665);
 *                             quando a Meta muda a página e a biblioteca deixa
 *                             de a conhecer, fixa-se aqui uma que funcione
 *   CHROME_PATH             — o Chromium (/usr/bin/chromium na imagem)
 *   INTERVALO_MS            — de quanto em quanto tempo vai buscar a fila (5000)
 *   PASTA_DA_SESSAO         — onde guarda o emparelhamento (./auth; volume no Railway)
 */

import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

const SITE = (process.env.SITE_URL ?? "https://clyon.pt").replace(/\/+$/, "");
const SEGREDO = process.env.PONTE_WHATSAPP_SEGREDO ?? "";
const NUMERO = (process.env.PONTE_NUMERO ?? "").replace(/\D/g, "");
const INTERVALO = Math.max(2000, Number(process.env.INTERVALO_MS ?? 5000));
const PASTA = process.env.PASTA_DA_SESSAO ?? "./auth";
const VERSAO = process.env.VERSAO_DA_PAGINA ?? "2.3000.1017054665";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/chromium";

if (!SEGREDO) {
  console.error("[ponte] Falta PONTE_WHATSAPP_SEGREDO — sem ele o site recusa a ponte (401).");
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), "[ponte]", ...a);

// ── O site ─────────────────────────────────────────────────────────────────

async function site(metodo, corpo) {
  const res = await fetch(`${SITE}/api/whatsapp/ponte`, {
    method: metodo,
    headers: { Authorization: `Bearer ${SEGREDO}`, "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    throw new Error(`${metodo} ${res.status} ${texto.slice(0, 200)}`);
  }
  return res.json();
}

// ── O WhatsApp ─────────────────────────────────────────────────────────────

/** Os ids das mensagens que NÓS enviámos — para não as tomar por respostas do dono. */
const enviadasPorMim = new Set();
let ligado = false;

function chatIdDe(telefone) {
  let d = String(telefone).replace(/\D/g, "");
  if (d.length === 9 && d.startsWith("9")) d = "351" + d;
  return `${d}@c.us`;
}

function telefoneDe(id) {
  if (typeof id !== "string" || !id.endsWith("@c.us")) return null;
  return id.split("@")[0];
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: PASTA }),
  puppeteer: {
    executablePath: CHROME,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
    ],
  },
  // A versão da página do WhatsApp Web, fixa: a biblioteca não vai buscar a
  // mais recente e encontrar um WhatsApp Web que já não conhece — foi isso
  // que partiu as fotografias no Winapp.
  webVersionCache: {
    type: "remote",
    remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${VERSAO}.html`,
  },
});

async function enviar(telefone, texto) {
  if (!ligado) throw new Error("WhatsApp não está ligado");
  const m = await client.sendMessage(chatIdDe(telefone), texto);
  if (m?.id?._serialized) enviadasPorMim.add(m.id._serialized);
  if (enviadasPorMim.size > 2000) {
    for (const id of [...enviadasPorMim].slice(0, 1000)) enviadasPorMim.delete(id);
  }
}

/** Envia o que o site mandou e confirma-lhe, uma a uma — só se risca o que saiu. */
async function despachar(paraEnviar) {
  for (const m of paraEnviar ?? []) {
    try {
      await enviar(m.telefone, m.texto);
      await site("PATCH", { ids: [m.id] });
      log("→", m.telefone, m.texto.slice(0, 60).replace(/\n/g, " "));
    } catch (e) {
      log("não saiu para", m.telefone, "-", e.message);
      // Fica na fila; a ronda seguinte tenta outra vez.
    }
  }
}

let aBuscar = false;
async function rondaDaFila() {
  if (!ligado || aBuscar) return;
  aBuscar = true;
  try {
    const { paraEnviar } = await site("GET");
    if (paraEnviar?.length) await despachar(paraEnviar);
  } catch (e) {
    log("fila:", e.message);
  } finally {
    aBuscar = false;
  }
}

client.on("qr", async (qr) => {
  if (NUMERO) {
    try {
      const codigo = await client.requestPairingCode(NUMERO);
      log("=====================================================");
      log("CÓDIGO DE EMPARELHAMENTO:", codigo);
      log("No telemóvel do", NUMERO, ": Definições › Dispositivos ligados › Ligar dispositivo › Ligar com número de telefone, e escreva o código.");
      log("=====================================================");
      return;
    } catch (e) {
      log("não consegui pedir o código, fica o QR:", e.message);
    }
  }
  log("Leia este QR no telemóvel (Dispositivos ligados):");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => log("emparelhado — sessão guardada em", PASTA));
client.on("auth_failure", (m) => log("falha de autenticação:", m, "— apague a pasta da sessão e emparelhe de novo"));
client.on("ready", () => {
  ligado = true;
  log("ligado ao WhatsApp. A ir buscar a fila a cada", INTERVALO, "ms.");
});
client.on("disconnected", (motivo) => {
  ligado = false;
  log("desligado:", motivo, "— a reiniciar em 5 s");
  setTimeout(() => client.initialize().catch((e) => log("não religou:", e.message)), 5000);
});

/*
 * MESSAGE_CREATE apanha as duas direcções: o que chega e o que sai. É o que
 * permite ver o dono a responder à mão (fromMe, mas não enviado por nós) —
 * e nesse caso o site cala o cérebro nesse número até alguém o devolver.
 */
client.on("message_create", async (msg) => {
  try {
    const chatId = msg.fromMe ? msg.to : msg.from;
    if (typeof chatId !== "string" || chatId.endsWith("@g.us") || chatId === "status@broadcast") return;
    const telefone = telefoneDe(chatId);
    if (!telefone) return;

    if (msg.fromMe) {
      if (msg.id?._serialized && enviadasPorMim.has(msg.id._serialized)) return;
      await site("POST", { telefone, accao: "interromper" }).catch((e) => log("interromper:", e.message));
      log("o dono respondeu à mão a", telefone, "— conversa entregue");
      return;
    }

    if (msg.hasMedia && msg.type === "image") {
      const media = await msg.downloadMedia().catch(() => null);
      if (media?.data) {
        log("← foto de", telefone);
        const r = await site("POST", {
          telefone,
          foto: { base64: media.data, mime: media.mimetype || "image/jpeg" },
          texto: msg.body || "",
        });
        if (r?.meu) await despachar(r.paraEnviar);
      } else {
        log("foto de", telefone, "não descarregou — a versão da página do WhatsApp pode ter mudado (VERSAO_DA_PAGINA)");
      }
      return;
    }

    const texto = (msg.body ?? "").trim();
    if (!texto) return;
    log("←", telefone, texto.slice(0, 60).replace(/\n/g, " "));
    const r = await site("POST", { telefone, texto });
    if (r?.meu) await despachar(r.paraEnviar);
  } catch (e) {
    log("ao tratar uma mensagem:", e.message);
  }
});

setInterval(rondaDaFila, INTERVALO);
log("a arrancar com o Chromium em", CHROME, "e a página", VERSAO);
client.initialize().catch((e) => {
  console.error("[ponte] não arrancou:", e);
  process.exit(1);
});
