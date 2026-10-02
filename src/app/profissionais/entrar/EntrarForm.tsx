"use client";

import { useState } from "react";
import { DIAS_A_LEMBRAR, LEMBRAR_POR_OMISSAO } from "@/lib/manter-sessao";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { destinoInterno } from "@/lib/destino-seguro";
import { Eye, EyeOff, KeyRound, Loader2, LogIn } from "lucide-react";

export default function EntrarForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [semPalavraPasse, setSemPalavraPasse] = useState(false);
  /*
   * MARCADA POR OMISSAO — e uma decisao, nao um descuido.
   *
   * E o que ele quer em quase todos os casos: entra do telemovel dele, para
   * ver os trabalhos dele. A caixa existe para quem precisa do contrario
   * poder dize-lo. Ver `LEMBRAR_POR_OMISSAO` em manter-sessao.
   */
  const [lembrar, setLembrar] = useState(LEMBRAR_POR_OMISSAO);

  async function submeter(ev: React.FormEvent) {
    ev.preventDefault();
    setAEnviar(true);
    setErro("");
    setSemPalavraPasse(false);
    try {
      const res = await fetch("/api/profissionais/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, palavraPasse, lembrar }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível entrar.");
        if (dados.semPalavraPasse) setSemPalavraPasse(true);
        return;
      }
      // Quem veio de um link de pedido volta a ele (02-10-2026); só caminhos do site.
      router.push(destinoInterno(new URLSearchParams(window.location.search).get("destino"), window.location.origin, "/profissionais/painel"));
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  /*
   * ESQUECI-ME DA PALAVRA-PASSE — 01-10-2026.
   *
   * «Esse profissional não consegue acessar a conta pois perdeu sua senha, e
   * no login também não tem essa função.» A página de definir já dizia «Peça
   * outro na página de entrada» a quem tinha o link expirado — e aqui não
   * havia onde.
   *
   * NO MESMO ECRÃ, e não numa página à parte. `/profissionais/entrar` é a
   * única porta de `/profissionais/` aberta sem a chave do MVP (`portaAberta`
   * no middleware): uma `/profissionais/entrar/esqueci` dava 404 a quem não a
   * tem — que é precisamente quem perdeu o acesso.
   *
   * A resposta é a mesma exista o email ou não (ver a rota), e por isso o ecrã
   * diz «se tiver conta» em vez de «enviámos».
   */
  const [modo, setModo] = useState<"entrar" | "repor">("entrar");
  const [aPedir, setAPedir] = useState(false);
  const [pedido, setPedido] = useState("");

  async function pedirLink(ev: React.FormEvent) {
    ev.preventDefault();
    setAPedir(true);
    setErro("");
    try {
      const res = await fetch("/api/profissionais/esqueci-palavra-passe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível pedir o link.");
        return;
      }
      setPedido(dados.mensagem ?? "Se este email tiver conta, o link chega dentro de instantes.");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAPedir(false);
    }
  }

  function irPara(novo: "entrar" | "repor") {
    setModo(novo);
    setErro("");
    setPedido("");
    setSemPalavraPasse(false);
  }

  if (modo === "repor") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
        <div className="w-full">
          <div className="mb-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-acao">
              <KeyRound className="h-6 w-6 text-white" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-2xl font-bold text-[#0B1929]">Repor a palavra-passe</h1>
            <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">
              Escreva o email com que se inscreveu. Mandamos-lhe um link para escolher uma
              palavra-passe nova.
            </p>
          </div>

          {pedido ? (
            <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-sm font-semibold text-emerald-900">{pedido}</p>
              <p className="mt-2 text-xs leading-relaxed text-emerald-900">
                Não chegou ao fim de uns minutos? Veja na pasta de spam ou de promoções. Se
                já não tiver acesso a este email, fale connosco pelos{" "}
                <Link href="/contactos" className="font-semibold underline">
                  contactos
                </Link>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={pedirLink} noValidate className="space-y-4">
              <div>
                <label htmlFor="email-repor" className="block text-sm font-medium text-slate-900">
                  Email
                </label>
                <input
                  id="email-repor"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="geral@exemplo.pt"
                  className="mt-1.5 w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-600"
                />
              </div>

              {erro && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={aPedir || !email.includes("@")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-acao py-3.5 text-base font-bold text-white transition hover:bg-acao-hover disabled:opacity-40"
              >
                {aPedir && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Enviar link
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm">
            <button
              type="button"
              onClick={() => irPara("entrar")}
              className="font-semibold text-acao hover:underline"
            >
              Voltar a entrar
            </button>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <div className="w-full">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-acao">
            <LogIn className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-[#0B1929]">Entrar</h1>
          <p className="mt-2 text-sm text-slate-500">Os seus pedidos e propostas.</p>
        </div>

        <form onSubmit={submeter} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="geral@exemplo.pt"
              className="mt-1.5 w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-600"
            />
          </div>

          <div>
            <label htmlFor="pp" className="block text-sm font-medium text-slate-900">
              Palavra-passe
            </label>
            <div className="relative mt-1.5">
              <input
                id="pp"
                type={visivel ? "text" : "password"}
                autoComplete="current-password"
                value={palavraPasse}
                onChange={(e) => setPalavraPasse(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-300 bg-white py-3 pl-4 pr-12 text-base text-slate-900 outline-none transition focus:border-cyan-600"
              />
              <button
                type="button"
                onClick={() => setVisivel((v) => !v)}
                aria-label={visivel ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                aria-pressed={visivel}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                {visivel ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="mt-1.5 text-right">
              <button
                type="button"
                onClick={() => irPara("repor")}
                className="text-sm font-semibold text-acao hover:underline"
              >
                Esqueci-me da palavra-passe
              </button>
            </div>
          </div>

          {/*
            MANTER-ME LIGADO — 15-09-2026.

            "Crie a opcao manter-me conectado, e garanta que funcione para eles
            nao terem de entrar com senha varias vezes ao dia."

            A frase por baixo diz o prazo em vez de prometer "para sempre": um
            numero e uma promessa que se pode cumprir, e e o que distingue
            esta caixa de um enfeite.
          */}
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => setLembrar(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="text-sm text-slate-700">
              Manter-me ligado
              <span className="mt-0.5 block text-xs text-slate-500">
                {lembrar
                  ? `Não pede a palavra-passe outra vez durante ${DIAS_A_LEMBRAR} dias — e, enquanto o continuar a usar, nunca pede.`
                  : "Termina quando fechar o browser. Num computador que não seja seu, deixe esta opção por marcar."}
              </span>
            </span>
          </label>

          {erro && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
              {semPalavraPasse && (
                <p className="mt-2 text-xs text-red-700">
                  O email de aprovação tem o link para a criar. Se já não o tiver,{" "}
                  <button
                    type="button"
                    onClick={() => irPara("repor")}
                    className="font-semibold underline"
                  >
                    peça um link novo
                  </button>
                  .
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={aEnviar || !email || !palavraPasse}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-acao py-3.5 text-base font-bold text-white transition hover:bg-acao-hover disabled:opacity-40"
          >
            {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Ainda não se inscreveu?{" "}
          {/* Era /profissionais — atrás do portão do MVP, dá 404 a quem não
              tem a chave. A inscrição pública é esta. */}
          <Link href="/quero-ser-parceiro" className="font-semibold text-cyan-600 hover:underline">
            Inscreva-se aqui
          </Link>
        </p>
      </div>
    </main>
  );
}
