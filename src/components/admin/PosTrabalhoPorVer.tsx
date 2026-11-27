"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AvaliarPelaClyon from "@/components/admin/AvaliarPelaClyon";
import { pecasEmLisboa } from "@/lib/hora-de-lisboa";

/**
 * DEPOIS DO TRABALHO, NUM CONCLUÍDO «POR VER» — d147 (27-11-2026, dono).
 *
 * A pergunta que se fez ao cliente depois do trabalho e a resposta dele, lidas
 * sozinhas da conversa do WhatsApp desse número (`pos-trabalho.ts`). Dois
 * botões, e os dois tiram o realce «por ver»:
 *   · «Guardar a resposta» — abre o «Dar a nota como CLYON» que já existe, com
 *     o texto do cliente e o «Por WhatsApp a DD/MM» já escritos.
 *   · «Sem resposta do cliente — fechar» — fica uma nota interna no pedido.
 *     Não é uma avaliação: nada de estrelas, nada no site nem no perfil.
 */

type Item = {
  pedidoId: number;
  pergunta: { texto: string; em: string } | null;
  resposta: { texto: string; em: string } | null;
  estrelas: number | null;
  comoDisse: string | null;
};

const dois = (n: number) => String(n).padStart(2, "0");
function quando(iso: string): string {
  const p = pecasEmLisboa(new Date(iso));
  return `${dois(p.dia)}/${dois(p.mes)} às ${dois(p.hora)}:${dois(p.minuto)}`;
}

export const DICA_DAS_ESTRELAS =
  "Escolha as estrelas só se o cliente deu uma nota ou disse claramente como correu. Se não, feche sem resposta.";

export default function PosTrabalhoPorVer({
  pedidoId,
  profissionalNome,
  podeGuardar,
  guardar,
  onFechado,
}: {
  pedidoId: number;
  profissionalNome: string;
  /** A CLYON pode dar a nota por este cliente, e o trabalho ainda não a tem. */
  podeGuardar: boolean;
  /** Grava a nota pela rota de quem desenha (a Mesa ou os Trabalhos CLYON). Devolve o erro, ou `null`. */
  guardar: (estrelas: number, comentario: string | undefined, comoDisse: string) => Promise<string | null>;
  /** O «por ver» fechou: quem desenha tira o realce já. */
  onFechado: () => void;
}) {
  const { token } = useAdminAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [aLer, setALer] = useState(true);
  const [aGuardar, setAGuardar] = useState(false);
  const [aFechar, setAFechar] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    setALer(true);
    fetch(`/api/admin/negociacoes/pos-trabalho?ids=${pedidoId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { itens?: Item[] }) => {
        if (vivo) setItem((d.itens ?? []).find((i) => i.pedidoId === pedidoId) ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setALer(false);
      });
    return () => {
      vivo = false;
    };
  }, [token, pedidoId]);

  async function fechar(accao: "guardada" | "sem_resposta"): Promise<boolean> {
    if (!token) return false;
    setAFechar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/pos-trabalho", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId, accao }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErro(d.error ?? "Não foi possível fechar.");
        return false;
      }
      onFechado();
      return true;
    } catch {
      setErro("Erro de rede.");
      return false;
    } finally {
      setAFechar(false);
    }
  }

  return (
    <div className="mt-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2 text-xs">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Depois do trabalho</p>
      {aLer ? (
        <p className="mt-1 text-slate-400">A ler a conversa do WhatsApp…</p>
      ) : !item?.pergunta ? (
        <p className="mt-1 text-slate-400">Não há pedido de avaliação na conversa do WhatsApp deste número.</p>
      ) : (
        <>
          <p className="mt-1 text-slate-400">
            Perguntámos a {quando(item.pergunta.em)}:{" "}
            <span className="whitespace-pre-line text-slate-200">«{item.pergunta.texto.slice(0, 280)}»</span>
          </p>
          {item.resposta ? (
            <p className="mt-1 text-slate-400">
              O cliente respondeu a {quando(item.resposta.em)}:{" "}
              <span className="whitespace-pre-line font-semibold text-white">«{item.resposta.texto}»</span>
              {item.estrelas != null && <span className="text-amber-300"> · deu {item.estrelas} de 5</span>}
            </p>
          ) : (
            <p className="mt-1 text-slate-400">O cliente ainda não respondeu na conversa.</p>
          )}
        </>
      )}

      {!aGuardar && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {podeGuardar && (
            <button
              type="button"
              onClick={() => setAGuardar(true)}
              disabled={aFechar}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
            >
              Guardar a resposta
            </button>
          )}
          <button
            type="button"
            onClick={() => void fechar("sem_resposta")}
            disabled={aFechar}
            className="rounded-lg border border-slate-600 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-800/60 disabled:opacity-40"
          >
            {aFechar ? "A fechar…" : "Sem resposta do cliente — fechar"}
          </button>
          {!podeGuardar && (
            <span className="text-[11px] text-slate-500">A nota é do cliente, pela ligação que recebeu.</span>
          )}
        </div>
      )}

      {aGuardar && podeGuardar && (
        <>
          <AvaliarPelaClyon
            profissionalNome={profissionalNome}
            inicial={{
              estrelas: item?.estrelas ?? null,
              comentario: item?.resposta?.texto ?? "",
              comoDisse: item?.comoDisse ?? "",
            }}
            dica={DICA_DAS_ESTRELAS}
            guardar={async (estrelas, comentario, comoDisse) => {
              const falhou = await guardar(estrelas, comentario, comoDisse);
              if (falhou) return falhou;
              // A nota ficou gravada; o «por ver» fecha-se a seguir (se falhar, abrir o cartão volta a fechá-lo).
              await fechar("guardada");
              return null;
            }}
            onMudou={() => setAGuardar(false)}
          />
          <button
            type="button"
            onClick={() => setAGuardar(false)}
            className="mt-1.5 text-[11px] text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
          >
            Voltar
          </button>
        </>
      )}

      {erro && <p className="mt-1.5 text-red-300">{erro}</p>}
    </div>
  );
}
