"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  Building2,
  FileText,
  HelpCircle,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  ArrowLeft,
  Star,
  Truck,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import { GrupoDeLinhas, LinhaDeMenu, euros } from "@/components/portal/Portal";
import InstalarNoTelemovel from "@/components/portal/InstalarNoTelemovel";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import {
  guardarFotografia,
  lerFotografia,
  limparFotografias,
} from "@/lib/ultima-fotografia";
import Trabalhos from "./Trabalhos";
import Carteira from "./Carteira";
import Historico from "./Historico";
import PerfilEcra, { type SeccaoDoPerfil } from "./Perfil";
import Ajuda from "./Ajuda";
import Agenda from "./Agenda";
import { propostasDe, type DadosDaCarteira, type Pedido, type Perfil } from "./tipos";
import Avaliacoes from "./Avaliacoes";
import AvisosNoTelemovel from "./AvisosNoTelemovel";
import ConviteDaAppPro from "./ConviteDaAppPro";
import AvisosNoWhatsApp from "./AvisosNoWhatsApp";
import PrecosDasMudancas from "./PrecosDasMudancas";
import FichaNoGoogle from "./FichaNoGoogle";
import PerfilPorCompletar from "./PerfilPorCompletar";
import ComoFunciona from "./ComoFunciona";
import InterruptorDoTema from "./InterruptorDoTema";
import { resumoDoPerfil, faltasDaSeccao, type SeccaoComFalta } from "@/lib/perfil-por-completar";
import { faltaDosPrecosDasMudancas } from "@/lib/precos-das-mudancas-do-profissional";
import {
  aplicarTema,
  guardarTema,
  lerTemaGuardado,
  type TemaDoPainel,
} from "@/lib/tema-do-painel";
import { EMPRESA_PARCEIRA_AO_PUBLICO } from "@/lib/identificacao-legal";
import {
  fasesDosTrabalhos,
  juntarAvisos,
  lerAvisosGuardados,
  linhaDosPedidosNovos,
  MARCAR_TUDO_COMO_LIDO,
  marcarComoLido,
  marcarTodosComoLidos,
  numeroDoSino,
  oQueMudou,
  quantosPorLer,
  retomarSeForDestaConta,
  SEM_AVISOS,
  textoDosAvisos,
  TITULO_DOS_AVISOS,
  type AvisoDoProfissional,
} from "@/lib/avisos-do-profissional";
import { dataEHora } from "@/lib/historico-negociacao";
import { ROTULOS_DA_CARTEIRA } from "@/lib/rotulos-da-carteira";

/**
 * O SINO GUARDA-SE NO APARELHO (d13, 13-11-2026): o que ficou lido e a
 * fotografia das fases, para a próxima visita. Só números de pedido, fases e as
 * frases — nada do cliente — e sai ao sair da conta.
 */
const CHAVE_DOS_AVISOS = "clyon:pro:avisos";
function lerAvisosDoAparelho(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_DOS_AVISOS);
  } catch {
    return null;
  }
}
function guardarAvisosNoAparelho(fases: ReadonlyMap<number, string>, avisos: readonly AvisoDoProfissional[]): void {
  try {
    window.localStorage.setItem(CHAVE_DOS_AVISOS, textoDosAvisos(fases, avisos));
  } catch {
    /* navegação privada ou sem espaço: o sino começa de novo na próxima visita */
  }
}
function esquecerAvisosDoAparelho(): void {
  try {
    window.localStorage.removeItem(CHAVE_DOS_AVISOS);
  } catch {
    /* já não estava lá */
  }
}

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
  | "como-funciona"
  | "precos-mudancas"
  | "ficha-google"
  | SeccaoDoPerfil;

const ECRAS_VALIDOS: Ecra[] = [
  "menu",
  "trabalhos",
  "agenda",
  "carteira",
  "historico",
  "avaliacoes",
  "ajuda",
  "como-funciona",
  "precos-mudancas",
  "ficha-google",
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

/** O que se guarda para o painel abrir já com alguma coisa. Ver `ultima-fotografia`. */
type Fotografia = {
  nome: string;
  pedidos: Pedido[];
  carteira: DadosDaCarteira | null;
  perfil: Perfil | null;
};

const CHAVE_DO_PAINEL = "pro:painel";

/** A roda de quando ainda não há nada para mostrar — no servidor e no browser. */
function Roda() {
  return (
    <div className="flex items-center justify-center py-24 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
    </div>
  );
}

/*
 * MUDAR DE ECRÃ SEM IR AO SERVIDOR — 07-10-2026.
 *
 * *«Estou em Os meus trabalhos e clico para a Agenda, mas ele não vai de
 * imediato; clico várias vezes e nada muda, e só após 10 s vai sozinho.»*
 *
 * O `router.push` do Next ia buscar a página outra vez ao servidor a cada
 * ecrã — ela é dinâmica, e o endereço mudava —, e o ecrã ficava parado até
 * a resposta chegar: meio segundo num dia bom (medido a 07-10-2026), e
 * vários quando a resposta apanha uma instância a acordar — o
 * `instrumentation.ts` corre as migrações da base antes de responder a quem
 * quer que seja. Desenhar a Agenda em si leva menos de um quarto de segundo,
 * mesmo com seiscentos pedidos e um processador quatro vezes mais lento.
 *
 * Os ecrãs do painel são todos deste componente, e o que muda é só o
 * endereço. `history.pushState` muda-o sem pedido nenhum: o Next apanha-o,
 * o `useSearchParams` acompanha, e o «voltar» do browser também não vai ao
 * servidor. O ecrã muda no próprio toque.
 *
 * E abre do princípio, como o router fazia — e não a meio da lista de onde
 * se saiu. `instant`, porque o site tem o deslizar suave ligado.
 */
function irPara(endereco: string) {
  window.history.pushState(null, "", endereco);
  window.scrollTo({ top: 0, behavior: "instant" });
}

/*
 * O PRIMEIRO DESENHO NO BROWSER É O DO SERVIDOR — 07-10-2026.
 *
 * A fotografia (`ultima-fotografia.ts`) vive no `sessionStorage`, que o
 * servidor não tem. Lá o painel desenhava a roda; no browser, o primeiro
 * desenho já trazia os trabalhos. O React encontrava duas páginas
 * diferentes, deitava fora a do servidor e queixava-se na consola — o
 * «Minified React error #418» que aparecia a cada recarregar.
 *
 * Agora o browser começa pela mesma roda, e o painel com a fotografia entra
 * logo a seguir, no instante em que o React acaba de acordar a página.
 * Quem chega por um link de dentro do site — sem página do servidor para
 * acordar — entra direito no painel, sem roda nenhuma.
 */
const semAvisos = () => () => {};

export default function PainelDoProfissional() {
  const noBrowser = useSyncExternalStore(
    semAvisos,
    () => true,
    () => false,
  );
  return noBrowser ? <PainelNoBrowser /> : <Roda />;
}

function PainelNoBrowser() {
  const router = useRouter();
  const params = useSearchParams();

  /*
   * ABRE NOS TRABALHOS — 14-09-2026.
   *
   * "Faça com que as contas, ao abrir ou recarregar, sempre abram Os meus
   * trabalhos por padrão."
   *
   * E o que ele vem ca ver. Abrir no menu obrigava a um toque para chegar ao
   * unico ecra que interessa a quem entra — e num telemovel esse toque
   * acontecia dez vezes por dia.
   *
   * O MENU CONTINUA A SER UM ECRA, agora com endereco proprio (?ecra=menu).
   * Sem isso, o "voltar" de uma seccao caia no endereco sem query, que passou
   * a querer dizer «trabalhos» — e a hierarquia que ele descreveu (trabalho →
   * lista → menu → site) perdia um degrau.
   */
  const pedido = params.get("ecra") ?? "trabalhos";
  const ecra: Ecra = (ECRAS_VALIDOS as string[]).includes(pedido) ? (pedido as Ecra) : "menu";

  /*
   * O trabalho aberto vive no endereço, como os ecrãs.
   *
   * Era estado local, e por isso invisível para o histórico: para o browser, a
   * lista e o trabalho aberto eram a mesma página. «Voltar» saltava a lista
   * inteira e ia dar ao ecrã anterior — a Agenda, se tivesse passado por lá.
   */
  const trabalhoAberto = Number(params.get("trabalho")) || null;

  /*
   * O PAINEL ABRE COM O QUE MOSTROU DA ÚLTIMA VEZ — 16-09-2026.
   *
   * "isso deve ser instantâneo também para os profissionais e clientes."
   *
   * A cada entrada — mudar de página, voltar atrás, recarregar — isto nascia
   * vazio e ficava na roda até a API responder. Um ecrã branco, todas as
   * vezes, a caminho de mostrar exactamente o que já lá tinha estado.
   *
   * Agora o primeiro desenho é a última fotografia, e a chamada corre por
   * baixo. Quem nunca abriu o painel continua a ver a roda — é a única altura
   * em que ela diz alguma coisa.
   */
  const guardado = useMemo(() => lerFotografia<Fotografia>(CHAVE_DO_PAINEL), []);

  const [nome, setNome] = useState(guardado?.nome ?? "");
  const [pedidos, setPedidos] = useState<Pedido[]>(guardado?.pedidos ?? []);
  const [carteira, setCarteira] = useState<DadosDaCarteira | null>(guardado?.carteira ?? null);
  const [perfil, setPerfil] = useState<Perfil | null>(guardado?.perfil ?? null);
  const [aCarregar, setACarregar] = useState(guardado == null);
  const [erro, setErro] = useState("");

  /*
   * O TEMA — claro ou escuro, escolhido por ele (`tema-do-painel.ts`).
   *
   * Começa «claro» no servidor e lê a escolha ao montar; o script do <head> já
   * o tinha posto antes de pintar, e isto só o confirma. Ao sair do painel o
   * tema sai com ele: o resto do site é sempre claro.
   */
  const [tema, setTema] = useState<TemaDoPainel>("claro");
  useEffect(() => {
    const escolhido = lerTemaGuardado();
    setTema(escolhido);
    aplicarTema(escolhido);
    return () => aplicarTema(null);
  }, []);
  function mudarTema(novo: TemaDoPainel) {
    setTema(novo);
    guardarTema(novo);
    aplicarTema(novo);
  }

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
  /*
   * DESDE 13-11-2026 (d13) É UM SINO. Os pedidos novos não são avisos — dão
   * uma linha só no topo da lista, e os cartões levam «Novo» —, e o resto vai
   * para o sino do cabeçalho, com o número por ler. As regras e as frases são
   * as da app Pro: `src/lib/avisos-do-profissional.ts`.
   */
  const [avisos, setAvisos] = useState<AvisoDoProfissional[]>([]);
  const [pedidosNovos, setPedidosNovos] = useState(0);
  const [sinoAberto, setSinoAberto] = useState(false);
  const [realcados, setRealcados] = useState<Set<number>>(new Set());
  const fotografiaAnterior = useRef<Map<number, string> | null>(null);
  const avisosAgora = useRef<AvisoDoProfissional[]>([]);
  const pousarAvisos = useCallback((lista: AvisoDoProfissional[]) => {
    avisosAgora.current = lista;
    setAvisos(lista);
    if (fotografiaAnterior.current) guardarAvisosNoAparelho(fotografiaAnterior.current, lista);
  }, []);

  const carregar = useCallback(async () => {
    // Declaradas cá fora porque são esperadas DEPOIS do `finally` — é lá que o
    // ecrã já abriu, e é para lá que a carteira e o perfil vão a caminho.
    let pedirCarteira: Promise<Response | null> = Promise.resolve(null);
    let pedirPerfil: Promise<Response | null> = Promise.resolve(null);
    try {
      // Sempre a versão de agora: depois de gravar os custos no perfil, a
      // sugestão de cada trabalho muda, e uma cópia guardada mostrava a antiga.
      /*
       * AS TRÊS PARTEM JUNTAS, MAS O ECRÃ NÃO ESPERA PELAS TRÊS — 16-09-2026.
       *
       * "demora muito carregar cada info, cada passo; isso na Fixando ou no
       * Óscar não acontece."
       *
       * Estavam num `Promise.all` e o painel ficava na roda até a MAIS LENTA
       * responder. Os trabalhos — que é o que ele vem ver — chegavam e ficavam
       * escondidos à espera da carteira e do perfil, que só enchem dois
       * cantos.
       *
       * Continuam a partir ao mesmo tempo: são criadas aqui, todas de uma vez.
       * O que muda é a ordem por que se esperam. O `.catch` está nas duas
       * secundárias porque, se a principal devolver 401 e sairmos daqui, elas
       * ficam sem ninguém a esperá-las.
       */
      pedirCarteira = fetch("/api/profissionais/carteira", { cache: "no-store" }).catch(
        () => null,
      );
      pedirPerfil = fetch("/api/profissionais/perfil", { cache: "no-store" }).catch(() => null);
      const rp = await fetch("/api/profissionais/meus-pedidos", { cache: "no-store" });

      if (rp.status === 401) {
        router.push("/profissionais/entrar");
        return;
      }

      const dp = await rp.json();

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

        // Na primeira leitura desta visita, a fotografia vem do aparelho — se
        // for desta conta (`retomarSeForDestaConta`).
        let anterior = fotografiaAnterior.current;
        let base = avisosAgora.current;
        if (!anterior) {
          const guardado = retomarSeForDestaConta(lerAvisosGuardados(lerAvisosDoAparelho()), novos);
          if (guardado) {
            anterior = guardado.fases;
            base = guardado.avisos;
          }
        }
        const mudou = oQueMudou(anterior, novos);
        fotografiaAnterior.current = fasesDosTrabalhos(novos);
        pousarAvisos(juntarAvisos(base, mudou.avisos));
        if (mudou.pedidosNovos.length > 0) setPedidosNovos((n) => n + mudou.pedidosNovos.length);
        // O contorno fica para o contratado e o confirmado; os novos têm «Novo».
        const paraRealcar = mudou.avisos.filter((a) => !a.id.startsWith("pago-")).map((a) => a.negociacaoId);
        if (paraRealcar.length > 0) setRealcados((v) => new Set([...v, ...paraRealcar]));

        setPedidos((antes) =>
          JSON.stringify(antes) === JSON.stringify(novos) ? antes : novos,
        );
      }
      setErro(rp.ok ? "" : (dp.error ?? "Erro ao carregar."));
    } catch {
      setErro("Erro de rede.");
    } finally {
      // O ECRÃ ABRE AQUI, com os trabalhos. O resto entra por baixo.
      setACarregar(false);
    }

    /*
     * A carteira e o perfil enchem-se quando chegarem.
     *
     * Falhar aqui não é notícia: o painel já está de pé e a mostrar o que
     * interessa. Um canto por preencher é muito melhor do que uma roda a
     * girar sobre um ecrã em branco.
     */
    try {
      const rc = await pedirCarteira;
      if (rc?.ok) {
        const dc = await rc.json();
        setCarteira((antes) => (JSON.stringify(antes) === JSON.stringify(dc) ? antes : dc));
      }
    } catch {
      /* fica como estava */
    }
    try {
      const rf = await pedirPerfil;
      if (rf?.ok) {
        const df = await rf.json();
        setPerfil((antes) =>
          JSON.stringify(antes) === JSON.stringify(df.perfil) ? antes : df.perfil,
        );
      }
    } catch {
      /* fica como estava */
    }
  }, [router, pousarAvisos]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /*
   * Grava-se o que está no ecrã, e não o que veio da rede.
   *
   * Assim a fotografia é sempre igual ao que ele viu da última vez — incluindo
   * quando uma das chamadas secundárias falhou e o canto ficou como estava. E
   * corre depois de cada mudança, e não dentro do `carregar`, para não haver
   * dois sítios a decidir o que é «a última».
   */
  useEffect(() => {
    if (aCarregar) return;
    guardarFotografia(CHAVE_DO_PAINEL, { nome, pedidos, carteira, perfil } satisfies Fotografia);
  }, [aCarregar, nome, pedidos, carteira, perfil]);

  /*
   * De minuto a minuto, sem dar por isso.
   *
   * Quem está com o painel aberto à espera de trabalho não devia ter de
   * carregar em F5 para o ver chegar — e num mercado onde o primeiro a
   * responder leva o trabalho, cada minuto de ecrã parado é dinheiro. O
   * ciclo pára com o separador escondido e vai buscar assim que ele volta à
   * frente — um ecrã minimizado não gasta pedidos, e ao voltar não mostra
   * dados de há uma hora.
   */
  useAutoRefresh(carregar);

  /**
   * A porta para fora do painel.
   *
   * Volta ao passo anterior quando o há — quem veio do site sai por onde
   * entrou. Sem histórico (o link do email aberto num separador novo, ou a
   * aplicação instalada no telemóvel, onde não há botão de trás nenhum) vai
   * para a página inicial, que é sempre melhor do que um botão que não faz
   * nada.
   */
  const voltar = useCallback(() => {
    /*
     * SOBE UM NÍVEL, e não recua no browser.
     *
     * `history.back()` recuava para a página ANTERIOR, que raramente é o sítio
     * de onde ele veio dentro do painel — e ao fim de uns toques saía da conta.
     * Ele descreveu-o exactamente: da Agenda para Os meus trabalhos, abre um
     * trabalho, e voltar dava na Agenda.
     *
     * A hierarquia do painel tem três degraus e é sempre a mesma, venha-se de
     * onde se vier: trabalho aberto → lista → menu → site. Subir por ela nunca
     * surpreende, e nunca deita ninguém fora da conta.
     */
    if (trabalhoAberto) {
      irPara("/profissionais/painel?ecra=trabalhos");
      return;
    }
    if (ecra !== "menu") {
      irPara("/profissionais/painel?ecra=menu");
      return;
    }
    window.location.href = "/";
  }, [trabalhoAberto, ecra]);

  function abrir(destino: Ecra) {
    irPara(`/profissionais/painel?ecra=${destino}`);
  }

  /** Abrir ou fechar um trabalho — um passo no histórico, como um ecrã. */
  function abrirTrabalho(negociacaoId: number | null) {
    irPara(
      negociacaoId
        ? `/profissionais/painel?ecra=trabalhos&trabalho=${negociacaoId}`
        : "/profissionais/painel?ecra=trabalhos",
    );
  }

  async function sair() {
    // Sair leva a fotografia atrás: senão, quem abrir o painel a seguir no
    // mesmo separador via, por um instante, os trabalhos de quem saiu.
    limparFotografias();
    esquecerAvisosDoAparelho();
    await fetch("/api/profissionais/sair", { method: "POST" });
    router.push("/profissionais/entrar");
  }

  if (aCarregar) return <Roda />;

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
  const porLer = quantosPorLer(avisos);
  const numeroNoSino = numeroDoSino(porLer);
  const noMenu = ecra === "menu";

  /*
   * O QUE FALTA NO PERFIL — contado uma vez, mostrado em quatro sítios.
   *
   * O cartão no topo, o triângulo em cada linha do menu, o aviso dentro de
   * cada secção e o ecrã do «como funciona» leem todos daqui. Se cada um
   * fizesse a sua conta, bastava uma regra mudar num deles para o menu dizer
   * que falta uma coisa e o ecrã garantir que está tudo bem.
   *
   * Sem perfil carregado a lista vem vazia — e não «tudo por preencher». Um
   * cartão a gritar durante o meio segundo do carregamento é um susto por
   * engano.
   */
  const resumo = perfil ? resumoDoPerfil(perfil) : null;
  const faltas = resumo?.faltas ?? [];
  const quantasFaltam = (seccao: SeccaoComFalta) => faltasDaSeccao(faltas, seccao).length;

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
        {/*
          ONDE ESTAVA O BOTÃO DE ACTUALIZAR.

          Um botão de recarregar num ecrã que já se actualiza sozinho de 30
          em 30 segundos não é uma ajuda: é uma dúvida. Quem o vê pergunta-se
          se os dados estão velhos — e carrega nele por precaução, a cada
          visita, para ver a mesma coisa.

          No lugar dele fica o que faltava mesmo: uma saída. O painel é a
          casa do profissional e não tinha porta — quem lá entra pelo link do
          email ficava sem caminho de volta ao site sem ser pelo botão do
          browser, que numa aplicação instalada no telemóvel nem sequer
          existe.
        */}
        {/*
          O SINO (d13, 13-11-2026). Os avisos saíram do canto do ecrã — uma
          pilha que se fechava um a um — para aqui, com o número por ler.
        */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setSinoAberto((v) => !v)}
            aria-label={porLer > 0 ? `${TITULO_DOS_AVISOS}, ${porLer} por ler` : TITULO_DOS_AVISOS}
            aria-expanded={sinoAberto}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition active:bg-slate-100"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {numeroNoSino && (
              <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[#00B4CC] px-1 text-center text-[11px] font-bold leading-[18px] text-white">
                {numeroNoSino}
              </span>
            )}
          </button>
          {sinoAberto && (
            <div
              role="dialog"
              aria-label={TITULO_DOS_AVISOS}
              className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
            >
              <div className="mb-1 flex items-center gap-2">
                <p className="flex-1 text-sm font-bold text-slate-800">{TITULO_DOS_AVISOS}</p>
                <button
                  type="button"
                  onClick={() => setSinoAberto(false)}
                  aria-label="Fechar"
                  className="cursor-pointer rounded-lg border-none bg-transparent p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {porLer > 0 && (
                <button
                  type="button"
                  onClick={() => pousarAvisos(marcarTodosComoLidos(avisosAgora.current))}
                  className="mb-1 cursor-pointer border-none bg-transparent p-0 text-sm font-semibold text-cyan-700"
                >
                  {MARCAR_TUDO_COMO_LIDO}
                </button>
              )}
              {avisos.length === 0 ? (
                <p className="py-3 text-sm leading-relaxed text-slate-500">{SEM_AVISOS}</p>
              ) : (
                <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
                  {avisos.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => {
                          pousarAvisos(marcarComoLido(avisosAgora.current, a.id));
                          setSinoAberto(false);
                          abrirTrabalho(a.negociacaoId);
                        }}
                        className="flex w-full cursor-pointer items-start gap-2 border-none bg-transparent px-0 py-2.5 text-left"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.lido ? "bg-transparent" : "bg-[#00B4CC]"}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm leading-snug text-slate-800 ${a.lido ? "" : "font-semibold"}`}>
                            {a.lido ? "" : <span className="sr-only">Por ler: </span>}
                            {a.texto}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">{dataEHora(a.em)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button
          onClick={voltar}
          aria-label="Voltar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition active:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {/*
        Antes de tudo o resto no menu, e só enquanto ele não decidir.

        É o cartão que pede a permissão dos avisos. Fica à cabeça porque uma
        permissão pedida a meio de uma lista não é pedida — e desaparece assim
        que ele ligar ou dispensar.
      */}
      <AvisosNoTelemovel />

      {/* O convite para o teste da app CLYON Pro — ver ConviteDaAppPro.tsx (23-10-2026). */}
      <ConviteDaAppPro />

      {/*
        E O MESMO PEDIDO, PARA O WHATSAPP — 20-09-2026.

        Dois cartões seguidos a pedir permissões parece de mais, e é a
        alternativa certa a um só: são canais diferentes, com donos diferentes.
        O de cima é uma permissão do BROWSER, que ele dá ao telemóvel e que se
        perde quando muda de aparelho. Este é um consentimento NOSSO, sobre um
        número que já temos guardado — e que só vale enquanto ele quiser.

        Só aparece com o perfil já carregado. Antes disso não se sabe se ele já
        disse que sim, e um cartão a pedir uma coisa que ele já deu é a maneira
        mais rápida de o ensinar a não ler os cartões.
      */}
      {perfil && (
        <AvisosNoWhatsApp
          ligado={perfil.avisosNoWhatsApp === true}
          desde={perfil.avisosNoWhatsAppEm ?? null}
          aoMudar={(ligado) =>
            setPerfil((p) =>
              p
                ? {
                    ...p,
                    avisosNoWhatsApp: ligado,
                    // A data certa vem da base na recarga seguinte; aqui basta
                    // não mostrar a antiga depois de ele desligar.
                    avisosNoWhatsAppEm: ligado ? p.avisosNoWhatsAppEm ?? null : null,
                  }
                : p,
            )
          }
        />
      )}

      {/*
        O QUE FALTA NO PERFIL, ANTES DOS TRABALHOS.

        Parece contra-intuitivo pôr isto por cima do que ele vem cá ver. Mas o
        que falta no perfil é a razão pela qual, muitas vezes, não há nada para
        ver: sem categorias não chega pedido nenhum, sem a base no mapa as
        distâncias saem erradas. Um aviso por baixo de uma lista vazia chega
        tarde.

        Desaparece sozinho quando não faltar nada — e enquanto faltar só coisas
        pequenas, deixa de ser âmbar.
      */}
      {/*
        BLOQUEADO NOS TRABALHOS EM DINHEIRO — 01-10-2026. «Abater no saldo +
        bloquear», decisão do dono: uma dívida à CLYON por pagar há mais de 7
        dias fecha-lhe as propostas em dinheiro. Diz-se à entrada, com o valor
        e a referência, e um toque leva-o à carteira, onde a pode pagar.
      */}
      {/*
        O MODELO DE 15-11-2026 — d10. Em stand-by (um valor em atraso há mais
        de 4 dias): continua a ver os pedidos, e aqui diz-se porquê e por onde
        pagar. Sem o IBAN, o MB WAY ou o regime de IVA: o aviso (até 22-11) ou
        o impedimento. Nada disto aparece antes da data (`novoModelo` nulo).
      */}
      {carteira?.novoModelo?.standBy && (
        <button
          onClick={() => abrir("carteira")}
          className="mb-4 block w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm leading-relaxed text-red-800"
        >
          <span className="block font-semibold">{carteira.novoModelo.standBy.accao}</span>
          {carteira.novoModelo.standBy.explicacao}
        </button>
      )}
      {carteira?.novoModelo?.dadosParaReceber &&
        (carteira.novoModelo.dadosParaReceber.estado === "aviso" ||
          carteira.novoModelo.dadosParaReceber.estado === "impede") && (
          <button
            onClick={() => abrir("banco")}
            className={`mb-4 block w-full rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed ${
              carteira.novoModelo.dadosParaReceber.estado === "impede"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {carteira.novoModelo.dadosParaReceber.frase}
          </button>
        )}
      {carteira?.bloqueioEmDinheiro && (
        <button
          onClick={() => abrir("carteira")}
          className="mb-4 block w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm leading-relaxed text-red-800"
        >
          {carteira.bloqueioEmDinheiro.explicacao}
        </button>
      )}

      {resumo && (
        <PerfilPorCompletar
          resumo={resumo}
          faltaDasMudancas={faltaDosPrecosDasMudancas(
            perfil?.categorias.includes("mudancas") === true,
            perfil?.precosDasMudancas?.estado,
          )}
          onAbrirMudancas={() => abrir("precos-mudancas")}
          onAbrir={(seccao) => abrir(seccao)}
          onComoFunciona={() => abrir("como-funciona")}
        />
      )}

      {/*
        AS AVALIACOES SAIRAM DAQUI — 14-09-2026.

        "Vamos levar as avaliações para dentro do perfil." Eram uma linha de
        menu com a media ao lado, e o perfil era um formulario sem nada dele
        la dentro. Agora vivem no perfil, por baixo dos dados, com a coroa e
        os numeros no topo. A media continua a ver-se aqui de relance, no
        cabecalho do painel.
      */}
      <GrupoDeLinhas className="mb-4">
        <LinhaDeMenu
          icone={Briefcase}
          rotulo="Os meus trabalhos"
          activo={ecra === "trabalhos"}
          destaque={
            // Os pedidos novos desde a última vez ganham ao resto: "por fazer"
            // é estado, novo é acontecimento — o que ele ainda não sabe.
            pedidosNovos > 0
              ? `${pedidosNovos} novo${pedidosNovos === 1 ? "" : "s"}`
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
              ? `${euros(carteira.carteira.cativo)} ${ROTULOS_DA_CARTEIRA.aEsperaDaConfirmacao.rotulo.toLowerCase()}`
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
          porCompletar={quantasFaltam("dados")}
          onClick={() => abrir("dados")}
        />
        <LinhaDeMenu
          icone={MapPin}
          rotulo="Serviços e raio"
          activo={ecra === "servicos"}
          valor={perfil ? `${perfil.raioKm} km` : undefined}
          porCompletar={quantasFaltam("servicos")}
          onClick={() => abrir("servicos")}
        />
        {/* Os preços das mudanças (10-11-2026): só a quem faz mudanças. */}
        {perfil?.categorias.includes("mudancas") && (
          <LinhaDeMenu
            icone={Truck}
            rotulo="Preços das mudanças"
            activo={ecra === "precos-mudancas"}
            // O estado (11-11-2026): «na lista» é sossego, os outros dois pedem um toque.
            valor={perfil.precosDasMudancas?.estado === "na_lista" ? perfil.precosDasMudancas.rotulo : undefined}
            destaque={
              perfil.precosDasMudancas && perfil.precosDasMudancas.estado !== "na_lista"
                ? perfil.precosDasMudancas.rotulo
                : undefined
            }
            aviso
            onClick={() => abrir("precos-mudancas")}
          />
        )}
        {/* A ficha no Google (11-11-2026): a nota do Google no cartão da lista das mudanças. */}
        {perfil?.categorias.includes("mudancas") && (
          <LinhaDeMenu
            icone={Star}
            rotulo="A minha ficha no Google"
            activo={ecra === "ficha-google"}
            onClick={() => abrir("ficha-google")}
          />
        )}
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
          porCompletar={quantasFaltam("faturacao")}
          onClick={() => abrir("faturacao")}
        />
        <LinhaDeMenu
          icone={Building2}
          rotulo="Conta bancária"
          activo={ecra === "banco"}
          valor={perfil?.temIban ? perfil.iban : undefined}
          destaque={perfil && !perfil.temIban ? "por indicar" : undefined}
          aviso
          porCompletar={quantasFaltam("banco")}
          onClick={() => abrir("banco")}
        />
        <LinhaDeMenu
          icone={KeyRound}
          rotulo="Palavra-passe"
          activo={ecra === "seguranca"}
          onClick={() => abrir("seguranca")}
        />
        <InterruptorDoTema tema={tema} onMudar={mudarTema} />
      </GrupoDeLinhas>

      <GrupoDeLinhas>
        {/* Era uma ligação para a página de contactos do site — mandava-o para
            fora da conta para descobrir um número de telefone. Agora abre as
            perguntas com resposta, e a caixa para escrever quando nenhuma
            serve. */}
        <InstalarNoTelemovel />
        {/* Antes da ajuda: quem chega aqui perdido não tem uma pergunta para
            fazer — tem tudo por perceber. */}
        <LinhaDeMenu
          icone={BookOpen}
          rotulo="Como funciona"
          activo={ecra === "como-funciona"}
          onClick={() => abrir("como-funciona")}
        />
        <LinhaDeMenu
          icone={HelpCircle}
          rotulo="Ajuda"
          activo={ecra === "ajuda"}
          onClick={() => abrir("ajuda")}
        />
        <LinhaDeMenu icone={LogOut} rotulo="Sair" tom="perigo" onClick={sair} />
      </GrupoDeLinhas>

      {/*
        A FACTURA AO CLIENTE É DA PARCEIRA — 22-09-2026. Dizia «quem executa o
        trabalho e emite a fatura é o profissional»; a segunda metade deixou de
        ser verdade (29-09-2026).
      */}
      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400 lg:text-left">
        A CLYON liga clientes a profissionais independentes. Quem executa o trabalho é o
        profissional. A fatura ao cliente é emitida pela {EMPRESA_PARCEIRA_AO_PUBLICO}.
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
            linhaDosNovos={linhaDosPedidosNovos(pedidosNovos)}
            onFecharLinhaDosNovos={() => setPedidosNovos(0)}
            aberto={trabalhoAberto}
            onAbrir={abrirTrabalho}
            onVoltar={() => {
              // Sair dos trabalhos e ter visto as novidades e a mesma coisa:
              // o realce ja cumpriu, e um destaque que nunca se apaga deixa
              // de destacar seja o que for.
              setRealcados(new Set());
              setPedidosNovos(0);
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
            onAbrirTrabalho={abrirTrabalho}
            onRecarregar={carregar}
          />
        )}
        {ecra === "ajuda" && <Ajuda onVoltar={() => abrir("menu")} />}

        {ecra === "precos-mudancas" && <PrecosDasMudancas onVoltar={() => abrir("menu")} onGravado={carregar} />}
        {ecra === "ficha-google" && <FichaNoGoogle onVoltar={() => abrir("menu")} />}

        {ecra === "como-funciona" && (
          <ComoFunciona
            faltas={faltas}
            onVoltar={() => abrir("menu")}
            onAbrir={(seccao) => abrir(seccao)}
          />
        )}

        {["dados", "servicos", "faturacao", "banco", "seguranca"].includes(ecra) && perfil && (
          <PerfilEcra
            seccao={ecra as SeccaoDoPerfil}
            perfil={perfil}
            onVoltar={() => abrir("menu")}
            onGravado={carregar}
            onComoFunciona={() => abrir("como-funciona")}
          />
        )}
      </div>
    </main>
  );
}
