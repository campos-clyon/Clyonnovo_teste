"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { dataEHoraEmLisboa } from "@/lib/hora-de-lisboa";
import { METODOS_DO_PROFISSIONAL, type EntradaDoDinheiro } from "@/lib/pagamento-da-divida";

/**
 * O DINHEIRO DE UM PROFISSIONAL, NAS DUAS DIRECÇÕES — 01-11-2026 (dono).
 *
 * O histórico (o que a CLYON lhe transferiu, o que ele pagou à CLYON, o
 * cliente a pagar-lhe em mão e o acerto de 01/11/2026) e, só para o
 * administrador, «Registar pagamento do profissional à CLYON»: valor, método
 * e nota, que ficam no registo permanente e no histórico de cada pedido.
 */

const euros = (v: number) => v.toFixed(2).replace(".", ",") + " €";

const DIRECCAO: Record<EntradaDoDinheiro["direccao"], { rotulo: string; cor: string }> = {
  clyon_para_profissional: { rotulo: "CLYON → profissional", cor: "text-emerald-300" },
  profissional_para_clyon: { rotulo: "Profissional → CLYON", cor: "text-cyan-300" },
  cliente_para_profissional: { rotulo: "Cliente → profissional", cor: "text-amber-300" },
  acerto: { rotulo: "Acerto", cor: "text-slate-300" },
};

export default function DinheiroDoProfissional({
  providerId,
  nome,
  deve,
  token,
  podeRegistar,
  onFechar,
  onRegistado,
}: {
  providerId: number;
  nome: string;
  /** O que deve hoje à CLYON — o valor que o formulário sugere. */
  deve: number;
  token: string | null;
  podeRegistar: boolean;
  onFechar: () => void;
  onRegistado: () => void;
}) {
  const [entradas, setEntradas] = useState<EntradaDoDinheiro[] | null>(null);
  const [erroDoHistorico, setErroDoHistorico] = useState("");
  const [valor, setValor] = useState(deve > 0 ? deve.toFixed(2).replace(".", ",") : "");
  const [metodo, setMetodo] = useState<string>(METODOS_DO_PROFISSIONAL[0].id);
  const [nota, setNota] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/carteiras/historico?profissional=${providerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErroDoHistorico(dados.error ?? "Não foi possível ler o histórico.");
        return;
      }
      setEntradas(dados.entradas ?? []);
      setErroDoHistorico("");
    } catch {
      setErroDoHistorico("Erro de rede.");
    }
  }, [providerId, token]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function registar() {
    if (!token) return;
    setAGravar(true);
    setErro("");
    setFeito("");
    try {
      const res = await fetch("/api/admin/carteiras/pagamento-do-profissional", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, valor, metodo, nota }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível registar.");
        return;
      }
      setFeito(`Registado: ${euros(Number(dados.total ?? 0))} pagos à CLYON.`);
      setNota("");
      setValor("");
      await ler();
      onRegistado();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <h3 className="font-[Poppins] text-lg font-bold text-white">O dinheiro de {nome}</h3>
        <p className="mt-1 text-sm text-slate-400">
          {deve > 0 ? `Deve hoje à CLYON ${euros(deve)}.` : "Não deve nada à CLYON."}
        </p>

        {podeRegistar && deve > 0 && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-sm font-semibold text-white">Registar pagamento do profissional à CLYON</p>
            <p className="mt-1 text-xs text-slate-500">
              Paga as partes que o valor cobre — das dívidas mais antigas para as mais novas, e em cada uma
              o IVA antes da taxa da plataforma. Não mexe no saldo dele: fica no registo e no histórico de
              cada pedido, com o seu nome e a hora. Para marcar uma parte de um trabalho, use Pagamentos ›
              A receber dos profissionais.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Valor
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-600"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Método
                <select
                  value={metodo}
                  onChange={(e) => setMetodo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                >
                  {METODOS_DO_PROFISSIONAL.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.rotulo}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Nota
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={255}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
              />
            </label>
            {erro && (
              <p className="mt-2 rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
                {erro}
              </p>
            )}
            <button
              onClick={registar}
              disabled={aGravar}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-acao px-4 py-2 text-sm font-semibold text-white hover:bg-acao-hover disabled:opacity-50"
            >
              {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Registar pagamento
            </button>
          </div>
        )}
        {feito && <p className="mt-3 text-sm text-emerald-300">{feito}</p>}

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Histórico</p>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          {erroDoHistorico ? (
            <p className="text-sm text-rose-300">{erroDoHistorico}</p>
          ) : entradas == null ? (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A ler…
            </p>
          ) : entradas.length === 0 ? (
            <p className="text-sm text-slate-400">Ainda não há movimentos.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {entradas.map((e, i) => (
                <li key={i} className="py-2">
                  <p className="text-sm text-slate-200">{e.texto}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    <span className={DIRECCAO[e.direccao].cor}>{DIRECCAO[e.direccao].rotulo}</span>
                    {e.quando ? ` · ${dataEHoraEmLisboa(new Date(e.quando))}` : ""}
                    {e.quem ? ` · ${e.quem}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={onFechar}
          className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
