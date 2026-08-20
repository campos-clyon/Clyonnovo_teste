"use client";

import { signOut } from "next-auth/react";
import UserAvatar from "@/components/UserAvatar";
import {
  Bell,
  ClipboardList,
  HelpCircle,
  LogOut,
  Receipt,
  Shield,
  User,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { GrupoDeLinhas, LinhaDeMenu } from "@/components/portal/Portal";
import type { Section } from "./types";

/**
 * A conta do cliente, no telemóvel: um menu de linhas.
 *
 * Estavam aqui dois separadores no topo — "Geral" e "Pedidos" — e as outras
 * quatro secções viviam escondidas dentro do primeiro. Quem procurava as
 * notificações tinha de descobrir que estavam lá dentro.
 *
 * Uma lista mostra tudo o que existe de uma vez, cada linha abre um ecrã com
 * seta para trás, e é o desenho que estas pessoas já têm no telemóvel. O mesmo
 * do lado do profissional — a mesma casa, os mesmos gestos.
 */

export default function MenuMovel({
  nome,
  email,
  avatar,
  pedidosAbertos,
  retido,
  propostasPorResponder = 0,
  onSection,
}: {
  nome: string;
  email: string;
  avatar: string | null;
  pedidosAbertos: number;
  /** Propostas à espera de resposta dele. */
  propostasPorResponder?: number;
  /** O que está retido, para se ver sem entrar. */
  retido?: number | null;
  onSection: (s: Section) => void;
}) {
  return (
    <div className="px-4 pb-16 pt-5">
      <header className="mb-5 flex items-center gap-3">
        <UserAvatar src={avatar} name={nome} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-[#0B1929]">{nome}</h1>
          <p className="truncate text-sm text-slate-500">{email}</p>
        </div>
      </header>

      <GrupoDeLinhas className="mb-4">
        <LinhaDeMenu
          icone={ClipboardList}
          rotulo="Os meus pedidos"
          destaque={
            propostasPorResponder > 0
              ? propostasPorResponder === 1
                ? "1 proposta nova"
                : `${propostasPorResponder} propostas novas`
              : pedidosAbertos > 0
                ? `${pedidosAbertos} a decorrer`
                : undefined
          }
          aviso={propostasPorResponder > 0}
          onClick={() => onSection("pedidos")}
        />
        {/* A carteira ao lado dos pedidos, e não nas definições: é sobre o
            trabalho, não sobre a conta. É a mesma arrumação do painel do
            profissional, e pela mesma razão. */}
        <LinhaDeMenu
          icone={Wallet}
          rotulo="A minha carteira"
          valor={retido != null ? `${retido.toFixed(2).replace(".", ",")} €` : undefined}
          onClick={() => onSection("carteira")}
        />
      </GrupoDeLinhas>

      <GrupoDeLinhas titulo="A minha conta" className="mb-4">
        <LinhaDeMenu icone={User} rotulo="Perfil" onClick={() => onSection("dados-pessoais")} />
        <LinhaDeMenu icone={Receipt} rotulo="Faturação" onClick={() => onSection("faturacao")} />
        <LinhaDeMenu icone={Bell} rotulo="Notificações" onClick={() => onSection("notificacoes")} />
        <LinhaDeMenu icone={Shield} rotulo="Segurança" onClick={() => onSection("seguranca")} />
      </GrupoDeLinhas>

      <GrupoDeLinhas>
        <Link
          href="/contactos"
          className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 transition active:bg-slate-50"
        >
          <HelpCircle className="h-5 w-5 shrink-0 text-cyan-600" aria-hidden="true" />
          <span className="flex-1 text-[15px] font-medium text-[#0B1929]">Ajuda e contactos</span>
        </Link>
        <LinhaDeMenu
          icone={LogOut}
          rotulo="Sair"
          tom="perigo"
          onClick={() => signOut({ callbackUrl: "/" })}
        />
      </GrupoDeLinhas>
    </div>
  );
}
