#!/usr/bin/env node
/**
 * PUBLICAR UMA ATUALIZAÇÃO DA APP CLYON PRO (EAS Update) — d23, 13-11-2026.
 *
 *   node scripts/publicar-app-pro.mjs            (publica no canal production)
 *   node scripts/publicar-app-pro.mjs --ensaio   (verifica tudo e não publica)
 *
 * Corre-se da raiz de uma worktree em dia com a origin/main, com o
 * app-pro/node_modules instalado (npm ci) e a sessão do eas-cli aberta.
 * Pára antes de publicar se:
 *   1. há alterações por commitar em app-pro/ ou src/lib/;
 *   2. a fingerprint não é a da build da Play (nenhum telemóvel a receberia);
 *   3. NÃO HÁ NOTA NOVA: a primeira nota da lista «pro» de
 *      src/lib/notas-das-apps.json tem de ser nova desde a última publicada
 *      (etiqueta app-pro-publicada) — scripts/nota-da-app.mjs.
 * Publica com «[nota:<id>] <assunto do commit>», escreve o grupo e os ids da
 * atualização (para pôr em «updates» da nota) e move a etiqueta.
 *
 * Guardado por src/lib/notas-das-apps.test.ts.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** A fingerprint da build 13 da Play (versionCode da versão 13) — ver app-pro/LEIA-ME.md. */
export const FINGERPRINT_DA_BUILD = "dcf63afc942dbf9bc6465f4ec788580612025532";
export const ETIQUETA = "app-pro-publicada";
/** A versão que publica. Muda-se aqui, de propósito, nunca sozinha. */
export const EAS_CLI = "eas-cli@27.4.1";
const NOTAS = "src/lib/notas-das-apps.json";

const ensaio = process.argv.includes("--ensaio");
/*
 * Sem shell (no Windows o npx.cmd só corre por um shell, que parte a mensagem
 * nos espaços): o node corre o npx do próprio npm e o cli do expo-updates.
 */
const NPX_CLI = [
  join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"),
  join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npx-cli.js"),
].find((c) => existsSync(c));
const CLI_DA_FINGERPRINT = join("app-pro", "node_modules", "expo-updates", "bin", "cli.js");

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}
function parar(motivo) {
  process.stderr.write(`\nNÃO SE PUBLICOU: ${motivo}\n`);
  process.exit(1);
}

if (!NPX_CLI) parar("não encontrei o npx do npm ao lado do node.");
if (!existsSync(CLI_DA_FINGERPRINT)) parar("falta o app-pro/node_modules (npm ci em app-pro/).");
try {
  execFileSync("git", ["fetch", "-q", "origin", `+refs/tags/${ETIQUETA}:refs/tags/${ETIQUETA}`], { stdio: "ignore" });
} catch {
  /* ainda não há etiqueta no GitHub: a primeira vez */
}

// 1. Sem alterações por commitar no que vai na app.
const sujo = git("status", "--porcelain", "--", "app-pro", "src/lib");
if (sujo) parar(`há alterações por commitar:\n${sujo}`);
const sha = git("rev-parse", "HEAD");

// 2. A fingerprint da build.
const fp = spawnSync(process.execPath, [join("node_modules", "expo-updates", "bin", "cli.js"), "fingerprint:generate", "--platform", "android"], {
  cwd: "app-pro",
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
let agora = "";
try {
  agora = JSON.parse(fp.stdout).hash;
} catch {
  parar(`não consegui calcular a fingerprint (${(fp.stderr || "").slice(0, 300)})`);
}
if (agora !== FINGERPRINT_DA_BUILD) parar(`a fingerprint mudou (${agora} ≠ ${FINGERPRINT_DA_BUILD}): precisa de uma build nova na Play.`);
console.log(`Fingerprint: ${agora} (a da build).`);

// 3. A nota desta atualização.
const pasta = mkdtempSync(join(tmpdir(), "nota-pro-"));
const antes = join(pasta, "antes.json");
let textoAntes = "";
try {
  git("rev-parse", "-q", "--verify", `refs/tags/${ETIQUETA}`);
  try {
    textoAntes = git("show", `${ETIQUETA}:${NOTAS}`);
  } catch {
    textoAntes = "";
  }
} catch {
  textoAntes = "";
}
writeFileSync(antes, textoAntes);
const gate = spawnSync(process.execPath, ["scripts/nota-da-app.mjs", "pro", antes, NOTAS], { encoding: "utf8" });
if (gate.status !== 0) parar(gate.stderr.trim() || "a nota não passou.");
const nota = gate.stdout.trim();
console.log(`Nota: ${nota}`);

const assunto = git("log", "-1", "--format=%s").replace(/["\r\n]/g, "").slice(0, 180);
const mensagem = `[nota:${nota}] ${assunto}`;
if (ensaio) {
  console.log(`\nEnsaio: tudo certo. Publicaria ${sha.slice(0, 8)} com «${mensagem}».`);
  process.exit(0);
}

// 4. Publicar.
const pub = spawnSync(
  process.execPath,
  [NPX_CLI, "--yes", EAS_CLI, "update", "--channel", "production", "--environment", "production", "--platform", "android", "--non-interactive", "--json", "--message", mensagem],
  { cwd: "app-pro", encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
if (pub.status !== 0) parar(`o eas update falhou:\n${(pub.stderr || pub.stdout || "").slice(-2000)}`);
let grupos = [];
try {
  grupos = JSON.parse(pub.stdout.slice(pub.stdout.indexOf("[")));
} catch {
  console.log(pub.stdout);
}
for (const u of grupos) console.log(`Publicada: grupo ${u.group}, ${u.platform} ${u.id}, runtime ${u.runtimeVersion}`);
const ids = grupos.map((u) => u.id).filter(Boolean);
if (ids.length) console.log(`\nPara «updates» da nota ${nota}: ${JSON.stringify(ids)}`);

// 5. Marcar a publicada.
git("tag", "-f", ETIQUETA, sha);
const push = spawnSync("git", ["push", "-f", "origin", `refs/tags/${ETIQUETA}`], { encoding: "utf8" });
if (push.status !== 0) process.stderr.write(`Aviso: a etiqueta ${ETIQUETA} ficou só local (${push.stderr.trim()}).\n`);
else console.log(`A etiqueta ${ETIQUETA} está agora em ${sha}.`);
