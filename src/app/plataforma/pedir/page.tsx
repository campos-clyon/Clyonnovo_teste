import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO_TESTE, verificarSessaoDeTeste } from "@/lib/acesso-mvp";
import FormularioDePedido from "./FormularioDePedido";

export const metadata: Metadata = {
  title: "Fazer um pedido — CLYON plataforma",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * O formulário de pedido da plataforma.
 *
 * Viveu em /simulador durante três dias e não devia ter vivido: /simulador é a
 * página de orçamento do site a sério, e passou a recolher pedidos de um modelo
 * que ainda não funciona de ponta a ponta. Aqui está atrás do portão, e o
 * simulador voltou a ser o que era.
 */
export default async function PedirPage() {
  const sessao = await verificarSessaoDeTeste(
    (await cookies()).get(COOKIE_SESSAO_TESTE)?.value,
  );
  if (!sessao) redirect("/plataforma/entrar");

  return <FormularioDePedido />;
}
