"use client";

import { useState, useEffect } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { CabecalhoDeEcra } from "@/components/portal/Portal";
import Nota from "@/components/Nota";
import ApagarContaModal, { LinhaApagarConta } from "@/components/ApagarContaModal";
import { RAIO_MAXIMO_KM, RAIO_MINIMO_KM } from "@/lib/inscricao-profissional";
import { MINIMO_DA_PALAVRA_PASSE } from "@/lib/profissional-auth";
import type { Perfil as PerfilTipo } from "./tipos";

/**
 * O perfil, em secções pequenas.
 *
 * Cada secção grava sozinha. Um formulário único com tudo lá dentro obrigava a
 * mexer no IBAN para corrigir o telefone, e um erro em qualquer campo bloqueava
 * a gravação de todos os outros — que é como se desiste de corrigir seja o que
 * for.
 *
 * As zonas e as categorias não são enfeite de perfil: são a regra que decide
 * que pedidos lhe chegam. Estão aqui para que mudar de área não obrigue a
 * escrever-nos — e para que ninguém deixe de receber trabalho sem perceber
 * porquê.
 */

export type SeccaoDoPerfil = "dados" | "servicos" | "faturacao" | "banco" | "seguranca";

const TITULOS: Record<SeccaoDoPerfil, string> = {
  dados: "Perfil",
  servicos: "Serviços e zonas",
  faturacao: "Faturação e IVA",
  banco: "Conta bancária",
  seguranca: "Palavra-passe",
};

function Campo({
  etiqueta,
  children,
  ajuda,
}: {
  etiqueta: string;
  children: React.ReactNode;
  ajuda?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{etiqueta}</span>
      <div className="mt-1.5">{children}</div>
      {ajuda && <span className="mt-1 block text-xs text-slate-500">{ajuda}</span>}
    </label>
  );
}

const CAIXA =
  "w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-600";

function Interruptor({
  ligado,
  onMudar,
  etiqueta,
  descricao,
}: {
  ligado: boolean;
  onMudar: (v: boolean) => void;
  etiqueta: string;
  descricao?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onMudar(!ligado)}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition active:bg-slate-50"
    >
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-800">{etiqueta}</span>
        {descricao && <span className="block text-xs text-slate-500">{descricao}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          ligado ? "bg-cyan-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            ligado ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

export default function Perfil({
  seccao,
  perfil,
  onVoltar,
  onGravado,
}: {
  seccao: SeccaoDoPerfil;
  perfil: PerfilTipo;
  onVoltar: () => void;
  onGravado: () => void;
}) {
  const [dados, setDados] = useState<PerfilTipo>(perfil);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");
  /*
   * A hora a que gravou, não um "já gravei".
   *
   * Era um booleano, e uma vez verdadeiro o botão dizia "Guardado" até alguém
   * mexer num campo. Quem voltasse a este ecrã encontrava-o a dizer que estava
   * guardado sem ter carregado em nada — e quem carregasse duas vezes seguidas
   * não via diferença entre a primeira e a segunda. Com a hora, a confirmação
   * é sempre de uma gravação concreta.
   */
  const [gravadoAs, setGravadoAs] = useState<Date | null>(null);

  // Palavra-passe — não vive no perfil, tem rota própria.
  const [actual, setActual] = useState("");
  const [nova, setNova] = useState("");
  const [aVer, setAVer] = useState(false);
  const [aApagarConta, setAApagarConta] = useState(false);

  /*
   * Cada secção responde por si.
   *
   * O estado era partilhado pelas cinco: gravar os dados e passar a "Serviços
   * e zonas" mostrava lá o botão já a dizer "Guardado", sobre alterações que
   * ninguém tinha enviado.
   */
  useEffect(() => {
    setGravadoAs(null);
    setErro("");
  }, [seccao]);

  function mudar<K extends keyof PerfilTipo>(campo: K, valor: PerfilTipo[K]) {
    setDados((d) => ({ ...d, [campo]: valor }));
    // Mexer num campo apaga a confirmação: o que está no ecrã deixou de ser o
    // que está gravado, e continuar a dizer "guardado" seria mentira.
    setGravadoAs(null);
    setErro("");
  }

  async function gravar(corpo: Record<string, unknown>) {
    setAGravar(true);
    setErro("");
    try {
      const res = await fetch("/api/profissionais/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const r = await res.json();
      if (!res.ok) {
        // Uma sessão que expirou não é um erro do formulário. Dizer-lhe
        // "Não autenticado" ao lado dos campos deixava-a a procurar o que
        // tinha escrito de errado — quando o que precisa é de voltar a entrar.
        setErro(
          res.status === 401
            ? "A sua sessão expirou. Volte a entrar e grave outra vez."
            : (r.error ?? "Não foi possível guardar."),
        );
        return;
      }
      setGravadoAs(new Date());
      onGravado();
    } catch {
      setErro("Sem ligação. O que escreveu não se perdeu — tente outra vez.");
    } finally {
      setAGravar(false);
    }
  }

  async function mudarPalavraPasse() {
    setAGravar(true);
    setErro("");
    try {
      const res = await fetch("/api/profissionais/palavra-passe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nova }),
      });
      const r = await res.json();
      if (!res.ok) {
        setErro(
          res.status === 401
            ? "A sua sessão expirou. Volte a entrar e tente outra vez."
            : (r.error ?? "Não foi possível mudar."),
        );
        return;
      }
      setActual("");
      setNova("");
      setGravadoAs(new Date());
    } catch {
      setErro("Sem ligação. O que escreveu não se perdeu — tente outra vez.");
    } finally {
      setAGravar(false);
    }
  }

  /*
   * A resposta fica colada ao botão.
   *
   * O erro era desenhado no topo do ecrã e o botão está no fundo. Num
   * telemóvel, carregar em "Guardar" e falhar não mostrava nada: a mensagem
   * vermelha nascia acima do que se estava a ver. Ficava a ideia de que o
   * botão não fazia nada — que é pior do que um erro, porque leva a pessoa a
   * carregar outra vez.
   */
  const Guardar = ({ onClick, rotulo = "Guardar" }: { onClick: () => void; rotulo?: string }) => (
    <div className="mt-5">
      <button
        onClick={onClick}
        disabled={aGravar}
        className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white transition active:bg-cyan-700 disabled:opacity-40"
      >
        {aGravar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {aGravar ? "A guardar…" : rotulo}
      </button>

      {/* Uma região viva: quem ouve o ecrã em vez de o ver recebe o mesmo. */}
      <div aria-live="polite" className="min-h-[1.5rem]">
        {erro ? (
          <p className="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Não foi guardado.</strong> {erro}
            </span>
          </p>
        ) : gravadoAs ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-700">
            <Check className="h-4 w-4" aria-hidden="true" />
            Guardado às{" "}
            {gravadoAs.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <CabecalhoDeEcra titulo={TITULOS[seccao]} onVoltar={onVoltar} />

      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        {/* ── Dados ────────────────────────────────────────────────────────── */}
        {seccao === "dados" && (
          <div className="space-y-4">
            <Campo etiqueta="Nome ou empresa">
              <input
                className={CAIXA}
                value={dados.nome}
                onChange={(e) => mudar("nome", e.target.value)}
              />
            </Campo>

            <Campo etiqueta="Telefone">
              <div className="flex">
                {/* O prefixo fixo evita a dúvida de escrever +351 ou não — e é
                    o que faz o número ficar sempre no mesmo formato na base. */}
                <span className="flex items-center rounded-l-xl border-2 border-r-0 border-gray-300 bg-slate-50 px-3 text-base font-medium text-slate-500">
                  +351
                </span>
                <input
                  className={`${CAIXA} rounded-l-none`}
                  inputMode="tel"
                  value={dados.telefone}
                  onChange={(e) => mudar("telefone", e.target.value)}
                />
              </div>
            </Campo>

            <Campo etiqueta="Cidade de base" ajuda="É daqui que contamos o seu raio de acção.">
              <input
                className={CAIXA}
                value={dados.cidade}
                onChange={(e) => mudar("cidade", e.target.value)}
              />
            </Campo>

            <Campo etiqueta="Email" ajuda="É com este email que entra. Para o mudar, fale connosco.">
              <input className={`${CAIXA} bg-slate-50 text-slate-500`} value={dados.email} disabled />
            </Campo>

            <Guardar
              onClick={() =>
                gravar({ nome: dados.nome, telefone: dados.telefone, cidade: dados.cidade })
              }
            />
          </div>
        )}

        {/* ── Serviços e zonas ─────────────────────────────────────────────── */}
        {seccao === "servicos" && (
          <div className="space-y-5">
            <div>
              <span className="text-sm font-medium text-slate-700">O que faz</span>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {SERVICE_CATEGORIES.map((c) => {
                  const activo = dados.categorias.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        mudar(
                          "categorias",
                          activo
                            ? dados.categorias.filter((x) => x !== c.id)
                            : [...dados.categorias, c.id],
                        )
                      }
                      aria-pressed={activo}
                      className={`flex min-h-[48px] items-center gap-3 rounded-xl border-2 px-4 text-left transition ${
                        activo ? "border-cyan-600 bg-cyan-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                          activo ? "border-cyan-600 bg-cyan-600" : "border-slate-300"
                        }`}
                      >
                        {activo && <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />}
                      </span>
                      <span className="text-sm font-medium text-slate-800">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Campo
              etiqueta="Zonas onde trabalha"
              ajuda="Separadas por vírgula. A sua cidade entra sempre."
            >
              <input
                className={CAIXA}
                value={dados.zonas.join(", ")}
                onChange={(e) =>
                  mudar(
                    "zonas",
                    e.target.value.split(",").map((z) => z.trim()).filter(Boolean),
                  )
                }
                placeholder="Lisboa, Amadora, Sintra"
              />
            </Campo>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-slate-700">Raio de acção</span>
                <span className="text-lg font-bold text-cyan-700">{dados.raioKm} km</span>
              </div>
              <input
                type="range"
                min={RAIO_MINIMO_KM}
                max={RAIO_MAXIMO_KM}
                value={dados.raioKm}
                onChange={(e) => mudar("raioKm", Number(e.target.value))}
                className="mt-2 w-full accent-cyan-600"
                aria-label="Raio de acção em quilómetros"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>{RAIO_MINIMO_KM} km</span>
                <span>{RAIO_MAXIMO_KM} km</span>
              </div>
            </div>

            <Guardar
              onClick={() =>
                gravar({
                  categorias: dados.categorias,
                  zonas: dados.zonas,
                  cidade: dados.cidade,
                  raioKm: dados.raioKm,
                })
              }
            />

            <Nota titulo="É isto que decide o que lhe chega" comecaAberta>
              Um pedido só lhe aparece se for de um serviço que faz e de uma zona onde
              trabalha. Apertar demasiado o raio ou tirar uma categoria faz o trabalho
              deixar de aparecer sem nada avisar.
            </Nota>
          </div>
        )}

        {/* ── Faturação ────────────────────────────────────────────────────── */}
        {seccao === "faturacao" && (
          <div className="space-y-4">
            <Interruptor
              ligado={dados.emiteFatura}
              onMudar={(v) => mudar("emiteFatura", v)}
              etiqueta="Emito fatura"
              descricao="Há clientes que só contratam quem passa fatura."
            />

            {dados.emiteFatura && (
              <>
                <Campo etiqueta="NIF">
                  <input
                    className={CAIXA}
                    inputMode="numeric"
                    value={dados.nif}
                    onChange={(e) => mudar("nif", e.target.value)}
                  />
                </Campo>

                {/* A morada da declaração de actividade. Pode não ser a
                    cidade onde trabalha — essa serve para calcular distâncias,
                    esta vai na fatura ao cliente. */}
                <Campo etiqueta="Morada fiscal">
                  <input
                    className={CAIXA}
                    value={dados.moradaFiscal}
                    onChange={(e) => mudar("moradaFiscal", e.target.value)}
                    placeholder="Rua e número, andar"
                    autoComplete="street-address"
                  />
                </Campo>

                <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-3">
                  <Campo etiqueta="Código postal">
                    <input
                      className={CAIXA}
                      inputMode="numeric"
                      value={dados.codigoPostalFiscal}
                      onChange={(e) => mudar("codigoPostalFiscal", e.target.value)}
                      placeholder="2700-123"
                      autoComplete="postal-code"
                    />
                  </Campo>
                  <Campo etiqueta="Localidade">
                    <input
                      className={CAIXA}
                      value={dados.localidadeFiscal}
                      onChange={(e) => mudar("localidadeFiscal", e.target.value)}
                      placeholder="Amadora"
                    />
                  </Campo>
                </div>

                <div>
                  <span className="text-sm font-medium text-slate-700">Regime de IVA</span>
                  <div className="mt-2 space-y-2">
                    {[
                      {
                        id: "isento",
                        titulo: "Isento (art. 53.º)",
                        texto: "Não cobra IVA. O cliente não vê linha de imposto.",
                      },
                      {
                        id: "normal",
                        titulo: "Regime normal — 23 %",
                        texto: "O IVA vem incluído no valor acordado e aparece na confirmação.",
                      },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => mudar("regimeIva", r.id)}
                        aria-pressed={dados.regimeIva === r.id}
                        className={`block w-full rounded-xl border-2 p-3 text-left transition ${
                          dados.regimeIva === r.id
                            ? "border-cyan-600 bg-cyan-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-slate-800">
                          {r.titulo}
                        </span>
                        <span className="block text-xs text-slate-500">{r.texto}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Interruptor
              ligado={dados.emiteGuiaTransporte}
              onMudar={(v) => mudar("emiteGuiaTransporte", v)}
              etiqueta="Emito guia de transporte de resíduos"
              descricao="Obrigatória para entulho e monos. Verificamos o número."
            />

            {dados.emiteGuiaTransporte && (
              <Campo
                etiqueta="Número de registo de transportador"
                ajuda={
                  dados.guiaVerificada
                    ? "Verificado. Mudar o número volta a pô-lo por verificar."
                    : "Ainda por verificar do nosso lado."
                }
              >
                <input
                  className={CAIXA}
                  value={dados.numeroTransportador}
                  onChange={(e) => mudar("numeroTransportador", e.target.value)}
                  placeholder="APA-123456"
                />
              </Campo>
            )}

            <Guardar
              onClick={() =>
                gravar({
                  emiteFatura: dados.emiteFatura,
                  nif: dados.nif,
                  moradaFiscal: dados.moradaFiscal,
                  codigoPostalFiscal: dados.codigoPostalFiscal,
                  localidadeFiscal: dados.localidadeFiscal,
                  regimeIva: dados.regimeIva,
                  emiteGuiaTransporte: dados.emiteGuiaTransporte,
                  numeroTransportador: dados.numeroTransportador,
                })
              }
            />

            <Nota titulo="Porque é que o IVA é o seu regime" icone="aviso" comecaAberta>
              O imposto é liquidado por si, não por nós. Um isento pelo artigo 53.º não
              cobra IVA nenhum — mostrar 23 % ao cliente seria mostrar-lhe um imposto que
              não é devido e que ninguém pode entregar ao Estado.
            </Nota>
          </div>
        )}

        {/* ── Banco ────────────────────────────────────────────────────────── */}
        {seccao === "banco" && (
          <div className="space-y-4">
            {dados.temIban && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                A receber em <strong>{dados.iban}</strong>
                {dados.ibanTitular ? ` · ${dados.ibanTitular}` : ""}
              </p>
            )}

            <Campo
              etiqueta={dados.temIban ? "Novo IBAN" : "IBAN"}
              ajuda="Verificamos os dígitos de controlo antes de guardar."
            >
              <input
                className={CAIXA}
                value={dados.iban.includes("·") ? "" : dados.iban}
                onChange={(e) => mudar("iban", e.target.value)}
                placeholder="PT50 0002 0123 1234 5678 9015 4"
                autoComplete="off"
                spellCheck={false}
              />
            </Campo>

            <Campo etiqueta="Titular da conta" ajuda="O nome tal como está no banco.">
              <input
                className={CAIXA}
                value={dados.ibanTitular}
                onChange={(e) => mudar("ibanTitular", e.target.value)}
              />
            </Campo>

            <Guardar
              onClick={() => gravar({ iban: dados.iban, ibanTitular: dados.ibanTitular })}
              rotulo="Guardar conta"
            />

            <Nota titulo="Quem vê o seu IBAN" comecaAberta>
              Fica guardado connosco e só é usado para lhe transferir o saldo. Não é
              mostrado a clientes nem a outros profissionais, e neste ecrã só voltam a
              aparecer os últimos quatro dígitos.
            </Nota>
          </div>
        )}

        {/* ── Palavra-passe ────────────────────────────────────────────────── */}
        {seccao === "seguranca" && (
          <div className="space-y-4">
            <Campo etiqueta="Palavra-passe actual">
              <div className="relative">
                <input
                  className={`${CAIXA} pr-12`}
                  type={aVer ? "text" : "password"}
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setAVer((v) => !v)}
                  aria-label={aVer ? "Esconder" : "Mostrar"}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-400"
                >
                  {aVer ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </Campo>

            <Campo
              etiqueta="Nova palavra-passe"
              ajuda={`Pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres.`}
            >
              <input
                className={CAIXA}
                type={aVer ? "text" : "password"}
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                autoComplete="new-password"
              />
            </Campo>

            <Guardar onClick={mudarPalavraPasse} rotulo="Mudar palavra-passe" />

            {/*
              Apagar a conta — uma linha, no fim, em cinzento.

              O direito a sair é dele e não tinha porta nenhuma: até aqui só o
              backoffice podia apagar uma conta de profissional. Mas uma acção
              sem volta que quase ninguém usa não merece caixa nem cor — a
              explicação está atrás do toque.

              O que o trava é o mesmo que trava o backoffice: dinheiro por
              levantar e trabalhos por confirmar. Não há versão mais branda por
              ser ele próprio a pedir.
            */}
            <div className="mt-8 border-t border-slate-100 pt-5">
              <LinhaApagarConta onClick={() => setAApagarConta(true)} />
            </div>

            {aApagarConta && (
              <ApagarContaModal
                endereco="/api/profissionais/conta"
                aviso={
                  <>
                    Deixa de receber pedidos e os seus dados são apagados: nome, email,
                    telefone, NIF, IBAN e morada fiscal. Os trabalhos que já fez ficam sem
                    o seu nome, porque os clientes que o contrataram continuam a ter
                    direito ao histórico deles. Se tivermos dinheiro seu por pagar ou
                    houver um trabalho por confirmar, isto pára e diz o que falta.
                  </>
                }
                aoTerminar={() => {
                  window.location.href = "/";
                }}
                onClose={() => setAApagarConta(false)}
              />
            )}
          </div>
        )}
      </section>
    </>
  );
}
