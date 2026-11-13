import { perfilDoProfissional } from "./db";
import { estadoDosDadosParaReceber } from "./dados-para-receber";
import { standByDoProfissional } from "./bloqueio-do-profissional";
import { eDoNovoModelo, novoModeloEmVigor } from "./novo-modelo";
import { totaisDoNovoModelo, type TotaisDoNovoModelo } from "./total-ao-cliente";
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
  },
  agora: Date = agoraDoModelo(),
): Promise<boolean> {
  if (!novoModeloEmVigor(agora)) return false;
  const { pagamentosDaNegociacao } = await import("./pagamentos-na-base");
  const { negociacaoNoNovoModelo } = await import("./taxa-a-passar-a-clyon");
  const { quandoLiberta } = await import("./trabalho");
  const pagamentos = await pagamentosDaNegociacao(Number(n.id));
  return negociacaoNoNovoModelo(
    { ofertaClyon: n.ofertaClyon, fechadoEm: quandoLiberta(n as Parameters<typeof quandoLiberta>[0]) },
    pagamentos,
    agora,
  );
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
  linhas: ReadonlyArray<{ id?: unknown; estado?: unknown; ofertaClyon?: unknown }>,
  agora: Date = agoraDoModelo(),
): Promise<Set<number>> {
  const ids = new Set<number>();
  if (!novoModeloEmVigor(agora)) return ids;
  await Promise.all(
    linhas.map(async (n) => {
      const sim =
        n.estado === "acordada"
          ? await segueONovoModelo(n as Parameters<typeof segueONovoModelo>[0], agora).catch(() => true)
          : eDoNovoModelo({ ofertaClyon: n.ofertaClyon }, agora);
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
  for (const l of linhas) {
    const id = Number(l.id);
    const r = daBase.get(id);
    if (!r) continue;
    mapa.set(id, { segue: segue.has(id), totais: totaisDoNovoModelo(r, valoresDaLinha(l)) });
  }
  return mapa;
}
