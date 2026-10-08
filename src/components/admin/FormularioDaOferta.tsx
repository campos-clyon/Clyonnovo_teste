"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import type { Alcance } from "@/components/admin/RegistarPedido";
import { lerPrecoAoCliente, lerValorFixo } from "@/lib/oferta-clyon";

/*
 * O FORMULÁRIO DA OFERTA A VALOR FIXO, num ficheiro só dele — 06-10-2026.
 *
 * Vivia dentro da página dos Trabalhos CLYON. Passou a ser usado também nas
 * Negociações, no «Por enviar» — «Vamos criar uma conexão dos trabalhos nas
 * negociações com os Trabalhos CLYON». Num ficheiro à parte, quem o importa
 * leva só as duas rotas que ele chama, e não a página inteira.
 */

const euros = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(2).replace(".", ",")} €`;

type ProfissionalNaLista = { id: number; nome: string; distanciaKm: number | null; elegivel: boolean };

/**
 * O PASSO 2 DO REGISTO, nos Trabalhos CLYON: o valor fixo e a quem vai.
 *
 * Distribuir chega a quem a regra do raio e das categorias deixa — os mesmos
 * do «Chegaria a N» de cima. Escolher deixa marcar qualquer profissional
 * activo, mesmo fora do raio: quem escolhe pelo nome sabe uma coisa que a
 * regra não sabe. Um só escolhido é uma oferta DIRECTA: aceitar fica com ele.
 */
export function FormularioDaOferta({
  token,
  pedidoId,
  alcance,
  referencia,
  onOferecido,
}: {
  token: string | null;
  pedidoId: number;
  alcance: Alcance | null;
  referencia: number | null;
  onOferecido: (msg: string) => void;
}) {
  const [valor, setValor] = useState("");
  // O que a CLYON combinou com o cliente, sem IVA — 08-10-2026. É sobre ele
  // que se conta a comissão da sócia, e não ficava escrito em lado nenhum.
  const [precoCliente, setPrecoCliente] = useState("");
  const [modo, setModo] = useState<"distribuir" | "escolher">("distribuir");
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  const [todos, setTodos] = useState<ProfissionalNaLista[] | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  const elegiveis = alcance?.elegiveis ?? [];

  // A lista de todos os activos só se pede quando se vai escolher.
  useEffect(() => {
    if (modo !== "escolher" || todos != null || !token) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/profissionais", { headers: { Authorization: `Bearer ${token}` } });
        const dados = await res.json();
        if (!vivo) return;
        const doRaio = new Map(elegiveis.map((e) => [e.id, e.distanciaKm]));
        const lista: ProfissionalNaLista[] = (dados.profissionais ?? [])
          .filter(
            (p: Record<string, unknown>) =>
              p.estado === "aprovado" && Number(p.isActive) === 1 && !p.contaDeTeste,
          )
          .map((p: Record<string, unknown>) => ({
            id: Number(p.id),
            nome: String(p.name ?? `#${p.id}`),
            distanciaKm: doRaio.get(Number(p.id)) ?? null,
            elegivel: doRaio.has(Number(p.id)),
          }))
          .sort(
            (x: ProfissionalNaLista, y: ProfissionalNaLista) =>
              Number(y.elegivel) - Number(x.elegivel) || x.nome.localeCompare(y.nome, "pt"),
          );
        setTodos(lista);
      } catch {
        if (vivo) setTodos([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [modo, todos, token, elegiveis]);

  const lido = lerValorFixo(valor);
  const precoLido = lerPrecoAoCliente(precoCliente);
  const podeEnviar =
    lido.ok &&
    precoLido.ok &&
    !aEnviar &&
    (modo === "distribuir" ? elegiveis.length > 0 : escolhidos.length > 0);

  async function oferecer() {
    if (!token || !lido.ok || !precoLido.ok) return;
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/trabalhos-clyon", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pedidoId,
          valor: lido.valor,
          precoAoCliente: precoLido.valor,
          ...(modo === "escolher" ? { profissionais: escolhidos } : {}),
        }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível oferecer.");
        return;
      }
      const msg =
        dados.receberam > 0
          ? `#${pedidoId} oferecido a ${dados.receberam} ${dados.receberam === 1 ? "profissional" : "profissionais"} por ${euros(lido.valor)}.` +
            (dados.modo === "directa" ? " Se aceitar, fica com ele." : " Escolha entre os que aceitarem.")
          : `#${pedidoId} não chegou a ninguém — o histórico do pedido diz porquê.`;
      setFeito(msg);
      onOferecido(msg);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  if (feito) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {feito}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-cyan-900/60 bg-slate-950/60 p-4">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
          Valor fixo para o profissional
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={referencia != null ? referencia.toFixed(2).replace(".", ",") : "250,00"}
            className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-lg font-bold tabular-nums text-white outline-none focus:border-cyan-500"
          />
          <span className="text-sm text-slate-400">€</span>
        </span>
        <span className="mt-1 block text-xs text-slate-400">
          É o que ele recebe — sem taxa nenhuma a tirar.
          {referencia != null ? ` A conta CLYON dava ${euros(referencia)}.` : ""}
        </span>
        {valor.trim() !== "" && !lido.ok && <span className="mt-1 block text-xs text-red-300">{lido.erro}</span>}
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
          Preço ao cliente, sem IVA
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <input
            inputMode="decimal"
            value={precoCliente}
            onChange={(e) => setPrecoCliente(e.target.value)}
            placeholder="400,00"
            className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-lg font-bold tabular-nums text-white outline-none focus:border-cyan-500"
          />
          <span className="text-sm text-slate-400">€</span>
        </span>
        <span className="mt-1 block text-xs text-slate-400">
          O que a CLYON combinou com o cliente. A comissão da assistente conta-se sobre este valor.
          {lido.ok && precoLido.ok
            ? precoLido.valor >= lido.valor
              ? ` Fica para a CLYON ${euros(precoLido.valor - lido.valor)} antes de impostos.`
              : " — é menos do que o valor fixo: a CLYON perde dinheiro neste trabalho."
            : ""}
        </span>
        {precoCliente.trim() !== "" && !precoLido.ok && (
          <span className="mt-1 block text-xs text-red-300">{precoLido.erro}</span>
        )}
      </label>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-cyan-300">A quem vai</legend>
        <label className="flex items-start gap-2 text-sm text-slate-200">
          <input
            type="radio"
            name={`modo-${pedidoId}`}
            checked={modo === "distribuir"}
            onChange={() => setModo("distribuir")}
            className="mt-1"
          />
          <span>
            Distribuir a quem o pode fazer —{" "}
            <strong>
              {elegiveis.length} {elegiveis.length === 1 ? "profissional" : "profissionais"}
            </strong>
            <span className="block text-xs text-slate-400">
              Entre os que aceitarem, a CLYON escolhe.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-200">
          <input
            type="radio"
            name={`modo-${pedidoId}`}
            checked={modo === "escolher"}
            onChange={() => setModo("escolher")}
            className="mt-1"
          />
          <span>
            Escolher a quem
            <span className="block text-xs text-slate-400">
              Um só escolhido: se aceitar, o trabalho fica logo com ele.
            </span>
          </span>
        </label>
      </fieldset>

      {modo === "escolher" && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60 p-2">
          {todos == null ? (
            <p className="flex items-center gap-2 p-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> A carregar os profissionais…
            </p>
          ) : todos.length === 0 ? (
            <p className="p-2 text-xs text-slate-400">Não há profissionais activos.</p>
          ) : (
            <ul className="space-y-0.5">
              {todos.map((p) => {
                const marcado = escolhidos.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800/60">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            setEscolhidos((l) => (marcado ? l.filter((x) => x !== p.id) : [...l, p.id]))
                          }
                        />
                        {p.nome}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {p.elegivel
                          ? p.distanciaKm != null
                            ? `~${Math.round(p.distanciaKm)} km`
                            : "no raio"
                          : "fora do raio"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {erro && <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">{erro}</p>}

      <button
        onClick={() => void oferecer()}
        disabled={!podeEnviar}
        className="flex items-center gap-2 rounded-xl bg-acao px-4 py-2 text-sm font-bold text-white transition hover:bg-acao-hover disabled:opacity-40"
      >
        {aEnviar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {modo === "escolher" && escolhidos.length === 1
          ? `Oferecer a ${todos?.find((p) => p.id === escolhidos[0])?.nome ?? "um profissional"}`
          : "Oferecer a valor fixo"}
      </button>
    </div>
  );
}
