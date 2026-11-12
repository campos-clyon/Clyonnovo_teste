"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, Loader2, X } from "lucide-react";
import { CATEGORIAS_DOS_PROFISSIONAIS } from "@/lib/service-categories";
import { origemDaVisita } from "@/lib/origem-da-visita";
import { origemParaACandidatura } from "@/lib/origem-da-candidatura";
import { paginaAnterior } from "@/lib/pagina-anterior";
import { reduzirImagem } from "@/lib/reduzir-imagem";
import {
  AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA,
  MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA,
  MENSAGEM_SEM_FOTOGRAFIA,
  ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA,
} from "@/lib/fotografias-da-carrinha";
import {
  camposComErro,
  idDoCampo,
  resumoDoQueFalta,
  separarErrosDaCandidatura,
  type ErroDaCandidatura,
} from "@/lib/campos-da-candidatura";

/**
 * O tecto do Vercel é 4,5 MB de corpo; abaixo disto, com folga. A fotografia
 * passa antes pela redução (1920 px), e quase todas ficam muito abaixo.
 */
const LIMITE_DO_ENVIO = 4 * 1024 * 1024;

/**
 * O formulário de quem se quer tornar parceiro.
 *
 * Sete campos (as fotografias da carrinha desde 04-11-2026, d17), e nenhum
 * deles é papelada. O NIF, a morada fiscal, o IBAN e o
 * raio ficam para depois do convite — pedir tudo à cabeça a alguém que ainda
 * não decidiu se quer é a forma mais rápida de o perder no terceiro campo.
 *
 * Os erros aparecem POR BAIXO DO BOTÃO e não no topo: num telemóvel, uma
 * mensagem no topo nasce fora do que se está a ver, e fica a ideia de que o
 * botão não fez nada.
 */

const VEICULOS = [
  { id: "carrinha_pequena", label: "Carrinha pequena (até 3 m³)" },
  { id: "carrinha_media", label: "Carrinha média (3 a 8 m³)" },
  { id: "carrinha_grande", label: "Carrinha grande (8 a 15 m³)" },
  { id: "camiao", label: "Camião (mais de 15 m³)" },
  { id: "sem_veiculo", label: "Não tenho viatura própria" },
];

const CAIXA =
  "w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-600";

export default function FormularioDeCandidatura() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState("");
  const [servicos, setServicos] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState("");
  /* As fotografias da carrinha (04-11-2026, d17): os endereços que o envio devolveu. */
  const [fotografias, setFotografias] = useState<string[]>([]);
  const [aJuntar, setAJuntar] = useState(false);

  const [aEnviar, setAEnviar] = useState(false);
  const [erros, setErros] = useState<ErroDaCandidatura[]>([]);
  /* Sobe a cada envio recusado: é o sinal para o ecrã descer até ao primeiro campo com erro. */
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const [feito, setFeito] = useState(false);

  const erroDe = (campo: string) => erros.find((e) => e.campo === campo)?.mensagem;

  /*
   * DESCER ATÉ AO PRIMEIRO CAMPO COM ERRO, E FOCÁ-LO — 12-11-2026 (d9).
   *
   * Só depois de um envio recusado (`pedidoDeFoco`), e não a cada erro que
   * muda: escolher um serviço limpa o erro dele, e o ecrã não pode saltar
   * para outro campo enquanto a pessoa escreve.
   */
  useEffect(() => {
    if (pedidoDeFoco === 0) return;
    const primeiro = camposComErro(erros)[0];
    if (!primeiro) return;
    const caixa = document.getElementById(idDoCampo(primeiro));
    if (!caixa) return;
    caixa.scrollIntoView({ behavior: "smooth", block: "center" });
    const alvo = caixa.querySelector<HTMLElement>("input, select, textarea, button") ?? caixa;
    alvo.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoDeFoco]);

  function recusar(lista: ErroDaCandidatura[]) {
    setErros(lista);
    setPedidoDeFoco((n) => n + 1);
  }

  function alternar(id: string) {
    setServicos((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setErros((e) => e.filter((x) => x.campo !== "servicos"));
  }

  /*
   * JUNTAR AS FOTOGRAFIAS — uma a uma, cada uma vale por si.
   *
   * Sobem logo, para o envio da candidatura levar só os endereços. Uma que
   * falhe diz porquê por baixo do campo e não leva as outras com ela.
   */
  async function juntarFotografias(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const cabem = MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA - fotografias.length;
    const escolhidas = Array.from(lista).slice(0, Math.max(0, cabem));
    setErros((e) => e.filter((x) => x.campo !== "fotografias"));
    setAJuntar(true);
    try {
      for (const original of escolhidas) {
        let f = original;
        try {
          f = (await reduzirImagem(original)).ficheiro;
        } catch {
          /* segue o original */
        }
        if (f.size > LIMITE_DO_ENVIO) {
          setErros((e) => [
            ...e,
            { campo: "fotografias", mensagem: "Uma fotografia é grande de mais. Tire-a com menos qualidade ou escolha outra." },
          ]);
          break;
        }
        const fd = new FormData();
        fd.append("file", f, f.name);
        const res = await fetch("/api/parceiros/candidatura/fotografias", { method: "POST", body: fd });
        const dados = await res.json().catch(() => ({}));
        if (!res.ok || typeof dados.url !== "string") {
          setErros((e) => [
            ...e,
            { campo: "fotografias", mensagem: dados.error ?? "A fotografia não seguiu. Tente outra vez." },
          ]);
          break;
        }
        setFotografias((l) => (l.length < MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA ? [...l, dados.url] : l));
      }
    } catch {
      setErros((e) => [...e, { campo: "fotografias", mensagem: "Sem ligação. Tente juntar a fotografia outra vez." }]);
    } finally {
      setAJuntar(false);
    }
  }

  async function enviar() {
    setErros([]);
    // Sem fotografia, a candidatura não segue — e o servidor recusa-a na mesma.
    if (fotografias.length === 0) {
      recusar([{ campo: "fotografias", mensagem: MENSAGEM_SEM_FOTOGRAFIA }]);
      return;
    }
    setAEnviar(true);
    try {
      const res = await fetch("/api/parceiros/candidatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          telefone,
          cidade,
          tipoVeiculo: tipoVeiculo || null,
          servicos,
          mensagem: mensagem || null,
          fotografiasDoVeiculo: fotografias,
          // De onde veio (31-10-2026): a campanha, o site que mandou e a página anterior.
          // E a zona do anúncio, `?zona=sintra` (04-11-2026, d16).
          origem: origemParaACandidatura(
            origemDaVisita(),
            paginaAnterior(),
            new URLSearchParams(window.location.search).get("zona"),
          ),
        }),
      });
      // Um 413 ou um 504 chegam em HTML. Sem o catch, o `res.json()` rebentava
      // e a pessoa lia "Sem ligação" com a ligação perfeita.
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        /*
         * Os erros com sítio no ecrã vão para os campos; os de um campo que o
         * ecrã não conhece, e a mensagem geral da rota, vão por baixo do botão.
         * Antes, havendo erros por campo, a mensagem geral perdia-se.
         */
        const { porCampo, geral } = separarErrosDaCandidatura(
          Array.isArray(dados.erros)
            ? (dados.erros as unknown[]).filter(
                (e): e is ErroDaCandidatura =>
                  typeof (e as ErroDaCandidatura)?.campo === "string" &&
                  typeof (e as ErroDaCandidatura)?.mensagem === "string",
              )
            : [],
        );
        const mensagemGeral = [geral, typeof dados.error === "string" ? dados.error : null]
          .filter(Boolean)
          .join(" ");
        recusar([
          ...porCampo,
          ...(mensagemGeral || porCampo.length === 0
            ? [
                {
                  campo: "geral",
                  mensagem: mensagemGeral || "Não foi possível enviar a candidatura. Tente novamente dentro de momentos.",
                },
              ]
            : []),
        ]);
        return;
      }
      setFeito(true);
    } catch {
      setErros([
        { campo: "geral", mensagem: "Sem ligação. O que escreveu não se perdeu — tente outra vez." },
      ]);
    } finally {
      setAEnviar(false);
    }
  }

  if (feito) {
    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-bold text-[#0B1929]">Recebemos a sua candidatura</h2>
        {/*
          O QUE ELE VAI RECEBER MUDOU, E ESTE TEXTO NÃO TINHA MUDADO COM ELE.

          Dizia «o link para completar o registo» — e era verdade até 11-09-2026,
          quando aprovar passava um convite para um segundo formulário de dez
          campos. Desde que aprovar CRIA a conta, o que lhe chega é o link para
          escolher a palavra-passe. Prometer-lhe um formulário que já não existe
          é prepará-lo para uma coisa e mandar-lhe outra.
        */}
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-700">
          Vamos olhar para ela e falamos consigo. Se avançar, recebe no email{" "}
          <strong>{email}</strong> o link para escolher a sua palavra-passe e entrar.
          O NIF, a morada fiscal e o IBAN preenche-os lá dentro, com calma.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-slate-500">
          Não pedimos nada para se inscrever, e responder a pedidos nunca lhe custa
          nada. Só há taxa da plataforma quando fecha um trabalho.
        </p>
        {/* Ia para /profissionais, que dá 404 a quem não tem a chave do MVP.
            O "como funciona" do parceiro está nesta mesma página. */}
        <Link
          href="/quero-ser-parceiro#como-funciona"
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Ver como funciona
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-4">
        <label id={idDoCampo("nome")} className="block scroll-mt-24">
          <span className="text-sm font-medium text-slate-700">Nome ou empresa *</span>
          {/*
            NENHUM EXEMPLO PODE SER O NOME DE UMA EMPRESA A SÉRIO.

            Dizia «Ex.: Mudanças Jorge», e a Mudanças Jorge existe — está no
            mesmo grupo de empresas de mudanças que vamos convidar. Chegar a
            uma página de recrutamento e encontrar o nome da própria casa posto
            como exemplo por quem ainda não a convidou não é simpático: é usar
            o nome dela sem pedir.

            O exemplo passa a ser uma forma jurídica genérica, que não é o nome
            de ninguém.
          */}
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={`mt-1.5 ${CAIXA}`}
            placeholder="Ex.: Transportes e Mudanças, Lda."
          />
          {erroDe("nome") && <span className="mt-1 block text-xs text-red-600">{erroDe("nome")}</span>}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label id={idDoCampo("telefone")} className="block scroll-mt-24">
            <span className="text-sm font-medium text-slate-700">Telemóvel *</span>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              inputMode="tel"
              className={`mt-1.5 ${CAIXA}`}
              placeholder="912 345 678"
            />
            {erroDe("telefone") && (
              <span className="mt-1 block text-xs text-red-600">{erroDe("telefone")}</span>
            )}
          </label>

          <label id={idDoCampo("email")} className="block scroll-mt-24">
            <span className="text-sm font-medium text-slate-700">Email *</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              className={`mt-1.5 ${CAIXA}`}
              placeholder="nome@empresa.pt"
            />
            {erroDe("email") && (
              <span className="mt-1 block text-xs text-red-600">{erroDe("email")}</span>
            )}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label id={idDoCampo("cidade")} className="block scroll-mt-24">
            <span className="text-sm font-medium text-slate-700">De onde trabalha *</span>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className={`mt-1.5 ${CAIXA}`}
              placeholder="Ex.: Seixal"
            />
            <span className="mt-1 block text-xs text-slate-500">
              A localidade da sua base. É daqui que se mede o que lhe fica perto.
            </span>
            {erroDe("cidade") && (
              <span className="mt-1 block text-xs text-red-600">{erroDe("cidade")}</span>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Viatura</span>
            <select
              value={tipoVeiculo}
              onChange={(e) => setTipoVeiculo(e.target.value)}
              className={`mt-1.5 ${CAIXA}`}
            >
              <option value="">Escolher…</option>
              {VEICULOS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/*
          AS FOTOGRAFIAS DA CARRINHA — 04-11-2026 (decisão d17).

          «Quero que os candidatos a pro enviem imagens dos veículos.» De 1 a
          4; sem nenhuma, a candidatura não segue. Só a equipa as vê: não vão
          para o perfil público nem para os clientes.
        */}
        <div id={idDoCampo("fotografias")} className="scroll-mt-24">
          <span className="text-sm font-medium text-slate-700">{ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA} *</span>
          <span className="mt-0.5 block text-xs text-slate-500">{AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA}</span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {fotografias.map((url, i) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Fotografia ${i + 1} da carrinha`}
                  className="h-20 w-28 rounded-xl border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFotografias((l) => l.filter((u) => u !== url))}
                  aria-label={`Tirar a fotografia ${i + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
            {fotografias.length < MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA && (
              <label
                className={`flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-cyan-600/50 bg-cyan-50 text-xs font-medium text-cyan-800 transition hover:bg-cyan-100 ${
                  aJuntar ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {aJuntar ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="h-5 w-5" aria-hidden="true" />
                )}
                {aJuntar ? "A enviar…" : fotografias.length === 0 ? "Juntar fotografia" : "Juntar outra"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  className="sr-only"
                  disabled={aJuntar}
                  onChange={(e) => {
                    void juntarFotografias(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
          <span className="mt-1 block text-xs text-slate-500">
            {fotografias.length} de {MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA} fotografias
          </span>
          {erroDe("fotografias") && (
            <span className="mt-1 block text-xs text-red-600">{erroDe("fotografias")}</span>
          )}
        </div>

        <div id={idDoCampo("servicos")} className="scroll-mt-24">
          <span className="text-sm font-medium text-slate-700">O que faz *</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Só lhe chegam pedidos destas categorias. Pode mudar depois.
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {/* A lista única das categorias (29-10-2026), sem «Outro serviço». */}
            {CATEGORIAS_DOS_PROFISSIONAIS.map((c) => {
              const escolhido = servicos.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alternar(c.id)}
                  aria-pressed={escolhido}
                  className={`min-h-[44px] rounded-xl border-2 px-3.5 text-sm font-medium transition ${
                    escolhido
                      ? "border-cyan-600 bg-cyan-50 text-cyan-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {erroDe("servicos") && (
            <span className="mt-1 block text-xs text-red-600">{erroDe("servicos")}</span>
          )}
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Quer dizer mais alguma coisa? <span className="font-normal text-slate-400">(opcional)</span>
          </span>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={3}
            className={`mt-1.5 ${CAIXA}`}
            placeholder="Há quanto tempo trabalha nisto, quantas pessoas tem na equipa, o que costuma fazer."
          />
        </label>
      </div>

      <button
        onClick={() => void enviar()}
        disabled={aEnviar || aJuntar}
        className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-acao text-base font-bold text-white transition active:bg-acao-hover disabled:opacity-40"
      >
        {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {aEnviar ? "A enviar…" : "Enviar candidatura"}
      </button>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {erroDe("geral") && (
          <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erroDe("geral")}
          </p>
        )}
        {/*
          O NOME DE CADA CAMPO QUE FALTA, JUNTO AO BOTÃO — 12-11-2026 (d9).
          «Falta preencher o que está assinalado acima» não dizia o quê, e o
          assinalado estava fora do ecrã.
        */}
        {resumoDoQueFalta(erros) && (
          <p className="mt-2 text-sm font-medium text-red-600">{resumoDoQueFalta(erros)}</p>
        )}
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
        Ao enviar, fica só uma candidatura registada. Não cria conta nem o obriga a nada.
      </p>
    </div>
  );
}
