import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { COOKIE_SESSAO_ADMIN, sessaoDoPainel } from "@/lib/colaborador-auth";
import { getSimulatorOrderById } from "@/lib/db";
import VistaDoPedido from "@/app/pedido/[token]/VistaDoPedido";

/**
 * VER O PEDIDO COMO O CLIENTE O VÊ — sem gerar link nenhum.
 *
 * "Gostaria que, ao clicar em ver como cliente, abrisse o pedido como ele
 * aparece para o cliente, para eu, admin, poder conferir as infos — mas sem
 * gerar links novos." — 12-09-2026.
 *
 * O «sem gerar links novos» não é um capricho: é a razão de esta página
 * existir. O acesso do cliente vive só em HASH — o token em claro perde-se no
 * instante em que é enviado. Abrir a página dele obrigava a emitir um token
 * novo, e cada token novo MATA o anterior: o link que ele tem no email, ou
 * guardado no WhatsApp, deixava de abrir por causa de uma espreitadela do
 * backoffice. Era por isso que o botão estava cinzento até alguém gerar um
 * link de propósito.
 *
 * Aqui não há token. Há o número do pedido e a sessão de administrador, que é
 * uma prova melhor do que um token — e que não se gasta.
 *
 * NOT FOUND, E NÃO UM REDIRECCIONAMENTO, para quem não é administrador. Um
 * ecrã de entrada nesta rota dizia a quem lá batesse que o pedido #283 existe;
 * um 404 não diz nada a ninguém.
 */

export const metadata: Metadata = {
  title: "Ver como o cliente — CLYON",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PedidoComoOCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sessao = await sessaoDoPainel((await cookies()).get(COOKIE_SESSAO_ADMIN)?.value);
  if (!sessao) notFound();

  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const pedido = await getSimulatorOrderById(numero);
  if (!pedido) notFound();

  return (
    <>
      {/*
        A TARJA É OBRIGATÓRIA, e não decoração.

        Daqui para baixo é o ecrã do CLIENTE, igual ao dele. Sem um aviso no
        topo, quem abrisse isto numa segunda janela passados dez minutos não
        teria como saber de quem é o ecrã que está a ver — e a confusão entre
        «o que eu vejo» e «o que ele vê» é justamente a que esta página existe
        para desfazer.
      */}
      <div className="sticky top-0 z-30 border-b border-amber-300 bg-amber-100 px-4 py-2.5">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
            Está a ver o pedido #{pedido.id} como o cliente o vê. Nada aqui o altera.
          </p>
          <Link
            href="/admin?seccao=negociacoes"
            className="rounded-lg border border-amber-400 bg-white/60 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-white"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>

      <VistaDoPedido pedido={pedido} soParaVer />
    </>
  );
}
