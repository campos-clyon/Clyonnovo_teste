import { getPool } from "./db";
import {
  distanciaEmLinhaRecta,
  pontoValido,
  FACTOR_DE_ESTRADA,
  type Ponto,
} from "./distancia-entre-pontos";

/**
 * A distância a sério: o percurso de carro entre duas moradas.
 *
 * "Esses cálculos de km estão muito errados. Temos que usar valores reais e
 * calculados individualmente usando o endereço base do pro com o do pedido —
 * reais e verdadeiros."
 *
 * O QUE HAVIA
 *
 * Linha recta entre dois pontos, multiplicada por 1,3. É rápido, não custa
 * nada e não precisa de rede — e por isso serviu enquanto o número era só um
 * indício. Deixou de servir quando passou a decidir coisas: quem recebe o
 * pedido, quanto rende por quilómetro, se vale a pena atravessar o rio.
 *
 * O erro não é pequeno nem constante. De Amora a Setúbal são 22,8 km em linha
 * recta; o factor dá 29,6 e a estrada são 33,4 — 11% a menos. Mas onde há um
 * rio, uma serra ou uma ponte com portagem, o mesmo factor engana-se em 60% ou
 * mais: Almada e o Montijo são vizinhos em linha recta e meia hora de carro.
 *
 * O 1,3 continua aqui, mas onde deve estar: como RECURSO para quando a estrada
 * não pode ser consultada — e o resultado diz de si próprio que é uma
 * estimativa, em vez de se fazer passar por medida.
 *
 * PORQUE É QUE ISTO TEM MEMÓRIA
 *
 * Cada consulta é uma chamada paga ao Google. A distância entre a base de um
 * profissional e a morada de um pedido não muda — as duas pontas estão
 * paradas — por isso a segunda pergunta é sempre a mesma que a primeira.
 * Sem memória, abrir o painel dele seis vezes eram trinta e seis chamadas
 * para trinta e seis respostas iguais.
 */

export type DistanciaMedida = {
  km: number;
  /** Minutos de carro, quando a estrada foi consultada. */
  minutos: number | null;
  /**
   * De onde veio o número.
   *
   * `estrada` é o percurso real. `estimativa` é a linha recta com folga, e
   * quem a mostrar deve dizê-lo — um número inventado apresentado como medido
   * é pior do que não haver número.
   */
  origem: "estrada" | "estimativa";
};

/**
 * Quatro casas decimais: cerca de onze metros.
 *
 * A chave da memória tem de ser estável, e as coordenadas do Google variam no
 * último dígito entre consultas da mesma morada. Sem arredondar, a memória
 * nunca acertava e cada consulta era nova.
 *
 * Onze metros não mudam um percurso de trinta quilómetros.
 */
const arredondar = (n: number) => Math.round(n * 10_000) / 10_000;

const chave = (a: Ponto, b: Ponto) =>
  `${arredondar(a.lat)},${arredondar(a.lng)}|${arredondar(b.lat)},${arredondar(b.lng)}`;

/** O recurso de sempre, agora identificado como tal. */
export function estimativaEmLinhaRecta(origem: Ponto, destino: Ponto): DistanciaMedida {
  return {
    km: Math.round(distanciaEmLinhaRecta(origem, destino) * FACTOR_DE_ESTRADA * 10) / 10,
    minutos: null,
    origem: "estimativa",
  };
}

let tabelaPronta = false;

async function garantirTabela() {
  if (tabelaPronta) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS distanciasRodoviarias (
       chave VARCHAR(64) NOT NULL PRIMARY KEY,
       km DECIMAL(7,2) NOT NULL,
       minutos INT NULL,
       criadoEm TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  tabelaPronta = true;
}

async function daMemoria(k: string): Promise<DistanciaMedida | null> {
  try {
    await garantirTabela();
    const pool = await getPool();
    if (!pool) return null;
    const [linhas] = (await pool.execute(
      "SELECT km, minutos FROM distanciasRodoviarias WHERE chave = ? LIMIT 1",
      [k],
    )) as [Array<{ km: string; minutos: number | null }>, unknown];
    const l = linhas[0];
    if (!l) return null;
    return { km: Number(l.km), minutos: l.minutos ?? null, origem: "estrada" };
  } catch {
    return null;
  }
}

async function guardar(k: string, d: DistanciaMedida) {
  try {
    await garantirTabela();
    const pool = await getPool();
    if (!pool) return;
    await pool.execute(
      `INSERT INTO distanciasRodoviarias (chave, km, minutos) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE km = VALUES(km), minutos = VALUES(minutos)`,
      [k, d.km, d.minutos],
    );
  } catch {
    /* A memória é uma conveniência: falhar a gravá-la não pode partir nada. */
  }
}

/**
 * Pergunta a estrada ao Google. Devolve `null` quando não consegue — sem
 * chave, sem rede, sem rota entre os dois pontos.
 */
async function perguntarAEstrada(origem: Ponto, destino: Ponto): Promise<DistanciaMedida | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origem.lat, longitude: origem.lng } } },
        destination: { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } },
        travelMode: "DRIVE",
        /*
         * SEM TRÂNSITO, de propósito.
         *
         * `TRAFFIC_AWARE` daria um número diferente a cada hora, e isto é
         * guardado e reutilizado. Um profissional não pode ficar fora do raio
         * por ter havido fila na ponte às seis da tarde — a distância que
         * decide quem alcança o trabalho tem de ser a mesma de manhã e à noite.
         */
        routingPreference: "TRAFFIC_UNAWARE",
        languageCode: "pt-PT",
        regionCode: "PT",
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const dados = (await res.json()) as {
      routes?: Array<{ distanceMeters?: number; duration?: string }>;
    };
    const rota = dados.routes?.[0];
    if (!rota?.distanceMeters) return null;

    const segundos = Number(String(rota.duration ?? "").replace("s", ""));
    return {
      km: Math.round((rota.distanceMeters / 1000) * 10) / 10,
      minutos: Number.isFinite(segundos) && segundos > 0 ? Math.round(segundos / 60) : null,
      origem: "estrada",
    };
  } catch {
    return null;
  }
}

/**
 * A distância entre duas moradas, pela estrada — e pela linha recta quando a
 * estrada não puder ser consultada.
 *
 * Nunca atira. Um pedido não pode deixar de chegar aos profissionais porque o
 * Google não respondeu.
 */
export async function distanciaRodoviaria(
  origem: Ponto | null | undefined,
  destino: Ponto | null | undefined,
): Promise<DistanciaMedida | null> {
  if (!pontoValido(origem) || !pontoValido(destino)) return null;

  const k = chave(origem, destino);

  const lembrada = await daMemoria(k);
  if (lembrada) return lembrada;

  const medida = await perguntarAEstrada(origem, destino);
  if (medida) {
    await guardar(k, medida);
    return medida;
  }

  return estimativaEmLinhaRecta(origem, destino);
}

/**
 * Muitas de uma vez, sem repetir pares iguais.
 *
 * O painel do profissional mostra uma lista inteira: a base é sempre a mesma e
 * só o destino muda. Pedir uma a uma em série somava um segundo por trabalho.
 */
export async function distanciasRodoviarias(
  pares: Array<{ origem: Ponto | null | undefined; destino: Ponto | null | undefined }>,
): Promise<Array<DistanciaMedida | null>> {
  return Promise.all(pares.map((p) => distanciaRodoviaria(p.origem, p.destino)));
}
