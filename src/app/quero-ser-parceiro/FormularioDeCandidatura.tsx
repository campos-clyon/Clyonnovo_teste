"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";

/**
 * O formulário de quem se quer tornar parceiro.
 *
 * Seis campos, e nenhum deles é papelada. O NIF, a morada fiscal, o IBAN e o
 * raio ficam para depois do convite — pedir tudo à cabeça a alguém que ainda
 * não decidiu se quer é a forma mais rápida de o perder no terceiro campo.
 *
 * Os erros aparecem POR BAIXO DO BOTÃO e não no topo: num telemóvel, uma
 * mensagem no topo nasce fora do que se está a ver, e fica a ideia de que o
 * botão não fez nada.
 */

const VEICULOS = [
  { id: "carrinha_pequena", label: "Carrinha pequena (até 3 m³)" },
  { id: "carrinha_media", label: "Carrinha média (3 a 8 m³)" },
  { id: "carrinha_grande", label: "Carrinha grande (8 a 15 m³)" },
  { id: "camiao", label: "Camião (mais de 15 m³)" },
  { id: "sem_veiculo", label: "Não tenho viatura própria" },
];

const CAIXA =
  "w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-600";

export default function FormularioDeCandidatura() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState("");
  const [servicos, setServicos] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState("");

  const [aEnviar, setAEnviar] = useState(false);
  const [erros, setErros] = useState<Array<{ campo: string; mensagem: string }>>([]);
  const [feito, setFeito] = useState(false);

  const erroDe = (campo: string) => erros.find((e) => e.campo === campo)?.mensagem;

  function alternar(id: string) {
    setServicos((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setErros((e) => e.filter((x) => x.campo !== "servicos"));
  }

  async function enviar() {
    setAEnviar(true);
    setErros([]);
    try {
      const res = await fetch("/api/parceiros/candidatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          telefone,
          cidade,
          tipoVeiculo: tipoVeiculo || null,
          servicos,
          mensagem: mensagem || null,
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErros(
          Array.isArray(dados.erros) && dados.erros.length > 0
            ? dados.erros
            : [{ campo: "geral", mensagem: dados.error ?? "Não foi possível enviar." }],
        );
        return;
      }
      setFeito(true);
    } catch {
      setErros([
        { campo: "geral", mensagem: "Sem ligação. O que escreveu não se perdeu — tente outra vez." },
      ]);
    } finally {
      setAEnviar(false);
    }
  }

  if (feito) {
    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-bold text-[#0B1929]">Recebemos a sua candidatura</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-700">
          Vamos olhar para ela e falamos consigo. Se avançar, recebe no email{" "}
          <strong>{email}</strong> o link para completar o registo.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-slate-500">
          Não pedimos nada para se inscrever, e responder a pedidos nunca lhe custa
          nada. Só há comissão quando fecha um trabalho.
        </p>
        <Link
          href="/profissionais"
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Ver como funciona
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Nome ou empresa *</span>
          {/*
            NENHUM EXEMPLO PODE SER O NOME DE UMA EMPRESA A SÉRIO.

            Dizia «Ex.: Mudanças Jorge», e a Mudanças Jorge existe — está no
            mesmo grupo de empresas de mudanças que vamos convidar. Chegar a
            uma página de recrutamento e encontrar o nome da própria casa posto
            como exemplo por quem ainda não a convidou não é simpático: é usar
            o nome dela sem pedir.

            O exemplo passa a ser uma forma jurídica genérica, que não é o nome
            de ninguém.
          */}
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={`mt-1.5 ${CAIXA}`}
            placeholder="Ex.: Transportes e Mudanças, Lda."
          />
          {erroDe("nome") && <span className="mt-1 block text-xs text-red-600">{erroDe("nome")}</span>}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Telemóvel *</span>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              inputMode="tel"
              className={`mt-1.5 ${CAIXA}`}
              placeholder="912 345 678"
            />
            {erroDe("telefone") && (
              <span className="mt-1 block text-xs text-red-600">{erroDe("telefone")}</span>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email *</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              className={`mt-1.5 ${CAIXA}`}
              placeholder="nome@empresa.pt"
            />
            {erroDe("email") && (
              <span className="mt-1 block text-xs text-red-600">{erroDe("email")}</span>
            )}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">De onde trabalha *</span>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className={`mt-1.5 ${CAIXA}`}
              placeholder="Ex.: Seixal"
            />
            <span className="mt-1 block text-xs text-slate-500">
              A localidade da sua base. É daqui que se mede o que lhe fica perto.
            </span>
            {erroDe("cidade") && (
              <span className="mt-1 block text-xs text-red-600">{erroDe("cidade")}</span>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Viatura</span>
            <select
              value={tipoVeiculo}
              onChange={(e) => setTipoVeiculo(e.target.value)}
              className={`mt-1.5 ${CAIXA}`}
            >
              <option value="">Escolher…</option>
              {VEICULOS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-700">O que faz *</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Só lhe chegam pedidos destas categorias. Pode mudar depois.
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SERVICE_CATEGORIES.map((c) => {
              const escolhido = servicos.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alternar(c.id)}
                  aria-pressed={escolhido}
                  className={`min-h-[44px] rounded-xl border-2 px-3.5 text-sm font-medium transition ${
                    escolhido
                      ? "border-cyan-600 bg-cyan-50 text-cyan-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {erroDe("servicos") && (
            <span className="mt-1 block text-xs text-red-600">{erroDe("servicos")}</span>
          )}
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Quer dizer mais alguma coisa? <span className="font-normal text-slate-400">(opcional)</span>
          </span>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={3}
            className={`mt-1.5 ${CAIXA}`}
            placeholder="Há quanto tempo trabalha nisto, quantas pessoas tem na equipa, o que costuma fazer."
          />
        </label>
      </div>

      <button
        onClick={() => void enviar()}
        disabled={aEnviar}
        className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white transition active:bg-cyan-700 disabled:opacity-40"
      >
        {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {aEnviar ? "A enviar…" : "Enviar candidatura"}
      </button>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {erroDe("geral") && (
          <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erroDe("geral")}
          </p>
        )}
        {erros.length > 0 && !erroDe("geral") && (
          <p className="mt-2 text-sm text-red-600">Falta preencher o que está assinalado acima.</p>
        )}
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
        Ao enviar, fica só uma candidatura registada. Não cria conta nem o obriga a nada.
      </p>
    </div>
  );
}
