import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO_TESTE, verificarSessaoDeTeste } from "@/lib/acesso-mvp";
import PainelDeTestes from "./PainelDeTestes";

export const metadata: Metadata = {
  title: "CLYON plataforma",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * A sessão é verificada aqui OUTRA VEZ, depois do middleware.
 *
 * Não é desconfiança do middleware — é que a proteção de uma página não pode
 * depender de uma expressão regular num `matcher` que alguém edita daqui a seis
 * meses. Duas fechaduras independentes, e nenhuma delas sozinha decide.
 */
export default async function PlataformaPage() {
  const sessao = await verificarSessaoDeTeste(
    (await cookies()).get(COOKIE_SESSAO_TESTE)?.value,
  );
  if (!sessao) redirect("/plataforma/entrar");

  return <PainelDeTestes nome={sessao.nome} />;
}
