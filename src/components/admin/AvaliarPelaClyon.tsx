"use client";

import { useState } from "react";
import { Star } from "lucide-react";

// Saiu da Mesa das negociações a 19-10-2026, para os Trabalhos CLYON o usarem também.
/**
 * A NOTA, DADA PELA CLYON EM NOME DO CLIENTE.
 *
 * "Eu devia ter a opção de abrir o pedido, sendo admin, ver toda a troca e
 * inclusive abrir o perfil do pro e dar a nota, já que foi criado o pedido
 * aqui."
 *
 * O mesmo beco do confirmar, um passo mais à frente. Um pedido que chegou por
 * WhatsApp, com o cliente sem email, não tem quem avalie — a estrela é dada no
 * link do cliente, e ele não tem link nem conta. O trabalho fica feito, pago e
 * confirmado, e o profissional continua com «sem avaliações» para sempre.
 *
 * É isso que abre a porta ao cliente seguinte: quem escolhe entre dois nomes
 * numa lista escolhe pelas estrelas, e um profissional que só trabalha por
 * WhatsApp nunca chega a ter nenhuma.
 *
 * Só aparece onde a CLYON responde MESMO pelo lado do cliente — a mesma regra
 * do confirmar, decidida pela mesma função. E fica escrito que foi ela: uma
 * nota da CLYON e uma do cliente não são a mesma coisa.
 */
export default function AvaliarPelaClyon({
  profissionalNome,
  onMudou,
  guardar,
}: {
  profissionalNome: string;
  onMudou: () => void;
  /**
   * Como se grava a nota — 19-10-2026. A Mesa grava pela rota das
   * negociações, os Trabalhos CLYON pela deles: o componente só desenha, e
   * quem o usa diz por onde vai. Devolve o erro, ou `null` se gravou.
   */
  guardar: (estrelas: number, comentario: string | undefined) => Promise<string | null>;
}) {
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  const avaliar = async () => {
    if (estrelas < 1) return;
    setAEnviar(true);
    setErro("");
    const falhou = await guardar(estrelas, comentario.trim() || undefined);
    setAEnviar(false);
    if (falhou) setErro(falhou);
    else onMudou();
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
        Dar a nota como CLYON
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
        Este cliente não tem como avaliar sozinho. Sem isto, {profissionalNome} fica sem
        estrelas — e são elas que decidem quem o próximo cliente escolhe.
      </p>

      <div className="mt-2.5 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setEstrelas(n)}
            aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
            aria-pressed={estrelas === n}
            className="p-0.5 transition"
          >
            <Star
              className={`h-6 w-6 ${
                n <= estrelas ? "fill-amber-400 text-amber-400" : "text-slate-600"
              }`}
              aria-hidden="true"
            />
          </button>
        ))}
        {estrelas > 0 && (
          <span className="ml-2 text-xs font-semibold text-amber-200">
            {estrelas} de 5
          </span>
        )}
      </div>

      <input
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="O que correu bem, em duas linhas (opcional)"
        maxLength={600}
        className="mt-2.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-amber-600"
      />

      {erro && (
        <p className="mt-2 rounded-md border border-red-900 bg-red-950/40 px-2 py-1.5 text-xs text-red-300">
          {erro}
        </p>
      )}

      <button
        onClick={avaliar}
        disabled={aEnviar || estrelas < 1}
        className="mt-2.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
      >
        {aEnviar ? "A guardar…" : "Guardar a nota"}
      </button>
    </div>
  );
}
