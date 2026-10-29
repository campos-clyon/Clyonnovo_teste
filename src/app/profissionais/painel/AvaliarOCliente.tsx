"use client";

import { useEffect, useState } from "react";

/**
 * AVALIAR O CLIENTE — dono, 29-10-2026. Depois do trabalho feito ou
 * confirmado, o profissional dá ao cliente de 1 a 5 estrelas e um comentário
 * (opcional). Uma por trabalho; depois de enviada não se altera, e o
 * profissional não volta a ver as estrelas que deu — só «Avaliação enviada».
 * O cliente vê-a em «As minhas avaliações». A mesma rota da app Pro.
 */
const ROTA = "/api/profissionais/trabalho/avaliar-cliente";

export function AvaliarOCliente({ negociacaoId }: { negociacaoId: number }) {
  const [estado, setEstado] = useState<"a_ler" | "pode" | "feita" | "nao">("a_ler");
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`${ROTA}?negociacaoId=${negociacaoId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { podeAvaliar?: boolean; jaAvaliou?: boolean } | null) => {
        if (!vivo) return;
        setEstado(d?.jaAvaliou ? "feita" : d?.podeAvaliar ? "pode" : "nao");
      })
      .catch(() => vivo && setEstado("nao"));
    return () => {
      vivo = false;
    };
  }, [negociacaoId]);

  if (estado === "a_ler" || estado === "nao") return null;
  if (estado === "feita") {
    return (
      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        Avaliação do cliente enviada. Obrigado.
      </section>
    );
  }

  async function enviar() {
    if (estrelas < 1) {
      setErro("Escolha de 1 a 5 estrelas.");
      return;
    }
    setAEnviar(true);
    setErro(null);
    try {
      const r = await fetch(ROTA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negociacaoId, estrelas, comentario: comentario.trim() || undefined }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok || r.status === 409) setEstado("feita");
      else setErro(d.error ?? "Não foi possível enviar a avaliação.");
    } catch {
      setErro("Sem ligação. Tente outra vez.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-bold text-slate-900">Como correu com o cliente?</h2>
      <p className="mt-1 text-xs text-slate-500">
        Só o cliente vê esta avaliação. Depois de enviada não se altera.
      </p>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Estrelas">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={estrelas === i}
            aria-label={`${i} ${i === 1 ? "estrela" : "estrelas"}`}
            onClick={() => setEstrelas(i)}
            className={`text-3xl leading-none ${i <= estrelas ? "text-amber-500" : "text-slate-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value.slice(0, 500))}
        maxLength={500}
        rows={3}
        placeholder="Comentário (opcional)"
        aria-label="Comentário"
        className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900"
      />
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
      <button
        type="button"
        onClick={() => void enviar()}
        disabled={aEnviar}
        className="mt-3 w-full rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {aEnviar ? "A enviar…" : "Enviar avaliação"}
      </button>
    </section>
  );
}
