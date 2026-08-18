"use client";

import { useState } from "react";
import { AlertTriangle, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { CabecalhoDeEcra } from "@/components/portal/Portal";
import Nota from "@/components/Nota";
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
  dados: "Os meus dados",
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
  const [feito, setFeito] = useState(false);

  // Palavra-passe — não vive no perfil, tem rota própria.
  const [actual, setActual] = useState("");
  const [nova, setNova] = useState("");
  const [aVer, setAVer] = useState(false);

  function mudar<K extends keyof PerfilTipo>(campo: K, valor: PerfilTipo[K]) {
    setDados((d) => ({ ...d, [campo]: valor }));
    setFeito(false);
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
        setErro(r.error ?? "Não foi possível guardar.");
        return;
      }
      setFeito(true);
      onGravado();
    } catch {
      setErro("Erro de rede.");
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
        setErro(r.error ?? "Não foi possível mudar.");
        return;
      }
      setActual("");
      setNova("");
      setFeito(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  const Guardar = ({ onClick, rotulo = "Guardar" }: { onClick: () => void; rotulo?: string }) => (
    <button
      onClick={onClick}
      disabled={aGravar}
      className="mt-5 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white transition active:bg-cyan-700 disabled:opacity-40"
    >
      {aGravar ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : feito ? (
        <Check className="h-5 w-5" aria-hidden="true" />
      ) : null}
      {feito ? "Guardado" : rotulo}
    </button>
  );

  return (
    <>
      <CabecalhoDeEcra titulo={TITULOS[seccao]} onVoltar={onVoltar} />

      {erro && (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </p>
      )}

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

            <Nota titulo="É isto que decide o que lhe chega">
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
                  regimeIva: dados.regimeIva,
                  emiteGuiaTransporte: dados.emiteGuiaTransporte,
                  numeroTransportador: dados.numeroTransportador,
                })
              }
            />

            <Nota titulo="Porque é que o IVA é o seu regime" icone={AlertTriangle}>
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

            <Nota titulo="Quem vê o seu IBAN">
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
          </div>
        )}
      </section>
    </>
  );
}
