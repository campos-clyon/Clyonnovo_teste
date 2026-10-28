// ENSAIO DA PONTE DO WHATSAPP, SEM EMPARELHAR — corre dentro da imagem da ponte
// (montado em /app/ensaio.mjs pelo workflow «Ensaio da ponte»).
//
// Prova que o Chromium abre e que o whatsapp-web.js passa o inject até ao
// evento «qr». Pára aí. Não fala com o site, não pede código de emparelhamento,
// não usa sessão guardada (a pasta é nova a cada tentativa) e NUNCA escreve o
// conteúdo do QR: o repositório e os registos das acções são públicos.
//
// As opções do Client são as da ponte (ponte-whatsapp/index.js, `arrancar`).
// Como a ponte, tenta outra vez quando o arranque falha, até ao prazo.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;
const require = createRequire(import.meta.url);
const VERSOES = "https://raw.githubusercontent.com/wppconnect-team/wa-version/main";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/chromium";
const PRAZO_MS = Number(process.env.PRAZO_MS ?? 180_000);

const t0 = Date.now();
const log = (...a) => console.log(`[ensaio ${((Date.now() - t0) / 1000).toFixed(1)} s]`, ...a);
const curto = (e) => String(e?.message ?? e).replace(/\s+/g, " ").slice(0, 200);

log(
  "node", process.version,
  "| whatsapp-web.js", require("whatsapp-web.js/package.json").version,
  "| puppeteer", require("puppeteer/package.json").version,
);

let versao = null;
try {
  const r = await fetch(`${VERSOES}/versions.json`, { signal: AbortSignal.timeout(15_000) });
  versao = (await r.json())?.currentVersion ?? null;
} catch (e) {
  log("sem a versão actual da página:", curto(e));
}
log("página do WhatsApp Web:", versao ?? "a da biblioteca");

let client = null;
let acabou = false;
async function fim(codigo, motivo) {
  if (acabou) return;
  acabou = true;
  log(motivo);
  try {
    await client?.destroy();
  } catch {
    /* já fechado */
  }
  process.exit(codigo);
}
setTimeout(() => fim(1, `ERRO: sem «qr» em ${PRAZO_MS / 1000} s`), PRAZO_MS).unref();

for (let tentativa = 1; !acabou; tentativa++) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "sessao-"));
  log(`tentativa ${tentativa}`);
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: pasta }),
    puppeteer: {
      executablePath: CHROME,
      headless: true,
      protocolTimeout: 10 * 60_000,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-first-run", "--no-zygote"],
    },
    ...(versao ? { webVersion: versao, webVersionCache: { type: "remote", remotePath: `${VERSOES}/html/${versao}.html` } } : {}),
  });
  // O conteúdo do QR nunca sai daqui: só se diz que chegou.
  client.on("qr", () => fim(0, `QR recebido (tentativa ${tentativa}): o Chromium abriu e o inject passou.`));
  client.on("loading_screen", (p) => log("a carregar…", `${p}%`));
  client.on("authenticated", () => fim(2, "ERRO: autenticou — não devia haver sessão nenhuma"));
  client.on("auth_failure", (m) => fim(3, `ERRO: auth_failure: ${curto(m)}`));
  try {
    await client.initialize();
    log("initialize() devolveu; à espera do «qr»");
    await new Promise((r) => setTimeout(r, PRAZO_MS));
  } catch (e) {
    log(`a tentativa ${tentativa} falhou:`, curto(e));
    try {
      await client.destroy();
    } catch {
      /* já fechado */
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
}
