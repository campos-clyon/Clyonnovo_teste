import { NextRequest, NextResponse } from "next/server";
import { TIPOS_DE_VEICULO } from "@/lib/convite-profissional";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import {
  categoriasDoCorpo,
  emailValido,
  telefoneValido,
  temSinaisDeHtml,
  MENSAGEM_SEM_SINAIS,
} from "@/lib/inscricao-profissional";
import { guardarCandidatura } from "@/lib/candidaturas";
import { limparOrigemDaCandidatura } from "@/lib/origem-da-candidatura";
import {
  lerFotografiasDaCandidatura,
  MENSAGEM_SEM_FOTOGRAFIA_NA_APP,
} from "@/lib/fotografias-da-carrinha";
import { apagarFotosDoBlob } from "@/lib/db";
import { separarErrosDaCandidatura } from "@/lib/campos-da-candidatura";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Quem se oferece para trabalhar connosco, pelo site.
 *
 * É PÚBLICA e é a única escrita da plataforma que não exige sessão nem
 * convite — por isso leva limite por IP. O que ela cria não é um
 * profissional: é uma candidatura por tratar, que alguém no backoffice lê e
 * decide. Ninguém entra na fila de pedidos por aqui.
 *
 * O que se pede é o mínimo para poder decidir: nome, contacto, zona e o que
 * faz. Os dados a sério — NIF, morada fiscal, IBAN, raio — só depois do
 * convite, no formulário de inscrição. Pedir tudo à cabeça a um profissional
 * que ainda não sabe se quer é a forma mais rápida de o perder no terceiro
 * campo.
 */

/*
 * A LISTA E A DE `convite-profissional.ts`, desde 29-09-2026.
 *
 * Havia aqui uma copia com cinco entradas, e a canonica tem sete. O campo
 * deixou de ser uma etiqueta -- e ele que decide o valor por carga que o
 * profissional ve (`carga-da-carrinha.ts`) -- e duas listas a decidir
 * dinheiro nao dao erro no dia em que divergem: dao um preco.
 */
const VEICULOS: readonly string[] = TIPOS_DE_VEICULO.map((v) => v.id);

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

export async function POST(req: NextRequest) {
  // Seis por hora do mesmo sítio: quem se candidata fá-lo uma vez.
  const limite = await limitarRotaPublica(req, "candidatura-parceiro", 6, 3600);
  if (limite.erro) return limite.erro;

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const erros: Array<{ campo: string; mensagem: string }> = [];

  const nome = texto(corpo.nome, 120);
  if (!nome || nome.length < 2) {
    erros.push({ campo: "nome", mensagem: "Indique o seu nome ou o da empresa." });
  } else if (temSinaisDeHtml(nome)) {
    // A aprovação transforma isto no nome da página pública dele.
    erros.push({ campo: "nome", mensagem: MENSAGEM_SEM_SINAIS.nome });
  }

  const email = texto(corpo.email, 200)?.toLowerCase() ?? null;
  if (!email || !emailValido(email)) {
    erros.push({ campo: "email", mensagem: "Indique um email válido — é para lá que vai o convite." });
  }

  const telefone = texto(corpo.telefone, 30);
  if (!telefone || !telefoneValido(telefone)) {
    erros.push({ campo: "telefone", mensagem: "Indique um telemóvel português." });
  }

  const cidade = texto(corpo.cidade, 120);
  if (!cidade) {
    erros.push({ campo: "cidade", mensagem: "Diga de onde trabalha — é o que decide que pedidos lhe chegam." });
  } else if (temSinaisDeHtml(cidade)) {
    erros.push({ campo: "cidade", mensagem: MENSAGEM_SEM_SINAIS.cidade });
  }

  const servicosBrutos = Array.isArray(corpo.servicos) ? corpo.servicos : [];
  // Os grupos desde 29-10-2026; uma app antiga que mande serviços grava os grupos deles.
  const servicos = categoriasDoCorpo(servicosBrutos.filter((s): s is string => typeof s === "string"));
  if (servicos.length === 0) {
    erros.push({ campo: "servicos", mensagem: "Escolha pelo menos um serviço que faça." });
  }

  const veiculoBruto = texto(corpo.tipoVeiculo, 60);
  const tipoVeiculo = veiculoBruto && VEICULOS.includes(veiculoBruto) ? veiculoBruto : null;

  /*
   * AS FOTOGRAFIAS DA CARRINHA — 04-11-2026 (decisão d17).
   *
   * «Quero que os candidatos a pro enviem imagens dos veículos.» De 1 a 4, e
   * sem nenhuma a candidatura não segue — aqui, no servidor, e não só no
   * formulário: a rota é pública e qualquer um a chama sem passar por ele.
   * Os endereços têm de ser os que o nosso envio devolveu
   * (`/api/parceiros/candidatura/fotografias`), e nenhum outro.
   */
  const fotografias = lerFotografiasDaCandidatura(corpo.fotografiasDoVeiculo);
  if (!fotografias.ok) {
    /*
     * A APP CLYON PRO AINDA NÃO TEM O CAMPO (a app fica para a Engenharia —
     * Apps). Ela mostra os erros por campo que conhece, e um erro de
     * «fotografias» ficava sem sítio: o candidato lia «falta preencher o que
     * está assinalado» com nada assinalado. Quando é a única coisa que falta,
     * vai como mensagem geral, que a app mostra, a dizer-lhe por onde seguir.
     */
    const daApp = Boolean(req.headers.get("x-app-versao"));
    if (daApp && fotografias.semNenhuma && erros.length === 0) {
      return NextResponse.json({ error: MENSAGEM_SEM_FOTOGRAFIA_NA_APP }, { status: 400 });
    }
    erros.push({ campo: "fotografias", mensagem: fotografias.mensagem });
  }

  if (erros.length > 0 || !fotografias.ok) {
    /*
     * UM ERRO SEM SÍTIO NO ECRÃ VAI COMO MENSAGEM GERAL — 12-11-2026 (d9).
     *
     * O site e a app mostram os erros por baixo dos campos que conhecem
     * (`campos-da-candidatura.ts`), e quando há erros por campo ignoram a
     * mensagem geral. Um campo que não está na lista ficava calado, e o
     * candidato lia «falta» sem nada assinalado. Com ou sem o cabeçalho da app,
     * esse erro vai em `error`, que os dois mostram.
     */
    const { porCampo, geral } = separarErrosDaCandidatura(erros);
    if (porCampo.length === 0) {
      return NextResponse.json(
        { error: geral ?? "Não foi possível enviar a candidatura. Reveja o que escreveu e tente outra vez." },
        { status: 400 },
      );
    }
    return NextResponse.json(geral ? { erros: porCampo, error: geral } : { erros: porCampo }, { status: 400 });
  }

  try {
    const { repetida, orfas } = await guardarCandidatura({
      nome: nome!,
      email: email!,
      telefone,
      cidade,
      tipoVeiculo,
      servicos,
      mensagem: texto(corpo.mensagem, 1000),
      /*
       * DE ONDE VEIO — 31-10-2026 (d6 de 28-10). O formulário manda-a sempre;
       * o que não se reconhece fica de fora, e a candidatura entra na mesma.
       */
      origem: limparOrigemDaCandidatura(corpo.origem),
      fotografiasDoVeiculo: fotografias.fotos,
    });

    /*
     * Quem se candidata outra vez com o mesmo email troca as fotografias: as
     * da vez anterior que já não vêm saem do Blob, depois de a base já ter as
     * novas. Se o Blob falhar, fica uma a mais — fica dito nos registos.
     */
    if (orfas.length > 0) {
      const saiu = await apagarFotosDoBlob(orfas).catch(() => 0);
      if (saiu < orfas.length) console.error("[parceiros/candidatura] ficaram no Blob:", orfas.length);
    }

    /*
     * A resposta é a mesma nos dois casos, de propósito.
     *
     * Dizer "já se tinha candidatado" a quem carregou duas vezes no botão não
     * ajuda ninguém e conta a quem sonda quais os emails que já cá estão.
     */
    return NextResponse.json({ ok: true, repetida });
  } catch (e) {
    console.error("[parceiros/candidatura]", e);
    return NextResponse.json(
      { error: "Não foi possível registar a candidatura. Tente outra vez daqui a pouco." },
      { status: 500 },
    );
  }
}
