"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { RAIO_MAXIMO_KM, type ErroDeInscricao } from "@/lib/inscricao-profissional";
import { TIPOS_DE_VEICULO } from "@/lib/convite-profissional";

const CATEGORIAS = SERVICE_CATEGORIES.filter((c) => c.id !== "outro");

function inputCls(erro?: string) {
  return `w-full rounded-xl border-2 bg-white px-4 py-2.5 text-base text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 ${
    erro ? "border-red-400" : "border-gray-300"
  }`;
}

/**
 * O formulário de inscrição, aberto pelo link do convite.
 *
 * O nome e o email vêm já preenchidos — foram eles que usámos para o convidar,
 * e voltar a pedi-los era fazer a pessoa escrever o que nós já sabemos. O email
 * não se edita: é a chave do convite, e trocá-lo aqui criava uma conta que não
 * corresponde a ninguém com quem falámos.
 */
/**
 * O corpo da resposta, ou `null` se não vier JSON.
 *
 * Existe para separar duas coisas que o `try/catch` juntava: "o servidor não
 * respondeu" e "o servidor respondeu uma coisa que não sei ler". A segunda é
 * um problema nosso, e dizer ao utilizador que é da ligação dele esconde-o.
 */
async function respostaEmJson(res: Response): Promise<Record<string, any> | null> {
  try {
    return (await res.json()) as Record<string, any>;
  } catch {
    return null;
  }
}

export default function InscricaoForm({
  convite,
  nomeConvidado = "",
  emailConvidado = "",
  telefoneConvidado = "",
  veiculoConvidado = "",
}: {
  /** O token do convite. Sem ele a API recusa a inscrição. */
  convite: string;
  nomeConvidado?: string;
  emailConvidado?: string;
  telefoneConvidado?: string;
  veiculoConvidado?: string;
}) {
  const [form, setForm] = useState({
    nome: nomeConvidado,
    email: emailConvidado,
    telefone: telefoneConvidado,
    tipoVeiculo: veiculoConvidado,
    nif: "",
    cidade: "",
    moradaFiscal: "",
    codigoPostalFiscal: "",
    localidadeFiscal: "",
    categorias: [] as string[],
    zonas: "",
    raioKm: "30",
    emiteFatura: false,
    regimeIva: "" as "" | "isento" | "normal",
    emiteGuiaTransporte: false,
    numeroTransportador: "",
  });
  const [erros, setErros] = useState<ErroDeInscricao[]>([]);
  const [erroGeral, setErroGeral] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  /*
   * A aceitação dos termos, explícita e não pré-marcada.
   *
   * Este formulário recolhia NIF, número de transportador, regime de IVA e —
   * mais à frente — IBAN, e anunciava uma comissão. Não havia contrato nenhum
   * a aceitar: nem caixa, nem link. Uma comissão anunciada num parágrafo não
   * vincula ninguém, e no dia de um desacordo sobre o que foi combinado não
   * havia documento a que voltar.
   *
   * Começa desmarcada de propósito. Uma caixa pré-marcada não é aceitação — é
   * uma suposição escrita à frente de quem não a fez.
   */
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [enviado, setEnviado] = useState<{ precisaVerificacaoDeGuia: boolean } | null>(null);

  const erro = (campo: string) => erros.find((e) => e.campo === campo)?.mensagem;

  function set(campo: string, valor: unknown) {
    setForm((p) => ({ ...p, [campo]: valor }));
    setErros((p) => p.filter((e) => e.campo !== campo));
  }

  function alternarCategoria(id: string) {
    setForm((p) => ({
      ...p,
      categorias: p.categorias.includes(id)
        ? p.categorias.filter((c) => c !== id)
        : [...p.categorias, id],
    }));
    setErros((p) => p.filter((e) => e.campo !== "categorias"));
  }

  async function submeter(ev: React.FormEvent) {
    ev.preventDefault();
    setAEnviar(true);
    setErroGeral("");
    setErros([]);

    try {
      const res = await fetch("/api/profissionais/inscricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          convite,
          zonas: form.zonas
            .split(",")
            .map((z) => z.trim())
            .filter(Boolean),
        }),
      });
      /*
       * O SERVIDOR PODE RESPONDER SEM JSON, E ISSO NÃO É ERRO DE REDE.
       *
       * Fazia-se `await res.json()` directamente. Qualquer resposta sem corpo
       * JSON — um 404 do middleware, um 502 da Vercel, uma página de erro do
       * Next — fazia o parse estoirar, caía no `catch`, e o ecrã dizia "Erro
       * de rede. Verifique a ligação e tente novamente."
       *
       * Aconteceu mesmo, e demorou a encontrar: a rota estava atrás de um
       * portão mais forte do que a página que a chama, e o middleware
       * respondia 404 sem corpo. O profissional lia que a Internet dele estava
       * avariada, tentava outra vez, e à quinta apanhava o limite de cinco
       * pedidos por dez minutos — a única mensagem que teria sido verdadeira.
       *
       * Culpar a ligação de quem está do outro lado, quando o servidor
       * respondeu, manda a pessoa procurar o problema no sítio errado.
       */
      const dados = await respostaEmJson(res);

      if (!res.ok || dados === null) {
        if (Array.isArray(dados?.erros)) setErros(dados.erros);
        setErroGeral(
          dados?.error ??
            `Não foi possível enviar a inscrição (erro ${res.status}). Se voltar a acontecer, fale connosco e diga este número.`,
        );
        return;
      }
      setEnviado({ precisaVerificacaoDeGuia: dados.precisaVerificacaoDeGuia === true });
    } catch {
      // Agora só chega aqui quem NÃO teve resposta nenhuma — que é o que "erro
      // de rede" quer mesmo dizer.
      setErroGeral("Não foi possível chegar ao servidor. Verifique a ligação e tente novamente.");
    } finally {
      setAEnviar(false);
    }
  }

  if (enviado) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-bold text-emerald-900">Inscrição recebida</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-800">
          Vamos analisar o seu registo. Enquanto isso não acontecer{" "}
          <strong>não recebe pedidos</strong> — é assim de propósito, para o cliente
          saber que quem lhe aparece já foi verificado.
        </p>
        {enviado.precisaVerificacaoDeGuia && (
          <p className="mx-auto mt-3 max-w-md rounded-xl border border-emerald-300 bg-white p-3 text-xs leading-relaxed text-emerald-900">
            Declarou emitir guia de transporte. Vamos confirmar o número de registo
            antes de o distintivo aparecer no seu perfil — um distintivo que
            qualquer um ligasse sozinho não valia nada para o cliente.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submeter} noValidate className="space-y-8">
      {/* ── Quem é ──────────────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-base font-bold text-slate-900">Quem é</legend>

        <div>
          <label htmlFor="nome" className="block text-sm font-medium text-gray-900">
            Nome ou empresa *
          </label>
          {/*
            `autoComplete="organization"` NÃO é detalhe.

            Este era o único campo do formulário sem `autoComplete`, e o
            formulário tem morada, código postal e localidade. O Chrome
            classifica um formulário assim como sendo de MORADA e, sem
            instrução em contrário, ofereceu a rua guardada como sugestão para
            o primeiro campo de texto.

            Foi o que aconteceu ao primeiro profissional a inscrever-se: ficou
            com "Rua Capitão Salgueiro Maia 23" no nome, e é esse nome que o
            cliente vê ao escolher quem lhe entra em casa.

            Dizer ao browser o que o campo é resolve-o na origem — não há
            validação que substitua isto, porque a validação só actua depois de
            a pessoa já ter escrito a coisa errada.
          */}
          <input
            id="nome"
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
            placeholder="Ex: Transportes Silva Lda"
            autoComplete="organization"
            className={`mt-1.5 ${inputCls(erro("nome"))}`}
          />
          <p className="mt-1 text-xs text-slate-500">
            É este nome que o cliente vê quando escolhe o profissional. Não é a morada.
          </p>
          {erro("nome") && <p className="mt-1 text-xs text-red-600">{erro("nome")}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900">
              Email *
            </label>
            {/* Não se edita: é o endereço para onde o convite foi, e trocá-lo
                aqui criava uma conta que não corresponde a ninguém com quem
                falámos. */}
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              readOnly={Boolean(emailConvidado)}
              onChange={(e) => set("email", e.target.value)}
              placeholder="geral@exemplo.pt"
              className={`mt-1.5 ${inputCls(erro("email"))} ${
                emailConvidado ? "bg-slate-50 text-slate-600" : ""
              }`}
            />
            {erro("email") && <p className="mt-1 text-xs text-red-600">{erro("email")}</p>}
            <p className="mt-1 text-xs text-slate-500">
              {emailConvidado
                ? "É o email do convite. Para o mudar, fale connosco."
                : "É por aqui que os pedidos chegam."}
            </p>
          </div>

          <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-gray-900">
              Telefone *
            </label>
            {/*
              O prefixo é fixo e não um campo a preencher, porque a validação só
              aceita números portugueses de qualquer maneira — dar um campo
              editável era convidar a escrever um indicativo que ia ser
              recusado a seguir.
            */}
            <div
              className={`mt-1.5 flex items-stretch overflow-hidden rounded-xl border-2 bg-white transition focus-within:border-cyan-600 focus-within:ring-2 focus-within:ring-cyan-600/20 ${
                erro("telefone") ? "border-red-400" : "border-gray-300"
              }`}
            >
              <span className="flex select-none items-center border-r border-gray-200 bg-slate-50 px-3 text-base font-medium text-slate-500">
                +351
              </span>
              <input
                id="telefone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                placeholder="912 345 678"
                aria-describedby={erro("telefone") ? "erro-telefone" : undefined}
                className="w-full min-w-0 bg-white px-3 py-2.5 text-base text-slate-900 outline-none"
              />
            </div>
            {erro("telefone") && (
              <p id="erro-telefone" className="mt-1 text-xs text-red-600">
                {erro("telefone")}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      {/* ── O que faz ───────────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-base font-bold text-slate-900">O que faz</legend>
        <p className="text-sm text-slate-600">
          Só recebe pedidos das categorias que escolher. Escolher tudo não o ajuda —
          traz-lhe pedidos que não quer.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIAS.map((c) => {
            const activa = form.categorias.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => alternarCategoria(c.id)}
                aria-pressed={activa}
                className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left text-xs font-semibold transition ${
                  activa
                    ? "border-cyan-600 bg-cyan-50 text-cyan-900"
                    : "border-gray-200 bg-white text-slate-700 hover:border-cyan-300"
                }`}
              >
                <span aria-hidden="true">{c.emoji}</span>
                {c.label}
              </button>
            );
          })}
        </div>
        {erro("categorias") && <p className="text-xs text-red-600">{erro("categorias")}</p>}

        {/* O veículo decide o que lhe podemos mandar: um sofá de três lugares
            não entra numa carrinha pequena, e mandar-lhe esse pedido é
            fazer-lhe perder a viagem — e ao cliente, o dia. */}
        <div>
          <label htmlFor="tipoVeiculo" className="block text-sm font-medium text-gray-900">
            Com que veículo trabalha *
          </label>
          <select
            id="tipoVeiculo"
            value={form.tipoVeiculo}
            onChange={(e) => set("tipoVeiculo", e.target.value)}
            className={`mt-1.5 ${inputCls(erro("tipoVeiculo"))}`}
          >
            <option value="">Escolha…</option>
            {TIPOS_DE_VEICULO.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          {erro("tipoVeiculo") && (
            <p className="mt-1 text-xs text-red-600">{erro("tipoVeiculo")}</p>
          )}
        </div>
      </fieldset>

      {/* ── Onde trabalha ───────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-base font-bold text-slate-900">Onde trabalha</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cidade" className="block text-sm font-medium text-gray-900">
              Cidade onde tem base *
            </label>
            <input
              id="cidade"
              autoComplete="address-level2"
              value={form.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              placeholder="Amadora"
              className={`mt-1.5 ${inputCls(erro("cidade"))}`}
            />
            {erro("cidade") && <p className="mt-1 text-xs text-red-600">{erro("cidade")}</p>}
          </div>

          <div>
            <label htmlFor="raio" className="block text-sm font-medium text-gray-900">
              Até quantos km se desloca *
            </label>
            <input
              id="raio"
              type="number"
              min={1}
              max={RAIO_MAXIMO_KM}
              value={form.raioKm}
              onChange={(e) => set("raioKm", e.target.value)}
              className={`mt-1.5 ${inputCls(erro("raioKm"))}`}
            />
            {erro("raioKm") && <p className="mt-1 text-xs text-red-600">{erro("raioKm")}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="zonas" className="block text-sm font-medium text-gray-900">
            Outras zonas que cobre <span className="font-normal text-slate-500">(opcional)</span>
          </label>
          <input
            id="zonas"
            value={form.zonas}
            onChange={(e) => set("zonas", e.target.value)}
            placeholder="Lisboa, Sintra, Cascais"
            className={`mt-1.5 ${inputCls()}`}
          />
          <p className="mt-1 text-xs text-slate-500">Separe por vírgulas.</p>
        </div>
      </fieldset>

      {/* ── Documentos ──────────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-base font-bold text-slate-900">Documentos que emite</legend>
        <p className="text-sm text-slate-600">
          Determina que pedidos lhe mostramos. Muitos clientes pedem fatura, e um
          pedido que a exija não chega a quem não a emite.
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-300 bg-white p-4 transition hover:border-cyan-400 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-50">
          <input
            type="checkbox"
            checked={form.emiteFatura}
            onChange={(e) => set("emiteFatura", e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-600"
          />
          <span className="flex-1">
            <span className="text-sm font-semibold text-slate-900">Emito fatura</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
              O IVA é do seu regime. Quem está em isenção não liquida IVA nenhum — a
              CLYON não se mete nisso e fatura apenas a sua própria comissão.
            </span>
          </span>
        </label>

        {form.emiteFatura && (
          <div className="space-y-3">
            <div>
              <span className="block text-sm font-medium text-gray-900">
                O seu regime de IVA *
              </span>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                Determina o que o cliente vê na confirmação. Nós não cobramos IVA sobre o
                seu serviço — quem o liquida, se for o caso, é você.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  {
                    valor: "isento" as const,
                    titulo: "Isento",
                    nota: "Art. 53.º — não liquido IVA",
                  },
                  {
                    valor: "normal" as const,
                    titulo: "Regime normal",
                    nota: "Liquido IVA a 23%",
                  },
                ].map((op) => (
                  <label
                    key={op.valor}
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border-2 border-gray-300 bg-white p-3 transition hover:border-cyan-400 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-50"
                  >
                    <input
                      type="radio"
                      name="regimeIva"
                      value={op.valor}
                      checked={form.regimeIva === op.valor}
                      onChange={() => set("regimeIva", op.valor)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {op.titulo}
                      </span>
                      <span className="block text-xs text-slate-600">{op.nota}</span>
                    </span>
                  </label>
                ))}
              </div>
              {erro("regimeIva") && (
                <p className="mt-1 text-xs text-red-600">{erro("regimeIva")}</p>
              )}
            </div>

            <label htmlFor="nif" className="block text-sm font-medium text-gray-900">
              NIF *
            </label>
            <input
              id="nif"
              autoComplete="off"
              inputMode="numeric"
              value={form.nif}
              onChange={(e) => set("nif", e.target.value)}
              placeholder="500 000 000"
              className={`mt-1.5 ${inputCls(erro("nif"))}`}
            />
            {erro("nif") && <p className="mt-1 text-xs text-red-600">{erro("nif")}</p>}

            {/* A morada da declaração de actividade, que pode não ser a cidade
                onde ele trabalha — daí serem campos diferentes. Uma fatura sem
                morada do emitente não é uma fatura. */}
            <div className="mt-4">
              <label htmlFor="moradaFiscal" className="block text-sm font-medium text-gray-900">
                Morada fiscal *
              </label>
              <input
                id="moradaFiscal"
                value={form.moradaFiscal}
                onChange={(e) => set("moradaFiscal", e.target.value)}
                placeholder="Rua e número, andar"
                autoComplete="street-address"
                className={`mt-1.5 ${inputCls(erro("moradaFiscal"))}`}
              />
              {erro("moradaFiscal") && (
                <p className="mt-1 text-xs text-red-600">{erro("moradaFiscal")}</p>
              )}
            </div>

            <div className="mt-3 grid grid-cols-[minmax(0,7rem)_1fr] gap-3">
              <div>
                <label
                  htmlFor="codigoPostalFiscal"
                  className="block text-sm font-medium text-gray-900"
                >
                  Código postal *
                </label>
                <input
                  id="codigoPostalFiscal"
                  inputMode="numeric"
                  value={form.codigoPostalFiscal}
                  onChange={(e) => set("codigoPostalFiscal", e.target.value)}
                  placeholder="2700-123"
                  autoComplete="postal-code"
                  className={`mt-1.5 ${inputCls(erro("codigoPostalFiscal"))}`}
                />
              </div>
              <div>
                <label
                  htmlFor="localidadeFiscal"
                  className="block text-sm font-medium text-gray-900"
                >
                  Localidade *
                </label>
                <input
                  id="localidadeFiscal"
                  autoComplete="address-level2"
                  value={form.localidadeFiscal}
                  onChange={(e) => set("localidadeFiscal", e.target.value)}
                  placeholder="Amadora"
                  className={`mt-1.5 ${inputCls(erro("localidadeFiscal"))}`}
                />
              </div>
            </div>
            {(erro("codigoPostalFiscal") || erro("localidadeFiscal")) && (
              <p className="mt-1 text-xs text-red-600">
                {erro("codigoPostalFiscal") ?? erro("localidadeFiscal")}
              </p>
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-300 bg-white p-4 transition hover:border-cyan-400 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-50">
          <input
            type="checkbox"
            checked={form.emiteGuiaTransporte}
            onChange={(e) => set("emiteGuiaTransporte", e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-600"
          />
          <span className="flex-1">
            <span className="text-sm font-semibold text-slate-900">
              Emito guia de transporte (e-GAR)
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
              Transportar resíduos em Portugal exige transportador registado. Sem isto
              não lhe mostramos pedidos de entulho ou monos que peçam guia.
            </span>
          </span>
        </label>

        {form.emiteGuiaTransporte && (
          <div>
            <label
              htmlFor="numeroTransportador"
              className="block text-sm font-medium text-gray-900"
            >
              Número de registo de transportador *
            </label>
            <input
              id="numeroTransportador"
              value={form.numeroTransportador}
              onChange={(e) => set("numeroTransportador", e.target.value)}
              placeholder="Ex: APA-123456"
              className={`mt-1.5 ${inputCls(erro("numeroTransportador"))}`}
            />
            {erro("numeroTransportador") && (
              <p className="mt-1 text-xs text-red-600">{erro("numeroTransportador")}</p>
            )}
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Confirmamos este número antes de o distintivo aparecer. Um distintivo que
              qualquer um ligasse sozinho não valia nada para o cliente.
            </p>
          </div>
        )}
      </fieldset>

      {erroGeral && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erroGeral}
        </p>
      )}

      <div className="space-y-3">
        <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <input
            type="checkbox"
            checked={aceitaTermos}
            onChange={(e) => setAceitaTermos(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400"
          />
          <span>
            Li e aceito os{" "}
            <a
              href="/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-700 underline underline-offset-2"
            >
              Termos e Condições
            </a>{" "}
            e a{" "}
            <a
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-700 underline underline-offset-2"
            >
              Política de Privacidade
            </a>
            . Declaro que trabalho por conta própria, que estou regularizado
            perante as Finanças e a Segurança Social, e que sou eu quem presta o
            serviço e emite a fatura ao cliente.
          </span>
        </label>

        <button
          type="submit"
          disabled={aEnviar || !aceitaTermos}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 text-base font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {aEnviar ? "A enviar…" : "Quero receber pedidos"}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Inscrever-se é gratuito. Só há comissão quando fecha um trabalho.
        </p>
      </div>
    </form>
  );
}
