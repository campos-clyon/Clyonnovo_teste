"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  FileText,
  HelpCircle,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  UserCog,
  Wallet,
} from "lucide-react";
import { GrupoDeLinhas, LinhaDeMenu, euros } from "@/components/portal/Portal";
import Trabalhos from "./Trabalhos";
import Carteira from "./Carteira";
import Historico from "./Historico";
import PerfilEcra, { type SeccaoDoPerfil } from "./Perfil";
import type { DadosDaCarteira, Pedido, Perfil } from "./tipos";

/**
 * O painel do profissional.
 *
 * DUAS COLUNAS em ecrã grande, uma no telemóvel. É o desenho do backoffice: o
 * menu fica à esquerda, sempre à vista, e a secção escolhida abre à direita.
 * Num telemóvel não há largura para dois — aí é uma lista que dá lugar ao ecrã
 * aberto, com seta para trás, que é o gesto das aplicações que ele já tem.
 *
 * A secção aberta vive no endereço (`?ecra=carteira`), e é o mesmo estado a
 * servir os dois desenhos: muda onde é desenhado, não o que é. Assim o botão
 * "voltar" do telemóvel fecha o ecrã em vez de sair do painel, e uma secção
 * pode ser aberta por link directo, de um email ou de outra página.
 */

type Ecra = "menu" | "trabalhos" | "carteira" | "historico" | SeccaoDoPerfil;

const ECRAS_VALIDOS: Ecra[] = [
  "menu",
  "trabalhos",
  "carteira",
  "historico",
  "dados",
  "servicos",
  "faturacao",
  "banco",
  "seguranca",
];

const ESTADO_DA_CONTA: Record<string, { texto: string; cls: string }> = {
  pendente: { texto: "à espera de aprovação", cls: "bg-amber-100 text-amber-800" },
  aprovado: { texto: "activo", cls: "bg-emerald-100 text-emerald-800" },
  rejeitado: { texto: "não aprovado", cls: "bg-red-100 text-red-700" },
  suspenso: { texto: "suspenso", cls: "bg-slate-200 text-slate-600" },
};

export default function PainelDoProfissional() {
  const router = useRouter();
  const params = useSearchParams();

  const pedido = params.get("ecra") ?? "menu";
  const ecra: Ecra = (ECRAS_VALIDOS as string[]).includes(pedido) ? (pedido as Ecra) : "menu";

  const [nome, setNome] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carteira, setCarteira] = useState<DadosDaCarteira | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [rp, rc, rf] = await Promise.all([
        fetch("/api/profissionais/meus-pedidos"),
        fetch("/api/profissionais/carteira"),
        fetch("/api/profissionais/perfil"),
      ]);

      if (rp.status === 401 || rc.status === 401 || rf.status === 401) {
        router.push("/profissionais/entrar");
        return;
      }

      const [dp, dc, df] = await Promise.all([rp.json(), rc.json(), rf.json()]);
      if (rp.ok) {
        setNome(dp.nome ?? "");
        setPedidos(dp.pedidos ?? []);
      }
      if (rc.ok) setCarteira(dc);
      if (rf.ok) setPerfil(df.perfil);
      setErro(rp.ok ? "" : (dp.error ?? "Erro ao carregar."));
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrir(destino: Ecra) {
    router.push(
      destino === "menu" ? "/profissionais/painel" : `/profissionais/painel?ecra=${destino}`,
    );
  }

  async function sair() {
    await fetch("/api/profissionais/sair", { method: "POST" });
    router.push("/profissionais/entrar");
  }

  if (aCarregar) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const aResponder = pedidos.filter((p) => p.estado === "aberta").length;
  const porFazer = pedidos.filter((p) => p.estado === "acordada" && p.fase === "a_executar").length;
  const noMenu = ecra === "menu";

  // O menu é desenhado uma vez e serve os dois desenhos: coluna da esquerda em
  // ecrã grande, ecrã inteiro no telemóvel.
  const menu = (
    <>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-[#0B1929]">
            {nome || "A minha conta"}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {perfil?.cidade && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {perfil.cidade}
              </span>
            )}
            {perfil && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  (ESTADO_DA_CONTA[perfil.estado] ?? ESTADO_DA_CONTA.pendente).cls
                }`}
              >
                {(ESTADO_DA_CONTA[perfil.estado] ?? ESTADO_DA_CONTA.pendente).texto}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={carregar}
          aria-label="Actualizar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition active:bg-slate-100"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <GrupoDeLinhas className="mb-4">
        <LinhaDeMenu
          icone={Briefcase}
          rotulo="Os meus trabalhos"
          activo={ecra === "trabalhos"}
          destaque={
            porFazer > 0
              ? `${porFazer} por fazer`
              : aResponder > 0
                ? `${aResponder} à espera`
                : undefined
          }
          aviso={porFazer > 0}
          onClick={() => abrir("trabalhos")}
        />
        {/* Enquanto nada está disponível, a linha mostrava 0,00 € e parecia que
            ele não tinha ganho nada — quando o dinheiro existe e está à espera
            da confirmação do cliente. */}
        <LinhaDeMenu
          icone={Wallet}
          rotulo="A minha carteira"
          activo={ecra === "carteira" || ecra === "historico"}
          valor={
            carteira && carteira.carteira.disponivel > 0
              ? euros(carteira.carteira.disponivel)
              : undefined
          }
          destaque={
            carteira && carteira.carteira.disponivel === 0 && carteira.carteira.cativo > 0
              ? `${euros(carteira.carteira.cativo)} cativo`
              : carteira && carteira.carteira.disponivel === 0
                ? "0,00 €"
                : undefined
          }
          onClick={() => abrir("carteira")}
        />
      </GrupoDeLinhas>

      <GrupoDeLinhas titulo="A minha conta" className="mb-4">
        <LinhaDeMenu
          icone={UserCog}
          rotulo="Os meus dados"
          activo={ecra === "dados"}
          onClick={() => abrir("dados")}
        />
        <LinhaDeMenu
          icone={MapPin}
          rotulo="Serviços e zonas"
          activo={ecra === "servicos"}
          valor={perfil ? `${perfil.raioKm} km` : undefined}
          onClick={() => abrir("servicos")}
        />
        <LinhaDeMenu
          icone={FileText}
          rotulo="Faturação e IVA"
          activo={ecra === "faturacao"}
          destaque={
            perfil?.emiteGuiaTransporte && !perfil?.guiaVerificada
              ? "guia por verificar"
              : undefined
          }
          aviso
          onClick={() => abrir("faturacao")}
        />
        <LinhaDeMenu
          icone={Building2}
          rotulo="Conta bancária"
          activo={ecra === "banco"}
          valor={perfil?.temIban ? perfil.iban : undefined}
          destaque={perfil && !perfil.temIban ? "por indicar" : undefined}
          aviso
          onClick={() => abrir("banco")}
        />
        <LinhaDeMenu
          icone={KeyRound}
          rotulo="Palavra-passe"
          activo={ecra === "seguranca"}
          onClick={() => abrir("seguranca")}
        />
      </GrupoDeLinhas>

      <GrupoDeLinhas>
        <Link
          href="/contactos"
          className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 transition active:bg-slate-50"
        >
          <HelpCircle className="h-5 w-5 shrink-0 text-cyan-600" aria-hidden="true" />
          <span className="flex-1 text-[15px] font-medium text-[#0B1929]">
            Ajuda e contactos
          </span>
        </Link>
        <LinhaDeMenu icone={LogOut} rotulo="Sair" tom="perigo" onClick={sair} />
      </GrupoDeLinhas>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400 lg:text-left">
        A CLYON liga clientes a profissionais independentes. Quem executa o trabalho e
        emite a fatura é o profissional.
      </p>
    </>
  );

  return (
    <main className="mx-auto w-full max-w-6xl gap-8 px-4 pb-16 pt-4 sm:px-6 sm:pt-8 lg:flex lg:items-start">
      {/* ── O menu ────────────────────────────────────────────────────────── */}
      <div className={`w-full lg:w-80 lg:shrink-0 ${noMenu ? "" : "hidden lg:block"}`}>
        {menu}
      </div>

      {/* ── A secção aberta ───────────────────────────────────────────────── */}
      <div className={`min-w-0 flex-1 ${noMenu ? "hidden lg:block" : ""}`}>
        {erro && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        {/* Em ecrã grande a área da direita nunca fica vazia: sem nada escolhido
            mostra os trabalhos, que é o que ele vem cá ver. */}
        {(ecra === "trabalhos" || noMenu) && (
          <Trabalhos pedidos={pedidos} onVoltar={() => abrir("menu")} onRecarregar={carregar} />
        )}

        {ecra === "carteira" && carteira && (
          <Carteira
            dados={carteira}
            onVoltar={() => abrir("menu")}
            onHistorico={() => abrir("historico")}
            onIban={() => abrir("banco")}
            onRecarregar={carregar}
          />
        )}

        {ecra === "historico" && carteira && (
          <Historico movimentos={carteira.movimentos} onVoltar={() => abrir("carteira")} />
        )}

        {["dados", "servicos", "faturacao", "banco", "seguranca"].includes(ecra) && perfil && (
          <PerfilEcra
            seccao={ecra as SeccaoDoPerfil}
            perfil={perfil}
            onVoltar={() => abrir("menu")}
            onGravado={carregar}
          />
        )}
      </div>
    </main>
  );
}
