import { normalizar } from "@/lib/ler-a-resposta";

/**
 * O DIA E A HORA, COMO AS PESSOAS OS ESCREVEM.
 *
 * "Sim, estou interessada, pode ser no próximo dia 16?" — uma cliente,
 * 14-09-2026. O assistente respondeu-lhe com o ponto de situação, e o dono
 * teve de escrever à mão: «Sim pode, qual horário deseja.»
 *
 * O leitor de datas aceitava uma forma só — `27/08 14:30` — e a mensagem de
 * fecho ENSINAVA essa forma, com exemplo e tudo. Quem escreve «dia 16» não
 * está a escrever mal: está a falar como se fala. Foi o leitor que ficou curto.
 *
 * O QUE FALTA É A HORA, E É ISSO QUE SE PERGUNTA. Um dia sem hora não marca
 * nada — mas também não se deita fora: reconhece-se, diz-se que se percebeu, e
 * pede-se só o que falta. Responder «se já tem data pensada» a quem acabou de
 * dar a data é a mesma surdez que este ficheiro existe para acabar.
 *
 * NA DÚVIDA NÃO SE LÊ NADA. Um número sozinho é uma contraproposta e tem de
 * continuar a sê-lo: «300» nunca pode virar o dia 300 nem as 3 horas. Por isso
 * a hora exige marca — «às», «h» ou «:» — e o dia exige contexto.
 */

const MESES: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

export type DataLida = {
  dia: number;
  /** Null quando ele disse só o dia — «dia 16». */
  mes: number | null;
  /** Null quando falta a hora, que é o caso que faz perguntar. */
  hora: number | null;
  minuto: number;
};

/** `16/10 09:00`, `16/10 9h`, `dia 16 às 10`, `16 de outubro às 10h30`, `dia 16`. */
const COM_BARRA_E_HORA =
  /^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.]\d{2,4})?\s+(?:as\s+)?(\d{1,2})[:h](\d{2})?h?$/;
const COM_BARRA_SO =
  /^(?:dia\s+)?(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.]\d{2,4})?$/;
const COM_MES_POR_EXTENSO =
  /^(?:dia\s+)?(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:as\s+)?(\d{1,2})(?:[:h](\d{2}))?h?)?$/;
/**
 * «dia 16 às 10», «16 às 10h30».
 *
 * O «dia» ou o «às» são obrigatórios — sem um deles, «16 10» seriam dois
 * números soltos, e dois números soltos não são uma data.
 */
const SO_O_DIA_COM_HORA = /^(?:dia\s+)?(\d{1,2})\s+as\s+(\d{1,2})(?:[:h](\d{2}))?h?$/;
const SO_O_DIA = /^dia\s+(\d{1,2})$/;

function valida(d: DataLida | null): DataLida | null {
  if (!d) return null;
  if (d.dia < 1 || d.dia > 31) return null;
  if (d.mes != null && (d.mes < 1 || d.mes > 12)) return null;
  if (d.hora != null && (d.hora < 0 || d.hora > 23)) return null;
  if (d.minuto < 0 || d.minuto > 59) return null;
  return d;
}

/**
 * O que se percebe do que ele escreveu — sem inventar o que falta.
 *
 * Devolve `null` quando não há data nenhuma, e devolve a data com `hora: null`
 * quando ele deu o dia e não a hora. Essa diferença é o produto todo: uma
 * manda marcar, a outra manda perguntar.
 */
export function lerAData(texto: string): DataLida | null {
  /*
   * A frase inteira, e não só uma mensagem que seja SÓ a data.
   *
   * «Sim, estou interessada, pode ser no próximo dia 16?» traz a aceitação e a
   * data na mesma linha, que é como as pessoas escrevem. Procura-se a data
   * dentro dela.
   */
  const t = normalizar(texto).replace(/\bàs\b/g, "as");
  const pedacos = [t, ...t.split(/\s*(?:,|\be\b)\s*/)];

  for (const p of pedacos) {
    const bruto = p.trim();
    if (!bruto) continue;

    const comHora = bruto.match(COM_BARRA_E_HORA);
    if (comHora) {
      return valida({
        dia: Number(comHora[1]),
        mes: Number(comHora[2]),
        hora: Number(comHora[3]),
        minuto: Number(comHora[4] ?? 0),
      });
    }

    const porExtenso = bruto.match(COM_MES_POR_EXTENSO);
    if (porExtenso && MESES[porExtenso[2]]) {
      return valida({
        dia: Number(porExtenso[1]),
        mes: MESES[porExtenso[2]],
        hora: porExtenso[3] != null ? Number(porExtenso[3]) : null,
        minuto: Number(porExtenso[4] ?? 0),
      });
    }

    const diaEHora = bruto.match(SO_O_DIA_COM_HORA);
    if (diaEHora) {
      return valida({
        dia: Number(diaEHora[1]),
        mes: null,
        hora: Number(diaEHora[2]),
        minuto: Number(diaEHora[3] ?? 0),
      });
    }

    const soBarra = bruto.match(COM_BARRA_SO);
    if (soBarra) {
      return valida({ dia: Number(soBarra[1]), mes: Number(soBarra[2]), hora: null, minuto: 0 });
    }

    const soDia = bruto.match(SO_O_DIA);
    if (soDia) {
      return valida({ dia: Number(soDia[1]), mes: null, hora: null, minuto: 0 });
    }
  }

  /*
   * E DENTRO DE UMA FRASE INTEIRA, o «dia N» pode vir no meio: «pode ser no
   * proximo dia 16». Só esta forma, e só com a palavra «dia» à frente — sem
   * ela, qualquer número numa frase virava uma data.
   */
  const noMeio = t.match(/\bdia\s+(\d{1,2})\b(?:\s+as\s+(\d{1,2})(?:[:h](\d{2}))?h?)?/);
  if (noMeio) {
    return valida({
      dia: Number(noMeio[1]),
      mes: null,
      hora: noMeio[2] != null ? Number(noMeio[2]) : null,
      minuto: Number(noMeio[3] ?? 0),
    });
  }

  return null;
}

/**
 * A data a sério, na próxima vez que ela acontecer.
 *
 * Sem mês, é o próximo dia com aquele número: quem diz «dia 16» a 14 de
 * Setembro está a falar de 16 de Setembro; quem o diz a 20 fala de Outubro.
 * Ninguém marca para trás.
 */
export function quandoSera(d: DataLida, agora: Date): Date | null {
  if (d.hora == null) return null;
  const ano = agora.getFullYear();
  const mes = d.mes ?? agora.getMonth() + 1;
  let quando = new Date(ano, mes - 1, d.dia, d.hora, d.minuto);
  if (Number.isNaN(quando.getTime())) return null;
  // Uma hora de folga: quem marca para "hoje às 9" às 9h05 não quer o ano que vem.
  const limite = agora.getTime() - 3600_000;
  if (quando.getTime() < limite) {
    quando =
      d.mes == null
        ? new Date(ano, mes, d.dia, d.hora, d.minuto)
        : new Date(ano + 1, mes - 1, d.dia, d.hora, d.minuto);
  }
  return Number.isNaN(quando.getTime()) || quando.getTime() < limite ? null : quando;
}

/** «dia 16» ou «16/10» — para lho repetir quando só falta a hora. */
export function diaPorPalavras(d: DataLida): string {
  return d.mes != null ? `dia ${d.dia}/${d.mes}` : `dia ${d.dia}`;
}
