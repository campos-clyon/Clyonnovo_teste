import { haQuanto, type ConversaNaMesa } from "./mesa-das-conversas";
import { fioParaALeitura, lerAConversa, MENSAGENS_LIDAS } from "./leitura-das-conversas";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";

/**
 * A PASSAGEM DA VITÓRIA PELAS CONVERSAS PARADAS — 21-10-2026.
 *
 * Escolhe as conversas a ler, pede a leitura (`leitura-das-conversas.ts`),
 * guarda o que ela percebeu e fecha as que acabaram, com o porquê e
 * «porQuem: vitoria». Corre de 15 em 15 minutos (`/api/cron/ler-conversas`)
 * e quando alguém carrega em «Pedir à Vitória para ler» no painel.
 *
 * Só lê o que vale a pena: conversas nem fechadas nem bloqueadas, paradas há
 * pelo menos `SOSSEGO_ANTES_DE_LER_S` (para não se meter numa conversa viva),
 * e com mensagens novas desde a última leitura — uma conversa lida não se
 * volta a pagar enquanto ninguém escrever. As 193 de «Entregues a si» passam
 * todas, `CONVERSAS_POR_PASSAGEM` de cada vez.
 *
 * Nunca escreve ao cliente.
 */

/** Duas horas paradas antes de a Vitória a ler. */
export const SOSSEGO_ANTES_DE_LER_S = 2 * 3600;

/** Quantas se lêem em cada passagem — cada uma é uma chamada paga ao modelo. */
export const CONVERSAS_POR_PASSAGEM = 20;

const ultimos9 = (t: string) => t.replace(/\D/g, "").slice(-9);

/**
 * Há novidades desde a última leitura: uma mensagem nova no fio do site — ou,
 * desde 23-10-2026, uma no telemóvel mais nova do que a leitura (a resposta à
 * mão que o site não viu: lida antes dela, a Vitória dizia «ninguém
 * respondeu»).
 */
export function temNovidades(
  l: Pick<ConversaNaMesa, "ultimoId" | "onde" | "haSegundos">,
  leitura: { ateMensagemId: number; lidaHaSegundos?: number | null } | undefined,
): boolean {
  if (!leitura) return true;
  if (leitura.ateMensagemId < l.ultimoId) return true;
  return (
    l.onde === "telemovel" &&
    l.haSegundos != null &&
    leitura.lidaHaSegundos != null &&
    l.haSegundos < leitura.lidaHaSegundos
  );
}

/** Quais se lêem nesta passagem: as que têm novidades, as mais recentes primeiro. Pura. */
export function conversasPorLer(
  mesa: ConversaNaMesa[],
  leituras: Map<string, { ateMensagemId: number; lidaHaSegundos?: number | null }>,
  maximo = CONVERSAS_POR_PASSAGEM,
): ConversaNaMesa[] {
  return mesa
    .filter((l) => l.estado !== "resolvida" && l.estado !== "bloqueada")
    .filter((l) => l.ultimoId > 0 && (l.haSegundos ?? 0) >= SOSSEGO_ANTES_DE_LER_S)
    .filter((l) => temNovidades(l, leituras.get(ultimos9(l.telefone))))
    .sort((a, b) => (a.haSegundos ?? 0) - (b.haSegundos ?? 0))
    .slice(0, maximo);
}

export type PassagemDaLeitura = {
  lidas: number;
  fechadas: number;
  falhas: number;
  /** Quantas ficam por ler depois desta passagem. */
  porLer: number;
  /** Quantas ficaram de fora porque o relógio da passagem chegou ao fim (27-10-2026, d7). */
  deixadasPeloRelogio: number;
  linhas: string[];
};

/**
 * O TEMPO DE UMA PASSAGEM — 27-10-2026 (d7).
 *
 * A rota tem 120 s (`maxDuration`). Vinte conversas, quatro de cada vez, com
 * até 20 + 12 s de modelo cada lote, são 160 s no pior caso: a função era
 * cortada a meio, as leituras do fim perdiam-se e o carimbo da passagem nunca
 * se escrevia. Aos 90 s não se começa lote novo — o que fica, fica para a
 * passagem seguinte, daqui a 15 minutos, e diz-se quantas.
 */
export const SEGUNDOS_PARA_COMECAR_LOTES = 90;

/** Quantas se lêem de cada vez. */
export const CONVERSAS_POR_LOTE = 4;

/**
 * Corre `fazer` em lotes, e não começa um lote novo depois de `prazoMs`
 * contados desde o início. Devolve quantas ficaram de fora. O relógio entra
 * por fora, para o teste lhe dar tempos simulados.
 */
export async function emLotesComPrazo<T>(
  itens: T[],
  fazer: (item: T) => Promise<void>,
  opcoes: { tamanho?: number; prazoMs?: number; relogio?: () => number } = {},
): Promise<{ feitas: number; deixadas: number }> {
  const tamanho = Math.max(1, opcoes.tamanho ?? CONVERSAS_POR_LOTE);
  const prazoMs = opcoes.prazoMs ?? SEGUNDOS_PARA_COMECAR_LOTES * 1000;
  const relogio = opcoes.relogio ?? Date.now;
  const comecou = relogio();
  let i = 0;
  for (; i < itens.length; i += tamanho) {
    if (i > 0 && relogio() - comecou >= prazoMs) break;
    await Promise.all(itens.slice(i, i + tamanho).map(fazer));
  }
  const feitas = Math.min(i, itens.length);
  return { feitas, deixadas: itens.length - feitas };
}

export async function lerAsConversasParadas(
  opcoes: { maximo?: number; telefone?: string; prazoMs?: number; relogio?: () => number } = {},
): Promise<PassagemDaLeitura> {
  const r: PassagemDaLeitura = { lidas: 0, fechadas: 0, falhas: 0, porLer: 0, deixadasPeloRelogio: 0, linhas: [] };
  if (!process.env.GEMINI_API_KEY) {
    r.linhas.push("Sem GEMINI_API_KEY — a Vitória não consegue ler.");
    return r;
  }
  const db = await import("./db");
  const { mesaDasConversasWhatsApp } = await import("./mesa-das-conversas-na-base");
  const [mesa, leituras] = await Promise.all([mesaDasConversasWhatsApp(), db.leiturasDasConversasWhatsApp()]);

  // Uma conversa pedida à mão lê-se já, parada ou não, lida ou não.
  const fila = opcoes.telefone
    ? mesa.filter((l) => ultimos9(l.telefone) === ultimos9(opcoes.telefone ?? "") && l.estado !== "bloqueada")
    : conversasPorLer(mesa, leituras, opcoes.maximo ?? CONVERSAS_POR_PASSAGEM);
  const todas = opcoes.telefone ? fila.length : conversasPorLer(mesa, leituras, Number.MAX_SAFE_INTEGER).length;

  // Quatro de cada vez: depressa, sem pedir trinta coisas ao modelo de uma vez.
  // E sem lote novo depois dos 90 s — ver `emLotesComPrazo`.
  const lotes = await emLotesComPrazo(
    fila,
    async (l) => {
        try {
          const mensagens = await db.mensagensComIdDoNumeroWhatsApp(l.telefone, MENSAGENS_LIDAS);
          if (mensagens.length === 0) return;
          const ate = Math.max(...mensagens.map((m) => m.id));
          // A última que só o telemóvel conhece vai no fim do fio (23-10-2026).
          const t = l.ultimaDoTelemovel;
          const fio = t
            ? [...mensagens, { direccao: t.direccao, texto: t.direccao === "out" ? `${MARCA_DE_MAO} ${t.texto}` : t.texto }]
            : mensagens;
          const leitura = await lerAConversa(fioParaALeitura(fio, haQuanto(l.haSegundos)));
          if (!leitura) {
            r.falhas += 1;
            return;
          }
          await db.guardarLeituraDaConversaWhatsApp(l.telefone, ate, leitura.estado, leitura.motivo);
          r.lidas += 1;
          if (leitura.estado === "resolvida") {
            await db.arquivarConversaWhatsApp(l.telefone, true, { motivo: leitura.motivo, porQuem: "vitoria" });
            r.fechadas += 1;
            r.linhas.push(`${l.telefone}: fechada — ${leitura.motivo}`);
          }
        } catch (e) {
          r.falhas += 1;
          console.error("[ler-as-conversas]", l.telefone, e instanceof Error ? e.message : e);
        }
    },
    { prazoMs: opcoes.prazoMs, relogio: opcoes.relogio },
  );
  r.deixadasPeloRelogio = lotes.deixadas;
  if (lotes.deixadas > 0) {
    r.linhas.push(`${lotes.deixadas} conversa(s) ficaram para a passagem seguinte: o tempo desta acabou.`);
  }
  r.porLer = Math.max(0, todas - r.lidas);
  return r;
}
