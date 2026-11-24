"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdesaoDaApp, { type TextosDaAdesao } from "@/components/AdesaoDaApp";
import {
  MAXIMO_DO_TEXTO_LIVRE,
  MOTIVOS_POR_PASSO,
  RESPOSTAS_DO_NAO_CONSEGUI,
  ROTULOS_DO_MOTIVO,
  TEXTOS_DO_NAO_CONSEGUI as T,
  aparelhoDoUserAgent,
  codigoValido,
  eResposta,
  type Aparelho,
  type MotivoDoNaoConsegui,
  type PassoDaAdesao,
  type RespostaDoLembrete,
} from "@/lib/percurso-da-app-cliente";

/**
 * A /app-cliente COM O CAMINHO CERTO PARA CADA APARELHO — 24-11-2026 (d106;
 * os textos são a secção 5 da v3 da d107, aprovada à letra pelo dono).
 *
 *   · Android (ou não se sabe) → os quatro passos de sempre (AdesaoDaApp), com
 *     «Não consegui» em cada um (as opções do passo, a resposta a cada uma);
 *   · iPhone → por agora não há app; não lhe voltamos a falar da app;
 *   · computador → o código QR da ligação, para abrir no telemóvel.
 *
 * O link do convite traz `?c=<código>` e, no lembrete, `&r=1|2|3` (os três
 * botões; o 3 é a mesma recusa que {LINK_RECUSA}). Grava-se pelo
 * /api/app-cliente/percurso: o clique, a classe do aparelho, o passo, o «Não
 * consegui» e a resposta. O código e a resposta saem da barra de endereço
 * assim que se lêem (o código fica só nesta sessão do navegador, para o
 * código QR e para o que a pessoa fizer a seguir). Sem código, a página é a
 * mesma e não grava nada.
 */

const CHAVE = "clyon-convite-app-c";
const BOTAO =
  "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-acao px-6 text-base font-bold text-white transition hover:bg-acao-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao disabled:opacity-60";
const LIGACAO = "font-semibold text-acao underline underline-offset-2 hover:text-acao-hover";
const DISCRETO =
  "mx-auto block min-h-[44px] rounded-xl px-3 text-sm font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acao";

/** O que se diz a quem recusou (a mesma frase da Vitória na v3, 2.c, na voz da página). */
const RECUSA_FEITA = "Combinado, não volta a receber mensagens sobre a app. Obrigado na mesma!";

function enviar(corpo: Record<string, unknown>) {
  try {
    void fetch("/api/app-cliente/percurso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* sem rede, não faz mal */
  }
}

/** O código e a resposta do endereço; saem da barra assim que se lêem. */
function lerDoEndereco(): { codigo: string | null; resposta: RespostaDoLembrete | null } {
  try {
    const url = new URL(window.location.href);
    const c = url.searchParams.get("c");
    const r = Number(url.searchParams.get("r"));
    const resposta = eResposta(r) ? r : null;
    let codigo: string | null = null;
    if (codigoValido(c)) {
      codigo = c;
      try {
        sessionStorage.setItem(CHAVE, c);
      } catch {
        /* sem armazenamento: fica só em memória */
      }
    } else {
      const guardado = sessionStorage.getItem(CHAVE);
      codigo = codigoValido(guardado) ? guardado : null;
    }
    if (url.searchParams.has("c") || url.searchParams.has("r")) {
      url.searchParams.delete("c");
      url.searchParams.delete("r");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    return { codigo, resposta };
  } catch {
    return { codigo: null, resposta: null };
  }
}

function NaoConsegui({ passo, codigo }: { passo: PassoDaAdesao; codigo: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoDoNaoConsegui | null>(null);
  const [texto, setTexto] = useState("");
  const [respondido, setRespondido] = useState<MotivoDoNaoConsegui | null>(null);

  // Um passo novo começa fechado.
  useEffect(() => {
    setAberto(false);
    setMotivo(null);
    setTexto("");
    setRespondido(null);
  }, [passo]);

  if (respondido) {
    return (
      <div role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">{T.depoisDeEnviar}</p>
        <p className="mt-2">{RESPOSTAS_DO_NAO_CONSEGUI[respondido]}</p>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={DISCRETO}>
        {T.botao}
      </button>
    );
  }

  const confirmar = () => {
    if (!motivo) return;
    if (codigo) {
      enviar({ c: codigo, accao: "nao-consegui", passo, motivo, texto: motivo === "outro" ? texto.trim() || undefined : undefined });
    }
    setRespondido(motivo);
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <fieldset>
        <legend className="text-base font-bold text-slate-900">{T.titulo}</legend>
        <p className="mt-1 text-sm text-slate-600">{T.subtitulo}</p>
        <div className="mt-3 space-y-2">
          {MOTIVOS_POR_PASSO[passo].map((m) => (
            <label key={m} className="flex min-h-[40px] items-start gap-3 text-sm leading-relaxed text-slate-700">
              <input
                type="radio"
                name={`motivo-do-passo-${passo}`}
                value={m}
                checked={motivo === m}
                onChange={() => setMotivo(m)}
                className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[#007A8C]"
              />
              <span>{ROTULOS_DO_MOTIVO[m]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {motivo === "outro" && (
        <>
          <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor={`texto-do-passo-${passo}`}>
            {T.rotuloDoOutro}
          </label>
          <textarea
            id={`texto-do-passo-${passo}`}
            rows={2}
            maxLength={MAXIMO_DO_TEXTO_LIVRE}
            placeholder={T.exemploDoOutro}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-acao focus:outline-none focus:ring-2 focus:ring-acao/30"
          />
        </>
      )}
      <button type="button" onClick={confirmar} disabled={!motivo} className={`${BOTAO} mt-3`}>
        {T.enviar}
      </button>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        {T.debaixoDoFormulario}{" "}
        <a href="/privacidade#app-cliente" className={LIGACAO}>
          Política de Privacidade
        </a>
      </p>
    </div>
  );
}

function CodigoQr({ texto }: { texto: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void import("qrcode")
      .then((q) => q.toString(texto, { type: "svg", margin: 1, errorCorrectionLevel: "M" }))
      .then((s) => {
        if (vivo) setSvg(s);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [texto]);
  if (!svg) return <div className="mx-auto h-56 w-56 rounded-2xl bg-slate-100" aria-hidden="true" />;
  return (
    <div
      role="img"
      aria-label="Código QR da ligação para abrir no telemóvel"
      className="mx-auto h-56 w-56 rounded-2xl border border-slate-200 bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
      // O SVG vem da biblioteca, a partir da nossa ligação: nada do que se escreve na página entra aqui.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function PercursoDaAppCliente({
  linkDoTeste,
  linkDaLoja,
  textos,
}: {
  linkDoTeste: string;
  linkDaLoja: string;
  textos: TextosDaAdesao;
}) {
  const [aparelho, setAparelho] = useState<Aparelho | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [resposta, setResposta] = useState<RespostaDoLembrete | null>(null);
  const [recusou, setRecusou] = useState(false);
  const maisLonge = useRef(0);

  useEffect(() => {
    const { codigo: c, resposta: r } = lerDoEndereco();
    setCodigo(c);
    setResposta(r);
    let a: Aparelho = "outro";
    try {
      a = aparelhoDoUserAgent(navigator.userAgent, navigator.maxTouchPoints ?? 0);
    } catch {
      /* sem navigator */
    }
    setAparelho(a);
    if (c) {
      // Um clique por sessão do navegador: recarregar a página não conta outra vez.
      let jaContou = false;
      try {
        jaContou = sessionStorage.getItem(`${CHAVE}-abriu`) === c;
        sessionStorage.setItem(`${CHAVE}-abriu`, c);
      } catch {
        /* conta na mesma */
      }
      if (!jaContou) enviar({ c, accao: "abriu" });
      if (r) enviar({ c, accao: "resposta", r });
    }
    if (r === 3) setRecusou(true);
  }, []);

  const aoChegarAoPasso = useCallback(
    (passo: PassoDaAdesao) => {
      if (!codigo || passo <= maisLonge.current) return;
      maisLonge.current = passo;
      if (passo > 1) enviar({ c: codigo, accao: "passo", passo });
    },
    [codigo],
  );

  const ajudaDoPasso = useCallback((passo: PassoDaAdesao) => <NaoConsegui passo={passo} codigo={codigo} />, [codigo]);

  const recusar = () => {
    if (codigo) enviar({ c: codigo, accao: "resposta", r: 3 });
    setRecusou(true);
  };

  const ecra = (conteudo: React.ReactNode) => (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-6 pt-4">
      <a href="/" className="flex min-h-[44px] items-center text-base font-extrabold tracking-wide text-tinta">
        CLYON
      </a>
      <div className="flex-1 pt-10">{conteudo}</div>
    </div>
  );

  if (recusou) {
    return ecra(<p className="text-lg leading-relaxed text-slate-700">{RECUSA_FEITA}</p>);
  }

  if (resposta === 2) {
    return ecra(<p className="text-lg leading-relaxed text-slate-700">{RESPOSTAS_DO_NAO_CONSEGUI["sem-android"]}</p>);
  }

  if (aparelho === "iphone") {
    return ecra(<p className="text-lg leading-relaxed text-slate-700">{T.iphone}</p>);
  }

  if (aparelho === "pc") {
    const ligacao = (() => {
      try {
        const u = new URL("/app-cliente", window.location.origin);
        if (codigo) u.searchParams.set("c", codigo);
        return u.toString();
      } catch {
        return "https://clyon.pt/app-cliente";
      }
    })();
    return ecra(
      <>
        <p className="text-lg leading-relaxed text-slate-700">{T.computador}</p>
        <div className="mt-8">
          <CodigoQr texto={ligacao} />
        </div>
        {codigo && (
          <div className="mt-10">
            <button type="button" onClick={recusar} className="mx-auto block text-xs text-slate-400 underline underline-offset-2">
              {T.recusa}
            </button>
          </div>
        )}
      </>,
    );
  }

  // Android, ou ainda sem saber o aparelho (e sem JavaScript): os passos.
  return (
    <>
      <AdesaoDaApp
        tipo="cliente"
        linkDoTeste={linkDoTeste}
        linkDaLoja={linkDaLoja}
        textos={textos}
        aoChegarAoPasso={aoChegarAoPasso}
        ajudaDoPasso={ajudaDoPasso}
      />
      {codigo && (
        <div className="mx-auto max-w-md px-4 pb-8">
          <button type="button" onClick={recusar} className="mx-auto block text-xs text-slate-400 underline underline-offset-2">
            {T.recusa}
          </button>
        </div>
      )}
    </>
  );
}
