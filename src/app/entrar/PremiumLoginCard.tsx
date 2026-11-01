"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Lock, Zap, ShieldCheck, Mail, Eye, EyeOff } from "lucide-react";
import { MINIMO_DA_PALAVRA_PASSE } from "@/lib/palavra-passe-do-cliente";

interface Props {
  errorMsg?: string | null;
}

const TRUST = [
  { icon: Lock, label: "Encriptado" },
  { icon: Zap, label: "Instantâneo" },
  { icon: ShieldCheck, label: "Privado" },
] as const;

/**
 * As três portas da conta do cliente (01-11-2026): o Google, o email com
 * palavra-passe, e o link por email (agora a opção secundária).
 *
 * «A CONECTAR...» PRESO E «VEJA O SEU EMAIL» AO ABRIR (capturas do dono,
 * 01-11-2026). Os dois estados viviam só na memória da página, e o browser
 * guarda a página inteira quando se sai dela (a cache de voltar atrás): quem
 * carregava no Google e voltava atrás encontrava o botão parado em
 * «A conectar...»; quem tinha pedido um link e voltava à página via logo
 * «Veja o seu email». O `pageshow` com `persisted` é a página a sair dessa
 * cache — tudo volta ao princípio.
 */
type Modo = "palavra-passe" | "esqueci" | "link";

const campo =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10";
const botaoPrincipal =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00B4CC] text-sm font-bold text-white transition hover:bg-acao-hover disabled:opacity-50";

export function PremiumLoginCard({ errorMsg }: Props) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [modo, setModo] = useState<Modo>("palavra-passe");
  const [isLoading, setIsLoading] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [ver, setVer] = useState(false);

  const [aEnviar, setAEnviar] = useState(false);
  /** A frase de «veja o seu email» de cada caminho (registo, esqueci, link). */
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recomecar = () => {
    setIsLoading(false);
    setAEnviar(false);
    setAviso(null);
    setErro(null);
  };

  useEffect(() => {
    const aoMostrar = (ev: PageTransitionEvent) => {
      if (ev.persisted) {
        recomecar();
        setModo("palavra-passe");
      }
    };
    window.addEventListener("pageshow", aoMostrar);
    return () => window.removeEventListener("pageshow", aoMostrar);
  }, []);

  const mudarDeSeparador = (t: "login" | "signup") => {
    setTab(t);
    setModo("palavra-passe");
    recomecar();
  };

  const mudarDeModo = (m: Modo) => {
    setModo(m);
    recomecar();
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const r = await signIn("google", { callbackUrl: "/conta" });
      // Se o signIn voltar sem sair da página (erro de rede), o botão não fica preso.
      if (r && !r.ok) setIsLoading(false);
    } catch {
      setIsLoading(false);
    }
  };

  const enviarJson = async (url: string, corpo: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      mensagem?: string;
      codigo?: string;
    };
    return { res, dados };
  };

  const entrar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (aEnviar) return;
    setAEnviar(true);
    setErro(null);
    setAviso(null);
    try {
      const { res, dados } = await enviarJson("/api/entrada/palavra-passe", { email, palavraPasse });
      if (res.ok && dados.ok) {
        // Recarrega por inteiro: a sessão nova (o cookie) chega a todo o site.
        window.location.replace("/conta");
        return;
      }
      if (dados.codigo === "por-confirmar") setAviso(dados.error ?? null);
      else setErro(dados.error || "Não foi possível entrar. Tente outra vez.");
    } catch {
      setErro("Sem ligação. Verifique a internet e tente outra vez.");
    }
    setAEnviar(false);
  };

  const registar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (aEnviar) return;
    setErro(null);
    if (palavraPasse.length < MINIMO_DA_PALAVRA_PASSE) {
      setErro(`A palavra-passe tem de ter pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres.`);
      return;
    }
    setAEnviar(true);
    try {
      const { res, dados } = await enviarJson("/api/entrada/registo", { nome, email, palavraPasse });
      if (res.ok && dados.ok) {
        setAviso(dados.mensagem ?? null);
        setPalavraPasse("");
      } else {
        setErro(dados.error || "Não foi possível registar. Tente outra vez.");
      }
    } catch {
      setErro("Sem ligação. Verifique a internet e tente outra vez.");
    }
    setAEnviar(false);
  };

  /*
   * O esqueci e o link por email: a resposta é sempre a mesma, e uma falha de
   * rede não a pode mudar (dizer «não conseguimos enviar» contava que o
   * endereço existe). Só o 429 do travão por endereço muda o que se diz —
   * vem antes de a rota olhar para o email, e nesse caso nada saiu.
   */
  const pedirPorEmail = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (aEnviar) return;
    setAEnviar(true);
    setErro(null);
    const url = modo === "esqueci" ? "/api/entrada/esqueci" : "/api/entrada/link";
    const porOmissao =
      modo === "esqueci"
        ? "Se este email tiver conta na CLYON, recebe dentro de instantes um link para escolher uma palavra-passe nova."
        : "Se este email tiver conta na CLYON, o link de entrada chega dentro de instantes. Dura 15 minutos e serve uma vez.";
    try {
      const { res, dados } = await enviarJson(url, { email });
      if (res.status === 429) setErro("Demasiados pedidos. Aguarde alguns minutos e tente de novo.");
      else setAviso(dados.mensagem || porOmissao);
    } catch {
      setAviso(porOmissao);
    }
    setAEnviar(false);
  };

  const caixaDeEmail = (id: string) => (
    <>
      <label htmlFor={id} className="sr-only">
        O seu email
      </label>
      <input
        id={id}
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="o.seu@email.pt"
        className={campo}
      />
    </>
  );

  const caixaDePalavraPasse = (novo: boolean) => (
    <div className="relative">
      <label htmlFor="palavra-passe" className="sr-only">
        Palavra-passe
      </label>
      <input
        id="palavra-passe"
        type={ver ? "text" : "password"}
        required
        autoComplete={novo ? "new-password" : "current-password"}
        value={palavraPasse}
        onChange={(e) => setPalavraPasse(e.target.value)}
        placeholder={novo ? `Palavra-passe (mínimo ${MINIMO_DA_PALAVRA_PASSE} caracteres)` : "Palavra-passe"}
        className={`${campo} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? "Esconder a palavra-passe" : "Mostrar a palavra-passe"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
      >
        {ver ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );

  const caixaDoAviso = aviso && (
    <div role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3.5 text-center">
      <Mail className="mx-auto h-5 w-5 text-acao" aria-hidden="true" />
      <p className="mt-1.5 text-sm font-semibold text-tinta">Veja o seu email</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{aviso}</p>
      <button type="button" onClick={() => mudarDeModo("palavra-passe")} className="mt-2 text-xs font-semibold text-acao underline">
        Voltar
      </button>
    </div>
  );

  const caixaDoErro = erro && (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700">
      {erro}
    </p>
  );

  let formulario: React.ReactNode;
  if (aviso) {
    formulario = caixaDoAviso;
  } else if (modo === "palavra-passe" && tab === "login") {
    formulario = (
      <form onSubmit={entrar} className="space-y-2">
        {caixaDeEmail("email-de-entrada")}
        {caixaDePalavraPasse(false)}
        {caixaDoErro}
        <button type="submit" disabled={aEnviar} className={botaoPrincipal}>
          {aEnviar ? "A entrar…" : "Entrar"}
        </button>
        <div className="flex justify-between pt-1 text-xs">
          <button type="button" onClick={() => mudarDeModo("esqueci")} className="font-semibold text-acao hover:underline">
            Esqueci-me da palavra-passe
          </button>
          <button type="button" onClick={() => mudarDeModo("link")} className="text-slate-500 hover:text-slate-700 hover:underline">
            Receber um link por email
          </button>
        </div>
      </form>
    );
  } else if (modo === "palavra-passe") {
    formulario = (
      <form onSubmit={registar} className="space-y-2">
        <label htmlFor="nome-do-registo" className="sr-only">
          O seu nome
        </label>
        <input
          id="nome-do-registo"
          type="text"
          required
          autoComplete="name"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="O seu nome"
          className={campo}
        />
        {caixaDeEmail("email-do-registo")}
        {caixaDePalavraPasse(true)}
        {caixaDoErro}
        <button type="submit" disabled={aEnviar} className={botaoPrincipal}>
          {aEnviar ? "A criar…" : "Criar conta"}
        </button>
        <p className="text-center text-[11px] text-tinta-fraca">
          Enviamos um email para confirmar o endereço. A conta abre quando o confirmar.
        </p>
      </form>
    );
  } else {
    formulario = (
      <form onSubmit={pedirPorEmail} className="space-y-2">
        <p className="text-center text-xs leading-relaxed text-slate-600">
          {modo === "esqueci"
            ? "Escreva o seu email. Enviamos um link para escolher uma palavra-passe nova."
            : "Escreva o seu email. Enviamos um link que entra por si, sem palavra-passe."}
        </p>
        {caixaDeEmail("email-do-link")}
        {caixaDoErro}
        <button type="submit" disabled={aEnviar} className={botaoPrincipal}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          {aEnviar ? "A enviar…" : modo === "esqueci" ? "Enviar o link" : "Receber link por email"}
        </button>
        <button
          type="button"
          onClick={() => mudarDeModo("palavra-passe")}
          className="block w-full pt-1 text-center text-xs font-semibold text-acao hover:underline"
        >
          Entrar com a palavra-passe
        </button>
      </form>
    );
  }

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
              onClick={() => mudarDeSeparador(t)}
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
            {tab === "login" ? "Bem-vindo de volta" : "Crie a sua conta"}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {tab === "login"
              ? "Aceda à sua conta para acompanhar os seus pedidos"
              : "Registe-se para guardar o histórico dos seus pedidos"}
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

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-tinta-fraca">ou com o seu email</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        {formulario}

        {/* A permissão, escrita e antes de acontecer. */}
        <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
          Ao continuar, autoriza a criação de uma conta CLYON com o seu email e
          aceita a{" "}
          <Link href="/privacidade" className="font-semibold text-acao underline">
            Política de Privacidade
          </Link>
          . Usamos o email para lhe mostrar os seus pedidos e as propostas que
          recebe — não o vendemos nem o usamos para publicidade.
        </p>

        {/* Selos de confiança */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-5">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <Icon className="h-4 w-4 text-acao" />
              <span className="text-[11px] font-medium text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-slate-500">
        <Link
          href="/"
          className="font-semibold text-acao transition-colors hover:text-acao-hover hover:underline"
        >
          ← Voltar à página inicial
        </Link>
      </p>
    </div>
  );
}
