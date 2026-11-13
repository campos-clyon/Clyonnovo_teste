#!/usr/bin/env node
/**
 * NENHUMA ATUALIZAÇÃO DAS APPS SAI SEM NOTA — d23, 13-11-2026.
 *
 *   node scripts/nota-da-app.mjs <pro|cliente> <antes.json> <agora.json>
 *
 * `agora.json` é o src/lib/notas-das-apps.json do commit a publicar;
 * `antes.json` é o mesmo ficheiro no commit da última atualização publicada
 * (a etiqueta app-pro-publicada / app-cliente-publicada). Pode estar vazio
 * ou não existir (a primeira vez).
 *
 * Passa (sai 0 e escreve o id da nota) só se a primeira nota da app — a mais
 * recente — for NOVA (não estava na publicada) e todas as notas da app
 * estiverem bem escritas. Senão sai 1 e diz porquê. Quem publica é que chama
 * isto: a Action «Actualizar a app de cliente» e scripts/publicar-app-pro.mjs.
 *
 * Sem dependências, de propósito: a Action corre-o antes de instalar nada.
 */
import { existsSync, readFileSync } from "node:fs";

export const APPS = ["pro", "cliente"];
export const MAXIMO_DA_NOTA = 220;

/** Palavras de quem faz a app, não de quem a usa. */
const TECNICAS = /(?<![\p{L}\d])(eas|ota|bundle|build|commit|deploy|api|update|updates|runtime|fingerprint|bug|bugs|hotfix|release)(?![\p{L}\d])/iu;
/** Português do Brasil que escapa (a mesma ideia da regra a da orquestra). */
const DO_BRASIL = /(?<![\p{L}\d])(você|vocês|celular|tela|usuário|usuária|arquivo|ônibus|baixar)(?![\p{L}\d])/iu;
/** Na Pro diz-se «profissional»; na de cliente, «parceiro» (regra n da orquestra). */
const PALAVRA_DA_OUTRA = {
  pro: /(?<![\p{L}\d])parceir[oa]s?(?![\p{L}\d])/iu,
  cliente: /(?<![\p{L}\d])profissiona(l|is)(?![\p{L}\d])/iu,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lerJson(caminho) {
  if (!caminho || !existsSync(caminho)) return null;
  const texto = readFileSync(caminho, "utf8").trim();
  if (!texto) return null;
  return JSON.parse(texto);
}

/** Os erros de escrita das notas de uma app (lista vazia = tudo bem). */
export function errosDasNotas(app, notas) {
  const erros = [];
  const lista = notas?.[app];
  if (!Array.isArray(lista) || lista.length === 0) return [`Não há notas da app «${app}».`];
  const idDaApp = new RegExp(`^${app}-\\d{4}-\\d{2}-\\d{2}(-\\d{1,2})?$`);
  const vistos = new Set();
  for (const [i, n] of lista.entries()) {
    const onde = `nota ${i + 1} (${n?.id ?? "sem id"})`;
    if (typeof n?.id !== "string" || !idDaApp.test(n.id)) erros.push(`${onde}: o id tem de ser «${app}-AAAA-MM-DD» (ou «-2», «-3»… no mesmo dia).`);
    else if (vistos.has(n.id)) erros.push(`${onde}: id repetido.`);
    else vistos.add(n.id);
    const t = typeof n?.nota === "string" ? n.nota.trim() : "";
    if (t.length < 10) erros.push(`${onde}: falta a nota.`);
    if (t.length > MAXIMO_DA_NOTA) erros.push(`${onde}: mais de ${MAXIMO_DA_NOTA} caracteres (uma ou duas linhas).`);
    if (t.split("\n").length > 2) erros.push(`${onde}: mais de duas linhas.`);
    if (TECNICAS.test(t)) erros.push(`${onde}: tem uma palavra técnica (${t.match(TECNICAS)[0]}).`);
    if (DO_BRASIL.test(t)) erros.push(`${onde}: português do Brasil (${t.match(DO_BRASIL)[0]}).`);
    if (PALAVRA_DA_OUTRA[app]?.test(t)) erros.push(`${onde}: na app «${app}» não se diz «${t.match(PALAVRA_DA_OUTRA[app])[0]}».`);
    if (!Array.isArray(n?.updates) || n.updates.some((u) => typeof u !== "string" || !UUID.test(u)))
      erros.push(`${onde}: «updates» é uma lista de ids de atualização (pode estar vazia).`);
  }
  return erros;
}

/** { ok: true, id } se a nota mais recente da app é nova e tudo está bem escrito; senão { ok: false, motivo }. */
export function notaParaPublicar(app, antes, agora) {
  if (!APPS.includes(app)) return { ok: false, motivo: `App desconhecida: «${app}».` };
  const erros = errosDasNotas(app, agora);
  if (erros.length) return { ok: false, motivo: erros.join("\n") };
  const id = agora[app][0].id;
  const publicadas = Array.isArray(antes?.[app]) ? antes[app].map((n) => n?.id) : [];
  if (publicadas.includes(id))
    return {
      ok: false,
      motivo: `A nota mais recente da app «${app}» (${id}) já foi com a atualização anterior. Escreva no início da lista «${app}» de src/lib/notas-das-apps.json uma nota nova que diga o que esta traz.`,
    };
  return { ok: true, id };
}

if (/nota-da-app.mjs$/.test(process.argv[1] ?? "")) {
  const [app, antesF, agoraF] = process.argv.slice(2);
  let r;
  try {
    const agora = lerJson(agoraF);
    if (!agora) r = { ok: false, motivo: `Não li as notas em «${agoraF}».` };
    else r = notaParaPublicar(app, lerJson(antesF), agora);
  } catch (e) {
    r = { ok: false, motivo: `As notas não se leem: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (r.ok) {
    process.stdout.write(r.id + "\n");
  } else {
    process.stderr.write(r.motivo + "\n");
    process.exit(1);
  }
}
