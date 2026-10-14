/*
 * O RASCUNHO DO SIMULADOR VOLTA — 14-10-2026 (auditoria de SEO, 30 dias).
 *
 * O simulador guardava o rascunho a cada tecla e apagava-o ao abrir («F5
 * sempre reseta»): quem recarregava a página, perdia a rede a meio ou voltava
 * mais tarde encontrava tudo em branco — e muitos não voltavam a escrever.
 * Agora o que escreveu volta, durante 3 dias, e apaga-se quando o pedido é
 * enviado ou quando a pessoa escolhe começar de novo.
 *
 * As fotografias não: um ficheiro escolhido não sobrevive a uma página
 * recarregada. Guarda-se quantas eram, para o ecrã pedir que as escolha outra
 * vez.
 */

export const CHAVE_DO_RASCUNHO = "clyon_simulator_draft";
export const VALIDADE_DO_RASCUNHO_HORAS = 72;

export type Rascunho<T> = {
  dados: T;
  /** O texto da caixa da morada, que vive fora dos dados. */
  morada?: string;
  /** Quantas fotografias estavam escolhidas — elas próprias não voltam. */
  fotos?: number;
  /** Quando se guardou, em ISO. */
  quando: string;
};

/** Campos que vêm preenchidos por omissão e não contam como «a pessoa escreveu». */
const POR_OMISSAO = new Set(["precisaFatura", "files"]);

function temAlgumaCoisa(dados: Record<string, unknown>, morada: string): boolean {
  if (morada.trim()) return true;
  return Object.entries(dados).some(([k, v]) => {
    if (POR_OMISSAO.has(k) || v == null || v === "") return false;
    if (typeof v === "object") return Object.values(v as Record<string, unknown>).some((x) => x != null && x !== "");
    return true;
  });
}

/** O que se guarda, sem as fotografias — ou null, se ainda não há nada escrito. */
export function rascunhoParaGuardar<T extends Record<string, unknown>>(
  dados: T,
  morada: string,
  agora: Date,
): Rascunho<Omit<T, "files">> | null {
  if (!temAlgumaCoisa(dados, morada)) return null;
  const { files, ...semFotos } = dados as T & { files?: unknown[] };
  return {
    dados: semFotos,
    ...(morada.trim() ? { morada } : {}),
    ...(Array.isArray(files) && files.length > 0 ? { fotos: files.length } : {}),
    quando: agora.toISOString(),
  };
}

/** O rascunho guardado, se ainda vale — null se não há, se está estragado ou se passou o prazo. */
export function rascunhoValido<T>(cru: string | null, agora: Date): Rascunho<T> | null {
  if (!cru) return null;
  try {
    const r = JSON.parse(cru) as Rascunho<T>;
    if (!r || typeof r !== "object" || !r.dados || !r.quando) return null;
    const idade = agora.getTime() - new Date(r.quando).getTime();
    if (!Number.isFinite(idade) || idade < 0 || idade > VALIDADE_DO_RASCUNHO_HORAS * 3600 * 1000) return null;
    return r;
  } catch {
    return null;
  }
}
