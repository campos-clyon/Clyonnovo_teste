"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearColaboradorStorage, getColaboradorItem } from "@/lib/colaborador-storage";
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle,
  Clock,
  History,
  Loader2,
  Lock,
  LogOut,
  PauseCircle,
  PlayCircle,
  StopCircle,
} from "lucide-react";

import { HistoricoHorasModal } from "@/components/HistoricoHorasModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Estatisticas {
  horas: string;
  valor: string;
  trabalhos: number;
  dias: number;
}

interface DadosEstatisticas {
  hoje: Estatisticas & { periodo?: string };
  semana: Estatisticas & { periodo?: string };
  ultimos15Dias: Estatisticas;
  mes: Estatisticas;
  registros: any[];
}

interface RegistroEmAberto {
  id: number;
  data: string;
  horaEntrada: string;
  horaPausa: string | null;
  horaSaida: string | null;
  numeroTrabalhos: number;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DashboardStat({
  title,
  resolvedTitle,
  hours,
  value,
  jobs,
}: {
  title: string;
  resolvedTitle?: string;
  hours: string;
  value: string;
  jobs: number;
}) {
  return (
    <Card className="rounded-[28px] border-cyan-100 bg-white shadow-[0_22px_50px_-36px_rgba(14,116,144,0.16)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-[0.16em] text-cyan-700">
          {resolvedTitle || title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-950">{hours || "0"}h</div>
        <div className="mt-2 text-2xl font-semibold text-cyan-600">€{value || "0.00"}</div>
        <div className="mt-2 text-sm text-slate-500">{jobs || 0} trabalhos</div>
      </CardContent>
    </Card>
  );
}

function MessageBanner({
  type,
  text,
}: {
  type: "error" | "success";
  text: string;
}) {
  const isError = type === "error";
  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 shadow-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {isError ? (
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
      ) : (
        <CheckCircle className="h-5 w-5 flex-shrink-0" />
      )}
      <span>{text}</span>
    </div>
  );
}

function FieldShell({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}

export default function ColaboradorDashboard() {
  const router = useRouter();

  const [nomeColaborador, setNomeColaborador] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [estatisticas, setEstatisticas] = useState<DadosEstatisticas | null>(null);
  const [registroEmAberto, setRegistroEmAberto] = useState<RegistroEmAberto | null>(null);
  const [showHistorico, setShowHistorico] = useState(false);
  const [colaboradorId, setColaboradorId] = useState<number | null>(null);

  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [horaEntrada, setHoraEntrada] = useState("");
  const [horaPausaUpdate, setHoraPausaUpdate] = useState("");
  const [horaSaidaUpdate, setHoraSaidaUpdate] = useState("");
  const [numeroTrabalhosUpdate, setNumeroTrabalhosUpdate] = useState("0");

  useEffect(() => {
    const metaRobots = document.createElement("meta");
    metaRobots.name = "robots";
    metaRobots.content = "noindex, nofollow";
    document.head.appendChild(metaRobots);

    return () => {
      document.head.removeChild(metaRobots);
    };
  }, []);

  useEffect(() => {
    const token = getColaboradorItem("token");
    const nome = getColaboradorItem("nome");
    const id = getColaboradorItem("id");
    const isAdmin = getColaboradorItem("isAdmin");
    const funcao = getColaboradorItem("funcao");

    if (!token) {
      router.push("/colaboradores");
      return;
    }

    if (isAdmin === "1") {
      router.push("/colaboradores/admin");
      return;
    }

    // Assistente não deve registar horas — redirecionar para painel de pedidos
    if (funcao === "assistente") {
      router.replace("/colaboradores/admin?section=pedidos");
      return;
    }

    setNomeColaborador(nome || "");
    if (id) setColaboradorId(parseInt(id));
    void carregarDados(token);
  }, [router]);

  const carregarDados = async (token: string) => {
    try {
      const responseEstatisticas = await fetch("/api/colaboradores/estatisticas", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!responseEstatisticas.ok) {
        if (responseEstatisticas.status === 401) {
          clearColaboradorStorage();
          router.push("/colaboradores");
          return;
        }
        throw new Error("Erro ao carregar estatísticas");
      }

      const dataEstatisticas = await responseEstatisticas.json();
      setEstatisticas(dataEstatisticas);

      const responseRegistro = await fetch("/api/colaboradores/registro-em-aberto", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (responseRegistro.ok) {
        const dataRegistro = await responseRegistro.json();
        if (dataRegistro.registro) {
          setRegistroEmAberto(dataRegistro.registro);
          setHoraPausaUpdate(dataRegistro.registro.horaPausa || "");
          setHoraSaidaUpdate(dataRegistro.registro.horaSaida || "");
          setNumeroTrabalhosUpdate(dataRegistro.registro.numeroTrabalhos.toString());
        } else {
          setRegistroEmAberto(null);
          setHoraPausaUpdate("");
          setHoraSaidaUpdate("");
          setNumeroTrabalhosUpdate("0");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearColaboradorStorage();
    router.push("/colaboradores");
  };

  const handleRegistrarEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const token = getColaboradorItem("token");
    if (!token) {
      router.push("/colaboradores");
      return;
    }

    try {
      const response = await fetch("/api/colaboradores/registrar-horas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data,
          horaEntrada,
          horaPausa: null,
          horaSaida: null,
          numeroTrabalhos: 0,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erro ao registrar entrada");
      }

      setSuccess("Entrada registada com sucesso!");
      setHoraEntrada("");
      await carregarDados(token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAtualizarRegistro = async (tipo: "pausa" | "saida") => {
    setError("");
    setSuccess("");
    setSaving(true);

    const token = getColaboradorItem("token");
    if (!token || !registroEmAberto) {
      router.push("/colaboradores");
      return;
    }

    try {
      const body: any = {
        numeroTrabalhos: parseInt(numeroTrabalhosUpdate),
      };

      if (tipo === "pausa") {
        body.horaPausa = horaPausaUpdate;
      } else {
        body.horaSaida = horaSaidaUpdate;
        body.horaPausa = horaPausaUpdate || "00:00";
      }

      const response = await fetch(`/api/colaboradores/atualizar-registro/${registroEmAberto.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erro ao atualizar registro");
      }

      setSuccess(tipo === "pausa" ? "Pausa registrada com sucesso!" : "Saída registrada com sucesso!");
      await carregarDados(token);

      if (tipo === "saida") {
        setRegistroEmAberto(null);
        setHoraPausaUpdate("");
        setHoraSaidaUpdate("");
        setNumeroTrabalhosUpdate("0");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(180deg,#f8fcff_0%,#eef7fb_100%)]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(180deg,#f8fcff_0%,#eef7fb_100%)] px-4 pb-12 pt-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 rounded-[32px] border border-cyan-100 bg-white/92 p-6 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)] backdrop-blur-sm lg:flex lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Dashboard do colaborador
              </div>
              <h1 className="mt-4 text-[2.2rem] font-bold leading-tight text-slate-950">
                Olá, {nomeColaborador}!
              </h1>
              <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
                Registe as suas horas com um fluxo claro, visual e rápido de usar.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3 lg:mt-0">
              <Button
                variant="outline"
                onClick={() => setShowHistorico(true)}
                className="rounded-2xl border-cyan-200 bg-white text-slate-700 hover:bg-cyan-50"
              >
                <History className="mr-2 h-4 w-4" />
                Histórico
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/colaboradores/alterar-senha")}
                className="rounded-2xl border-cyan-200 bg-white text-slate-700 hover:bg-cyan-50"
              >
                <Lock className="mr-2 h-4 w-4" />
                Alterar palavra-passe
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <DashboardStat
              title={estatisticas?.hoje.periodo || "Hoje"}
              hours={estatisticas?.hoje.horas || "0"}
              value={estatisticas?.hoje.valor || "0.00"}
              jobs={estatisticas?.hoje.trabalhos || 0}
            />
            <DashboardStat
              title="Últimos 15 dias"
              resolvedTitle={estatisticas?.semana.periodo || "Semana"}
              hours={estatisticas?.semana.horas || "0"}
              value={estatisticas?.semana.valor || "0.00"}
              jobs={estatisticas?.semana.trabalhos || 0}
            />
            <DashboardStat
              title="Este mês"
              hours={estatisticas?.mes.horas || "0"}
              value={estatisticas?.mes.valor || "0.00"}
              jobs={estatisticas?.mes.trabalhos || 0}
            />
          </div>

          {error ? <MessageBanner type="error" text={error} /> : null}
          {success ? <MessageBanner type="success" text={success} /> : null}

          {registroEmAberto ? (
            <Card className="mb-6 rounded-[30px] border-cyan-200 bg-white shadow-[0_26px_60px_-34px_rgba(14,116,144,0.2)]">
              <CardHeader className="rounded-t-[30px] border-b border-cyan-100 bg-cyan-50/70">
                <CardTitle className="flex items-center gap-2 text-cyan-700">
                  <PlayCircle className="h-5 w-5" />
                  Registo em aberto
                </CardTitle>
              <CardDescription className="text-slate-600">
                Entrada registrada em {formatDate(registroEmAberto.data)} às {registroEmAberto.horaEntrada}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm leading-7 text-slate-600">
                Para fechar o dia, preencha a pausa apenas se existiu. Se deixar vazio, o sistema considera pausa 0 e fecha o registo com a hora de saída e o número de trabalhos.
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FieldShell label="Hora Pausa (opcional)" icon={<PauseCircle className="h-4 w-4" />}>
                    <Input
                      type="time"
                      value={horaPausaUpdate}
                      onChange={(e) => setHoraPausaUpdate(e.target.value)}
                      disabled={saving || !!registroEmAberto.horaSaida}
                      className="h-11 rounded-2xl border-cyan-200 bg-white"
                    />
                  </FieldShell>

                  <FieldShell label="Hora Saída" icon={<StopCircle className="h-4 w-4" />}>
                    <Input
                      type="time"
                      value={horaSaidaUpdate}
                      onChange={(e) => setHoraSaidaUpdate(e.target.value)}
                      disabled={saving || !!registroEmAberto.horaSaida}
                      className="h-11 rounded-2xl border-red-200 bg-white"
                    />
                  </FieldShell>

                  <FieldShell label="Nº de Trabalhos" icon={<Briefcase className="h-4 w-4" />}>
                    <Input
                      type="number"
                      min="0"
                      value={numeroTrabalhosUpdate}
                      onChange={(e) => setNumeroTrabalhosUpdate(e.target.value)}
                      disabled={saving || !!registroEmAberto.horaSaida}
                      className="h-11 rounded-2xl border-amber-200 bg-white"
                    />
                  </FieldShell>
                </div>

                {!registroEmAberto.horaSaida ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {!registroEmAberto.horaPausa && horaPausaUpdate ? (
                      <Button
                        onClick={() => handleAtualizarRegistro("pausa")}
                        disabled={saving || !horaPausaUpdate}
                        className="rounded-2xl bg-amber-500 text-white hover:bg-amber-600"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <PauseCircle className="mr-2 h-4 w-4" />
                            Registrar Pausa
                          </>
                        )}
                      </Button>
                    ) : null}

                    <Button
                      onClick={() => handleAtualizarRegistro("saida")}
                      disabled={saving || !horaSaidaUpdate}
                      className="flex-1 rounded-2xl bg-red-500 text-white hover:bg-red-600"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <StopCircle className="mr-2 h-4 w-4" />
                          Registrar Saída
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    ✓ Registro completo! Saída registrada às {registroEmAberto.horaSaida}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-[30px] border-cyan-200 bg-white shadow-[0_26px_60px_-34px_rgba(14,116,144,0.2)]">
              <CardHeader className="rounded-t-[30px] border-b border-cyan-100 bg-cyan-50/70">
                <CardTitle className="flex items-center gap-2 text-cyan-700">
                  <PlayCircle className="h-5 w-5" />
                  Registrar Entrada
                </CardTitle>
              <CardDescription className="text-slate-600">
                Primeiro registe apenas a entrada. No fim do dia feche o registo com pausa, saída e número de trabalhos.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleRegistrarEntrada} className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FieldShell label="Data" icon={<Calendar className="h-4 w-4" />}>
                      <Input
                        id="data"
                        type="date"
                        value={data}
                        onChange={(e) => setData(e.target.value)}
                        required
                        disabled={saving}
                        className="h-11 rounded-2xl border-cyan-200 bg-white"
                      />
                    </FieldShell>

                    <FieldShell label="Hora Entrada" icon={<Clock className="h-4 w-4" />}>
                      <Input
                        id="horaEntrada"
                        type="time"
                        value={horaEntrada}
                        onChange={(e) => setHoraEntrada(e.target.value)}
                        required
                        disabled={saving}
                        className="h-11 rounded-2xl border-cyan-200 bg-white"
                      />
                    </FieldShell>
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-2xl bg-cyan-500 font-semibold text-white hover:bg-cyan-600"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="mr-2 h-5 w-5" />
                        Registrar Entrada
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {estatisticas && estatisticas.registros.length > 0 ? (
            <Card className="mt-6 rounded-[30px] border-cyan-100 bg-white shadow-[0_22px_50px_-36px_rgba(14,116,144,0.16)]">
              <CardHeader className="border-b border-cyan-100 bg-cyan-50/50">
                <CardTitle className="text-cyan-700">Histórico Recente</CardTitle>
                <CardDescription className="text-slate-600">
                  Os seus últimos registos de horas
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {estatisticas.registros.slice(0, 5).map((registro: any) => (
                    <div
                      key={registro.id}
                      className="rounded-[24px] border border-cyan-100 bg-slate-50/80 p-4 transition-colors hover:bg-cyan-50/60"
                    >
                      <div className="mb-3 flex items-start justify-between border-b border-slate-200 pb-3">
                        <div className="text-base font-bold text-slate-800">
                          {registro.dataFormatada ||
                            (typeof registro.data === "string"
                              ? formatDate(registro.data)
                              : "Data indisponível")}
                        </div>
                        <div className="text-lg font-bold text-cyan-600">{registro.horasTrabalhadas}h</div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-slate-700">
                        <div>Entrada: {registro.horaEntrada}</div>
                        <div>Pausa: {registro.horaPausa || "--:--"}</div>
                        <div>Saída: {registro.horaSaida || "--:--"}</div>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">{registro.numeroTrabalhos} trabalho(s)</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {colaboradorId ? (
        <HistoricoHorasModal
          isOpen={showHistorico}
          onClose={() => setShowHistorico(false)}
          colaboradorId={colaboradorId}
          colaboradorNome={nomeColaborador}
        />
      ) : null}
    </>
  );
}
