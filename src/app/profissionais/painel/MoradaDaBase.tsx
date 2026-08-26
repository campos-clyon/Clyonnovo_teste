"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Check } from "lucide-react";
import { useGooglePlaces, type PlacePrediction } from "@/hooks/useGooglePlaces";

/**
 * A morada da base, escolhida de uma lista — e não escrita à sorte.
 *
 * "Por algum motivo a minha conta de teste está a marcar endereço errado.
 * Porque não tem autocomplete?"
 *
 * Era exactamente isso. O campo chamava-se «Cidade de base» e era uma caixa de
 * texto vazia: aceitava «Rua dos Jasmins Amora», e o servidor localizava aquela
 * frase como se fosse o nome de uma terra. O resultado foram coordenadas em
 * Palmela para um profissional de Amora — e a partir daí TODAS as distâncias
 * dele saíram erradas, sem nada no ecrã a dizê-lo.
 *
 * O Fred aparecia a 5,6 km de um trabalho em Setúbal que fica a 33 km da casa
 * dele. Não era a conta que estava errada; era o ponto de partida.
 *
 * DUAS COISAS MUDAM AQUI
 *
 * A morada passa a ser ESCOLHIDA de uma lista, o que significa que existe. E
 * as coordenadas passam a vir com ela, do Google, em vez de serem adivinhadas
 * a partir do texto — que é o passo onde se perdiam.
 *
 * Escrever à mão continua a ser possível: quem tem uma morada que a lista não
 * conhece não pode ficar preso. Mas fica dito, com todas as letras, que sem
 * escolher da lista a base é uma aproximação.
 */

export type BaseEscolhida = {
  morada: string;
  lat: number | null;
  lng: number | null;
};

export default function MoradaDaBase({
  valor,
  lat,
  lng,
  onMudar,
  className = "",
}: {
  valor: string;
  lat?: number | null;
  lng?: number | null;
  onMudar: (b: BaseEscolhida) => void;
  className?: string;
}) {
  const places = useGooglePlaces();
  const [sugestoes, setSugestoes] = useState<PlacePrediction[]>([]);
  const [aberto, setAberto] = useState(false);
  const [aProcurar, setAProcurar] = useState(false);
  const [aResolver, setAResolver] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const atraso = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Escolhida da lista: temos coordenadas do Google, não de um palpite. */
  const confirmada = lat != null && lng != null;

  useEffect(() => {
    const foraDaCaixa = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", foraDaCaixa);
    return () => document.removeEventListener("mousedown", foraDaCaixa);
  }, []);

  const escrever = (texto: string) => {
    /*
     * Escrever apaga as coordenadas.
     *
     * Sem isto, mudar a morada e não escolher da lista deixava as coordenadas
     * ANTIGAS coladas a uma morada nova — que é a pior combinação possível:
     * um ecrã a dizer «confirmada» sobre um ponto que já não é aquele.
     */
    onMudar({ morada: texto, lat: null, lng: null });

    if (atraso.current) clearTimeout(atraso.current);
    if (texto.trim().length < 3) {
      setSugestoes([]);
      setAberto(false);
      return;
    }
    atraso.current = setTimeout(async () => {
      setAProcurar(true);
      try {
        const r = await places.search(texto);
        setSugestoes(r);
        setAberto(r.length > 0);
      } finally {
        setAProcurar(false);
      }
    }, 320);
  };

  const escolher = async (p: PlacePrediction) => {
    setAberto(false);
    setAResolver(true);
    try {
      const r = p.resolved ?? (await places.resolve(p));
      if (!r) {
        // Sem coordenadas, fica o texto — e o aviso por baixo diz o que falta.
        onMudar({ morada: p.description, lat: null, lng: null });
        return;
      }
      onMudar({
        morada: r.formattedAddress || p.description,
        lat: r.lat,
        lng: r.lng,
      });
    } finally {
      setAResolver(false);
    }
  };

  return (
    <div ref={caixa} className="relative">
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          className={`${className} pl-9 pr-9`}
          value={valor}
          onChange={(e) => escrever(e.target.value)}
          onFocus={() => sugestoes.length > 0 && setAberto(true)}
          placeholder="Escreva a rua e escolha da lista"
          autoComplete="off"
        />
        {(aProcurar || aResolver) && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400"
            aria-hidden="true"
          />
        )}
        {!aProcurar && !aResolver && confirmada && (
          <Check
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600"
            aria-hidden="true"
          />
        )}
      </div>

      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {sugestoes.map((s) => (
            <li key={s.placeId || s.description}>
              <button
                type="button"
                onClick={() => escolher(s)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {s.mainText || s.description}
                  </span>
                  {s.secondaryText && (
                    <span className="block truncate text-xs text-slate-500">{s.secondaryText}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/*
        O estado da base, dito sem rodeios.

        É daqui que sai a distância a todos os trabalhos. Quando não está
        confirmada, ele tem de saber ANTES de reparar que os quilómetros não
        batem certo — que foi como isto se descobriu.
      */}
      {valor.trim().length > 0 && (
        <p
          className={`mt-1.5 text-xs leading-relaxed ${
            confirmada ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {confirmada
            ? "Base confirmada no mapa. É daqui que contamos a distância a cada trabalho."
            : "Ainda não escolheu da lista. Escolha, para a base ficar no sítio certo — todas as distâncias que vê saem daqui."}
        </p>
      )}
    </div>
  );
}
