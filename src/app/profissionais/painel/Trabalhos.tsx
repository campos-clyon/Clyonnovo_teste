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
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Truck,
  User,
} from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { CabecalhoDeEcra, euros } from "@/components/portal/Portal";
import EnviarFotos, { type FotoEnviada } from "@/components/EnviarFotos";
import Nota from "@/components/Nota";
import VisorDeFotos from "@/components/VisorDeFotos";
import NegociacaoProfissional from "@/app/profissionais/pedidos/[token]/NegociacaoProfissional";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import { URGENCIA, fotosDe, propostasDe, provaDe, type Pedido } from "./tipos";

/**
 * Os trabalhos do profissional.
 *
 * Uma lista, e o detalhe abre por cima. O que muda tudo é a fase: enquanto se
 * negoceia, ele vê a zona; depois de ser contratado, vê a morada e o telefone,
 * e ganha o botão que fecha o ciclo — "está feito", com fotografia.
 *
 * As fotografias do cliente aparecem grandes, e não em miniaturas: é por elas
 * que se decide o preço de uma recolha. Um sofá numa miniatura de 60 píxeis é
 * indistinguível de uma cadeira.
 */

const ESTADO: Record<string, { texto: string; cls: string }> = {
  aberta: { texto: "à espera da sua resposta", cls: "bg-blue-50 text-blue-700" },
  aguarda_contratacao: { texto: "à espera do cliente", cls: "bg-cyan-50 text-cyan-700" },
  acordada: { texto: "é seu", cls: "bg-emerald-50 text-emerald-700" },
  desistida: { texto: "terminada", cls: "bg-slate-100 text-slate-500" },
  morta: { texto: "fechada com outro", cls: "bg-slate-100 text-slate-500" },
};

const FASE: Record<string, { texto: string; cls: string }> = {
  a_executar: { texto: "por fazer", cls: "bg-cyan-50 text-cyan-700" },
  a_confirmar: { texto: "à espera da confirmação", cls: "bg-cyan-50 text-cyan-700" },
  confirmado: { texto: "confirmado", cls: "bg-emerald-50 text-emerald-700" },
  pago: { texto: "pago", cls: "bg-slate-100 text-slate-500" },
};

function servicoDe(p: Pedido): string {
  return SERVICE_CATEGORIES.find((c) => c.id === p.serviceType)?.label ?? p.serviceType ?? "Serviço";
}

/**
 * Em que separador é que este pedido cai.
 *
 * A conta dele era uma lista corrida com tudo lá dentro — o que espera
 * resposta, o que já está fechado e o que morreu há duas semanas, tudo com o
 * mesmo peso. Ao quinto pedido, o que precisa de resposta hoje some no meio.
 *
 * "Novo" é o que ainda não tocou: chegou-lhe e ele não propôs nada. É o único
 * que tem prazo a correr contra si, e por isso é o que se destaca.
 */
type Separador = "novos" | "negociacao" | "contratados" | "terminados";

function separadorDe(p: Pedido): Separador {
  if (p.estado === "acordada") return "contratados";
  if (p.estado === "desistida" || p.estado === "morta") return "terminados";
  const propostas = propostasDe(p.propostas);
  const jaRespondeu = propostas.some((x) => x.por === "profissional");
  return jaRespondeu || p.estado === "aguarda_contratacao" ? "negociacao" : "novos";
}

const SEPARADORES: Array<{ id: Separador; rotulo: string }> = [
  { id: "novos", rotulo: "Novos" },
  { id: "negociacao", rotulo: "Em negociação" },
  { id: "contratados", rotulo: "Contratados" },
  { id: "terminados", rotulo: "Terminados" },
];

const VAZIO: Record<Separador, string> = {
  novos: "Nenhum pedido novo. Assim que entrar um na sua zona e nas categorias que faz, aparece aqui — e avisamos por email.",
  negociacao: "Não há nenhuma negociação a decorrer.",
  contratados: "Ainda não fechou nenhum trabalho.",
  terminados: "Nada terminado por agora.",
};

/** Há quanto tempo, em palavras. Um pedido de "há 3 dias" já não é novo. */
function haQuantoTempo(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutos) || minutos < 0) return "";
  if (minutos < 60) return `há ${Math.max(1, minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

export default function Trabalhos({
  pedidos,
  onVoltar,
  onRecarregar,
}: {
  pedidos: Pedido[];
  onVoltar: () => void;
  onRecarregar: () => void;
}) {
  const [aberto, setAberto] = useState<number | null>(null);
  const [separador, setSeparador] = useState<Separador>("novos");

  const escolhido = pedidos.find((p) => p.negociacaoId === aberto);
  if (escolhido) {
    return (
      <DetalheDoTrabalho
        pedido={escolhido}
        onVoltar={() => setAberto(null)}
        onRecarregar={onRecarregar}
      />
    );
  }

  const porSeparador = (id: Separador) => pedidos.filter((p) => separadorDe(p) === id);
  const visiveis = porSeparador(separador);

  return (
    <>
      <CabecalhoDeEcra titulo="Os meus trabalhos" onVoltar={onVoltar} />

      {/* Separadores, com a conta ao lado.
          O número não é enfeite: é o que lhe diz onde há trabalho à espera sem
          ter de abrir cada um para ver. */}
      {/* Dobram de linha em vez de saírem do ecrã.
          Estavam a rolar na horizontal: num telemóvel, "Terminados" ficava
          cortado na margem e a barra de rolagem aparecia por baixo. Ninguém
          arrasta um separador que não sabe que existe. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {SEPARADORES.map((sep) => {
          const quantos = porSeparador(sep.id).length;
          const activo = separador === sep.id;
          return (
            <button
              key={sep.id}
              type="button"
              onClick={() => setSeparador(sep.id)}
              aria-pressed={activo}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition sm:px-3.5 sm:text-sm ${
                activo
                  ? "bg-[#0B1929] text-white"
                  : "bg-slate-100 text-slate-600 active:bg-slate-200"
              }`}
            >
              {sep.rotulo}
              {quantos > 0 && (
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    activo
                      ? "bg-white/20"
                      : sep.id === "novos"
                        ? "bg-[#00B4CC] text-white"
                        : "bg-slate-300 text-slate-700"
                  }`}
                >
                  {quantos}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visiveis.length === 0 && (
        <div className="rounded-2xl border border-[#E2EEF3] bg-white p-8 text-center">
          <p className="text-sm leading-relaxed text-slate-500">{VAZIO[separador]}</p>
        </div>
      )}

      <div className="space-y-3">
        {visiveis.map((p) => {
          const estado = ESTADO[p.estado] ?? { texto: p.estado, cls: "bg-slate-100 text-slate-500" };
          const fase = p.estado === "acordada" ? FASE[p.fase] : null;
          const fotos = fotosDe(p.filesJson);
          const fechado = p.estado === "acordada";
          const novo = separadorDe(p) === "novos";

          return (
            <button
              key={p.negociacaoId}
              onClick={() => setAberto(p.negociacaoId)}
              className={`block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition active:bg-slate-50 ${
                fechado
                  ? "border-emerald-300 ring-1 ring-emerald-100"
                  : novo
                    // A barra à esquerda é o que faz o olho parar aqui primeiro
                    // ao percorrer a lista. É o pedido com prazo a correr.
                    //
                    // Ciano da marca, e não âmbar: a CLYON não tem amarelo, e
                    // uma cor que não é da casa lê-se como aviso de sistema em
                    // vez de destaque.
                    ? "border-l-4 border-l-[#00B4CC] border-y-[#E2EEF3] border-r-[#E2EEF3]"
                    : "border-[#E2EEF3]"
              }`}
            >
              <div className="flex gap-3">
                {/* A primeira foto ao lado do título: é o que identifica o
                    trabalho de relance, muito antes do texto. */}
                {fotos.length > 0 ? (
                  <div className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fotos[0].url}
                      alt=""
                      className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200"
                    />
                    {fotos.length > 1 && (
                      <span className="absolute bottom-1 right-1 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        +{fotos.length - 1}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                    <Camera className="h-6 w-6 text-slate-300" aria-hidden="true" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-[15px] font-bold text-[#0B1929]">
                      {servicoDe(p)}
                    </h3>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {haQuantoTempo(p.actualizadoEm)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {novo && (
                      <span className="rounded-full bg-[#00B4CC] px-2 py-0.5 text-xs font-bold text-white">
                        novo
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estado.cls}`}>
                      {estado.texto}
                    </span>
                    {fase && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${fase.cls}`}>
                        {fase.texto}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {p.city ?? "—"}
                    </span>
                    {p.urgency && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {URGENCIA[p.urgency] ?? p.urgency}
                      </span>
                    )}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <HandCoins className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span
                      className={`text-lg font-bold ${
                        fechado ? "text-emerald-600" : "text-[#0B1929]"
                      }`}
                    >
                      {euros(fechado ? p.recebeSeFechado : p.recebeSeAceitar)}
                    </span>
                    <span className="text-[11px] text-slate-400">já com a taxa</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── O detalhe ───────────────────────────────────────────────────────────────

function DetalheDoTrabalho({
  pedido,
  onVoltar,
  onRecarregar,
}: {
  pedido: Pedido;
  onVoltar: () => void;
  onRecarregar: () => void;
}) {
  const [fotos, setFotos] = useState<FotoEnviada[]>([]);
  const [nota, setNota] = useState("");
  /** Qual foto está aberta em ecrã inteiro, ou null. */
  const [aVer, setAVer] = useState<{ lista: string[]; i: number } | null>(null);
  /**
   * Se o mapa chegou.
   *
   * Sem chave da Google configurada, a rota responde 204 — e um 204 no `src`
   * de uma imagem não é "nada": é o ícone de imagem partida, com o texto
   * alternativo ao lado. Pior do que não ter mapa nenhum.
   */
  const [semMapa, setSemMapa] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  const doCliente = fotosDe(pedido.filesJson);
  const prova = provaDe(pedido.provaJson);
  const fechado = pedido.estado === "acordada";

  async function marcarFeito() {
    if (fotos.length === 0) {
      setErro("Envie pelo menos uma fotografia do trabalho feito.");
      return;
    }
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/profissionais/trabalho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negociacaoId: pedido.negociacaoId,
          fotos: fotos.map((f) => f.url),
          nota,
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      onRecarregar();
      onVoltar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <CabecalhoDeEcra titulo={servicoDe(pedido)} onVoltar={onVoltar} />

      {/* O que o cliente enviou, em grande. É por aqui que se decide o preço. */}
      {doCliente.length > 0 && (
        <section className="mb-4">
          {/* A foto INTEIRA, sem cortar.
              Estava com `object-cover` e ficava recortada em cima e em baixo —
              e é sobre a fotografia que se decide o preço de uma recolha. O que
              fica fora do enquadramento é o que faz a viagem render menos do
              que devia. Fundo escuro porque uma foto ao alto deixa faixas dos
              lados, e cinzento-claro faz parecer que falta lá alguma coisa. */}
          <button
            type="button"
            onClick={() => setAVer({ lista: doCliente.map((f) => f.url), i: 0 })}
            className="block w-full overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-200"
            aria-label="Abrir fotografia em ecrã inteiro"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={doCliente[0].url}
              alt="Fotografia do pedido"
              className="mx-auto max-h-96 w-auto max-w-full object-contain"
            />
          </button>

          {doCliente.length > 1 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {doCliente.slice(1).map((f, i) => (
                <button
                  key={f.url}
                  type="button"
                  onClick={() =>
                    setAVer({ lista: doCliente.map((x) => x.url), i: i + 1 })
                  }
                  className="block overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-200"
                  aria-label={`Abrir fotografia ${i + 2}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={`Fotografia ${i + 2} do pedido`}
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <p className="mt-1.5 text-center text-xs text-slate-400">
            Toque para ver em ecrã inteiro
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
        {pedido.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {pedido.description}
          </p>
        )}
        <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            {pedido.city ?? "—"}
          </li>
          {pedido.urgency && (
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              {URGENCIA[pedido.urgency] ?? pedido.urgency}
            </li>
          )}
          {pedido.floor && <li className="pl-6">Andar: {pedido.floor}</li>}
          {pedido.hasElevator && <li className="pl-6">Elevador: {pedido.hasElevator}</li>}
          {pedido.precisaFatura && (
            <li className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              O cliente precisa de fatura
            </li>
          )}
          {pedido.precisaGuiaTransporte && (
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              O cliente precisa de guia de transporte
            </li>
          )}
        </ul>
      </section>

      {/* Morada e contacto: só existem depois de ser contratado. */}
      {fechado && pedido.morada && (
        <section className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Onde e com quem
          </h2>
          {/* O mapa antes da morada.
              Uma morada escrita obriga a imaginar onde fica; um mapa responde
              à pergunta que ele faz primeiro — "isto é longe?" — antes de
              ler uma palavra. É uma imagem estática servida por nós, para a
              chave da Google não sair para o browser. */}
          {!semMapa && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pedido.morada)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block overflow-hidden rounded-xl ring-1 ring-emerald-200"
              aria-label="Abrir a morada no mapa"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/mapa?q=${encodeURIComponent(pedido.morada)}&w=640&h=200`}
                alt=""
                className="h-36 w-full bg-emerald-100/50 object-cover"
                loading="lazy"
                onError={() => setSemMapa(true)}
              />
            </a>
          )}

          <p className="mt-2.5 flex items-start gap-2 text-sm text-emerald-900">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {pedido.morada}
          </p>
          {pedido.contactoNome && (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-emerald-900">
              <User className="h-4 w-4 shrink-0" aria-hidden="true" />
              {pedido.contactoNome}
              {pedido.contactoTelefone && (
                <span className="text-emerald-700">· {pedido.contactoTelefone}</span>
              )}
            </p>
          )}

          {/* Levar lá.
              A morada escrita não serve de nada a alguém que está a sair de
              casa com a carrinha: teria de a copiar, abrir o mapa e colar. Dois
              botões poupam esse minuto, e o minuto é dele.

              Waze e Maps, os dois: quem conduz todos os dias tem um deles
              instalado e não muda por nossa causa. Os dois links funcionam no
              browser se a aplicação não estiver lá. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pedido.morada)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800 transition active:bg-emerald-50"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Google Maps
            </a>
            <a
              href={`https://waze.com/ul?q=${encodeURIComponent(pedido.morada)}&navigate=yes`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800 transition active:bg-emerald-50"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Waze
            </a>
          </div>

          {pedido.contactoTelefone && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a
                href={`tel:${pedido.contactoTelefone}`}
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white transition active:bg-emerald-700"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Ligar
              </a>
              {/* O número vai sem espaços nem sinais: o WhatsApp recusa
                  qualquer coisa que não sejam dígitos, e um "+351 912..."
                  colado tal e qual abria uma conversa vazia. */}
              <a
                href={`https://wa.me/${pedido.contactoTelefone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white transition active:brightness-95"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp
              </a>
            </div>
          )}
        </section>
      )}

      {/* O valor */}
      <section className="mt-3 rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-4">
          <span className="flex items-center gap-1.5 text-sm text-slate-600">
            <HandCoins className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {fechado ? "Recebe" : "Recebe se aceitar"}
          </span>
          <span className="text-2xl font-bold text-emerald-600">
            {euros(fechado ? pedido.recebeSeFechado : pedido.recebeSeAceitar)}
          </span>
        </div>
        <p className="mt-1 text-right text-xs text-slate-400">já com a taxa CLYON descontada</p>
      </section>

      {/* ── A fase do trabalho ─────────────────────────────────────────────── */}
      {fechado && pedido.fase === "a_executar" && (
        <section className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <h2 className="text-base font-bold text-cyan-900">Quando estiver feito</h2>
          <p className="mt-1 text-sm leading-relaxed text-cyan-800">
            Fotografe o resultado e marque como feito. É o que o cliente vê antes de
            confirmar — e é o que liberta o seu dinheiro.
          </p>

          <div className="mt-3">
            <EnviarFotos fotos={fotos} onMudar={setFotos} maximo={8} rotulo="Fotografar" />
          </div>

          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Alguma coisa a dizer ao cliente? (opcional)"
            className="mt-3 w-full rounded-xl border-2 border-cyan-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
          />

          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}

          <button
            onClick={marcarFeito}
            disabled={aEnviar || fotos.length === 0}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white transition active:bg-cyan-700 disabled:opacity-40"
          >
            {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Está feito
          </button>
        </section>
      )}

      {fechado && pedido.fase === "a_confirmar" && (
        <section className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-cyan-900">
            <Clock className="h-5 w-5" aria-hidden="true" />À espera do cliente
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-cyan-800">
            Enviou a prova. O valor fica cativo até ele confirmar
            {pedido.diasAteLibertar != null && (
              <> — e liberta-se sozinho ao fim de {Math.ceil(pedido.diasAteLibertar)} dia
              {Math.ceil(pedido.diasAteLibertar) === 1 ? "" : "s"} se ele não disser nada</>
            )}
            .
          </p>
          {prova && prova.fotos.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {prova.fotos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setAVer({ lista: prova.fotos, i })}
                  className="block overflow-hidden rounded-lg bg-slate-900 ring-1 ring-cyan-200"
                  aria-label={`Abrir prova ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Prova ${i + 1}`} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {fechado && (pedido.fase === "confirmado" || pedido.fase === "pago") && (
        <section className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <BadgeCheck className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
          <h2 className="mt-1 text-base font-bold text-emerald-900">
            {pedido.fase === "pago" ? "Pago" : "Confirmado pelo cliente"}
          </h2>
          <p className="mt-1 text-sm text-emerald-800">
            {pedido.fase === "pago"
              ? "Este valor já foi transferido."
              : "O valor está disponível na sua carteira."}
          </p>
        </section>
      )}

      {/* A negociação, aqui dentro.
          Vivia só no link do email, e isso obrigava-o a guardar mensagens
          antigas para trabalhar — ao terceiro pedido já não sabia qual era
          qual. O link continua a funcionar; deixou é de ser o único caminho. */}
      {!fechado && pedido.estado !== "desistida" && pedido.estado !== "morta" && (
        <NegociacaoProfissional
          negociacaoId={pedido.negociacaoId}
          estadoInicial={pedido.estado}
          propostasIniciais={propostasDe(pedido.propostas)}
          valorAcordado={null}
          minimoDoCliente={pedido.querPagar}
          recebeSeAceitar={
            pedido.querPagar != null ? quantoOProfissionalRecebe(pedido.querPagar) : null
          }
          onMudou={onRecarregar}
        />
      )}

      {aVer && (
        <VisorDeFotos
          fotos={aVer.lista}
          indiceInicial={aVer.i}
          onFechar={() => setAVer(null)}
        />
      )}
    </>
  );
}
