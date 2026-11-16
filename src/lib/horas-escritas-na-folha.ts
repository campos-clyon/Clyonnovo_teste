/**
 * AS HORAS COMO A EQUIPA AS ESCREVE — d49 (dono, 16-11-2026).
 *
 * «6,5», «6.5», «6:30», «6h30», «6h», «6 h 30 min» → 6,5 horas. Vazio → null.
 * Lixo → NaN. Uma leitura só para a «Folha final da mudança» e para o
 * «Preencher a folha» da Mesa (d26), e `horasPorExtenso` diz à equipa o que se
 * percebeu («6 h 30 min»), antes de gravar.
 *
 * Puro: os ecrãs e o servidor importam isto.
 */
export function lerHorasDaFolha(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : Number.NaN;
  if (typeof v !== "string") return Number.NaN;
  const t = v.trim().toLowerCase().replace(/\s/g, "");
  if (!t) return null;
  const hm = /^(\d{1,2})(?::|h)(\d{1,2})?(?:m|min)?$/.exec(t);
  if (hm) {
    const m = Number(hm[2] ?? 0);
    if (m >= 60) return Number.NaN;
    return Number(hm[1]) + m / 60;
  }
  const d = t.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(d)) return Number.NaN;
  return Number(d);
}

/** 6,5 → «6 h 30 min»; 6 → «6 h»; 0,25 → «15 min». `null` sem horas válidas. */
export function horasPorExtenso(horas: number | null): string | null {
  if (horas == null || !Number.isFinite(horas) || horas <= 0) return null;
  const minutos = Math.round(horas * 60);
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** O que a caixa das horas mostra por baixo: «= 6 h 30 min», ou o aviso. Vazio → null. */
export function oQueSePercebeuDasHoras(escrito: string): { texto: string; ok: boolean } | null {
  if (!escrito.trim()) return null;
  const p = horasPorExtenso(lerHorasDaFolha(escrito));
  return p ? { texto: `= ${p}`, ok: true } : { texto: "Não percebi as horas (ex.: 6,5 · 6:30 · 6h30)", ok: false };
}
