"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Star } from "lucide-react";
import type { AddressData, MovingAccess } from "../types";
import type { CartaoDoParceiro } from "@/lib/lista-de-parceiros-da-mudanca";

/**
 * «PARCEIROS DISPONÍVEIS PARA A SUA MUDANÇA» — 10-11-2026 (fase 2).
 *
 * Depois das perguntas da mudança e das moradas, o cliente vê os parceiros com
 * preço para a zona dele, escolhe a equipa (2 ou 3 pessoas) e até três
 * parceiros, e carrega em «Pedir orçamento» — só aí se pedem os contactos.
 *
 * Os números e os textos vêm TODOS da rota (`POST /api/mudancas/parceiros`):
 * este ecrã não faz contas, como a app de cliente também não vai fazer.
 */

export type EscolhaDaMudanca = {
  ids: string[];
  nomes: string[];
  pessoas: 2 | 3;
  procurarMais: boolean;
};

type RespostaDaLista = {
  ok: boolean;
  ligado?: boolean;
  error?: string;
  resumo?: string;
  recomendaTres?: string | null;
  maximoDeEscolhidos?: number;
  parceiros?: CartaoDoParceiro[];
  semParceiros?: string | null;
  ordenacao?: { titulo: string; frase: string };
  textos?: {
    titulo: string;
    escolha: string;
    semParceirosSegue: string;
    procurarMais: string;
    botao: string;
    notaDaEstimativa: string;
    quemFaz: string;
  };
};

export default function ParceirosDaMudanca({
  origem,
  destino,
  tipologia,
  origemAcesso,
  destinoAcesso,
  inicial,
  onPedir,
  onSemLista,
}: {
  origem?: AddressData;
  destino?: AddressData;
  tipologia?: string;
  origemAcesso?: MovingAccess;
  destinoAcesso?: MovingAccess;
  inicial: EscolhaDaMudanca | null;
  onPedir: (e: EscolhaDaMudanca) => void;
  /** Sem lista (desligada, sem parceiros, ou a rota falhou): segue o caminho de sempre. */
  onSemLista: () => void;
}) {
  const [pessoas, setPessoas] = useState<2 | 3>(inicial?.pessoas ?? 2);
  const [resposta, setResposta] = useState<RespostaDaLista | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [escolhidos, setEscolhidos] = useState<string[]>(inicial?.ids ?? []);
  const [procurarMais, setProcurarMais] = useState(inicial?.procurarMais ?? false);
  const semLista = useRef(onSemLista);
  semLista.current = onSemLista;

  const desmontagem = origemAcesso?.difficultAccess === true || destinoAcesso?.difficultAccess === true;

  useEffect(() => {
    let vivo = true;
    setACarregar(true);
    void (async () => {
      try {
        const r = await fetch("/api/mudancas/parceiros", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origem: { lat: origem?.lat, lng: origem?.lng, morada: origem?.formattedAddress, cidade: origem?.city },
            destino: { lat: destino?.lat, lng: destino?.lng, morada: destino?.formattedAddress, cidade: destino?.city },
            tipologia: tipologia || null,
            desmontagem,
            pessoas,
          }),
        });
        const j = (await r.json().catch(() => ({ ok: false }))) as RespostaDaLista;
        if (!vivo) return;
        // Desligada ou a falhar: o pedido segue como sempre, sem lista.
        if (!r.ok || !j.ok || j.ligado === false) {
          semLista.current();
          return;
        }
        setResposta(j);
        // Quem já não está na lista (mudou a equipa) sai da escolha.
        setEscolhidos((atual) => atual.filter((id) => j.parceiros?.some((p) => p.id === id)));
      } catch {
        if (vivo) semLista.current();
      } finally {
        if (vivo) setACarregar(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [origem?.lat, origem?.lng, origem?.formattedAddress, destino?.lat, destino?.lng, destino?.formattedAddress, tipologia, desmontagem, pessoas]);

  const maximo = resposta?.maximoDeEscolhidos ?? 3;
  const parceiros = resposta?.parceiros ?? [];
  const textos = resposta?.textos;

  const alternar = (id: string) =>
    setEscolhidos((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : atual.length >= maximo ? atual : [...atual, id],
    );

  const pedir = () => {
    const nomes = parceiros.filter((p) => escolhidos.includes(p.id)).map((p) => p.nome);
    onPedir({ ids: escolhidos, nomes, pessoas, procurarMais: parceiros.length === 1 && procurarMais });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{textos?.titulo ?? "Parceiros disponíveis para a sua mudança"}</h2>
        {resposta?.resumo && <p className="mt-1 text-sm text-gray-600">{resposta.resumo}</p>}
      </div>

      <div>
        <div className="inline-flex rounded-xl border border-gray-300 bg-white p-1" role="group" aria-label="Pessoas na equipa">
          {([2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPessoas(n)}
              aria-pressed={pessoas === n}
              className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold transition ${
                pessoas === n ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {n} pessoas
            </button>
          ))}
        </div>
        {resposta?.recomendaTres && <p className="mt-2 text-sm text-amber-800">{resposta.recomendaTres}</p>}
      </div>

      {aCarregar && (
        <p className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A procurar parceiros para estas moradas…
        </p>
      )}

      {!aCarregar && resposta && parceiros.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">{resposta.semParceiros}</p>
          <p className="mt-1 text-sm text-gray-700">{textos?.semParceirosSegue}</p>
          <button
            type="button"
            onClick={onSemLista}
            className="mt-3 min-h-[44px] rounded-xl bg-acao px-5 text-sm font-semibold text-white hover:bg-acao-hover"
          >
            Continuar
          </button>
        </div>
      )}

      {!aCarregar && parceiros.length > 0 && (
        <>
          <p className="text-sm text-gray-700">{textos?.escolha}</p>
          <ul className="list-none space-y-3 p-0">
            {parceiros.map((p) => {
              const marcado = escolhidos.includes(p.id);
              const cheio = !marcado && escolhidos.length >= maximo;
              const hora = pessoas === 3 ? p.precoHora[3] : p.precoHora[2];
              return (
                <li key={p.id}>
                  <label
                    className={`block cursor-pointer rounded-2xl border bg-white p-4 transition ${
                      marcado ? "border-blue-600 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"
                    } ${cheio ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={cheio}
                        onChange={() => alternar(p.id)}
                        className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
                      />
                      {p.fotografia && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.fotografia}
                          alt=""
                          loading="lazy"
                          className="h-16 w-16 shrink-0 rounded-xl border border-gray-200 object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <p className="text-base font-semibold text-gray-900">{p.nome}</p>
                          <p className="text-right text-sm font-bold text-gray-900">{p.estimativa.texto}</p>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                          {p.selo && <span className="font-semibold text-emerald-700">{p.selo}</span>}
                          {p.nota ? (
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                              {p.nota.texto}
                            </span>
                          ) : (
                            <span>{p.novo}</span>
                          )}
                        </p>
                        {/* A nota do Google (11-11-2026): noutra linha, nunca misturada com a da CLYON, com a atribuição. */}
                        {p.notaGoogle && (
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-600">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                            <span>{p.notaGoogle.texto}</span>
                            <span className="text-[11px] font-medium text-gray-500">· {p.notaGoogle.atribuicao}</span>
                          </p>
                        )}
                        <dl className="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-700 sm:grid-cols-2">
                          {hora && (
                            <div>
                              <dt className="sr-only">Preço da hora</dt>
                              <dd>
                                {hora.texto} · equipa de {pessoas}
                              </dd>
                            </div>
                          )}
                          <div>
                            <dt className="sr-only">Horas</dt>
                            <dd>
                              {p.horasTexto} · {p.minimoTexto.toLowerCase()}
                            </dd>
                          </div>
                        </dl>
                        <details className="mt-2 text-sm text-gray-700">
                          <summary className="cursor-pointer text-blue-700">{p.kit.texto}</summary>
                          {p.materiais.length > 0 && (
                            <ul className="mt-2 list-none space-y-0.5 p-0 text-xs text-gray-600">
                              {p.materiais.map((m) => (
                                <li key={m.chave}>
                                  {m.nome}: {m.texto}
                                </li>
                              ))}
                            </ul>
                          )}
                          {p.kit.total && <p className="mt-1 text-xs text-gray-600">Com o kit: {p.estimativaComKit.texto}</p>}
                        </details>
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          {parceiros.length === 1 && (
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={procurarMais}
                onChange={(e) => setProcurarMais(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              {textos?.procurarMais}
            </label>
          )}

          <p className="text-xs leading-relaxed text-gray-600">
            {textos?.notaDaEstimativa} {textos?.quemFaz}
          </p>
          {resposta?.ordenacao && (
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer font-medium text-gray-700">{resposta.ordenacao.titulo}</summary>
              <p className="mt-1 leading-relaxed">{resposta.ordenacao.frase}</p>
            </details>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={pedir}
              disabled={escolhidos.length === 0}
              className="min-h-[48px] min-w-[200px] rounded-xl bg-acao px-6 text-sm font-semibold text-white transition-colors hover:bg-acao-hover disabled:bg-gray-400"
            >
              {textos?.botao ?? "Pedir orçamento"}
              {escolhidos.length > 0 ? ` (${escolhidos.length})` : ""}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
