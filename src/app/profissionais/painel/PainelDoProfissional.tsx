"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  HandCoins,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  Truck,
} from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";

/**
 * Os pedidos do profissional, num sítio só.
 *
 * É a lista que faltava. Com um link por email e por pedido, quem tivesse cinco
 * pedidos em aberto tinha cinco emails e nenhuma vista de conjunto — e ao
 * terceiro já não sabia a quais tinha respondido.
 *
 * Os valores mostrados são sempre o que ele recebe, líquido. O bruto não
 * aparece em sítio nenhum — ver a decisão em taxas-plataforma.ts.
 */

type Pedido = {
  negociacaoId: number;
  pedidoId: number;
  estado: string;
  actualizadoEm: string;
  serviceType: string | null;
  city: string | null;
  urgency: string | null;
  description: string | null;
  filesJson: string | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  querPagar: number | null;
  recebeSeAceitar: number | null;
  recebeSeFechado: number | null;
};

const URGENCIA: Record<string, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  this_week: "Esta semana",
  flexible: "Sem pressa",
};

const ESTADO: Record<string, { texto: string; cls: string }> = {
  aberta: { texto: "à espera da sua resposta", cls: "bg-blue-50 text-blue-700" },
  aguarda_contratacao: { texto: "à espera do cliente", cls: "bg-amber-50 text-amber-700" },
  acordada: { texto: "é seu", cls: "bg-emerald-50 text-emerald-700" },
  desistida: { texto: "terminada", cls: "bg-slate-100 text-slate-500" },
  morta: { texto: "fechada com outro", cls: "bg-slate-100 text-slate-500" },
};

function euros(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " €";
}

function nFotos(filesJson: string | null): number {
  if (!filesJson) return 0;
  try {
    const l = JSON.parse(filesJson);
    return Array.isArray(l) ? l.length : 0;
  } catch {
    return 0;
  }
}

export default function PainelDoProfissional() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      const res = await fetch("/api/profissionais/meus-pedidos");
      if (res.status === 401) {
        router.push("/profissionais/entrar");
        return;
      }
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setNome(dados.nome ?? "");
      setPedidos(dados.pedidos ?? []);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function sair() {
    await fetch("/api/profissionais/sair", { method: "POST" });
    router.push("/profissionais/entrar");
  }

  if (aCarregar) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const aResponder = pedidos.filter((p) => p.estado === "aberta").length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1929]">Os meus pedidos</h1>
          <p className="mt-1 text-sm text-slate-500">
            {nome}
            {aResponder > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-cyan-700">
                  {aResponder} à espera de resposta
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={carregar}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Actualizar
          </button>
          <button
            onClick={sair}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sair
          </button>
        </div>
      </header>

      {erro && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      {pedidos.length === 0 && (
        <div className="rounded-2xl border border-[#E2EEF3] bg-white p-8 text-center">
          <p className="text-sm leading-relaxed text-slate-500">
            Ainda não há pedidos para si. Assim que entrar um na sua zona e nas categorias
            que faz, aparece aqui — e avisamos por email.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {pedidos.map((p) => {
          const servico =
            SERVICE_CATEGORIES.find((c) => c.id === p.serviceType)?.label ??
            p.serviceType ??
            "Serviço";
          const estado =
            ESTADO[p.estado] ?? { texto: p.estado, cls: "bg-slate-100 text-slate-500" };
          const fotos = nFotos(p.filesJson);
          const fechado = p.estado === "acordada";

          return (
            <article
              key={p.negociacaoId}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                fechado ? "border-emerald-300 ring-1 ring-emerald-100" : "border-[#E2EEF3]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-[#0B1929]">{servico}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estado.cls}`}
                    >
                      {estado.texto}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
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
                    {fotos > 0 && (
                      <span className="flex items-center gap-1">
                        <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                        {fotos}
                      </span>
                    )}
                    {p.precisaFatura && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        fatura
                      </span>
                    )}
                    {p.precisaGuiaTransporte && (
                      <span className="flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                        guia
                      </span>
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-xs text-slate-400">
                    <HandCoins className="h-3.5 w-3.5" aria-hidden="true" />
                    {fechado ? "recebe" : "recebe se aceitar"}
                  </div>
                  <div
                    className={`text-xl font-bold ${
                      fechado ? "text-emerald-600" : "text-[#0B1929]"
                    }`}
                  >
                    {euros(fechado ? p.recebeSeFechado : p.recebeSeAceitar)}
                  </div>
                  <div className="text-[10px] text-slate-400">já com a taxa CLYON</div>
                </div>
              </div>

              {p.description && (
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{p.description}</p>
              )}

              {fechado ? (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  O trabalho é seu. O valor fica retido e é libertado quando o cliente
                  confirmar que está feito.
                </p>
              ) : (
                <p className="mt-3 text-xs text-slate-400">
                  Pedido #{p.pedidoId} · o link para responder está no email que lhe
                  enviámos.
                </p>
              )}
            </article>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Precisa de ajuda?{" "}
        <Link href="/contactos" className="font-medium text-cyan-600 hover:underline">
          Fale connosco
        </Link>
      </p>
    </main>
  );
}
