"use client";

import {
  FICHA_DA_DISTINCAO,
  avaliacoesEmPalavras,
  distincoesDe,
  mediaEmPalavras,
  quantasFaltamParaACoroa,
  temCoroa,
  type ContaDoPerfil,
} from "@/lib/distincoes-do-profissional";

/**
 * O TOPO DO PERFIL DELE — o que ele construiu, e não o que falta preencher.
 *
 * "Quero que deixe esse perfil mais pro, com coisas legais para eles. Caso
 * tenha nota 5, eles devem ganhar uma coroa no topo do perfil." — 14-09-2026.
 *
 * O perfil era um formulário: nome, telefone, morada, email, Guardar. Nada que
 * alguém abrisse duas vezes. Isto é a outra metade, e é feita só de números que
 * já existiam — a média, as avaliações, os trabalhos fechados. Nada de novo lhe
 * é pedido para o ver.
 *
 * A COROA NÃO É UM ENFEITE, é um estado que se ganha e se perde: 5,0 com três
 * avaliações ou mais, e vai-se embora com a primeira nota abaixo de cinco. A
 * regra está em `distincoes-do-profissional`, com o porquê.
 *
 * E DIZ-SE SEMPRE O QUE FALTA. Um emblema que aparece sem se saber como é
 * decoração; com a regra à vista, é um objectivo — e quem está a uma avaliação
 * de distância fica a saber disso.
 */
export default function CartaoDoPerfil({
  nome,
  conta,
  fotoViaturaUrl,
  tipoVeiculo,
}: {
  nome: string;
  conta: ContaDoPerfil;
  fotoViaturaUrl?: string | null;
  tipoVeiculo?: string | null;
}) {
  const coroado = temCoroa(conta);
  const faltam = quantasFaltamParaACoroa(conta);
  const distincoes = distincoesDe(conta);

  return (
    <section
      className={`mb-4 overflow-hidden rounded-2xl border shadow-sm ${
        coroado ? "border-amber-300 bg-gradient-to-b from-amber-50 to-white" : "border-[#E2EEF3] bg-white"
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/*
            A VIATURA AO LADO DO NOME, quando há fotografia.

            É o retrato dele: quem chega a casa do cliente chega naquilo. Sem
            fotografia não fica uma moldura vazia — fica um convite, mais
            abaixo, onde ele a pode pôr.
          */}
          {fotoViaturaUrl && (
            <img
              src={fotoViaturaUrl}
              alt={tipoVeiculo ? `A ${tipoVeiculo} de ${nome}` : `A viatura de ${nome}`}
              className="h-20 w-28 shrink-0 rounded-xl border border-slate-200 object-cover"
            />
          )}

          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              {coroado && (
                <span
                  className="text-2xl leading-none"
                  title={FICHA_DA_DISTINCAO.coroa.porque}
                  aria-label="Nota máxima"
                >
                  {FICHA_DA_DISTINCAO.coroa.simbolo}
                </span>
              )}
              <span className="truncate">{nome}</span>
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
              <span className="flex items-baseline gap-1.5">
                <strong
                  className={`text-xl ${coroado ? "text-amber-600" : "text-slate-900"}`}
                >
                  {mediaEmPalavras(conta.media)}
                </strong>
                <span className="text-slate-500">{avaliacoesEmPalavras(conta.quantasAvaliacoes)}</span>
              </span>
              <span className="text-slate-600">
                <strong className="text-slate-900">{conta.trabalhosConcluidos}</strong>{" "}
                {conta.trabalhosConcluidos === 1 ? "trabalho feito" : "trabalhos feitos"}
              </span>
            </div>
          </div>
        </div>

        {distincoes.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {distincoes.map((d) => {
              const f = FICHA_DA_DISTINCAO[d];
              return (
                <li
                  key={d}
                  title={f.porque}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    d === "coroa"
                      ? "border-amber-300 bg-amber-100 text-amber-800"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  <span aria-hidden="true">{f.simbolo}</span>
                  {f.titulo}
                </li>
              );
            })}
          </ul>
        )}

        {/*
          O QUE FALTA PARA A COROA — só a quem ela ainda está ao alcance.

          A quem já a tem diz-se o que a mantém; a quem já tem uma nota abaixo
          de cinco não se diz nada, porque «faltam duas» seria mentira: com um
          quatro lá dentro, mais cincos nunca devolvem a média a 5,0.
        */}
        {coroado ? (
          <p className="mt-3 rounded-lg bg-amber-100/60 px-3 py-2 text-xs leading-relaxed text-amber-800">
            Tem a coroa. Mantém-se enquanto a média for 5,0 — cada trabalho conta.
          </p>
        ) : faltam != null && faltam > 0 && conta.quantasAvaliacoes > 0 ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            Está em 5,0. {faltam === 1 ? "Falta 1 avaliação" : `Faltam ${faltam} avaliações`} para
            ganhar a coroa 👑.
          </p>
        ) : null}
      </div>
    </section>
  );
}
