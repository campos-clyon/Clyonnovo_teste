"use client";

import { useState } from "react";

/**
 * O CANTO DAS EMPRESAS — por baixo do resumo do pedido.
 *
 * "Crie aqui no canto inferior direito, logo abaixo de «Resumo do pedido»,
 * uma opção para as empresas enviar pedidos por e-mails" — 13-09-2026.
 *
 * O formulário ao lado foi feito para UM pedido: um serviço, uma morada, um
 * andar, um elevador. Quem gere condomínios, obras ou imobiliárias não tem um
 * pedido, tem uma lista — e preenchê-la sete vezes seguidas é o que faz uma
 * empresa fechar o separador e ligar a outra pessoa.
 *
 * Aqui escreve-se a lista de uma vez, em texto corrido. Chega ao
 * geral@clyon.pt e fica registada em Leads, no backoffice, ao lado dos outros
 * contactos — que é a diferença entre um pedido tratado e um email que ninguém
 * viu. A resposta do email vai directa para a empresa, não para o noreply.
 */

type Estado = "fechado" | "aberto" | "a-enviar" | "enviado";

export default function PedidoDeEmpresaCard() {
  const [estado, setEstado] = useState<Estado>("fechado");
  const [erro, setErro] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEstado("a-enviar");
    try {
      const res = await fetch("/api/pedido-de-empresa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa,
          email,
          telefone: telefone || undefined,
          mensagem,
          pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados?.error ?? "Não foi possível enviar. Tente outra vez.");
        setEstado("aberto");
        return;
      }
      setEstado("enviado");
    } catch {
      setErro("Não foi possível ligar ao servidor. Tente outra vez.");
      setEstado("aberto");
    }
  }

  return (
    <div className="mt-4 bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9]">
        <h3 className="text-xs font-semibold text-[#102033]">É uma empresa?</h3>
      </div>

      {estado === "enviado" ? (
        <div className="px-4 py-4">
          <p className="text-xs text-[#102033] font-medium">Recebido. Obrigado.</p>
          <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
            A equipa CLYON responde a {email} até ao fim do próximo dia útil.
          </p>
        </div>
      ) : (
        <div className="px-4 py-4">
          <p className="text-xs leading-relaxed text-[#64748B]">
            Condomínios, obras e imobiliárias: envie vários pedidos de uma vez, por email, sem
            preencher o formulário a cada um.
          </p>

          {estado === "fechado" ? (
            <button
              type="button"
              onClick={() => setEstado("aberto")}
              className="mt-3 w-full rounded-lg border border-[#0487D9] px-3 py-2 text-xs font-semibold text-[#0487D9] transition-colors hover:bg-[#F0F9FF]"
            >
              Enviar pedidos por email
            </button>
          ) : (
            <form onSubmit={enviar} className="mt-3 space-y-2">
              <div>
                <label htmlFor="empresa-nome" className="block text-[11px] text-[#64748B]">
                  Empresa
                </label>
                <input
                  id="empresa-nome"
                  value={empresa}
                  onChange={(ev) => setEmpresa(ev.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  className="mt-0.5 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-[#102033] outline-none focus:border-[#0487D9]"
                />
              </div>
              <div>
                <label htmlFor="empresa-email" className="block text-[11px] text-[#64748B]">
                  Email
                </label>
                <input
                  id="empresa-email"
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  required
                  maxLength={180}
                  className="mt-0.5 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-[#102033] outline-none focus:border-[#0487D9]"
                />
              </div>
              <div>
                <label htmlFor="empresa-telefone" className="block text-[11px] text-[#64748B]">
                  Telefone <span className="text-[#94A3B8]">(opcional)</span>
                </label>
                <input
                  id="empresa-telefone"
                  inputMode="tel"
                  value={telefone}
                  onChange={(ev) => setTelefone(ev.target.value)}
                  maxLength={20}
                  className="mt-0.5 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-[#102033] outline-none focus:border-[#0487D9]"
                />
              </div>
              <div>
                <label htmlFor="empresa-mensagem" className="block text-[11px] text-[#64748B]">
                  Os pedidos
                </label>
                <textarea
                  id="empresa-mensagem"
                  value={mensagem}
                  onChange={(ev) => setMensagem(ev.target.value)}
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={5}
                  placeholder="Ex.: três recolhas de entulho na Rua X, 12 — cave, sem elevador — para a próxima semana."
                  className="mt-0.5 w-full resize-y rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs leading-relaxed text-[#102033] outline-none focus:border-[#0487D9]"
                />
              </div>

              {erro && <p className="text-[11px] text-[#DC2626]">{erro}</p>}

              <button
                type="submit"
                disabled={estado === "a-enviar"}
                className="w-full rounded-lg bg-[#0487D9] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#036BB0] disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
              >
                {estado === "a-enviar" ? "A enviar…" : "Enviar"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
