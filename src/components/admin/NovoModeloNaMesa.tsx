"use client";

import { useEffect, useState } from "react";
import ContaDoPagamento from "@/components/ContaDoPagamento";
import { aPassarAClyonDaConta, type ContaDoPagamento as Conta } from "@/lib/conta-do-pagamento";
import { backofficeAConfirmarNoNovoModelo } from "./frase-do-novo-modelo";

/**
 * O MODELO DE 15-11 NO BLOCO «DEU O TRABALHO POR FEITO» DA MESA — d53
 * (16-11-2026). O cliente paga ao profissional, e o profissional passa à CLYON
 * a taxa da plataforma e o IVA dela. A conta é a da «Conta do pagamento» do
 * mesmo cartão: a mesma rota (`/api/admin/negociacoes/fatura`, a do
 * `FaturasDoTrabalho`), o mesmo componente e as mesmas palavras — nunca a conta
 * antiga («o trabalho menos 10 %»).
 */
function useContaDoNovoModelo(negociacaoId: number, token: string | null): { conta: Conta | null; lida: boolean } {
  const [estado, setEstado] = useState<{ conta: Conta | null; lida: boolean }>({ conta: null, lida: false });
  useEffect(() => {
    if (!token) return;
    let vivo = true;
    fetch(`/api/admin/negociacoes/fatura?negociacaoId=${negociacaoId}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { novoModelo?: boolean; conta?: Conta | null } | null) => {
        if (vivo) setEstado({ conta: d?.novoModelo ? (d.conta ?? null) : null, lida: true });
      })
      .catch(() => {
        if (vivo) setEstado({ conta: null, lida: true });
      });
    return () => {
      vivo = false;
    };
  }, [negociacaoId, token]);
  return estado;
}

/** A frase do bloco amarelo, com o valor que o profissional passa à CLYON. */
export function AConfirmarNoNovoModelo({ negociacaoId, token }: { negociacaoId: number; token: string | null }) {
  const { conta } = useContaDoNovoModelo(negociacaoId, token);
  return <>{backofficeAConfirmarNoNovoModelo(aPassarAClyonDaConta(conta))}</>;
}

/** A conta no «Confirmar como CLYON»: a mesma da «Conta do pagamento». */
export function ContaDoNovoModeloAoConfirmar({ negociacaoId, token }: { negociacaoId: number; token: string | null }) {
  const { conta, lida } = useContaDoNovoModelo(negociacaoId, token);
  if (!lida) return <p className="mt-2.5 text-xs text-slate-500">A ler a conta do pagamento…</p>;
  if (!conta) return <p className="mt-2.5 text-xs text-slate-500">Não foi possível ler a conta do pagamento.</p>;
  return (
    <div className="mt-2.5">
      <ContaDoPagamento conta={conta} />
    </div>
  );
}
