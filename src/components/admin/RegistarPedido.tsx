"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const SERVICOS = [
  ["recolha_moveis", "Recolha de móveis"],
  ["recolha_monos", "Recolha de monos"],
  ["recolha_entulho", "Recolha de entulho"],
  ["esvaziamento_casa", "Esvaziamento de casa"],
  ["esvaziamento_apartamento", "Esvaziamento de apartamento"],
  ["mudanca", "Mudança"],
  ["montagem_moveis", "Montagem e desmontagem"],
  ["outro", "Outro serviço"],
] as const;

/**
 * Registar um pedido que chegou por fora do site.
 *
 * Uma boa parte dos pedidos entra por WhatsApp ou por telefone: a pessoa
 * descreve o que precisa e desliga. Até aqui esses pedidos não tinham como
 * chegar aos profissionais — não existiam na base — e o trabalho ou era feito
 * pela CLYON ou perdia-se.
 *
 * O que se pede aqui é o mínimo de que a regra de distribuição precisa: sem
 * serviço não há categoria para comparar, sem morada não há distância, e sem
 * contacto não há a quem entregar o trabalho depois de fechado. O resto
 * melhora o preço e mais nada.
 *
 * O email é opcional, ao contrário do simulador. Quem telefona raramente o tem
 * à mão, e nestes pedidos é a CLYON que responde às propostas por ele — não
 * fica ninguém à espera de um email que não vai abrir.
 */
export default function RegistarPedido({ onCriado }: { onCriado: () => void }) {
  const { token } = useAdminAuth();
  const [aberto, setAberto] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<string | null>(null);
  const [f, setF] = useState({
    serviceType: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    address: "",
    city: "",
    postalCode: "",
    floor: "",
    urgency: "flexivel",
    description: "",
    valor: "",
    precisaFatura: false,
  });

  const muda = (k: keyof typeof f, v: string | boolean) => {
    setF((d) => ({ ...d, [k]: v }));
    setErro("");
    setFeito(null);
  };

  async function gravar() {
    if (!token) return;
    setAGravar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/pedidos/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ ...f, distribuir: true }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível criar.");
        return;
      }
      const d = dados.distribuicao;
      /*
       * A resposta diz se chegou a alguém, e não só que gravou.
       *
       * Um "criado com sucesso" sobre um pedido que não chegou a profissional
       * nenhum é a pior mensagem possível: parece feito, e fica à espera de
       * uma proposta que não vem.
       */
      setFeito(
        "Pedido #" +
          dados.id +
          " criado por " +
          dados.valorDePartida +
          " €. " +
          (d
            ? d.avisados > 0
              ? "Enviado a " + d.avisados + " de " + d.candidatos + " profissionais activos."
              : "NÃO chegou a nenhum de " +
                d.candidatos +
                " activos — o histórico do pedido diz porquê."
            : "Não foi distribuído."),
      );
      setF((d0) => ({
        ...d0,
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        address: "",
        postalCode: "",
        description: "",
        valor: "",
      }));
      onCriado();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  const campo =
    "mt-1 h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white outline-none focus:border-cyan-600";

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="mb-4 flex items-center gap-2 rounded-xl border border-cyan-700 bg-cyan-950/30 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-900/40"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Registar pedido do WhatsApp ou telefone
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-cyan-900/60 bg-cyan-950/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-cyan-300">Registar pedido</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Para o que chega por fora do site. Vai aos profissionais como qualquer
            outro — e as propostas são respondidas aqui no painel, em nome do
            cliente.
          </p>
        </div>
        <button
          onClick={() => setAberto(false)}
          className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-300"
        >
          Fechar
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-slate-400">
          Serviço *
          <select
            value={f.serviceType}
            onChange={(e) => muda("serviceType", e.target.value)}
            className={campo}
          >
            <option value="">Escolher…</option>
            {SERVICOS.map(([id, rotulo]) => (
              <option key={id} value={id}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Nome do cliente *
          <input
            value={f.contactName}
            onChange={(e) => muda("contactName", e.target.value)}
            className={campo}
          />
        </label>

        <label className="text-xs text-slate-400">
          Telefone *
          <input
            value={f.contactPhone}
            onChange={(e) => muda("contactPhone", e.target.value)}
            className={campo}
          />
        </label>

        <label className="text-xs text-slate-400 sm:col-span-2">
          Morada *
          <input
            value={f.address}
            onChange={(e) => muda("address", e.target.value)}
            placeholder="Rua, número, localidade"
            className={campo}
          />
        </label>

        <label className="text-xs text-slate-400">
          Código postal
          <input
            value={f.postalCode}
            onChange={(e) => muda("postalCode", e.target.value)}
            placeholder="2845-513"
            className={campo}
          />
          <span className="mt-0.5 block text-[10px] text-slate-500">
            É daqui que sai a distância, e com ela o preço.
          </span>
        </label>

        <label className="text-xs text-slate-400">
          Localidade
          <input
            value={f.city}
            onChange={(e) => muda("city", e.target.value)}
            className={campo}
          />
          <span className="mt-0.5 block text-[10px] text-slate-500">
            Também decide quem cobre a zona.
          </span>
        </label>

        <label className="text-xs text-slate-400">
          Email do cliente
          <input
            type="email"
            value={f.contactEmail}
            onChange={(e) => muda("contactEmail", e.target.value)}
            placeholder="opcional"
            className={campo}
          />
        </label>

        <label className="text-xs text-slate-400">
          Andar
          <input
            value={f.floor}
            onChange={(e) => muda("floor", e.target.value)}
            placeholder="rés-do-chão, 2º…"
            className={campo}
          />
        </label>

        <label className="text-xs text-slate-400">
          Valor de partida
          <input
            value={f.valor}
            onChange={(e) => muda("valor", e.target.value)}
            placeholder="vazio = usa a estimativa"
            inputMode="decimal"
            className={campo}
          />
        </label>

        <label className="text-xs text-slate-400 sm:col-span-2 lg:col-span-3">
          O que é preciso fazer
          <textarea
            value={f.description}
            onChange={(e) => muda("description", e.target.value)}
            rows={2}
            placeholder="O que a pessoa disse ao telefone — quanto mais detalhe, melhor o preço."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-600"
          />
        </label>
      </div>

      <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={f.precisaFatura}
          onChange={(e) => muda("precisaFatura", e.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900"
        />
        O cliente precisa de fatura
        <span className="text-[10px] text-slate-500">
          (só lhe propomos quem a possa passar)
        </span>
      </label>

      {erro && (
        <p className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {erro}
        </p>
      )}
      {feito && (
        <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          {feito}
        </p>
      )}

      <button
        onClick={gravar}
        disabled={aGravar}
        className="mt-4 flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50"
      >
        {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {aGravar ? "A criar e a distribuir…" : "Criar e enviar aos profissionais"}
      </button>
    </div>
  );
}
