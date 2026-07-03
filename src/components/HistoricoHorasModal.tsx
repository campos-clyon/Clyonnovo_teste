"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface HistoricoHorasModalProps {
  isOpen: boolean;
  onClose: () => void;
  colaboradorId: number;
  colaboradorNome: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function HistoricoHorasModal({
  isOpen,
  onClose,
  colaboradorId,
  colaboradorNome,
}: HistoricoHorasModalProps) {
  const [page, setPage] = useState(1);
  const [registros, setRegistros] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const limit = 10;

  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem("colaborador_token");
    if (!token) return;

    setIsLoading(true);
    fetch(`/api/colaboradores/historico?colaboradorId=${colaboradorId}&page=${page}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setRegistros(data.registros || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, colaboradorId, page]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-cyan-100 bg-white shadow-[0_32px_90px_-40px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between border-b border-cyan-100 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_22%),linear-gradient(180deg,#f8fcff_0%,#eef7fb_100%)] px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Histórico
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">{colaboradorNome}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-cyan-100 bg-white p-2 text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-cyan-600" />
                <p className="text-slate-600">A carregar histórico...</p>
              </div>
            </div>
          ) : registros.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-[24px] border border-dashed border-cyan-200 bg-slate-50/80">
              <p className="text-lg text-slate-600">Nenhum registo encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {registros.map((registro, index) => (
                <div
                  key={index}
                  className="rounded-[24px] border border-cyan-100 bg-slate-50/75 p-4"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-bold text-slate-950">
                        {registro.dataFormatada || (registro.data ? formatDate(registro.data) : "-")}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {registro.numeroTrabalhos} trabalho(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-cyan-700">{registro.horasTrabalhadas}h</p>
                      <p className="text-sm font-semibold text-slate-700">€{registro.valorTotal}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
                    <div>Entrada: {registro.horaEntrada || "--:--"}</div>
                    <div>Pausa: {registro.horaPausa || "--:--"}</div>
                    <div>Saída: {registro.horaSaida || "--:--"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {registros.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-cyan-100 bg-slate-50/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              Página {page} de {totalPages} ({total} registos)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4"
              >
                Próxima
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
