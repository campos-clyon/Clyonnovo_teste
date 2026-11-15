"use client";

import { useEffect, useState } from "react";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";
import {
  corpoDaMarcacao,
  perguntaDoTrabalhoMarcado,
  ROTA_DAS_INDISPONIBILIDADES,
  TEXTOS_DA_INDISPONIBILIDADE as T,
  trabalhosEmCimaPorExtenso,
} from "@/lib/textos-da-indisponibilidade";

/**
 * OS DIAS EM QUE NÃO PODE TRABALHAR — d35, 15-11-2026.
 *
 * Na agenda, o profissional marca um dia inteiro, vários dias seguidos ou umas
 * horas de um dia. Os pedidos novos com data certa nesses dias não lhe chegam;
 * os de data vaga chegam, com uma nota. Marcar em cima de um trabalho já
 * marcado pergunta primeiro — o trabalho continua marcado.
 *
 * A rota, as frases e o pedido são os da app Pro: `textos-da-indisponibilidade.ts`.
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
    fetch(ROTA_DAS_INDISPONIBILIDADES)
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
      const corpo = corpoDaMarcacao({ soHoras, dia, ate, inicio, fim, nota }, confirmar);
      const res = await fetch(ROTA_DAS_INDISPONIBILIDADES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await res.json();
      const pergunta = perguntaDoTrabalhoMarcado(res.status, d);
      if (pergunta) {
        if (window.confirm(`${pergunta.pergunta}\n\n${trabalhosEmCimaPorExtenso(pergunta.trabalhos)}`)) return marcar(true);
        return;
      }
      if (!res.ok) {
        setErro(d.error ?? T.naoMarcou);
        return;
      }
      setLista(d.indisponibilidades ?? []);
      setAberto(false);
      setDia("");
      setAte("");
      setNota("");
    } catch {
      setErro(T.erroDeRede);
    } finally {
      setAGravar(false);
    }
  }

  async function desmarcar(id: number) {
    setErro("");
    try {
      const res = await fetch(`${ROTA_DAS_INDISPONIBILIDADES}?id=${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) {
        setErro(d.error ?? T.naoDesmarcou);
        return;
      }
      setLista(d.indisponibilidades ?? []);
    } catch {
      setErro(T.erroDeRede);
    }
  }

  const hoje = diaEmLisboa(new Date());
  const campo = "h-10 rounded-lg border border-[#E2EEF3] bg-white px-2.5 text-sm text-tinta";

  return (
    <section className="mb-4 rounded-2xl border border-[#E2EEF3] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-tinta">{T.titulo}</h2>
        {!aberto && (
          <button
            type="button"
            onClick={() => {
              setAberto(true);
              setDia(hoje);
            }}
            className="cursor-pointer rounded-lg border border-[#E2EEF3] bg-white px-3 py-1.5 text-sm font-semibold text-acao"
          >
            {T.marcarIndisponivel}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-tinta-fraca">
        {T.explicacao}
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
                {T.desmarcar}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3 text-sm text-tinta">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={!soHoras} onChange={() => setSoHoras(false)} /> {T.diasInteiros}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={soHoras} onChange={() => setSoHoras(true)} /> {T.umasHoras}
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs text-tinta-fraca">
              {soHoras ? T.dia : T.de}
              <input type="date" min={hoje} value={dia} onChange={(e) => setDia(e.target.value)} className={campo} />
            </label>
            {soHoras ? (
              <>
                <label className="flex flex-col text-xs text-tinta-fraca">
                  {T.das}
                  <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
                </label>
                <label className="flex flex-col text-xs text-tinta-fraca">
                  {T.as}
                  <input type="time" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
                </label>
              </>
            ) : (
              <label className="flex flex-col text-xs text-tinta-fraca">
                {T.ateOpcional}
                <input type="date" min={dia || hoje} value={ate} onChange={(e) => setAte(e.target.value)} className={campo} />
              </label>
            )}
          </div>
          <label className="flex flex-col text-xs text-tinta-fraca">
            {T.nota}
            <input
              type="text"
              maxLength={200}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className={campo}
              placeholder={T.exemploDaNota}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={aGravar || !dia}
              onClick={() => void marcar()}
              className="cursor-pointer rounded-lg border-none bg-acao px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {aGravar ? T.aMarcar : T.marcar}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="cursor-pointer rounded-lg border border-[#E2EEF3] bg-white px-4 py-2 text-sm text-tinta"
            >
              {T.cancelar}
            </button>
          </div>
        </div>
      )}
      {erro && <p className="mt-2 text-xs text-rose-600">{erro}</p>}
    </section>
  );
}
