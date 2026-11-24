/**
 * O QUE A VITÓRIA FEZ — d102 (CEO e dono, 24-11-2026).
 *
 * Cada passagem de uma rotina fica em `passagensDasRotinas`, com o `detalhe`
 * em JSON (o que a rotina devolveu: enviados, ficaram, naFila…). O painel
 * «Rotinas» mostrava só a última de cada uma; aqui somam-se as passagens de
 * um período — quantas, quantas a vermelho e a soma de cada número do
 * detalhe — para se ver de relance o que a Vitória fez nas últimas 24 h e,
 * dia a dia, nos últimos 7 (dias de Lisboa).
 *
 * A soma é GENÉRICA de propósito: qualquer número que uma rotina venha a pôr
 * no detalhe entra sem mexer aqui. Só se lêem números, verdadeiros/falsos e
 * o tamanho das listas — nunca o texto. O detalhe de algumas rotinas traz
 * linhas com o que se fez; essas linhas não saem daqui, só quantas são.
 *
 * Este ficheiro é PURO: a leitura da base está em `o-que-a-vitoria-fez-na-base.ts`.
 */

import { ROTINAS } from "./rotinas";
import { diaEmLisboa, inicioDoDiaEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";

/** Uma passagem como sai da base: quando começou, se correu bem e o detalhe cru. */
export type PassagemCrua = {
  rotina: string;
  comecouEm: Date;
  ok: boolean;
  detalhe: string | null;
};

export type SomaDaRotina = {
  rotina: string;
  /** O título curto, para o cartão. */
  titulo: string;
  passagens: number;
  /** As que falharam (ok = 0) — a vermelho. */
  vermelhas: number;
  /** A soma de cada número do detalhe, pelo nome do campo («porEmail.enviados» quando vem dentro de outro). */
  numeros: Record<string, number>;
  /** Quantas passagens tinham cada campo verdadeiro/falso a `true` (ligado, foraDaJanela…). */
  vezes: Record<string, number>;
  /** A soma do tamanho de cada lista do detalhe (linhas, falhas…) — só quantas, nunca o que dizem. */
  listas: Record<string, number>;
};

export type SomaDoPeriodo = {
  /** Instantes ISO (UTC) do começo e do fim do período. */
  de: string;
  ate: string;
  rotinas: SomaDaRotina[];
};

export type SomaDoDia = SomaDoPeriodo & {
  /** `YYYY-MM-DD`, em Lisboa. */
  dia: string;
};

/** As da Vitória primeiro, pela ordem da d102; as outras a seguir, pela ordem do painel. */
export const ROTINAS_DA_VITORIA: readonly string[] = [
  "envio-aos-parceiros",
  "propostas-ao-cliente",
  "lembretes-do-que-falta",
  "seguimento-do-cliente",
  "assistente",
  "ler-conversas",
  "escolhidos-sem-resposta",
  "fecho-do-modelo-novo",
];

const TITULOS_CURTOS: Record<string, string> = {
  "envio-aos-parceiros": "Envio aos parceiros",
  "propostas-ao-cliente": "Propostas ao cliente",
  "lembretes-do-que-falta": "Pedir o que falta",
  "seguimento-do-cliente": "Seguimento do cliente",
  assistente: "Avisos e lembretes",
  "ler-conversas": "Leitura das conversas",
  "escolhidos-sem-resposta": "Escolhidos sem resposta",
  "fecho-do-modelo-novo": "«O trabalho já foi feito?»",
};

export function tituloCurto(rotina: string): string {
  return TITULOS_CURTOS[rotina] ?? ROTINAS.find((r) => r.nome === rotina)?.titulo ?? rotina;
}

/** Um nome de campo que se mostra: um identificador do código, nunca uma chave feita de dados (telefones, ids). */
const NOME_DE_CAMPO = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
/** Quantos campos diferentes se guardam por rotina — um detalhe estranho não enche a resposta. */
const MAX_CAMPOS = 60;

function somar(destino: Record<string, number>, chave: string, n: number) {
  if (!(chave in destino) && Object.keys(destino).length >= MAX_CAMPOS) return;
  destino[chave] = (destino[chave] ?? 0) + n;
}

function ehObjecto(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Soma um detalhe à rotina. Números somam-se; `true` conta uma vez; listas
 * contam pelo tamanho; um objecto lá dentro entra com o nome «pai.filho»
 * (um nível só). Texto e o que não se percebe ficam de fora. Um detalhe que
 * não é JSON (cortado aos 20 000 caracteres, por exemplo) não soma nada — a
 * passagem conta na mesma.
 */
export function somarDetalhe(soma: SomaDaRotina, detalhe: unknown): void {
  let obj: unknown = detalhe;
  if (typeof detalhe === "string") {
    try {
      obj = JSON.parse(detalhe);
    } catch {
      return;
    }
  }
  if (!ehObjecto(obj)) return;
  const percorrer = (o: Record<string, unknown>, prefixo: string, nivel: number) => {
    for (const [k, v] of Object.entries(o)) {
      if (!NOME_DE_CAMPO.test(k)) continue;
      const chave = prefixo ? `${prefixo}.${k}` : k;
      if (typeof v === "number") {
        if (Number.isFinite(v)) somar(soma.numeros, chave, v);
      } else if (typeof v === "boolean") {
        if (v) somar(soma.vezes, chave, 1);
      } else if (Array.isArray(v)) {
        somar(soma.listas, chave, v.length);
      } else if (ehObjecto(v) && nivel === 0) {
        percorrer(v, chave, 1);
      }
    }
  };
  percorrer(obj, "", 0);
}

function somaVazia(rotina: string): SomaDaRotina {
  return { rotina, titulo: tituloCurto(rotina), passagens: 0, vermelhas: 0, numeros: {}, vezes: {}, listas: {} };
}

/** A ordem: as da Vitória, depois as do painel, depois as que a lista não conhece (por nome). */
function ordem(rotina: string): number {
  const v = ROTINAS_DA_VITORIA.indexOf(rotina);
  if (v >= 0) return v;
  const p = ROTINAS.findIndex((r) => r.nome === rotina);
  return p >= 0 ? 100 + p : 1000;
}

/**
 * SOMA AS PASSAGENS de `[de, ate[`. Todas as rotinas da lista aparecem (com
 * zero, se não passaram — também isso se quer ver); uma que a lista não
 * conhece aparece se passou.
 */
export function somarPassagens(passagens: PassagemCrua[], de: Date, ate: Date): SomaDoPeriodo {
  const porRotina = new Map<string, SomaDaRotina>();
  for (const nome of [...ROTINAS_DA_VITORIA, ...ROTINAS.map((r) => r.nome)]) {
    if (!porRotina.has(nome)) porRotina.set(nome, somaVazia(nome));
  }
  const t0 = de.getTime();
  const t1 = ate.getTime();
  for (const p of passagens) {
    const t = p.comecouEm.getTime();
    if (!(t >= t0 && t < t1)) continue;
    const s = porRotina.get(p.rotina) ?? somaVazia(p.rotina);
    porRotina.set(p.rotina, s);
    s.passagens++;
    if (!p.ok) s.vermelhas++;
    somarDetalhe(s, p.detalhe);
  }
  const rotinas = [...porRotina.values()].sort((a, b) => ordem(a.rotina) - ordem(b.rotina) || a.rotina.localeCompare(b.rotina));
  return { de: de.toISOString(), ate: ate.toISOString(), rotinas };
}

/** Os últimos `dias` dias de Lisboa, de hoje para trás (hoje vai até agora). */
export function diasDeLisboa(agora: Date, dias: number): Array<{ dia: string; de: Date; ate: Date }> {
  const hoje = diaEmLisboa(agora);
  const fora: Array<{ dia: string; de: Date; ate: Date }> = [];
  for (let i = 0; i < dias; i++) {
    const dia = somarDiasAoDia(hoje, -i);
    const de = inicioDoDiaEmLisboa(dia);
    const ate = i === 0 ? new Date(agora.getTime() + 1) : inicioDoDiaEmLisboa(somarDiasAoDia(dia, 1));
    fora.push({ dia, de, ate });
  }
  return fora;
}

/** Quantos dias se pedem: 1 a 7; o resto é 1. */
export function diasPedidos(cru: string | null | undefined): number {
  const n = Number(cru);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : 1;
}

/** Desde quando se lê da base: o começo do período mais antigo (as 24 h ou o 1.º dos dias). */
export function lerDesde(agora: Date, dias: number): Date {
  const h24 = new Date(agora.getTime() - 24 * 3600 * 1000);
  if (dias <= 1) return h24;
  const lista = diasDeLisboa(agora, dias);
  const primeiro = lista[lista.length - 1].de;
  return primeiro < h24 ? primeiro : h24;
}

/** A resposta da rota: as 24 h e, com `dias` > 1, dia a dia. */
export function oQueAVitoriaFez(
  passagens: PassagemCrua[],
  agora: Date,
  dias: number,
): { ultimas24h: SomaDoPeriodo; porDia: SomaDoDia[] | null } {
  const fim = new Date(agora.getTime() + 1);
  const ultimas24h = somarPassagens(passagens, new Date(agora.getTime() - 24 * 3600 * 1000), fim);
  const porDia =
    dias > 1 ? diasDeLisboa(agora, dias).map((d) => ({ dia: d.dia, ...somarPassagens(passagens, d.de, d.ate) })) : null;
  return { ultimas24h, porDia };
}

/** «enviadosDosNovos» → «enviados dos novos»; «porEmail.enviados» → «por email · enviados». */
export function nomeDoCampo(chave: string): string {
  return chave
    .split(".")
    .map((p) => p.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase())
    .join(" · ");
}
