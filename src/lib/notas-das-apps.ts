import notas from "./notas-das-apps.json";

/**
 * O QUE CADA ATUALIZAÇÃO DAS APPS TRAZ — d23, 13-11-2026.
 *
 * A lista única está em `notas-das-apps.json` (dados, para a Action e o
 * scripts/publicar-app-pro.mjs a lerem sem instalar nada): por app, a mais
 * recente PRIMEIRO, uma entrada por atualização, com a nota em uma ou duas
 * linhas. As regras de escrita e a de «nenhuma atualização sai sem nota» estão
 * em scripts/nota-da-app.mjs.
 *
 * COMO A NOTA SE LIGA À ATUALIZAÇÃO: quem publica exige que a primeira nota
 * da app seja nova desde a última publicada e põe o id dela na mensagem do
 * EAS Update («[nota:pro-2026-11-13] …»). A app pede a nota com o id da
 * atualização (o `updateId` do manifest); se o id estiver em `updates` de uma
 * entrada, é essa; senão é a mais recente — que é a da última publicada,
 * porque nenhuma sai sem a sua.
 */
export type AppComNotas = "pro" | "cliente";
export type NotaDaApp = { id: string; nota: string; updates: string[] };
export type NotaResolvida = { id: string; nota: string; exacta: boolean };

const NOTAS = notas as Record<AppComNotas, NotaDaApp[]>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function eAppComNotas(app: unknown): app is AppComNotas {
  return app === "pro" || app === "cliente";
}

export function notasDaApp(app: AppComNotas): readonly NotaDaApp[] {
  return NOTAS[app] ?? [];
}

/** A nota de uma atualização: a que tem o id em `updates`, ou a mais recente. */
export function notaDaAtualizacao(app: AppComNotas, updateId?: string | null, lista = notasDaApp(app)): NotaResolvida | null {
  const id = typeof updateId === "string" && UUID.test(updateId) ? updateId.toLowerCase() : null;
  const certa = id ? lista.find((n) => n.updates.some((u) => u.toLowerCase() === id)) : undefined;
  const nota = certa ?? lista[0];
  if (!nota) return null;
  return { id: nota.id, nota: nota.nota, exacta: Boolean(certa) };
}
