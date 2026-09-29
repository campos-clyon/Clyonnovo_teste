"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * OS TRABALHOS POR TRÁS DA COMISSÃO — um por linha.
 *
 * *«Quero mais detalhes dos trabalhos feitos para saber quais trabalhos o
 * assistente fez, para justificar os valores.»* — 29-09-2026.
 *
 * O cartão dizia «4 concluídos · 22,88 €» e calava-se sobre quais. Para pagar
 * uma comissão — e para quem a recebe a poder conferir — é preciso apontar
 * para cada trabalho: que pedido, de que cliente, feito por quem, sobre que
 * valor e de onde veio esse valor, e quanto deu.
 *
 * Os concluídos vêm primeiro e são os únicos que contam. Os outros aparecem
 * por baixo, fechados, porque a pergunta seguinte é sempre «e os outros 17?».
 *
 * O CSV existe para a conversa de fim de mês: manda-se o extracto à pessoa, e
 * ela confere trabalho a trabalho sem precisar de entrar no backoffice.
 */

type FonteDoValor = "acordado" | "preco_final" | "estimativa" | "sem_valor";

type Trabalho = {
  pedidoId: number;
  estado: string;
  conta: boolean;
  cliente: string | null;
  servico: string | null;
  cidade: string | null;
  profissional: string | null;
  atribuidoEm: string | null;
  actualizadoEm: string | null;
  valor: number;
  fonteDoValor: FonteDoValor;
  comissaoClyon: number;
  comissaoAssistente: number;
};

type Detalhe = {
  nome: string;
  comissaoPercent: number;
  comissaoClyonPercent: number;
  trabalhos: Trabalho[];
  totais: { valorConcluido: number; comissaoClyon: number; comissaoAssistente: number };
};

/*
 * DE ONDE VEIO O VALOR — dito, porque é a primeira coisa que se pergunta.
 * «Acordado» é o que o profissional aceitou; «preço final» é o que a CLYON
 * fechou à mão; «estimativa» é o que o simulador calculou e ninguém confirmou
 * — e vai a âmbar, porque é o valor em que menos se deve confiar.
 */
const FONTE: Record<FonteDoValor, string> = {
  acordado: "acordado",
  preco_final: "preço final",
  estimativa: "estimativa",
  sem_valor: "sem valor",
};

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const percent = (v: number) =>
  `${Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",")} %`;
const dataCurta = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-PT");
};

export function paraCsv(d: Detalhe): string {
  const aspas = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const cabecalho = [
    "Pedido",
    "Estado",
    "Conta",
    "Cliente",
    "Serviço",
    "Localidade",
    "Profissional",
    "Atribuído em",
    "Valor",
    "Origem do valor",
    `CLYON (${d.comissaoClyonPercent} %)`,
    `${d.nome} (${d.comissaoPercent} %)`,
  ];
  const linhas = d.trabalhos.map((t) => [
    `#${t.pedidoId}`,
    t.estado,
    t.conta ? "sim" : "não",
    t.cliente,
    t.servico,
    t.cidade,
    t.profissional,
    dataCurta(t.atribuidoEm),
    num(t.valor),
    FONTE[t.fonteDoValor],
    t.conta ? num(t.comissaoClyon) : "",
    t.conta ? num(t.comissaoAssistente) : "",
  ]);
  const total = [
    "TOTAL", "", "", "", "", "", "", "",
    num(d.totais.valorConcluido),
    "",
    num(d.totais.comissaoClyon),
    num(d.totais.comissaoAssistente),
  ];
  // `;` e BOM: é assim que o Excel português abre acentos e vírgulas decimais.
  return "﻿" + [cabecalho, ...linhas, total].map((l) => l.map(aspas).join(";")).join("\r\n");
}

export default function TrabalhosDoAssistente({ id, token }: { id: number; token: string | null }) {
  const [d, setD] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState("");
  const [verOutros, setVerOutros] = useState(false);

  // Pedido à parte e só quando se abre: pode ter centenas de linhas, e o ecrã
  // das contas recarrega-se sozinho de vinte em vinte segundos.
  useEffect(() => {
    if (!token) return;
    let vivo = true;
    fetch(`/api/admin/assistentes?trabalhos=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (r) => {
        const j = await r.json();
        if (!vivo) return;
        if (!r.ok) setErro(j.error ?? "Não foi possível ler os trabalhos.");
        else setD(j);
      })
      .catch(() => {
        if (vivo) setErro("Erro de rede.");
      });
    return () => {
      vivo = false;
    };
  }, [id, token]);

  if (erro) return <p className="text-xs text-red-300">{erro}</p>;
  if (!d) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> A ler os trabalhos…
      </p>
    );
  }

  const contam = d.trabalhos.filter((t) => t.conta);
  const outros = d.trabalhos.filter((t) => !t.conta);

  function descarregar() {
    if (!d) return;
    const url = URL.createObjectURL(new Blob([paraCsv(d)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `comissao-${d.nome.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Trabalhos que contam · {contam.length}
        </p>
        <button
          onClick={descarregar}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          Descarregar CSV
        </button>
      </div>

      {contam.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhum trabalho concluído ainda — a comissão é 0 €.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1 pr-2">Pedido</th>
                <th className="py-1 pr-2">Cliente</th>
                <th className="py-1 pr-2">Profissional</th>
                <th className="py-1 pr-2 text-right">Valor</th>
                <th className="py-1 pr-2 text-right">CLYON ({percent(d.comissaoClyonPercent)})</th>
                <th className="py-1 text-right">
                  {d.nome} ({percent(d.comissaoPercent)})
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {contam.map((t) => (
                <tr key={t.pedidoId} className="border-t border-slate-800">
                  <td className="py-1.5 pr-2 font-semibold text-white">#{t.pedidoId}</td>
                  <td className="py-1.5 pr-2">
                    {t.cliente ?? "—"}
                    <span className="block text-[10px] text-slate-500">
                      {[t.servico, t.cidade, dataCurta(t.atribuidoEm)].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2">{t.profissional ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {euros(t.valor)}
                    <span
                      className={`block text-[10px] ${
                        t.fonteDoValor === "acordado" ? "text-slate-500" : "text-amber-300"
                      }`}
                    >
                      {FONTE[t.fonteDoValor]}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{euros(t.comissaoClyon)}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums text-emerald-300">
                    {euros(t.comissaoAssistente)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600 font-semibold text-white">
                <td className="py-1.5 pr-2" colSpan={3}>
                  Total
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{euros(d.totais.valorConcluido)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{euros(d.totais.comissaoClyon)}</td>
                <td className="py-1.5 text-right tabular-nums text-emerald-300">
                  {euros(d.totais.comissaoAssistente)}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-1 text-[10px] text-slate-500">
            O total calcula-se como no cartão — soma dos valores primeiro, percentagens depois — e
            por isso pode diferir um cêntimo da soma das linhas arredondadas.
          </p>
        </div>
      )}

      {outros.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setVerOutros((v) => !v)}
            className="text-xs text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
          >
            {verOutros ? "Esconder" : "Ver"} os outros {outros.length} — não contam para a comissão
          </button>
          {verOutros && (
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {outros.map((t) => (
                <li key={t.pedidoId}>
                  <span className="text-slate-400">#{t.pedidoId}</span> · {t.estado} ·{" "}
                  {t.cliente ?? "—"}
                  {t.cidade ? ` · ${t.cidade}` : ""}
                  {t.atribuidoEm ? ` · atribuído a ${dataCurta(t.atribuidoEm)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
