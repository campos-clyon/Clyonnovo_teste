/**
 * O AVISO «JÁ PODE ENTRAR NO TESTE», NA BASE — 18-11-2026 (d6). As regras
 * puras estão em `lista-da-play-e-o-profissional.ts`.
 *
 * SÓ DISPARA AO COLAR UMA LISTA DA PLAY (POST de /api/admin/quem-conta-para-os-12,
 * app «pro»): nunca num deploy, nunca numa rotina. Cada profissional recebe-o
 * uma vez: a data `providers.avisoDaListaDaPlayEm` reserva-se ANTES de enviar
 * (`… AND avisoDaListaDaPlayEm IS NULL`, e o MySQL diz se mudou a linha), e
 * desfaz-se se não chegou por nenhum caminho. Duas colagens ao mesmo tempo não
 * avisam a mesma pessoa duas vezes; colar a mesma lista outra vez não avisa
 * ninguém.
 *
 * Nunca lança: a lista já ficou gravada, e um aviso que falhe não pode virar
 * um erro para quem a colou.
 */

import type { Pool } from "mysql2/promise";
import { ensureProvidersSchema, getPool } from "./db";
import { sendPushToUser } from "./webpush";
import { enviarEmailDoSeguimento } from "./seguimento-da-app-envio";
import { urlDeAccao } from "./url-do-site";
import { avisoDaListaDaPlay, quemAvisarDaLista } from "./lista-da-play-e-o-profissional";

/** No máximo, por colagem (a lista da Play tem umas dezenas). */
const MAXIMO_POR_COLAGEM = 200;

export type ResultadoDosAvisos = { avisados: number; falharam: number };

type Linha = {
  id: number;
  name: string | null;
  email: string | null;
  gmailDoTeste: string | null;
  appAbertaEm: Date | string | null;
  avisoDaListaDaPlayEm: Date | string | null;
};

export async function avisarQuemEntrouNaListaDaPlay(lista: string[]): Promise<ResultadoDosAvisos> {
  const resultado: ResultadoDosAvisos = { avisados: 0, falharam: 0 };
  if (!lista.length) return resultado;
  try {
    await ensureProvidersSchema();
    const p = (await getPool()) as Pool | null;
    if (!p) return resultado;
    const [linhas] = (await p.query(
      `SELECT id, name, email, gmailDoTeste, appAbertaEm, avisoDaListaDaPlayEm
         FROM providers
        WHERE isClyon = 0 AND COALESCE(estado, '') <> 'apagado'
          AND avisoDaListaDaPlayEm IS NULL AND appAbertaEm IS NULL
        LIMIT 3000`,
    )) as [Linha[], unknown];
    const porId = new Map(linhas.map((l) => [Number(l.id), l]));
    const ids = quemAvisarDaLista(
      linhas.map((l) => ({
        id: Number(l.id),
        emails: [l.gmailDoTeste, l.email],
        avisadoEm: l.avisoDaListaDaPlayEm,
        abriuApp: l.appAbertaEm != null,
      })),
      lista,
    ).slice(0, MAXIMO_POR_COLAGEM);

    const link = new URL("/app-pro?passo=3", urlDeAccao()).toString();
    for (const id of ids) {
      const l = porId.get(id);
      if (!l) continue;
      // Reserva: só quem muda a linha envia.
      const [r] = (await p.execute(
        "UPDATE providers SET avisoDaListaDaPlayEm = UTC_TIMESTAMP() WHERE id = ? AND avisoDaListaDaPlayEm IS NULL",
        [id],
      )) as [{ affectedRows?: number }, unknown];
      if (Number(r.affectedRows ?? 0) === 0) continue;

      const aviso = avisoDaListaDaPlay({ nome: l.name, link });
      const email = typeof l.email === "string" ? l.email.trim() : "";
      let chegou = false;
      if (email) {
        chegou = await enviarEmailDoSeguimento({ para: email, assunto: aviso.assunto, texto: aviso.texto });
        try {
          const n = await sendPushToUser(
            email,
            { title: aviso.titulo, body: aviso.corpo, url: link, tag: "lista-da-play", tipo: "lista-da-play" },
            "pro",
          );
          if (n > 0) chegou = true;
        } catch (e) {
          console.error("[lista-da-play] push:", e instanceof Error ? e.message : e);
        }
      }
      if (chegou) {
        resultado.avisados += 1;
      } else {
        resultado.falharam += 1;
        await p.execute("UPDATE providers SET avisoDaListaDaPlayEm = NULL WHERE id = ?", [id]);
      }
    }
  } catch (e) {
    console.error("[lista-da-play] avisos:", e instanceof Error ? e.message : e);
  }
  return resultado;
}

