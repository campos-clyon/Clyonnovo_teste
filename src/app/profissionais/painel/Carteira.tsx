"use client";

import { useState } from "react";
import { ArrowRight, Building2, History, Info, Loader2 } from "lucide-react";
import { CabecalhoDeEcra, BotaoRedondo, euros } from "@/components/portal/Portal";
import Nota from "@/components/Nota";
import { MINIMO_PARA_LEVANTAR } from "@/lib/carteira";
import type { DadosDaCarteira } from "./tipos";
import { PROMESSA } from "@/lib/pagamento-na-plataforma";

/**
 * A carteira.
 *
 * O número grande é o que ele pode levantar hoje. O que está cativo fica por
 * cima, mais pequeno e com uma explicação a um toque: é dinheiro dele, existe,
 * e ainda não é levantável — mostrar os dois com o mesmo peso fazia parecer que
 * havia mais disponível do que há, e a desilusão vem depois.
 *
 * A ordem não é decorativa. Em espera em cima, disponível ao centro em grande,
 * acções por baixo: é a ordem por que se lê a pergunta "quanto posso tirar
 * agora?".
 */

export default function Carteira({
  dados,
  onVoltar,
  onHistorico,
  onIban,
  onRecarregar,
}: {
  dados: DadosDaCarteira;
  onVoltar: () => void;
  onHistorico: () => void;
  onIban: () => void;
  onRecarregar: () => void;
}) {
  const [aTransferir, setATransferir] = useState(false);

  if (aTransferir) {
    return (
      <PedirTransferencia
        dados={dados}
        onVoltar={() => setATransferir(false)}
        onIban={onIban}
        onFeito={() => {
          setATransferir(false);
          onRecarregar();
        }}
      />
    );
  }

  const { carteira } = dados;
  const podeTransferir =
    dados.temIban && !dados.temPedidoPendente && carteira.disponivel >= MINIMO_PARA_LEVANTAR;

  return (
    <>
      <CabecalhoDeEcra titulo="A minha carteira" onVoltar={onVoltar} />

      <section className="overflow-hidden rounded-2xl border border-[#E2EEF3] bg-white shadow-sm">
        {/*
          ⚠️ «POR COBRAR» É UMA LINHA SEPARADA DE «CATIVO», E TEM DE SER.

          Cativo quer dizer «a CLYON tem o seu dinheiro». Por cobrar quer dizer
          «o cliente ainda não pagou» — não está cá nem lá. Juntá-los numa linha
          só era prometer-lhe uma garantia sobre dinheiro que ninguém entregou,
          que é exactamente o erro que `pagamento-na-plataforma.ts` existe para
          não se repetir.

          Só aparece quando há: enquanto a plataforma não cobrar, é sempre zero.
        */}
        {carteira.porCobrar > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/60 px-4 py-3">
            <span className="text-sm text-amber-900">
              Por cobrar
              <span className="block text-xs text-amber-700">
                trabalho feito que o cliente ainda não pagou
              </span>
            </span>
            <span className="text-base font-semibold text-amber-900">
              {euros(carteira.porCobrar)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <span className="flex items-center gap-1.5 text-sm text-slate-600">
            {PROMESSA.proRotuloDoCativo}
            <Info className="h-4 w-4 text-slate-300" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold text-slate-700">{euros(carteira.cativo)}</span>
        </div>

        <div className="px-4 py-8 text-center">
          <div className="text-[42px] font-bold leading-none text-[#0B1929]">
            {euros(carteira.disponivel)}
          </div>
          <p className="mt-2 text-sm text-slate-500">Disponível para transferir</p>

          {carteira.aCaminho > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {euros(carteira.aCaminho)} a caminho da sua conta
            </p>
          )}

          <div className="mt-6 flex items-start justify-center gap-6">
            <BotaoRedondo
              icone={Building2}
              rotulo="Transferir"
              onClick={() => setATransferir(true)}
              desactivado={!podeTransferir}
            />
            <BotaoRedondo icone={History} rotulo="Histórico" onClick={onHistorico} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-700">Total ganho</div>
            <div className="text-xs text-slate-400">desde que começou na CLYON</div>
          </div>
          <span className="text-base font-semibold text-slate-700">
            {euros(carteira.totalGanho)}
          </span>
        </div>

        <button
          onClick={onHistorico}
          className="flex min-h-[52px] w-full items-center justify-between border-t border-slate-100 px-4 text-left transition active:bg-slate-50"
        >
          <span className="text-[15px] font-medium text-[#0B1929]">Aceder ao histórico</span>
          <ArrowRight className="h-5 w-5 text-slate-300" aria-hidden="true" />
        </button>
      </section>

      {!dados.temIban && (
        <button
          onClick={onIban}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left"
        >
          <Building2 className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <span className="flex-1 text-sm text-amber-900">
            <strong>Falta o IBAN.</strong> Sem ele não há para onde transferir o seu saldo.
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
        </button>
      )}

      {dados.temPedidoPendente && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tem uma transferência a ser processada. Assim que sair, pode pedir outra.
        </p>
      )}

      <Nota titulo={PROMESSA.proTitulo} icone="cadeado" className="mt-3">
        {PROMESSA.proCorpo}
      </Nota>
    </>
  );
}

// ── Pedir a transferência ───────────────────────────────────────────────────

function PedirTransferencia({
  dados,
  onVoltar,
  onIban,
  onFeito,
}: {
  dados: DadosDaCarteira;
  onVoltar: () => void;
  onIban: () => void;
  onFeito: () => void;
}) {
  const [valor, setValor] = useState(String(dados.carteira.disponivel).replace(".", ","));
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  const numero = Number(valor.replace(",", "."));
  const valido =
    Number.isFinite(numero) &&
    numero >= MINIMO_PARA_LEVANTAR &&
    numero <= dados.carteira.disponivel;

  async function pedir() {
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/profissionais/levantamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: numero }),
      });
      const r = await res.json();
      if (!res.ok) {
        setErro(r.error ?? "Não foi possível.");
        return;
      }
      onFeito();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <CabecalhoDeEcra titulo="Transferir" onVoltar={onVoltar} />

      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <label htmlFor="valor" className="text-sm font-medium text-slate-700">
          Quanto quer transferir
        </label>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400">
            €
          </span>
          <input
            id="valor"
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-300 bg-white py-4 pl-11 pr-4 text-2xl font-bold text-slate-900 outline-none transition focus:border-cyan-600"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Disponível: {euros(dados.carteira.disponivel)}
          </span>
          <button
            type="button"
            onClick={() => setValor(String(dados.carteira.disponivel).replace(".", ","))}
            className="font-semibold text-cyan-700 underline"
          >
            Transferir tudo
          </button>
        </div>

        <button
          onClick={onIban}
          className="mt-4 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left"
        >
          <Building2 className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-xs text-slate-500">Para a conta</span>
            <span className="block text-sm font-semibold text-slate-800">
              {dados.iban || "por indicar"}
            </span>
            {dados.titular && (
              <span className="block text-xs text-slate-500">{dados.titular}</span>
            )}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
        </button>

        {erro && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <button
          onClick={pedir}
          disabled={!valido || aEnviar}
          className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white transition active:bg-cyan-700 disabled:opacity-40"
        >
          {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          Pedir {euros(Number.isFinite(numero) ? numero : 0)}
        </button>

        <p /*
                  `slate-600`, e nao `slate-400`. Esta e a unica frase que
                  explica porque e que o botao acima esta apagado — e estava a
                  2,56:1 de contraste, num telemovel muitas vezes ao sol.
                */
                className="mt-3 text-center text-xs leading-relaxed text-slate-600">
          {/*
            DUAS DURAÇÕES, E SÃO MESMO DUAS — 17-09-2026.

            "Pedidos que podem demorar até 24H" é o tempo que a CLYON leva a
            tratar do pedido, e é uma promessa nossa. O que vem a seguir é o
            banco, e não depende de nós. Juntá-las numa frase só fazia da
            segunda uma promessa que não podemos cumprir.
          */}
          O mínimo por transferência é de {MINIMO_PARA_LEVANTAR} €. Tratamos do pedido em até
          24 horas e transferimos para o IBAN indicado; depois disso, o banco costuma demorar
          mais um dia útil.
        </p>
      </section>
    </>
  );
}
