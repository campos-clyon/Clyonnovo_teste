/**
 * O ARQUIVO DOS PEDIDOS APAGADOS, SEM NINGUÉM LÁ DENTRO — 01-10-2026.
 *
 * *«Anonimizar ao fim de 12 meses»* — decisão do dono, 01-10-2026, e também
 * quando o cliente apaga a conta.
 *
 * Quando a purga (ou alguém no backoffice) apaga um pedido, `deleteSimulatorOrder`
 * escreve uma cópia em `arquivoDePedidos`: o nome e o email do cliente em
 * colunas próprias, e em `dados` o pedido, as negociações e os endereços das
 * fotografias. Ficava sem prazo, e sobrevivia ao cliente apagar a conta.
 *
 * A anonimização NÃO APAGA A LINHA — o pedido existiu, e é isso que um litígio
 * ou a contabilidade ainda podem perguntar. Tira-lhe tudo o que diz de quem
 * era, e deixa o resto: datas, valores, serviço e zona. É o mesmo padrão da
 * anonimização do `registoPermanente` (`anonimizarRegisto` em db.ts).
 *
 * `dados` é tratado por LISTA DO QUE FICA, e não do que sai: um campo que um
 * dia apareça na cópia sem ninguém ter pensado nele sai por omissão. O teste
 * `arquivo-anonimo.test.ts` obriga a classificar cada coluna da tabela e cada
 * campo que `deleteSimulatorOrder` lá escreve.
 */

/**
 * As colunas de `arquivoDePedidos` que dizem de quem era o pedido. Saem todas.
 *
 *   · clienteNome, clienteEmail — ficam a NULL;
 *   · motivo — texto livre, escrito à mão no backoffice («a cliente Maria pediu
 *     para…»). Fica a NULL; o motivo de cada apagar continua no registo
 *     permanente, que tem a sua própria regra;
 *   · dados — reescrito com `dadosDoArquivoAnonimizados`: só o que está nas
 *     listas «FICA» abaixo.
 */
export const COLUNAS_PESSOAIS_DO_ARQUIVO = [
  "clienteNome",
  "clienteEmail",
  "motivo",
  "dados",
] as const;

/** As colunas que não identificam ninguém. Ficam como estão. */
export const COLUNAS_NAO_PESSOAIS_DO_ARQUIVO = [
  "id",
  "pedidoId",
  // A data em que a cópia foi arquivada — é dela que se contam os 12 meses.
  "criadoEm",
  "anonimizadoEm",
  "anonimizadoMotivo",
] as const;

/** Do pedido, dentro de `dados`, fica isto — e só isto. */
export const DO_PEDIDO_FICA = [
  "id",
  "serviceType",
  // A zona/concelho, como na anonimização das contas de cliente.
  "city",
  "valorDesejadoCliente",
  "createdAt",
  /*
   * COMO ACABOU E POR QUANTO — 26-10-2026 (d32, parte C). *«Guarda o estado e
   * o preço final, como o comentário do código promete.»* Não identificam
   * ninguém, e são o que conta a história do pedido: cancelado ou concluído,
   * em que dia, por que preço, quem o tratou na CLYON.
   */
  "status",
  "precoFinal",
  "precoFinalIva",
  "concluidoEm",
  "scheduledDate",
  "valorFixoClyon",
  "precoClienteClyon",
  "taxaClyon",
  "lucroManual",
  "assignedToName",
] as const;

/**
 * Do pedido, o que sai. Não é esta lista que apaga (apaga tudo o que não está
 * em `DO_PEDIDO_FICA`); é a decisão escrita, para o teste a poder comparar com
 * o que `deleteSimulatorOrder` lê.
 */
export const DO_PEDIDO_SAI = [
  "contactName",
  "contactEmail",
  "contactPhone",
  "address",
  "postalCode",
  "floor",
  "description",
  // Os endereços das fotografias de dentro de casa.
  "filesJson",
  // O ponteiro para o evento da agenda (com nome, telefone e morada lá dentro).
  // Se o evento ainda lá estiver, o registo permanente guarda o ponteiro.
  "calendarEventId",
  "calendarTargetId",
  "rawOrderJson",
  "chatJson",
  "historyJson",
] as const;

/** De cada negociação, fica isto. O profissional fica pelo número, não pelo nome. */
export const DA_NEGOCIACAO_FICA = [
  "id",
  "providerId",
  "estado",
  "valorAcordado",
  "confirmadoEm",
  "execucaoEnviadaEm",
  "pagoEm",
] as const;

/** De cada negociação, sai: a prova (fotografias e texto) e o nome do profissional. */
export const DA_NEGOCIACAO_SAI = ["provaJson", "profissionalNome"] as const;

export type MotivoDaAnonimizacaoDoArquivo = "prazo" | "conta_cliente";

/** Só valores simples: um objecto onde se esperava um número pode trazer qualquer coisa. */
function soEstes(o: unknown, campos: readonly string[]): Record<string, unknown> | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const fonte = o as Record<string, unknown>;
  const r: Record<string, unknown> = {};
  for (const c of campos) {
    if (!(c in fonte)) continue;
    const v = fonte[c];
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) r[c] = v;
  }
  return r;
}

/**
 * O `dados` de uma linha do arquivo, só com o que não identifica ninguém.
 *
 * As fotografias passam a ser um número (quantas havia): o registo guarda que
 * houve fotografias, não as fotografias. Um JSON estragado dá uma cópia vazia —
 * na dúvida, sai.
 *
 * Pode correr duas vezes sobre a mesma linha e dá o mesmo.
 */
export function dadosDoArquivoAnonimizados(dados: unknown): string {
  let d: Record<string, unknown> | null = null;
  try {
    const lido = typeof dados === "string" ? JSON.parse(dados) : null;
    d = lido && typeof lido === "object" && !Array.isArray(lido) ? lido : null;
  } catch {
    d = null;
  }

  const fotos = Array.isArray(d?.fotografias)
    ? (d!.fotografias as unknown[]).length
    : typeof d?.quantasFotografias === "number"
      ? (d.quantasFotografias as number)
      : 0;

  return JSON.stringify({
    anonimizado: true,
    pedido: soEstes(d?.pedido, DO_PEDIDO_FICA),
    negociacoes: Array.isArray(d?.negociacoes)
      ? (d!.negociacoes as unknown[])
          .map((n) => soEstes(n, DA_NEGOCIACAO_FICA))
          .filter((n): n is Record<string, unknown> => n != null)
      : [],
    quantasFotografias: fotos,
  });
}

/**
 * O MOTIVO QUE FICA NA CÓPIA ANÓNIMA — 26-10-2026 (d32, parte C).
 *
 * O da purga é texto do sistema («retenção de 60 dias») e fica. O de um apagar
 * à mão é escrito no backoffice e pode dizer qualquer coisa («a cliente Maria
 * pediu para…»): sai da cópia, e continua no registo permanente, que tem a sua
 * própria regra.
 */
export function motivoQueFicaNoArquivo(motivo: unknown): string | null {
  if (typeof motivo !== "string") return null;
  const m = motivo.trim();
  return /^retenção de \d+ dias$/.test(m) ? m : null;
}

/** A marca com que `dadosDoArquivoAnonimizados` começa — o `dados` já não tem ninguém. */
export const DADOS_JA_ANONIMOS = '{"anonimizado":true';
