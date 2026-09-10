"use client";

import { useState } from "react";
import { AlertTriangle, ChevronRight, Sparkles } from "lucide-react";
import type { Falta, ResumoDoPerfil, SeccaoComFalta } from "@/lib/perfil-por-completar";

/**
 * O QUE FALTA NO PERFIL, À CABEÇA DO MENU.
 *
 * Um perfil a meio não dá erro nenhum — dá silêncio. Não chegam pedidos, as
 * distâncias saem erradas, o valor sugerido é o de um profissional médio. Nada
 * disto se vê de lado nenhum: a conta parece a funcionar.
 *
 * Este cartão é o único sítio onde esse silêncio ganha voz. Fica ao pé do
 * topo, antes dos trabalhos, e desaparece sozinho quando não faltar nada — um
 * aviso que fica para sempre deixa de ser um aviso.
 *
 * CADA LINHA DIZ O QUE ACONTECE, E NÃO O QUE É OBRIGATÓRIO. «O NIF é
 * obrigatório» é uma ordem sem razão, e quem a lê adia. «Quem recebe dinheiro
 * tem de estar identificado» explica-se a si próprio — e quem percebe, faz.
 *
 * DUAS ALTURAS. Os travões (não recebe pedidos, não há como lhe pagar) estão
 * sempre à vista; as melhorias — os custos que tornam a sugestão a conta dele
 * — nascem fechadas. Um cartão que grita por causa de uma margem por escolher
 * ensina a ignorar o cartão, e no dia em que falta o IBAN já ninguém olha.
 */

function Linha({
  falta,
  onAbrir,
}: {
  falta: Falta;
  onAbrir: (seccao: SeccaoComFalta) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(falta.seccao)}
      className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-amber-100/60 active:bg-amber-100"
    >
      <AlertTriangle
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          falta.peso === "essencial" ? "text-amber-600" : "text-slate-400"
        }`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#0B1929]">{falta.rotulo}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{falta.porque}</span>
      </span>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    </button>
  );
}

export default function PerfilPorCompletar({
  resumo,
  onAbrir,
  onComoFunciona,
}: {
  resumo: ResumoDoPerfil;
  onAbrir: (seccao: SeccaoComFalta) => void;
  /** Abre o ecrã que explica o que cada campo faz à conta. */
  onComoFunciona?: () => void;
}) {
  const [verTudo, setVerTudo] = useState(false);

  // Nada a dizer é a melhor notícia que este cartão pode dar. Diz-se
  // desaparecendo: um parabéns permanente ocupa o lugar dos trabalhos.
  if (resumo.completo) return null;

  const { essenciais, melhorias, percentagem } = resumo;
  const temTravao = essenciais.length > 0;
  const aMostrar = verTudo ? [...essenciais, ...melhorias] : essenciais.length > 0 ? essenciais : melhorias.slice(0, 2);
  const escondidas = (verTudo ? 0 : essenciais.length > 0 ? melhorias.length : Math.max(0, melhorias.length - 2));

  return (
    <section
      className={`mb-4 rounded-2xl border p-4 shadow-sm ${
        temTravao ? "border-amber-300 bg-amber-50" : "border-[#E2EEF3] bg-white"
      }`}
      aria-labelledby="perfil-por-completar"
    >
      <div className="flex items-start gap-2.5">
        {temTravao ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        ) : (
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <h2 id="perfil-por-completar" className="text-sm font-bold text-[#0B1929]">
            {temTravao ? "Falta terminar o seu perfil" : "Dê-nos os seus números"}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            {temTravao
              ? "Enquanto isto faltar, há coisas que não acontecem — e não há nada que o avise."
              : "A sugestão de valor de cada pedido está a usar a referência da CLYON. Com os seus custos, passa a ser a sua conta."}
          </p>
        </div>
      </div>

      {/*
        A BARRA MOSTRA O QUE JÁ ESTÁ FEITO, e não o que falta.

        Um perfil quase pronto com uma barra quase vazia é desânimo por engano.
        A percentagem conta só as perguntas que lhe foram MESMO feitas: quem
        diz que não emite guia de transporte não é penalizado por não ter o
        número de transportador.
      */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-slate-600">
            {resumo.feitos} de {resumo.total} preenchidos
          </span>
          <span className={`font-bold ${temTravao ? "text-amber-700" : "text-cyan-700"}`}>
            {percentagem} %
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${
              temTravao ? "bg-amber-500" : "bg-cyan-600"
            }`}
            style={{ width: `${percentagem}%` }}
          />
        </div>
      </div>

      <div className="mt-2 space-y-0.5">
        {aMostrar.map((f) => (
          <Linha key={f.chave} falta={f} onAbrir={onAbrir} />
        ))}
      </div>

      {escondidas > 0 && (
        <button
          type="button"
          onClick={() => setVerTudo(true)}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition active:bg-slate-100"
        >
          Ver mais {escondidas}{" "}
          {escondidas === 1 ? "campo por preencher" : "campos por preencher"}
        </button>
      )}

      {onComoFunciona && (
        <button
          type="button"
          onClick={onComoFunciona}
          className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-semibold text-cyan-700 underline-offset-2 hover:underline"
        >
          Ver como funciona a plataforma
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
