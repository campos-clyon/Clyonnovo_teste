"use client";

import { useEffect, useState } from "react";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";

/**
 * OS DIAS EM QUE NÃO PODE TRABALHAR — d35, 15-11-2026.
 *
 * Na agenda, o profissional marca um dia inteiro, vários dias seguidos ou umas
 * horas de um dia. Os pedidos novos com data certa nesses dias não lhe chegam;
 * os de data vaga chegam, com uma nota. Marcar em cima de um trabalho já
 * marcado pergunta primeiro — o trabalho continua marcado.
 *
 * A rota é a mesma da app Pro: /api/profissionais/indisponibilidades.
 */

type Linha = { id: number; texto: string; nota: string | null };

export default function Indisponibilidades() {
  const [lista, setLista] = useState<Linha[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [dia, setDia] = useState("");
  const [ate, setAte] = useState("");
  const [soHoras, setSoHoras] = useState(false);
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("13:00");
  const [nota, setNota] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch("/api/profissionais/indisponibilidades")
      .then((r) => (r.ok ? r.json() : { indisponibilidades: [] }))
      .then((d) => {
        if (vivo) setLista(d.indisponibilidades ?? []);
      })
      .catch(() => {
        if (vivo) setLista([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function marcar(confirmar = false) {
    setAGravar(true);
    setErro("");
    try {
      const corpo = soHoras
        ? { dia, inicio, fim, nota, confirmar }
        : { dia, ate: ate || dia, nota, confirmar };
      const res = await fetch("/api/profissionais/indisponibilidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await res.json();
      if (res.status === 409 && d.precisaConfirmar) {
        const quais = (d.trabalhos ?? []).map((t: { pedidoId: number }) => `#${t.pedidoId}`).join(", ");
        if (window.confirm(`${d.pergunta}\n\nTrabalhos: ${quais}`)) return marcar(true);
        return;
      }
      if (!res.ok) {
        setErro(d.error ?? "Não foi possível marcar.");
        return;
      }
      setLista(d.indisponibilidades ?? []);
      setAberto(false);
      setDia("");
      setAte("");
      setNota("");
    } catch {
      setErro("Erro de rede. Tente outra vez.");
    } finally {
      setAGravar(false);
    }
  }

  async function desmarcar(id: number) {
    setErro("");
    try {
      const res = await fetch(`/api/profissionais/indisponibilidades?id=${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) {
        setErro(d.error ?? "Não foi possível desmarcar.");
        return;
      }
      setLista(d.indisponibilidades ?? []);
    } catch {
      setErro("Erro de rede. Tente outra vez.");
    }
  }

  const hoje = diaEmLisboa(new Date());
  const campo = "h-10 rounded-lg border border-[#E2EEF3] bg-white px-2.5 text-sm text-tinta";

  return (
    <section className="mb-4 rounded-2xl border border-[#E2EEF3] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-tinta">Dias em que não pode trabalhar</h2>
        {!aberto && (
          <button
            type="button"
            onClick={() => {
              setAberto(true);
              setDia(hoje);
            }}
            className="cursor-pointer rounded-lg border border-[#E2EEF3] bg-white px-3 py-1.5 text-sm font-semibold text-acao"
          >
            Marcar indisponível
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-tinta-fraca">
        Os pedidos novos para esses dias não lhe chegam. Os que não têm dia certo chegam, com um aviso.
      </p>

      {lista && lista.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {lista.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 text-sm text-tinta">
              <span>
                {l.texto}
                {l.nota && <span className="text-tinta-fraca"> · {l.nota}</span>}
              </span>
              <button
                type="button"
                onClick={() => void desmarcar(l.id)}
                className="cursor-pointer border-none bg-transparent text-xs font-semibold text-acao underline-offset-4 hover:underline"
              >
                Desmarcar
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3 text-sm text-tinta">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={!soHoras} onChange={() => setSoHoras(false)} /> Dias inteiros
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={soHoras} onChange={() => setSoHoras(true)} /> Umas horas de um dia
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs text-tinta-fraca">
              {soHoras ? "Dia" : "De"}
              <input type="date" min={hoje} value={dia} onChange={(e) => setDia(e.target.value)} className={campo} />
            </label>
            {soHoras ? (
              <>
                <label className="flex flex-col text-xs text-tinta-fraca">
                  Das
                  <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
                </label>
                <label className="flex flex-col text-xs text-tinta-fraca">
                  Às
                  <input type="time" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
                </label>
              </>
            ) : (
              <label className="flex flex-col text-xs text-tinta-fraca">
                Até (opcional)
                <input type="date" min={dia || hoje} value={ate} onChange={(e) => setAte(e.target.value)} className={campo} />
              </label>
            )}
          </div>
          <label className="flex flex-col text-xs text-tinta-fraca">
            Nota (só para si e para a equipa)
            <input
              type="text"
              maxLength={200}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className={campo}
              placeholder="Ex.: férias"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={aGravar || !dia}
              onClick={() => void marcar()}
              className="cursor-pointer rounded-lg border-none bg-acao px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {aGravar ? "A marcar…" : "Marcar"}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="cursor-pointer rounded-lg border border-[#E2EEF3] bg-white px-4 py-2 text-sm text-tinta"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {erro && <p className="mt-2 text-xs text-rose-600">{erro}</p>}
    </section>
  );
}
