"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ACCOES_DOS_ESCOLHIDOS, ERROS_DO_CLIENTE, SAIDAS_DO_CLIENTE, type BotaoDoCartao, type CartaoDoCliente } from "@/lib/escolhidos-sem-resposta";
import type { CartaoDoParceiro } from "@/lib/lista-de-parceiros-da-mudanca";

/**
 * OS PARCEIROS QUE ESCOLHEU AINDA NÃO RESPONDERAM — 11-11-2026 (d6).
 *
 * No ecrã do pedido (pelo link e na conta): enquanto o prazo corre, a linha
 * «têm até às HH:MM para responder»; quando passa sem resposta, o cartão com
 * as três saídas — esperar, escolher outro parceiro da lista ou pedir à CLYON
 * que procure. Só o pedido do cliente abre o pedido a mais parceiros.
 *
 * Os textos e os botões vêm todos da rota (`agirComoCliente`, a mesma do link,
 * da conta e da app de cliente); este ecrã não decide nada.
 */

type Vista = { cartao: CartaoDoCliente | null; prazoTexto: string | null };

type ListaParaEscolher = {
  titulo: string;
  linha: string;
  botao: string;
  maximoDeEscolhidos: number;
  pessoas: 2 | 3;
  parceiros: CartaoDoParceiro[];
  semMaisNinguem: string | null;
};

export default function EscolhidosSemResposta({
  pedidoId,
  token,
  inicial,
  soParaVer = false,
  onMudou,
}: {
  pedidoId: number;
  /** O token do link do pedido; sem ele, é a conta (a sessão prova de quem é). */
  token?: string;
  /** A vista já lida no servidor (a página do link). Sem ela, lê-se ao abrir. */
  inicial?: Vista | null;
  /** O backoffice a conferir («ver como o cliente»): vê, não decide. */
  soParaVer?: boolean;
  onMudou?: () => void;
}) {
  const urlDaAccao = token ? `/api/negociacao/${token}` : "/api/users/me/negociacao";
  const [vista, setVista] = useState<Vista | null>(inicial ?? null);
  const [lista, setLista] = useState<ListaParaEscolher | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState<string | null>(null);
  const [erro, setErro] = useState<{ texto: string; verOPedido: boolean } | null>(null);

  async function pedir(accao: string, mais: Record<string, unknown> = {}) {
    const res = await fetch(urlDaAccao, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accao, pedidoId, ...mais }),
    });
    const dados = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok && dados.ok === true, dados };
  }

  useEffect(() => {
    if (inicial !== undefined) return;
    let vivo = true;
    void pedir(ACCOES_DOS_ESCOLHIDOS.ver)
      .then((r) => {
        if (vivo && r.ok) setVista({ cartao: (r.dados.cartao as CartaoDoCliente) ?? null, prazoTexto: (r.dados.prazoTexto as string) ?? null });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // Lê uma vez, ao abrir o pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  async function agir(accao: string, mais: Record<string, unknown> = {}) {
    if (soParaVer || aEnviar) return;
    setAEnviar(accao);
    setErro(null);
    try {
      const r = await pedir(accao, mais);
      if (!r.ok) {
        setErro({
          texto: typeof r.dados.error === "string" ? r.dados.error : ERROS_DO_CLIENTE.rede,
          verOPedido: r.dados.jaNaoEPreciso === true,
        });
        return;
      }
      if (accao === ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro) {
        setLista(r.dados as unknown as ListaParaEscolher);
        setMarcados([]);
        return;
      }
      if (accao === ACCOES_DOS_ESCOLHIDOS.escolherOutro) {
        setLista(null);
        setEnviado(typeof r.dados.enviado === "string" ? r.dados.enviado : null);
      }
      setVista({ cartao: (r.dados.cartao as CartaoDoCliente) ?? null, prazoTexto: (r.dados.prazoTexto as string) ?? null });
      onMudou?.();
    } catch {
      setErro({ texto: ERROS_DO_CLIENTE.rede, verOPedido: false });
    } finally {
      setAEnviar(null);
    }
  }

  const cartao = vista?.cartao ?? null;
  if (!cartao && !vista?.prazoTexto && !enviado && !lista) return null;

  const botao = (b: BotaoDoCartao, comoLigacao = false) => (
    <button
      key={b.accao}
      type="button"
      onClick={() => void agir(b.accao)}
      disabled={soParaVer || aEnviar != null}
      className={
        comoLigacao
          ? "text-sm font-semibold text-acao underline underline-offset-4 disabled:opacity-50"
          : b.principal
            ? "flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-acao px-5 text-sm font-semibold text-white transition-colors hover:bg-acao-hover disabled:opacity-50"
            : "flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#C9DCE5] bg-white px-5 text-sm font-semibold text-tinta transition-colors hover:bg-slate-50 disabled:opacity-50"
      }
    >
      {aEnviar === b.accao && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {b.texto}
    </button>
  );

  const alternar = (id: string, maximo: number) =>
    setMarcados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : atual.length >= maximo ? atual : [...atual, id]));

  return (
    <section className="mb-6 rounded-2xl border border-[#E2EEF3] bg-white p-5" aria-live="polite">
      {erro && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          <p>{erro.texto}</p>
          {erro.verOPedido && (
            <button type="button" onClick={() => window.location.reload()} className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
              {ERROS_DO_CLIENTE.verOPedido}
            </button>
          )}
        </div>
      )}

      {enviado && <p className="text-sm font-semibold leading-relaxed text-tinta">{enviado}</p>}

      {!lista && !enviado && !cartao && vista?.prazoTexto && <p className="text-sm leading-relaxed text-tinta">{vista.prazoTexto}</p>}

      {!lista && !enviado && cartao && (
        <>
          {cartao.titulo && <h2 className="text-lg font-bold text-tinta">{cartao.titulo}</h2>}
          {cartao.linha && <p className="mt-1 text-sm leading-relaxed text-tinta-fraca">{cartao.linha}</p>}
          {cartao.depois && <p className="text-sm font-semibold leading-relaxed text-tinta">{cartao.depois}</p>}
          {cartao.nota && <p className="mt-2 text-sm leading-relaxed text-tinta">{cartao.nota}</p>}
          {cartao.botoes.length > 0 && <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">{cartao.botoes.map((b) => botao(b))}</div>}
          {cartao.ligacoes.length > 0 && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{cartao.ligacoes.map((b) => botao(b, true))}</div>}
        </>
      )}

      {lista && (
        <>
          <h2 className="text-lg font-bold text-tinta">{lista.titulo}</h2>
          {lista.parceiros.length === 0 ? (
            <>
              <p className="mt-1 text-sm leading-relaxed text-tinta-fraca">{lista.semMaisNinguem}</p>
              <div className="mt-4">
                {botao({ accao: ACCOES_DOS_ESCOLHIDOS.pedirAClyon, texto: SAIDAS_DO_CLIENTE.pedirAClyon, principal: true })}
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm leading-relaxed text-tinta-fraca">{lista.linha}</p>
              <ul className="mt-4 list-none space-y-2.5 p-0">
                {lista.parceiros.map((p) => {
                  const marcado = marcados.includes(p.id);
                  const cheio = !marcado && marcados.length >= lista.maximoDeEscolhidos;
                  const hora = lista.pessoas === 3 ? p.precoHora[3] : p.precoHora[2];
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3.5 ${
                          marcado ? "border-acao ring-2 ring-cyan-100" : "border-[#E2EEF3]"
                        } ${cheio ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          disabled={cheio || soParaVer}
                          onChange={() => alternar(p.id, lista.maximoDeEscolhidos)}
                          className="mt-1 h-5 w-5 shrink-0 accent-cyan-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="text-base font-semibold text-tinta">{p.nome}</span>
                            <span className="text-sm font-bold text-tinta">{p.estimativa.texto}</span>
                          </span>
                          {hora && (
                            <span className="mt-1 block text-sm text-tinta-fraca">
                              {hora.texto} · equipa de {lista.pessoas}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setLista(null)}
                  disabled={aEnviar != null}
                  className="min-h-[48px] rounded-xl border border-[#C9DCE5] bg-white px-5 text-sm font-semibold text-tinta disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void agir(ACCOES_DOS_ESCOLHIDOS.escolherOutro, {
                      parceiros: marcados,
                      assinaturas: Object.fromEntries(
                        lista.parceiros.filter((p) => marcados.includes(p.id) && typeof p.assinatura === "string").map((p) => [p.id, p.assinatura as string]),
                      ),
                    })
                  }
                  disabled={soParaVer || aEnviar != null || marcados.length === 0}
                  className="flex min-h-[48px] min-w-[200px] items-center justify-center gap-2 rounded-xl bg-acao px-6 text-sm font-semibold text-white transition-colors hover:bg-acao-hover disabled:bg-gray-400"
                >
                  {aEnviar === ACCOES_DOS_ESCOLHIDOS.escolherOutro && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {lista.botao}
                  {marcados.length > 0 ? ` (${marcados.length})` : ""}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
