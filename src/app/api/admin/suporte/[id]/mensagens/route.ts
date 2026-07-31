import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { respostaDeErroSupabase } from "@/lib/erro-supabase";
import { etiquetaAutor } from "@/lib/suporte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * A tabela tem um gatilho (trg_avisar_resposta_do_suporte) que escreve em
 * notifications. Se alguma coisa nesse caminho bloquear, é melhor a função
 * morrer com erro do que ficar pendurada — do outro lado há uma pessoa a
 * olhar para um botão parado.
 */
export const maxDuration = 20;

const MAX_CARACTERES = 5000;

/**
 * POST /api/admin/suporte/[id]/mensagens — responder ao cliente.
 *
 * A tabela support_ticket_messages existe no schema e nunca foi usada por
 * ninguém. É por aqui que a caixa de correio passa a ser conversa.
 *
 * ⚠️ `author_id` é um uuid do Supabase e quem responde é um colaborador do
 * MySQL, com id inteiro — não há uuid nenhum para pôr lá. Grava-se o nome em
 * `author_label`, como já se fez em payment_references.confirmed_by_label.
 * Forçar um uuid inventado seria pior: passava a haver um autor que não
 * existe em auth.users e qualquer join com utilizadores ficava partido.
 *
 * NOTA: enquanto a app não tiver o ecrã da conversa, o cliente não vê esta
 * resposta. Fica gravada e pronta para quando esse ecrã existir; até lá, quem
 * responde aqui deve contar com telefone ou email para chegar à pessoa.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const texto = typeof body.body === "string" ? body.body.trim() : "";

  if (!texto) {
    return NextResponse.json({ error: "Escreva a resposta antes de enviar." }, { status: 400 });
  }
  if (texto.length > MAX_CARACTERES) {
    return NextResponse.json(
      { error: `A resposta é demasiado longa (máximo ${MAX_CARACTERES} caracteres).` },
      { status: 400 },
    );
  }

  try {
    const sb = getSupabaseAdmin();

    // O ticket tem de existir. Sem isto, uma mensagem podia ficar agarrada a
    // um ticket_id inventado e nunca mais aparecer a ninguém.
    const { data: ticket } = await sb
      .from("support_tickets").select("id, status").eq("id", id).maybeSingle();
    if (!ticket) {
      return NextResponse.json({ error: "Pedido de suporte não encontrado." }, { status: 404 });
    }

    const agora = new Date().toISOString();

    const { data: mensagem, error } = await sb
      .from("support_ticket_messages")
      .insert({
        ticket_id:    id,
        author_id:    null,
        author_role:  "admin",
        author_label: etiquetaAutor(colab!),
        body:         texto,
        // `attachments` é NOT NULL na tabela. Se não tiver DEFAULT '{}', não
        // o enviar faz o insert falhar com "null value in column attachments
        // violates not-null constraint" — e a resposta nunca grava. Mandar um
        // array vazio funciona nos dois casos, com default ou sem ele.
        attachments:  [],
        created_at:   agora,
      })
      .select("id, ticket_id, author_role, author_label, body, created_at")
      .single();

    if (error) {
      console.error("[admin/suporte/mensagens] falha a gravar:", error);
      // A coluna author_label vem por migração. Se ela ainda não existir, o
      // erro do Postgres é "column ... does not exist" — uma frase que não
      // diz a ninguém o que fazer a seguir. Melhor dizer.
      const faltaColuna = /author_label/i.test(error.message ?? "");
      return NextResponse.json(
        {
          error: faltaColuna
            ? "Falta aplicar a migração do suporte (coluna author_label em support_ticket_messages). Peça o SQL e corra-o no Supabase."
            : "Não foi possível gravar a resposta.",
          detalhe: error.message,
        },
        { status: faltaColuna ? 503 : 500 },
      );
    }

    // Responder a um ticket por ler passa-o a "em curso" — quem respondeu já
    // não precisa de o ver na lista dos que ninguém tocou. Se já estava noutro
    // estado, não se mexe: quem o pôs lá teve uma razão.
    let estadoNovo = ticket.status as string;
    if (ticket.status === "open") {
      const { error: erroEstado } = await sb
        .from("support_tickets")
        .update({ status: "in_progress", updated_at: agora })
        .eq("id", id);
      if (!erroEstado) estadoNovo = "in_progress";
    }

    return NextResponse.json({ ok: true, mensagem, status: estadoNovo });
  } catch (e) {
    return respostaDeErroSupabase("admin/suporte/mensagens", e);
  }
}
