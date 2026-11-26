import {
  aceitarPrecoClyon,
  appendOrderHistory,
  assistentePode,
  atribuirOfertaClyon,
  getPool,
  getSimulatorOrderById,
  marcarPropostaEnviada,
  registarSemFalhar,
} from "./db";
import {
  avisoDaReservaQueCaiu,
  HISTORICO,
  type PorqueCaiu,
  type ReservaDoValorFixo,
} from "./sim-do-cliente";

/**
 * O SIM DO CLIENTE NA BASE — d130 (26-11-2026). Ver `sim-do-cliente.ts`.
 *
 * Uma linha por pedido, numa tabela à parte (`reservasDoValorFixo`):
 *   · «reserva» — o parceiro (e a negociação, se ele aceitou a oferta) à
 *     espera do sim do cliente; ainda não tem o trabalho;
 *   · «falta_o_sim» — já atribuído, e a equipa pediu o sim ao cliente.
 * A linha sai quando o cliente responde, ou quando o pedido é cancelado. Sai
 * numa só escrita (DELETE … e as linhas apagadas): duas respostas ao mesmo
 * tempo não atribuem duas vezes.
 */

type Quem = { quem: string; por: { id: number; nome: string; role: string } | null; baseUrl: string };

let _tabelaPronta = false;
async function garantirATabela(): Promise<void> {
  if (_tabelaPronta) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS reservasDoValorFixo (
      pedidoId INT PRIMARY KEY,
      tipo VARCHAR(20) NOT NULL,
      providerId INT NULL,
      negociacaoId INT NULL,
      porId INT NULL,
      porNome VARCHAR(120) NULL,
      semGuiaConfirmado TINYINT(1) NOT NULL DEFAULT 0,
      criadaEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  _tabelaPronta = true;
}

type Linha = {
  pedidoId: number;
  tipo: string;
  providerId: number | null;
  negociacaoId: number | null;
  porNome: string | null;
  semGuiaConfirmado: number;
  criadaEm: Date | string | null;
  profissional?: string | null;
  telefone?: string | null;
};

function paraOCartao(l: Linha): ReservaDoValorFixo {
  const em = l.criadaEm == null ? null : new Date(l.criadaEm as string);
  return {
    tipo: l.tipo === "falta_o_sim" ? "falta_o_sim" : "reserva",
    providerId: l.providerId == null ? null : Number(l.providerId),
    negociacaoId: l.negociacaoId == null ? null : Number(l.negociacaoId),
    profissional: l.profissional ?? null,
    por: l.porNome ?? null,
    em: em && !Number.isNaN(em.getTime()) ? em.toISOString() : null,
  };
}

/** As reservas dos pedidos, para o cartão. Se a leitura falhar, nenhuma (o cartão sai como antes). */
export async function reservasDosPedidos(ids: number[]): Promise<Map<number, ReservaDoValorFixo>> {
  const m = new Map<number, ReservaDoValorFixo>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return m;
  try {
    await garantirATabela();
    const pool = await getPool();
    if (!pool) return m;
    const [linhas] = (await pool.execute(
      `SELECT r.*, p.name AS profissional FROM reservasDoValorFixo r
         LEFT JOIN providers p ON p.id = r.providerId
        WHERE r.pedidoId IN (${limpos.map(() => "?").join(",")})`,
      limpos,
    )) as [Linha[], unknown];
    for (const l of linhas) m.set(Number(l.pedidoId), paraOCartao(l));
  } catch (e) {
    console.error("[sim do cliente] as reservas não se leram:", e instanceof Error ? e.message : e);
  }
  return m;
}

export async function reservaDoPedido(pedidoId: number): Promise<ReservaDoValorFixo | null> {
  return (await reservasDosPedidos([pedidoId])).get(pedidoId) ?? null;
}

/** Grava (ou substitui) a linha do pedido. Devolve a que estava, se havia. */
export async function gravarReserva(a: {
  pedidoId: number;
  tipo: "reserva" | "falta_o_sim";
  providerId: number | null;
  negociacaoId?: number | null;
  por: { id: number; nome: string } | null;
  semGuiaConfirmado?: boolean;
}): Promise<ReservaDoValorFixo | null> {
  await garantirATabela();
  const antes = await reservaDoPedido(a.pedidoId);
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `REPLACE INTO reservasDoValorFixo (pedidoId, tipo, providerId, negociacaoId, porId, porNome, semGuiaConfirmado, criadaEm)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [a.pedidoId, a.tipo, a.providerId, a.negociacaoId ?? null, a.por?.id ?? null, a.por?.nome ?? null, a.semGuiaConfirmado ? 1 : 0],
  );
  return antes;
}

/**
 * Tira a linha do pedido (só do tipo dado, se o houver), numa só escrita.
 * Devolve-a se foi esta chamada que a tirou — e só essa segue com ela.
 */
async function tirarALinha(pedidoId: number, tipo?: "reserva" | "falta_o_sim"): Promise<Linha | null> {
  await garantirATabela();
  const pool = await getPool();
  if (!pool) return null;
  const [linhas] = (await pool.execute(
    `SELECT r.*, p.name AS profissional, p.phone AS telefone FROM reservasDoValorFixo r
       LEFT JOIN providers p ON p.id = r.providerId
      WHERE r.pedidoId = ? LIMIT 1`,
    [pedidoId],
  )) as [Linha[], unknown];
  const l = linhas[0];
  if (!l || (tipo && l.tipo !== tipo)) return null;
  const [r] = (await pool.execute("DELETE FROM reservasDoValorFixo WHERE pedidoId = ? AND tipo = ? AND providerId <=> ?", [
    pedidoId,
    l.tipo,
    l.providerId,
  ])) as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) === 1 ? l : null;
}

/** Tira a reserva sem avisar ninguém (foi substituída por uma atribuição já). */
export async function tirarReservaSemAvisar(pedidoId: number): Promise<ReservaDoValorFixo | null> {
  const l = await tirarALinha(pedidoId);
  return l ? paraOCartao(l) : null;
}

/**
 * «ATRIBUIR JÁ (O CLIENTE ACEITOU POR TELEFONE)» — regista o sim do cliente
 * com quem carregou. Sem proposta marcada como enviada, marca-a agora (o
 * cliente ouviu o valor ao telefone) e aceita essa versão.
 */
export async function registarOSimPorTelefone(pedidoId: number, q: Omit<Quem, "baseUrl">): Promise<boolean> {
  let p = (await getSimulatorOrderById(pedidoId)) as unknown as
    | (Record<string, unknown> & { propostaEnviadaEm?: Date | string | null; precoAceiteEm?: Date | string | null })
    | undefined;
  if (!p || p.valorFixoClyon == null) return false;
  if (p.precoAceiteEm) return true;
  if (!p.propostaEnviadaEm) {
    await marcarPropostaEnviada(pedidoId);
    p = (await getSimulatorOrderById(pedidoId)) as unknown as typeof p;
    if (!p?.propostaEnviadaEm) return false;
  }
  const versao = p.propostaEnviadaEm instanceof Date ? p.propostaEnviadaEm : new Date(String(p.propostaEnviadaEm));
  if (!(await aceitarPrecoClyon(pedidoId, versao))) return false;
  await appendOrderHistory(pedidoId, { type: "note", by: q.por, message: HISTORICO.simPorTelefone(q.quem) });
  return true;
}

/**
 * O CLIENTE DEU O SIM — chamado depois de cada «Aceito este preço» gravado
 * (a app, o «1» da Vitória, «O cliente aceitou (por telefone)»).
 *   · reservado: a atribuição faz-se agora, e o parceiro é avisado como hoje;
 *   · «falta o sim»: a marca sai, o trabalho segue como estava.
 * Nunca rebenta: o sim do cliente está gravado na mesma.
 */
export async function depoisDoSimDoCliente(
  pedidoId: number,
  q: Quem,
): Promise<{ atribuido: boolean; parceiro: string | null; frase: string | null }> {
  const nada = { atribuido: false, parceiro: null, frase: null };
  try {
    const l = await tirarALinha(pedidoId);
    if (!l) return nada;
    if (l.tipo === "falta_o_sim") {
      const frase = HISTORICO.simDepoisDeAtribuido(l.profissional ?? null);
      await appendOrderHistory(pedidoId, { type: "note", by: q.por, message: frase }).catch(() => {});
      return { atribuido: false, parceiro: l.profissional ?? null, frase };
    }
    if (l.providerId == null) return nada;

    // Escolhido entre quem aceitou a oferta: a escolha de sempre (a rota de escolher).
    if (l.negociacaoId != null) {
      const r = await atribuirOfertaClyon(Number(l.negociacaoId));
      if (r.ok) {
        const { avisarProfissionalEscolhido } = await import("./avisar-escolhido-da-oferta");
        const aviso = await avisarProfissionalEscolhido({
          negociacaoId: Number(l.negociacaoId),
          pedidoId: r.pedidoId,
          providerId: r.providerId,
          baseUrl: q.baseUrl,
        });
        const nome = aviso.profissional || l.profissional || `o parceiro #${r.providerId}`;
        const frase =
          `O cliente aceitou o valor: a reserva fez-se — ${nome} ficou com o trabalho (reservado por ${l.porNome ?? "a CLYON"})` +
          (r.encerradas > 0 ? `; ${r.encerradas} outro(s) que tinham aceitado ficaram de fora.` : ".");
        await appendOrderHistory(r.pedidoId, { type: "created", by: q.por, message: frase }).catch(() => {});
        const { avisarOClienteDoPedido } = await import("./avisos-ao-cliente");
        await avisarOClienteDoPedido(r.pedidoId, "escolhido", { nome: aviso.profissional || null, negociacaoId: Number(l.negociacaoId) }).catch(() => {});
        await registarSemFalhar({
          acontecimento: "negociacao_fechada",
          pedidoId: r.pedidoId,
          negociacaoId: Number(l.negociacaoId),
          providerId: r.providerId,
          providerNome: aviso.profissional || null,
          autorTipo: "clyon",
          autorNome: l.porNome ?? q.quem,
          valor: aviso.valorDoTrabalho ?? aviso.valor,
          valorProfissional: aviso.valor,
          resumo: frase,
          visivelProfissional: true,
        });
        return { atribuido: true, parceiro: aviso.profissional || l.profissional || null, frase };
      }
      // Já não está à espera (desistiu, ou outro ficou): tenta como atribuição directa, abaixo.
    }

    const { atribuirDirectamente } = await import("./atribuir-directamente");
    const r = await atribuirDirectamente({
      pedidoId,
      providerId: Number(l.providerId),
      quem: l.porNome ?? q.quem,
      por: q.por,
      baseUrl: q.baseUrl,
      // A guia viu-se ao reservar (e, sem ela, quem reservou disse que sim).
      semGuiaConfirmado: true,
    });
    if (!r.ok) {
      await appendOrderHistory(pedidoId, {
        type: "note",
        by: q.por,
        message: HISTORICO.reservaNaoCumprida(l.profissional ?? null, r.erro),
      }).catch(() => {});
      return { atribuido: false, parceiro: null, frase: null };
    }
    return { atribuido: true, parceiro: r.profissional, frase: `O cliente aceitou o valor: a reserva fez-se. ${r.feito}` };
  } catch (e) {
    console.error("[sim do cliente] depois do sim:", e instanceof Error ? e.message : e);
    return nada;
  }
}

/**
 * A RESERVA CAI — o cliente não aceitou, ou o pedido foi cancelado. O
 * parceiro reservado é avisado por WhatsApp (ainda não tinha o trabalho: só
 * a frase curta). Um «falta o sim» sai sem aviso — o cancelamento já avisa
 * quem tem o trabalho. Nunca rebenta.
 */
export async function largarAReserva(
  pedidoId: number,
  porque: PorqueCaiu,
  q: { quem: string | null; por: { id: number; nome: string; role: string } | null },
): Promise<{ caiu: boolean; avisado: boolean; frase: string | null }> {
  try {
    const l = await tirarALinha(pedidoId);
    if (!l || l.tipo !== "reserva") return { caiu: Boolean(l), avisado: false, frase: null };
    let avisado = false;
    try {
      const { enviarAvisoWhatsApp, telemovelParaWhatsApp } = await import("./whatsapp-cloud");
      const telefone = telemovelParaWhatsApp(l.telefone ?? null);
      if (telefone && (await assistentePode("avisar_profissional").catch(() => false))) {
        const pedido = (await getSimulatorOrderById(pedidoId)) as { serviceType?: string | null; city?: string | null } | undefined;
        const texto = avisoDaReservaQueCaiu(
          l.profissional ?? null,
          { pedidoId, servico: pedido?.serviceType ?? null, localidade: pedido?.city ?? null, porque },
          new Date(),
        );
        avisado = await enviarAvisoWhatsApp(telefone, texto).catch(() => false);
      }
    } catch (e) {
      console.error("[sim do cliente] o aviso da reserva que caiu:", e instanceof Error ? e.message : e);
    }
    const frase = HISTORICO.caiu(l.profissional ?? null, porque, q.quem, avisado);
    await appendOrderHistory(pedidoId, { type: "note", by: q.por, message: frase }).catch(() => {});
    return { caiu: true, avisado, frase };
  } catch (e) {
    console.error("[sim do cliente] largar a reserva:", e instanceof Error ? e.message : e);
    return { caiu: false, avisado: false, frase: null };
  }
}

/** De que pedido e de que parceiro é uma negociação — para o «Escolher» ver o sim do cliente antes. */
export async function pedidoDaNegociacao(negociacaoId: number): Promise<{ pedidoId: number; providerId: number } | null> {
  const pool = await getPool();
  if (!pool) return null;
  const [linhas] = (await pool.execute("SELECT pedidoId, providerId FROM negociacoes WHERE id = ? LIMIT 1", [negociacaoId])) as [
    Array<{ pedidoId: number; providerId: number }>,
    unknown,
  ];
  const l = linhas[0];
  return l ? { pedidoId: Number(l.pedidoId), providerId: Number(l.providerId) } : null;
}
