"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  Building2,
  FileText,
  HelpCircle,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  Star,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import { GrupoDeLinhas, LinhaDeMenu, euros } from "@/components/portal/Portal";
import InstalarNoTelemovel from "@/components/portal/InstalarNoTelemovel";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import Trabalhos from "./Trabalhos";
import Carteira from "./Carteira";
import Historico from "./Historico";
import PerfilEcra, { type SeccaoDoPerfil } from "./Perfil";
import Ajuda from "./Ajuda";
import Agenda from "./Agenda";
import { propostasDe, type DadosDaCarteira, type Pedido, type Perfil } from "./tipos";
import Avaliacoes from "./Avaliacoes";

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

type Ecra =
  | "menu"
  | "trabalhos"
  | "agenda"
  | "carteira"
  | "historico"
  | "avaliacoes"
  | "ajuda"
  | SeccaoDoPerfil;

const ECRAS_VALIDOS: Ecra[] = [
  "menu",
  "trabalhos",
  "agenda",
  "carteira",
  "historico",
  "avaliacoes",
  "ajuda",
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

  /*
   * O QUE MUDOU DESDE A ÚLTIMA LEITURA — para o painel dar sinal de vida.
   *
   * O ciclo automático trazia os dados novos e pousava-os em silêncio: um
   * trabalho confirmado no backoffice aparecia na carteira sem uma palavra, e
   * ele só dava por isso se fosse lá olhar. Foi o que aconteceu ao primeiro
   * trabalho fechado pela plataforma.
   *
   * A fotografia anterior vive num ref e o diff corre A CADA leitura, antes
   * de pousar os dados. Na primeira não há novidades — há passado, e o
   * passado não é notícia.
   */
  const [novidades, setNovidades] = useState<Array<{ id: string; texto: string }>>([]);
  const [realcados, setRealcados] = useState<Set<number>>(new Set());
  const fotografiaAnterior = useRef<Map<number, string> | null>(null);

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

      /*
       * Só se troca o que mudou de facto.
       *
       * O ciclo automático corre a cada minuto, e na esmagadora maioria das
       * vezes traz exactamente o mesmo. Substituir o estado na mesma faria o
       * React redesenhar a lista toda de sessenta em sessenta segundos: a
       * fotografia a piscar, o que estivesse aberto a fechar-se, e a leitura a
       * saltar. Comparar primeiro custa uma comparação de texto e evita tudo
       * isso — o que aparece é o que é novo, e mais nada se mexe.
       */
      if (rp.ok) {
        setNome(dp.nome ?? "");
        const novos = (dp.pedidos ?? []) as Pedido[];

        const anterior = fotografiaAnterior.current;
        if (anterior) {
          const chegadas: Array<{ id: string; texto: string }> = [];
          const paraRealcar: number[] = [];
          for (const pd of novos) {
            const faseAntiga = anterior.get(pd.negociacaoId);
            if (faseAntiga === undefined) {
              chegadas.push({
                id: `novo-${pd.negociacaoId}`,
                texto: `Pedido novo na sua zona — #${pd.pedidoId}. Abra para propor.`,
              });
              paraRealcar.push(pd.negociacaoId);
            } else if (faseAntiga !== pd.fase) {
              // Só as mudanças que são notícia PARA ELE. Passar a
              // "a_confirmar" foi ele próprio a enviar a prova — não é novidade.
              if (pd.fase === "a_executar") {
                chegadas.push({
                  id: `contratado-${pd.negociacaoId}`,
                  texto: `Foi contratado — pedido #${pd.pedidoId}. A morada e o contacto já estão abertos.`,
                });
                paraRealcar.push(pd.negociacaoId);
              } else if (pd.fase === "confirmado") {
                const liquido = pd.recebeSeFechado;
                chegadas.push({
                  id: `confirmado-${pd.negociacaoId}`,
                  texto:
                    `Trabalho #${pd.pedidoId} confirmado` +
                    (liquido != null
                      ? ` — ${liquido.toFixed(2).replace(".", ",")} € já estão disponíveis na carteira.`
                      : " — o valor já está disponível na carteira."),
                });
                paraRealcar.push(pd.negociacaoId);
              } else if (pd.fase === "pago") {
                chegadas.push({
                  id: `pago-${pd.negociacaoId}`,
                  texto: `Transferência do trabalho #${pd.pedidoId} processada.`,
                });
              }
            }
          }
          if (chegadas.length > 0) {
            // Junta sem repetir: o mesmo acontecimento não vira duas linhas
            // por o ciclo correr duas vezes antes de ele fechar o aviso.
            setNovidades((v) => {
              const ids = new Set(v.map((x) => x.id));
              return [...v, ...chegadas.filter((c) => !ids.has(c.id))];
            });
            setRealcados((v) => new Set([...v, ...paraRealcar]));
          }
        }
        fotografiaAnterior.current = new Map(novos.map((x) => [x.negociacaoId, x.fase]));

        setPedidos((antes) =>
          JSON.stringify(antes) === JSON.stringify(novos) ? antes : novos,
        );
      }
      if (rc.ok) {
        setCarteira((antes) =>
          JSON.stringify(antes) === JSON.stringify(dc) ? antes : dc,
        );
      }
      if (rf.ok) {
        setPerfil((antes) =>
          JSON.stringify(antes) === JSON.stringify(df.perfil) ? antes : df.perfil,
        );
      }
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

  /*
   * De minuto a minuto, sem dar por isso.
   *
   * Um pedido tem 48 horas de prazo, mas quem está com o painel aberto à
   * espera de trabalho não devia ter de carregar em F5 para o ver chegar. O
   * ciclo pára com o separador escondido e vai buscar assim que ele volta à
   * frente — um ecrã minimizado não gasta pedidos, e ao voltar não mostra
   * dados de há uma hora.
   */
  useAutoRefresh(carregar, { intervalMs: 30_000 });

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

  // Novo é o que lhe chegou e a que ainda não respondeu. Contar todas as
  // "abertas" incluía as que já têm proposta dele à espera do cliente — e o
  // número no menu dizia mais trabalho do que o que havia mesmo.
  const aResponder = pedidos.filter(
    (p) => p.estado === "aberta" && !propostasDe(p.propostas).some((x) => x.por === "profissional"),
  ).length;

  // Quantos trabalhos contratados tem data marcada — o numero da agenda.
  const agendados = pedidos.filter(
    (p) => p.fase === "a_executar" && !p.arquivadoEm && p.dataAgendada,
  ).length;

  const porFazer = pedidos.filter((p) => p.estado === "acordada" && p.fase === "a_executar").length;
  const noMenu = ecra === "menu";

  // O menu é desenhado uma vez e serve os dois desenhos: coluna da esquerda em
  // ecrã grande, ecrã inteiro no telemóvel.
  const menu = (
    <>
      {/*
        AS NOVIDADES, ditas e nao so pousadas.

        `aria-live="polite"`: o leitor de ecra anuncia cada chegada sem
        interromper o que estiver a ler. Tocar no aviso abre os trabalhos,
        que e onde a novidade esta; o X fecha so o aviso.
      */}
      {novidades.length > 0 && (
        <div
          aria-live="polite"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md flex-col gap-2 sm:inset-x-auto sm:right-4"
        >
          {novidades.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-2 rounded-2xl border border-[#00B4CC]/40 bg-white p-3.5 shadow-lg"
            >
              <button
                onClick={() => abrir("trabalhos")}
                className="flex-1 cursor-pointer border-none bg-transparent p-0 text-left text-sm font-medium leading-snug text-slate-800"
              >
                {n.texto}
              </button>
              <button
                onClick={() => setNovidades((v) => v.filter((x) => x.id !== n.id))}
                aria-label="Fechar o aviso"
                className="shrink-0 cursor-pointer rounded-lg border-none bg-transparent p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

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
            {/* A média com o número de avaliações ao lado. A média sozinha
                mente: 5,0 de uma avaliação não é melhor do que 4,6 de
                quarenta. */}
            {perfil && (
              <button
                onClick={() => abrir("avaliacoes")}
                className="flex items-center gap-1 text-sm font-semibold text-slate-700"
              >
                <Star
                  className={`h-3.5 w-3.5 ${
                    perfil.avaliacao != null
                      ? "fill-[#00B4CC] text-[#00B4CC]"
                      : "text-slate-300"
                  }`}
                  aria-hidden="true"
                />
                {/* Sem avaliações, dizia-se nada — e nada parece uma avaria.
                    Dizer "sem avaliações" é a verdade, e mostra onde elas vão
                    aparecer quando existirem. */}
                {perfil.avaliacao != null ? (
                  <>
                    {perfil.avaliacao.toFixed(1).replace(".", ",")}
                    <span className="font-normal text-slate-400">
                      ({perfil.quantasAvaliacoes})
                    </span>
                  </>
                ) : (
                  <span className="font-normal text-slate-400">sem avaliações</span>
                )}
              </button>
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
          icone={Star}
          rotulo="Avaliações"
          valor={
            perfil?.avaliacao != null
              ? `${perfil.avaliacao.toFixed(1).replace(".", ",")} · ${perfil.quantasAvaliacoes}`
              : "—"
          }
          onClick={() => abrir("avaliacoes")}
        />
        <LinhaDeMenu
          icone={Briefcase}
          rotulo="Os meus trabalhos"
          activo={ecra === "trabalhos"}
          destaque={
            // As novidades ganham ao resto: "por fazer" é estado, novidade é
            // acontecimento — e o acontecimento é o que ele ainda não sabe.
            novidades.length > 0
              ? `${novidades.length} novidade${novidades.length === 1 ? "" : "s"}`
              : porFazer > 0
                ? `${porFazer} por fazer`
                : aResponder > 0
                  ? `${aResponder} à espera`
                  : undefined
          }
          aviso={porFazer > 0}
          onClick={() => abrir("trabalhos")}
        />
                <LinhaDeMenu
          icone={CalendarDays}
          rotulo="Agenda"
          activo={ecra === "agenda"}
          valor={agendados > 0 ? `${agendados} marcado${agendados === 1 ? "" : "s"}` : undefined}
          onClick={() => abrir("agenda")}
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
          rotulo="Perfil"
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
        {/* Era uma ligação para a página de contactos do site — mandava-o para
            fora da conta para descobrir um número de telefone. Agora abre as
            perguntas com resposta, e a caixa para escrever quando nenhuma
            serve. */}
        <InstalarNoTelemovel />
        <LinhaDeMenu
          icone={HelpCircle}
          rotulo="Ajuda"
          activo={ecra === "ajuda"}
          onClick={() => abrir("ajuda")}
        />
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
          <Trabalhos
            pedidos={pedidos}
            realcados={realcados}
            onVoltar={() => {
              // Sair dos trabalhos e ter visto as novidades e a mesma coisa:
              // o realce ja cumpriu, e um destaque que nunca se apaga deixa
              // de destacar seja o que for.
              setRealcados(new Set());
              setNovidades([]);
              abrir("menu");
            }}
            onRecarregar={carregar}
          />
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

        {ecra === "avaliacoes" && perfil && (
          <Avaliacoes
            avaliacoes={perfil.ultimasAvaliacoes ?? []}
            media={perfil.avaliacao}
            quantas={perfil.quantasAvaliacoes}
            onVoltar={() => abrir("menu")}
          />
        )}

        {ecra === "agenda" && (
          <Agenda
            pedidos={pedidos}
            onVoltar={() => abrir("menu")}
            onAbrirTrabalhos={() => abrir("trabalhos")}
          />
        )}
        {ecra === "ajuda" && <Ajuda onVoltar={() => abrir("menu")} />}

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
