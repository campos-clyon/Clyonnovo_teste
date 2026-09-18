"use client";

import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import type { Pedido } from "./tipos";

/**
 * O DIA E A HORA QUE ELE COMBINOU COM O CLIENTE.
 *
 * Um campo e um botão. `datetime-local` porque é o que o telemóvel abre com o
 * selector nativo — um campo de texto a pedir «dd/mm/aaaa hh:mm» ao volante não
 * se preenche.
 *
 * Apagar o campo desmarca. É o que ele faz quando o cliente adia sem dizer
 * quando: melhor ficar «por combinar» do que manter uma data que já ninguém
 * cumpre.
 *
 * VIVE À PARTE DESDE 18-09-2026, e a razão é uma queixa:
 *
 * *«Os profissionais devem ter a opção de editar as suas agendas para ajustar
 * as datas e horários dos trabalhos.»*
 *
 * Já podiam — mas só dentro do cartão do trabalho, em «Os meus trabalhos». Na
 * AGENDA, que é o ecrã onde se olha para os dias, não havia forma de mexer em
 * nenhum: via-se que estava errado e tinha de se sair para outro sítio para o
 * corrigir. Ninguém sai da agenda para ir arrumar a agenda — é a mesma lição
 * que o botão de arquivar já tinha ensinado neste ficheiro ao lado.
 *
 * A gravação é a mesma rota, e é ela que guarda as regras: a negociação tem de
 * ser dele, o trabalho tem de estar por fechar, e a data nunca escreve por cima
 * do que o cliente pediu.
 */

/**
 * `datetime-local` fala em hora LOCAL sem fuso.
 *
 * A data vem em ISO com Z, e `toISOString().slice(0,16)` dava a hora de
 * Greenwich — um trabalho das 11h aparecia às 10h no campo, e bastava gravar
 * para o adiantar uma hora.
 */
export function paraOCampo(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function MarcarODia({
  pedido,
  onGravado,
  /**
   * Sem título nem explicação — só o campo e o botão.
   *
   * É o que a agenda quer: lá o contexto já está no ecrã («sem data marcada»,
   * ou a hora no cabeçalho do cartão), e repetir duas linhas de explicação em
   * cada um dos oito trabalhos do dia empurrava para baixo o que interessa.
   */
  compacto = false,
}: {
  pedido: Pedido;
  onGravado: () => void;
  compacto?: boolean;
}) {
  const jaCombinado = pedido.dataCombinada ?? null;
  const [quando, setQuando] = useState(paraOCampo(jaCombinado ?? pedido.dataAgendada));
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");
  const [gravado, setGravado] = useState(false);

  async function gravar() {
    setAGravar(true);
    setErro("");
    try {
      /*
       * ⚠️ ENVIA-SE UM INSTANTE, NÃO UMA HORA DE RELÓGIO — 18-09-2026.
       *
       * *«Eu troco o horário para as 15h00 e salvo, mas ele não muda
       * realmente.»* Mudava: para as 16h00.
       *
       * O campo dá `2026-09-18T15:00`, sem fuso nenhum. Enviado assim, quem o
       * lia era o servidor — que corre em UTC — e 15:00 viravam 15:00 UTC, ou
       * seja 16:00 em Lisboa no Verão.
       *
       * Aqui, no navegador, `new Date` desse texto usa o fuso DE QUEM ESCREVEU,
       * que é o certo: é o relógio que ele tem à frente. O `toISOString`
       * fecha-o num instante que já não depende de onde é lido.
       */
      let quandoParaEnviar = "";
      if (quando) {
        const d = new Date(quando);
        if (Number.isNaN(d.getTime())) {
          setErro("Data inválida.");
          return;
        }
        quandoParaEnviar = d.toISOString();
      }

      const res = await fetch("/api/profissionais/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negociacaoId: pedido.negociacaoId, quando: quandoParaEnviar }),
      });
      const r = await res.json();
      if (!res.ok) {
        setErro(r.error ?? "Não foi possível gravar.");
        return;
      }
      setGravado(true);
      setTimeout(() => setGravado(false), 2500);
      onGravado();
    } catch {
      setErro("Sem rede. Tente outra vez.");
    } finally {
      setAGravar(false);
    }
  }

  const campoEBotao = (
    <>
      <div className={compacto ? "flex flex-wrap gap-2" : "mt-2 flex flex-wrap gap-2"}>
        <input
          type="datetime-local"
          value={quando}
          onChange={(e) => setQuando(e.target.value)}
          aria-label="Dia e hora do trabalho"
          className={`min-h-[44px] flex-1 rounded-lg border bg-white px-3 text-sm text-tinta outline-none ${
            compacto
              ? "border-[#E2EEF3] focus:border-acao"
              : "border-amber-300 focus:border-amber-500"
          }`}
        />
        <button
          onClick={gravar}
          disabled={aGravar}
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-50 ${
            compacto ? "bg-acao active:opacity-80" : "bg-amber-600 active:bg-amber-700"
          }`}
        >
          {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {gravado ? "Marcado" : "Marcar"}
        </button>
      </div>
      {erro && <p className="mt-2 text-xs font-semibold text-rose-700">{erro}</p>}
    </>
  );

  if (compacto) return <div className="mt-2">{campoEBotao}</div>;

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-white/70 p-3">
      <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        {jaCombinado ? "O dia que combinou" : "Depois de combinar, marque aqui"}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
        {jaCombinado
          ? "Mudou alguma coisa? Corrija — a CLYON passa a ver a data nova."
          : "Assim a CLYON sabe quando é, e não lhe liga a perguntar."}
      </p>
      {campoEBotao}
    </div>
  );
}
