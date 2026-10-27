/**
 * AS ROTINAS DA VERCEL — e se cada uma está viva. 27-10-2026 (decisão d7).
 *
 * Seis das sete rotinas só escreviam no registo quando mexiam em alguma
 * coisa: «não houve nada a fazer» e «morreu ou rebentou» pareciam iguais no
 * backoffice. Agora cada passagem fica carimbada em `passagensDasRotinas`
 * (`carimbarPassagem`, em `licoes-da-vitoria-na-base.ts`), também quando não
 * há nada e quando rebenta, e o painel «Rotinas» (Configs, só administrador)
 * mostra a última de cada uma.
 *
 * Este ficheiro é PURO: a lista das rotinas e a regra do vermelho. Há um
 * teste que compara a lista com o `vercel.json` e com as pastas de
 * `src/app/api/cron` — uma rotina nova tem de vir cá dizer de quanto em
 * quanto tempo corre.
 */

export type Rotina = {
  /** O nome da pasta em `src/app/api/cron` — é com ele que a passagem se carimba. */
  nome: string;
  /** O que faz, dito para quem lê o painel. */
  titulo: string;
  /** O horário do `vercel.json`, igual letra a letra. */
  horario: string;
  /** De quanto em quanto tempo corre, em minutos. */
  intervaloMin: number;
};

export const ROTINAS: readonly Rotina[] = [
  { nome: "assistente", titulo: "Passagem do assistente (avisos e lembretes)", horario: "*/10 * * * *", intervaloMin: 10 },
  { nome: "ler-conversas", titulo: "A Vitória lê as conversas paradas", horario: "*/15 * * * *", intervaloMin: 15 },
  { nome: "alcancar-pedidos", titulo: "Pedidos abertos voltam a procurar profissionais", horario: "15 * * * *", intervaloMin: 60 },
  { nome: "conferir-pagamentos", titulo: "Conferência dos pagamentos no euPago", horario: "45 * * * *", intervaloMin: 60 },
  { nome: "libertar-por-prazo", titulo: "Trabalhos libertados por prazo", horario: "0 4 * * *", intervaloMin: 24 * 60 },
  { nome: "purgar-pedidos", titulo: "Purga dos pedidos antigos", horario: "30 4 * * *", intervaloMin: 24 * 60 },
  { nome: "licoes-da-vitoria", titulo: "Lições da Vitória", horario: "20 5 * * *", intervaloMin: 24 * 60 },
  { nome: "weekly-digest", titulo: "Resumo semanal por email", horario: "0 9 * * 1", intervaloMin: 7 * 24 * 60 },
];

/** A última passagem de uma rotina, como a base a devolve (idades no relógio da base). */
export type UltimaPassagem = {
  rotina: string;
  ok: boolean;
  motivo: string | null;
  /** Há quantos segundos começou. */
  haSegundos: number;
  /** Quanto durou, em segundos — `null` se não acabou. */
  durouS: number | null;
};

export type EstadoDaRotina = {
  rotina: Rotina;
  ultima: UltimaPassagem | null;
  /** Vermelha: falhou na última, ou passou mais de 2× o intervalo sem passar. */
  vermelha: boolean;
  porque: string;
};

/**
 * A REGRA DO VERMELHO. Pura.
 *
 * · a última passagem falhou → vermelha, com o motivo;
 * · a última começou há mais de 2× o intervalo → vermelha («não passa há…»);
 * · nunca passou: só é vermelha se os carimbos já existem há mais de 2× o
 *   intervalo dela (`carimbosHaSegundos`, a idade da passagem mais antiga de
 *   todas). Logo a seguir à publicação o resumo semanal ainda não teve
 *   ocasião de correr, e não é uma avaria.
 */
export function estadoDaRotina(
  rotina: Rotina,
  ultima: UltimaPassagem | null,
  carimbosHaSegundos: number | null,
): EstadoDaRotina {
  const limiteS = 2 * rotina.intervaloMin * 60;
  if (!ultima) {
    const vermelha = carimbosHaSegundos != null && carimbosHaSegundos > limiteS;
    return {
      rotina,
      ultima: null,
      vermelha,
      porque: vermelha ? `não passou desde que as passagens se registam (${haQuantoTempo(carimbosHaSegundos ?? 0)})` : "ainda não passou",
    };
  }
  if (!ultima.ok) {
    return { rotina, ultima, vermelha: true, porque: `falhou: ${ultima.motivo ?? "sem motivo registado"}` };
  }
  if (ultima.haSegundos > limiteS) {
    return { rotina, ultima, vermelha: true, porque: `não passa há ${haQuantoTempo(ultima.haSegundos)}` };
  }
  return { rotina, ultima, vermelha: false, porque: ultima.motivo ? `ok — ${ultima.motivo}` : "ok" };
}

/** O estado de todas, pela ordem da lista. */
export function estadoDasRotinas(
  ultimas: UltimaPassagem[],
  carimbosHaSegundos: number | null,
): EstadoDaRotina[] {
  const porNome = new Map(ultimas.map((u) => [u.rotina, u]));
  return ROTINAS.map((r) => estadoDaRotina(r, porNome.get(r.nome) ?? null, carimbosHaSegundos));
}

/** Quantas estão vermelhas — o número do selo. */
export function contarVermelhas(estados: EstadoDaRotina[]): number {
  return estados.filter((e) => e.vermelha).length;
}

export function haQuantoTempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 90) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 90) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} dias`;
}
