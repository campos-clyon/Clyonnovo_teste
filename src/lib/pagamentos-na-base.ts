import { getPool, toMySQLDateTime } from "./db";
import type { Ambiente, MetodoDePagamento } from "./eupago";
import type { AvisoDoEupago, EstadoDoAviso } from "./webhook-do-eupago";

/**
 * OS PAGAMENTOS DOS CLIENTES, NA BASE.
 *
 * Fase 2 do `docs/plano-pagamentos-eupago.md`. As regras de dinheiro estão em
 * `eupago.ts` e `webhook-do-eupago.ts`, que são puros e testados sem base
 * nenhuma. Aqui está o que fala com o MySQL — e três garantias que só a base
 * pode dar, porque um `if` em TypeScript não as dá:
 *
 *   1. UM PAGAMENTO PAGO POR NEGOCIAÇÃO. A coluna `negociacaoPaga` leva o id
 *      da negociação quando — e só quando — o pagamento fica pago, e tem um
 *      índice único. Dois avisos do euPago a chegar ao mesmo tempo não podem
 *      dar o mesmo trabalho por pago duas vezes: o segundo bate no índice.
 *
 *   2. UM AVISO SÓ CONTA UMA VEZ. `avisosDoEupago` tem índice único em
 *      (trid, estado) e escreve-se com `INSERT IGNORE`. O euPago repete cada
 *      aviso de 2 em 2 minutos e depois de hora a hora durante 24 horas até
 *      lhe responderem 200 — a repetição não é um azar, é o desenho deles.
 *
 *   3. NADA ANDA PARA TRÁS. As transições são `UPDATE … WHERE estado = ?`, e
 *      é o `affectedRows` que diz se pegou. Um aviso de «expirado» que chegue
 *      DEPOIS do «pago» — e chegam fora de ordem — não desfaz o pagamento,
 *      porque já não encontra a linha no estado que esperava.
 *
 * Nenhuma destas três sobrevive a ser escrita como uma leitura seguida de uma
 * escrita: entre as duas cabe outro pedido.
 */

/** Onde um pagamento pode estar. */
export type EstadoDoPagamento =
  /** Pedido ao euPago, à espera que o cliente pague. */
  | "pendente"
  | "pago"
  /** O euPago recusou, ou a criação falhou. */
  | "falhado"
  /** Passou o prazo da referência, ou os cinco minutos do MB WAY. */
  | "expirado"
  | "cancelado"
  | "reembolsado"
  /** O cliente pediu outro meio de pagamento para o mesmo trabalho. */
  | "substituido";

/**
 * ⚠️ OS ESTADOS EM QUE UM PAGAMENTO AINDA PODE SER PAGO — e não é só «pendente».
 *
 * Esta lista nasceu de um erro meu, e é o género de erro que só se vê a
 * desenhar a corrida no papel:
 *
 *   o cliente pede MB WAY, paga, e o aviso vem a caminho;
 *   impaciente, carrega em «pedir outra vez»;
 *   nós fechamos o primeiro como `cancelado`;
 *   o aviso chega — e já não encontra a linha pendente.
 *
 * O cliente ficava sem os 105 € e sem trabalho nenhum registado.
 *
 * O que manda é uma pergunta só: **isto foi fechado por NÓS ou por ELES?**
 *
 *   · `cancelado` fomos nós que desistimos de esperar. O banco dele não sabe
 *     disso, e o dinheiro pode ter saído na mesma;
 *   · `substituido` idem — e pior: uma referência Multibanco substituída
 *     CONTINUA VÁLIDA no homebanking dele. É por aqui que entra o pagamento em
 *     duplicado, e tem de entrar, para ser visto e devolvido;
 *   · `expirado` foi o euPago a dizê-lo, e uma referência expirada não se paga;
 *   · `falhado` nunca chegou a existir referência nenhuma;
 *   · `pago` já está, e é o índice único que impede o resto.
 */
export const AINDA_PODE_SER_PAGO: EstadoDoPagamento[] = [
  "pendente",
  "cancelado",
  "substituido",
];

export type Pagamento = {
  id: number;
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  metodo: MetodoDePagamento;
  estado: EstadoDoPagamento;
  ambiente: Ambiente;
  /** O que pedimos ao cliente. */
  valor: number;
  /**
   * O cliente pediu factura, e por isso o valor leva o IVA da taxa.
   *
   * Fica gravado porque decide o documento que se emite a seguir — e porque,
   * sem isto, um pagamento de 105,00 € e outro de 106,15 € do mesmo trabalho
   * eram indistinguíveis daqui a seis meses.
   */
  comFactura: boolean;
  /**
   * Um pagamento a sério, feito para PROVAR a integração antes de a cobrança
   * abrir a toda a gente. Ver `podeCobrar` em `eupago.ts`.
   *
   * Fica marcado porque o dinheiro é real e entra na conta como qualquer
   * outro. Sem esta coluna, daqui a três meses ninguém distingue os euros de
   * teste dos euros de clientes — e quem tentar conciliar não percebe de onde
   * vieram. NÃO se esconde dos totais: o dinheiro está lá, e uma conciliação
   * que não bate com o extracto do euPago não serve para nada.
   */
  deTeste: boolean;
  /** O que o euPago confirmou ter recebido. */
  valorPago: number | null;
  /** O que o euPago cobrou pela operação. Sai da parte da CLYON. */
  comissaoEupago: number | null;
  referencia: string | null;
  entidade: string | null;
  /** O que a criação devolveu. NÃO é o `trid` — ver a nota em `marcarPedido`. */
  transacaoId: string | null;
  /** O id da transacção do lado deles, que só o webhook traz. */
  trid: string | null;
  telemovel: string | null;
  expiraEm: Date | null;
  pagoEm: Date | null;
  erro: string | null;
  criadoEm: Date;
  actualizadoEm: Date;
};

let prontas = false;
async function garantirTabelas() {
  if (prontas) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      negociacaoId   INT UNSIGNED NOT NULL,
      pedidoId       INT NOT NULL,
      providerId     INT UNSIGNED NOT NULL,
      metodo         VARCHAR(20) NOT NULL,
      estado         VARCHAR(20) NOT NULL DEFAULT 'pendente',
      ambiente       VARCHAR(10) NOT NULL,
      valor          DECIMAL(10,2) NOT NULL,
      comFactura     TINYINT(1) NOT NULL DEFAULT 0,
      deTeste        TINYINT(1) NOT NULL DEFAULT 0,
      valorPago      DECIMAL(10,2) NULL DEFAULT NULL,
      comissaoEupago DECIMAL(10,2) NULL DEFAULT NULL,
      referencia     VARCHAR(40) NULL DEFAULT NULL,
      entidade       VARCHAR(20) NULL DEFAULT NULL,
      transacaoId    VARCHAR(80) NULL DEFAULT NULL,
      trid           VARCHAR(60) NULL DEFAULT NULL,
      telemovel      VARCHAR(20) NULL DEFAULT NULL,
      expiraEm       DATETIME NULL DEFAULT NULL,
      pagoEm         DATETIME NULL DEFAULT NULL,
      erro           VARCHAR(255) NULL DEFAULT NULL,
      negociacaoPaga INT UNSIGNED NULL DEFAULT NULL,
      criadoEm       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizadoEm  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_uma_paga (negociacaoPaga),
      UNIQUE KEY uq_trid (trid),
      KEY idx_negociacao (negociacaoId, estado),
      KEY idx_pendentes (estado, criadoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  /*
   * TUDO O QUE O euPAGO NOS DISSE FICA GUARDADO, inclusive o que não soubemos
   * aplicar — e sobretudo esse.
   *
   * O contrato obriga a comunicar-lhes qualquer operação não autorizada em
   * DOIS DIAS ÚTEIS, passados os quais eles não respondem por ela. Isso faz da
   * conciliação uma obrigação contratual, e não se concilia contra um saldo
   * calculado: concilia-se contra o que eles disseram, por ordem de chegada.
   */
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS avisosDoEupago (
      id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      trid          VARCHAR(60) NOT NULL,
      estado        VARCHAR(20) NOT NULL,
      pagamentoId   INT UNSIGNED NULL DEFAULT NULL,
      identificador VARCHAR(120) NULL DEFAULT NULL,
      metodo        VARCHAR(30) NULL DEFAULT NULL,
      valor         DECIMAL(10,2) NULL DEFAULT NULL,
      comissao      DECIMAL(10,2) NULL DEFAULT NULL,
      aplicado      TINYINT(1) NOT NULL DEFAULT 0,
      nota          VARCHAR(255) NULL DEFAULT NULL,
      corpo         TEXT NULL,
      recebidoEm    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_aviso (trid, estado),
      KEY idx_por_aplicar (aplicado, recebidoEm),
      KEY idx_pagamento (pagamentoId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  /*
   * As colunas que nasceram depois da tabela.
   *
   * `CREATE TABLE IF NOT EXISTS` não acrescenta nada a uma tabela que já
   * existe — e esta já existe em produção desde a primeira vez que alguém
   * abriu o painel. Uma tentativa falhada por «coluna duplicada» é uma ida ao
   * MySQL por arranque a frio, e só por arranque a frio: `prontas` guarda o
   * resto.
   */
  for (const sql of [
    "ALTER TABLE pagamentos ADD COLUMN deTeste TINYINT(1) NOT NULL DEFAULT 0",
  ]) {
    try {
      await pool.execute(sql);
    } catch {
      // Já lá estava. É o caso normal a partir da segunda vez.
    }
  }

  prontas = true;
}

/**
 * ⚠️ UM INTEIRO PARA IR DENTRO DO SQL — porque `LIMIT ?` NÃO FUNCIONA.
 *
 * O `pool.execute` do mysql2 usa instruções preparadas, e o MySQL não aceita
 * marcadores em `LIMIT` nem em `INTERVAL ? MINUTE`. Não falha a compilar nem
 * avisa: rebenta em produção com «Incorrect arguments to mysqld_stmt_execute»,
 * e o ecrã diz só «Não foi possível ler os pagamentos».
 *
 * Foi exactamente o que aconteceu a 17-09-2026 — e o resto de `db.ts` já fazia
 * isto assim há meses. Escrevi as consultas novas sem olhar para o lado.
 *
 * Interpolar é seguro AQUI e só aqui: o valor passa por `Math.floor` e por um
 * tecto, e o que sai desta função é sempre um número. Nunca se faça isto com
 * nada que venha de fora.
 */
function inteiro(v: number, minimo: number, maximo: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return minimo;
  return Math.max(minimo, Math.min(maximo, n));
}

/** O MySQL devolve DECIMAL como texto. Um `Number` esquecido soma «10»+«5»=«105». */
function numero(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function comoPagamento(l: Record<string, unknown>): Pagamento {
  return {
    id: Number(l.id),
    negociacaoId: Number(l.negociacaoId),
    pedidoId: Number(l.pedidoId),
    providerId: Number(l.providerId),
    metodo: String(l.metodo) as MetodoDePagamento,
    estado: String(l.estado) as EstadoDoPagamento,
    ambiente: String(l.ambiente) as Ambiente,
    valor: numero(l.valor) ?? 0,
    comFactura: Number(l.comFactura) === 1,
    deTeste: Number(l.deTeste) === 1,
    valorPago: numero(l.valorPago),
    comissaoEupago: numero(l.comissaoEupago),
    referencia: (l.referencia as string) ?? null,
    entidade: (l.entidade as string) ?? null,
    transacaoId: (l.transacaoId as string) ?? null,
    trid: (l.trid as string) ?? null,
    telemovel: (l.telemovel as string) ?? null,
    expiraEm: (l.expiraEm as Date) ?? null,
    pagoEm: (l.pagoEm as Date) ?? null,
    erro: (l.erro as string) ?? null,
    criadoEm: l.criadoEm as Date,
    actualizadoEm: l.actualizadoEm as Date,
  };
}

/**
 * Abre a linha ANTES de falar com o euPago.
 *
 * A ordem não é arbitrária: o `identifier` que vai no pedido é feito a partir
 * deste id, e é por ele que o webhook volta a encontrar o pagamento. Pedir
 * primeiro e gravar depois deixava uma janela em que o euPago já tinha cobrado
 * e nós ainda não sabíamos a quem — e é uma janela em que o webhook chega,
 * porque o MB WAY é instantâneo.
 */
export async function abrirPagamento(d: {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  metodo: MetodoDePagamento;
  ambiente: Ambiente;
  valor: number;
  comFactura: boolean;
  /** Dinheiro a sério, mas para provar a integração. Ver `podeCobrar`. */
  deTeste?: boolean;
  telemovel?: string | null;
  expiraEm?: Date | null;
}): Promise<number> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const [r] = (await pool.execute(
    `INSERT INTO pagamentos
       (negociacaoId, pedidoId, providerId, metodo, ambiente, valor, comFactura,
        deTeste, telemovel, expiraEm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.negociacaoId,
      d.pedidoId,
      d.providerId,
      d.metodo,
      d.ambiente,
      d.valor,
      d.comFactura ? 1 : 0,
      d.deTeste ? 1 : 0,
      d.telemovel ?? null,
      d.expiraEm ? toMySQLDateTime(d.expiraEm) : null,
    ],
  )) as any[];
  return Number((r as { insertId?: number })?.insertId ?? 0);
}

/**
 * O euPago aceitou: guarda a referência que o cliente vai usar.
 *
 * ⚠️ `transacaoId` NÃO VAI PARA A COLUNA `trid`, e a distinção custou uma
 * leitura atenta da documentação: a criação do MB WAY devolve `transactionID`
 * e o webhook traz `trid`, e a documentação nunca diz que são o mesmo — um é
 * texto, o outro é inteiro. Escrevê-los na mesma coluna arriscava disparar o
 * índice único de `trid` com um valor que não é um `trid`, e um pagamento
 * legítimo passava a não poder ser dado por pago.
 */
export async function marcarPedido(
  id: number,
  d: { referencia: string; entidade: string | null; transacaoId: string | null; expiraEm?: Date | null },
): Promise<void> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `UPDATE pagamentos
        SET referencia = ?, entidade = ?, transacaoId = ?,
            expiraEm = COALESCE(?, expiraEm)
      WHERE id = ? AND estado = 'pendente'`,
    [
      d.referencia.slice(0, 40),
      d.entidade?.slice(0, 20) ?? null,
      d.transacaoId?.slice(0, 80) ?? null,
      d.expiraEm ? toMySQLDateTime(d.expiraEm) : null,
      id,
    ],
  );
}

/** O euPago recusou, ou a rede caiu. A linha fica, com o motivo. */
export async function marcarFalhado(id: number, erro: string): Promise<void> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `UPDATE pagamentos SET estado = 'falhado', erro = ? WHERE id = ? AND estado = 'pendente'`,
    [erro.slice(0, 255), id],
  );
}

export async function pagamentoPorId(id: number): Promise<Pagamento | null> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute("SELECT * FROM pagamentos WHERE id = ? LIMIT 1", [
    id,
  ])) as any[];
  const l = (linhas as Record<string, unknown>[])[0];
  return l ? comoPagamento(l) : null;
}

export async function pagamentosDaNegociacao(negociacaoId: number): Promise<Pagamento[]> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute(
    "SELECT * FROM pagamentos WHERE negociacaoId = ? ORDER BY id DESC",
    [negociacaoId],
  )) as any[];
  return (linhas as Record<string, unknown>[]).map(comoPagamento);
}

/**
 * Guarda o aviso, e diz se é a primeira vez que o vemos.
 *
 * `INSERT IGNORE` sobre o índice único (trid, estado): se voltar `false`, este
 * aviso EXACTO já foi tratado e não há nada a fazer senão responder 200 para o
 * euPago parar de insistir. Não é um `if` a verificar antes — é o índice a
 * recusar, e por isso não há janela entre a verificação e a escrita.
 *
 * O mesmo `trid` chega várias vezes com estados DIFERENTES ao longo da vida da
 * transacção (pago, e mais tarde reembolsado), e por isso o índice é sobre os
 * dois e não só sobre o `trid`.
 */
export async function guardarAviso(
  aviso: AvisoDoEupago,
  corpoCru: string,
): Promise<{ novo: boolean; avisoId: number }> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const [r] = (await pool.execute(
    `INSERT IGNORE INTO avisosDoEupago
       (trid, estado, pagamentoId, identificador, metodo, valor, comissao, corpo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      aviso.trid.slice(0, 60),
      aviso.estado,
      aviso.pagamentoId,
      aviso.identificador?.slice(0, 120) ?? null,
      aviso.metodo?.slice(0, 30) ?? null,
      aviso.valor,
      aviso.comissao,
      // O corpo cru fica inteiro. É a única prova do que eles disseram, e é
      // o que se põe ao lado do extracto quando um número não bate certo.
      corpoCru.slice(0, 60_000),
    ],
  )) as any[];

  const linha = r as { affectedRows?: number; insertId?: number };
  return { novo: Number(linha?.affectedRows ?? 0) > 0, avisoId: Number(linha?.insertId ?? 0) };
}

/** O que se escreveu no aviso depois de se tentar aplicá-lo. */
export async function anotarAviso(
  trid: string,
  estado: EstadoDoAviso,
  d: { aplicado: boolean; nota?: string | null },
): Promise<void> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `UPDATE avisosDoEupago SET aplicado = ?, nota = ? WHERE trid = ? AND estado = ?`,
    [d.aplicado ? 1 : 0, d.nota?.slice(0, 255) ?? null, trid.slice(0, 60), estado],
  );
}

/** O código de erro do MySQL para uma chave única violada. */
const CHAVE_REPETIDA = "ER_DUP_ENTRY";

export type ResultadoDeAplicar =
  | { feito: true }
  /** Não pegou: a linha já não estava no estado que este aviso esperava. */
  | { feito: false; porque: string; duplicado?: boolean };

/**
 * DÁ O PAGAMENTO POR PAGO — e é a escrita mais importante de todo o produto.
 *
 * Três coisas acontecem numa só instrução, e é de propósito:
 *
 *   · `WHERE estado = 'pendente'` — um aviso que chegue fora de ordem não
 *     encontra a linha e não faz nada. Sem isto, um «expirado» atrasado
 *     desfazia um pagamento já feito;
 *   · `negociacaoPaga = ?` com índice único — se OUTRO pagamento da mesma
 *     negociação já estiver pago, isto rebenta em vez de dar o mesmo trabalho
 *     por pago duas vezes. Acontece a sério: o cliente paga o MB WAY e depois
 *     paga também a referência Multibanco que tinha ficado aberta;
 *   · o `trid`, que tem o seu próprio índice único.
 *
 * O duplicado NÃO é um erro a esconder. É dinheiro a mais na nossa conta que é
 * do cliente, e tem de aparecer a alguém para ser devolvido — é por isso que
 * sai identificado em vez de ser engolido num `catch`.
 */
export async function darPorPago(
  pagamentoId: number,
  negociacaoId: number,
  d: { trid: string; valorPago: number | null; comissao: number | null; quando: Date | null },
): Promise<ResultadoDeAplicar> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const podeAinda = AINDA_PODE_SER_PAGO.map(() => "?").join(", ");
  try {
    const [r] = (await pool.execute(
      `UPDATE pagamentos
          SET estado = 'pago', negociacaoPaga = ?, trid = ?,
              valorPago = ?, comissaoEupago = ?, pagoEm = ?, erro = NULL
        WHERE id = ? AND estado IN (${podeAinda})`,
      [
        negociacaoId,
        d.trid.slice(0, 60),
        d.valorPago,
        d.comissao,
        toMySQLDateTime(d.quando ?? new Date()),
        pagamentoId,
        ...AINDA_PODE_SER_PAGO,
      ],
    )) as any[];

    if (Number((r as { affectedRows?: number })?.affectedRows ?? 0) > 0) {
      // As outras hipóteses de pagamento deste trabalho deixam de fazer
      // sentido: o ecrã do cliente tem de parar de as oferecer.
      await pool.execute(
        `UPDATE pagamentos SET estado = 'substituido'
          WHERE negociacaoId = ? AND id <> ? AND estado = 'pendente'`,
        [negociacaoId, pagamentoId],
      );
      return { feito: true };
    }
    return {
      feito: false,
      porque: "O pagamento já estava fechado de uma forma que não admite pagamento.",
    };
  } catch (e) {
    const codigo = (e as { code?: string })?.code;
    if (codigo === CHAVE_REPETIDA) {
      return {
        feito: false,
        duplicado: true,
        porque:
          "Este trabalho já tinha um pagamento pago. O cliente pagou duas vezes — " +
          "há um valor a devolver.",
      };
    }
    throw e;
  }
}

/**
 * Fecha um pagamento que não vai acontecer.
 *
 * Só sai de `pendente`: um «expirado» que chegue depois do «pago» não pode
 * desfazer nada. É a mesma defesa de `darPorPago`, do outro lado.
 */
export async function fecharSemPagar(
  pagamentoId: number,
  estado: Extract<EstadoDoPagamento, "expirado" | "cancelado" | "falhado">,
  d: { trid?: string | null; motivo?: string | null } = {},
): Promise<ResultadoDeAplicar> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    `UPDATE pagamentos
        SET estado = ?, trid = COALESCE(trid, ?), erro = ?
      WHERE id = ? AND estado = 'pendente'`,
    [estado, d.trid?.slice(0, 60) ?? null, d.motivo?.slice(0, 255) ?? null, pagamentoId],
  )) as any[];
  return Number((r as { affectedRows?: number })?.affectedRows ?? 0) > 0
    ? { feito: true }
    : { feito: false, porque: "O pagamento já não estava pendente." };
}

/**
 * O euPago devolveu o dinheiro ao cliente.
 *
 * ⚠️ `negociacaoPaga` VOLTA A NULO, e isso é o oposto de um detalhe: sem isso,
 * um trabalho reembolsado ficava para sempre a ocupar o índice único e o
 * cliente nunca mais o podia pagar. Um reembolso desfaz o pagamento; tem de
 * desfazer também a marca que diz que ele existiu.
 *
 * A linha não é apagada nem reescrita no valor: fica `reembolsado`, com o
 * `pagoEm` intacto. Houve um pagamento, e houve uma devolução — são dois
 * factos, e o livro guarda os dois.
 */
export async function darPorReembolsado(
  pagamentoId: number,
  d: { trid: string; valor: number | null },
): Promise<ResultadoDeAplicar> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    `UPDATE pagamentos
        SET estado = 'reembolsado', negociacaoPaga = NULL,
            erro = ?
      WHERE id = ? AND estado = 'pago'`,
    [
      d.valor != null ? `Reembolsado ${d.valor.toFixed(2)} € (trid ${d.trid}).` : null,
      pagamentoId,
    ],
  )) as any[];
  return Number((r as { affectedRows?: number })?.affectedRows ?? 0) > 0
    ? { feito: true }
    : { feito: false, porque: "O pagamento não estava pago." };
}

/**
 * Os pendentes com idade — a matéria-prima da sondagem de recurso.
 *
 * O webhook é a fonte da verdade e não é de confiar: se o nosso servidor
 * estiver em baixo mais de 24 horas, o euPago desiste, e fica um cliente que
 * pagou com um ecrã a dizer que não pagou. Não há aviso nenhum a avisar que um
 * aviso não chegou — por isso a pergunta tem de partir de cá.
 *
 * ⚠️ SÓ MULTIBANCO, e é uma limitação e não uma escolha: o `multibanco/info`
 * pergunta POR REFERÊNCIA, e uma operação MB WAY não tem referência que se
 * consulte por aí. A consulta equivalente para MB WAY (`TRID Information`) usa
 * OAuth, que é outro mecanismo e fica para quando fizer falta. Na prática dói
 * pouco: o MB WAY resolve-se em cinco minutos ou não se resolve.
 *
 * E NÃO SE FECHA NADA POR IDADE. Um MB WAY antigo fica `pendente` para sempre
 * de propósito: se o marcássemos expirado e o aviso de pagamento chegasse
 * atrasado, já não havia linha onde o aplicar. O ecrã do cliente mostra-o como
 * expirado pela data; a base guarda a porta aberta.
 */
export async function pendentesParaSondar(
  minutosMinimos: number,
  limite = 50,
): Promise<Pagamento[]> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute(
    `SELECT * FROM pagamentos
      WHERE estado = 'pendente'
        AND metodo = 'multibanco'
        AND referencia IS NOT NULL
        AND criadoEm <= DATE_SUB(NOW(), INTERVAL ${inteiro(minutosMinimos, 1, 10_080)} MINUTE)
      ORDER BY criadoEm ASC
      LIMIT ${inteiro(limite, 1, 200)}`,
  )) as any[];
  return (linhas as Record<string, unknown>[]).map(comoPagamento);
}

/**
 * QUAIS DESTES TRABALHOS É QUE O CLIENTE JÁ PAGOU — e quando.
 *
 * É a ponte entre a tabela dos pagamentos e a carteira do profissional, e é a
 * consulta que impede a CLYON de transferir dinheiro que nunca recebeu: sem
 * ela, um trabalho confirmado pelo cliente contava como «disponível» tivesse
 * ele pago ou não.
 *
 * Uma consulta para a lista toda, e não uma por negociação. A carteira de um
 * profissional com quarenta trabalhos fazia quarenta viagens ao MySQL — e a
 * carteira abre-se a cada visita ao painel.
 *
 * Lê a coluna `negociacaoPaga` e não `estado = 'pago'` de propósito: é a mesma
 * coluna do índice único, e por isso é impossível haver aqui duas linhas para o
 * mesmo trabalho. Um reembolso põe-na a nulo e o trabalho volta a contar como
 * por cobrar — que é o que ele passa a ser.
 */
export async function negociacoesPagas(
  negociacaoIds: number[],
): Promise<Map<number, Date>> {
  const ids = [...new Set(negociacaoIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return new Map();

  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const [linhas] = (await pool.execute(
    `SELECT negociacaoPaga AS negociacaoId, pagoEm
       FROM pagamentos
      WHERE negociacaoPaga IN (${ids.map(() => "?").join(", ")})`,
    ids,
  )) as any[];

  const mapa = new Map<number, Date>();
  for (const l of linhas as Array<{ negociacaoId: number; pagoEm: Date | null }>) {
    // `pagoEm` pode faltar numa linha antiga; a data exacta não muda nada aqui
    // — o que conta é que existe pagamento.
    mapa.set(Number(l.negociacaoId), l.pagoEm ?? new Date(0));
  }
  return mapa;
}

/** Os últimos, para o painel da CLYON. */
export async function ultimosPagamentos(limite = 25): Promise<Pagamento[]> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute(
    `SELECT * FROM pagamentos ORDER BY id DESC LIMIT ${inteiro(limite, 1, 200)}`,
  )) as any[];
  return (linhas as Record<string, unknown>[]).map(comoPagamento);
}

export type AvisoPorAplicar = {
  id: number;
  trid: string;
  estado: string;
  pagamentoId: number | null;
  valor: number | null;
  metodo: string | null;
  nota: string | null;
  recebidoEm: Date;
};

/**
 * ⚠️ O QUE O euPAGO NOS DISSE E NÓS NÃO APLICÁMOS — a lista que tem de estar
 * vazia.
 *
 * Cada linha aqui é dinheiro que se moveu do lado deles sem se mover do nosso:
 * um pagamento em duplicado por devolver, um valor que não bate certo, um
 * aviso de um pagamento que não existe. Nenhuma se resolve sozinha, e nenhuma
 * dá erro em lado nenhum — por isso tem de haver um sítio onde se vejam.
 *
 * É também o que o contrato do euPago obriga a vigiar: uma operação não
 * autorizada tem de lhes ser comunicada em DOIS DIAS ÚTEIS, passados os quais
 * eles não respondem por ela.
 */
export async function avisosPorAplicar(limite = 25): Promise<AvisoPorAplicar[]> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute(
    `SELECT id, trid, estado, pagamentoId, valor, metodo, nota, recebidoEm
       FROM avisosDoEupago
      WHERE aplicado = 0
      ORDER BY recebidoEm DESC
      LIMIT ${inteiro(limite, 1, 200)}`,
  )) as any[];
  return (linhas as Record<string, unknown>[]).map((l) => ({
    id: Number(l.id),
    trid: String(l.trid),
    estado: String(l.estado),
    pagamentoId: l.pagamentoId == null ? null : Number(l.pagamentoId),
    valor: numero(l.valor),
    metodo: (l.metodo as string) ?? null,
    nota: (l.nota as string) ?? null,
    recebidoEm: l.recebidoEm as Date,
  }));
}

export type ResumoDosPagamentos = {
  pendentes: number;
  pagos: number;
  falhados: number;
  avisosPorAplicar: number;
  totalPago: number;
  comissaoDoEupago: number;
};

/** O que o painel da CLYON mostra numa linha. */
export async function resumoDosPagamentos(): Promise<ResumoDosPagamentos> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const [[p], [a]] = (await Promise.all([
    pool.execute(
      `SELECT
         SUM(estado = 'pendente') AS pendentes,
         SUM(estado = 'pago')     AS pagos,
         SUM(estado = 'falhado')  AS falhados,
         SUM(CASE WHEN estado = 'pago' THEN valorPago ELSE 0 END)      AS totalPago,
         SUM(CASE WHEN estado = 'pago' THEN comissaoEupago ELSE 0 END) AS comissao
       FROM pagamentos`,
    ),
    pool.execute(`SELECT COUNT(*) AS n FROM avisosDoEupago WHERE aplicado = 0`),
  ])) as any[];

  const l = (p as Record<string, unknown>[])[0] ?? {};
  const av = (a as Record<string, unknown>[])[0] ?? {};
  return {
    pendentes: numero(l.pendentes) ?? 0,
    pagos: numero(l.pagos) ?? 0,
    falhados: numero(l.falhados) ?? 0,
    avisosPorAplicar: numero(av.n) ?? 0,
    totalPago: numero(l.totalPago) ?? 0,
    comissaoDoEupago: numero(l.comissao) ?? 0,
  };
}
