/**
 * Onde está o token de escrita do Vercel Blob.
 *
 * O código procurava `BLOB_READ_WRITE_TOKEN` e mais nada. Só que o Vercel só
 * usa esse nome quando o store é ligado sem prefixo: se lhe for dado um
 * prefixo — que é o que acontece quando se liga mais do que um store, ou
 * quando se escolhe um nome — as variáveis passam a chamar-se
 * `<PREFIXO>_READ_WRITE_TOKEN`, `<PREFIXO>_STORE_ID`, e por aí.
 *
 * O resultado foi silencioso e caro: o store existia, estava ligado, e o
 * upload devolvia "não configurado" a toda a gente. Nenhuma foto do simulador
 * foi guardada durante esse tempo, e não voltam — nunca chegaram a sair do
 * telemóvel de quem as enviou.
 *
 * Procurar pelo sufixo resolve isto para qualquer prefixo, agora e no dia em
 * que o store for trocado. O nome exacto encontrado é devolvido para poder
 * aparecer no diagnóstico: saber QUAL variável está a ser usada vale mais do
 * que saber que há uma.
 */
export type TokenDoBlob =
  | { ok: true; token: string; variavel: string }
  | { ok: false; motivo: string; encontradas: string[] };

const NOME_PADRAO = "BLOB_READ_WRITE_TOKEN";

/**
 * Limpa o valor tal como ele costuma chegar de um copiar-colar.
 *
 * O separador `.env.local` do Vercel mostra a linha assim:
 *
 *     BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
 *
 * Copiar o valor com as aspas é o erro mais fácil de cometer, e o resultado
 * não é um erro de configuração legível — é "Access denied" vindo da API,
 * como se o token fosse de outra pessoa. Espaços à volta dão o mesmo.
 *
 * Isto não é indulgência: um token com aspas nunca é válido, portanto
 * removê-las não aceita nada que devesse ser recusado.
 */
function limpar(valor: string): string {
  let v = valor.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export function obterTokenDoBlob(env: Record<string, string | undefined> = process.env): TokenDoBlob {
  const padrao = env[NOME_PADRAO];
  if (padrao && limpar(padrao)) {
    return { ok: true, token: limpar(padrao), variavel: NOME_PADRAO };
  }

  // Qualquer <PREFIXO>_READ_WRITE_TOKEN serve. Ordenado para que a escolha
  // seja sempre a mesma entre arranques — duas variáveis e um sorteio
  // diferente a cada instância seria pior do que nenhuma.
  const candidatas = Object.keys(env)
    .filter((k) => k.endsWith("_READ_WRITE_TOKEN") && limpar(env[k] ?? ""))
    .sort();

  if (candidatas.length > 0) {
    const nome = candidatas[0];
    return { ok: true, token: limpar(env[nome] as string), variavel: nome };
  }

  // Nomes que ajudam a perceber o que está lá — sem valores, só nomes.
  const pistas = Object.keys(env)
    .filter((k) => /BLOB|_STORE_ID$/i.test(k))
    .sort();

  return {
    ok: false,
    motivo: pistas.length > 0
      ? `Não há nenhuma variável *_READ_WRITE_TOKEN. Existem estas, do mesmo store: ${pistas.join(", ")}. Falta o token de escrita.`
      : "Não há nenhuma variável *_READ_WRITE_TOKEN nem nada do Vercel Blob no ambiente.",
    encontradas: pistas,
  };
}
