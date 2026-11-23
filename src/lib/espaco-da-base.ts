/**
 * O ESPAÇO DA BASE NO RAILWAY — d1 (CEO e dono, 23-11-2026).
 *
 * O volume do MySQL é de 500 MB (plano Hobby; não há cópias agendadas). Se
 * encher, a base deixa de gravar pedidos, propostas e pagamentos. O alarme
 * acende no painel Rotinas (Configs) aos 85 %, e dá o selo vermelho das Configs.
 *
 * O que a base mede é o que as tabelas ocupam (dados, índices e espaço livre
 * dentro delas); o Railway mostra também o que o motor do MySQL guarda à parte
 * (registos internos, espaço temporário). `SOBRA_DO_MOTOR_MB` é essa diferença,
 * a calibrar com o número do Railway; sem ela, o alarme dispara tarde.
 *
 * PURO: a leitura está em `espaco-da-base-na-base.ts`.
 */

/** O volume do Railway, em MB (mysql-volume). */
export const VOLUME_DA_BASE_MB = 500;

/** O alarme acende a partir daqui (85 % do volume). */
export const ALARME_DO_ESPACO = 0.85;

/**
 * O que o motor do MySQL ocupa para lá das tabelas, em MB. Calibra-se
 * comparando o total das tabelas (esta medida) com o que o Railway mostra no
 * volume; começa a zero até haver as duas medidas lado a lado.
 */
export const SOBRA_DO_MOTOR_MB = 0;

export type TabelaMedida = { tabela: string; dadosMb: number; indicesMb: number; livreMb: number; linhas: number; totalMb: number };

export type EspacoDaBase = {
  /** O que as tabelas ocupam (dados + índices + espaço livre dentro delas), em MB. */
  tabelasMb: number;
  /** O que se conta contra o volume: as tabelas e a sobra do motor. */
  usadoMb: number;
  volumeMb: number;
  /** 0–100, uma casa decimal. */
  percentagem: number;
  alarme: boolean;
  /** As cinco maiores. */
  maiores: TabelaMedida[];
  frase: string;
};

const umaCasa = (n: number) => Math.round(n * 10) / 10;

export function estadoDoEspaco(
  tabelas: ReadonlyArray<Omit<TabelaMedida, "totalMb">>,
  opcoes: { volumeMb?: number; sobraMb?: number; limite?: number } = {},
): EspacoDaBase {
  const volumeMb = opcoes.volumeMb ?? VOLUME_DA_BASE_MB;
  const sobraMb = opcoes.sobraMb ?? SOBRA_DO_MOTOR_MB;
  const limite = opcoes.limite ?? ALARME_DO_ESPACO;
  const medidas: TabelaMedida[] = tabelas
    .map((t) => ({ ...t, totalMb: umaCasa(t.dadosMb + t.indicesMb + t.livreMb) }))
    .sort((a, b) => b.totalMb - a.totalMb);
  const tabelasMb = umaCasa(medidas.reduce((s, t) => s + t.totalMb, 0));
  const usadoMb = umaCasa(tabelasMb + sobraMb);
  const percentagem = umaCasa((usadoMb / volumeMb) * 100);
  const alarme = usadoMb >= volumeMb * limite;
  return {
    tabelasMb,
    usadoMb,
    volumeMb,
    percentagem,
    alarme,
    maiores: medidas.slice(0, 5),
    frase: alarme
      ? `A base ocupa ${percentagem} % do volume (${usadoMb} de ${volumeMb} MB). Se encher, deixa de gravar pedidos e pagamentos: fazer uma cópia e libertar espaço ou aumentar o volume.`
      : `A base ocupa ${percentagem} % do volume (${usadoMb} de ${volumeMb} MB).`,
  };
}
