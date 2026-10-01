"use client";

import { useState } from "react";
import { Check, Link2, UserPlus } from "lucide-react";
import AdminProfissionaisPanel from "@/components/admin/AdminProfissionaisPanel";
import AdminCandidaturasPanel from "@/components/admin/AdminCandidaturasPanel";
import AdminConvitesPanel from "@/components/admin/AdminConvitesPanel";

/**
 * A SECÇÃO DOS PROFISSIONAIS DO BACKOFFICE — dois botões e três separadores.
 *
 * *«Organize essa tela, coloque link em botões, está tudo sem nexo nem
 * organização.»* — 01-10-2026.
 *
 * Estava tudo numa coluna só, pela ordem em que foi sendo acrescentado: as
 * candidaturas, uma caixa com o link de entrada, o formulário de convite sempre
 * aberto, a lista dos convites, e só no fundo — depois de tudo isso — os
 * inscritos, que é o que se vem cá ver quase sempre.
 *
 * AGORA:
 *  - em cima, as duas ACÇÕES, como botões: copiar o link de entrada e convidar
 *    um profissional. O link deixou de ser uma caixa de texto para seleccionar;
 *  - por baixo, três SEPARADORES, um por lista: os inscritos, as candidaturas
 *    que chegaram pelo site, e os convites enviados. Cada um diz quantos tem
 *    por tratar, para nenhuma fila ficar escondida atrás de um separador.
 *
 * Os três painéis ficam montados e só se escondem: assim o número de cada
 * separador está certo antes de alguém lá carregar, e um formulário a meio não
 * se perde ao trocar de separador.
 */

type Aba = "inscritos" | "candidaturas" | "convites";

export default function AdminProfissionaisSeccao() {
  const [aba, setAba] = useState<Aba>("inscritos");
  const [inscritos, setInscritos] = useState<number | null>(null);
  const [porTratar, setPorTratar] = useState(0);
  const [porUsar, setPorUsar] = useState(0);
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [aConvidar, setAConvidar] = useState(false);

  function copiarLink() {
    if (!link) return;
    void navigator.clipboard?.writeText(link);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  }

  /*
   * O número de cada separador diz o que PEDE ACÇÃO, e só aparece quando há:
   * um «0» em cada separador é ruído, e um número que está sempre lá deixa de
   * se ver. Nos inscritos é o total, que é a informação daquela lista.
   */
  const ABAS: Array<{ id: Aba; rotulo: string; numero: number | null; dica: string; alerta: boolean }> = [
    { id: "inscritos", rotulo: "Inscritos", numero: inscritos, dica: "inscritos", alerta: false },
    {
      id: "candidaturas",
      rotulo: "Candidaturas",
      numero: porTratar > 0 ? porTratar : null,
      dica: "por tratar",
      alerta: porTratar > 0,
    },
    {
      id: "convites",
      rotulo: "Convites",
      numero: porUsar > 0 ? porUsar : null,
      dica: "à espera de resposta",
      alerta: false,
    },
  ];

  return (
    <section className="rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">Plataforma</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Profissionais</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Entra-se por convite ou pela candidatura do site. Aprovar dá acesso aos pedidos;
            verificar a guia deixa receber os que exigem transporte de resíduos.
          </p>
        </div>

        {/*
          AS ACÇÕES, COMO BOTÕES.

          O link de entrada era uma caixa de texto com o endereço por extenso e
          um «copiar» pequeno ao lado. É um botão: quem o quer, quer copiá-lo, e
          o endereço vai no título do botão para quem o quiser ler.
        */}
        <div className="flex flex-wrap items-center gap-2">
          {link && (
            <button
              type="button"
              onClick={copiarLink}
              title={link}
              className="flex items-center gap-2 rounded-xl border border-slate-600 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
            >
              {copiado ? (
                <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              ) : (
                <Link2 className="h-4 w-4" aria-hidden="true" />
              )}
              {copiado ? "Link copiado" : "Copiar link de entrada"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setAba("convites");
              setAConvidar(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-acao px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-acao-hover"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Convidar profissional
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Listas de profissionais" className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-700/60">
        {ABAS.map((a) => {
          const activa = aba === a.id;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              id={`separador-${a.id}`}
              aria-selected={activa}
              aria-controls={`painel-${a.id}`}
              onClick={() => setAba(a.id)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                activa
                  ? "border-cyan-400 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {a.rotulo}
              {a.numero != null && (
                <span
                  title={`${a.numero} ${a.dica}`}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    a.alerta ? "bg-amber-500/20 text-amber-200" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {a.numero}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-5">
        <div role="tabpanel" id="painel-inscritos" aria-labelledby="separador-inscritos" hidden={aba !== "inscritos"}>
          <AdminProfissionaisPanel onTotal={setInscritos} />
        </div>
        <div role="tabpanel" id="painel-candidaturas" aria-labelledby="separador-candidaturas" hidden={aba !== "candidaturas"}>
          <AdminCandidaturasPanel onPorTratar={setPorTratar} />
        </div>
        <div role="tabpanel" id="painel-convites" aria-labelledby="separador-convites" hidden={aba !== "convites"}>
          <AdminConvitesPanel
            formularioAberto={aConvidar}
            onFormulario={setAConvidar}
            onPorUsar={setPorUsar}
            onLinkDeEntrada={setLink}
          />
        </div>
      </div>
    </section>
  );
}
