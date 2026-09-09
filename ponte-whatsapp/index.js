/**
 * A PONTE DO WHATSAPP — o número da CLYON emparelhado num servidor, a falar
 * com o cérebro do site.
 *
 * "O site não responde." Não respondia porque, sem a API da Meta, o que o
 * cliente escreve chega ao telemóvel e ao WhatsApp Web, e não ao site. Esta
 * ponte fecha esse buraco: emparelha-se ao 931 632 622 como mais um
 * «dispositivo ligado», recebe o que os clientes escrevem, entrega-o ao site
 * e envia o que o site responde. Corre num servidor (Railway), 24 horas.
 *
 * O PROTOCOLO É O QUE O SITE JÁ TINHA (src/app/api/whatsapp/ponte/route.ts):
 *
 *   POST  {telefone, texto}  — chegou uma mensagem; devolve {meu, paraEnviar}
 *   GET                      — o que está na fila por enviar
 *   PATCH {ids}              — estas saíram mesmo
 *   POST  {telefone, accao: "interromper"} — o dono respondeu à mão
 *
 * Tudo com `Authorization: Bearer <PONTE_WHATSAPP_SEGREDO>` — o mesmo segredo
 * nas variáveis do Vercel e daqui.
 *
 * O QUE ISTO É E NÃO É: usa a biblioteca Baileys, que fala o protocolo do
 * WhatsApp Web — não é a API oficial. Funciona com um número normal, sem
 * conta de empresa, mas a Meta pode um dia recusar-se; a saída definitiva é a
 * API oficial, e o site já a suporta (WHATSAPP_TOKEN). Até lá, é isto.
 *
 * VARIÁVEIS:
 *   SITE_URL                — https://clyon.pt
 *   PONTE_WHATSAPP_SEGREDO  — o segredo partilhado com o site
 *   PONTE_NUMERO            — 351931632622: com isto, o emparelhamento é por
 *                             CÓDIGO (mais fácil de ler nos logs do que um QR)
 *   INTERVALO_MS            — de quanto em quanto tempo vai buscar a fila (5000)
 *   PASTA_DA_SESSAO         — onde guarda as credenciais (./auth); no Railway,
 *                             um volume montado aí, senão emparelha-se a cada arranque
 */

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";

const SITE = (process.env.SITE_URL ?? "https://clyon.pt").replace(/\/+$/, "");
const SEGREDO = process.env.PONTE_WHATSAPP_SEGREDO ?? "";
const NUMERO = (process.env.PONTE_NUMERO ?? "").replace(/\D/g, "");
const INTERVALO = Math.max(2000, Number(process.env.INTERVALO_MS ?? 5000));
const PASTA = process.env.PASTA_DA_SESSAO ?? "./auth";

if (!SEGREDO) {
  console.error("[ponte] Falta PONTE_WHATSAPP_SEGREDO — sem ele o site recusa a ponte (401).");
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), "[ponte]", ...a);

// ── O site ─────────────────────────────────────────────────────────────────

async function site(metodo, corpo) {
  const res = await fetch(`${SITE}/api/whatsapp/ponte`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${SEGREDO}`,
      "Content-Type": "application/json",
    },
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

function jidDe(telefone) {
  let d = String(telefone).replace(/\D/g, "");
  if (d.length === 9 && d.startsWith("9")) d = "351" + d;
  return `${d}@s.whatsapp.net`;
}

function telefoneDe(m) {
  const candidatos = [m.key?.remoteJid, m.key?.senderPn, m.key?.participantPn, m.key?.remoteJidAlt];
  for (const c of candidatos) {
    if (typeof c === "string" && c.endsWith("@s.whatsapp.net")) return c.split("@")[0];
  }
  return null;
}

function textoDe(m) {
  const msg = m.message ?? {};
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.videoMessage?.caption ??
    msg.documentMessage?.caption ??
    null
  );
}

let sock = null;
let ligado = false;

async function enviar(telefone, texto) {
  if (!sock || !ligado) throw new Error("WhatsApp não está ligado");
  const r = await sock.sendMessage(jidDe(telefone), { text: texto });
  if (r?.key?.id) enviadasPorMim.add(r.key.id);
  // O conjunto não cresce para sempre.
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

async function arrancar() {
  const { state, saveCreds } = await useMultiFileAuthState(PASTA);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: ["CLYON", "Chrome", "1.0"],
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  // Emparelhar por código, se ainda não está registado e há número.
  if (!state.creds.registered && NUMERO) {
    setTimeout(async () => {
      try {
        const codigo = await sock.requestPairingCode(NUMERO);
        log("=====================================================");
        log("CÓDIGO DE EMPARELHAMENTO:", codigo);
        log("No telemóvel do", NUMERO, ": Definições › Dispositivos ligados › Ligar dispositivo › Ligar com número de telefone, e escreva o código.");
        log("=====================================================");
      } catch (e) {
        log("não consegui pedir o código:", e.message);
      }
    }, 3000);
  }

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr && !NUMERO) {
      log("Leia este QR no telemóvel (Dispositivos ligados):");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      ligado = true;
      log("ligado ao WhatsApp. A ir buscar a fila a cada", INTERVALO, "ms.");
    }
    if (connection === "close") {
      ligado = false;
      const codigo = lastDisconnect?.error?.output?.statusCode;
      const saiu = codigo === DisconnectReason.loggedOut;
      log("ligação fechada", codigo ?? "", saiu ? "— sessão terminada no telemóvel; apague a pasta da sessão e emparelhe outra vez" : "— a religar…");
      if (!saiu) setTimeout(arrancar, 3000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      try {
        const jid = m.key?.remoteJid ?? "";
        // Grupos, estados e difusões não são clientes.
        if (jid.endsWith("@g.us") || jid === "status@broadcast" || jid.endsWith("@broadcast")) continue;
        const telefone = telefoneDe(m);
        if (!telefone) continue;

        if (m.key?.fromMe) {
          // Uma mensagem NOSSA que não fomos nós a enviar: o dono respondeu à
          // mão, do telemóvel ou do WhatsApp Web. A conversa passa a ser dele —
          // o site cala o cérebro nesse número até alguém a devolver no painel.
          if (m.key?.id && enviadasPorMim.has(m.key.id)) continue;
          await site("POST", { telefone, accao: "interromper" }).catch((e) => log("interromper:", e.message));
          log("o dono respondeu à mão a", telefone, "— conversa entregue");
          continue;
        }

        const texto = textoDe(m);
        if (!texto) {
          // Fotos e áudios sem texto: o site não os lê por aqui. Avisa-se o site
          // com uma marca, para a conversa não ficar sem resposta.
          const temImagem = Boolean(m.message?.imageMessage);
          if (!temImagem) continue;
          const r = await site("POST", { telefone, texto: "[fotografia]" });
          await despachar(r.paraEnviar);
          continue;
        }

        log("←", telefone, texto.slice(0, 60).replace(/\n/g, " "));
        const r = await site("POST", { telefone, texto });
        if (r?.meu) await despachar(r.paraEnviar);
      } catch (e) {
        log("ao tratar uma mensagem:", e.message);
      }
    }
  });
}

setInterval(rondaDaFila, INTERVALO);
arrancar().catch((e) => {
  console.error("[ponte] não arrancou:", e);
  process.exit(1);
});
