"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, Info, Link2, Lock, X } from "lucide-react";

/**
 * Nota — a explicação que ajuda uma vez e depois estorva.
 *
 * Estes ecrãs foram-se enchendo de caixas de texto que explicam a plataforma:
 * o que é a estimativa, porque é que aceitar fecha as outras negociações, onde
 * guardar o link. Cada uma justifica-se sozinha, e todas juntas empurram os
 * botões para fora do ecrã do telemóvel — que é onde isto se usa.
 *
 * A informação não desaparece: fica atrás de uma linha que se toca. Quem
 * precisa abre, quem já sabe passa à frente. Com `chave`, a nota ganha um X e
 * não volta a aparecer nesse telemóvel — é o caso das que só servem na
 * primeira visita.
 *
 * O que NÃO se esconde aqui: valores, prazos e o que muda com um clique. Isso
 * é o ecrã, não é nota.
 *
 * O ícone escolhe-se por NOME e não passando o componente. Isto é um componente
 * de cliente, e metade dos sítios que o usam são páginas de servidor: uma função
 * não atravessa essa fronteira — o React rebenta a renderizar, com um erro que
 * não diz qual foi a propriedade. Um nome é texto, e texto atravessa.
 */

const ICONES = {
  info: Info,
  cadeado: Lock,
  ligacao: Link2,
  aviso: AlertTriangle,
} as const;

export type NomeDoIcone = keyof typeof ICONES;

const TONS = {
  neutro: {
    caixa: "border-slate-200 bg-slate-50",
    icone: "text-slate-500",
    titulo: "text-slate-700",
    texto: "text-slate-600",
  },
  info: {
    caixa: "border-cyan-200 bg-cyan-50",
    icone: "text-acao",
    titulo: "text-cyan-900",
    texto: "text-cyan-900",
  },
  seguro: {
    caixa: "border-emerald-200 bg-emerald-50",
    icone: "text-emerald-600",
    titulo: "text-emerald-900",
    texto: "text-emerald-800",
  },
} as const;

export type TomDaNota = keyof typeof TONS;

const PREFIXO = "clyon.nota.";

export default function Nota({
  titulo,
  icone = "info",
  tom = "neutro",
  chave,
  comecaAberta = false,
  className = "",
  children,
}: {
  titulo: string;
  icone?: NomeDoIcone;
  tom?: TomDaNota;
  /** Se existir, a nota pode ser fechada de vez neste dispositivo. */
  chave?: string;
  /**
   * Nasce aberta.
   *
   * O fechado por omissão é para os ecrãs onde a nota compete com um botão
   * pelo espaço do telemóvel. Nas definições da conta não compete com nada: a
   * pessoa veio aqui de propósito perceber o que cada campo faz, e obrigá-la a
   * tocar para ler é esconder a resposta atrás da pergunta.
   *
   * Continua a fechar-se — o que muda é só onde começa.
   */
  comecaAberta?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(comecaAberta);
  // Enquanto não se sabe se foi dispensada, não se desenha nada: mostrar e
  // esconder logo a seguir é pior do que aparecer um instante depois.
  const [dispensada, setDispensada] = useState<boolean | null>(chave ? null : false);

  useEffect(() => {
    if (!chave) return;
    try {
      setDispensada(window.localStorage.getItem(PREFIXO + chave) === "1");
    } catch {
      // Sem localStorage (modo privado, permissões) a nota simplesmente fica.
      setDispensada(false);
    }
  }, [chave]);

  function dispensar() {
    setDispensada(true);
    try {
      if (chave) window.localStorage.setItem(PREFIXO + chave, "1");
    } catch {
      /* fechada nesta visita, e é quanto basta */
    }
  }

  if (dispensada !== false) return null;

  const t = TONS[tom];
  const Icone = ICONES[icone] ?? Info;

  return (
    <div className={`rounded-xl border ${t.caixa} ${className}`}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          aria-expanded={aberta}
          className="flex min-h-[44px] flex-1 items-center gap-2 px-3 py-2.5 text-left"
        >
          <Icone className={`h-4 w-4 shrink-0 ${t.icone}`} aria-hidden={true} />
          <span className={`flex-1 text-xs font-medium leading-snug ${t.titulo}`}>
            {titulo}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${t.icone} ${
              aberta ? "rotate-180" : ""
            }`}
            aria-hidden={true}
          />
        </button>

        {chave && (
          <button
            type="button"
            onClick={dispensar}
            aria-label="Não voltar a mostrar"
            className={`flex min-h-[44px] w-11 items-center justify-center ${t.icone} opacity-60 transition hover:opacity-100`}
          >
            <X className="h-4 w-4" aria-hidden={true} />
          </button>
        )}
      </div>

      {aberta && (
        <div className={`px-3 pb-3 text-xs leading-relaxed ${t.texto}`}>{children}</div>
      )}
    </div>
  );
}
