"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  ShieldAlert,
  Truck,
  X,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { RAIO_MAXIMO_KM, RAIO_MINIMO_KM } from "@/lib/inscricao-profissional";
import { ESTADOS_DO_PROFISSIONAL, type EstadoDoProfissional } from "@/lib/edicao-profissional";

type Actividade = { recebidos: number; comProposta: number; fechados: number };

type Profissional = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  nif: string | null;
  city: string | null;
  categorias: string | null;
  zonas: string | null;
  raioKm: number | null;
  emiteFatura: number;
  emiteGuiaTransporte: number;
  numeroTransportador: string | null;
  guiaVerificadaEm: string | null;
  guiaVerificadaPor: string | null;
  estado: string;
  isActive: number;
  baseLat: string | null;
  baseLng: string | null;
  createdAt: string;
  actividade: Actividade;
};

const CATEGORIAS = SERVICE_CATEGORIES.filter((c) => c.id !== "outro");

const ESTADO_CLS: Record<string, string> = {
  pendente: "bg-amber-500/15 text-amber-300",
  aprovado: "bg-emerald-500/15 text-emerald-300",
  rejeitado: "bg-slate-700 text-slate-300",
  suspenso: "bg-red-500/15 text-red-300",
};

function lista(json: string | null): string[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

function etiqueta(id: string): string {
  return SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export default function AdminProfissionaisPanel() {
  const { token, ready } = useAdminAuth();
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState<"todos" | EstadoDoProfissional | "por_verificar">("todos");
  const [busca, setBusca] = useState("");
  const [aEditar, setAEditar] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/profissionais", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setProfissionais(dados.profissionais ?? []);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready && token) carregar();
  }, [ready, token, carregar]);

  async function actuar(id: number, corpo: Record<string, unknown>) {
    if (!token) return;
    setOcupado(id);
    setErro("");
    setAviso("");
    try {
      const res = await fetch(`/api/admin/profissionais/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível actualizar.");
        return;
      }
      if (dados.avisoDeDistribuicao) {
        setAviso(
          "Alteração feita. Afecta quem recebe os pedidos NOVOS — os que já foram distribuídos não mudam.",
        );
      }
      setAEditar(null);
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  const contagens = useMemo(() => {
    const c: Record<string, number> = { todos: profissionais.length, por_verificar: 0 };
    for (const e of ESTADOS_DO_PROFISSIONAL) c[e] = 0;
    for (const p of profissionais) {
      c[p.estado] = (c[p.estado] ?? 0) + 1;
      if (p.emiteGuiaTransporte === 1 && !p.guiaVerificadaEm) c.por_verificar += 1;
    }
    return c;
  }, [profissionais]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return profissionais.filter((p) => {
      if (filtro === "por_verificar") {
        if (!(p.emiteGuiaTransporte === 1 && !p.guiaVerificadaEm)) return false;
      } else if (filtro !== "todos" && p.estado !== filtro) {
        return false;
      }
      if (!termo) return true;
      const alvo = [p.name, p.email, p.city, ...lista(p.zonas), ...lista(p.categorias)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return alvo.includes(termo);
    });
  }, [profissionais, filtro, busca]);

  if (!ready || aCarregar) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const FILTROS: Array<{ id: typeof filtro; nome: string }> = [
    { id: "todos", nome: "Todos" },
    { id: "pendente", nome: "Por aprovar" },
    { id: "por_verificar", nome: "Guia por verificar" },
    { id: "aprovado", nome: "Aprovados" },
    { id: "suspenso", nome: "Suspensos" },
    { id: "rejeitado", nome: "Rejeitados" },
  ];

  return (
    <div>
      {/* O título é da secção que envolve este painel — aqui fica só a
          contagem, que é a informação que muda. */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-400">
          {contagens.todos} inscritos · {contagens.aprovado} a receber pedidos
        </p>
        <button
          onClick={carregar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar
        </button>
      </header>

      {/* Filtros — com as contagens, para se ver onde está o trabalho */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const n = contagens[f.id] ?? 0;
          const activo = filtro === f.id;
          const urgente = f.id === "por_verificar" && n > 0;
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              aria-pressed={activo}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activo
                  ? "bg-sky-500 text-white"
                  : urgente
                    ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {f.nome} {n > 0 && <span className="opacity-70">{n}</span>}
            </button>
          );
        })}
      </div>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Procurar por nome, email, cidade, zona ou categoria…"
        className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
      />

      {erro && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">
          {aviso}
        </p>
      )}

      {visiveis.length === 0 && (
        <p className="rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-8 text-center text-sm text-slate-500">
          {profissionais.length === 0 ? "Ainda ninguém se inscreveu." : "Nada com esse filtro."}
        </p>
      )}

      <div className="space-y-3">
        {visiveis.map((p) => (
          <Cartao
            key={p.id}
            p={p}
            ocupado={ocupado === p.id}
            emEdicao={aEditar === p.id}
            onEditar={() => setAEditar(aEditar === p.id ? null : p.id)}
            onActuar={(corpo) => actuar(p.id, corpo)}
          />
        ))}
      </div>
    </div>
  );
}

function Cartao({
  p,
  ocupado,
  emEdicao,
  onEditar,
  onActuar,
}: {
  p: Profissional;
  ocupado: boolean;
  emEdicao: boolean;
  onEditar: () => void;
  onActuar: (corpo: Record<string, unknown>) => void;
}) {
  const categorias = lista(p.categorias);
  const zonas = lista(p.zonas);
  const guiaPorVerificar = p.emiteGuiaTransporte === 1 && !p.guiaVerificadaEm;
  const semCoordenadas = !p.baseLat || !p.baseLng;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-white">{p.name}</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                ESTADO_CLS[p.estado] ?? "bg-slate-800 text-slate-400"
              }`}
            >
              {p.estado}
            </span>
            {p.emiteFatura === 1 && (
              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300">
                fatura
              </span>
            )}
            {p.guiaVerificadaEm && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                guia verificada
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {p.email && (
              <a href={`mailto:${p.email}`} className="flex items-center gap-1 hover:text-cyan-600">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                {p.email}
              </a>
            )}
            {p.phone && (
              <a href={`tel:${p.phone}`} className="flex items-center gap-1 hover:text-cyan-600">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {p.phone}
              </a>
            )}
            {p.nif && <span>NIF {p.nif}</span>}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {p.city} · até {p.raioKm ?? "—"} km
            {zonas.length > 0 && ` · ${zonas.join(", ")}`}
          </p>

          {/* Sem coordenadas o raio não é aplicado. Não é um detalhe: o
              profissional pediu 40 km e está a receber por nome de cidade. */}
          {semCoordenadas && (
            <button
              onClick={() => onActuar({ regeocodificar: true })}
              disabled={ocupado}
              className="mt-1.5 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
            >
              Sem coordenadas — só recebe por zona. Tentar localizar
            </button>
          )}

          {categorias.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              {categorias.map(etiqueta).join(" · ")}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-400">
            Inscrito a {new Date(p.createdAt).toLocaleDateString("pt-PT")}
          </p>
        </div>

        {/* Actividade — o que diz se vale a pena mantê-lo */}
        <div className="flex shrink-0 gap-4 rounded-xl bg-slate-800/60 px-4 py-2.5 text-center">
          <div>
            <div className="text-lg font-bold text-white">{p.actividade.recebidos}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">recebidos</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{p.actividade.comProposta}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">respondeu</div>
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-600">{p.actividade.fechados}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">fechados</div>
          </div>
        </div>
      </div>

      {/* Guia por verificar — em destaque, é o que trava pedidos */}
      {guiaPorVerificar && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Declarou emitir guia de transporte
                </p>
                <p className="mt-0.5 text-xs text-amber-300">
                  Registo n.º <span className="font-mono font-semibold">{p.numeroTransportador}</span>{" "}
                  — confirme no registo da APA. Até lá não recebe pedidos que exijam guia.
                </p>
              </div>
            </div>
            <button
              onClick={() => onActuar({ verificarGuia: true })}
              disabled={ocupado}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              Confirmei o registo
            </button>
          </div>
        </div>
      )}

      {p.guiaVerificadaEm && p.guiaVerificadaPor && (
        <p className="mt-2 text-xs text-slate-400">
          Guia n.º {p.numeroTransportador} verificada por {p.guiaVerificadaPor} ·{" "}
          {new Date(p.guiaVerificadaEm).toLocaleDateString("pt-PT")}
        </p>
      )}

      {/* Acções de estado — todas as transições, não só duas */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
        {p.estado !== "aprovado" && (
          <button
            onClick={() => onActuar({ estado: "aprovado" })}
            disabled={ocupado}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {p.estado === "suspenso" ? "Reactivar" : "Aprovar"}
          </button>
        )}
        {p.estado === "aprovado" && (
          <button
            onClick={() => onActuar({ estado: "suspenso" })}
            disabled={ocupado}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
          >
            Suspender
          </button>
        )}
        {p.estado === "pendente" && (
          <button
            onClick={() => onActuar({ estado: "rejeitado" })}
            disabled={ocupado}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-800/60 disabled:opacity-50"
          >
            Rejeitar
          </button>
        )}
        <button
          onClick={onEditar}
          disabled={ocupado}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {emEdicao ? "Fechar" : "Editar perfil"}
        </button>
        {ocupado && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />}
      </div>

      {emEdicao && <Editor p={p} onGuardar={onActuar} ocupado={ocupado} />}
    </article>
  );
}

/**
 * Editar o que o profissional declarou.
 *
 * Sem isto, um profissional que passe a fazer jardinagem ou a deslocar-se mais
 * longe obrigava a uma consulta SQL à mão — que é como não se faz, e o perfil
 * fica a dizer uma coisa enquanto ele faz outra.
 */
function Editor({
  p,
  onGuardar,
  ocupado,
}: {
  p: Profissional;
  onGuardar: (corpo: Record<string, unknown>) => void;
  ocupado: boolean;
}) {
  const [categorias, setCategorias] = useState<string[]>(lista(p.categorias));
  const [zonas, setZonas] = useState(lista(p.zonas).join(", "));
  const [raioKm, setRaioKm] = useState(String(p.raioKm ?? 30));
  const [emiteFatura, setEmiteFatura] = useState(p.emiteFatura === 1);
  const [emiteGuia, setEmiteGuia] = useState(p.emiteGuiaTransporte === 1);
  const [numero, setNumero] = useState(p.numeroTransportador ?? "");

  const numeroMudou = numero.trim() !== (p.numeroTransportador ?? "");

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-slate-800 bg-slate-800/60 p-4">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Categorias
        </span>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {CATEGORIAS.map((c) => {
            const activa = categorias.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setCategorias((l) =>
                    l.includes(c.id) ? l.filter((x) => x !== c.id) : [...l, c.id],
                  )
                }
                aria-pressed={activa}
                className={`flex items-center gap-1.5 rounded-lg border-2 p-2 text-left text-xs font-medium transition ${
                  activa
                    ? "border-cyan-600 bg-cyan-50 text-cyan-900"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-cyan-300"
                }`}
              >
                {activa ? (
                  <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                {c.label}
              </button>
            );
          })}
        </div>
        {categorias.length === 0 && (
          <p className="mt-1 text-xs text-red-600">
            Tem de ficar com pelo menos uma — sem categorias não recebe nada.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Raio (km)
          </span>
          <input
            type="number"
            min={RAIO_MINIMO_KM}
            max={RAIO_MAXIMO_KM}
            value={raioKm}
            onChange={(e) => setRaioKm(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Zonas <span className="font-normal normal-case">(separadas por vírgula)</span>
          </span>
          <input
            value={zonas}
            onChange={(e) => setZonas(e.target.value)}
            placeholder="Lisboa, Sintra"
            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500"
          />
        </label>
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={emiteFatura}
            onChange={(e) => setEmiteFatura(e.target.checked)}
            className="h-4 w-4 accent-cyan-600"
          />
          Emite fatura
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={emiteGuia}
            onChange={(e) => setEmiteGuia(e.target.checked)}
            className="h-4 w-4 accent-cyan-600"
          />
          Emite guia de transporte
        </label>
        {emiteGuia && (
          <div>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Número de registo de transportador"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500"
            />
            {numeroMudou && p.guiaVerificadaEm && (
              <p className="mt-1 text-xs text-amber-700">
                Mudar o número anula a verificação — terá de confirmar o novo. É de
                propósito: senão bastava trocá-lo depois da confirmação.
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() =>
          onGuardar({
            categorias,
            zonas: zonas
              .split(",")
              .map((z) => z.trim())
              .filter(Boolean),
            raioKm,
            emiteFatura,
            emiteGuiaTransporte: emiteGuia,
            numeroTransportador: emiteGuia ? numero : null,
          })
        }
        disabled={ocupado || categorias.length === 0}
        className="w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
      >
        Guardar alterações
      </button>
    </div>
  );
}
