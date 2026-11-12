/**
 * QUEM APARECE NO SEPARADOR DOS PROFISSIONAIS — 12-11-2026 (d8).
 *
 * O «Por aprovar» do Início contava `estado = 'pendente'` em toda a tabela,
 * contas da própria CLYON incluídas (`isClyon = 1`); o separador dos
 * Profissionais lista só os de fora e sem as linhas apagadas. Os dois números
 * não batiam. Uma condição só, usada pelos dois.
 */
export const ONDE_PROFISSIONAIS_DO_PAINEL = "isClyon = 0 AND (estado IS NULL OR estado <> 'apagado')";

/** O «Por aprovar»: o mesmo separador, filtrado por `pendente`. */
export const ONDE_POR_APROVAR = `${ONDE_PROFISSIONAIS_DO_PAINEL} AND estado = 'pendente'`;
