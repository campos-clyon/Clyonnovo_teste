"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Plus, Send, Users } from "lucide-react";
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

const MOTIVOS: Record<string, string> = {
  categoria_diferente: "não fazem este serviço",
  fora_de_alcance: "fora da zona ou do raio",
  nao_emite_fatura: "não passam fatura",
  nao_emite_guia: "sem guia de transporte verificada",
  inactivo: "conta inactiva",
  nao_aprovado: "ainda não aprovados",
};

type Alcance = {
  elegiveis: Array<{ id: number; nome: string; distanciaKm: number | null }>;
  candidatos: number;
  motivos: Record<string, number>;
};

type Resultado = {
  id: number;
  valorDePartida: number | null;
  estimativa: number | null;
  distanciaKm: number | null;
  geocodificado: boolean;
  motivoSemCoordenadas?: "sem_chave" | "chave_recusada" | "nao_encontrada" | null;
  geocodificadoAproximado?: boolean;
  chaveRecusada?: boolean;
  moradaNormalizada: string | null;
  alcance: Alcance | null;
};

const euros = (v: number | null) => (v == null ? "—" : v.toFixed(2).replace(".", ",") + " €");

/**
 * Registar um pedido que chegou por fora do site.
 *
 * Uma boa parte dos pedidos entra por WhatsApp ou por telefone: a pessoa
 * descreve o que precisa e desliga. Até aqui esses pedidos não tinham como
 * chegar aos profissionais — não existiam na base — e o trabalho ou era feito
 * pela CLYON ou perdia-se.
 *
 * SÃO DOIS PASSOS, DE PROPÓSITO
 *
 * Primeiro grava-se e calcula-se; só depois é que se envia. A primeira versão
 * enviava logo, e isso é arriscado num pedido escrito à mão a partir de um
 * telefonema: a morada, a categoria ou a zona podem estar erradas de maneiras
 * que só se descobrem quando não chega a ninguém. Foi o que aconteceu ao #205
 * — criado, distribuído, zero profissionais, e a descoberta só depois de os
 * emails já não poderem ser chamados de volta.
 *
 * Agora quem regista vê a estimativa, vê a quem chegaria e a que distância, e
 * decide. Enviar é um segundo toque.
 */
export default function RegistarPedido({
  onCriado,
  editarId = null,
  podeEnviarAoGravar = false,
  onFechar,
}: {
  onCriado: () => void;
  /*
   * MODO DE EDIÇÃO — o mesmo formulário, pré-preenchido.
   *
   * "Abrir e editar tudo" abria o modal dos Pedidos: o painel do modelo
   * executante, com "Aceitar pedido", "Aprovar orçamento" e preço final com
   * IVA — nada disso é a plataforma. A edição da plataforma acontece AQUI,
   * no mesmo formulário do registo, porque os campos são exactamente os que
   * os profissionais vão ler. Dois formulários divergiam; um não tem como.
   */
  editarId?: number | null;
  /*
   * Em edição, os botões de envio normalmente não existem — um pedido já
   * publicado não se reenvia por acidente. Este é o caso contrário: o
   * separador da Distribuição só o liga quando o pedido AINDA NÃO FOI a
   * ninguém, e aí o fluxo é exactamente verificar → gravar → enviar.
   */
  podeEnviarAoGravar?: boolean;
  onFechar?: () => void;
}) {
  const { token } = useAdminAuth();
  const [aberto, setAberto] = useState(editarId != null);
  const [aCarregarPedido, setACarregarPedido] = useState(editarId != null);
  const [aGravar, setAGravar] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  /*
   * As fotografias que chegam por WhatsApp.
   *
   * Quem liga manda quase sempre fotos a seguir — e até aqui elas morriam no
   * telemóvel de quem atendeu: o pedido seguia sem nenhuma, e o profissional
   * propunha às cegas. É o MESMO caminho do simulador (enviarFicheiro:
   * comprime a 1920px e sobe uma de cada vez ao Blob), porque um segundo
   * caminho de upload seria um segundo sítio onde as fotos se perdem.
   */
  const [fotos, setFotos] = useState<Array<{ url: string; name: string; size: number; type?: string }>>([]);
  const [aEnviarFotos, setAEnviarFotos] = useState(0);
  const seletorDeFotos = useRef<HTMLInputElement | null>(null);

  const [f, setF] = useState({
    serviceType: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    address: "",
    city: "",
    postalCode: "",
    floor: "",
    hasElevator: "",
    parkingDistance: "",
    dataDesejada: "",
    urgency: "flexivel",
    description: "",
    valor: "",
    precisaFatura: false,
  });

  const muda = (k: keyof typeof f, v: string | boolean) => {
    setF((d) => ({ ...d, [k]: v }));
    setErro("");
    setResultado(null);
    setEnviado(null);
  };

  function limpar() {
    setFotos([]);
    setF((d) => ({
      ...d,
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      address: "",
      postalCode: "",
      description: "",
      valor: "",
    }));
    setResultado(null);
    setEnviado(null);
  }

  async function escolherFotos(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const { enviarFicheiro } = await import("@/lib/enviar-ficheiro");
    setAEnviarFotos((n) => n + lista.length);
    for (const original of Array.from(lista)) {
      const r = await enviarFicheiro(original);
      if (r.ok) setFotos((v) => [...v, r.ficheiro]);
      else setErro(`${original.name}: ${r.motivo}`);
      setAEnviarFotos((n) => Math.max(0, n - 1));
    }
    if (seletorDeFotos.current) seletorDeFotos.current.value = "";
  }

  /** Passo 1 — grava, localiza a morada, calcula o preço e avalia o alcance. */
  async function calcular() {
    if (!token) return;
    setAGravar(true);
    setErro("");
    try {
      const res = await fetch(
        editarId != null ? `/api/admin/pedidos/${editarId}/editar` : "/api/admin/pedidos/criar",
        {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ ...f, files: fotos }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível criar.");
        return;
      }
      setResultado(dados);
      onCriado();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  /** Passo 2 — só depois de alguém olhar para o que saiu. */
  async function enviar() {
    if (!token || !resultado) return;
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/promover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ pedidoId: resultado.id, valor: resultado.valorDePartida }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível enviar.");
        return;
      }
      setEnviado(
        dados.avisados > 0
          ? "Enviado a " + dados.avisados + " profissional(is)."
          : "Não chegou a nenhum — o histórico do pedido diz porquê.",
      );
      onCriado();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  // Pré-preencher a partir do pedido existente. Corre uma vez.
  useEffect(() => {
    if (editarId == null || !token) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/pedidos/${editarId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        const o = d.order;
        if (!vivo || !o) return;
        const paraDataLocal = (v: unknown): string => {
          if (!v) return "";
          const dt = new Date(String(v));
          if (Number.isNaN(dt.getTime())) return "";
          const p2 = (n: number) => String(n).padStart(2, "0");
          return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}T${p2(dt.getHours())}:${p2(dt.getMinutes())}`;
        };
        setF({
          serviceType: o.serviceType ?? "",
          contactName: o.contactName ?? "",
          contactPhone: o.contactPhone ?? "",
          contactEmail: o.contactEmail ?? "",
          address: o.address ?? "",
          city: o.city ?? "",
          postalCode: o.postalCode ?? "",
          floor: o.floor ?? "",
          hasElevator: o.hasElevator ?? "",
          parkingDistance: o.parkingDistance ?? "",
          dataDesejada: paraDataLocal(o.dataAgendada),
          urgency: o.urgency ?? "flexivel",
          description: o.description ?? "",
          valor: o.valorDesejadoCliente != null ? String(o.valorDesejadoCliente) : "",
          precisaFatura: Number(o.precisaFatura) === 1,
        });
        try {
          const lista = o.filesJson ? JSON.parse(o.filesJson) : [];
          if (Array.isArray(lista)) {
            setFotos(
              lista
                .filter((ft: { url?: unknown }) => typeof ft?.url === "string")
                .map((ft: { url: string; name?: string; size?: number; type?: string }) => ({
                  url: ft.url,
                  name: ft.name ?? "foto",
                  size: ft.size ?? 0,
                  type: ft.type,
                })),
            );
          }
        } catch {
          /* filesJson estragado — começa sem fotos */
        }
      } catch {
        setErro("Não foi possível carregar o pedido.");
      } finally {
        if (vivo) setACarregarPedido(false);
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarId, token]);

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
    /*
     * Fundo OPACO, e não o lavado translúcido de antes. Este formulário
     * passou a abrir por cima da mesa de pedidos, e com 10% de opacidade
     * lia-se a mesa através dos campos. A legibilidade não pode depender do
     * que está por trás.
     */
    <div className="mb-6 rounded-2xl border border-cyan-900/60 bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-cyan-300">
            {editarId != null ? `Editar pedido #${editarId}` : "Registar pedido"}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            {editarId != null
              ? "Os campos que os profissionais leem. Gravar volta a localizar a morada e recalcula o alcance."
              : "Para o que chega por fora do site. Primeiro calcula-se; depois decide se vai aos profissionais ou fica só no backoffice."}
          </p>
        </div>
        <button
          onClick={() => {
            if (onFechar) {
              onFechar();
              return;
            }
            setAberto(false);
            limpar();
          }}
          className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-300"
        >
          Fechar
        </button>
      </div>

      {aCarregarPedido ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-label="A carregar o pedido" />
        </div>
      ) : (
      <>
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
            placeholder="Rua e número — ex.: Rua Sousa Viterbo 29"
            className={campo}
          />
          <span className="mt-0.5 block text-[10px] text-slate-500">
            Só a rua e o número. O código postal e a localidade têm campo
            próprio — os três juntos é que localizam a morada, e são as
            coordenadas que decidem que profissionais alcançam o trabalho.
          </span>
        </label>

        <label className="text-xs text-slate-400">
          Código postal
          <input
            value={f.postalCode}
            onChange={(e) => muda("postalCode", e.target.value)}
            placeholder="2845-513"
            className={campo}
          />
        </label>

        <label className="text-xs text-slate-400">
          Localidade
          <input
            value={f.city}
            onChange={(e) => muda("city", e.target.value)}
            className={campo}
          />
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

        {/*
          As perguntas que quem liga responde sem dar por isso — e que até aqui
          iam parar à descrição, em texto corrido, invisíveis para o motor de
          preços. "Segundo andar sem elevador" escrito à mão não mudava um
          cêntimo na estimativa; nestes campos muda.

          Os valores são o vocabulário do simulador ("yes"/"small"/"no",
          "difficult") porque é esse que o motor de preços lê. Etiquetas novas
          com valores novos dariam campos preenchidos e preços iguais.
        */}
        <label className="text-xs text-slate-400">
          Elevador
          <select
            value={f.hasElevator}
            onChange={(e) => muda("hasElevator", e.target.value)}
            className={campo}
          >
            <option value="">não perguntei</option>
            <option value="yes">Com elevador</option>
            <option value="small">Elevador pequeno</option>
            <option value="no">Sem elevador</option>
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Dá para estacionar à porta?
          <select
            value={f.parkingDistance}
            onChange={(e) => muda("parkingDistance", e.target.value)}
            className={campo}
          >
            <option value="">não perguntei</option>
            <option value="easy">Sim, junto à porta</option>
            <option value="difficult">Longe ou complicado</option>
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Data e hora desejada
          <input
            type="datetime-local"
            value={f.dataDesejada}
            onChange={(e) => muda("dataDesejada", e.target.value)}
            className={campo}
          />
          <span className="mt-0.5 block text-[10px] text-slate-500">
            Se a pessoa disse "quinta de manhã", marque quinta às 9h. Fica no
            pedido e acerta a urgência do preço.
          </span>
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

        <div className="sm:col-span-2 lg:col-span-3">
          <p className="text-xs text-slate-400">Fotografias</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {fotos.map((ft, idx) => (
              <div key={ft.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ft.url}
                  alt={`Fotografia ${idx + 1}`}
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setFotos((v) => v.filter((x) => x.url !== ft.url))}
                  aria-label={`Tirar a fotografia ${idx + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-red-700 text-[10px] font-bold text-white"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-600 text-2xl text-slate-500 hover:border-cyan-600 hover:text-cyan-400">
              {aEnviarFotos > 0 ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                "+"
              )}
              <input
                ref={seletorDeFotos}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => escolherFotos(e.target.files)}
              />
            </label>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            As que o cliente mandar por WhatsApp. Seguem no pedido — sem elas o
            profissional propõe às cegas.
          </p>
        </div>
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

      {!resultado && (
        <button
          onClick={calcular}
          disabled={aGravar}
          className="mt-4 flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {aGravar ? "A calcular…" : "Calcular preço e alcance"}
        </button>
      )}

      {resultado && (
        <Resumo
          r={resultado}
          enviado={enviado}
          aEnviar={aEnviar}
          emEdicao={editarId != null}
          podeEnviar={podeEnviarAoGravar}
          onEnviar={enviar}
          onNovo={limpar}
        />
      )}
      </>
      )}
    </div>
  );
}

/**
 * O que saiu do motor de preços, e a quem chegaria.
 *
 * É este ecrã que faltava. Sem ele, a decisão de enviar era tomada às cegas:
 * carregava-se num botão e só o histórico do pedido, mais tarde, dizia se
 * tinha chegado a alguém.
 */
function Resumo({
  r,
  enviado,
  aEnviar,
  emEdicao = false,
  podeEnviar = false,
  onEnviar,
  onNovo,
}: {
  r: Resultado;
  enviado: string | null;
  aEnviar: boolean;
  emEdicao?: boolean;
  podeEnviar?: boolean;
  onEnviar: () => void;
  onNovo: () => void;
}) {
  const alcance = r.alcance;
  const quantos = alcance?.elegiveis.length ?? 0;

  const porque = Object.entries(alcance?.motivos ?? {})
    .filter(([, n]) => Number(n) > 0)
    .map(([m, n]) => `${n} ${MOTIVOS[m] ?? m}`)
    .join(", ");

  return (
    <div className="mt-4 rounded-xl border border-emerald-800/70 bg-emerald-950/25 p-4">
      {/*
        Verde, e a dizer que ficou gravado.
        
        Este cabeçalho era cinzento e dizia só "Pedido #206 criado" — a mesma
        cor do resto do painel, sem nada que separasse "correu bem" de "está
        aqui uma informação". Depois de carregar num botão, a primeira coisa a
        saber é se resultou; o preço e o alcance vêm a seguir.
      */}
      <p className="flex items-center gap-2 text-sm font-bold text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        {emEdicao ? `Pedido #${r.id} actualizado` : `Pedido #${r.id} criado e gravado`}
      </p>
      <p className="mt-0.5 text-xs text-emerald-400/70">
        {emEdicao
          ? "Os profissionais veem as alterações na próxima vez que abrirem o pedido."
          : "Já aparece na lista aqui em baixo. Ainda não foi enviado a ninguém."}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Estimativa</p>
          <p className="text-sm font-bold text-white">{euros(r.estimativa)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Valor de partida</p>
          <p className="text-sm font-bold text-cyan-300">{euros(r.valorDePartida)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Distância</p>
          <p className="text-sm font-bold text-white">
            {r.distanciaKm != null ? r.distanciaKm + " km" : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Morada</p>
          <p
            className={`text-xs font-semibold ${
              r.geocodificado ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {r.geocodificado
              ? r.geocodificadoAproximado
                ? "Localizada pela freguesia"
                : "Localizada"
              : "Não localizada"}
          </p>
        </div>
      </div>

      {/* Uma morada que o Google não reconheceu deixa a regra a comparar nomes
          de cidades em vez de medir distâncias — e é assim que um trabalho a
          35 km fica "fora de alcance" de quem cobre 125. */}
      {/*
        Duas histórias diferentes, dois avisos diferentes.

        Sem esta distinção, um servidor sem chave do Google dizia "vale a pena
        corrigir a morada" — e quem registava pedidos reescrevia três vezes
        uma morada que o Google encontra à primeira. A culpa era da
        configuração, e o ecrã mandava a pessoa procurar no sítio errado.
      */}
      {!r.geocodificado && r.motivoSemCoordenadas === "sem_chave" && (
        <p className="mt-3 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-xs leading-relaxed text-red-300">
          A chave do Google Maps não está configurada no servidor
          (GOOGLE_MAPS_SERVER_API_KEY) — NENHUMA morada vai ser localizada até
          isso estar resolvido. Não é um problema desta morada.
        </p>
      )}
      {/*
        A chave recusada diz-se mesmo quando a freguesia salvou o pedido:
        se a faixa só aparecesse com o pedido por localizar, o recurso
        esconderia a avaria e ninguém ia ao Google Cloud resolvê-la.
      */}
      {(r.chaveRecusada || (!r.geocodificado && r.motivoSemCoordenadas === "chave_recusada")) && (
        <p className="mt-3 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-xs leading-relaxed text-red-300">
          A chave do Google Maps existe mas o Google RECUSOU-A. Quase sempre é
          a Geocoding API por activar no projecto, ou a chave restrita a outra
          API. Verifique no Google Cloud Console — não é um problema desta
          morada.
        </p>
      )}
      {!r.geocodificado &&
        r.motivoSemCoordenadas !== "sem_chave" &&
        r.motivoSemCoordenadas !== "chave_recusada" && (
        <p className="mt-3 rounded-lg border border-amber-900 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-300">
          O Google não reconheceu esta morada. Sem coordenadas, o alcance é
          decidido pela lista de zonas de cada profissional, que é muito mais
          curta do que o raio deles. Confirme a rua e o número — o código
          postal e a localidade já entram sozinhos.
        </p>
      )}
      {r.geocodificado && r.geocodificadoAproximado && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Coordenadas pelo centro da freguesia (Nominatim) — chegam para decidir o
          raio dos profissionais, não para navegar até à porta.
        </p>
      )}
      {r.geocodificado && r.moradaNormalizada && (
        <p className="mt-2 text-[11px] text-slate-500">{r.moradaNormalizada}</p>
      )}

      <div className="mt-4 border-t border-emerald-900/50 pt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Users className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          {alcance == null
            ? "Alcance não avaliado"
            : quantos > 0
              ? `Chegaria a ${quantos} de ${alcance.candidatos} profissionais activos`
              : `Não chegaria a nenhum dos ${alcance.candidatos} profissionais activos`}
        </p>

        {quantos > 0 && (
          <ul className="mt-2 space-y-1">
            {alcance!.elegiveis.map((p) => (
              <li key={p.id} className="text-xs text-slate-400">
                {p.nome}
                {p.distanciaKm != null && (
                  <span className="text-slate-600"> · {p.distanciaKm} km</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {quantos === 0 && porque && (
          <p className="mt-2 text-xs text-slate-500">Porquê: {porque}.</p>
        )}
      </div>

      {/*
        Em edição os botões de envio não aparecem: enviar é outra decisão,
        tomada na lista, e um pedido que JÁ foi enviado não se reenvia por
        acidente a partir de um ecrã de edição.
      */}
      {emEdicao && !podeEnviar ? null : enviado ? (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {enviado}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={onEnviar}
            disabled={aEnviar || r.valorDePartida == null}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-40"
          >
            {aEnviar ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            Enviar aos profissionais
          </button>
          {/* Não enviar é uma escolha legítima, e por isso é um botão. Sem ele,
              quem não quisesse distribuir ficava sem saber o que fazer ao
              ecrã — e no meio da dúvida carregava em enviar. */}
          <button
            onClick={onNovo}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800/60"
          >
            Deixar só no backoffice
          </button>
        </div>
      )}
    </div>
  );
}
