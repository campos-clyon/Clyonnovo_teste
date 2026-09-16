import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { conferirOLivro, construirOLivro, registarSemFalhar } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Percorre todas as negociações e todos os levantamentos. Não é instantâneo. */
export const maxDuration = 120;

/**
 * O LIVRO DE MOVIMENTOS — conferir, e construir.
 *
 * Fase 1 do `docs/plano-pagamentos-eupago.md`. A carteira de cada profissional
 * vai passar a ser a soma de linhas de um livro, em vez de uma conta refeita a
 * partir das negociações. Esta rota é o que permite fazer essa passagem sem
 * ninguém ver o saldo mexer.
 *
 * VER PRIMEIRO, ESCREVER DEPOIS — a mesma ordem da purga, e pela mesma razão. O
 * GET corre os dois caminhos sobre os dados reais e diz onde discordam; só
 * depois de ele dizer «zero divergências» é que faz sentido carregar no POST.
 *
 * NENHUM DOS DOIS TROCA OS LEITORES. Os ecrãs continuam a ler a carteira de
 * hoje. Construir o livro não muda um número em lado nenhum — é escrever à
 * parte aquilo que já era verdade, e poder compará-lo à vontade antes de
 * confiar nele.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  try {
    const r = await conferirOLivro();
    return NextResponse.json({
      ...r,
      /*
       * A pergunta a que este ecrã responde, numa palavra. Quem o abre quer
       * saber se pode avançar, não interpretar cinco números.
       */
      podeAvancar: r.divergencias.length === 0 && r.porLancar === 0,
    });
  } catch (error) {
    console.error("[admin/livro GET]", error);
    return NextResponse.json({ error: "Não foi possível conferir o livro." }, { status: 500 });
  }
}

/**
 * Escrever as linhas que faltam.
 *
 * Idempotente: correr duas vezes não lança nada na segunda, porque cada
 * movimento tem uma chave única na base. Por isso não há confirmação nem
 * pergunta — não há nada que possa correr mal duas vezes.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  try {
    /*
     * CONFERIR ANTES DE ESCREVER, e recusar se discordarem.
     *
     * Se os dois caminhos não derem o mesmo número, escrever o livro é gravar
     * um saldo errado — e um livro é para não se reescrever. Mais vale não ter
     * livro nenhum do que ter um em que não se pode confiar.
     */
    const antes = await conferirOLivro();
    if (antes.divergencias.length > 0) {
      return NextResponse.json(
        {
          error:
            "Os dois caminhos não dão o mesmo número. Não escrevo o livro assim — " +
            `há ${antes.divergencias.length} divergência(s).`,
          divergencias: antes.divergencias.slice(0, 20),
        },
        { status: 409 },
      );
    }

    const r = await construirOLivro();

    // Só quando escreveu alguma coisa: uma linha por passagem que não fez nada
    // enchia o registo de ruído.
    if (r.lancados > 0) {
      await registarSemFalhar({
        acontecimento: "livro_construido",
        autorTipo: "clyon",
        autorNome: colab?.nome ?? "a CLYON",
        resumo:
          `Livro da carteira: ${r.lancados} movimento(s) lançado(s) ` +
          `em ${r.profissionais} profissional(is). Nenhum saldo mudou.`,
        detalhe: { lancados: r.lancados, profissionais: r.profissionais },
      });
    }

    const depois = await conferirOLivro();
    return NextResponse.json({
      ok: true,
      ...r,
      conferencia: depois,
      podeAvancar: depois.divergencias.length === 0 && depois.porLancar === 0,
    });
  } catch (error) {
    console.error("[admin/livro POST]", error);
    return NextResponse.json({ error: "Não foi possível construir o livro." }, { status: 500 });
  }
}
