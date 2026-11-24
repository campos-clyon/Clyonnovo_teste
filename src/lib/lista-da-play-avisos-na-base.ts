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


/* ─── A APP DE CLIENTE — 24-11-2026 (d106, P4; texto v3 da d107, secção 4) ──
 *
 * O aviso «Já pode instalar» na app de cliente, ao colar a lista da app de
 * cliente: SÓ a quem nos deu o Gmail (o programa da app: «Programa: …» no
 * quadro), que passou a estar na lista, ainda não abriu a app e nunca recebeu
 * este aviso. Uma vez por pessoa: a data reserva-se ANTES de enviar
 * (`percursoDoConviteDaApp.avisoDaListaEm`) e desfaz-se se o email falhar.
 * Leva a ligação NOSSA da pessoa e a recusa. Fica de fora quem está no «não
 * contactar», recusou as mensagens sobre a app, ou tem um pedido cancelado.
 *
 * DESLIGADO a 24-11-2026 (`AVISO_JA_PODE_INSTALAR_LIGADO`): nada se envia
 * sozinho. Devolve `desligado: true`.
 */

export type ResultadoDosAvisosDaAppDeCliente = ResultadoDosAvisos & { desligado: boolean };

/** Quem nos deu o Gmail: as pessoas que vêm do programa da app. Pura. */
export function deuOGmail(porque: string): boolean {
  return porque.startsWith("Programa:");
}

export async function avisarClientesQueEntraramNaListaDaPlay(lista: string[]): Promise<ResultadoDosAvisosDaAppDeCliente> {
  const resultado: ResultadoDosAvisosDaAppDeCliente = { avisados: 0, falharam: 0, desligado: false };
  try {
    const { AVISO_JA_PODE_INSTALAR_LIGADO, MODELO_DO_AVISO_JA_PODE_INSTALAR } = await import("./textos-do-seguimento-da-app");
    if (!AVISO_JA_PODE_INSTALAR_LIGADO) return { ...resultado, desligado: true };
    if (!lista.length) return resultado;

    const { pessoasDaAppDeCliente } = await import("./quem-conta-para-os-12-na-base");
    const { emailsJaAvisadosDaLista, linkNossoDoConvite, reservarAvisoDaLista, desfazerAvisoDaLista } = await import(
      "./percurso-da-app-cliente-na-base"
    );
    const { naoContactarNaApp } = await import("./nao-contactar-na-app");
    const { montarEmailDaApp } = await import("./email-da-app-de-cliente");

    const [pessoas, jaAvisados] = await Promise.all([pessoasDaAppDeCliente(), emailsJaAvisadosDaLista()]);
    const candidatas = pessoas.filter((p) => p.emails.length > 0 && deuOGmail(p.porque));
    const ids = quemAvisarDaLista(
      candidatas.map((p, i) => ({
        id: i,
        emails: p.emails,
        avisadoEm: p.emails.some((e) => jaAvisados.has(e)) ? new Date() : null,
        abriuApp: p.abertaEm != null || p.temAvisosDaApp,
      })),
      lista,
    ).slice(0, MAXIMO_POR_COLAGEM);

    for (const i of ids) {
      const pessoa = candidatas[i];
      const email = pessoa?.emails[0];
      if (!pessoa || !email) continue;
      if (await naoContactarNaApp({ email, telefone: pessoa.telefone })) continue;
      const contaId = /^c\d+$/.test(pessoa.id) ? Number(pessoa.id.slice(1)) : null;
      const link = await linkNossoDoConvite(email, contaId);
      if (!(await reservarAvisoDaLista(email))) continue;
      const nome = /^(Conta #|Sem conta)/.test(pessoa.nome) ? null : pessoa.nome;
      const m = montarEmailDaApp(MODELO_DO_AVISO_JA_PODE_INSTALAR, { nome, link });
      const ok = await enviarEmailDoSeguimento({ para: email, assunto: m.assunto, texto: m.texto, html: m.html });
      if (ok) resultado.avisados += 1;
      else {
        resultado.falharam += 1;
        await desfazerAvisoDaLista(email);
      }
    }
  } catch (e) {
    console.error("[lista-da-play] avisos da app de cliente:", e instanceof Error ? e.message : e);
  }
  return resultado;
}
