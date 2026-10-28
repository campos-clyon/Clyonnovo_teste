"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

/**
 * A SESSÃO DO SITE JÁ NÃO TEM CONTA POR TRÁS — 28-10-2026 (d10).
 *
 * O cookie do site dura 30 dias e não se revoga: quem apagou a conta (ou a
 * viu apagada) continua com ele no navegador. /conta deixou de criar a conta
 * de novo a partir dele, e mostra isto em vez de redireccionar — /entrar com
 * o cookie ainda lá mandava de volta para /conta, num ciclo.
 *
 * O botão apaga o cookie (`signOut`) e só depois vai para /entrar.
 */
export default function SessaoTerminou() {
  const [aSair, setASair] = useState(false);
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-[#E2EEF3] bg-white p-6 text-center">
        <h1 className="text-lg font-bold text-tinta">A sua sessão terminou — entre outra vez</h1>
        <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">
          Para ver os seus pedidos, entre com o Google ou com o link que enviamos para o seu email.
        </p>
        <button
          type="button"
          disabled={aSair}
          onClick={() => {
            setASair(true);
            void signOut({ callbackUrl: "/entrar" });
          }}
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-acao px-6 text-sm font-semibold text-white disabled:opacity-60"
        >
          {aSair ? "A sair…" : "Entrar outra vez"}
        </button>
      </div>
    </main>
  );
}
