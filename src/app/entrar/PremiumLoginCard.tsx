"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Lock, Zap, ShieldCheck, Mail } from "lucide-react";

interface Props {
  errorMsg?: string | null;
}

const TRUST = [
  { icon: Lock, label: "Encriptado" },
  { icon: Zap, label: "Instantâneo" },
  { icon: ShieldCheck, label: "Verificado" },
] as const;

export function PremiumLoginCard({ errorMsg }: Props) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);

  // A entrada por email, para quem não tem conta Google no endereço que usa.
  const [email, setEmail] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signIn("google", { callbackUrl: "/conta" });
  };

  const pedirLink = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (aEnviar) return;
    setAEnviar(true);
    try {
      await fetch("/api/entrada/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* A resposta é sempre a mesma, e uma falha de rede não a pode mudar:
         dizer "não conseguimos enviar" contava que o endereço existe. */
    } finally {
      setAEnviar(false);
      setEnviado(true);
    }
  };

  return (
    <div className="relative w-full max-w-sm">
      {/* Halo suave por trás do cartão */}
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-cyan-200/50 via-transparent to-teal-200/50 blur-3xl" />

      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-cyan-900/5 backdrop-blur-sm sm:p-7">
        {/* Barra de destaque no topo */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-400" />

        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Link href="/" aria-label="Voltar à página inicial">
            <Image src="/logo-clyon.png" alt="CLYON" width={116} height={46} priority />
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1">
          {(["login", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                tab === t
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "login" ? "Entrar" : "Registar"}
            </button>
          ))}
        </div>

        {/* Heading */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">
            {tab === "login" ? "Bem-vindo de volta" : "Cria a tua conta"}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {tab === "login"
              ? "Acede à tua conta para acompanhar os teus pedidos"
              : "Regista-te para guardar o histórico dos teus pedidos"}
          </p>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMsg}
          </div>
        )}

        {/* Google Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="group relative mt-5 flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {/* Brilho ao passar o rato */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-100/60 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="relative h-5 w-5 flex-shrink-0">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span className="relative">{isLoading ? "A conectar..." : "Continuar com Google"}</span>
        </button>

        {/* A segunda porta.
            O Google era a única, e deixava de fora quem nos deu um endereço
            hotmail, sapo, live ou do trabalho — vinte e seis dos setenta e
            nove clientes sem conta. Não era falta de vontade deles. */}
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-400">ou</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        {enviado ? (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3.5 text-center">
            <Mail className="mx-auto h-5 w-5 text-cyan-600" aria-hidden="true" />
            <p className="mt-1.5 text-sm font-semibold text-[#0B1929]">Veja o seu email</p>
            {/* A mesma frase quer o endereço exista ou não. Uma resposta
                diferente para "não conhecemos este email" transformava isto
                numa lista de quem é cliente da CLYON. */}
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Se este email tiver conta na CLYON, o link de entrada chega dentro
              de instantes. Dura 15 minutos e serve uma vez.
            </p>
            <button
              type="button"
              onClick={() => setEnviado(false)}
              className="mt-2 text-xs font-semibold text-cyan-700 underline"
            >
              Usar outro email
            </button>
          </div>
        ) : (
          <form onSubmit={pedirLink} className="space-y-2">
            <label htmlFor="email-de-entrada" className="sr-only">
              O seu email
            </label>
            <input
              id="email-de-entrada"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="o.seu@email.pt"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
            />
            <button
              type="submit"
              disabled={aEnviar}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00B4CC] text-sm font-bold text-white transition hover:bg-cyan-600 disabled:opacity-50"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {aEnviar ? "A enviar…" : "Receber link por email"}
            </button>
            <p className="text-center text-[11px] text-slate-400">
              Sem palavra-passe. Enviamos um link que entra por si.
            </p>
          </form>
        )}

        {/* A permissão, escrita e antes de acontecer.
            Dizia "a tua conta é criada automaticamente" — informava, não
            perguntava, e não dizia ao que a pessoa estava a dizer que sim. */}
        <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
          Ao continuar, autoriza a criação de uma conta CLYON com o seu email e
          aceita a{" "}
          <Link href="/privacidade" className="font-semibold text-cyan-700 underline">
            Política de Privacidade
          </Link>
          . Usamos o email para lhe mostrar os seus pedidos e as propostas que
          recebe — não o vendemos nem o usamos para publicidade.
        </p>

        {/* Selos de confiança */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-5">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <Icon className="h-4 w-4 text-cyan-600" />
              <span className="text-[11px] font-medium text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-slate-500">
        <Link
          href="/"
          className="font-semibold text-cyan-600 transition-colors hover:text-cyan-700 hover:underline"
        >
          ← Voltar à página inicial
        </Link>
      </p>
    </div>
  );
}
