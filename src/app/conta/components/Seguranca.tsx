"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ExternalLink, AlertTriangle, X } from "lucide-react";

function EliminarModal({ onClose }: { onClose: () => void }) {
  const [confirma, setConfirma] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleEliminar = async () => {
    if (confirma !== "ELIMINAR") return;
    setLoading(true);
    try {
      const res = await fetch("/api/users/me", { method: "DELETE" });
      if (!res.ok) throw new Error();
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Não foi possível eliminar a conta. Tenta novamente.");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Eliminar conta</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Esta acção é irreversível.</span>{" "}
            Os teus dados pessoais serão eliminados. Os pedidos existentes ficam anonimizados.
          </p>
          <div>
            <label htmlFor="confirma" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Escreve <span className="font-mono text-red-600">ELIMINAR</span> para confirmar
            </label>
            <input
              id="confirma"
              type="text"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              placeholder="ELIMINAR"
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-400/10"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={confirma !== "ELIMINAR" || loading}
            onClick={handleEliminar}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
          >
            {loading ? "A eliminar..." : "Eliminar conta"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Seguranca() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Segurança</h2>
        <p className="mt-0.5 text-sm text-slate-500">Gestão de acesso e segurança da conta.</p>
      </div>

      {/* Login Google */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Método de autenticação</h3>
        <p className="mt-2 text-sm text-slate-500">
          O teu login é gerido pela Google — não tens palavra-passe CLYON para gerir.
          Para alterar a palavra-passe da tua conta Google, faz-o directamente no Google.
        </p>
        <a
          href="https://myaccount.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
        >
          Gerir conta Google
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Zona de perigo */}
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-red-700">Zona de perigo</h3>
        </div>
        <p className="text-sm text-slate-600">
          Ao eliminares a conta, os teus dados pessoais são apagados permanentemente.
          Os pedidos existentes ficam anonimizados e não são eliminados.
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        >
          Eliminar conta
        </button>
      </div>

      {showModal && <EliminarModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
