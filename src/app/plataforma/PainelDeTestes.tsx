"use client";

import { useRouter } from "next/navigation";
import { Briefcase, ClipboardList, FlaskConical, LogOut, UserPlus } from "lucide-react";
import { GrupoDeLinhas, LinhaDeMenu } from "@/components/portal/Portal";
import Nota from "@/components/Nota";

/**
 * O painel do ambiente de testes.
 *
 * É a porta de entrada de quem vai experimentar o modelo novo: as três coisas
 * que se podem fazer, e nada mais. Não tenta parecer o site — parece o que é,
 * uma bancada de trabalho.
 *
 * Existe porque os fluxos entram uns pelos outros: um pedido feito como cliente
 * aparece na conta do profissional, e a prova que ele envia volta ao email do
 * cliente. Sem um sítio que os liste, testar obrigava a decorar endereços.
 */
export default function PainelDeTestes({ nome }: { nome: string }) {
  const router = useRouter();

  async function sair() {
    await fetch("/api/plataforma/sair", { method: "POST" });
    router.replace("/plataforma/entrar");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 ring-1 ring-cyan-200">
          <FlaskConical className="h-6 w-6 text-cyan-700" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-[#0B1929]">CLYON plataforma</h1>
          <p className="truncate text-sm text-slate-500">{nome}</p>
        </div>
      </header>

      <GrupoDeLinhas titulo="Como cliente" className="mb-4">
        <LinhaDeMenu
          icone={ClipboardList}
          rotulo="Fazer um pedido"
          onClick={() => router.push("/plataforma/pedir")}
        />
      </GrupoDeLinhas>

      <GrupoDeLinhas titulo="Como profissional" className="mb-4">
        <LinhaDeMenu
          icone={Briefcase}
          rotulo="A minha conta"
          onClick={() => router.push("/profissionais/painel")}
        />
        <LinhaDeMenu
          icone={UserPlus}
          rotulo="Inscrever um profissional"
          onClick={() => router.push("/profissionais")}
        />
      </GrupoDeLinhas>

      <GrupoDeLinhas className="mb-4">
        <LinhaDeMenu icone={LogOut} rotulo="Sair" tom="perigo" onClick={sair} />
      </GrupoDeLinhas>

      <Nota titulo="Isto corre sobre os dados a sério" icone="aviso" tom="seguro">
        Não é uma cópia: os pedidos que criar aqui entram na mesma base do site, os
        emails saem mesmo, e os profissionais que inscrever ficam inscritos. O que não
        acontece ainda é o pagamento — o valor cativo é contabilístico e não passa por
        conta nenhuma.
      </Nota>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
        Fechado ao público. O site continua a funcionar como sempre em clyon.pt — nada
        daqui aparece lá até decidirmos abrir.
      </p>
    </main>
  );
}
