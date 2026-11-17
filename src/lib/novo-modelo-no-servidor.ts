import { perfilDoProfissional } from "./db";
import { estadoDosDadosParaReceber } from "./dados-para-receber";
import { standByDoProfissional } from "./bloqueio-do-profissional";
import { eDoNovoModelo, novoModeloEmVigor } from "./novo-modelo";
import { regimeDaNegociacao, totaisDoNovoModelo, type TotaisDoNovoModelo } from "./total-ao-cliente";
import type { RegimeDoProfissional } from "./pagamento-directo";
import { agoraDoModelo } from "./relogio-do-modelo";
import { PAGAR_O_VALOR_EM_ATRASO } from "./valor-em-atraso";

/**
 * O QUE IMPEDE UM PARCEIRO DE ACEITAR OU ENVIAR PROPOSTA NO MODELO DE 15-11 —
 * d10. Uma pergunta só, para as duas portas (o painel e o link do email) e para
 * a app (que usa a do painel):
 *
 *   · faltam-lhe o IBAN, o titular, o MB WAY ou o regime de IVA, passado o aviso
 *     (`dados-para-receber.ts`) → 403 com `faltamDadosParaReceber`;
 *   · tem um valor em atraso há mais de 4 dias (`valor-em-atraso.ts`) → 403 com
 *     `standBy` e a acção «Pagar o valor em atraso».
 *
 * Antes de 15-11 devolve sempre `null`, sem ir à base.
 */
export type ImpedimentoDoNovoModelo = {
  status: 403;
  corpo: {
    error: string;
    faltamDadosParaReceber?: true;
    falta?: string[];
    standBy?: true;
    accao?: string;
    valorEmAtraso?: number;
    negociacoes?: number[];
  };
};

/**
 * ESTA NEGOCIAÇÃO SEGUE O MODELO DE 15-11? — para os textos de um trabalho (os
 * emails, a página do parceiro). A mesma pergunta de `acesso-ao-pagamento.ts`:
 * um pagamento à CLYON antes de 15-11, um trabalho que fechou antes, ou um
 * Trabalho CLYON ficam no antigo. Antes da data devolve `false` sem ir à base.
 */
export async function segueONovoModelo(
  n: {
    id: number | string;
    ofertaClyon?: unknown;
    estado?: unknown;
    execucaoEnviadaEm?: unknown;
    provaJson?: unknown;
    confirmadoEm?: unknown;
    pagoEm?: unknown;
    /** d33: a criação do pedido (Trabalho CLYON). Sem ela, lê-se da base (`trabalhosClyonDasNegociacoes`). */
    pedidoCriadoEm?: Date | string | null;
  },
  agora: Date = agoraDoModelo(),
): Promise<boolean> {
  if (!novoModeloEmVigor(agora)) return false;
  const { pagamentosDaNegociacao } = await import("./pagamentos-na-base");
  const { negociacaoNoNovoModelo } = await import("./taxa-a-passar-a-clyon");
  const { quandoLiberta } = await import("./trabalho");
  const { trabalhosClyonDasNegociacoes, comOTrabalhoClyonDaBase } = await import("./trabalho-clyon-na-base");
  // d58: a base sempre — é ela que diz se o cliente pagou o Trabalho CLYON à CLYON.
  const [pagamentos, clyon] = await Promise.all([
    pagamentosDaNegociacao(Number(n.id)),
    trabalhosClyonDasNegociacoes([n.id]),
  ]);
  const c = comOTrabalhoClyonDaBase(n, clyon.get(Number(n.id)));
  return negociacaoNoNovoModelo(
    {
      ofertaClyon: c.ofertaClyon,
      pedidoCriadoEm: c.pedidoCriadoEm ?? null,
      clientePagouAClyonEm: c.clientePagouAClyonEm ?? null,
      fechadoEm: quandoLiberta(n as Parameters<typeof quandoLiberta>[0]),
    },
    pagamentos,
    agora,
  );
}

/**
 * AS CONTRATADAS QUE SEGUEM O MODELO DE 15-11, NUMA LISTA — d31 (15-11-2026),
 * para os Pagamentos e as Carteiras do backoffice. A mesma regra de
 * `segueONovoModelo`, com os pagamentos de todas lidos numa consulta só
 * (`pagamentosDasNegociacoes`). Antes da data, nenhuma, sem ir à base. Se a
 * leitura falhar, lança: quem chama decide (uma lista de dinheiro não pode
 * adivinhar o modelo em silêncio).
 */
export async function contratadasNoNovoModelo(
  linhas: ReadonlyArray<{
    id: number;
    ofertaClyon?: unknown;
    estado?: unknown;
    execucaoEnviadaEm?: unknown;
    provaJson?: unknown;
    confirmadoEm?: unknown;
    pagoEm?: unknown;
    pedidoCriadoEm?: Date | string | null;
  }>,
  agora: Date = agoraDoModelo(),
): Promise<Set<number>> {
  const ids = new Set<number>();
  if (!novoModeloEmVigor(agora) || linhas.length === 0) return ids;
  const { pagamentosDasNegociacoes } = await import("./pagamentos-na-base");
  const { negociacaoNoNovoModelo } = await import("./taxa-a-passar-a-clyon");
  const { quandoLiberta } = await import("./trabalho");
  const { trabalhosClyonDasNegociacoes, comOTrabalhoClyonDaBase } = await import("./trabalho-clyon-na-base");
  const [pagamentos, clyon] = await Promise.all([
    pagamentosDasNegociacoes(linhas.map((l) => Number(l.id))),
    // d58: todas — a base diz se o cliente pagou o Trabalho CLYON à CLYON.
    trabalhosClyonDasNegociacoes(linhas.map((l) => l.id)),
  ]);
  for (const linha of linhas) {
    const n = comOTrabalhoClyonDaBase(linha, clyon.get(Number(linha.id)));
    const sim = negociacaoNoNovoModelo(
      {
        ofertaClyon: n.ofertaClyon,
        pedidoCriadoEm: n.pedidoCriadoEm ?? null,
        clientePagouAClyonEm: n.clientePagouAClyonEm ?? null,
        fechadoEm: quandoLiberta({ estado: "acordada", ...n } as unknown as Parameters<typeof quandoLiberta>[0]),
      },
      pagamentos.get(Number(n.id)) ?? [],
      agora,
    );
    if (sim) ids.add(Number(n.id));
  }
  return ids;
}

export async function impedimentoDoNovoModelo(
  providerId: number,
  agora: Date = agoraDoModelo(),
): Promise<ImpedimentoDoNovoModelo | null> {
  if (!novoModeloEmVigor(agora)) return null;

  const perfil = await perfilDoProfissional(providerId);
  if (perfil) {
    const dados = estadoDosDadosParaReceber(perfil, agora);
    if (dados.estado === "impede") {
      return { status: 403, corpo: { error: dados.frase, faltamDadosParaReceber: true, falta: dados.falta } };
    }
  }

  const s = await standByDoProfissional(providerId, agora);
  if (s.emStandBy) {
    return {
      status: 403,
      corpo: {
        error: s.explicacao,
        standBy: true,
        accao: PAGAR_O_VALOR_EM_ATRASO,
        valorEmAtraso: s.total,
        negociacoes: s.valores.map((v) => v.negociacaoId),
      },
    };
  }
  return null;
}

/**
 * AS NEGOCIAÇÕES QUE SEGUEM O MODELO DE 15-11 — d17 (13-11-2026). A regra da
 * Mesa, agora num sítio só para todas as listas: as contratadas perguntam ao
 * servidor (`segueONovoModelo`, os pagamentos lidos: um pagamento à CLYON antes
 * do corte deixa-as no antigo — `pagoAClyonAntesDoCorte`); as que ainda não
 * fecharam não têm nada pago e seguem o novo, menos os Trabalhos CLYON. Antes da
 * data, nenhuma, sem ir à base.
 */
export async function negociacoesNoNovoModelo(
  linhas: ReadonlyArray<{ id?: unknown; estado?: unknown; ofertaClyon?: unknown; pedidoCriadoEm?: Date | string | null }>,
  agora: Date = agoraDoModelo(),
): Promise<Set<number>> {
  const ids = new Set<number>();
  if (!novoModeloEmVigor(agora)) return ids;
  // d33: a criação do pedido de cada Trabalho CLYON, numa consulta (vazio com o interruptor ligado).
  const { trabalhosClyonDasNegociacoes, comOTrabalhoClyonDaBase } = await import("./trabalho-clyon-na-base");
  // d58: todas — a base diz também se o cliente pagou o Trabalho CLYON à CLYON.
  const clyon = await trabalhosClyonDasNegociacoes(
    linhas.map((l) => l.id as number | string | null | undefined),
  );
  await Promise.all(
    linhas.map(async (linha) => {
      const n = comOTrabalhoClyonDaBase(linha, clyon.get(Number(linha.id)));
      const pelaLinha = {
        ofertaClyon: n.ofertaClyon,
        pedidoCriadoEm: n.pedidoCriadoEm ?? null,
        clientePagouAClyonEm: n.clientePagouAClyonEm ?? null,
      };
      const sim =
        n.estado === "acordada"
          ? await segueONovoModelo(
              { ...(n as Parameters<typeof segueONovoModelo>[0]), pedidoCriadoEm: n.pedidoCriadoEm ?? null },
              agora,
            ).catch(() => eDoNovoModelo(pelaLinha, agora))
          : eDoNovoModelo(pelaLinha, agora);
      if (sim) ids.add(Number(n.id));
    }),
  );
  return ids;
}

/** O que o servidor diz de uma negociação, para a vista do cliente (`novoModeloNaVista`). */
export type NovoModeloDoServidor = {
  /** Segue o modelo novo, com os pagamentos lidos. */
  segue: boolean;
  /** O total ao cliente de cada valor dela (o acordado, as propostas, os ajustes). */
  totais: TotaisDoNovoModelo;
};

type LinhaDoCliente = {
  id?: unknown;
  estado?: unknown;
  ofertaClyon?: unknown;
  valorAcordado?: unknown;
  propostasJson?: unknown;
  ajustesJson?: unknown;
  taxaCliente?: unknown;
};

function valoresDaLinha(l: LinhaDoCliente): unknown[] {
  const valores: unknown[] = [l.valorAcordado];
  try {
    const p = typeof l.propostasJson === "string" ? JSON.parse(l.propostasJson) : l.propostasJson;
    if (Array.isArray(p)) for (const x of p) valores.push((x as { valor?: unknown })?.valor);
  } catch {
    // Propostas ilegíveis: fica o acordado.
  }
  try {
    const a = typeof l.ajustesJson === "string" ? JSON.parse(l.ajustesJson) : null;
    if (Array.isArray(a)) for (const x of a) valores.push(x?.valorNovo, x?.valorAntigo);
  } catch {
    // Sem ajustes legíveis.
  }
  return valores;
}

/**
 * O MODELO NOVO DAS NEGOCIAÇÕES QUE O CLIENTE VÊ — d17 (13-11-2026). Para a
 * página do pedido, a conta e a app (R5) mostrarem o mesmo total do bloco
 * «Pagar a …» (`/api/pagamentos/ao-parceiro`): as linhas que chegam aqui já
 * passaram por `negociacoesParaOCliente` (sem a taxa do parceiro), por isso a
 * taxa e o regime lêem-se outra vez da base, numa consulta só, e saem daqui só
 * como preços do cliente. Antes da data devolve um mapa vazio, sem ir à base.
 */
export async function novoModeloParaOCliente(
  linhas: ReadonlyArray<LinhaDoCliente>,
  agora: Date = agoraDoModelo(),
): Promise<Map<number, NovoModeloDoServidor>> {
  const mapa = new Map<number, NovoModeloDoServidor>();
  if (!novoModeloEmVigor(agora) || linhas.length === 0) return mapa;
  const ids = linhas.map((l) => Number(l.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return mapa;
  const [segue, daBase] = await Promise.all([
    negociacoesNoNovoModelo(linhas, agora),
    (async () => {
      const { getPool } = await import("./db");
      const pool = await getPool();
      if (!pool) return new Map<number, Record<string, unknown>>();
      const [rows] = (await pool.execute(
        `SELECT x.id, x.taxaCliente, x.taxaProfissional, x.regimeDoProfissional,
                p.regimeIva, p.regimeIvaConfirmadoEm
           FROM negociacoes x
           JOIN providers p ON p.id = x.providerId
          WHERE x.id IN (${ids.map(() => "?").join(",")})`,
        ids,
      )) as unknown as [Array<Record<string, unknown>>, unknown];
      return new Map((Array.isArray(rows) ? rows : []).map((r) => [Number(r.id), r] as const));
    })().catch((err) => {
      console.error("[novo-modelo-no-servidor] taxas do cliente:", err instanceof Error ? err.message : err);
      return new Map<number, Record<string, unknown>>();
    }),
  ]);
  // d39: a reserva do valor único entra no total do acordado (a fatura da CLYON), nunca nas propostas.
  const { reservasDe } = await import("./reserva-na-base");
  const reservas = await reservasDe(ids).catch(() => new Map<number, number>());
  for (const l of linhas) {
    const id = Number(l.id);
    const r = daBase.get(id);
    if (!r) continue;
    const daLinha = l as unknown as { estado?: unknown; valorAcordado?: unknown };
    const comReserva = { ...r, estado: daLinha.estado, valorAcordado: daLinha.valorAcordado, reservaCent: reservas.get(id) ?? null };
    mapa.set(id, { segue: segue.has(id), totais: totaisDoNovoModelo(comReserva, valoresDaLinha(l)) });
  }
  return mapa;
}

/**
 * O REGIME COM QUE SE FAZ O TOTAL DE CADA NEGOCIAÇÃO — d17 (13-11-2026), para a
 * mensagem do orçamento que a equipa copia na Mesa (`mensagemDasPropostas`)
 * dizer o número do cartão. O congelado ao contratar, ou o do perfil
 * (`regimeDaNegociacao`). Só para os ids dados (os do modelo novo); vazio sem
 * ids, e vazio se a leitura falhar (a mensagem fica com a conta de antes).
 */
export async function regimesDasNegociacoes(
  ids: ReadonlyArray<number>,
): Promise<Map<number, RegimeDoProfissional>> {
  const mapa = new Map<number, RegimeDoProfissional>();
  const validos = ids.filter((id) => Number.isInteger(id) && id > 0);
  if (validos.length === 0) return mapa;
  try {
    const { getPool } = await import("./db");
    const pool = await getPool();
    if (!pool) return mapa;
    const [rows] = (await pool.execute(
      `SELECT x.id, x.regimeDoProfissional, p.regimeIva, p.regimeIvaConfirmadoEm
         FROM negociacoes x
         JOIN providers p ON p.id = x.providerId
        WHERE x.id IN (${validos.map(() => "?").join(",")})`,
      validos,
    )) as unknown as [Array<Record<string, unknown>>, unknown];
    for (const r of Array.isArray(rows) ? rows : []) mapa.set(Number(r.id), regimeDaNegociacao(r));
  } catch (err) {
    console.error("[novo-modelo-no-servidor] regimes:", err instanceof Error ? err.message : err);
  }
  return mapa;
}
