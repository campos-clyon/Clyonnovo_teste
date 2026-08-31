"use client";

import { useState } from "react";
import {
  CalendarClock,
  Check,
  Euro,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  User,
  Wrench,
  X,
} from "lucide-react";
import { linkGoogleMaps } from "@/lib/morada";
import {
  ETIQUETA,
  CORES,
  quandoPorExtenso,
  naAgenda,
  paraOCampoDeData,
  doCampoParaInstante,
  type EstadoNaAgenda,
} from "@/lib/agenda-dos-trabalhos";

/**
 * A FICHA DE UM TRABALHO DA AGENDA.
 *
 * "Me dê acesso ao pedido, deixe-me abrir os detalhes dele como nome, número,
 * valor, profissional, data de agendamento — e a opção de editar essas
 * informações, inclusive a agenda com data e hora."
 *
 * A lista da agenda foi feita para NÃO abrir nada: dois telefones por linha,
 * porque quem chega lá já sabe que vai ligar. Isso continua certo para o
 * telefonema e ficou errado para tudo o resto — depois de ligar, ele fica com
 * uma data nova, um valor novo ou um nome mal escrito na mão, e não tinha onde
 * os pôr. O caminho era sair da agenda, procurar o pedido noutro ecrã e perder
 * o sítio onde estava.
 *
 * TRÊS SÍTIOS ONDE SE ESCREVE, E NÃO UM FORMULÁRIO SÓ.
 *
 * O dia vive na negociação, o valor vive na negociação, e o nome e a morada
 * vivem no pedido. São três rotas com três regras diferentes — a do valor
 * exige motivo depois de pago, a do pedido regeocodifica a morada. Um
 * formulário único a gravar tudo de uma vez teria de mentir sobre uma delas.
 * Aqui cada linha grava a sua, e diz o que fez.
 *
 * NÃO FECHA COM UM CLIQUE AO LADO. Há campos por gravar aqui dentro.
 */

export type TrabalhoDaAgenda = {
  negociacaoId: number;
  pedidoId: number;
  servico: string | null;
  cidade: string | null;
  morada: string | null;
  codigoPostal: string | null;
  clienteNome: string | null;
  clienteTelefone: string | null;
  clienteEmail: string | null;
  providerId: number;
  profissionalNome: string;
  profissionalTelefone: string | null;
  valorAcordado: number | null;
  recebe: number | null;
  clientePaga: number | null;
  dataCombinada: string | null;
  dataDoCliente: string | null;
  estado: EstadoNaAgenda;
  quando: string | null;
  origem: "combinada" | "do_cliente" | "nenhuma";
  diasDeAtraso: number;
  horaJaPassou: boolean;
  jaConfirmado: boolean;
  jaPago: boolean;
};

const SERVICO: Record<string, string> = {
  recolha_moveis: "Recolha de móveis",
  recolha_monos: "Recolha de monos",
  recolha_entulho: "Recolha de entulho",
  esvaziamento_casa: "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca: "Mudança",
  montagem_moveis: "Montagem de móveis",
};

const euros = (v: number | null) => (v == null ? "—" : v.toFixed(2).replace(".", ",") + " €");

/** Uma linha da ficha: rótulo pequeno em cima, o que interessa por baixo. */
function Linha({
  icone,
  rotulo,
  children,
  accao,
}: {
  icone: React.ReactNode;
  rotulo: string;
  children: React.ReactNode;
  accao?: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-800 py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {icone}
            {rotulo}
          </p>
          <div className="mt-1.5">{children}</div>
        </div>
        {accao}
      </div>
    </div>
  );
}

function BotaoEditar({ aberto, onClick }: { aberto: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-600 hover:text-cyan-300"
    >
      {aberto ? (
        <>
          <X className="h-3 w-3" aria-hidden="true" />
          Cancelar
        </>
      ) : (
        <>
          <Pencil className="h-3 w-3" aria-hidden="true" />
          Editar
        </>
      )}
    </button>
  );
}

export default function FichaDaAgenda({
  t,
  token,
  onFechar,
  onMudou,
  onEditarPedido,
}: {
  t: TrabalhoDaAgenda;
  token: string;
  /** Fechar a ficha. É a ÚNICA saída — clicar ao lado não fecha nada. */
  onFechar: () => void;
  /** Alguma coisa foi gravada: a lista por trás tem de se recarregar. */
  onMudou: () => void;
  /** Abrir o editor do pedido — nome, telefone, morada, fotografias. */
  onEditarPedido: (pedidoId: number) => void;
}) {
  const [aEditarData, setAEditarData] = useState(false);
  const [quando, setQuando] = useState(paraOCampoDeData(t.dataCombinada ?? t.dataDoCliente));
  const [aEditarValor, setAEditarValor] = useState(false);
  const [valor, setValor] = useState(t.valorAcordado != null ? String(t.valorAcordado) : "");
  const [motivo, setMotivo] = useState("");
  const [precisaMotivo, setPrecisaMotivo] = useState(false);
  const [aGravar, setAGravar] = useState<"data" | "valor" | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  const agora = new Date();
  const situacao = naAgenda(
    { dataCombinada: t.dataCombinada, dataAgendada: t.dataDoCliente },
    agora,
  );

  function dizFeito(m: string) {
    setFeito(m);
    setTimeout(() => setFeito(""), 3000);
  }

  /** Gravar o dia. Campo vazio DESMARCA — e é de propósito. */
  async function gravarData(limpar = false) {
    setAGravar("data");
    setErro("");
    try {
      /*
       * O que está escrito no campo é hora de LISBOA, e sai daqui como
       * instante exacto. Mandá-lo em cru deixava a interpretação ao fuso de
       * quem o lesse: o Node da Vercel lê-o em Greenwich, e Greenwich não é
       * Lisboa em nenhum dia entre março e outubro.
       */
      const instante = limpar ? null : doCampoParaInstante(quando);
      if (!limpar && !instante) {
        setErro("Data inválida.");
        return;
      }
      const res = await fetch("/api/admin/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          negociacaoId: t.negociacaoId,
          quando: instante ? instante.toISOString() : "",
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível gravar a data.");
        return;
      }
      if (limpar) setQuando("");
      setAEditarData(false);
      dizFeito(limpar ? "Dia desmarcado." : "Dia marcado.");
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(null);
    }
  }

  async function gravarValor() {
    const n = Number(valor.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setErro("Escreva um valor acima de zero.");
      return;
    }
    setAGravar("valor");
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/valor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          negociacaoId: t.negociacaoId,
          valor: n,
          motivo: motivo.trim() || undefined,
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        /* Já pago pede o motivo: a caixa abre-se, em vez de a mensagem morrer
           numa linha vermelha que ninguém sabe resolver. */
        if (dados.precisaMotivo) setPrecisaMotivo(true);
        setErro(dados.error ?? "Não foi possível gravar o valor.");
        return;
      }
      setAEditarValor(false);
      setMotivo("");
      setPrecisaMotivo(false);
      dizFeito(
        `Valor corrigido. Ele recebe ${euros(dados.recebe)}; o cliente paga ${euros(dados.clientePaga)}.`,
      );
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(null);
    }
  }

  const mapa = linkGoogleMaps({
    formattedAddress: t.morada,
    city: t.cidade,
    postalCode: t.codigoPostal,
  });

  const desencontro =
    t.dataCombinada &&
    t.dataDoCliente &&
    new Date(t.dataCombinada).toDateString() !== new Date(t.dataDoCliente).toDateString();

  return (
    /*
      O clique ao lado NÃO fecha. Há um campo de data e um campo de valor por
      gravar aqui dentro, e a margem escura à volta é grande de propósito —
      o que torna o clique ao lado mais provável, não menos.
    */
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl rounded-[24px] border border-slate-700/60 bg-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {/* Cabeçalho: o número do pedido, o serviço, e onde isto está no tempo. */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-6 py-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-[Poppins] text-lg font-bold text-white">
                #{t.pedidoId}
              </span>
              <span className="text-lg text-slate-300">
                {SERVICO[t.servico ?? ""] ?? t.servico ?? "Trabalho"}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${CORES[t.estado]}`}
              >
                {ETIQUETA[t.estado]}
                {t.estado === "atrasado" &&
                  ` · ${t.diasDeAtraso} dia${t.diasDeAtraso === 1 ? "" : "s"}`}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Negociação #{t.negociacaoId}
              {t.jaPago
                ? " · já pago"
                : t.jaConfirmado
                  ? " · já confirmado"
                  : ""}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Fechar
          </button>
        </div>

        <div className="px-6 py-5">
          {erro && (
            <p className="mb-4 rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
              {erro}
            </p>
          )}
          {feito && (
            <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              {feito}
            </p>
          )}

          {/*
            O DIA, PRIMEIRO E EM GRANDE.

            É por isto que se abre uma ficha a partir da agenda. O valor e o
            cliente também aqui estão, mas quem chega vem da pergunta «quando é
            que isto é», e essa resposta não pode estar a meio de uma lista.
          */}
          <Linha
            icone={<CalendarClock className="h-3 w-3" aria-hidden="true" />}
            rotulo="Data e hora do trabalho"
            accao={
              <BotaoEditar
                aberto={aEditarData}
                onClick={() => {
                  setAEditarData((v) => !v);
                  setQuando(paraOCampoDeData(t.dataCombinada ?? t.dataDoCliente));
                  setErro("");
                }}
              />
            }
          >
            <p className="text-xl font-bold text-white">{quandoPorExtenso(situacao, agora)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t.origem === "combinada"
                ? "Combinado depois de o trabalho ser fechado."
                : t.origem === "do_cliente"
                  ? "É a data que o cliente pediu no formulário — ainda não foi combinada com ninguém."
                  : "Ninguém marcou dia nenhum. É o que precisa de um telefonema."}
            </p>
            {desencontro && (
              <p className="mt-1 text-xs text-amber-300">
                O cliente tinha pedido {new Date(t.dataDoCliente!).toLocaleDateString("pt-PT")}.
              </p>
            )}

            {aEditarData && (
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="datetime-local"
                    value={quando}
                    onChange={(e) => setQuando(e.target.value)}
                    className="min-h-[42px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-600"
                  />
                  <button
                    onClick={() => gravarData(false)}
                    disabled={aGravar != null || !quando}
                    className="flex min-h-[42px] items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                  >
                    {aGravar === "data" && (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    )}
                    Guardar
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    Escreve na mesma data que o profissional marca no painel dele — não há
                    duas.
                  </p>
                  {t.dataCombinada && (
                    <button
                      onClick={() => gravarData(true)}
                      disabled={aGravar != null}
                      className="text-xs font-semibold text-slate-400 underline underline-offset-2 hover:text-rose-300 disabled:opacity-50"
                    >
                      Desmarcar o dia
                    </button>
                  )}
                </div>
                {(t.jaConfirmado || t.jaPago) && (
                  <p className="mt-2 text-xs text-amber-300">
                    Este trabalho já está fechado. A data já não é um plano, é o registo do
                    que aconteceu — corrija-a só se ficou errada.
                  </p>
                )}
              </div>
            )}
          </Linha>

          {/* O VALOR, e os dois números que saem dele. */}
          <Linha
            icone={<Euro className="h-3 w-3" aria-hidden="true" />}
            rotulo="Valor acordado"
            accao={
              <BotaoEditar
                aberto={aEditarValor}
                onClick={() => {
                  setAEditarValor((v) => !v);
                  setValor(t.valorAcordado != null ? String(t.valorAcordado) : "");
                  setErro("");
                }}
              />
            }
          >
            <p className="text-xl font-bold text-white">{euros(t.valorAcordado)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t.profissionalNome.split(" ")[0]} recebe {euros(t.recebe)} · o cliente paga{" "}
              {euros(t.clientePaga)}
            </p>

            {aEditarValor && (
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="230"
                    className="min-h-[42px] w-32 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-600"
                  />
                  <button
                    onClick={gravarValor}
                    disabled={aGravar != null}
                    className="flex min-h-[42px] items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                  >
                    {aGravar === "valor" && (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    )}
                    Guardar
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Para os trabalhos em que o orçamento se fecha à porta. Tudo o resto — o
                  que ele recebe, o que o cliente paga, o IVA — volta a ser calculado a
                  partir deste número.
                </p>
                {(precisaMotivo || t.jaPago) && (
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Motivo — fica no histórico"
                    className="mt-2 min-h-[42px] w-full rounded-lg border border-amber-700/60 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-amber-500"
                  />
                )}
              </div>
            )}
          </Linha>

          {/* O CLIENTE: nome, número, e onde é. */}
          <Linha icone={<User className="h-3 w-3" aria-hidden="true" />} rotulo="Cliente">
            <p className="text-base font-semibold text-slate-100">
              {t.clienteNome ?? "Sem nome"}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              {t.clienteTelefone && (
                <a
                  href={`tel:${t.clienteTelefone}`}
                  className="flex items-center gap-1.5 text-cyan-300 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.clienteTelefone}
                </a>
              )}
              {t.clienteEmail && (
                <a
                  href={`mailto:${t.clienteEmail}`}
                  className="flex items-center gap-1.5 text-slate-400 hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.clienteEmail}
                </a>
              )}
            </div>
            {(t.morada || t.cidade) && (
              <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-400">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {mapa ? (
                  <a href={mapa} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {[t.morada, t.codigoPostal, t.cidade].filter(Boolean).join(", ")}
                  </a>
                ) : (
                  [t.morada, t.codigoPostal, t.cidade].filter(Boolean).join(", ")
                )}
              </p>
            )}
          </Linha>

          {/*
            O PROFISSIONAL — mostra-se, não se troca aqui.

            Trocar o profissional de um trabalho já fechado não é editar um
            campo: é desfazer uma contratação, com saldo cativo do lado dele.
            Isso faz-se na mesa das negociações, onde há o «desistir» e onde o
            pedido volta a circular.
          */}
          <Linha icone={<Wrench className="h-3 w-3" aria-hidden="true" />} rotulo="Profissional">
            <p className="text-base font-semibold text-slate-100">{t.profissionalNome}</p>
            {t.profissionalTelefone && (
              <a
                href={`tel:${t.profissionalTelefone}`}
                className="mt-1.5 flex items-center gap-1.5 text-sm text-cyan-300 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {t.profissionalTelefone}
              </a>
            )}
            <p className="mt-1.5 text-xs text-slate-500">
              Para passar o trabalho a outra pessoa, é nas Negociações — aqui trocar o nome
              deixava o dinheiro cativo na carteira de quem já não o vai fazer.
            </p>
          </Linha>

          {/*
            O RESTO DO PEDIDO abre o editor a sério.

            Nome, telefone, morada, descrição, fotografias e o que o cliente
            contava gastar são catorze campos e uma geocodificação — não cabem
            aqui, e o editor já existe. Num trabalho já contratado, gravar por
            lá NÃO volta a pôr o pedido a circular: o recomeço recusa-se quando
            há alguém contratado.
          */}
          <div className="mt-2 border-t border-slate-800 pt-4">
            <button
              onClick={() => onEditarPedido(t.pedidoId)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-600 hover:text-cyan-300"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar o pedido — nome, telefone, morada, fotografias
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
              O trabalho já está contratado, por isso guardar ali não o volta a mandar aos
              profissionais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
