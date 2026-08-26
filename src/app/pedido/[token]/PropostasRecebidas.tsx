"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  HandCoins,
  Loader2,
  Phone,
  Star,
} from "lucide-react";
import {
  accoesDisponiveis,
  propostasRestantes,
  propostaPendente,
  MAX_PROPOSTAS_POR_LADO,
  type Negociacao,
  type Proposta,
} from "@/lib/negociacao";
import { quantoOClientePaga, decomporIva, TAXA_IVA } from "@/lib/taxas-plataforma";
import EscolherValor from "@/components/EscolherValor";
import Nota from "@/components/Nota";
import HistoricoDaNegociacao from "@/components/HistoricoDaNegociacao";

/**
 * As propostas que o cliente recebeu.
 *
 * Vários profissionais podem estar a negociar o mesmo pedido ao mesmo tempo, e
 * é por isso que isto é uma lista e não um ecrã só. O cliente escolhe quem lhe
 * entra em casa — e é esse o segundo passo do aperto de mão duplo: um
 * profissional aceitar não fecha nada.
 *
 * Os valores da negociação são CRUS — o que foi proposto, sem taxa. É como a
 * Vinted faz: na conversa vêem-se as propostas tal como foram feitas, e a taxa
 * aparece onde se compra.
 *
 * Somá-la em cada proposta fazia o número dançar a cada contraproposta por uma
 * razão que não é a negociação, e o cliente deixava de saber sobre que valor
 * estava a discutir com o profissional.
 *
 * No fecho é ao contrário: aí é o momento de pagar, e mostra-se a conta toda —
 * acordado, taxa e total.
 */

export type NegociacaoDoCliente = {
  id: number;
  estado: string;
  valorAcordado: number | null;
  propostas: Proposta[];
  profissionalNome: string;
  /*
   * O perfil público, calculado no servidor com dados REAIS. Pode ser null
   * (conta entretanto apagada) e pode vir vazio — zero avaliações, zero
   * trabalhos. O ecrã diz a verdade nos dois casos em vez de inventar.
   */
  perfil?: {
    naClyonDesde: string | null;
    trabalhosConcluidos: number;
    notaMedia: number | null;
    quantasAvaliacoes: number;
    categorias: string[];
    zonas: string[];
    raioKm: number | null;
    avaliacoes: Array<{
      estrelas: number;
      comentario: string | null;
      avaliadoEm: string | null;
      servicoTipo: string | null;
      cidade: string | null;
    }>;
  } | null;
  emiteFatura: boolean;
  /** "isento" ou "normal" — decide se há linha de IVA na confirmação. */
  regimeIva: string;
  guiaVerificada: boolean;
  /** Só depois de o contratar. */
  profissionalTelefone: string | null;
  fase: "a_negociar" | "a_executar" | "a_confirmar" | "confirmado" | "pago";
  provaJson: string | null;
  diasAteLibertar: number | null;
  /** A avaliação que ele já deu, se deu. */
  estrelas?: number | null;
  /** As datas do fim, para o histórico contar a história toda. */
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
  avaliadoEm?: Date | string | null;
};

function provaDe(json: string | null): { fotos: string[]; nota: string } | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json);
    return {
      fotos: Array.isArray(p?.fotos) ? p.fotos.filter((f: unknown) => typeof f === "string") : [],
      nota: typeof p?.nota === "string" ? p.nota : "",
    };
  } catch {
    return null;
  }
}

function euros(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " €";
}

export default function PropostasRecebidas({
  token,
  pedidoId,
  negociacoesIniciais,
  onMudou,
}: {
  /**
   * O token do link do email, quando se chega por aí.
   *
   * Dentro da conta não há token — há sessão. Aí passa-se o `pedidoId` e a rota
   * autenticada confirma que o pedido é de quem está a falar. É a mesma
   * negociação e o mesmo motor: muda só como se prova quem é.
   */
  token?: string;
  pedidoId?: number;
  negociacoesIniciais: NegociacaoDoCliente[];
  /** Para a conta recarregar a lista depois de uma ação. */
  onMudou?: () => void;
}) {
  const [negociacoes, setNegociacoes] = useState(negociacoesIniciais);
  const [aEnviar, setAEnviar] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  // O pedido cancelado nesta sessão: o ecrã tem de mudar sem esperar por um
  // recarregamento, senão ele carrega, some o botão e nada parece ter mudado.
  const [cancelado, setCancelado] = useState(false);
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");

  /**
   * Cancelar o pedido inteiro.
   *
   * O id -1 marca esta acção no mesmo estado de "a enviar" que as outras usam
   * por negociação — não há negociação nenhuma a cancelar aqui, é o pedido.
   */
  async function cancelarOPedido() {
    if (!window.confirm(
      "Cancelar este pedido?\n\n" +
      "As propostas que recebeu terminam e ninguém volta a contactá-lo sobre " +
      "este trabalho. Não paga nada.",
    )) return;

    let motivo = window.prompt(
      "Porquê? (ajuda-nos e ajuda os profissionais — pode deixar em branco)",
      "",
    );
    if (motivo === null) return;

    setAEnviar(-1);
    setErro("");
    try {
      let res = await fetch(token ? `/api/negociacao/${token}` : "/api/users/me/negociacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accao: "cancelar_pedido", pedidoId, motivo }),
      });
      let dados = await res.json();

      // 422 quer dizer: há um trabalho contratado e o motivo passa a ser
      // preciso. Pergunta-se outra vez, agora a dizer porquê — em vez de
      // devolver um erro que a pessoa não sabe resolver.
      if (res.status === 422 && dados?.precisaDeMotivo) {
        const outra = window.prompt(
          `${dados.error}\n\nEscreva o motivo:`,
          motivo ?? "",
        );
        if (outra === null || outra.trim().length === 0) {
          setErro("O pedido não foi cancelado — falta o motivo.");
          return;
        }
        motivo = outra.trim();
        res = await fetch(token ? `/api/negociacao/${token}` : "/api/users/me/negociacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accao: "cancelar_pedido", pedidoId, motivo }),
        });
        dados = await res.json();
      }

      if (!res.ok || !dados?.ok) {
        setErro(dados?.error ?? "Não foi possível cancelar o pedido.");
        return;
      }
      setCancelado(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(null);
    }
  }

  async function agir(id: number, accao: string, valor?: string) {
    setAEnviar(id);
    setErro("");
    try {
      const res = await fetch(
        token ? `/api/negociacao/${token}` : "/api/users/me/negociacao",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accao,
            valor,
            negociacaoId: id,
            pedidoId,
            ...(accao === "avaliar" ? { estrelas, comentario } : {}),
          }),
        },
      );
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      onMudou?.();
      setNegociacoes((lista) =>
        lista.map((n) =>
          n.id !== id
            ? n
            : dados.confirmado
              ? { ...n, fase: "confirmado" as const, diasAteLibertar: null }
            : dados.avaliado
              ? { ...n, estrelas }
              : {
                  ...n,
                  estado: dados.estado,
                  valorAcordado: dados.valorAcordado,
                  propostas: dados.propostas,
                },
        ),
      );
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(null);
    }
  }

  const acordada = negociacoes.find((n) => n.estado === "acordada");

  if (acordada) {
    const prova = provaDe(acordada.provaJson);
    return (
      <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-2 text-lg font-bold text-emerald-900">
          Contratou {acordada.profissionalNome}
        </h2>
        {/* Aqui sim: é o momento de pagar, e o total tem de ser o total —
            com o IVA decomposto do valor acordado, não somado a ele. */}
        <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-left">
          {/*
            O IVA só aparece a quem o liquida. O regime é do profissional, não
            nosso: um isento pelo art. 53.º não cobra IVA nenhum, e mostrar uma
            linha de 23% a quem o contrata seria mostrar-lhe um imposto que não
            deve — e que ninguém pode entregar ao Estado.
          */}
          {acordada.regimeIva === "normal" ? (
            <>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-slate-600">Serviço (sem IVA)</span>
                <span className="text-slate-900">
                  {euros(decomporIva(acordada.valorAcordado ?? 0).base)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-4 text-sm">
                <span className="text-slate-600">IVA ({Math.round(TAXA_IVA * 100)}%)</span>
                <span className="text-slate-900">
                  {euros(decomporIva(acordada.valorAcordado ?? 0).iva)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-slate-100 pt-1 text-sm">
                <span className="font-medium text-slate-700">Valor acordado</span>
                <span className="font-semibold text-slate-900">
                  {euros(acordada.valorAcordado)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-slate-600">
                Valor acordado
                <span className="block text-xs text-tinta-fraca">
                  isento de IVA (art. 53.º)
                </span>
              </span>
              <span className="font-semibold text-slate-900">
                {euros(acordada.valorAcordado)}
              </span>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-4 text-sm">
            <span className="text-slate-600">Taxa CLYON</span>
            <span className="font-semibold text-slate-900">
              {euros(
                quantoOClientePaga(acordada.valorAcordado ?? 0) -
                  (acordada.valorAcordado ?? 0),
              )}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-slate-200 pt-2">
            <span className="text-sm font-semibold text-slate-900">Total a pagar</span>
            <span className="text-lg font-bold text-emerald-700">
              {euros(quantoOClientePaga(acordada.valorAcordado ?? 0))}
            </span>
          </div>
        </div>
        {/* ── O que falta acontecer ───────────────────────────────────────── */}
        {acordada.fase === "a_executar" && (
          <div className="mt-4 text-left">
            <p className="text-xs leading-relaxed text-emerald-700">
              O valor fica retido na CLYON e só chega a {acordada.profissionalNome} depois
              de o trabalho estar feito e de si o confirmar aqui.
            </p>
            {acordada.profissionalTelefone && (
              <a
                href={`tel:${acordada.profissionalTelefone}`}
                className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-white px-4 font-semibold text-emerald-800 transition active:bg-emerald-50"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Ligar a {acordada.profissionalNome}
              </a>
            )}
          </div>
        )}

        {acordada.fase === "a_confirmar" && (
          <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 text-left">
            <h3 className="flex items-center gap-2 text-sm font-bold text-tinta">
              <Camera className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {acordada.profissionalNome} diz que está feito
            </h3>

            {/* A prova em grande. É sobre isto que se decide confirmar — numa
                miniatura de sessenta píxeis não se vê se ficou feito. */}
            {prova && prova.fotos.length > 0 && (
              <div className="mt-3 space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={prova.fotos[0]}
                  alt="Fotografia do trabalho feito"
                  className="max-h-72 w-full rounded-xl object-cover ring-1 ring-slate-200"
                />
                {prova.fotos.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {prova.fotos.slice(1).map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt={`Fotografia ${i + 2} do trabalho feito`}
                        className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {prova?.nota && (
              <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                {prova.nota}
              </p>
            )}

            {erro && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            )}

            <button
              onClick={() => agir(acordada.id, "confirmar")}
              disabled={aEnviar === acordada.id}
              className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white transition active:bg-emerald-700 disabled:opacity-50"
            >
              {aEnviar === acordada.id && (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              )}
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              Está bem feito, libertar o pagamento
            </button>

            {acordada.diasAteLibertar != null && (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Se não disser nada, o valor é libertado sozinho daqui a{" "}
                {Math.ceil(acordada.diasAteLibertar)} dia
                {Math.ceil(acordada.diasAteLibertar) === 1 ? "" : "s"}. Se alguma coisa
                estiver mal, fale connosco antes disso.
              </p>
            )}
          </div>
        )}

        {(acordada.fase === "confirmado" || acordada.fase === "pago") && (
          <>
            <p className="mt-4 rounded-xl border border-emerald-300 bg-white p-3 text-sm text-emerald-800">
              Confirmou que está feito e o pagamento foi libertado. Obrigado.
            </p>

            {/* A avaliação, depois de confirmar e só depois.
                É a única coisa que um profissional novo não pode comprar, e é
                o que faz o preço deixar de ser o único critério. Pedida agora,
                que é quando a memória do trabalho ainda está fresca. */}
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-left">
              {acordada.estrelas ? (
                <p className="flex items-center justify-center gap-1 text-sm text-slate-600">
                  A sua avaliação:
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-4 w-4 ${
                        n <= (acordada.estrelas ?? 0)
                          ? "fill-[#00B4CC] text-[#00B4CC]"
                          : "text-slate-300"
                      }`}
                      aria-hidden="true"
                    />
                  ))}
                </p>
              ) : (
                <>
                  <p className="text-center text-sm font-semibold text-tinta">
                    Como correu com {acordada.profissionalNome}?
                  </p>
                  <div className="mt-2 flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setEstrelas(n)}
                        aria-label={`${n} de 5 estrelas`}
                        className="p-1"
                      >
                        <Star
                          className={`h-8 w-8 transition ${
                            n <= estrelas
                              ? "fill-[#00B4CC] text-[#00B4CC]"
                              : "text-slate-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  {estrelas > 0 && (
                    <>
                      <textarea
                        value={comentario}
                        onChange={(ev) => setComentario(ev.target.value)}
                        rows={2}
                        placeholder="Quer deixar uma palavra? (opcional)"
                        className="mt-3 w-full rounded-xl border-2 border-gray-300 p-3 text-sm outline-none focus:border-cyan-600"
                      />
                      <button
                        onClick={() => agir(acordada.id, "avaliar")}
                        disabled={aEnviar === acordada.id}
                        className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-acao font-bold text-white transition active:bg-acao-hover disabled:opacity-40"
                      >
                        {aEnviar === acordada.id && (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        )}
                        Enviar avaliação
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </section>
    );
  }

  const activas = negociacoes.filter(
    (n) => n.estado === "aberta" || n.estado === "aguarda_contratacao",
  );

  if (activas.length === 0) {
    return (
      <section className="mt-4 rounded-2xl border border-[#E2EEF3] bg-white p-5 text-center shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-tinta-fraca">Propostas</h2>
        <p className="mt-3 text-sm text-slate-500">
          Ainda não há propostas. Assim que um profissional responder, aparece aqui — e
          avisamos por email.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-tinta-fraca">
        {activas.length} {activas.length === 1 ? "profissional" : "profissionais"} a responder
      </h2>

      {erro && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="space-y-3">
        {activas.map((n) => {
          const estado: Negociacao = {
            estado: n.estado as Negociacao["estado"],
            valorAcordado: n.valorAcordado,
            propostas: n.propostas,
          };
          const agora = new Date();
          const accoes = accoesDisponiveis(estado, "cliente", agora);
          const pendente = propostaPendente(estado, agora);
          const restantes = propostasRestantes(estado, "cliente", agora);
          const emCima = pendente?.valor ?? n.valorAcordado;
          const aguarda = n.estado === "aguarda_contratacao";

          return (
            <article
              key={n.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                aguarda ? "border-emerald-300 ring-1 ring-emerald-200" : "border-[#E2EEF3]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-tinta">{n.profissionalNome}</h3>
                  {/*
                    A homepage promete "vê o nome, a nota e os trabalhos antes
                    de aceitar" — isto cumpre-a com o que É VERDADE. Sem
                    avaliações, diz-se "sem avaliações ainda"; um número
                    inventado aqui valia uma queixa à primeira desilusão.
                  */}
                  {n.perfil && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-tinta-fraca">
                      {n.perfil.quantasAvaliacoes > 0 ? (
                        <>
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                          <span className="font-semibold text-tinta">
                            {n.perfil.notaMedia?.toFixed(1).replace(".", ",")}
                          </span>
                          <span>({n.perfil.quantasAvaliacoes})</span>
                        </>
                      ) : (
                        <span>sem avaliações ainda</span>
                      )}
                      {n.perfil.trabalhosConcluidos > 0 && (
                        <span>
                          · {n.perfil.trabalhosConcluidos} trabalho
                          {n.perfil.trabalhosConcluidos === 1 ? "" : "s"} na CLYON
                        </span>
                      )}
                    </p>
                  )}
                  {/* O distintivo está sempre à vista, e não ao fim de cinco
                      propostas — não pode ser uma descoberta tardia. */}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        n.emiteFatura
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <FileText className="mr-1 inline h-3 w-3" aria-hidden="true" />
                      {n.emiteFatura ? "emite fatura" : "não emite fatura"}
                    </span>
                    {n.guiaVerificada && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <BadgeCheck className="mr-1 inline h-3 w-3" aria-hidden="true" />
                        guia verificada
                      </span>
                    )}
                  </div>
                  {/*
                    O perfil abre AQUI, no cartão, e não numa página nova:
                    /profissionais/* está atrás da chave do MVP e o cliente
                    não a tem — uma página própria dava-lhe um portão em vez
                    de um perfil. E sem contacto nenhum: o telefone só depois
                    de contratar, como a morada dele do outro lado.
                  */}
                  {n.perfil && (
                    <details className="mt-2">
                      <summary className="cursor-pointer list-none text-xs font-semibold text-acao underline-offset-4 hover:underline">
                        Ver perfil e avaliações
                      </summary>
                      <div className="mt-2 space-y-2 rounded-xl bg-[#F4F8FB] p-3">
                        <p className="text-xs leading-relaxed text-tinta-fraca">
                          {n.perfil.naClyonDesde && (
                            <>
                              Na CLYON desde{" "}
                              {new Date(n.perfil.naClyonDesde).toLocaleDateString("pt-PT", {
                                month: "long",
                                year: "numeric",
                              })}
                              .{" "}
                            </>
                          )}
                          {n.perfil.zonas.length > 0 && (
                            <>Trabalha em {n.perfil.zonas.slice(0, 5).join(", ")}</>
                          )}
                          {n.perfil.raioKm != null && <> · desloca-se até {n.perfil.raioKm} km</>}
                          {n.perfil.zonas.length > 0 || n.perfil.raioKm != null ? "." : null}
                        </p>
                        {n.perfil.avaliacoes.length === 0 ? (
                          <p className="text-xs leading-relaxed text-tinta-fraca">
                            Ainda sem avaliações — a primeira aparece aqui quando um
                            cliente confirmar um trabalho dele.
                          </p>
                        ) : (
                          n.perfil.avaliacoes.slice(0, 3).map((a, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-[#E2EEF3] bg-white p-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs tracking-widest text-amber-500">
                                  {"★".repeat(a.estrelas)}
                                  <span className="text-slate-300">
                                    {"★".repeat(Math.max(0, 5 - a.estrelas))}
                                  </span>
                                </span>
                                {a.avaliadoEm && (
                                  <span className="text-[11px] text-tinta-fraca">
                                    {new Date(a.avaliadoEm).toLocaleDateString("pt-PT")}
                                  </span>
                                )}
                              </div>
                              {a.comentario && (
                                <p className="mt-1 text-xs leading-relaxed text-tinta">
                                  {a.comentario}
                                </p>
                              )}
                              {(a.servicoTipo || a.cidade) && (
                                <p className="mt-1 text-[11px] text-tinta-fraca">
                                  {[a.servicoTipo?.replace(/_/g, " "), a.cidade]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </details>
                  )}
                </div>

                {/*
                  O valor CRU do que está em cima da mesa, sem taxa.
                  É como a Vinted faz: na conversa vêem-se os valores das
                  propostas, e a taxa aparece onde se compra. Somá-la aqui
                  fazia o número dançar a cada contraproposta por uma razão
                  que não é a negociação — e o cliente deixava de saber sobre
                  que valor estava a discutir.
                */}
                <div className="text-right">
                  <div className="text-xl font-bold text-tinta">{euros(emCima)}</div>
                  <div className="text-xs text-tinta-fraca">
                    {/*
                      "a sua proposta" ao lado do NOME DO PROFISSIONAL lia-se
                      como proposta DELE — e ele ainda não tinha dito nada. O
                      valor de abertura é do cliente, e a etiqueta tem de dizer
                      que se está à espera, não que alguém respondeu.
                    */}
                    {pendente?.por === "profissional"
                      ? "proposta dele"
                      : "o seu valor — à espera da resposta"}
                  </div>
                </div>
              </div>

              {aguarda && (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <strong>Aceitou o seu valor.</strong> Falta confirmar que o contrata.
                </p>
              )}

              <div className="mt-4 space-y-2">
                {accoes.includes("contratar") && (
                  <button
                    onClick={() => agir(n.id, "contratar")}
                    disabled={aEnviar === n.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {aEnviar === n.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Contratar este profissional
                  </button>
                )}

                {accoes.includes("aceitar") && (
                  <button
                    onClick={() => agir(n.id, "aceitar")}
                    disabled={aEnviar === n.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <HandCoins className="h-4 w-4" aria-hidden="true" />
                    Aceitar e contratar
                  </button>
                )}

                {accoes.includes("propor") && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      {accoes.includes("aceitar") || accoes.includes("contratar")
                        ? "Ou proponha outro valor"
                        : "Proponha um valor"}
                    </p>
                    <EscolherValor
                      referencia={emCima}
                      direccao="abaixo"
                      aEnviar={aEnviar === n.id}
                      legendaDoValor={(v) =>
                        `Se ele aceitar, paga ${euros(quantoOClientePaga(v))} com a taxa CLYON.`
                      }
                      onPropor={(valor) => agir(n.id, "propor", valor)}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {restantes} de {MAX_PROPOSTAS_POR_LADO} propostas por usar.
                    </p>
                  </div>
                )}
              </div>

              {/* O mesmo registo que o profissional vê do lado dele. Um
                  histórico em que cada lado lê uma versão diferente não serve
                  para resolver nada quando houver desacordo. */}
              <HistoricoDaNegociacao
                propostas={n.propostas}
                marcos={{
                  execucaoEnviadaEm: n.execucaoEnviadaEm,
                  confirmadoEm: n.confirmadoEm,
                  pagoEm: n.pagoEm,
                  avaliadoEm: n.avaliadoEm,
                  estrelas: n.estrelas,
                  valorAcordado: n.valorAcordado,
                }}
                euSou="cliente"
              />
            </article>
          );
        })}
      </div>

      <Nota titulo="O que acontece quando aceita" className="mt-4">
        Aceitar ou contratar fecha o trabalho com esse profissional, e as outras
        negociações terminam nesse momento. Tem cinco propostas de cada lado e 48
        horas para responder a cada uma.
      </Nota>

      {/*
        DESISTIR DO PEDIDO TODO — o direito do outro lado.

        "Essa opção deve ser absoluta: tanto a CLYON quanto o Rui devem ter esse
        direito."

        Já se podia desistir de UMA proposta, e não é a mesma coisa: quem mudou
        de ideias sobre o trabalho inteiro tinha de as recusar uma a uma, ou
        telefonar a pedir que alguém o fizesse por si. Enquanto isso, o pedido
        ficava vivo e os profissionais à espera de uma resposta que não vinha.

        Fica em baixo e discreto de propósito: é a saída, não um passo do
        caminho. Mas está lá, e não pergunta a ninguém se pode.
      */}
      {!cancelado && (
        <div className="mt-6 border-t border-slate-200 pt-5 text-center">
          <button
            onClick={cancelarOPedido}
            disabled={aEnviar === -1}
            className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-red-600 disabled:opacity-50"
          >
            {aEnviar === -1 ? "A cancelar…" : "Já não preciso deste serviço — cancelar o pedido"}
          </button>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-400">
            As propostas terminam e ninguém volta a contactá-lo sobre este pedido.
            Não paga nada.
          </p>
        </div>
      )}
    </section>
  );
}
