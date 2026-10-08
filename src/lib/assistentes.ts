import * as bcrypt from "bcryptjs";

import {
  ensureColaboradoresSchema,
  ensureNegociacoesTable,
  ensureSimulatorOrdersTable,
  registarSemFalhar,
  withConnection,
} from "@/lib/db";
import { diaEmLisboa, instanteDaBase, somarDiasAoDia } from "@/lib/hora-de-lisboa";
import {
  seccoesGuardadas,
  type PapelDoPainel,
  type SeccaoDoAssistente,
} from "@/lib/papel-do-painel";
import {
  INICIO_DAS_COMISSOES,
  estadoDoPeriodo,
  periodoDoDia,
  periodosAte,
  rotuloDoPeriodo,
  type EstadoDoPeriodo,
} from "@/lib/periodos-de-comissao";
import { comissaoDaClyon, quantoOProfissionalRecebe, taxasDaNegociacao } from "@/lib/taxas-plataforma";

/**
 * As contas de assistente, na tabela `colaboradores`.
 *
 * A tabela já tinha `funcao = 'assistente'` de uma vida anterior — assistentes
 * que aceitavam pedidos do simulador e viam só os seus. Essa vida acabou; a
 * coluna ficou. Reaproveita-se: um assistente é um colaborador com
 * `funcao = 'assistente'`, `isAdmin = 0` e `active = 1`. Desactivar é pôr
 * `active = 0` — não se apagam registos de pessoas que trabalharam connosco,
 * e um `active = 0` fecha a porta com a mesma eficácia.
 *
 * O login recusa quem não estiver activo, e o helper das rotas volta a
 * perguntar à base em cada chamada: um token de 8 horas não sobrevive a um
 * "desactivar" nem um minuto.
 *
 * O QUE CADA UM VÊ vive em `seccoesJson` — a lista das secções que o
 * administrador lhe deu. NULL queria dizer «todas» quando todas eram seis;
 * desde 03-10-2026 a lista que se pode dar é o menu inteiro menos
 * «Assistentes», e NULL continua a querer dizer AQUELAS SEIS e não as novas —
 * ver `seccoesGuardadas` e `SECCOES_DAS_CONTAS_ANTIGAS` em `papel-do-painel.ts`.
 * Uma lista vazia é uma conta sem secções.
 *
 * O QUE CADA UM GANHA: uma percentagem (40 % por omissão, na coluna
 * `commissionPercent`, que a tabela já tinha) do LUCRO da CLYON nos trabalhos
 * concluídos — o que a CLYON fica de cada um, sem IVA. Até 08-10-2026 era
 * sobre 11 % do valor; desde aí é sobre o lucro de cada trabalho
 * (`lucroDoTrabalho`): *«os 40 % da assistente passam a ser não dos 11 e sim
 * dos lucros totais do período»*.
 *
 * SOBRE QUE TRABALHOS, E QUANDO SE PAGA — 08-10-2026. *«Não apenas os que
 * estão ligados à Miriam e sim todos os trabalhos realizados a partir do dia
 * 23/09.»* Cada conta diz, em `comissaoSobre`, se ganha sobre TODOS os
 * trabalhos concluídos ou só sobre os de que foi responsável (NULL = os seus,
 * como sempre foi). E a conta faz-se por períodos — 23/09 a 15/10, depois
 * quinzenas (ver `periodos-de-comissao.ts`) —, cada um marcado como pago à
 * parte. Um período pago fica congelado em `comissoesPagas`: mudar uma
 * percentagem depois já não lhe mexe.
 */

export type EstatisticasDeTrabalho = {
  /** Trabalhos dela com estado `concluido` — de sempre, para se ver a carga. */
  concluidos: number;
  /** Tudo o que ainda mexe: pendente, atribuído, em análise, aprovado, confirmado… */
  emCurso: number;
  /** Cancelados pelo cliente ou rejeitados pela CLYON. */
  cancelados: number;
  /** Tirados da mesa sem conclusão. */
  arquivados: number;
};

/** «todos» — todos os trabalhos concluídos; «seus» — só aqueles de que foi responsável. */
export type ComissaoSobre = "todos" | "seus";

/** NULL, ou o que não se perceber, é «seus»: é como todas as contas sempre contaram. */
export function lerComissaoSobre(v: unknown): ComissaoSobre {
  return v === "todos" ? "todos" : "seus";
}

export type Assistente = {
  id: number;
  nome: string;
  activo: boolean;
  seccoes: SeccaoDoAssistente[];
  /** Percentagem da comissão da CLYON que lhe cabe (0–100). */
  comissaoPercent: number;
  comissaoSobre: ComissaoSobre;
  estatisticas: EstatisticasDeTrabalho;
  /** Os períodos, sem as linhas — essas vêm à parte, em `trabalhosDoAssistente`. */
  comissoes: {
    periodos: Array<Omit<PeriodoDaComissao, "detalhe">>;
    totais: TotaisDasComissoes;
  };
  createdAt: string | null;
  updatedAt: string | null;
};

/** 40 % da comissão, por decisão de 07-09-2026. Muda-se no painel. */
export const COMISSAO_ASSISTENTE_POR_OMISSAO = 40;

type LinhaDeAssistente = {
  id: number;
  nome: string;
  funcao: string;
  isAdmin: number;
  active: number | null;
  seccoesJson: string | null;
  commissionPercent: string | number | null;
  comissaoSobre: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

// ─── Esquema ─────────────────────────────────────────────────────────────────

let esquemaGarantido = false;

/**
 * A coluna das secções e a tabela de configuração do painel.
 *
 * `ADD COLUMN` dentro de try/catch, como o resto deste projecto faz: o MySQL
 * do Railway não tem `IF NOT EXISTS` para colunas em todas as versões, e
 * falhar porque a coluna já lá está não é falhar.
 */
export async function ensureAssistentesSchema(): Promise<void> {
  if (esquemaGarantido) return;
  await ensureColaboradoresSchema();
  await withConnection(async (conn) => {
    try {
      await conn.execute(`ALTER TABLE colaboradores ADD COLUMN seccoesJson TEXT NULL DEFAULT NULL`);
    } catch {
      /* já existe */
    }
    // «todos» ou «seus» (08-10-2026). NULL = «seus», o que as contas sempre foram.
    try {
      await conn.execute(`ALTER TABLE colaboradores ADD COLUMN comissaoSobre VARCHAR(10) NULL DEFAULT NULL`);
    } catch {
      /* já existe */
    }
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS painelConfig (
        chave     VARCHAR(80) NOT NULL PRIMARY KEY,
        valor     VARCHAR(255) NOT NULL,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    /*
     * OS PERÍODOS PAGOS — 08-10-2026. Uma linha por assistente e período, e o
     * índice único é o que impede pagar duas vezes o mesmo período (dois
     * cliques, dois separadores). As datas em texto `YYYY-MM-DD`, e não DATE:
     * são dias de Lisboa, e um DATE passava pelo fuso da ligação.
     *
     * `trabalhosJson` é a fotografia do que se pagou — pedido, valor, de onde
     * veio o valor, comissões — SEM o nome do cliente: os pedidos apagam-se
     * aos 60 dias, e esta tabela fica. O nome lê-se do pedido enquanto existir.
     */
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS comissoesPagas (
        id                   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        assistenteId         INT NOT NULL,
        periodoInicio        CHAR(10) NOT NULL,
        periodoFim           CHAR(10) NOT NULL,
        valorTrabalhos       DECIMAL(10,2) NOT NULL,
        comissaoClyonPercent DECIMAL(5,2) NOT NULL,
        comissaoPercent      DECIMAL(5,2) NOT NULL,
        valorPago            DECIMAL(10,2) NOT NULL,
        trabalhosJson        MEDIUMTEXT NOT NULL,
        pagoEm               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        pagoPor              VARCHAR(120) NULL,
        UNIQUE KEY uq_comissao_do_periodo (assistenteId, periodoInicio)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  });
  esquemaGarantido = true;
}

// ─── Validação ───────────────────────────────────────────────────────────────

/**
 * Nome de utilizador: maiúsculas, sem espaços, 3 a 40 caracteres.
 *
 * O login já normaliza para maiúsculas e a coluna é única — dois nomes que
 * diferem só na caixa seriam um só aos olhos da entrada. Sem espaços porque é
 * um nome que se dita ao telefone e se escreve num campo pequeno.
 */
export function normalizarNomeDeAssistente(bruto: unknown): string {
  return typeof bruto === "string" ? bruto.trim().toUpperCase() : "";
}

export function erroDoNomeDeAssistente(nome: string): string | null {
  if (!/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(nome)) {
    return "Nome: 3 a 40 caracteres, letras, números, ponto, hífen ou sublinhado, sem espaços.";
  }
  return null;
}

/** As mesmas regras da palavra-passe do administrador. */
export function erroDaPalavraPasseDeAssistente(senha: unknown): string | null {
  if (typeof senha !== "string" || senha.length < 8) {
    return "A palavra-passe deve ter pelo menos 8 caracteres.";
  }
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    return "A palavra-passe deve incluir pelo menos uma letra e um número.";
  }
  return null;
}

/** Uma percentagem entre 0 e 100, com duas casas; null se não for número. */
export function percentagemValida(bruto: unknown): number | null {
  const n =
    typeof bruto === "number"
      ? bruto
      : typeof bruto === "string"
        ? Number(bruto.trim().replace(",", "."))
        : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export async function hashDaPalavraPasseDeAssistente(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

function paraIso(v: Date | string | null): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

/*
 * NULL → as seis de sempre, e não o menu inteiro — 03-10-2026. A regra vive
 * em `seccoesGuardadas`, que é pura e tem testes; aqui só se chama.
 */
function seccoesDaLinha(json: string | null): SeccaoDoAssistente[] {
  return seccoesGuardadas(json);
}

function comissaoDaLinha(v: string | number | null): number {
  const n = Number(v);
  return Number.isFinite(n) && v !== null ? n : COMISSAO_ASSISTENTE_POR_OMISSAO;
}

const SELECT_ASSISTENTE = `SELECT id, nome, funcao, isAdmin, active, seccoesJson, commissionPercent, comissaoSobre,
                                  createdAt, updatedAt
                             FROM colaboradores`;

/**
 * Um assistente pela chave, com as secções e a comissão — para o helper das
 * rotas decidir. Devolve undefined para quem não for assistente.
 */
export async function assistentePorId(id: number): Promise<{
  id: number;
  nome: string;
  activo: boolean;
  seccoes: SeccaoDoAssistente[];
  comissaoPercent: number;
  comissaoSobre: ComissaoSobre;
} | undefined> {
  await ensureAssistentesSchema();
  return withConnection(async (conn) => {
    const [linhas] = (await conn.execute(
      `${SELECT_ASSISTENTE} WHERE id = ? AND funcao = 'assistente' AND isAdmin = 0 LIMIT 1`,
      [id],
    )) as [LinhaDeAssistente[], unknown];
    const l = linhas[0];
    if (!l) return undefined;
    return {
      id: l.id,
      nome: l.nome,
      activo: Number(l.active ?? 0) === 1,
      seccoes: seccoesDaLinha(l.seccoesJson),
      comissaoPercent: comissaoDaLinha(l.commissionPercent),
      comissaoSobre: lerComissaoSobre(l.comissaoSobre),
    };
  });
}


type LinhaDeContagem = {
  assignedToId: number;
  status: string | null;
  n: number | string;
};

/**
 * Os trabalhos de cada assistente, por estado — a carga dela, e não o dinheiro.
 *
 * ATRIBUIÇÃO: um trabalho é de quem está em `assignedToId` — quem o aceitou
 * ou quem foi o primeiro a agir nele. O dinheiro já não sai daqui: sai dos
 * períodos (`comissoesPorPeriodo`), que contam todos os trabalhos ou só os
 * dela, conforme a conta.
 */
export async function estatisticasDosAssistentes(
  ids: number[],
): Promise<Map<number, EstatisticasDeTrabalho>> {
  const vazio = (): EstatisticasDeTrabalho => ({
    concluidos: 0,
    emCurso: 0,
    cancelados: 0,
    arquivados: 0,
  });
  const resultado = new Map<number, EstatisticasDeTrabalho>(ids.map((id) => [id, vazio()]));
  if (ids.length === 0) return resultado;

  const marcadores = ids.map(() => "?").join(",");
  const linhas = await withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `SELECT o.assignedToId, o.status, COUNT(*) AS n
         FROM simulatorOrders o
        WHERE o.assignedToId IN (${marcadores})
        GROUP BY o.assignedToId, o.status`,
      ids,
    )) as [LinhaDeContagem[], unknown];
    return r;
  });

  for (const l of linhas) {
    const e = resultado.get(Number(l.assignedToId));
    if (!e) continue;
    const n = Number(l.n) || 0;
    const status = l.status ?? "";
    if (status === "concluido") {
      e.concluidos += n;
    } else if (status === "cancelado" || status === "rejeitado") {
      e.cancelados += n;
    } else if (status === "arquivado") {
      e.arquivados += n;
    } else {
      e.emCurso += n;
    }
  }
  return resultado;
}

/**
 * OS TRABALHOS POR TRÁS DO NÚMERO — um por linha.
 *
 * *«Quero mais detalhes dos trabalhos feitos para saber quais trabalhos o
 * assistente fez, para justificar os valores.»* — 29-09-2026.
 *
 * O LUCRO, E NÃO 11 % — 08-10-2026. *«Os 40 % da assistente passam a ser não
 * dos 11 e sim dos lucros totais do período.»* O lucro de cada trabalho é o
 * que a CLYON fica, sem IVA e sem descontar custos (decisão do dono):
 *
 *   · num pedido da plataforma, as taxas DESSA negociação sobre o acordado,
 *     mais o acréscimo do «pagar depois» — `comissaoDaClyon`;
 *   · num Trabalho CLYON, o preço ao cliente menos o que o profissional
 *     recebe — com a taxa de 10, 15 ou 20 % que se escolheu, ou, nos antigos,
 *     com o preço ao cliente escrito à parte;
 *   · num trabalho fechado à mão, sem negociação, o lucro que se escreveu.
 *
 * O que não se sabe não se inventa: um Trabalho CLYON sem preço ao cliente, ou
 * um trabalho à mão sem lucro escrito, conta zero, aparece a âmbar, e o
 * período não se paga enquanto houver algum (`pendentes`).
 *
 * ⚠️ TEM DE SOMAR EXACTAMENTE O MESMO QUE O CARTÃO. O cartão e o detalhe saem
 * da MESMA função (`comissoesPorPeriodo`, sobre a mesma leitura,
 * `trabalhosQueContam`). O total é a soma dos lucros, e a parte dela tira-se
 * do total — não é a soma das partes de cada linha arredondadas.
 */
export type FonteDoValor =
  /** Pedido da plataforma: as taxas da negociação. */
  | "acordado"
  /** Trabalho CLYON: o preço ao cliente menos o que o profissional recebe. */
  | "preco_ao_cliente"
  /** Trabalho CLYON antigo sem preço ao cliente: lucro por saber. */
  | "falta_preco_ao_cliente"
  /** Fechado à mão, sem negociação: o lucro escrito no backoffice. */
  | "lucro_manual"
  /** Fechado à mão, sem negociação, e ainda sem lucro escrito. */
  | "falta_lucro";

/** O que falta para um trabalho deixar de contar zero — e o período se poder pagar. */
export type Pendente = { pedidoId: number; falta: "preco_ao_cliente" | "lucro" };

export type TrabalhoDoAssistente = {
  pedidoId: number;
  estado: string;
  /** Se entra na comissão — só os concluídos entram. */
  conta: boolean;
  cliente: string | null;
  servico: string | null;
  cidade: string | null;
  profissional: string | null;
  /** Quando ficou dela — e quando o pedido mexeu pela última vez. */
  atribuidoEm: string | null;
  actualizadoEm: string | null;
  /** O instante que põe o trabalho num período. */
  concluidoEm: string | null;
  /** O valor do trabalho, sem IVA — para se ler; a conta é sobre o lucro. */
  valor: number;
  /** De onde veio o lucro: é a primeira pergunta de quem confere. */
  fonteDoValor: FonteDoValor;
  /** O que a CLYON ficou neste trabalho, sem IVA. */
  lucro: number;
  comissaoAssistente: number;
};

export type LinhaCruaDoTrabalho = {
  id: number;
  status: string | null;
  contactName?: string | null;
  serviceType?: string | null;
  city?: string | null;
  assignedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  concluidoEm?: Date | string | null;
  /** Da negociação confirmada — nula quando o trabalho não passou pela plataforma. */
  valorAcordado?: number | string | null;
  taxaCliente?: number | string | null;
  taxaProfissional?: number | string | null;
  acrescimoPagamento?: number | string | null;
  precoFinal?: number | string | null;
  estimateTotal?: number | string | null;
  /** Não nulo = Trabalho CLYON. */
  valorFixoClyon?: number | string | null;
  /** Taxa do Trabalho CLYON (0,10 / 0,15 / 0,20) — nula nos antigos. */
  taxaClyon?: number | string | null;
  /** O preço ao cliente de um Trabalho CLYON, sem IVA. */
  precoClienteClyon?: number | string | null;
  /** O lucro escrito à mão, num trabalho sem negociação. */
  lucroManual?: number | string | null;
  profissional?: string | null;
};

const centimos = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function numeroOuNulo(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * O lucro de UM trabalho, e de onde veio. Puro.
 *
 * Num Trabalho CLYON, quanto o profissional recebe sai das taxas da negociação
 * dele (`taxaProfissional` = a taxa escolhida); sem negociação confirmada, da
 * taxa gravada no pedido.
 */
export function lucroDoTrabalho(l: LinhaCruaDoTrabalho): {
  valor: number;
  lucro: number;
  fonte: FonteDoValor;
} {
  const acordado = numeroOuNulo(l.valorAcordado);
  const valorFixo = numeroOuNulo(l.valorFixoClyon);

  if (valorFixo != null) {
    const preco = numeroOuNulo(l.precoClienteClyon);
    const valorDoPro = acordado ?? valorFixo;
    const taxas =
      acordado != null
        ? taxasDaNegociacao(l)
        : { cliente: 0, profissional: numeroOuNulo(l.taxaClyon) ?? 0 };
    if (preco == null) return { valor: valorFixo, lucro: 0, fonte: "falta_preco_ao_cliente" };
    return {
      valor: preco,
      lucro: centimos(preco - quantoOProfissionalRecebe(valorDoPro, taxas)),
      fonte: "preco_ao_cliente",
    };
  }

  if (acordado != null) {
    const acrescimo = numeroOuNulo(l.acrescimoPagamento) ?? 0;
    return {
      valor: acordado,
      lucro: centimos(comissaoDaClyon(acordado, taxasDaNegociacao(l)) + acrescimo),
      fonte: "acordado",
    };
  }

  const valor = numeroOuNulo(l.precoFinal) ?? numeroOuNulo(l.estimateTotal) ?? 0;
  const manual = numeroOuNulo(l.lucroManual);
  return manual != null
    ? { valor, lucro: centimos(manual), fonte: "lucro_manual" }
    : { valor, lucro: 0, fonte: "falta_lucro" };
}

/** Puro: a mesma conta do cartão, linha a linha. Testado à parte. */
export function detalheDaComissao(
  linhas: LinhaCruaDoTrabalho[],
  minhaPercent: number,
): {
  trabalhos: TrabalhoDoAssistente[];
  totais: { valorTrabalhos: number; lucro: number; comissaoAssistente: number };
  pendentes: Pendente[];
} {
  let somaValor = 0;
  let somaLucro = 0;
  const pendentes: Pendente[] = [];
  const trabalhos = linhas.map((l) => {
    const conta = l.status === "concluido";
    const r = lucroDoTrabalho(l);
    const lucro = conta ? r.lucro : 0;
    if (conta) {
      somaValor += r.valor;
      somaLucro += lucro;
      if (r.fonte === "falta_preco_ao_cliente") pendentes.push({ pedidoId: Number(l.id), falta: "preco_ao_cliente" });
      if (r.fonte === "falta_lucro") pendentes.push({ pedidoId: Number(l.id), falta: "lucro" });
    }
    return {
      pedidoId: Number(l.id),
      estado: l.status ?? "",
      conta,
      cliente: (l.contactName ?? "").trim() || null,
      servico: l.serviceType ?? null,
      cidade: l.city ?? null,
      profissional: (l.profissional ?? "").trim() || null,
      atribuidoEm: l.assignedAt ? new Date(l.assignedAt).toISOString() : null,
      actualizadoEm: l.updatedAt ? new Date(l.updatedAt).toISOString() : null,
      concluidoEm: instanteDaBase(l.concluidoEm ?? null)?.toISOString() ?? null,
      valor: centimos(r.valor),
      fonteDoValor: r.fonte,
      lucro,
      comissaoAssistente: centimos((lucro * minhaPercent) / 100),
    };
  });

  const lucro = centimos(somaLucro);
  return {
    trabalhos,
    totais: {
      valorTrabalhos: centimos(somaValor),
      lucro,
      comissaoAssistente: centimos((lucro * minhaPercent) / 100),
    },
    pendentes,
  };
}

// ─── Os períodos ─────────────────────────────────────────────────────────────

/** Uma linha que pode contar: concluída, com o instante da conclusão e o responsável. */
export type LinhaQueConta = LinhaCruaDoTrabalho & { assignedToId?: number | string | null };

/** O que fica gravado de cada trabalho num período pago — sem o cliente. */
export type TrabalhoPago = {
  pedidoId: number;
  valor: number;
  fonteDoValor: FonteDoValor;
  lucro: number;
  comissaoAssistente: number;
  concluidoEm: string | null;
  servico: string | null;
};

export type PagamentoDeComissao = {
  periodoInicio: string;
  periodoFim: string;
  valorTrabalhos: number;
  comissaoPercent: number;
  valorPago: number;
  trabalhos: TrabalhoPago[];
  pagoEm: string | null;
  pagoPor: string | null;
};

export type PeriodoDaComissao = {
  inicio: string;
  fim: string;
  rotulo: string;
  estado: EstadoDoPeriodo;
  trabalhos: number;
  valorTrabalhos: number;
  /** O lucro total do período — o que a CLYON ficou, sem IVA. */
  lucro: number;
  comissaoAssistente: number;
  /** A percentagem dela: a do pagamento num período pago, a de hoje nos outros. */
  comissaoPercent: number;
  pago: { pagoEm: string | null; pagoPor: string | null } | null;
  /**
   * Num período pago: o que a conta dá HOJE, à percentagem do pagamento, menos
   * o que se pagou. Aparece quando um trabalho do período mudou de valor ou
   * entrou depois de pago — para se acertar à mão. Os pedidos que a purga já
   * apagou não contam para a diferença. `null` sem diferença.
   */
  diferenca: number | null;
  /**
   * O que falta escrever para os trabalhos deste período deixarem de contar
   * zero: o preço ao cliente de um Trabalho CLYON antigo, ou o lucro de um
   * trabalho fechado à mão. Enquanto houver, o período não se paga. Vazio num
   * período pago: esse está fotografado.
   */
  pendentes: Pendente[];
  detalhe: TrabalhoDoAssistente[];
};

export type TotaisDasComissoes = {
  /** O rótulo do período que contém hoje — `null` antes de 23/09/2026. */
  periodoActual: string | null;
  estePeriodo: number;
  porPagar: number;
  pago: number;
  /** Trabalhos que contam, somados os períodos todos. */
  trabalhos: number;
};

/** As linhas que contam para esta conta: todas, ou só aquelas de que foi responsável. */
export function noAlcanceDe<T extends LinhaQueConta>(
  linhas: T[],
  a: { id: number; comissaoSobre: ComissaoSobre },
): T[] {
  return a.comissaoSobre === "todos" ? linhas : linhas.filter((l) => Number(l.assignedToId) === a.id);
}

/** O dia de Lisboa em que o trabalho ficou concluído — ou `null`. */
function diaDaConclusao(l: { concluidoEm?: Date | string | null }): string | null {
  const d = instanteDaBase(l.concluidoEm ?? null);
  return d ? diaEmLisboa(d) : null;
}

const maisRecentePrimeiro = (a: TrabalhoDoAssistente, b: TrabalhoDoAssistente) =>
  (b.concluidoEm ?? "").localeCompare(a.concluidoEm ?? "") || b.pedidoId - a.pedidoId;

/**
 * A CONTA POR PERÍODOS — pura, e a única: o cartão, o detalhe, o assistente a
 * olhar para si próprio e o botão «Marcar como pago» saem todos daqui.
 *
 *   · Cada trabalho concluído cai no período do DIA DE LISBOA em que foi
 *     concluído; antes de 23/09/2026 não cai em nenhum.
 *   · A parte dela é a percentagem dela sobre o lucro total do período.
 *   · Um período pago mostra o que se pagou, tal e qual, e diz a diferença se
 *     a conta de hoje (à percentagem do pagamento) der outra coisa.
 *   · Um pedido que já foi pago fica no período em que foi pago — se a data
 *     de conclusão mudar (reaberto e fechado outra vez), não se paga duas
 *     vezes.
 */
export function comissoesPorPeriodo(args: {
  linhas: LinhaQueConta[];
  pagamentos: PagamentoDeComissao[];
  minhaPercent: number;
  hoje: string;
}): { periodos: PeriodoDaComissao[]; totais: TotaisDasComissoes } {
  const { linhas, pagamentos, minhaPercent, hoje } = args;
  const pagamentoDoPeriodo = new Map(pagamentos.map((p) => [p.periodoInicio, p]));

  const pagoNoPeriodo = new Map<number, string>();
  for (const p of pagamentos) {
    for (const t of p.trabalhos) pagoNoPeriodo.set(Number(t.pedidoId), p.periodoInicio);
  }

  /*
   * Um pedido já pago vive no período em que foi pago, mesmo que a data de
   * conclusão tenha mudado depois: assim não se paga duas vezes, e a
   * «diferença» do período pago só fala de valores que mudaram.
   */
  const linhasPorPeriodo = new Map<string, LinhaQueConta[]>();
  for (const l of linhas) {
    if (l.status !== "concluido") continue;
    const dia = diaDaConclusao(l);
    const inicio = pagoNoPeriodo.get(Number(l.id)) ?? (dia ? periodoDoDia(dia)?.inicio : undefined);
    if (!inicio) continue;
    const lista = linhasPorPeriodo.get(inicio) ?? [];
    lista.push(l);
    linhasPorPeriodo.set(inicio, lista);
  }

  const lista = periodosAte(hoje);
  for (const p of pagamentos) {
    if (!lista.some((x) => x.inicio === p.periodoInicio)) {
      lista.push({ inicio: p.periodoInicio, fim: p.periodoFim });
    }
  }
  lista.sort((a, b) => b.inicio.localeCompare(a.inicio));

  const periodos: PeriodoDaComissao[] = lista.map((p) => {
    const pagamento = pagamentoDoPeriodo.get(p.inicio) ?? null;
    const doPeriodo = linhasPorPeriodo.get(p.inicio) ?? [];
    const base = { inicio: p.inicio, fim: p.fim, rotulo: rotuloDoPeriodo(p) };

    if (pagamento) {
      const hojeDaria = detalheDaComissao(doPeriodo, pagamento.comissaoPercent);
      const vivos = new Map(hojeDaria.trabalhos.map((t) => [t.pedidoId, t]));
      const detalhe = pagamento.trabalhos.map((t): TrabalhoDoAssistente => {
        const v = vivos.get(Number(t.pedidoId));
        return {
          pedidoId: Number(t.pedidoId),
          estado: "concluido",
          conta: true,
          cliente: v?.cliente ?? null,
          servico: t.servico ?? v?.servico ?? null,
          cidade: v?.cidade ?? null,
          profissional: v?.profissional ?? null,
          atribuidoEm: v?.atribuidoEm ?? null,
          actualizadoEm: v?.actualizadoEm ?? null,
          concluidoEm: t.concluidoEm,
          valor: t.valor,
          fonteDoValor: t.fonteDoValor,
          lucro: t.lucro,
          comissaoAssistente: t.comissaoAssistente,
        };
      });
      /*
       * A DIFERENÇA SÓ FALA DO QUE AINDA EXISTE. A purga apaga os pedidos
       * fechados à mão ao fim de 60 dias, e um pedido apagado não «mudou de
       * valor»: compara-se a conta de hoje com a parte do pagamento cujos
       * pedidos ainda estão na base — com a mesma conta, soma primeiro.
       */
      const pagosQueExistem = pagamento.trabalhos.filter((t) => vivos.has(Number(t.pedidoId)));
      const pagoQueExiste =
        pagosQueExistem.length === pagamento.trabalhos.length
          ? pagamento.valorPago
          : detalheDaComissao(
              pagosQueExistem.map((t) => ({ id: t.pedidoId, status: "concluido", lucroManual: t.lucro })),
              pagamento.comissaoPercent,
            ).totais.comissaoAssistente;
      const diferenca = centimos(hojeDaria.totais.comissaoAssistente - pagoQueExiste);
      return {
        ...base,
        estado: estadoDoPeriodo(p, hoje, true),
        trabalhos: pagamento.trabalhos.length,
        valorTrabalhos: pagamento.valorTrabalhos,
        lucro: centimos(pagamento.trabalhos.reduce((s, t) => s + t.lucro, 0)),
        comissaoAssistente: pagamento.valorPago,
        comissaoPercent: pagamento.comissaoPercent,
        pago: { pagoEm: pagamento.pagoEm, pagoPor: pagamento.pagoPor },
        diferenca: Math.abs(diferenca) >= 0.01 ? diferenca : null,
        pendentes: [],
        detalhe: detalhe.sort(maisRecentePrimeiro),
      };
    }

    const r = detalheDaComissao(doPeriodo, minhaPercent);
    return {
      ...base,
      estado: estadoDoPeriodo(p, hoje, false),
      trabalhos: r.trabalhos.length,
      valorTrabalhos: r.totais.valorTrabalhos,
      lucro: r.totais.lucro,
      comissaoAssistente: r.totais.comissaoAssistente,
      comissaoPercent: minhaPercent,
      pago: null,
      diferenca: null,
      pendentes: r.pendentes,
      detalhe: r.trabalhos.sort(maisRecentePrimeiro),
    };
  });

  const actual = periodoDoDia(hoje);
  const somar = (estado: EstadoDoPeriodo) =>
    centimos(periodos.filter((p) => p.estado === estado).reduce((s, p) => s + p.comissaoAssistente, 0));
  return {
    periodos,
    totais: {
      periodoActual: actual ? rotuloDoPeriodo(actual) : null,
      estePeriodo: centimos(periodos.find((p) => p.inicio === actual?.inicio)?.comissaoAssistente ?? 0),
      porPagar: somar("por_pagar"),
      pago: somar("pago"),
      trabalhos: periodos.reduce((s, p) => s + p.trabalhos, 0),
    },
  };
}

/**
 * OS TRABALHOS QUE PODEM CONTAR — concluídos desde 23/09/2026, de toda a gente.
 *
 * Uma leitura só, para todas as contas: quem conta «todos» fica com a lista
 * inteira, quem conta «os seus» filtra pelo responsável (`noAlcanceDe`).
 *
 * A NEGOCIAÇÃO CONFIRMADA — a mais recente, se houver mais do que uma — dá o
 * valor acordado, as taxas dela e o acréscimo: é daí que sai o lucro de um
 * pedido da plataforma e o que o profissional recebeu num Trabalho CLYON.
 *
 * QUANDO FICOU CONCLUÍDO: `concluidoEm`, que existe desde 08-10-2026; nos
 * trabalhos de antes, a confirmação do cliente; e nos fechados à mão antes
 * disso, a última mexida no pedido, que é a melhor pista que há.
 *
 * FICAM DE FORA os trabalhos de contas de teste (`providers.contaDeTeste`):
 * não se paga comissão sobre um trabalho que não aconteceu.
 */
export async function trabalhosQueContam(): Promise<LinhaQueConta[]> {
  await ensureNegociacoesTable();
  // `concluidoEm`, `taxaClyon` e `lucroManual` são colunas novas (08-10-2026):
  // sem a migração, a consulta partia.
  await ensureSimulatorOrdersTable();
  return withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `SELECT o.id, o.status, o.contactName, o.serviceType, o.city, o.assignedToId,
              o.assignedAt, o.updatedAt, o.precoFinal, o.estimateTotal,
              o.valorFixoClyon, o.taxaClyon, o.precoClienteClyon, o.lucroManual,
              n.valorAcordado, n.taxaCliente, n.taxaProfissional, n.acrescimoPagamento,
              pn.name AS profissional,
              COALESCE(o.concluidoEm, c.confirmadoEm, o.updatedAt) AS concluidoEm
         FROM simulatorOrders o
         LEFT JOIN (
           SELECT x.pedidoId, MAX(x.id) AS negociacaoId, MAX(x.confirmadoEm) AS confirmadoEm,
                  MAX(COALESCE(p.contaDeTeste, 0)) AS deTeste
             FROM negociacoes x
             LEFT JOIN providers p ON p.id = x.providerId
            WHERE x.confirmadoEm IS NOT NULL
            GROUP BY x.pedidoId
         ) c ON c.pedidoId = o.id
         LEFT JOIN negociacoes n ON n.id = c.negociacaoId
         LEFT JOIN providers pn ON pn.id = n.providerId
        WHERE o.status = 'concluido'
          AND COALESCE(c.deTeste, 0) = 0
          AND COALESCE(o.concluidoEm, c.confirmadoEm, o.updatedAt) >= ?
        ORDER BY o.id DESC
        LIMIT 5000`,
      // Um dia de folga para o fuso: o corte certo faz-se em dias de Lisboa.
      [`${somarDiasAoDia(INICIO_DAS_COMISSOES, -1)} 00:00:00`],
    )) as [LinhaQueConta[], unknown];
    return r;
  });
}

type LinhaDePagamento = {
  assistenteId: number;
  periodoInicio: string;
  periodoFim: string;
  valorTrabalhos: string | number;
  comissaoPercent: string | number;
  valorPago: string | number;
  trabalhosJson: string | null;
  pagoEm: Date | string | null;
  pagoPor: string | null;
};

const FONTES: readonly FonteDoValor[] = [
  "acordado",
  "preco_ao_cliente",
  "falta_preco_ao_cliente",
  "lucro_manual",
  "falta_lucro",
];

/** A fotografia de um período pago, lida com desconfiança: o que não se perceber cai. */
export function trabalhosPagosDoJson(json: string | null): TrabalhoPago[] {
  if (!json) return [];
  try {
    const lista = JSON.parse(json);
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((t) => t && Number.isInteger(Number(t.pedidoId)) && Number(t.pedidoId) > 0)
      .map((t) => ({
        pedidoId: Number(t.pedidoId),
        valor: Number(t.valor) || 0,
        fonteDoValor: FONTES.includes(t.fonteDoValor) ? t.fonteDoValor : "lucro_manual",
        lucro: Number(t.lucro ?? t.comissaoClyon) || 0,
        comissaoAssistente: Number(t.comissaoAssistente) || 0,
        concluidoEm: typeof t.concluidoEm === "string" ? t.concluidoEm : null,
        servico: typeof t.servico === "string" ? t.servico : null,
      }));
  } catch {
    return [];
  }
}

/** Os períodos pagos de cada conta. */
export async function pagamentosDosAssistentes(
  ids: number[],
): Promise<Map<number, PagamentoDeComissao[]>> {
  const resultado = new Map<number, PagamentoDeComissao[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return resultado;
  await ensureAssistentesSchema();
  const linhas = await withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `SELECT assistenteId, periodoInicio, periodoFim, valorTrabalhos,
              comissaoPercent, valorPago, trabalhosJson, pagoEm, pagoPor
         FROM comissoesPagas
        WHERE assistenteId IN (${ids.map(() => "?").join(",")})`,
      ids,
    )) as [LinhaDePagamento[], unknown];
    return r;
  });
  for (const l of linhas) {
    resultado.get(Number(l.assistenteId))?.push({
      periodoInicio: String(l.periodoInicio),
      periodoFim: String(l.periodoFim),
      valorTrabalhos: Number(l.valorTrabalhos) || 0,
      comissaoPercent: Number(l.comissaoPercent) || 0,
      valorPago: Number(l.valorPago) || 0,
      trabalhos: trabalhosPagosDoJson(l.trabalhosJson),
      pagoEm: instanteDaBase(l.pagoEm)?.toISOString() ?? null,
      pagoPor: l.pagoPor ?? null,
    });
  }
  return resultado;
}

export type ComissoesDoAssistente = {
  nome: string;
  comissaoPercent: number;
  comissaoSobre: ComissaoSobre;
  periodos: PeriodoDaComissao[];
  totais: TotaisDasComissoes;
};

/** A conta por períodos de uma conta — uma leitura de cada coisa, em paralelo. */
async function comissoesDe(a: { id: number; comissaoPercent: number; comissaoSobre: ComissaoSobre }) {
  const [linhas, pagamentos] = await Promise.all([
    trabalhosQueContam(),
    pagamentosDosAssistentes([a.id]),
  ]);
  return comissoesPorPeriodo({
    linhas: noAlcanceDe(linhas, a),
    pagamentos: pagamentos.get(a.id) ?? [],
    minhaPercent: a.comissaoPercent,
    hoje: diaEmLisboa(new Date()),
  });
}

/** Os períodos de uma conta, com os trabalhos de cada um — o detalhe do painel. */
export async function trabalhosDoAssistente(id: number): Promise<ComissoesDoAssistente | undefined> {
  const a = await assistentePorId(id);
  if (!a) return undefined;
  const { periodos, totais } = await comissoesDe(a);
  return {
    nome: a.nome,
    comissaoPercent: a.comissaoPercent,
    comissaoSobre: a.comissaoSobre,
    periodos,
    totais,
  };
}

export async function listarAssistentes(): Promise<{ assistentes: Assistente[] }> {
  await ensureAssistentesSchema();
  const linhas = await withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `${SELECT_ASSISTENTE} WHERE funcao = 'assistente' AND isAdmin = 0 ORDER BY active DESC, nome ASC`,
    )) as [LinhaDeAssistente[], unknown];
    return r;
  });
  const ids = linhas.map((l) => l.id);
  const [trabalhos, pagamentos, stats] = await Promise.all([
    ids.length > 0 ? trabalhosQueContam() : Promise.resolve([] as LinhaQueConta[]),
    pagamentosDosAssistentes(ids),
    estatisticasDosAssistentes(ids),
  ]);
  const hoje = diaEmLisboa(new Date());

  return {
    assistentes: linhas.map((l) => {
      const comissaoSobre = lerComissaoSobre(l.comissaoSobre);
      const comissaoPercent = comissaoDaLinha(l.commissionPercent);
      const c = comissoesPorPeriodo({
        linhas: noAlcanceDe(trabalhos, { id: l.id, comissaoSobre }),
        pagamentos: pagamentos.get(l.id) ?? [],
        minhaPercent: comissaoPercent,
        hoje,
      });
      return {
        id: l.id,
        nome: l.nome,
        activo: Number(l.active ?? 0) === 1,
        seccoes: seccoesDaLinha(l.seccoesJson),
        comissaoPercent,
        comissaoSobre,
        estatisticas: stats.get(l.id)!,
        // Sem as linhas: o ecrã das contas recarrega-se de vinte em vinte segundos.
        comissoes: { periodos: c.periodos.map(({ detalhe: _linhas, ...resumo }) => resumo), totais: c.totais },
        createdAt: paraIso(l.createdAt),
        updatedAt: paraIso(l.updatedAt),
      };
    }),
  };
}

/** O que um assistente vê de si próprio: secções, a carga dela e o que tem a receber. */
export async function resumoDoAssistente(id: number): Promise<{
  seccoes: SeccaoDoAssistente[];
  comissaoPercent: number;
  estatisticas: EstatisticasDeTrabalho;
  comissoes: TotaisDasComissoes;
} | undefined> {
  const a = await assistentePorId(id);
  if (!a) return undefined;
  const [c, stats] = await Promise.all([comissoesDe(a), estatisticasDosAssistentes([id])]);
  return {
    seccoes: a.seccoes,
    comissaoPercent: a.comissaoPercent,
    estatisticas: stats.get(id)!,
    comissoes: c.totais,
  };
}

/**
 * O LUCRO ESCRITO À MÃO de um trabalho fechado sem negociação — 08-10-2026.
 *
 * *«Escrevo o lucro à mão.»* Só onde não há outra fonte: um pedido concluído
 * sem negociação confirmada, e que não é um Trabalho CLYON. Devolve o que lá
 * estava, para o histórico dizer de quanto para quanto — ou `undefined` se o
 * pedido não é desses.
 */
export async function definirLucroManual(
  pedidoId: number,
  lucro: number,
): Promise<{ antes: number | null } | undefined> {
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  return withConnection(async (conn) => {
    const [linhas] = (await conn.execute(
      `SELECT o.lucroManual FROM simulatorOrders o
        WHERE o.id = ? AND o.valorFixoClyon IS NULL
          AND NOT EXISTS (SELECT 1 FROM negociacoes x WHERE x.pedidoId = o.id AND x.confirmadoEm IS NOT NULL)
        LIMIT 1`,
      [pedidoId],
    )) as [Array<{ lucroManual: string | null }>, unknown];
    if (!linhas[0]) return undefined;
    await conn.execute("UPDATE simulatorOrders SET lucroManual = ? WHERE id = ?", [lucro.toFixed(2), pedidoId]);
    const antes = linhas[0].lucroManual;
    return { antes: antes == null ? null : Number(antes) };
  });
}

/** Existe já um colaborador com este nome — de QUALQUER função? */
export async function existeColaboradorComNome(nome: string): Promise<boolean> {
  return withConnection(async (conn) => {
    const [linhas] = (await conn.execute(
      "SELECT id FROM colaboradores WHERE nome = ? LIMIT 1",
      [nome],
    )) as [Array<{ id: number }>, unknown];
    return linhas.length > 0;
  });
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

export async function criarAssistente(dados: {
  nome: string;
  senhaHash: string;
  seccoes: SeccaoDoAssistente[];
  comissaoPercent: number;
}): Promise<number> {
  await ensureAssistentesSchema();
  return withConnection(async (conn) => {
    // valorHora e paymentModel: colunas herdadas da folha de pagamentos dos
    // motoristas. Um assistente é pago à comissão — e a comissão fica em
    // commissionPercent, sobre a parte da CLYON.
    const [r] = (await conn.execute(
      `INSERT INTO colaboradores
         (nome, senha, funcao, isAdmin, valorHora, paymentModel, commissionType, commissionPercent,
          seccoesJson, canReceiveSimulatorRequests, participatesInTimeTracking, active)
       VALUES (?, ?, 'assistente', 0, '0.00', 'commission', 'profit_percent', ?, ?, 0, 0, 1)`,
      [dados.nome, dados.senhaHash, dados.comissaoPercent.toFixed(2), JSON.stringify(dados.seccoes)],
    )) as [{ insertId?: number }, unknown];
    return Number(r.insertId ?? 0);
  });
}

async function actualizarAssistente(id: number, sql: string, params: Array<string | number>): Promise<boolean> {
  await ensureAssistentesSchema();
  return withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `UPDATE colaboradores SET ${sql}, updatedAt = NOW()
        WHERE id = ? AND funcao = 'assistente' AND isAdmin = 0`,
      [...params, id],
    )) as [{ affectedRows?: number }, unknown];
    return Number(r.affectedRows ?? 0) > 0;
  });
}

/** Só toca em assistentes: um id de administrador aqui não muda nada. */
export function definirEstadoDoAssistente(id: number, activo: boolean): Promise<boolean> {
  return actualizarAssistente(id, "active = ?", [activo ? 1 : 0]);
}

export function definirPalavraPasseDoAssistente(id: number, senhaHash: string): Promise<boolean> {
  return actualizarAssistente(id, "senha = ?", [senhaHash]);
}

export function definirSeccoesDoAssistente(id: number, seccoes: SeccaoDoAssistente[]): Promise<boolean> {
  return actualizarAssistente(id, "seccoesJson = ?", [JSON.stringify(seccoes)]);
}

export function definirComissaoDoAssistente(id: number, percent: number): Promise<boolean> {
  return actualizarAssistente(id, "commissionPercent = ?", [percent.toFixed(2)]);
}

export function definirComissaoSobre(id: number, sobre: ComissaoSobre): Promise<boolean> {
  return actualizarAssistente(id, "comissaoSobre = ?", [sobre]);
}

const eurosDoRegisto = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export type ResultadoDoPagamento =
  | { ok: true; rotulo: string; valorPago: number; trabalhos: number }
  | { ok: false; erro: string; estado: number };

/**
 * MARCAR UM PERÍODO COMO PAGO — fotografa-o.
 *
 * O valor NUNCA vem de quem carrega no botão: refaz-se aqui a conta, com a
 * mesma função que o ecrã usa, e é isso que se grava. Só um período já
 * fechado: pagar um que ainda está a decorrer deixava de fora o que entrasse
 * até ao fim dele.
 */
export async function marcarPeriodoComoPago(
  id: number,
  inicio: string,
  por: string | null,
): Promise<ResultadoDoPagamento> {
  const c = await trabalhosDoAssistente(id);
  if (!c) return { ok: false, erro: "Assistente não encontrado.", estado: 404 };
  const p = c.periodos.find((x) => x.inicio === inicio);
  if (!p) return { ok: false, erro: "Esse período não existe.", estado: 400 };
  if (p.estado === "pago") return { ok: false, erro: `O período ${p.rotulo} já está pago.`, estado: 409 };
  if (p.estado === "em_curso") {
    return {
      ok: false,
      erro: `O período ${p.rotulo} ainda está a decorrer — só se paga depois de ${p.fim.split("-").reverse().join("/")}.`,
      estado: 409,
    };
  }
  /*
   * O que ainda conta zero porque falta escrever — o preço ao cliente de um
   * Trabalho CLYON antigo, ou o lucro de um trabalho fechado à mão — ficava
   * pago por menos do que o combinado com a sócia. Paga-se depois.
   */
  if (p.pendentes.length > 0) {
    const lista = (falta: Pendente["falta"]) =>
      p.pendentes.filter((x) => x.falta === falta).map((x) => `#${x.pedidoId}`).join(", ");
    const partes = [
      lista("preco_ao_cliente") && `o preço ao cliente de ${lista("preco_ao_cliente")} (em «Trabalhos CLYON»)`,
      lista("lucro") && `o lucro de ${lista("lucro")} (aqui, na lista do período)`,
    ].filter(Boolean);
    return {
      ok: false,
      erro: `Falta escrever ${partes.join(" e ")} — depois volte a marcar.`,
      estado: 409,
    };
  }

  const trabalhos: TrabalhoPago[] = p.detalhe.map((t) => ({
    pedidoId: t.pedidoId,
    valor: t.valor,
    fonteDoValor: t.fonteDoValor,
    lucro: t.lucro,
    comissaoAssistente: t.comissaoAssistente,
    concluidoEm: t.concluidoEm,
    servico: t.servico,
  }));
  try {
    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO comissoesPagas
           (assistenteId, periodoInicio, periodoFim, valorTrabalhos, comissaoClyonPercent,
            comissaoPercent, valorPago, trabalhosJson, pagoPor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          p.inicio,
          p.fim,
          p.valorTrabalhos.toFixed(2),
          "0.00",
          p.comissaoPercent.toFixed(2),
          p.comissaoAssistente.toFixed(2),
          JSON.stringify(trabalhos),
          por,
        ],
      );
    });
  } catch (error) {
    // O índice único: dois cliques, ou dois separadores, ao mesmo tempo.
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
      return { ok: false, erro: `O período ${p.rotulo} já está pago.`, estado: 409 };
    }
    throw error;
  }

  await registarSemFalhar({
    acontecimento: "comissao_paga",
    autorTipo: "clyon",
    autorNome: por,
    resumo: `Comissão de ${c.nome}, ${p.rotulo}: ${eurosDoRegisto(p.comissaoAssistente)} — ${p.comissaoPercent} % de ${eurosDoRegisto(p.lucro)} de lucro (${p.trabalhos} trabalho${p.trabalhos === 1 ? "" : "s"}).`,
    valor: p.comissaoAssistente,
    detalhe: {
      assistenteId: id,
      periodoInicio: p.inicio,
      periodoFim: p.fim,
      valorTrabalhos: p.valorTrabalhos,
      lucro: p.lucro,
      comissaoPercent: p.comissaoPercent,
      pedidos: trabalhos.map((t) => t.pedidoId),
    },
  });
  return { ok: true, rotulo: p.rotulo, valorPago: p.comissaoAssistente, trabalhos: p.trabalhos };
}

/**
 * ANULAR o pagamento de um período — para um engano. Apaga a fotografia, e o
 * período volta a contar com os números e as percentagens de hoje. Fica no
 * registo permanente, que é onde nada se apaga.
 */
export async function anularPagamentoDoPeriodo(
  id: number,
  inicio: string,
  por: string | null,
): Promise<ResultadoDoPagamento> {
  const a = await assistentePorId(id);
  if (!a) return { ok: false, erro: "Assistente não encontrado.", estado: 404 };
  const pagamentos = await pagamentosDosAssistentes([id]);
  const pago = (pagamentos.get(id) ?? []).find((p) => p.periodoInicio === inicio);
  if (!pago) return { ok: false, erro: "Esse período não está pago.", estado: 404 };

  const apagou = await withConnection(async (conn) => {
    const [r] = (await conn.execute(
      "DELETE FROM comissoesPagas WHERE assistenteId = ? AND periodoInicio = ?",
      [id, inicio],
    )) as [{ affectedRows?: number }, unknown];
    return Number(r.affectedRows ?? 0) > 0;
  });
  if (!apagou) return { ok: false, erro: "Esse período não está pago.", estado: 404 };

  const rotulo = rotuloDoPeriodo({ inicio: pago.periodoInicio, fim: pago.periodoFim });
  await registarSemFalhar({
    acontecimento: "comissao_anulada",
    autorTipo: "clyon",
    autorNome: por,
    resumo: `Anulado o pagamento da comissão de ${a.nome}, ${rotulo} (${eurosDoRegisto(pago.valorPago)}, pago a ${pago.pagoEm?.slice(0, 10) ?? "?"} por ${pago.pagoPor ?? "?"}).`,
    valor: pago.valorPago,
    detalhe: { assistenteId: id, ...pago },
  });
  return { ok: true, rotulo, valorPago: pago.valorPago, trabalhos: pago.trabalhos.length };
}

// ─── Atribuição ──────────────────────────────────────────────────────────────

/**
 * O pedido passa a ser de quem agiu nele primeiro.
 *
 * Só para assistentes, e só se o pedido ainda não tiver responsável: a
 * comissão é por trabalho de que se foi responsável, e um trabalho sem
 * ninguém passa a ter alguém no momento em que alguém lhe mexe — aprova,
 * pede informação, agenda, promove à plataforma. O administrador não entra
 * nisto: o painel dele nunca atribuiu sozinho, e não é ele que ganha
 * comissão.
 *
 * Não mexe no estado. O botão "Aceitar pedido" continua a existir e faz mais
 * do que isto (passa a `atribuido`); isto é a rede por baixo, para quem age
 * sem carregar nele.
 */
export async function assumirPedidoSeLivre(
  pedidoId: number,
  colab: { id: number; nome: string; papel: PapelDoPainel } | null | undefined,
): Promise<void> {
  if (!colab || colab.papel !== "assistente") return;
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return;
  try {
    await withConnection(async (conn) => {
      await conn.execute(
        `UPDATE simulatorOrders
            SET assignedToId = ?, assignedToName = ?, assignedAt = NOW(), updatedAt = NOW()
          WHERE id = ? AND (assignedToId IS NULL OR assignedToId = 0)`,
        [colab.id, colab.nome, pedidoId],
      );
    });
  } catch (error) {
    // Uma atribuição falhada não pode travar a acção que a pessoa fez.
    console.error("[assistentes] assumirPedidoSeLivre", { pedidoId, colab: colab.id }, error);
  }
}
