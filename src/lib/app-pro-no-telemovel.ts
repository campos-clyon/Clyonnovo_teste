import { getPool, ensureProvidersSchema } from "./db";
import { dataEHoraEmLisboa, instanteDaBase } from "./hora-de-lisboa";

/*
 * QUEM TEM A APP CLYON PRO — 27-10-2026.
 *
 * Para o teste fechado da Play Store passar, é preciso saber quem já abriu a
 * app e com que versão, e para que Gmail se manda o convite quando o do
 * telemóvel não é o da conta. Três colunas em `providers` (ver db.ts):
 * `appAbertaEm` e `appVersao` (gravadas pela rota da sessão, sempre que a app
 * abre) e `gmailDoTeste` / `gmailDoTesteEm` (escritos por ele no painel).
 */

/** A versão como a app a manda no cabeçalho — curta, e só caracteres de versão. */
export function versaoDoCabecalho(cru: string | null | undefined): string {
  if (typeof cru !== "string") return "";
  const v = cru.trim().slice(0, 40);
  return /^[0-9A-Za-z.\-+ ()_]+$/.test(v) ? v : "";
}

/** Os cabeçalhos onde a app pode mandar a versão. */
export const CABECALHOS_DA_VERSAO = ["x-app-versao", "x-app-version"] as const;

/** Um Gmail, e só um Gmail: é o que a lista de testadores da Play Console aceita. */
export function validarGmail(cru: unknown): { ok: true; gmail: string } | { ok: false; erro: string } {
  const g = typeof cru === "string" ? cru.trim().toLowerCase() : "";
  if (!g) return { ok: false, erro: "Escreva o Gmail do seu telemóvel." };
  if (g.length > 120 || !/^[a-z0-9.+_-]+@gmail\.com$/.test(g)) {
    return { ok: false, erro: "Tem de ser um endereço @gmail.com." };
  }
  return { ok: true, gmail: g };
}

/** «App: sim, aberta a 27/10/2026 · 14:05 · 1.0.3», ou «sem app». */
export function textoDaApp(appAbertaEm: string | Date | null | undefined, appVersao?: string | null): string {
  const d = instanteDaBase(appAbertaEm ?? null);
  if (!d) return "sem app";
  const versao = typeof appVersao === "string" && appVersao.trim() ? ` · ${appVersao.trim()}` : "";
  return `App: sim, aberta a ${dataEHoraEmLisboa(d)}${versao}`;
}

/** A app abriu: grava quando e com que versão. Nunca lança — a sessão já foi renovada. */
export async function registarAppAberta(providerId: number, versao: string): Promise<void> {
  try {
    await ensureProvidersSchema();
    const pool = await getPool();
    if (!pool) return;
    await pool.execute("UPDATE providers SET appAbertaEm = NOW(), appVersao = ? WHERE id = ?", [
      versao || null,
      providerId,
    ]);
  } catch (e) {
    console.error("[app-pro-no-telemovel] registar:", e instanceof Error ? e.message : e);
  }
}

/** Guarda o Gmail que ele escreveu no painel. */
export async function guardarGmailDoTeste(providerId: number, gmail: string): Promise<boolean> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return false;
  await pool.execute("UPDATE providers SET gmailDoTeste = ?, gmailDoTesteEm = NOW() WHERE id = ?", [
    gmail,
    providerId,
  ]);
  return true;
}

export type GmailParaOTeste = {
  providerId: number;
  nome: string;
  gmail: string;
  escritoEm: string | null;
  temApp: boolean;
};

/** A lista «Gmails para pôr no teste» do backoffice — os mais recentes primeiro. */
export async function gmailsParaOTeste(): Promise<GmailParaOTeste[]> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return [];
  const [linhas] = (await pool.execute(
    `SELECT id, name, gmailDoTeste, gmailDoTesteEm, appAbertaEm
       FROM providers
      WHERE gmailDoTeste IS NOT NULL AND gmailDoTeste <> '' AND estado <> 'apagado'
      ORDER BY gmailDoTesteEm DESC
      LIMIT 200`,
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas.map((l) => {
    const em = instanteDaBase((l.gmailDoTesteEm as string | Date | null) ?? null);
    return {
      providerId: Number(l.id),
      nome: String(l.name ?? ""),
      gmail: String(l.gmailDoTeste ?? ""),
      escritoEm: em ? dataEHoraEmLisboa(em) : null,
      temApp: l.appAbertaEm != null,
    };
  });
}
