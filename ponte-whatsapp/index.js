/**
 * A PONTE DO WHATSAPP — o WhatsApp Web do número da CLYON, num Chrome sem
 * janela, a falar com o cérebro do site.
 *
 * "Quero fazer como no Winapp: o WhatsApp não oficial dentro da plataforma."
 * É a mesma cadeia — whatsapp-web.js a conduzir um Chromium por Puppeteer,
 * LocalAuth a guardar o emparelhamento, a versão da página do WhatsApp
 * controlada — só que a correr num servidor (Railway) em vez de num PC em
 * casa, e a falar com o site pelo protocolo que a rota /api/whatsapp/ponte
 * já tinha:
 *
 *   POST  {telefone, texto}                — chegou uma mensagem; devolve {meu, paraEnviar}
 *   POST  {telefone, foto: {base64, mime}} — chegou uma fotografia
 *   GET                                    — o que está na fila por enviar
 *   PATCH {ids}                            — estas saíram mesmo
 *   POST  {telefone, accao: "interromper"} — o dono respondeu à mão
 *
 * Tudo com `Authorization: Bearer <PONTE_WHATSAPP_SEGREDO>`, o mesmo segredo
 * nas variáveis do Vercel e daqui. Sem ele, o site responde 503.
 *
 * O QUE ISTO É E NÃO É: do lado da Meta é um telemóvel com o WhatsApp Web
 * aberto — indistinguível de um portátil. Não é a API oficial; a automação
 * viola os termos e o número pode ser bloqueado. Usar num número dedicado. A
 * saída definitiva é a API oficial, que o site já suporta (WHATSAPP_TOKEN).
 *
 * VARIÁVEIS:
 *   SITE_URL                — https://clyon.pt
 *   PONTE_WHATSAPP_SEGREDO  — o segredo partilhado com o site (obrigatório)
 *   PONTE_NUMERO            — 351931632622: com isto, emparelha-se por CÓDIGO
 *                             (mais fácil de ler nos logs do que um QR)
 *   VERSAO_DA_PAGINA        — vazio = usa a versão actual do WhatsApp Web,
 *                             descoberta no arranque. Quando a Meta mexe na
 *                             página e a biblioteca deixa de a conhecer (o
 *                             texto anda, as fotos param), fixa-se aqui uma
 *                             versão anterior que funcione.
 *   CHROME_PATH             — o Chromium (/usr/bin/chromium na imagem)
 *   INTERVALO_MS            — de quanto em quanto tempo vai buscar a fila (5000)
 *   PASTA_DA_SESSAO         — onde guarda o emparelhamento (volume no Railway)
 */

import fs from "node:fs";
import path from "node:path";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

const SITE = (process.env.SITE_URL ?? "https://clyon.pt").replace(/\/+$/, "");
const SEGREDO = process.env.PONTE_WHATSAPP_SEGREDO ?? "";
const NUMERO = (process.env.PONTE_NUMERO ?? "").replace(/\D/g, "");
const INTERVALO = Math.max(2000, Number(process.env.INTERVALO_MS ?? 5000));
const PASTA = process.env.PASTA_DA_SESSAO ?? "./auth";
const VERSAO_FIXA = (process.env.VERSAO_DA_PAGINA ?? "").trim();
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/chromium";

const VERSOES = "https://raw.githubusercontent.com/wppconnect-team/wa-version/main";

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

/**
 * O site está de pé e aceita-nos? Vale a pena perguntar ANTES de abrir o
 * Chromium: um 503 aqui é o Vercel sem o segredo, e um 401 é o segredo
 * trocado — dois enganos que de outra forma só apareceriam depois de
 * emparelhar o telemóvel, quando já ninguém percebe o que correu mal.
 */
async function confirmarOSite() {
  try {
    await site("GET");
    log("o site aceitou a ponte.");
    return true;
  } catch (e) {
    const m = String(e.message);
    if (m.includes(" 503 ")) {
      log("O SITE AINDA NÃO TEM O SEGREDO (503).");
      log("No Vercel › projecto clyon-site › Settings › Environment Variables:");
      log("  PONTE_WHATSAPP_SEGREDO = <o mesmo valor que puseste aqui>, em Production; depois Redeploy.");
    } else if (m.includes(" 401 ")) {
      log("O SEGREDO NÃO É O MESMO NOS DOIS LADOS (401). Compare o valor no Vercel e aqui.");
    } else {
      log("não consegui falar com", SITE, "-", m);
    }
    return false;
  }
}

// ── O WhatsApp ─────────────────────────────────────────────────────────────

/** Os ids das mensagens que NÓS enviámos — para não as tomar por respostas do dono. */
const enviadasPorMim = new Set();
let ligado = false;
let client = null;

function chatIdDe(telefone) {
  let d = String(telefone).replace(/\D/g, "");
  if (d.length === 9 && d.startsWith("9")) d = "351" + d;
  return `${d}@c.us`;
}

function telefoneDe(id) {
  if (typeof id !== "string" || !id.endsWith("@c.us")) return null;
  return id.split("@")[0];
}

/**
 * O número de quem escreveu, seja qual for o feitio do identificador.
 *
 * O WhatsApp antigo dizia `351912345678@c.us` — o número estava à vista. O
 * novo identifica muitos contactos por `@lid`, um número interno que não é o
 * telefone de ninguém, e nas contas de empresa isso é a regra e não a
 * excepção. Quando o identificador não se deixa ler, pergunta-se ao contacto.
 *
 * Devolve null só quando não há mesmo nada a fazer — e nesse caso quem chama
 * escreve nos registos, porque desistir em silêncio foi o que nos custou uma
 * tarde: as mensagens chegavam ao WhatsApp e a ponte não dizia uma palavra.
 */
async function telefoneDaMensagem(msg, bruto) {
  const directo = telefoneDe(bruto);
  if (directo) return directo;
  // Nas mensagens que saem, o contacto seria o nosso próprio número.
  if (msg.fromMe) return null;
  try {
    const contacto = await msg.getContact();
    const n = String(contacto?.number ?? contacto?.id?.user ?? "").replace(/\D/g, "");
    if (n) return n;
  } catch (e) {
    log("não consegui ler o contacto de", bruto, "—", e.message);
  }
  return null;
}

/**
 * A versão da página do WhatsApp Web a carregar.
 *
 * Sem `VERSAO_DA_PAGINA`, pergunta-se qual é a actual — um número fixo no
 * código envelhece e um dia deixa de existir no repositório das versões, e
 * aí nem sequer arranca. Com a variável posta, manda ela: é o botão de
 * emergência para quando a versão nova parte as fotografias.
 */
async function versaoDaPagina() {
  if (VERSAO_FIXA) return VERSAO_FIXA;
  try {
    const res = await fetch(`${VERSOES}/versions.json`, { signal: AbortSignal.timeout(15000) });
    const dados = await res.json();
    const v = dados?.currentVersion;
    if (typeof v === "string" && v.length > 0) return v;
  } catch (e) {
    log("não descobri a versão actual da página:", e.message);
  }
  return null;
}

async function enviar(telefone, texto) {
  if (!client || !ligado) throw new Error("WhatsApp não está ligado");
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

/**
 * Apagar as trancas que o Chromium deixa no perfil.
 *
 * O Chromium tranca a pasta do perfil para dois processos não escreverem lá ao
 * mesmo tempo. A tranca é um ficheiro, e só desaparece quando ele fecha com
 * educação — o que não acontece quando o contentor é morto, nem quando o
 * Railway levanta o contentor novo antes de deitar abaixo o velho. Fica lá, e
 * o arranque seguinte morre com "The profile appears to be in use by another
 * Chromium process", em ciclo, para sempre.
 *
 * Como aqui só corre uma ponte, uma tranca encontrada ao arrancar é sempre de
 * um Chromium que já não existe. Apaga-se.
 */
function destrancarOPerfil() {
  const trancas = ["SingletonLock", "SingletonSocket", "SingletonCookie"];
  let pastas;
  try {
    pastas = fs
      .readdirSync(PASTA, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("session"))
      .map((e) => path.join(PASTA, e.name));
  } catch {
    return; // Primeiro arranque: a pasta ainda nem existe.
  }
  for (const pasta of pastas) {
    for (const tranca of trancas) {
      const f = path.join(pasta, tranca);
      try {
        fs.lstatSync(f); // Lança se não existir. Nota: é um atalho, e um
        fs.rmSync(f, { force: true }); // atalho partido engana o existsSync.
        log("apaguei a tranca", tranca, "que ficou em", path.basename(pasta));
      } catch {
        /* não estava lá, que é o normal */
      }
    }
  }
}

async function arrancar() {
  destrancarOPerfil();
  const versao = await versaoDaPagina();
  log("a arrancar com o Chromium em", CHROME, "e a página", versao ?? "que a biblioteca trouxer");

  client = new Client({
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
    ...(versao
      ? {
          webVersion: versao,
          webVersionCache: { type: "remote", remotePath: `${VERSOES}/html/${versao}.html` },
        }
      : {}),
  });

  let pedirCodigo = Boolean(NUMERO);

  client.on("qr", async (qr) => {
    if (pedirCodigo) {
      pedirCodigo = false; // uma vez só: o QR volta a sair de tempos a tempos
      try {
        const codigo = await client.requestPairingCode(NUMERO);
        log("=====================================================");
        log("CÓDIGO DE EMPARELHAMENTO:", codigo);
        log("No telemóvel do", NUMERO + ":");
        log("Definições › Dispositivos ligados › Ligar dispositivo › Ligar com número de telefone");
        log("=====================================================");
        return;
      } catch (e) {
        log("não consegui pedir o código, fica o QR:", e.message);
      }
    }
    log("Leia este QR no telemóvel (Definições › Dispositivos ligados):");
    qrcode.generate(qr, { small: true });
  });

  client.on("loading_screen", (p) => log("a carregar o WhatsApp Web…", p + "%"));
  client.on("authenticated", () => log("emparelhado — sessão guardada em", PASTA));
  client.on("auth_failure", (m) =>
    log("falha de autenticação:", m, "— apague o conteúdo do volume e emparelhe de novo"),
  );

  client.on("ready", () => {
    ligado = true;
    log("LIGADO AO WHATSAPP. A ir buscar a fila a cada", INTERVALO, "ms.");
    void rondaDaFila();
  });

  client.on("disconnected", (motivo) => {
    ligado = false;
    log("desligado:", motivo, "— a reiniciar em 5 s");
    setTimeout(() => {
      client.destroy().catch(() => {});
      arrancar().catch((e) => log("não religou:", e.message));
    }, 5000);
  });

  /*
   * MESSAGE_CREATE apanha as duas direcções: o que chega e o que sai. É o que
   * permite ver o dono a responder à mão (fromMe, mas não enviado por nós) —
   * e nesse caso o site cala o cérebro nesse número até alguém o devolver.
   */
  client.on("message_create", async (msg) => {
    try {
      const chatId = msg.fromMe ? msg.to : msg.from;
      if (typeof chatId !== "string" || chatId.endsWith("@g.us") || chatId === "status@broadcast") {
        return;
      }
      const telefone = await telefoneDaMensagem(msg, chatId);
      if (!telefone) {
        log("mensagem ignorada — não sei tirar o número de", chatId);
        return;
      }

      if (msg.fromMe) {
        if (msg.id?._serialized && enviadasPorMim.has(msg.id._serialized)) return;
        await site("POST", { telefone, accao: "interromper" }).catch((e) =>
          log("interromper:", e.message),
        );
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
          log(
            "foto de", telefone,
            "não descarregou — a página do WhatsApp Web mudou; fixe VERSAO_DA_PAGINA numa versão anterior",
          );
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

  await client.initialize();
}

setInterval(rondaDaFila, INTERVALO);

// O site primeiro: se não nos aceita, dizemo-lo em português claro e voltamos
// a tentar — não vale a pena abrir o Chromium nem emparelhar nada.
(async () => {
  while (!(await confirmarOSite())) {
    log("a tentar outra vez daqui a 30 s…");
    await new Promise((r) => setTimeout(r, 30000));
  }
  await arrancar();
})().catch((e) => {
  console.error("[ponte] não arrancou:", e);
  process.exit(1);
});
