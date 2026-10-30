"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Miniatura } from "@/components/Anexo";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock,
  HandCoins,
  Loader2,
  Phone,
  Star,
} from "lucide-react";
import { MAX_PROPOSTAS_POR_LADO, MAX_PROPOSTAS_POR_EXTENSO } from "@/lib/negociacao";
import { ORCAMENTOS_A_DISTANCIA, ORCAMENTO_A_DISTANCIA } from "@/lib/orcamento-a-distancia";
import EscolherValor from "@/components/EscolherValor";
import Nota from "@/components/Nota";
import PagarTrabalho from "@/components/PagarTrabalho";
import AjusteNoLocal from "./AjusteNoLocal";
import HistoricoDaProposta from "./HistoricoDaProposta";
import type { NegociacaoNoEcra } from "@/lib/negociacao-no-ecra";
import { avaliacoesNaClyon } from "@/lib/avaliacoes-publicas";
import { perguntaDeRecusar } from "@/lib/recusar-proposta";
import { CONFIRMO_QUE_CHEGOU, O_PARCEIRO_DIZ_QUE_CHEGOU } from "@/lib/viagem-ate-ao-cliente";

/**
 * As propostas que o cliente recebeu.
 *
 * Vários profissionais podem estar a negociar o mesmo pedido ao mesmo tempo, e
 * é por isso que isto é uma lista e não um ecrã só. O cliente escolhe quem lhe
 * entra em casa — e é esse o segundo passo do aperto de mão duplo: um
 * profissional aceitar não fecha nada.
 *
 * UM NÚMERO SÓ, JÁ COM A TAXA — 29-09-2026, e COM O IVA LÁ DENTRO desde
 * 01-10-2026 (as negociações abertas antes do corte continuam sem IVA até ao
 * fim, para ninguém ver um preço mudar a meio).
 *
 * ⚠️ ESTE ECRÃ NÃO FAZ CONTAS — 28-10-2026 (d10). Recebia a negociação com o
 * valor do profissional, as propostas em bruto e a taxa do cliente, e fazia o
 * preço no browser: os três viajavam no HTML da página e no JSON da conta, e
 * com eles via-se quanto recebe o profissional e quanto fica a plataforma.
 * Agora o servidor manda a negociação pronta (`negociacao-no-ecra.ts`): os
 * textos do preço — os mesmos da app de cliente, carácter a carácter —, as
 * acções que se podem fazer agora, e a linha do tempo já no preço dele. O que
 * ele escreve numa contraproposta vai como `preco`, e é o servidor que o
 * converte. Depois de cada acção, quem mostra volta a perguntar ao servidor
 * (a página com `router.refresh()`, a conta relendo os pedidos).
 */
export type { NegociacaoNoEcra };

export default function PropostasRecebidas({
  token,
  pedidoId,
  negociacoesIniciais,
  onMudou,
  precisaFatura = false,
  telefoneDoCliente,
  soParaVer = false,
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
  negociacoesIniciais: NegociacaoNoEcra[];
  /** Para a conta voltar a ler os pedidos depois de uma acção. */
  onMudou?: () => void;
  /** O que ele respondeu no pedido. Serve de valor de partida no pagamento. */
  precisaFatura?: boolean;
  /** Para não o obrigar a escrever o telemóvel outra vez no MB WAY. */
  telefoneDoCliente?: string | null;
  /**
   * O BACKOFFICE ESTÁ A CONFERIR, NÃO A DECIDIR PELO CLIENTE.
   *
   * "Ver como o cliente" abre esta mesma lista para o administrador poder
   * conferir o que o cliente tem à frente. Sem isto, ele tinha à frente os
   * botões de aceitar e de recusar — e um clique distraído fechava um negócio
   * de centenas de euros em nome de outra pessoa, com o histórico a dizer que
   * tinha sido o cliente a fazê-lo.
   *
   * A vista é a mesma; os gestos não. É essa a diferença entre conferir e
   * agir.
   */
  soParaVer?: boolean;
}) {
  const router = useRouter();
  const [negociacoes, setNegociacoes] = useState(negociacoesIniciais);
  // O servidor manda a lista nova depois de cada acção: o ecrã acompanha-a.
  useEffect(() => setNegociacoes(negociacoesIniciais), [negociacoesIniciais]);
  const [aEnviar, setAEnviar] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  // O pedido cancelado nesta sessão: o ecrã tem de mudar sem esperar por um
  // recarregamento, senão ele carrega, some o botão e nada parece ter mudado.
  const [cancelado, setCancelado] = useState(false);
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");

  /** Volta a perguntar ao servidor como ficou: é ele que sabe o preço e o estado. */
  function recarregar() {
    if (onMudou) onMudou();
    else router.refresh();
  }

  const urlDaAccao = token ? `/api/negociacao/${token}` : "/api/users/me/negociacao";

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
      "Porquê? (ajuda-nos e ajuda os parceiros — pode deixar em branco)",
      "",
    );
    if (motivo === null) return;

    setAEnviar(-1);
    setErro("");
    try {
      let res = await fetch(urlDaAccao, {
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
        res = await fetch(urlDaAccao, {
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
      recarregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(null);
    }
  }

  /** `preco` é o que o cliente escreveu — o que ele paga. O servidor converte-o. */
  async function agir(id: number, accao: string, preco?: string) {
    setAEnviar(id);
    setErro("");
    try {
      const res = await fetch(urlDaAccao, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accao,
          preco,
          negociacaoId: id,
          pedidoId,
          ...(accao === "avaliar" ? { estrelas, comentario } : {}),
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        // 409: o outro lado mudou entretanto — mostra-se como ficou.
        if (res.status === 409) recarregar();
        return;
      }
      // O que já se sabe sem perguntar: confirmar e avaliar só mudam este cartão.
      setNegociacoes((lista) =>
        lista.map((n) =>
          n.id !== id
            ? n
            : dados.confirmado
              ? { ...n, fase: "confirmado" as const, accoes: [], diasAteLibertarTexto: null }
              : dados.avaliado
                ? { ...n, estrelas, avaliado: true }
                : n,
        ),
      );
      recarregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(null);
    }
  }

  const acordada = negociacoes.find((n) => n.estado === "acordada");

  if (acordada) {
    const nome = acordada.profissional.nome;
    const telefone = acordada.profissional.telefone;
    return (
      <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        {/* O ajuste no local por responder vem antes de tudo — ver AjusteNoLocal.tsx. */}
        {acordada.ajuste && (
          <AjusteNoLocal
            ajuste={acordada.ajuste}
            profissionalNome={nome}
            profissionalTelefone={telefone}
            porCarga={acordada.porCarga}
            aEnviar={aEnviar === acordada.id}
            soParaVer={soParaVer}
            onResponder={(accao) => void agir(acordada.id, accao)}
          />
        )}
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-2 text-lg font-bold text-emerald-900">
          Contratou {nome}
        </h2>
        {/*
          UM TOTAL — O QUE ELE PAGA. Sem a taxa à parte (29-09-2026) e, desde
          01-10-2026, com o IVA lá dentro e o sem IVA ao lado (03-10-2026). Os
          textos vêm do servidor, os mesmos da app de cliente.
        */}
        {acordada.preco && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-left">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-semibold text-slate-900">Total a pagar</span>
              <span className="text-right text-lg font-bold text-emerald-700">{acordada.preco.principal}</span>
            </div>
            {acordada.valores?.ivaIncluido && (
              <p className="mt-1 text-right text-xs tabular-nums text-slate-600">{acordada.preco.detalhe}</p>
            )}
            {/*
              COM IVA INCLUÍDO, EM DINHEIRO HÁ UMA ENTREGA SÓ — 01-10-2026. O
              cliente paga o preço inteiro ao profissional; o IVA e o que é da
              CLYON é o profissional que lhos entrega depois.
            */}
            {acordada.valores?.ivaIncluido && acordada.emDinheiro && (
              <div className="mt-2 border-t border-slate-200 pt-2 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-slate-600">Em dinheiro, ao parceiro, no local</span>
                  <span className="font-semibold text-slate-900">{acordada.preco.principal}</span>
                </div>
              </div>
            )}
            {/*
              EM DINHEIRO ANTES DO IVA INCLUÍDO SÃO DUAS ENTREGAS — 21-09-2026.
              Diz-se o que vai para cada lado, que é o que ele paga a cada um.
            */}
            {acordada.emDuasEntregas && (
              <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-slate-600">Em dinheiro, ao parceiro</span>
                  <span className="font-semibold text-slate-900">{acordada.emDuasEntregas.aoProfissional}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-slate-600">À CLYON, por referência</span>
                  <span className="font-semibold text-slate-900">{acordada.emDuasEntregas.aCLYON}</span>
                </div>
              </div>
            )}
            <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-tinta-fraca">
              {acordada.valores?.ivaIncluido ? "Valor com IVA incluído. Recebe fatura." : acordada.preco.detalhe}{" "}
              {/*
                E COMO É QUE O NÚMERO FOI FEITO — ver `orcamento-a-distancia.ts`.
                Já está contratado, e o que falta é o dia: se o valor mudar à
                porta, é agora que ele tem de saber que isso é possível.
              */}
              {ORCAMENTO_A_DISTANCIA}
            </p>
          </div>
        )}
        {/*
          ONDE SE PAGA — e só enquanto houver o que pagar.
          Depois de confirmado ou pago, o trabalho está fechado e não há nada a
          cobrar. O componente decide-se com o servidor: se a cobrança não
          estiver aberta, não desenha nada em vez de mostrar uma caixa que dá
          erro a quem carregar nela.
        */}
        {pedidoId != null &&
          (acordada.fase === "a_executar" || acordada.fase === "a_confirmar") && (
            <PagarTrabalho
              pedidoId={pedidoId}
              negociacaoId={acordada.id}
              token={token}
              precisaFatura={precisaFatura}
              telefoneSugerido={telefoneDoCliente}
              soParaVer={soParaVer}
              formaDePagamento={acordada.formaDePagamento ?? null}
            />
          )}
        {/* ── O que falta acontecer ───────────────────────────────────────── */}
        {acordada.fase === "a_executar" && (
          <div className="mt-4 text-left">
            {/* O dia combinado, «a caminho» e «chegou», como na app (S21, 29-10-2026). */}
            {acordada.estadoTexto && (
              <p className="mb-2 text-sm font-semibold text-emerald-800">{acordada.estadoTexto}</p>
            )}
            {/*
              «O PARCEIRO DIZ QUE CHEGOU» — 30-10-2026. Ele marcou «Cheguei» na
              app; o trabalho só se conclui depois de o cliente confirmar
              (viagem-ate-ao-cliente.ts). O mesmo botão da app de cliente.
            */}
            {acordada.accoes.includes("confirmar_chegada") && (
              <div className="mb-3 rounded-xl border border-emerald-300 bg-white p-3">
                <p className="text-sm font-bold text-tinta">{O_PARCEIRO_DIZ_QUE_CHEGOU}</p>
                {acordada.chegouEmTexto && (
                  <p className="mt-1 text-xs text-slate-600">Às {acordada.chegouEmTexto}.</p>
                )}
                {erro && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
                )}
                <button
                  onClick={() => agir(acordada.id, "confirmar_chegada")}
                  disabled={soParaVer || aEnviar === acordada.id}
                  className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white transition active:bg-emerald-700 disabled:opacity-50"
                >
                  {aEnviar === acordada.id && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  {CONFIRMO_QUE_CHEGOU}
                </button>
              </div>
            )}
            {!acordada.accoes.includes("confirmar_chegada") && acordada.viagemTexto && (
              <p className="mb-2 text-xs text-emerald-700">{acordada.viagemTexto}</p>
            )}
            <p className="text-xs leading-relaxed text-emerald-700">{acordada.formaTexto}</p>
            {telefone && (
              <a
                href={`tel:${telefone}`}
                className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-white px-4 font-semibold text-emerald-800 transition active:bg-emerald-50"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Ligar a {nome}
              </a>
            )}
          </div>
        )}

        {acordada.fase === "a_confirmar" && (
          <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 text-left">
            <h3 className="flex items-center gap-2 text-sm font-bold text-tinta">
              <Camera className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {nome} diz que está feito
            </h3>
            {/* Sem fotografias, quem confirma é a CLYON, com ele (d22; S21, 29-10-2026). */}
            {acordada.prova.length === 0 && (
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Marcou-o sem fotografias. A CLYON confirma consigo antes de libertar o pagamento.
              </p>
            )}

            {/* A prova em grande. É sobre isto que se decide confirmar — numa
                miniatura de sessenta píxeis não se vê se ficou feito. */}
            {acordada.prova.length > 0 && (
              <div className="mt-3 space-y-2">
                {/* A prova pode ser uma foto, um video ou um PDF. Ver `Anexo.tsx`. */}
                <Miniatura url={acordada.prova[0]} className="h-64 w-full" tamanho="(max-width: 640px) 100vw, 640px" />
                {acordada.prova.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {acordada.prova.slice(1).map((url) => (
                      <Miniatura key={url} url={url} className="aspect-square w-full" tamanho="(max-width: 640px) 25vw, 160px" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {acordada.provaNota && (
              <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                {acordada.provaNota}
              </p>
            )}

            {erro && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            )}

            <button
              onClick={() => agir(acordada.id, "confirmar")}
              disabled={soParaVer || aEnviar === acordada.id}
              className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white transition active:bg-emerald-700 disabled:opacity-50"
            >
              {aEnviar === acordada.id && (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              )}
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              {acordada.botaoDeConfirmar}
            </button>

            {acordada.diasAteLibertarTexto && (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {acordada.diasAteLibertarTexto}
              </p>
            )}
          </div>
        )}

        {/*
          DEPOIS DO TRABALHO FEITO, O «PAGO» TAMBÉM SE VÊ — 27-10-2026 (d16).
          O trabalho dá-se por feito e só depois se cobra: quem pagou nessa
          altura tem de ver aqui que o pagamento chegou. Só a confirmação —
          nada para pagar.
        */}
        {pedidoId != null && (acordada.fase === "confirmado" || acordada.fase === "pago") && (
          <PagarTrabalho
            pedidoId={pedidoId}
            negociacaoId={acordada.id}
            token={token}
            soParaVer
            soSePago
            formaDePagamento={acordada.formaDePagamento ?? null}
          />
        )}
        {(acordada.fase === "confirmado" || acordada.fase === "pago") && (
          <>
            <p className="mt-4 rounded-xl border border-emerald-300 bg-white p-3 text-sm text-emerald-800">
              {acordada.formaTexto}
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
                    Como correu com {nome}?
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
                        disabled={soParaVer || aEnviar === acordada.id}
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
          Ainda não há propostas. Assim que um parceiro responder, aparece aqui — e
          avisamos por email.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4">
      {/*
        «RESPONDERAM», e não «a responder». A lista mostra apenas quem fez
        proposta (`oClienteVeEsta`, no servidor), e o número conta quem
        respondeu — a única coisa com que o cliente pode fazer alguma coisa.
      */}
      <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-tinta-fraca">
        {activas.length === 1
          ? "1 parceiro respondeu"
          : `${activas.length} parceiros responderam`}
      </h2>

      {/*
        O QUE ESTES NÚMEROS SÃO, antes de ele escolher um (18-09-2026). Por
        cima dos cartões e não num rodapé: quem decide, decide a olhar para os
        valores.
      */}
      <p className="mb-3 text-xs leading-relaxed text-tinta-fraca">
        {ORCAMENTOS_A_DISTANCIA}
      </p>

      {erro && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="space-y-3">
        {activas.map((n) => {
          const p = n.profissional;
          return (
            <article
              key={n.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                n.aguardaContratacao ? "border-emerald-300 ring-1 ring-emerald-200" : "border-[#E2EEF3]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-tinta">{p.nome}</h3>
                  {/*
                    A homepage promete "vê o nome, a nota e os trabalhos antes
                    de aceitar" — isto cumpre-a com o que É VERDADE. Sem
                    avaliações, diz-se "sem avaliações ainda".
                  */}
                  {n.temPerfil && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-tinta-fraca">
                      {p.quantasAvaliacoes > 0 && p.notaMedia != null ? (
                        <>
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                          <span className="font-semibold text-tinta">
                            {p.notaMedia.toFixed(1).replace(".", ",")}
                          </span>
                          <span>({avaliacoesNaClyon(p.quantasAvaliacoes)})</span>
                        </>
                      ) : (
                        <span>sem avaliações ainda</span>
                      )}
                      {p.trabalhosConcluidos > 0 && (
                        <span>
                          · {p.trabalhosConcluidos} trabalho
                          {p.trabalhosConcluidos === 1 ? "" : "s"} na CLYON
                        </span>
                      )}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.guiaVerificada && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <BadgeCheck className="mr-1 inline h-3 w-3" aria-hidden="true" />
                        guia verificada
                      </span>
                    )}
                  </div>
                  {/*
                    O perfil abre AQUI, no cartão, e não numa página nova — e sem
                    contacto nenhum: o telefone só depois de contratar.
                  */}
                  {n.temPerfil && (
                    <details className="mt-2">
                      <summary className="cursor-pointer list-none text-xs font-semibold text-acao underline-offset-4 hover:underline">
                        Ver perfil e avaliações
                      </summary>
                      <div className="mt-2 space-y-2 rounded-xl bg-[#F4F8FB] p-3">
                        <p className="text-xs leading-relaxed text-tinta-fraca">
                          {p.naClyonDesdeTexto && <>Na CLYON desde {p.naClyonDesdeTexto}. </>}
                          {p.raioKm != null && <>Desloca-se até {p.raioKm} km.</>}
                        </p>
                        {p.avaliacoes.length === 0 ? (
                          <p className="text-xs leading-relaxed text-tinta-fraca">
                            Ainda sem avaliações — a primeira aparece aqui quando um
                            cliente confirmar um trabalho dele.
                          </p>
                        ) : (
                          p.avaliacoes.slice(0, 3).map((a, i) => (
                            <div key={i} className="rounded-lg border border-[#E2EEF3] bg-white p-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs tracking-widest text-amber-500">
                                  {"★".repeat(a.estrelas)}
                                  <span className="text-slate-300">
                                    {"★".repeat(Math.max(0, 5 - a.estrelas))}
                                  </span>
                                </span>
                                {a.quando && <span className="text-[11px] text-tinta-fraca">{a.quando}</span>}
                              </div>
                              {a.comentario && (
                                <p className="mt-1 text-xs leading-relaxed text-tinta">{a.comentario}</p>
                              )}
                              {(a.servico || a.cidade) && (
                                <p className="mt-1 text-[11px] text-tinta-fraca">
                                  {[a.servico, a.cidade].filter(Boolean).join(" · ")}
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
                  O PREÇO DELE, E SÓ ESSE — o que sai da carteira dele, com o
                  sem IVA dito como parte dele. Os textos são os da app.
                */}
                <div className="text-right">
                  <div className="text-xl font-bold text-tinta">{n.preco?.principal ?? "—"}</div>
                  {n.preco && <div className="text-xs tabular-nums text-slate-600">{n.preco.detalhe}</div>}
                  <div className="text-xs text-tinta-fraca">{n.precoEtiqueta}</div>
                </div>
              </div>

              {n.aguardaContratacao && (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <strong>Aceitou o seu valor.</strong> Falta confirmar que o contrata.
                </p>
              )}

              <div className="mt-4 space-y-2">
                {n.accoes.includes("contratar") && (
                  <button
                    onClick={() => agir(n.id, "contratar")}
                    disabled={soParaVer || aEnviar === n.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {aEnviar === n.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Contratar este parceiro
                  </button>
                )}

                {n.accoes.includes("aceitar") && (
                  <button
                    onClick={() => agir(n.id, "aceitar")}
                    disabled={soParaVer || aEnviar === n.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <HandCoins className="h-4 w-4" aria-hidden="true" />
                    Aceitar e contratar
                  </button>
                )}

                {/*
                  «RECUSAR» — 28-10-2026 (S8; P4 do dono). A proposta sai da
                  lista, as outras continuam, e o profissional é avisado (no
                  telemóvel e por email). A pergunta é a mesma da app.
                */}
                {n.accoes.includes("desistir") && !soParaVer && (
                  <button
                    type="button"
                    disabled={aEnviar === n.id}
                    onClick={() => {
                      if (window.confirm(perguntaDeRecusar(p.nome, activas.length > 1))) void agir(n.id, "desistir");
                    }}
                    className="w-full py-1 text-center text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-red-600 disabled:opacity-50"
                  >
                    Recusar
                  </button>
                )}

                {n.accoes.includes("propor") && !soParaVer && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      {n.accoes.includes("aceitar") || n.accoes.includes("contratar")
                        ? "Ou proponha outro valor"
                        : "Proponha um valor"}
                    </p>
                    {/*
                      ELE ESCREVE O QUE PAGA — 29-09-2026. Os atalhos partem do
                      preço dele; o número escrito vai como `preco`, e é o
                      servidor que o converte no valor do profissional (e o
                      arredonda ao cêntimo possível).
                    */}
                    <EscolherValor
                      referencia={n.valores?.aPagar ?? null}
                      direccao="abaixo"
                      aEnviar={aEnviar === n.id}
                      legendaDoValor={() =>
                        n.valores?.ivaIncluido
                          ? "É o que paga se ele aceitar, com IVA incluído."
                          : "É o que paga se ele aceitar, sem IVA."
                      }
                      onPropor={(preco) => agir(n.id, "propor", preco)}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {n.propostasRestantes} de {MAX_PROPOSTAS_POR_LADO} propostas por usar.
                    </p>
                  </div>
                )}
              </div>

              {/* O mesmo registo que o profissional vê do lado dele, já no preço do cliente. */}
              <HistoricoDaProposta eventos={n.historico} />
            </article>
          );
        })}
      </div>

      <Nota titulo="O que acontece quando aceita" className="mt-4">
        Aceitar ou contratar fecha o trabalho com esse parceiro, e as outras
        negociações terminam nesse momento. Tem {MAX_PROPOSTAS_POR_EXTENSO} propostas de
        cada lado, e não há prazo: decida com o tempo que precisar.
      </Nota>

      {/*
        DESISTIR DO PEDIDO TODO — o direito do outro lado.

        "Essa opção deve ser absoluta: tanto a CLYON quanto o Valter devem ter esse
        direito." Fica em baixo e discreto de propósito: é a saída, não um passo
        do caminho.
      */}
      {!cancelado && (
        <div className="mt-6 border-t border-slate-200 pt-5 text-center">
          <button
            onClick={cancelarOPedido}
            disabled={soParaVer || aEnviar === -1}
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
