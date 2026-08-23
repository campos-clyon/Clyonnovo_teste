"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ExternalLink } from "lucide-react";

import ApagarContaModal, { LinhaApagarConta } from "@/components/ApagarContaModal";

/**
 * Segurança da conta do cliente.
 *
 * SAIU A CAIXA VERMELHA
 *
 * Havia aqui uma "Zona de perigo": moldura vermelha, triângulo de aviso e um
 * parágrafo permanente sobre apagar a conta — no ecrã de quem vem ver como se
 * muda a palavra-passe. Uma acção que quase ninguém usa não merece espaço
 * fixo, e um aviso vermelho que está sempre lá deixa de ser um aviso.
 *
 * Ficou uma linha em cinzento, e a explicação atrás do toque.
 *
 * E O ECRÃ PASSOU A TRATAR POR "VOCÊ"
 *
 * Dizia "os teus dados", "Escreve ELIMINAR", "Tenta novamente". O resto do
 * site trata o cliente por você — "não feche esta página", "o seu pedido". A
 * mesma pessoa, na mesma visita, era tratada de duas maneiras conforme o ecrã.
 */
export default function Seguranca() {
  const [aApagar, setAApagar] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Segurança</h2>
        <p className="mt-0.5 text-sm text-slate-500">Gestão de acesso e segurança da conta.</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Método de autenticação</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          A sua entrada é gerida pela Google — não há palavra-passe CLYON para gerir. Para
          alterar a palavra-passe da conta Google, faça-o directamente no Google.
        </p>
        <a
          href="https://myaccount.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
        >
          Gerir conta Google
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      <div className="pt-2">
        <LinhaApagarConta onClick={() => setAApagar(true)} />
      </div>

      {aApagar && (
        <ApagarContaModal
          endereco="/api/users/me"
          aviso={
            <>
              Os seus dados pessoais são apagados: nome, telefone, morada, dados de
              facturação e as fotografias que enviou. Os pedidos antigos ficam sem nome —
              o profissional que executou cada trabalho mantém o registo dele, sem os seus
              contactos. Se tiver um trabalho contratado por confirmar, isto pára e diz o
              que falta resolver.
            </>
          }
          aoTerminar={() => signOut({ callbackUrl: "/" })}
          onClose={() => setAApagar(false)}
        />
      )}
    </div>
  );
}
