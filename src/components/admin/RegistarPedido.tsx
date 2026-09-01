"use client";

import { useEffect, useRef, useState } from "react";
import { Miniatura } from "@/components/Anexo";
import { lerBase, etiquetaDaBase, avisoDaBase, type BaseDoPreco } from "@/lib/base-do-preco";
import { CheckCircle2, Loader2, Pencil, Plus, Send, Users } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import CaixaDeTextoQueCresce from "@/components/CaixaDeTextoQueCresce";

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
 * Cada serviço pergunta o que lhe interessa.
 *
 * "Quando eu escolho mudanças o pedido deveria ser adaptado a isso, assim como
 * entulhos etc — cada material tem sua peculiaridade. Mudanças precisam de 2
 * endereços, o valor é por hora e km, sendo o mínimo de 3h."
 *
 * O motor de preços já sabia disto tudo há muito tempo: uma mudança são 7
 * horas de base, mais uma hora por cada ponta sem elevador acima do 2.º andar,
 * mais meia hora se o percurso passar dos 30 km — e depois cobra-se por hora,
 * três colaboradores a 70 €/h, com um mínimo de três horas. Um entulho conta-se
 * por sacos, e um saco no chão dá mais trabalho do que um saco já ensacado.
 *
 * Quem faltava à conversa era ESTE formulário. Ele mandava sempre os mesmos
 * cinco campos, e o motor calculava uma mudança com uma morada só, sem saber
 * para onde ia — 7 horas fixas, sempre o mesmo preço, fosse a mudança para o
 * prédio ao lado ou para o Porto. E um entulho sem número de sacos ficava com
 * o motor a pedir "quantidade de sacos de entulho" e ninguém a ouvi-lo.
 */
const PRECISA_DE_DOIS_ENDERECOS = (servico: string) => servico === "mudanca";
const PRECISA_DE_SACOS = (servico: string) => servico === "recolha_entulho";

const ESTADOS_DO_ENTULHO = [
  ["ensacado", "Já ensacado"],
  ["chao", "No chão, por ensacar"],
  ["misto", "Misto"],
  ["bigbags", "Big bags"],
] as const;

/** Lê do rawOrderJson os campos próprios do serviço, para o editor os mostrar. */
function camposDoServicoGuardados(rawOrderJson: string | null | undefined) {
  let cru: Record<string, unknown> = {};
  try {
    cru = rawOrderJson ? (JSON.parse(rawOrderJson) as Record<string, unknown>) : {};
  } catch {
    /* JSON estragado — o editor abre com os campos vazios */
  }
  const morada = (v: unknown) => (v as { formattedAddress?: string } | undefined)?.formattedAddress ?? "";
  const parte = (v: unknown, k: string) => String((v as Record<string, unknown> | undefined)?.[k] ?? "");
  const destino = cru.destinationAddress;
  const acessoO = cru.originAccess;
  const acessoD = cru.destinationAccess;
  return {
    moradaDestino: morada(destino),
    localidadeDestino: parte(destino, "city"),
    codigoPostalDestino: parte(destino, "postalCode"),
    andarDestino: parte(acessoD, "floor"),
    elevadorDestino: parte(acessoD, "hasElevator"),
    estacionamentoDestino: parte(acessoD, "parkingDistance"),
    acessoDificilOrigem: Boolean((acessoO as Record<string, unknown> | undefined)?.difficultAccess),
    acessoDificilDestino: Boolean((acessoD as Record<string, unknown> | undefined)?.difficultAccess),
    entulhoEstado: String(cru.entulhoState ?? ""),
    entulhoQuantidade: String(cru.entulhoQuantidade ?? ""),
  };
}

const MOTIVOS: Record<string, string> = {
  categoria_diferente: "não fazem este serviço",
  fora_de_alcance: "fora do raio deles",
  sem_morada: "a morada do pedido não foi localizada",
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
  /** Km de origem a destino, quando é uma mudança com as duas moradas. */
  percursoKm?: number | null;
  /** O que falta para o preço não ser um palpite. */
  faltaParaOPreco?: string[];
  /** O que mudou nesta edição, por extenso: "o valor de partida e as fotografias". */
  mudancas?: string;
  /** O pedido voltou a circular? Gravar uma alteração recomeça-o do zero. */
  recomeco?:
    | { recomecou: true; encerradas: number; receberam: number; avisados: number; candidatos: number }
    | { recomecou: false; porque: "sem_negociacoes" | "trabalho_fechado" | "sem_valor"; detalhe?: string }
    | null;
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
  onEditar,
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
  /**
   * Abrir este pedido para corrigir, logo a seguir a criá-lo.
   *
   * Quem regista um pedido ao telefone escreve depressa e engana-se — uma
   * morada trocada, um andar a mais, e as fotografias que só chegam ao
   * WhatsApp cinco minutos depois. Sem isto, a única saída era fechar o
   * ecrã, procurar o pedido na lista e abri-lo de novo; a maior parte das
   * vezes não se corrigia de todo, e o profissional recebia o erro.
   */
  onEditar?: (id: number) => void;
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
    baseDoPreco: "total",
    precisaFatura: false,
    // ── Mudança: a segunda ponta ──
    moradaDestino: "",
    localidadeDestino: "",
    codigoPostalDestino: "",
    andarDestino: "",
    elevadorDestino: "",
    estacionamentoDestino: "",
    acessoDificilOrigem: false,
    acessoDificilDestino: false,
    // ── Entulho: o que é e quanto é ──
    entulhoEstado: "",
    entulhoQuantidade: "",
  });

  const doisEnderecos = PRECISA_DE_DOIS_ENDERECOS(f.serviceType);
  const pedeSacos = PRECISA_DE_SACOS(f.serviceType);

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
      baseDoPreco: "total",
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
      else {
        /*
          O NOME DO FICHEIRO UMA VEZ, e não duas.
          O motivo já vem com o nome lá dentro quando isso ajuda a perceber
          qual dos oito anexos falhou — e o ecrã mostrava
          "reportagem.pdf: reportagem.pdf tem 8 MB...". Junta-se o nome só
          quando o motivo não o traz.
        */
        setErro(r.motivo.includes(original.name) ? r.motivo : `${original.name}: ${r.motivo}`);
      }
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
          baseDoPreco: lerBase(o.baseDoPreco),
          precisaFatura: Number(o.precisaFatura) === 1,
          // O que é próprio do serviço vive no rawOrderJson, onde o simulador
          // também o põe — é a mesma forma, para o pedido ser um só.
          ...camposDoServicoGuardados(o.rawOrderJson),
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
              ? "Os campos que os profissionais leem. Gravar recomeça o pedido do zero: as propostas actuais acabam e ele volta a sair a quem for elegível hoje."
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
          {doisEnderecos ? "Morada de origem — donde sai *" : "Morada *"}
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
          {doisEnderecos ? "Andar na origem" : "Andar"}
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
          {doisEnderecos ? "Elevador na origem" : "Elevador"}
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
          {doisEnderecos ? "Estacionar à porta, na origem?" : "Dá para estacionar à porta?"}
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

        {/*
          A SEGUNDA PONTA DA MUDANÇA.

          Uma mudança tem duas moradas e o preço depende das duas: sete horas
          de base, mais uma por cada ponta sem elevador acima do 2.º andar,
          mais meia hora se o percurso passar dos 30 km. Sem a segunda morada,
          o motor calculava sempre as mesmas sete horas — o mesmo preço para
          uma mudança para o prédio ao lado e para uma para o Porto.

          A morada de ORIGEM continua a ser a morada do pedido: é dela que sai
          a distância que decide que profissionais alcançam o trabalho. O
          destino é informação do trabalho, não do alcance.
        */}
        {doisEnderecos && (
          <>
            <label className="text-xs text-slate-400 sm:col-span-2">
              Morada de destino — para onde vai *
              <input
                value={f.moradaDestino}
                onChange={(e) => muda("moradaDestino", e.target.value)}
                placeholder="Rua e número — ex.: Avenida da República 12"
                className={campo}
              />
              <span className="mt-0.5 block text-[10px] text-slate-500">
                O percurso origem→destino entra na conta das horas e do
                combustível. Sem ele, a mudança fica com o preço mínimo.
              </span>
            </label>

            <label className="text-xs text-slate-400">
              Código postal do destino
              <input
                value={f.codigoPostalDestino}
                onChange={(e) => muda("codigoPostalDestino", e.target.value)}
                placeholder="1050-191"
                className={campo}
              />
            </label>

            <label className="text-xs text-slate-400">
              Localidade do destino
              <input
                value={f.localidadeDestino}
                onChange={(e) => muda("localidadeDestino", e.target.value)}
                className={campo}
              />
            </label>

            <label className="text-xs text-slate-400">
              Andar no destino
              <input
                value={f.andarDestino}
                onChange={(e) => muda("andarDestino", e.target.value)}
                placeholder="rés-do-chão, 2º…"
                className={campo}
              />
            </label>

            <label className="text-xs text-slate-400">
              Elevador no destino
              <select
                value={f.elevadorDestino}
                onChange={(e) => muda("elevadorDestino", e.target.value)}
                className={campo}
              >
                <option value="">não perguntei</option>
                <option value="yes">Com elevador</option>
                <option value="small">Elevador pequeno</option>
                <option value="no">Sem elevador</option>
              </select>
            </label>

            <label className="text-xs text-slate-400">
              Estacionar à porta, no destino?
              <select
                value={f.estacionamentoDestino}
                onChange={(e) => muda("estacionamentoDestino", e.target.value)}
                className={campo}
              >
                <option value="">não perguntei</option>
                <option value="easy">Sim, junto à porta</option>
                <option value="difficult">Longe ou complicado</option>
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-3">
              {/* Meia hora por ponta, na conta. Escrito na descrição não valia nada. */}
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={f.acessoDificilOrigem}
                  onChange={(e) => muda("acessoDificilOrigem", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
                Acesso difícil ou desmontagem na origem
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={f.acessoDificilDestino}
                  onChange={(e) => muda("acessoDificilDestino", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
                Acesso difícil ou montagem no destino
              </label>
            </div>
          </>
        )}

        {/*
          O ENTULHO CONTA-SE POR SACOS.

          O motor pede a quantidade — sem ela, devolve "falta a quantidade de
          sacos de entulho" e ninguém o ouvia, porque o formulário não tinha
          onde a escrever. E um saco no chão dá mais 30% de trabalho do que um
          já ensacado: é a diferença entre carregar e ensacar primeiro.
        */}
        {pedeSacos && (
          <>
            <label className="text-xs text-slate-400">
              Como está o entulho?
              <select
                value={f.entulhoEstado}
                onChange={(e) => muda("entulhoEstado", e.target.value)}
                className={campo}
              >
                <option value="">não perguntei</option>
                {ESTADOS_DO_ENTULHO.map(([id, rotulo]) => (
                  <option key={id} value={id}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-slate-400">
              Quantos sacos?
              <input
                value={f.entulhoQuantidade}
                onChange={(e) => muda("entulhoQuantidade", e.target.value)}
                placeholder="ex.: 30"
                inputMode="numeric"
                className={campo}
              />
              <span className="mt-0.5 block text-[10px] text-slate-500">
                Um big bag conta como 42 sacos. Sem número, o motor não sabe se
                é uma mala de escombros ou uma obra inteira.
              </span>
            </label>
          </>
        )}

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

        {/*
          O VALOR, E O QUE ELE MEDE — juntos, e não em campos distantes.

          "Temos de ter aqui a opção de colocar valor por carga ou valor total."

          Um número sozinho não diz o que mede. Numa recolha de entulho «150 €»
          tanto pode ser o trabalho inteiro como cada viagem ao aterro, e a
          diferença entre as duas leituras são três cargas — 300 € que ninguém
          combinou. É a discussão mais cara que isto pode ter, porque só
          aparece no fim, com o trabalho já feito.

          Os dois botões estão colados ao campo de propósito: quem escreve o
          número tem de ver, no mesmo gesto, o que está a dizer com ele.
        */}
        <label className="text-xs text-slate-400">
          Valor de partida <span className="text-slate-500">(sem IVA)</span>
          <input
            value={f.valor}
            onChange={(e) => muda("valor", e.target.value)}
            placeholder="vazio = usa a estimativa"
            inputMode="decimal"
            className={campo}
          />
          <span className="mt-1.5 flex gap-1.5">
            {(["total", "carga"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => muda("baseDoPreco", b)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                  f.baseDoPreco === b
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                }`}
              >
                {b === "total" ? "Valor total" : "Por carga"}
              </button>
            ))}
          </span>
          <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">
            {avisoDaBase(lerBase(f.baseDoPreco)) ??
              "É o trabalho todo. O profissional e o cliente vêem esta escolha."}
          </span>
        </label>

        <label className="text-xs text-slate-400 sm:col-span-2 lg:col-span-3">
          Descrição
          {/*
            Chamava-se "O que é preciso fazer". Era uma pergunta ao pé de
            catorze rótulos que são nomes — Morada, Localidade, Andar — e a
            forma diferente não dizia nada de diferente. É a descrição do
            pedido, que é como ela se chama em todos os outros sítios do site:
            no que o profissional lê, no que o cliente vê, na base de dados.
          */}
          <CaixaDeTextoQueCresce
            value={f.description}
            onChange={(e) => muda("description", e.target.value)}
            placeholder="O que a pessoa disse ao telefone — quanto mais detalhe, melhor o preço."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-600"
          />
        </label>

        <div className="sm:col-span-2 lg:col-span-3">
          <p className="text-xs text-slate-400">Fotografias</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {fotos.map((ft, idx) => (
              <div key={ft.url} className="relative">
                {/*
                  Fotografia, vídeo ou PDF — a miniatura sabe qual é.
                  Um PDF num `<img>` dava o ícone de imagem partida, e quem o
                  visse pensava que o anexo se tinha perdido no envio.
                */}
                <Miniatura url={ft.url} nome={ft.name} className="h-16 w-16" />
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
                accept="image/*,video/*,application/pdf"
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
          base={lerBase(f.baseDoPreco)}
          enviado={enviado}
          onEditar={onEditar}
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
  base,
  enviado,
  onEditar,
  aEnviar,
  emEdicao = false,
  podeEnviar = false,
  onEnviar,
  onNovo,
}: {
  r: Resultado;
  /** O que o valor MEDE — o trabalho todo, ou cada carga. */
  base: BaseDoPreco;
  enviado: string | null;
  onEditar?: (id: number) => void;
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
          ? r.mudancas
            ? `Mudou ${r.mudancas}.`
            : "Nada mudou do que os profissionais leem."
          : "Já aparece na lista aqui em baixo. Ainda não foi enviado a ninguém."}
      </p>

      {/*
        O QUE FALTA PARA O PREÇO SER UM PREÇO.

        Uma mudança sem morada de destino sai sempre pelo mínimo — 210 € —
        porque o motor não tem percurso nenhum para contar. Um entulho sem
        número de sacos também. O motor sabe disto e diz; até aqui não havia
        quem o repetisse, e o número aparecia como se fosse uma conta feita.
      */}
      {r.faltaParaOPreco && r.faltaParaOPreco.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200">
          <p className="font-semibold">Este preço é um piso, não uma conta.</p>
          <p className="mt-0.5 text-amber-200/75">
            Falta {r.faltaParaOPreco.join(", ")}. Sem isso o motor calcula pelo
            mínimo do serviço — vale como ponto de partida, não como estimativa.
          </p>
        </div>
      )}

      {/*
        O QUE ACONTECEU AO PEDIDO A SEGUIR À GRAVAÇÃO.

        Gravar uma alteração recomeça o pedido do zero e volta a enviá-lo. É
        destrutivo — as propostas anteriores acabam — e portanto tem de se ver
        aqui, no mesmo ecrã e no mesmo segundo, e não descobrir-se depois ao
        reparar que os números mudaram.
      */}
      {r.recomeco && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            r.recomeco.recomecou
              ? "border-cyan-500/30 bg-cyan-500/[0.07] text-cyan-200"
              : "border-amber-500/30 bg-amber-500/[0.07] text-amber-200"
          }`}
        >
          {r.recomeco.recomecou ? (
            <>
              <p className="font-semibold">O pedido voltou a circular como novo.</p>
              <p className="mt-0.5 text-cyan-200/75">
                {r.recomeco.encerradas}{" "}
                {r.recomeco.encerradas === 1
                  ? "negociação anterior acabou"
                  : "negociações anteriores acabaram"}{" "}
                — as propostas já feitas deixaram de contar. Chegou a{" "}
                {r.recomeco.receberam} de {r.recomeco.candidatos} profissionais activos
                {r.recomeco.avisados < r.recomeco.receberam
                  ? `, mas ${r.recomeco.receberam - r.recomeco.avisados} não recebeu o email de aviso`
                  : ""}
                .
              </p>
            </>
          ) : r.recomeco.porque === "trabalho_fechado" ? (
            <>
              <p className="font-semibold">
                A alteração ficou gravada, mas o pedido NÃO voltou a circular.
              </p>
              <p className="mt-0.5 text-amber-200/75">
                O trabalho já está fechado com {r.recomeco.detalhe}. Recomeçar apagaria esse
                compromisso — do outro lado há alguém que contou com o trabalho. Se for mesmo
                para refazer, desista dessa negociação primeiro.
              </p>
            </>
          ) : r.recomeco.porque === "sem_valor" ? (
            <p>
              A alteração ficou gravada. Sem valor de partida o pedido não pode ser enviado a
              ninguém.
            </p>
          ) : (
            <p>
              A alteração ficou gravada. Este pedido ainda não foi enviado a ninguém — use
              &ldquo;Enviar aos profissionais&rdquo; quando estiver pronto.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Estimativa</p>
          <p className="text-sm font-bold text-white">{euros(r.estimativa)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Valor de partida</p>
          <p className="text-sm font-bold text-cyan-300">
            {euros(r.valorDePartida)}
            {base === "carga" && <span className="text-amber-300"> por carga</span>}
          </p>
          <p className="text-[10px] text-slate-500">sem IVA · {etiquetaDaBase(base)}</p>
        </div>
        {r.percursoKm != null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Percurso</p>
            <p className="text-sm font-bold text-white">{r.percursoKm} km</p>
            <p className="text-[10px] text-slate-500">origem → destino</p>
          </div>
        )}
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

        {/*
          E OS QUE FICARAM DE FORA — SEMPRE, NÃO SÓ QUANDO SÃO TODOS.

          Esta linha só aparecia quando o pedido não chegava a NINGUÉM. Com
          dois de quatro, dizia-se "chegaria a 2 de 4" e ficava-se por aí: o
          porquê dos outros dois era invisível.

          Aconteceu no #228 — "porque só em 2 e não em todos?". A resposta
          estava a um campo de distância: o pedido pedia fatura e dois dos
          profissionais não a emitem. Nada disso estava no ecrã, e uma
          contagem sem explicação transforma cada envio numa adivinha.
        */}
        {porque && quantos < (alcance?.candidatos ?? 0) && (
          <p className="mt-2 text-xs text-slate-500">
            {quantos === 0 ? "Porquê: " : `Os outros ${(alcance!.candidatos - quantos)} ficam de fora: `}
            {porque}.
          </p>
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
          {/*
            Corrigir ANTES de enviar, que é quando ainda não custa nada.
            Depois de sair para os profissionais, o erro já foi lido.
          */}
          {onEditar && !emEdicao && (
            <button
              onClick={() => onEditar(r.id)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800/60"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Corrigir ou juntar fotografias
            </button>
          )}
        </div>
      )}
    </div>
  );
}
