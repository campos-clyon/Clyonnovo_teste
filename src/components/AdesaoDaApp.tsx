"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { eGmail, emailLimpo } from "@/lib/gmail-do-telemovel";
import { TEXTOS_DO_CONVITE_NO_SITE } from "@/lib/programa-da-app";
import { estadoDoPassoDoTeste } from "@/lib/lista-da-play-e-o-profissional";

/**
 * A ADESÃO À APP EM PASSOS — 17-11-2026 (d61, decidida pelo CEO com delegação
 * do dono).
 *
 * Uma empresa convidada para o teste da CLYON Pro abriu, por engano, uma
 * conta de cliente no topo da página que lhe mandámos: o que servia para a
 * app estava no fim, depois de muito texto. «No telemóvel está difícil, não
 * dá para entender.» E usou um email que não era Gmail.
 *
 * Por isso, como nas apps (Uber, Bolt): um ecrã de cada vez, um título e uma
 * ou duas frases, um botão grande «Continuar», a barra do progresso e
 * «Voltar». O mesmo componente serve as duas apps — os textos vêm da página
 * (/app-pro e /app-cliente), e o que o cliente lê diz «parceiro».
 *
 * Sem JavaScript (ou antes de o React acordar), os quatro passos aparecem em
 * lista, com os mesmos botões: ninguém fica sem saber o que fazer.
 *
 * O Gmail grava onde já gravava: o do profissional em `providers.gmailDoTeste`
 * (a rota do «O Gmail do meu telemóvel é outro» do painel), o do cliente na
 * inscrição do programa de acesso antecipado (/api/conta/programa-da-app, com
 * o consentimento à letra). Sem tabela nova.
 *
 * O PASSO 3 ESPERA PELA LISTA — 18-11-2026 (d6, o CEO e o dono). Na CLYON Pro
 * a rota do Gmail diz se ele já está na última lista da Play colada no
 * backoffice (`naListaDaPlay`). Enquanto não está, o passo 3 não manda
 * carregar em «Tornar-me testador» (a Play diria que não há acesso): diz que
 * já recebemos o Gmail e que avisamos (`teste.espera`). Quando está, o link
 * do teste (`teste.pode`). Sem sessão ou sem Gmail, os passos como sempre.
 */

export type PassoDaAdesao = { titulo: string; frases: string[] };

export type TextosDaAdesao = {
  /** O título da página na lista (sem JavaScript). */
  tituloDaLista: string;
  /** Os quatro passos, por ordem: para quem é, o Gmail, «Tornar-me testador», instalar e entrar. */
  passos: [PassoDaAdesao, PassoDaAdesao, PassoDaAdesao, PassoDaAdesao];
  /** No passo 1: «É cliente? A app é outra.» */
  outraApp: { texto: string; rotulo: string; href: string };
  gmail: {
    rotulo: string;
    /** Quando o email não é Gmail: uma frase, e pode continuar. */
    avisoNaoGmail: string;
    /** Sem sessão: porque não se pode guardar, e onde entrar. */
    semSessao: string;
    entrar: { rotulo: string; href: string };
    /** Sem sessão: quem ainda não tem conta (o «Candidate-se» do profissional). */
    semConta?: { texto: string; rotulo: string; href: string };
    guardado: string;
    /** Só no cliente: a caixa do consentimento (RGPD). */
    consentimento?: string;
  };
  teste: {
    botao: string;
    /** O Gmail ainda não está na lista da Play: o passo 3 em espera, sem o link (só a CLYON Pro). */
    espera?: PassoDaAdesao;
    /** O Gmail já está na lista: o passo 3 com o link. */
    pode?: PassoDaAdesao;
  };
  loja: { botao: string; depois?: { texto: string; rotulo: string; href: string } };
  saberMais: string[];
};

type Props = {
  tipo: "pro" | "cliente";
  linkDoTeste: string;
  linkDaLoja: string;
  textos: TextosDaAdesao;
  /**
   * d106 (24-11-2026, só a app de cliente): avisa a página do passo a que a
   * pessoa chegou (1–4) — o percurso do convite grava-o.
   */
  aoChegarAoPasso?: (passo: 1 | 2 | 3 | 4) => void;
  /** d106: o que aparece por baixo dos botões de cada passo (o «Não consegui»). */
  ajudaDoPasso?: (passo: 1 | 2 | 3 | 4) => ReactNode;
};

const TOTAL = 4;

const BOTAO =
  "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-acao px-6 text-base font-bold text-white transition hover:bg-acao-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao disabled:opacity-60";
const LIGACAO = "font-semibold text-acao underline underline-offset-2 hover:text-acao-hover";

function passoDoEndereco(): number {
  try {
    const n = Number(new URLSearchParams(window.location.search).get("passo"));
    return Number.isInteger(n) && n >= 1 && n <= TOTAL ? n - 1 : 0;
  } catch {
    return 0;
  }
}

export default function AdesaoDaApp({ tipo, linkDoTeste, linkDaLoja, textos, aoChegarAoPasso, ajudaDoPasso }: Props) {
  const [pronto, setPronto] = useState(false);
  const [passo, setPasso] = useState(0);
  const [sessao, setSessao] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [aceito, setAceito] = useState(false);
  const [avisado, setAvisado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);
  // O Gmail que ficou gravado (o de antes ou o de agora) e se já está na lista da Play (só a CLYON Pro).
  const [gmailGravado, setGmailGravado] = useState(false);
  const [naLista, setNaLista] = useState<boolean | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const mudou = useRef(false);

  useEffect(() => {
    setPasso(passoDoEndereco());
    setPronto(true);
    let vivo = true;
    const rota = tipo === "pro" ? "/api/profissionais/gmail-do-teste" : "/api/conta/programa-da-app";
    void (async () => {
      try {
        const r = await fetch(rota, { cache: "no-store", credentials: "include" });
        if (!vivo) return;
        if (r.status === 401) {
          setSessao(false);
          return;
        }
        const d = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          gmail?: string | null;
          email?: string | null;
          emailDaConta?: string | null;
          naListaDaPlay?: boolean | null;
        };
        if (!r.ok || !d.ok) {
          setSessao(false);
          return;
        }
        setSessao(true);
        const jaDeixou = tipo === "pro" ? d.gmail : d.email;
        const daConta = d.emailDaConta && eGmail(d.emailDaConta) ? d.emailDaConta : "";
        setEmail(jaDeixou || daConta || "");
        if (tipo === "pro") {
          setGmailGravado(Boolean(d.gmail));
          setNaLista(typeof d.naListaDaPlay === "boolean" ? d.naListaDaPlay : null);
        }
      } catch {
        if (vivo) setSessao(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [tipo]);

  // d106: o passo a que chegou, para o percurso do convite (só quem passou a função).
  useEffect(() => {
    if (pronto && aoChegarAoPasso) aoChegarAoPasso((passo + 1) as 1 | 2 | 3 | 4);
  }, [passo, pronto, aoChegarAoPasso]);

  // O foco vai para o título do passo novo (leitores de ecrã e teclado), menos no primeiro.
  useEffect(() => {
    if (!pronto) return;
    if (!mudou.current) {
      mudou.current = true;
      return;
    }
    titulo.current?.focus();
  }, [passo, pronto]);

  const irPara = (n: number) => {
    setErro(null);
    setPasso(Math.max(0, Math.min(TOTAL - 1, n)));
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* sem scroll, não faz mal */
    }
  };

  const continuarDoGmail = async () => {
    setErro(null);
    if (!sessao) {
      irPara(2);
      return;
    }
    const e = emailLimpo(email);
    if (!e) {
      setErro("Escreva o Gmail do seu telemóvel.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
      setErro("Escreva um email válido.");
      return;
    }
    const gmail = eGmail(e);
    if (!gmail && !avisado) {
      setAvisado(true);
      return;
    }
    if (tipo === "cliente" && !aceito) {
      setErro(TEXTOS_DO_CONVITE_NO_SITE.semConsentimento);
      return;
    }
    // O profissional só pode deixar um Gmail (é o que a equipa põe na lista): sem ele, segue sem gravar.
    if (tipo === "pro" && !gmail) {
      irPara(2);
      return;
    }
    if (guardado === e) {
      irPara(2);
      return;
    }
    setAGravar(true);
    try {
      const r =
        tipo === "pro"
          ? await fetch("/api/profissionais/gmail-do-teste", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ gmail: e }),
            })
          : await fetch("/api/conta/programa-da-app", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ email: e, consentimento: true, origem: "conta" }),
            });
      const d = (await r.json().catch(() => ({}))) as { error?: string; naListaDaPlay?: boolean | null };
      if (r.status === 401) {
        setSessao(false);
        return;
      }
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível guardar agora. Tente outra vez.");
        return;
      }
      setGuardado(e);
      if (tipo === "pro") {
        setGmailGravado(true);
        setNaLista(typeof d.naListaDaPlay === "boolean" ? d.naListaDaPlay : null);
      }
      irPara(2);
    } catch {
      setErro("Sem ligação. Verifique a internet e tente outra vez.");
    } finally {
      setAGravar(false);
    }
  };

  const p = textos.passos;

  const botaoDoTeste = (
    <a href={linkDoTeste} target="_blank" rel="noopener noreferrer" className={BOTAO}>
      {textos.teste.botao}
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
  const botaoDaLoja = (
    <a href={linkDaLoja} target="_blank" rel="noopener noreferrer" className={BOTAO}>
      {textos.loja.botao}
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
  const outraApp = (
    <p className="text-sm leading-relaxed text-slate-600">
      {textos.outraApp.texto}{" "}
      <a href={textos.outraApp.href} className={LIGACAO}>
        {textos.outraApp.rotulo}
      </a>
    </p>
  );
  const semConta = textos.gmail.semConta && (
    <p className="text-sm leading-relaxed text-slate-600">
      {textos.gmail.semConta.texto}{" "}
      <a href={textos.gmail.semConta.href} className={LIGACAO}>
        {textos.gmail.semConta.rotulo}
      </a>
    </p>
  );
  const depoisDaLoja = textos.loja.depois && (
    <p className="text-sm leading-relaxed text-slate-600">
      {textos.loja.depois.texto}{" "}
      <a href={textos.loja.depois.href} className={LIGACAO}>
        {textos.loja.depois.rotulo}
      </a>
    </p>
  );
  const saberMais = (
    <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <summary className="cursor-pointer font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acao">
        Saber mais
      </summary>
      <div className="mt-2 space-y-2 leading-relaxed">
        {textos.saberMais.map((f) => (
          <p key={f}>{f}</p>
        ))}
      </div>
    </details>
  );

  /* ─── Sem JavaScript: os quatro passos em lista ─── */
  if (!pronto) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-2xl font-bold leading-tight text-tinta">{textos.tituloDaLista}</h1>
        <ol className="mt-6 space-y-6">
          {p.map((passo, i) => (
            <li key={passo.titulo} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">
                Passo {i + 1} de {TOTAL}
              </p>
              <h2 className="mt-1 text-lg font-bold text-tinta">{passo.titulo}</h2>
              {passo.frases.map((f) => (
                <p key={f} className="mt-2 text-base leading-relaxed text-slate-600">
                  {f}
                </p>
              ))}
              <div className="mt-4 space-y-3">
                {i === 0 && outraApp}
                {i === 1 && <p className="text-sm leading-relaxed text-slate-600">{textos.gmail.semSessao}</p>}
                {i === 1 && (
                  <a href={textos.gmail.entrar.href} className={LIGACAO}>
                    {textos.gmail.entrar.rotulo}
                  </a>
                )}
                {i === 1 && semConta}
                {i === 2 && botaoDoTeste}
                {i === 3 && botaoDaLoja}
                {i === 3 && depoisDaLoja}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6">{saberMais}</div>
      </div>
    );
  }

  /* ─── Um ecrã de cada vez ─── */
  const doTeste =
    tipo === "pro" ? estadoDoPassoDoTeste({ sessao, temGmail: gmailGravado, naLista }) : "sem-dados";
  const emEspera = passo === 2 && doTeste === "espera" && Boolean(textos.teste.espera);
  const atual =
    passo === 2 && doTeste === "espera" && textos.teste.espera
      ? textos.teste.espera
      : passo === 2 && doTeste === "pode" && textos.teste.pode
        ? textos.teste.pode
        : p[passo];
  const naoGmail = avisado && !eGmail(email);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-6 pt-4">
      <div className="flex min-h-[44px] items-center justify-between">
        {passo > 0 ? (
          <button
            type="button"
            onClick={() => irPara(passo - 1)}
            className="-ml-2 flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-700 hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-acao"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Voltar
          </button>
        ) : (
          <a href="/" className="text-base font-extrabold tracking-wide text-tinta">
            CLYON
          </a>
        )}
        <span className="text-sm font-semibold text-slate-500" aria-hidden="true">
          {passo + 1}/{TOTAL}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Passo ${passo + 1} de ${TOTAL}`}
        aria-valuemin={1}
        aria-valuemax={TOTAL}
        aria-valuenow={passo + 1}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div className="h-full rounded-full bg-acao transition-all" style={{ width: `${((passo + 1) / TOTAL) * 100}%` }} />
      </div>

      <div className="flex-1 pt-10">
        <h1 ref={titulo} tabIndex={-1} className="text-[1.65rem] font-bold leading-tight text-tinta outline-none">
          {atual.titulo}
        </h1>
        {atual.frases.map((f) => (
          <p key={f} className="mt-3 text-base leading-relaxed text-slate-600">
            {f}
          </p>
        ))}

        {passo === 0 && <div className="mt-6">{outraApp}</div>}

        {passo === 1 && (
          <div className="mt-6 space-y-4">
            {sessao === null && <Loader2 className="h-5 w-5 animate-spin text-slate-300" aria-label="A carregar" />}
            {sessao === false && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
                <p>{textos.gmail.semSessao}</p>
                <a href={textos.gmail.entrar.href} className={`mt-2 inline-block ${LIGACAO}`}>
                  {textos.gmail.entrar.rotulo}
                </a>
              </div>
            )}
            {sessao === false && semConta}
            {sessao === true && (
              <>
                <label className="block text-sm font-semibold text-slate-800" htmlFor="gmail-da-adesao">
                  {textos.gmail.rotulo}
                </label>
                <input
                  id="gmail-da-adesao"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="nome@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setAvisado(false);
                    setErro(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void continuarDoGmail();
                  }}
                  aria-describedby={naoGmail ? "aviso-do-gmail" : undefined}
                  className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-900 focus:border-acao focus:outline-none focus:ring-2 focus:ring-acao/30"
                />
                {naoGmail && (
                  <p id="aviso-do-gmail" role="alert" className="rounded-2xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
                    {textos.gmail.avisoNaoGmail}
                  </p>
                )}
                {textos.gmail.consentimento && (
                  <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-600">
                    <input
                      type="checkbox"
                      checked={aceito}
                      onChange={(e) => setAceito(e.target.checked)}
                      className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[#007A8C]"
                    />
                    <span>{textos.gmail.consentimento}</span>
                  </label>
                )}
                {guardado && <p className="text-sm text-emerald-700">{textos.gmail.guardado}</p>}
              </>
            )}
            {erro && (
              <p role="alert" className="text-sm text-rose-700">
                {erro}
              </p>
            )}
          </div>
        )}

        {passo === 3 && depoisDaLoja && <div className="mt-6">{depoisDaLoja}</div>}
        {passo === 0 && <div className="mt-8">{saberMais}</div>}
      </div>

      <div className="space-y-3 pt-6">
        {passo === 0 && (
          <button type="button" onClick={() => irPara(1)} className={BOTAO}>
            Continuar
          </button>
        )}
        {passo === 1 && (
          <button type="button" onClick={() => void continuarDoGmail()} disabled={aGravar || sessao === null} className={BOTAO}>
            {aGravar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {sessao === false ? "Continuar sem guardar" : naoGmail ? "Continuar mesmo assim" : "Continuar"}
          </button>
        )}
        {passo === 2 && !emEspera && (
          <>
            {botaoDoTeste}
            <button
              type="button"
              onClick={() => irPara(3)}
              className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border-2 border-slate-200 px-6 text-base font-semibold text-slate-700 transition hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acao"
            >
              Já toquei — continuar
            </button>
          </>
        )}
        {passo === 3 && botaoDaLoja}
        {ajudaDoPasso && ajudaDoPasso((passo + 1) as 1 | 2 | 3 | 4)}
      </div>
    </div>
  );
}
