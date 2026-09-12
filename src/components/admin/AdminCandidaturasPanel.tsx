"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Inbox, Loader2, Send, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { etiquetaDoVeiculo } from "@/lib/convite-profissional";

/**
 * QUEM SE CANDIDATOU PELO SITE.
 *
 * O botão "Tornar-me parceiro" abria o WhatsApp, e quem carregava caía numa
 * caixa de mensagens entre dezenas de clientes — sem nome, sem zona, sem os
 * serviços que faz. Agora preenche um formulário e a candidatura aparece
 * aqui.
 *
 * APROVAR CRIA A CONTA. Mandava um convite para um segundo formulário, onde
 * metade dos campos era a repetição do que ele acabara de escrever — «porque é
 * que pede para enviar convite, se ele já preencheu tudo?», perguntou o dono a
 * 11-09-2026, com razão. Agora aprovar cria o profissional com o que ele disse
 * e manda-lhe o link para definir a palavra-passe.
 *
 * SÃO DUAS DECISÕES, E ESTÃO SEPARADAS DE PROPÓSITO. Aprovar aqui é dizer
 * «este existe e é quem diz ser»: abre-lhe o painel, onde o cartão do perfil
 * por completar lhe pede o NIF, a morada fiscal e o IBAN. Pô-lo a receber
 * pedidos é a outra, e continua a ser tomada no ecrã dos profissionais, com a
 * ficha dele à frente.
 */

type Candidatura = {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  cidade: string | null;
  tipoVeiculo: string | null;
  servicos: string[];
  mensagem: string | null;
  estado: "nova" | "aprovada" | "convidada" | "recusada";
  criadoEm: string;
  tratadoEm: string | null;
  tratadoPor: string | null;
};

const ETIQUETA_DO_SERVICO: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.id, c.label]),
);

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminCandidaturasPanel() {
  const { token, ready } = useAdminAuth();
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([]);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [linkEmClaro, setLinkEmClaro] = useState("");
  const [verTratadas, setVerTratadas] = useState(false);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/candidaturas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (res.ok) setCandidaturas(dados.candidaturas ?? []);
    } catch {
      /* uma falha de rede aqui não pode partir o painel dos convites */
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  async function agir(id: number, accao: "aprovar" | "recusar") {
    if (!token) return;
    setOcupado(id);
    setErro("");
    setAviso("");
    setLinkEmClaro("");
    try {
      const res = await fetch("/api/admin/candidaturas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, accao }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      setAviso(dados.feito ?? "feito");
      // Sem email, o link vai para a mão de quem está aqui — é o que permite
      // mandá-lo por WhatsApp em vez de perder a candidatura.
      if (typeof dados.link === "string") setLinkEmClaro(dados.link);
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  /*
   * `convidada` NÃO É TRATADA — e era assim que estas pessoas se perdiam.
   *
   * É o estado antigo, de quando aprovar mandava um convite para um segundo
   * formulário. Quem nunca usou esse convite ficou sem conta nenhuma: o
   * candidato escreveu tudo, recebeu um link, não lhe tocou, e do lado de cá
   * a linha mostrava um visto verde e não tinha botão nenhum. Parecia
   * despachada e estava parada — quatro pessoas à espera sem ninguém a ver.
   *
   * Fica por tratar até alguém lhe criar a conta ou a recusar. Aprovar é
   * seguro mesmo que ele tenha entretanto usado o convite: a rota vê que já
   * é profissional e arruma a candidatura sem criar nada.
   */
  const porTratar = candidaturas.filter((c) => c.estado === "nova" || c.estado === "convidada");
  const tratadas = candidaturas.filter((c) => c.estado === "aprovada" || c.estado === "recusada");
  const aMostrar = verTratadas ? tratadas : porTratar;

  // Sem candidaturas nenhumas, nem sequer se desenha o bloco: um painel vazio
  // a dizer "nada por aqui" é ruído por cima do que interessa.
  if (candidaturas.length === 0) return null;

  return (
    <section className="mb-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Inbox className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          Candidaturas pelo site
          {porTratar.length > 0 && (
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-200">
              {porTratar.length}
            </span>
          )}
        </h3>
        {tratadas.length > 0 && (
          <button
            onClick={() => setVerTratadas((v) => !v)}
            className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            {verTratadas ? `Ver por tratar (${porTratar.length})` : `Ver tratadas (${tratadas.length})`}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Vieram do formulário em /quero-ser-parceiro. Aprovar cria já a conta com o que ele
        escreveu e manda-lhe o link para definir a palavra-passe — sem segundo formulário.
        Abre-lhe o painel; não o põe a receber pedidos: isso é a aprovação em Profissionais,
        depois de ele preencher o NIF, a morada fiscal e o IBAN.
      </p>

      {erro && (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {aviso}
        </p>
      )}
      {linkEmClaro && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-200">
            O email não saiu. Envie este link à pessoa por outro meio.
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300">
              {linkEmClaro}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(linkEmClaro)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              copiar
            </button>
          </div>
        </div>
      )}

      {aMostrar.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nenhuma por tratar.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {aMostrar.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {c.nome}
                    {c.cidade && <span className="font-normal text-slate-400"> · {c.cidade}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {c.email}
                    {c.telefone && ` · ${c.telefone}`}
                    {c.tipoVeiculo && ` · ${etiquetaDoVeiculo(c.tipoVeiculo)}`}
                  </p>
                  {c.servicos.length > 0 && (
                    <p className="mt-1 text-xs text-cyan-300">
                      {c.servicos.map((s) => ETIQUETA_DO_SERVICO[s] ?? s).join(" · ")}
                    </p>
                  )}
                  {c.mensagem && (
                    <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                      {c.mensagem}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">
                    {quando(c.criadoEm)}
                    {c.estado !== "nova" &&
                      ` · ${
                        c.estado === "aprovada"
                          ? "aprovada"
                          : /*
                             * Linhas anteriores a 11-09-2026, de quando aprovar
                             * mandava um convite para o formulário longo. Diz-se
                             * o que ISSO SIGNIFICA hoje — «convidada» sozinho
                             * lia-se como despachada, e a pessoa não tem conta
                             * nenhuma.
                             */
                            c.estado === "convidada"
                            ? "convite antigo por usar — ainda sem conta"
                            : "recusada"
                      }${c.tratadoPor ? ` por ${c.tratadoPor}` : ""}`}
                  </p>
                </div>

                {(c.estado === "nova" || c.estado === "convidada") && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      /* Confirmação: isto cria uma conta e manda um email a uma
                         pessoa. Enquanto era só um convite, um toque a mais
                         custava um convite a mais; agora custa um profissional
                         na base. */
                      onClick={() => {
                        if (
                          window.confirm(
                            `Criar a conta de ${c.nome} e enviar-lhe o link da palavra-passe?\n\n` +
                              "Fica em pendente: abre o painel, não recebe pedidos.",
                          )
                        ) {
                          void agir(c.id, "aprovar");
                        }
                      }}
                      disabled={ocupado === c.id}
                      className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                    >
                      {ocupado === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {c.estado === "convidada" ? "Criar a conta agora" : "Aprovar e dar acesso"}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Arrumar a candidatura de ${c.nome}? Não lhe é enviado nada.`)) {
                          void agir(c.id, "recusar");
                        }
                      }}
                      disabled={ocupado === c.id}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      Arrumar
                    </button>
                  </div>
                )}
                {c.estado === "aprovada" && (
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
